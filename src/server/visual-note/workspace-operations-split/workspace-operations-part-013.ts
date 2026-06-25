import { analyzeOrphanedData } from "./workspace-operations-part-037"
import { contentDriftMonitor } from "./workspace-operations-part-031"
import { analyzeWorkspaceGaps, findDuplicateContent } from "./workspace-operations-part-012"
import { addDisplayToView } from "./workspace-operations-part-010"
import { changeViewMode } from "./workspace-operations-part-009"
import { findOwnedView, writeViewContent } from "./workspace-operations-part-005"
import { findOwnedNotebook } from "./workspace-operations-part-004"
import { displayKindForMode } from "./workspace-operations-part-003"
import { byPosition, clampIndex, cloneWorkspace, notFound, ok, WorkspaceOpportunity } from "./workspace-operations-part-002"
import { NotebookView, ViewMode, VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-012"

export const discoverWorkspaceOpportunities = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includeSummary?: boolean; maxItems?: number }) => {
    const maxItems = clampIndex(input.maxItems ?? 25, 50)
    const targets = input.notebookId ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean) : workspace.notebooks.filter(notebook => notebook.userId === userId)

    if (targets.length === 0) return notFound("No matching notebook found.")

    const opportunities: WorkspaceOpportunity[] = []
    const duplicates = findDuplicateContent(workspace, userId, { notebookId: input.notebookId })
    const orphaned = analyzeOrphanedData(workspace, userId)
    const drift = contentDriftMonitor(workspace, userId, { notebookId: input.notebookId })

    const gap = analyzeWorkspaceGaps(workspace, userId, { notebookId: input.notebookId, includeHealthSummary: false })
    if (gap.ok && gap.value.gaps.length > 0)
        gap.value.gaps.slice(0, maxItems).forEach((item, index) => {
            opportunities.push({
                id: `gap-${index}`,
                scope: item.scope,
                priority: item.severity === "error" ? "high" : "medium",
                action: "repair_gap",
                detail: item.message,
                targetId: item.id,
                targetTitle: workspace.notebooks.some(notebook => notebook.id === item.id) ? item.id : item.id,
            })
        })

    if (duplicates.ok && duplicates.value.matches.length > 0)
        opportunities.push({
            id: "duplicate-content",
            scope: "view",
            priority: "low",
            action: "deduplicate",
            detail: `Found ${duplicates.value.totalGroups} duplicate title/content groups.`,
            targetId: input.notebookId ?? "workspace",
            targetTitle: input.notebookId ?? "Workspace",
        })

    if (orphaned.ok && orphaned.value.orphanPages.length > 0)
        opportunities.push({
            id: "orphan-pages",
            scope: "page",
            priority: "high",
            action: "repair_orphans",
            detail: `${orphaned.value.orphanPages.length} orphan page records found.`,
            targetId: input.notebookId ?? "workspace",
            targetTitle: input.notebookId ?? "Workspace",
        })

    if (drift.ok && drift.value.staleItems.length > 0)
        opportunities.push({
            id: "content-drift",
            scope: "view",
            priority: "medium",
            action: "refresh_stale_content",
            detail: `${drift.value.staleItems.length} content-drift candidates found.`,
            targetId: input.notebookId ?? "workspace",
            targetTitle: input.notebookId ?? "Workspace",
        })

    targets.forEach(notebook => {
        if (!notebook) return
        const pages = byPosition(workspace.pages.filter(page => page.notebookId === notebook.id))
        if (pages.length === 0)
            opportunities.push({
                id: `create-page-${notebook.id}`,
                scope: "notebook",
                priority: "high",
                action: "create_page",
                detail: `${notebook.title} has no pages.`,
                targetId: notebook.id,
                targetTitle: notebook.title,
            })

        pages.forEach(page => {
            const topics = byPosition(workspace.topics.filter(topic => topic.pageId === page.id))
            if (topics.length === 0)
                opportunities.push({
                    id: `create-topic-${page.id}`,
                    scope: "page",
                    priority: "medium",
                    action: "add_topic",
                    detail: `Page ${page.title} has no topics.`,
                    targetId: page.id,
                    targetTitle: page.title,
                })

            topics.forEach(topic => {
                const views = byPosition(workspace.views.filter(view => view.topicId === topic.id))
                if (views.length === 0)
                    opportunities.push({
                        id: `create-view-${topic.id}`,
                        scope: "topic",
                        priority: "medium",
                        action: "add_view",
                        detail: `Topic ${topic.title} has no views.`,
                        targetId: topic.id,
                        targetTitle: topic.title,
                    })
                else if (views.some(view => !view.content.trim() && view.displays.length === 0))
                    opportunities.push({
                        id: `fill-view-${topic.id}`,
                        scope: "topic",
                        priority: "low",
                        action: "auto_fill_defaults_for_view",
                        detail: `Topic ${topic.title} contains empty/untitled views.`,
                        targetId: topic.id,
                        targetTitle: topic.title,
                    })
            })
        })
    })

    const unique = opportunities.reduce<WorkspaceOpportunity[]>((next, candidate) => {
        if (next.length >= maxItems) return next
        if (!next.some(item => item.action === candidate.action && item.targetId === candidate.targetId && item.scope === candidate.scope)) next.push(candidate)
        return next
    }, [])

    return ok({
        notebookIds: targets.map(notebook => notebook?.id ?? "").filter(Boolean),
        opportunities: unique,
        totals: {
            count: unique.length,
            high: unique.filter(item => item.priority === "high").length,
            medium: unique.filter(item => item.priority === "medium").length,
            low: unique.filter(item => item.priority === "low").length,
        },
        includedPublishPolicyChecks: input.includeSummary ? 1 : 0,
    })
}

export const autoFillDefaultsForView = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        viewId: string
        targetMode?: ViewMode
        includeDisplay?: boolean
        includeArticlePlaceholder?: boolean
        dryRun?: boolean
    },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const targetMode = input.targetMode ?? context.view.mode
    const result: { changed: boolean; view: NotebookView; suggestions: string[]; displayAdded?: boolean; modeChanged: boolean; placeholderAdded?: boolean } = {
        changed: false,
        view: context.view,
        suggestions: [],
        modeChanged: false,
    }

    let nextWorkspace = cloneWorkspace(workspace)
    let nextView = context.view
    if (targetMode !== context.view.mode) {
        const switched = changeViewMode(nextWorkspace, userId, { viewId: context.view.id, mode: targetMode, keepContent: true })
        if (!switched.ok) return switched
        nextWorkspace = switched.value.workspace
        nextView = nextWorkspace.views.find(view => view.id === context.view.id) ?? context.view
        result.changed = true
        result.modeChanged = true
        result.suggestions.push(`Mode changed to ${targetMode}.`)
    }

    if (input.includeDisplay !== false) {
        const recommendation = displayKindForMode(targetMode)
        const hasRecommended = nextView.displays.some(item => item.kind === recommendation)
        if (!hasRecommended) {
            const added = addDisplayToView(nextWorkspace, userId, {
                viewId: nextView.id,
                kind: recommendation,
                name: `${context.view.title} ${recommendation} block`,
                data: { title: context.view.title },
            })
            if (!added.ok) return added
            nextWorkspace = added.value.workspace
            nextView = nextWorkspace.views.find(item => item.id === nextView.id) ?? nextView
            result.changed = true
            result.displayAdded = true
            result.suggestions.push(`Added ${recommendation} display.`)
        }
    }

    if (input.includeArticlePlaceholder !== false) {
        const targetDisplayIndex = nextView.displays.length === 0 ? 0 : nextView.displays.length - 1
        const marker = `{{display:${targetDisplayIndex}}}`
        if (!nextView.content.includes(marker)) {
            const appended = `${nextView.content.trimEnd()}\n\n${marker}`
            const updated = writeViewContent(nextWorkspace, nextView.id, appended, nextView.displays.length)
            nextWorkspace = updated.workspace
            nextView = updated.view
            result.changed = true
            result.placeholderAdded = true
            result.suggestions.push(`Inserted display placeholder ${marker}.`)
        }
    }

    if (input.dryRun === true) return ok({ ...result, dryRun: true, workspace })
    if (!result.changed) return ok({ ...result, workspace, dryRun: false })
    return ok({ ...result, workspace: nextWorkspace, view: nextView, dryRun: false, changed: true })
}
