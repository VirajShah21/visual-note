import { workspaceHealthCheck } from "./health"
import { validateAfterMutation } from "./change-plans"
import { contentDriftMonitor, inferComponentType } from "./policies"
import { agenticStructuredIngestFromText } from "./agentic-policy"
import { findDuplicateContent } from "./analysis"
import { findOwnedView } from "./read-model"
import { scopedWorkspaceEntities } from "./selectors"
import { invalidInput, notFound, ok } from "./result"
import { ComponentKind, ViewMode, VisualNoteWorkspace } from "./types"

export const agenticDataIngestValidateAndApply = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        text: string
        notebookId?: string
        notebookTitle?: string
        pageId?: string
        pageTitle?: string
        topicMode?: ViewMode
        maxSections?: number
        maxViewsPerSection?: number
        apply?: boolean
        validate?: boolean
    },
) => {
    const parsed = agenticStructuredIngestFromText(workspace, userId, {
        text: input.text,
        notebookId: input.notebookId,
        notebookTitle: input.notebookTitle,
        pageId: input.pageId,
        pageTitle: input.pageTitle,
        topicMode: input.topicMode,
        maxSections: input.maxSections,
        maxViewsPerSection: input.maxViewsPerSection,
        apply: input.apply ?? false,
        dryRun: false,
    })
    if (!parsed.ok) return parsed

    if (!parsed.value.workspace || !input.apply || !input.validate)
        return ok({
            ...parsed.value,
            validateRequested: Boolean(input.validate),
            validation:
                parsed.value.mode === "preview"
                    ? undefined
                    : parsed.value.workspace
                      ? validateAfterMutation(parsed.value.workspace as VisualNoteWorkspace, userId, { notebookId: parsed.value.notebookId }).ok
                      : false,
        })

    const validation = validateAfterMutation(parsed.value.workspace as VisualNoteWorkspace, userId, { notebookId: parsed.value.notebookId })
    if (!validation.ok) return validation

    return ok({
        ...parsed.value,
        validated: true,
        validation: validation.value,
    })
}

export const agenticComponentCompatibilityCheck = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        data?: unknown
        viewId?: string
        componentKind?: ComponentKind
        strict?: boolean
    },
) => {
    const providedData =
        input.data !== undefined
            ? input.data
            : input.viewId
              ? (() => {
                    const context = findOwnedView(workspace, userId, input.viewId)
                    if (!context) return undefined
                    return context.view.displays[0]?.data
                })()
              : undefined

    if (providedData === undefined) return invalidInput("Either data or viewId with display data is required.")

    const inferred = inferComponentType(workspace, userId, { data: providedData })
    if (!inferred.ok) return inferred

    const compatibility = !input.componentKind || input.componentKind === inferred.value.kind ? "compatible" : "incompatible"

    return ok({
        inferred: inferred.value,
        expectedKind: inferred.value.kind,
        requestedKind: input.componentKind,
        compatibility,
        strict: input.strict ?? false,
        recommendation: input.componentKind
            ? input.componentKind === inferred.value.kind
                ? "No conversion needed."
                : `Consider rewriting data for ${input.componentKind} compatibility.`
            : inferred.value.reasons.join(" "),
    })
}

export const agenticComponentContractAudit = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; viewId?: string }) => {
    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    if (scope.notebooks.length === 0) return notFound("No matching notebook found.")

    const targetViews = input.viewId ? scope.views.filter(view => view.id === input.viewId) : scope.views
    const checks = targetViews.flatMap(view =>
        view.displays.map(display => {
            const inferred = inferComponentType(workspace, userId, { data: display.data })
            if (!inferred.ok) return { status: "unknown" as const, viewId: view.id, viewTitle: view.title, displayId: display.id, note: inferred.message }

            return {
                status: display.kind === inferred.value.kind ? ("compatible" as const) : ("incompatible" as const),
                viewId: view.id,
                viewTitle: view.title,
                displayId: display.id,
                displayKind: display.kind,
                inferredKind: inferred.value.kind,
                reasons: inferred.value.reasons,
            }
        }),
    )

    return ok({
        scope: input.viewId ? "view" : input.notebookId ? "notebook" : "workspace",
        notebookId: input.notebookId,
        viewId: input.viewId,
        totalViews: targetViews.length,
        totalDisplays: checks.length,
        compatible: checks.filter(item => item.status === "compatible").length,
        incompatible: checks.filter(item => item.status === "incompatible").length,
        unknown: checks.filter(item => item.status === "unknown").length,
        checks,
    })
}

export const agenticDriftScheduler = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; staleAfterDays?: number; includeAutoPlan?: boolean }) => {
    const drift = contentDriftMonitor(workspace, userId, {
        notebookId: input.notebookId,
        staleAfterDays: input.staleAfterDays,
    })
    if (!drift.ok) return drift

    const duplicates = findDuplicateContent(workspace, userId, { notebookId: input.notebookId })
    if (!duplicates.ok) return duplicates

    const health = workspaceHealthCheck(workspace, userId)
    if (!health.ok) return health

    const suggestions = [
        ...drift.value.staleItems.map(item => ({
            id: `drift-${item.id}`,
            scope: item.scope,
            priority: "medium" as const,
            action: `Resolve stale ${item.scope} ${item.id}`,
            detail: item.reason,
            targetId: item.id,
            targetTitle: item.title,
        })),
        ...duplicates.value.matches.map(item => ({
            id: `duplicate-${item.ids.join("-")}`,
            scope: item.scope,
            priority: "low" as const,
            action: `Merge duplicate ${item.scope}: ${item.title}`,
            detail: `Detected ${item.ids.length} duplicates.`,
            targetId: item.ids[0] ?? "",
            targetTitle: item.title,
        })),
    ]

    const sorted = suggestions.slice(0, 20)
    const schedule = {
        cadence: "daily",
        timezone: "UTC",
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        includeAutoPlan: input.includeAutoPlan ?? false,
        suggestions: sorted,
    }

    if (input.includeAutoPlan) {
        const scheduledPlan = sorted.map(item => ({
            tool: item.scope === "page" ? "agentic_auto_repair" : item.scope === "topic" ? "agentic_suggest_restructure" : "agentic_reference_rewrite",
            input: item.scope === "topic" ? { notebookId: input.notebookId, includePrechecks: true } : { notebookId: input.notebookId },
        }))

        return ok({ ...schedule, scheduled: sorted.length > 0 ? scheduledPlan : [], draftPlan: scheduledPlan })
    }

    return ok({ ...schedule, summary: { suggestions: sorted.length, blockers: health.value.issues.length } })
}
