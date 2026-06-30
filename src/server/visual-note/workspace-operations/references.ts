import { applyChangePlan, applyValidationForPlan } from "./change-plans"
import { collectDisplayUrls, findOwnedNotebook, parseMarkdownLinks } from "./selectors"
import { ChangePlanOperation, notFound, ok, SchemaEvolutionProposal } from "./result"
import { parseArticleContent, ReconciliationCandidate, VisualNoteWorkspace } from "./types"

export const proposeSchemaEvolution = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string }) => {
    const notebookIds = input.notebookId
        ? [findOwnedNotebook(workspace, userId, input.notebookId)?.id].filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId).map(item => item.id)
    if (notebookIds.length === 0) return notFound("No matching notebook found.")

    const proposals: SchemaEvolutionProposal[] = []
    notebookIds.forEach(id => {
        const notebookId = id as string
        const notebook = workspace.notebooks.find(item => item.id === notebookId)
        if (!notebook) return
        const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
        const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
        const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))

        views.forEach(view => {
            const headings = parseArticleContent(view.content, view.displays.length).headings.length
            if (headings >= 8 && view.mode === "article" && view.displays.length === 0)
                proposals.push({
                    scope: "view",
                    id: view.id,
                    title: view.title,
                    action: "migrate_view_to_structured",
                    reason: "Large article-like view with many headings should be structured.",
                    migration: { mode: "structured" },
                })
            if (headings >= 6 && view.mode === "structured" && view.displays.length === 0)
                proposals.push({
                    scope: "view",
                    id: view.id,
                    title: view.title,
                    action: "add_primary_display",
                    reason: "Structured mode view should contain at least one display.",
                    migration: { kind: "data-card" },
                })
        })

        topics.forEach(topic => {
            if (topic.summary.length === 0)
                proposals.push({
                    scope: "topic",
                    id: topic.id,
                    title: topic.title,
                    action: "populate_topic_summary",
                    reason: "Topic summary is empty and can be used for semantic links.",
                })
        })
    })

    return ok({
        notebookIds,
        proposalCount: proposals.length,
        proposals,
        migrationPlanAvailable: proposals.length > 0,
    })
}

export const agenticSchemaEvolutionPlan = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; apply?: boolean; maxActions?: number }) => {
    const proposal = proposeSchemaEvolution(workspace, userId, { notebookId: input.notebookId })
    if (!proposal.ok) return proposal

    const requested = input.maxActions ? Math.max(1, Math.min(input.maxActions, proposal.value.proposals.length)) : proposal.value.proposals.length
    const selected = proposal.value.proposals.slice(0, requested)
    const operations: ChangePlanOperation[] = []

    selected.forEach(item => {
        if (item.scope === "view" && item.action === "migrate_view_to_structured" && item.id) {
            operations.push({
                tool: "change_view_mode",
                input: {
                    viewId: item.id,
                    mode: "structured",
                    keepContent: true,
                },
            })
            return
        }

        if (item.scope === "view" && item.action === "add_primary_display" && item.id) {
            const kind = typeof item.migration?.kind === "string" ? item.migration.kind : "data-card"
            operations.push({
                tool: "add_display_to_view",
                input: {
                    viewId: item.id,
                    kind,
                    name: `Schema evolution ${kind}`,
                    data: {},
                },
            })
            return
        }

        if (item.scope === "topic" && item.action === "populate_topic_summary" && item.id)
            operations.push({
                tool: "rename_topic",
                input: {
                    topicId: item.id,
                    summary: "This topic was auto-populated during schema evolution planning.",
                },
            })
    })

    if (!input.apply) return ok({ ...proposal.value, requested: requested, operations, applied: false })

    if (operations.length === 0) return ok({ ...proposal.value, requested: 0, operations, applied: false, note: "No actionable schema evolution operations." })

    const applied = applyChangePlan(workspace, userId, { operations, maxSteps: operations.length })
    if (!applied.ok) return applied

    const validation = applyValidationForPlan(applied.value.workspace, userId, input.notebookId)
    return ok({
        ...proposal.value,
        requested,
        operations,
        applied: true,
        blockers: applied.value.blockers,
        validation,
        workspace: applied.value.workspace,
    })
}

export const reconcileExternalReference = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includeDisplayUrls?: boolean }) => {
    const notebooks = input.notebookId
        ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (notebooks.length === 0) return notFound("No matching notebook found.")

    const notebookIds = new Set(notebooks.filter((item): item is NonNullable<typeof item> => !!item).map(item => item.id))
    const viewIds = new Set(
        workspace.views
            .filter(view => {
                const pageId = workspace.topics.find(topic => topic.id === view.topicId)?.pageId
                const notebookId = pageId ? workspace.pages.find(page => page.id === pageId)?.notebookId : undefined
                return !!notebookId && notebookIds.has(notebookId)
            })
            .map(view => view.id),
    )

    const candidates: ReconciliationCandidate[] = []
    workspace.views.forEach(view => {
        if (!viewIds.has(view.id)) return
        const headings = parseArticleContent(view.content, view.displays.length).headings
        const links = parseMarkdownLinks(view.content)
        links.forEach(item => {
            const normalized = item.url.toLowerCase()
            const isInternalAnchor = item.url.startsWith("#")
            if (isInternalAnchor) {
                const headingMatch = headings.some(heading => heading.id.toLowerCase() === normalized.slice(1) || heading.title.toLowerCase() === normalized.slice(1))
                candidates.push({
                    sourceViewId: view.id,
                    link: item.url,
                    kind: "markdown-link",
                    context: item.label,
                    status: headingMatch ? "supported" : "unresolved",
                })
                return
            }
            if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
                candidates.push({ sourceViewId: view.id, link: item.url, kind: "markdown-link", context: item.label, status: "supported" })
                return
            }
            candidates.push({
                sourceViewId: view.id,
                link: item.url,
                kind: "markdown-link",
                context: item.label,
                status: "unresolved",
            })
        })

        if (!input.includeDisplayUrls) return
        const urls = collectDisplayUrls(view.displays, "")
        urls.forEach(item => {
            const normalized = item.url.toLowerCase()
            const isKnown = normalized.startsWith("http://") || normalized.startsWith("https://")
            candidates.push({
                sourceViewId: view.id,
                link: item.url,
                kind: "display-url",
                context: `${item.key}:${item.path}`,
                status: isKnown ? "supported" : "unresolved",
            })
        })
    })

    return ok({
        notebookIds: [...notebookIds],
        supported: candidates.filter(item => item.status === "supported").length,
        unresolved: candidates.filter(item => item.status === "unresolved").length,
        candidates,
    })
}
