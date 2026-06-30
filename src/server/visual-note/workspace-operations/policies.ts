import { snapshotCompare } from "./repairs"
import { addDisplayToView } from "./displays"
import { findOwnedView, writeViewContent } from "./read-model"
import { defaultWorkspacePolicyRules, findOwnedNotebook } from "./selectors"
import { inferComponentKindFromData, normalizeInputData } from "./utils"
import { notFound, ok, safeTrim, WorkspacePolicyRule } from "./result"
import { ComponentKind, parseArticleContent, VisualNoteWorkspace } from "./types"

export const snapshotRestorePlan = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; snapshotId?: string }) => {
    const target = workspace.snapshots?.find(item => item.id === input.snapshotId) ?? workspace.snapshots?.[0]
    if (!target) return notFound("Snapshot not found.")
    const compare = snapshotCompare(workspace, userId, { notebookId: input.notebookId, snapshotId: target.id })
    if (!compare.ok) return compare

    const planSteps = [
        `Restore workspace from snapshot ${target.id}.`,
        `Review changes between current and snapshot ${target.name}.`,
        `Optionally run execute_plan_with_guarantees after restore.`,
    ]

    return ok({
        notebookId: input.notebookId,
        snapshotId: target.id,
        snapshotName: target.name,
        snapshotCreatedAt: target.createdAt,
        comparison: compare.value,
        plan: planSteps,
    })
}

export const workspacePolicyEngine = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        action: "list" | "validate" | "apply"
        notebookId?: string
        policyRules?: WorkspacePolicyRule[]
    },
) => {
    const activeRules = input.policyRules?.length ? input.policyRules : defaultWorkspacePolicyRules
    if (input.action === "list")
        return ok({
            action: "list",
            rules: activeRules,
        })

    if (input.action === "apply")
        return ok({
            action: "apply",
            applied: true,
            ruleCount: activeRules.length,
            message: "Policies are evaluated at runtime and are not persisted in workspace data yet.",
        })

    if (!input.notebookId) return notFound("notebookId is required for policy validation.")
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const pages = workspace.pages.filter(item => item.notebookId === notebook.id)
    const topics = workspace.topics.filter(item => pages.some(page => page.id === item.pageId))
    const views = workspace.views.filter(item => topics.some(topic => topic.id === item.topicId))

    const violations: { ruleId: string; details: string }[] = []
    const checks = activeRules.map(rule => {
        if (rule.check === "notebook_summary" && !safeTrim(notebook.summary)) violations.push({ ruleId: rule.id, details: `Notebook ${notebook.title} summary is missing.` })
        if (rule.check === "non_empty_titles" && pages.some(item => !item.title.trim())) violations.push({ ruleId: rule.id, details: "Found topic/page/view with empty title." })
        if (rule.check === "display_or_content" && views.some(view => !view.content.trim() && view.displays.length === 0))
            violations.push({ ruleId: rule.id, details: "Some views have neither content nor display data." })
        if (rule.check === "layout_density" && views.some(view => parseArticleContent(view.content, view.displays.length).headings.length > 30))
            violations.push({ ruleId: rule.id, details: "Very dense content layout detected." })

        return {
            ruleId: rule.id,
            passed: !violations.some(item => item.ruleId === rule.id),
            severity: rule.severity,
        }
    })

    return ok({
        action: "validate",
        notebookId: notebook.id,
        passed: violations.length === 0,
        checks,
        violations,
        policyCount: activeRules.length,
    })
}

export const contentDriftMonitor = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; staleAfterDays?: number }) => {
    const notebooks = input.notebookId
        ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (notebooks.length === 0) return notFound("No matching notebook found.")

    const staleItems: Array<{ scope: "page" | "topic" | "view" | "display"; id: string; title: string; reason: string }> = []
    const staleThreshold = Math.max(1, input.staleAfterDays ?? 30)

    notebooks.forEach(notebook => {
        if (!notebook) return
        const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
        const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
        const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))
        const displayCountByTopic = new Map<string, number>()
        views.forEach(view => {
            const current = displayCountByTopic.get(view.topicId) ?? 0
            displayCountByTopic.set(view.topicId, current + view.displays.length)
        })

        pages.forEach(page => {
            if (topics.some(topic => topic.pageId === page.id)) return
            staleItems.push({ scope: "page", id: page.id, title: page.title, reason: "Page has no child topics and may be stale." })
        })
        topics.forEach(topic => {
            const connectedViews = views.filter(view => view.topicId === topic.id)
            if (connectedViews.length > 0 && !topic.summary.trim() && topic.title.toLowerCase().includes("overview"))
                staleItems.push({ scope: "topic", id: topic.id, title: topic.title, reason: `Overview topic has empty summary.` })
            if (!connectedViews.length) staleItems.push({ scope: "topic", id: topic.id, title: topic.title, reason: "Topic has no child views." })
        })
        views.forEach(view => {
            if (!view.content.trim()) staleItems.push({ scope: "view", id: view.id, title: view.title, reason: "Empty view content." })
            if (view.displays.every(display => !display.data || Object.keys(display.data).length === 0))
                staleItems.push({ scope: "display", id: view.id, title: view.title, reason: "View has display placeholders without payload." })
            if (!view.content.includes("#") && !view.displays.length)
                staleItems.push({ scope: "view", id: view.id, title: view.title, reason: "View has no heading structure and no displays." })
            if (view.displays.length === 0 && view.content.trim() && view.content.length > 1200 && displayCountByTopic.get(view.topicId) === 0)
                staleItems.push({ scope: "view", id: view.id, title: view.title, reason: "Large article content may be missing structured display data." })
        })
    })

    return ok({
        notebookIds: notebooks.map(item => item?.id ?? "").filter(Boolean),
        staleItems,
        staleCount: staleItems.length,
        staleThresholdDays: staleThreshold,
    })
}

export const inferComponentType = (workspace: VisualNoteWorkspace, userId: string, input: { data: unknown }) => {
    const normalized = normalizeInputData(input.data)
    if (!normalized.data) return notFound(normalized.error ?? "No data provided.")

    const inferred = inferComponentKindFromData(normalized.data)
    const hasArrayData = Array.isArray(normalized.data)
    const sampleCount = hasArrayData ? normalized.data.length : 1

    return ok({
        kind: inferred.kind,
        confidence: inferred.confidence,
        reasons: inferred.reasons,
        sampleCount,
        normalizedType: hasArrayData ? "array" : typeof normalized.data,
        samplePreview: Array.isArray(normalized.data) ? normalized.data[0] : normalized.data,
    })
}

export const importDataBlock = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        viewId: string
        data: unknown
        kind?: ComponentKind
        includeInArticle?: boolean
        name?: string
        position?: number
    },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const normalized = normalizeInputData(input.data)
    if (!normalized.data) return notFound(normalized.error ?? "No data provided.")

    const resolvedKind = input.kind || inferComponentKindFromData(normalized.data).kind
    const display = addDisplayToView(workspace, userId, {
        viewId: context.view.id,
        kind: resolvedKind,
        name: input.name,
        data: normalized.data as Record<string, unknown>,
        position: input.position,
    })
    if (!display.ok) return display

    let nextWorkspace = display.value.workspace
    const view = nextWorkspace.views.find(item => item.id === context.view.id)
    if (!view) return notFound("View not found after adding display.")

    const includeInArticle = input.includeInArticle ?? true
    if (!includeInArticle)
        return ok({
            ...display.value,
            view,
            includeInArticle,
            inferredKind: resolvedKind,
            dataCount: Array.isArray(normalized.data) ? normalized.data.length : 1,
            added: true,
        })

    const placeholder = `\n\n{{display:${view.displays.length}}}`
    const nextContent = view.content.includes("{{display:") ? `${view.content}${placeholder}` : `${view.content}${placeholder}`
    const updated = writeViewContent(nextWorkspace, view.id, nextContent, view.displays.length)
    nextWorkspace = updated.workspace

    return ok({
        ...updated,
        view: updated.view,
        inferredKind: resolvedKind,
        dataCount: Array.isArray(normalized.data) ? normalized.data.length : 1,
        includeInArticle,
        added: true,
    })
}
