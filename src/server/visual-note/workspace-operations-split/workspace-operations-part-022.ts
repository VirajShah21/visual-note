import { executePlanWithGuarantees } from "./workspace-operations-part-035"
import { topicSemanticsGraph } from "./workspace-operations-part-019"
import { proposeSchemaEvolution, reconcileExternalReference } from "./workspace-operations-part-018"
import { proposeNavigationOrder } from "./workspace-operations-part-014"
import { writeViewContent } from "./workspace-operations-part-005"
import { findOwnedNotebook, scopedWorkspaceEntities } from "./workspace-operations-part-004"
import { byPosition, ChangePlanOperation, clampIndex, cloneWorkspace, notFound, ok, safeTrim, WorkspaceOpportunity } from "./workspace-operations-part-002"
import { VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-021"

export const agenticSuggestRestructure = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; maxSuggestions?: number }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const navigation = proposeNavigationOrder(workspace, userId, { notebookId: notebook.id, dryRun: true })
    if (!navigation.ok) return navigation
    const semantic = topicSemanticsGraph(workspace, userId, {
        notebookId: notebook.id,
        threshold: 0.2,
        maxEdgesPerTopic: 8,
    })
    if (!semantic.ok) return semantic

    const suggestions: WorkspaceOpportunity[] = []
    const scope = scopedWorkspaceEntities(workspace, userId, notebook.id)
    const currentPageOrder = byPosition(scope.pages).map(item => item.id)
    if (JSON.stringify(currentPageOrder) !== JSON.stringify(navigation.value.planned?.pageIds ?? currentPageOrder))
        suggestions.push({
            id: notebook.id,
            scope: "notebook",
            priority: "medium",
            action: "reorder_pages",
            detail: "Current page order differs from semantic/overview-first recommendation.",
            targetId: notebook.id,
            targetTitle: `Restructure ${notebook.title}`,
        })

    navigation.value.planned?.topicOrders.forEach(item => {
        const planned = item.topicIds
        const current = byPosition(scope.topics.filter(topic => topic.pageId === item.pageId)).map(topic => topic.id)
        if (JSON.stringify(current) !== JSON.stringify(planned))
            suggestions.push({
                id: item.pageId,
                scope: "page",
                priority: "low",
                action: "reorder_topics",
                detail: "Adjust topic order to prefer overview and descriptive names.",
                targetId: item.pageId,
                targetTitle: `Page ${item.pageId}`,
            })
    })

    semantic.value.edges.forEach(edge => {
        suggestions.push({
            id: edge.toTopicId,
            scope: "topic",
            priority: edge.weight >= 0.45 ? "medium" : "low",
            action: "create_semantic_link",
            detail: `Strong semantic link to ${edge.fromTopicId} with weight ${edge.weight}.`,
            targetId: edge.toTopicId,
            targetTitle: edge.toTopicId,
        })
    })

    const maxSuggestions = clampIndex(input.maxSuggestions ?? 12, 40)
    return ok({
        notebookId: notebook.id,
        suggestionCount: suggestions.length,
        suggestions: suggestions.slice(0, maxSuggestions),
        plan: [...(navigation.value.planned?.topicOrders.map(item => ({ tool: "reorder_topics", input: { pageId: item.pageId, topicIds: item.topicIds } })) ?? [])].slice(0, 20),
    })
}

export const agenticReferenceRewrite = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId?: string; includeDisplayUrls?: boolean; applyFixes?: boolean; dryRun?: boolean },
) => {
    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    if (scope.notebooks.length === 0) return notFound("No matching notebook found.")

    const reconciled = reconcileExternalReference(workspace, userId, {
        notebookId: input.notebookId,
        includeDisplayUrls: input.includeDisplayUrls ?? false,
    })
    if (!reconciled.ok) return reconciled

    const candidates = reconciled.value.candidates.filter(item => item.status === "unresolved")
    const titleToId = new Map<string, string[]>()
    scope.pages.forEach(item => titleToId.set(item.title.toLowerCase(), [...(titleToId.get(item.title.toLowerCase()) ?? []), item.id]))
    scope.topics.forEach(item => titleToId.set(item.title.toLowerCase(), [...(titleToId.get(item.title.toLowerCase()) ?? []), item.id]))
    scope.views.forEach(item => titleToId.set(item.title.toLowerCase(), [...(titleToId.get(item.title.toLowerCase()) ?? []), item.id]))

    const rewrites: Array<{ viewId: string; oldUrl: string; newUrl: string; context: string }> = []
    const byView = new Map<string, string>()
    candidates.forEach(candidate => {
        const urlKey = safeTrim(candidate.link).toLowerCase()
        if (!candidate.link || candidate.link.includes("http")) return
        const label = safeTrim(candidate.context).toLowerCase()
        const targetIds = titleToId.get(urlKey.replace(/^#/, "").trim()) ?? titleToId.get(label) ?? []
        if (targetIds.length !== 1) return
        const targetId = targetIds[0]
        if (!targetId) return
        rewrites.push({ viewId: candidate.sourceViewId, oldUrl: candidate.link, newUrl: `#${targetId}`, context: candidate.context })
        const next =
            byView.get(candidate.sourceViewId) ??
            byView.set(candidate.sourceViewId, scope.views.find(view => view.id === candidate.sourceViewId)?.content ?? "").get(candidate.sourceViewId)
        if (next) byView.set(candidate.sourceViewId, next.replace(candidate.link, `#${targetId}`))
    })

    if (!rewrites.length) return ok({ ...reconciled.value, rewrites: [], applied: false, applyRequested: input.applyFixes ?? false })
    if (!input.applyFixes || input.dryRun) return ok({ ...reconciled.value, rewrites, applied: false, applyRequested: input.applyFixes ?? false })

    let nextWorkspace = cloneWorkspace(workspace)
    Array.from(byView.entries()).forEach(([viewId, content]) => {
        const view = nextWorkspace.views.find(item => item.id === viewId)
        if (!view) return
        const rewritten = writeViewContent(nextWorkspace, viewId, content, view.displays.length)
        nextWorkspace = rewritten.workspace
    })

    return ok({
        ...reconciled.value,
        rewrites,
        applied: true,
        workspace: nextWorkspace,
        applyRequested: true,
    })
}

export const agenticComponentPipeline = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; apply?: boolean; maxSteps?: number }) => {
    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    if (scope.notebooks.length === 0) return notFound("No matching notebook found.")

    const proposal = proposeSchemaEvolution(workspace, userId, { notebookId: input.notebookId })
    if (!proposal.ok) return proposal

    const pipeline = proposal.value.proposals
        .slice(0, clampIndex(input.maxSteps ?? proposal.value.proposals.length, 120))
        .map((item): ChangePlanOperation | null => {
            if (item.action === "migrate_view_to_structured" && item.scope === "view")
                return { tool: "rewrite_view_layout_for_mode", input: { viewId: item.id, mode: "structured", addRecommendedDisplays: true } }

            if (item.action === "add_primary_display" && item.scope === "view")
                return { tool: "add_display_to_view", input: { viewId: item.id, kind: "data-card", name: "Primary data card" } }

            return null
        })
        .filter((next): next is ChangePlanOperation => next !== null)

    if (!input.apply) return ok({ scope: "notebook", notebookIds: scope.notebookIds, proposals: proposal.value.proposals, pipeline, applied: false })

    const applied = executePlanWithGuarantees(workspace, userId, {
        plan: pipeline.map(item => ({ tool: item.tool, input: item.input })),
        continueOnFailure: false,
        dryRun: false,
        rollbackOnFailure: true,
        notebookId: input.notebookId,
        maxSteps: input.maxSteps,
    })
    if (!applied.ok) return applied

    return ok({
        ...proposal.value,
        scope: "notebook",
        notebookIds: scope.notebookIds,
        pipeline,
        applied: true,
        execution: {
            blockers: applied.value.blockers,
            validation: applied.value.validation,
        },
        workspace: applied.value.workspace,
    })
}
