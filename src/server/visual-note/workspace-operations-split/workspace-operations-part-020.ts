import { analyzeOrphanedData, workspaceHealthCheck } from "./workspace-operations-part-037"
import { planAgenticWorkflow } from "./workspace-operations-part-035"
import { computeChangeImpact, publishDiagnose } from "./workspace-operations-part-034"
import { contentDriftMonitor, workspacePolicyEngine } from "./workspace-operations-part-031"
import { findDuplicateContent } from "./workspace-operations-part-012"
import { appendAgenticObservation, countScopeState, findOwnedNotebook, scopedWorkspaceEntities } from "./workspace-operations-part-004"
import { clampIndex, invalidInput, notFound, ok, safeTrim } from "./workspace-operations-part-002"
import { AgenticDryRunResult, AgenticObservationInput, VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-019"

export const agenticObservationLog = (workspace: VisualNoteWorkspace, userId: string, input: AgenticObservationInput) => {
    const action = input.action === "append" ? "append" : "read"
    if (action === "append") {
        const summary = safeTrim(input.summary)
        const goal = safeTrim(input.goal)
        if (!summary) return invalidInput("summary is required for append.")
        if (!goal) return invalidInput("goal is required for append.")
        if (!input.plan) return invalidInput("plan is required for append.")
        const append = appendAgenticObservation(workspace, {
            goal,
            status: input.status ?? "ok",
            summary,
            plan: input.plan,
            blockers: input.blockers ?? [],
            note: input.note,
        })
        return ok({
            action: "append",
            observationCount: append.agenticObservations?.length ?? 0,
            observations: append.agenticObservations?.slice(-1) ?? [],
            workspace: append,
        })
    }

    const maxItems = clampIndex(input.maxItems ?? 20, 200)
    const observations = [...(workspace.agenticObservations ?? [])].reverse().filter(item => !input.status || item.status === input.status)
    const filtered = input.goal ? observations.filter(item => item.goal.includes(input.goal ?? "")) : observations
    return ok({
        action: "read",
        count: filtered.length,
        truncatedTo: maxItems,
        observations: filtered.slice(0, maxItems),
    })
}

export const agenticObserveWorkspace = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includePolicy?: boolean }) => {
    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    if (scope.notebooks.length === 0) return notFound("No matching notebook found.")

    const health = workspaceHealthCheck(workspace, userId)
    const drift = contentDriftMonitor(workspace, userId, { notebookId: input.notebookId })
    const duplicates = findDuplicateContent(workspace, userId, { notebookId: input.notebookId })
    const orphaned = analyzeOrphanedData(workspace, userId)

    if (!duplicates.ok) return duplicates
    if (!orphaned.ok) return orphaned
    if (!drift.ok) return drift

    const policy = input.includePolicy ? scope.notebooks.map(notebook => workspacePolicyEngine(workspace, userId, { action: "validate", notebookId: notebook.id })) : []
    const policyFailures = policy.filter(item => item.ok && item.value.passed === false).length

    const issueSummary = {
        total: health.ok ? health.value.issues.length : 0,
        blockers: health.ok ? health.value.issues.filter(item => item.severity === "error").length : 1,
        warnings: health.ok ? health.value.issues.filter(item => item.severity === "warning").length : 0,
    }

    return ok({
        scope: scope.notebookIds.length === 1 ? "notebook" : "workspace",
        notebookIds: scope.notebookIds,
        counts: countScopeState(scope),
        health: issueSummary,
        duplicates: {
            totalGroups: duplicates.value.totalGroups,
            totalMatches: duplicates.value.matches.length,
        },
        orphaned: {
            orphanPages: orphaned.value.orphanPages.length,
            orphanTopics: orphaned.value.orphanTopics.length,
            orphanViews: orphaned.value.orphanViews.length,
        },
        drift: {
            staleCount: drift.value.staleCount,
            staleThresholdDays: drift.value.staleThresholdDays,
        },
        policy: input.includePolicy
            ? {
                  validated: policyFailures === 0,
                  checkedNotebooks: scope.notebookIds.length,
                  failureCount: policyFailures,
              }
            : undefined,
        recentObservations: (workspace.agenticObservations ?? []).slice(-5),
    })
}

export const agenticIntentToPlan = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        goal: string
        notebookId?: string
        includePrechecks?: boolean
        maxSteps?: number
        constraints?: string[]
    },
) => {
    const goal = safeTrim(input.goal)
    if (!goal) return invalidInput("goal is required.")
    const targetNotebookId = safeTrim(input.notebookId) || (input.notebookId === "" ? "" : undefined)
    const notebook = targetNotebookId ? findOwnedNotebook(workspace, userId, targetNotebookId) : workspace.notebooks.find(item => item.userId === userId)
    if (!notebook) return notFound("No matching notebook found.")

    const plan = planAgenticWorkflow(workspace, userId, {
        goal,
        notebookId: notebook.id,
        includePrechecks: input.includePrechecks ?? false,
    })
    if (!plan.ok) return plan

    const normalizedConstraints = (input.constraints ?? []).map(item => safeTrim(item).toLowerCase()).filter(Boolean)
    const steps = [...plan.value.plan]
    const requested = new Set(normalizedConstraints)
    if (requested.has("publish") && !steps.some(item => item.tool === "publish_notebook")) {
        const diagnose = publishDiagnose(workspace, userId, { notebookId: notebook.id })
        if (diagnose.ok && diagnose.value.ready) steps.push({ tool: "publish_notebook", input: { notebookId: notebook.id, publish: true } })
    }

    if (requested.has("repair") && !steps.some(item => item.tool === "repair_workspace")) steps.push({ tool: "repair_workspace", input: {} })

    if (requested.has("restructure") && !steps.some(item => item.tool === "agentic_suggest_restructure"))
        steps.push({ tool: "agentic_suggest_restructure", input: { notebookId: notebook.id } })

    return ok({
        ...plan.value,
        goal,
        notebookId: notebook.id,
        constraints: normalizedConstraints,
        plan: steps.slice(0, clampIndex(input.maxSteps ?? steps.length, 200)),
    })
}

export const agenticPlanDryRun = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { plan: Array<{ tool: string; input: Record<string, unknown> }>; notebookId?: string; maxSteps?: number },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const impact = computeChangeImpact(workspace, userId, {
        operations: input.plan,
        maxSteps: input.maxSteps,
    })
    if (!impact.ok) return impact

    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    const targetScope = {
        notebooks: scope.notebookIds,
        pages: scope.pages.map(item => item.id),
        topics: scope.topics.map(item => item.id),
        views: scope.views.map(item => item.id),
    }

    const touched = {
        notebooks: [...new Set(impact.value.operationReports.flatMap(report => report.touched.notebooks))].filter(id => targetScope.notebooks.includes(id)),
        pages: [...new Set(impact.value.operationReports.flatMap(report => report.touched.pages))].filter(id => targetScope.pages.includes(id)),
        topics: [...new Set(impact.value.operationReports.flatMap(report => report.touched.topics))].filter(id => targetScope.topics.includes(id)),
        views: [...new Set(impact.value.operationReports.flatMap(report => report.touched.views))].filter(id => targetScope.views.includes(id)),
    }
    const blockers = impact.value.operationReports.flatMap(item => item.warnings)
    const afterCounts = {
        notebooks: impact.value.workspacePreview.notebookCount,
        pages: impact.value.workspacePreview.pageCount,
        topics: impact.value.workspacePreview.topicCount,
        views: impact.value.workspacePreview.viewCount,
        displays: scope.displays.length,
    }
    return ok({
        status: impact.value.workspacePreview.issueCount > 0 ? "risk" : "ok",
        before: countScopeState(scopedWorkspaceEntities(workspace, userId, input.notebookId)),
        after: afterCounts,
        touched,
        operationReports: impact.value.operationReports.map(item => ({
            tool: item.tool,
            input: item.touched ? ({ tool: item.tool, input: item.touched } as Record<string, unknown>) : item.tool === "" ? {} : { tool: item.tool, input: {} },
            issueCount: item.issueCount,
            warnings: item.warnings,
        })),
        changed: impact.value.operationReports.length,
        blockedCount: blockers.length,
        warnings: [...new Set(blockers)],
        dryRun: true,
    } as AgenticDryRunResult)
}
