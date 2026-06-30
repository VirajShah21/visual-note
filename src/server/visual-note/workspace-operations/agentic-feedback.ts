import { diffNotebookState } from "./planning"
import { applyChangePlan, validateAfterMutation } from "./change-plans"
import { contentDriftMonitor } from "./policies"
import { agenticChangeSet } from "./agentic-tools"
import { analyzeWorkspaceGaps } from "./analysis"
import { findOwnedView } from "./read-model"
import { appendAgenticObservation, findOwnedNotebook } from "./selectors"
import { toCardType } from "./utils"
import { invalidInput, notFound, ok, safeTrim } from "./result"
import { DriftReason, VisualNoteWorkspace } from "./types"

export const agenticChangeSetRenderer = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        notebookId?: string
        maxSteps?: number
        includeNarrative?: boolean
    },
) => {
    const changeSet = agenticChangeSet(workspace, userId, input)
    if (!changeSet.ok) return changeSet

    const touched = {
        notebooks: new Set<string>(),
        pages: new Set<string>(),
        topics: new Set<string>(),
        views: new Set<string>(),
    }
    const warnings = changeSet.value.stepResults.flatMap(step => step.warnings)
    const blockedCount = changeSet.value.stepResults.filter(step => step.blocked).length

    changeSet.value.stepResults.forEach(step => {
        step.touched.notebooks.forEach(item => touched.notebooks.add(item))
        step.touched.pages.forEach(item => touched.pages.add(item))
        step.touched.topics.forEach(item => touched.topics.add(item))
        step.touched.views.forEach(item => touched.views.add(item))
    })

    const readableTouches = {
        notebooks: touched.notebooks.size,
        pages: touched.pages.size,
        topics: touched.topics.size,
        views: touched.views.size,
    }
    const narrative = [
        `Plan has ${changeSet.value.plan.length} step(s).`,
        `Touches ${readableTouches.notebooks} notebook(s), ${readableTouches.pages} page(s), ${readableTouches.topics} topic(s), ${readableTouches.views} view(s).`,
        `Estimated blockers: ${blockedCount}.`,
        `Status: ${blockedCount ? "blocked" : "ok"}.`,
        `Warnings: ${(warnings.length > 0 && warnings.join("; ")) || "none"}.`,
    ]

    return ok({
        ...changeSet.value,
        touches: readableTouches,
        touchedIds: {
            notebooks: [...touched.notebooks],
            pages: [...touched.pages],
            topics: [...touched.topics],
            views: [...touched.views],
        },
        humanReadable: input.includeNarrative === false ? undefined : narrative,
        changeSetSummary: {
            before: changeSet.value.before,
            after: changeSet.value.after,
            changed: changeSet.value.changed,
            blockedCount,
        },
    })
}

export const driftReasoningReport = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; staleAfterDays?: number }) => {
    const drift = contentDriftMonitor(workspace, userId, input)
    if (!drift.ok) return drift
    const gaps = analyzeWorkspaceGaps(workspace, userId, { notebookId: input.notebookId, includeHealthSummary: true })

    const reasons: DriftReason[] = drift.value.staleItems.flatMap(item => {
        if (item.scope === "display") return []
        const recommendation = item.scope === "view" ? "Review content and add structured display blocks if content is stable." : "Review and either repurpose or remove."
        return [
            {
                scope: item.scope,
                id: item.id,
                title: item.title,
                reason: item.reason,
                suggestion: recommendation,
            },
        ]
    })

    return ok({
        staleCount: drift.value.staleCount,
        staleThresholdDays: drift.value.staleThresholdDays,
        notebookIds: drift.value.notebookIds,
        reasonCount: reasons.length,
        reasons,
        healthSummary: gaps.ok ? gaps.value.healthSummary : null,
        recommendations:
            reasons.length > 0 ? ["Run publish_preflight_multi_notebook.", "Run propose_schema_evolution and apply safe suggestions."] : ["No significant drift detected."],
    })
}

export const agenticToolFeedback = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { goal: string; status: "ok" | "warning" | "failed"; plan: Array<{ tool: string; input: Record<string, unknown> }>; summary: string; blockers?: string[] },
) => {
    if (!safeTrim(input.goal) || !safeTrim(input.summary)) return invalidInput("goal and summary are required.")
    if (!input.plan) return invalidInput("plan is required.")

    const observed = appendAgenticObservation(workspace, {
        goal: input.goal,
        status: input.status,
        summary: input.summary,
        plan: input.plan,
        blockers: input.blockers ?? [],
    })

    return ok({
        ...observed,
        status: "recorded",
        recordCount: observed.agenticObservations?.length ?? 0,
    })
}

export const applyRepairPlan = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId?: string
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        continueOnFailure?: boolean
        dryRun?: boolean
        runValidation?: boolean
    },
) => {
    const result = applyChangePlan(workspace, userId, {
        operations: input.plan.map(item => ({ tool: item.tool, input: item.input })),
        continueOnFailure: input.continueOnFailure,
        dryRun: input.dryRun,
    })
    if (!result.ok) return result

    if (input.notebookId) {
        const notebook = findOwnedNotebook(result.value.workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const validation = input.runValidation ? validateAfterMutation(result.value.workspace, userId, { notebookId: input.notebookId }) : undefined
    return ok({
        ...result.value,
        dryRun: input.dryRun ?? false,
        validation: validation && validation.ok ? validation.value : undefined,
    })
}

export const generateDatasetCard = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const primaryDisplay = context.view.displays[0]
    const source = primaryDisplay ? primaryDisplay.data : {}
    const entries = Object.entries(source ?? {})
        .slice(0, 24)
        .map(([name, value]) => ({
            name,
            type: toCardType(value),
            sample: value,
        }))

    const sampleRows = Array.isArray(source) ? source.slice(0, 5) : undefined
    const fieldNames = Object.keys(Array.isArray(sampleRows) ? ((sampleRows[0] as Record<string, unknown>) ?? {}) : source)

    return ok({
        notebookId: context.notebook.id,
        notebookTitle: context.notebook.title,
        pageId: context.page.id,
        pageTitle: context.page.title,
        topicId: context.topic.id,
        topicTitle: context.topic.title,
        viewId: context.view.id,
        viewTitle: context.view.title,
        fields: entries,
        rowCount: Array.isArray(source) ? source.length : Object.keys(source ?? {}).length,
        sampleCount: Array.isArray(source) ? (sampleRows?.length ?? 0) : Object.keys(source ?? {}).length,
        sampleRows: sampleRows ?? undefined,
        fieldNames,
        generatedAt: new Date().toISOString(),
        note: primaryDisplay ? `Generated for ${primaryDisplay.kind} display.` : "No display data found.",
    })
}

export const notebookDiffForAgent = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; snapshotId?: string }) => {
    const compare = diffNotebookState(workspace, userId, input)
    if (!compare.ok) return compare

    const changes = [
        { type: "pages_added", items: compare.value.delta.added.pages },
        { type: "topics_added", items: compare.value.delta.added.topics },
        { type: "views_added", items: compare.value.delta.added.views },
        { type: "pages_removed", items: compare.value.delta.removed.pages },
        { type: "topics_removed", items: compare.value.delta.removed.topics },
        { type: "views_removed", items: compare.value.delta.removed.views },
    ]

    const actionPlan = changes.flatMap(change => {
        if (change.items.length === 0) return []
        return [
            {
                type: change.type,
                count: change.items.length,
                recommendation: change.type.includes("added") ? "Verify references and ordering." : "Consider restore or merge.",
            },
        ]
    })

    return ok({
        notebookId: compare.value.notebookId,
        snapshotId: compare.value.snapshotId,
        current: compare.value.current,
        snapshot: compare.value.snapshot,
        changes,
        actionPlan,
        humanMessage: `${compare.value.current.views} current views vs ${compare.value.snapshot.views} snapshot views.`,
    })
}
