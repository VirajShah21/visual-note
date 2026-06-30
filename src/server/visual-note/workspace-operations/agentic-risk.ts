import { restoreWorkspaceSnapshot, snapshotWorkspace } from "./exports"
import { applyChangePlan, collectIssueSummary, validateAfterMutation } from "./change-plans"
import { applyChangePlanOperation } from "./change-plan-operation"
import { agenticPlanOptimizer } from "./agentic-preflight"
import { goalToAgentPlan } from "./publish-workflows"
import { appendAgenticObservation, findOwnedNotebook, riskFromOperation } from "./selectors"
import { cloneWorkspace, invalidInput, notFound, ok, safeTrim } from "./result"
import { ExecutionRiskProfile, VisualNoteWorkspace } from "./types"

export const agenticGoalToPipeline = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { goal: string; notebookId?: string; includePrechecks?: boolean; includeOptimized?: boolean },
) => {
    const plan = goalToAgentPlan(workspace, userId, {
        goal: input.goal,
        notebookId: input.notebookId,
        includePrechecks: input.includePrechecks ?? false,
    })
    if (!plan.ok) return plan

    if (!input.includeOptimized)
        return ok({
            ...plan.value,
            toolChain: plan.value.plan,
            pipeline: "raw",
            prechecksEnabled: input.includePrechecks ?? false,
        })

    const optimized = agenticPlanOptimizer(workspace, userId, {
        plan: plan.value.plan,
        maxSteps: plan.value.plan.length,
    })

    if (!optimized.ok) return optimized

    return ok({
        ...plan.value,
        toolChain: optimized.value.plan,
        pipeline: "optimized",
        plan: optimized.value.plan,
        prechecksEnabled: input.includePrechecks ?? false,
        optimization: {
            originalCount: optimized.value.originalCount,
            optimizedCount: optimized.value.optimizedCount,
            removed: optimized.value.removed,
            warnings: optimized.value.warnings,
        },
    })
}

export const planRiskProfile = (workspace: VisualNoteWorkspace, userId: string, input: { plan: Array<{ tool: string; input: Record<string, unknown> }>; notebookId?: string }) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan must be a non-empty array.")

    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    let nextWorkspace = cloneWorkspace(workspace)
    const blockers: string[] = []
    const operationRisk = input.plan.map((operation, index) => {
        const before = collectIssueSummary(nextWorkspace, userId)
        const applied = applyChangePlanOperation(nextWorkspace, userId, { ...operation, input: operation.input })
        if (!applied.ok) {
            blockers.push(`Operation ${operation.tool} blocked: ${applied.message}`)
            const risk = riskFromOperation(operation, before, before)
            return {
                index,
                tool: operation.tool,
                risk: "high" as const,
                reasons: [...risk.reasons, applied.message],
            }
        }

        const after = collectIssueSummary(applied.value.workspace, userId)
        nextWorkspace = applied.value.workspace
        const risk = riskFromOperation(operation, before, after)
        return { index, tool: operation.tool, risk: risk.risk, reasons: risk.reasons }
    })

    const hasHigh = operationRisk.some(item => item.risk === "high")
    const hasMedium = operationRisk.some(item => item.risk === "medium")
    const overallRisk: ExecutionRiskProfile["overallRisk"] = blockers.length > 0 ? "high" : hasHigh ? "high" : hasMedium ? "medium" : "low"
    const blockersSet = [...new Set(blockers)]

    return ok({
        plan: input.plan.map(item => ({ tool: item.tool, input: item.input })),
        overallRisk,
        operationRisk,
        blockerRisk: blockersSet,
    } as ExecutionRiskProfile)
}

export const executePlanOptimistic = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        notebookId?: string
        continueOnFailure?: boolean
        dryRun?: boolean
        maxSteps?: number
        rollbackOnFailure?: boolean
        checkpointLabel?: string
    },
) => {
    const operations = input.plan.slice(0, input.maxSteps ?? input.plan.length).map(operation => ({
        ...operation,
        input: operation.input ?? {},
    }))
    if (operations.length === 0) return invalidInput("plan must be a non-empty array.")

    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const run = (sourceWorkspace: VisualNoteWorkspace) =>
        applyChangePlan(sourceWorkspace, userId, {
            operations,
            continueOnFailure: input.continueOnFailure ?? true,
            dryRun: input.dryRun,
        })

    const withCheckpointName = safeTrim(input.checkpointLabel || `agentic-${new Date().toISOString()}`)
    const checkpointed = input.dryRun
        ? { ok: true as const, value: { workspace } }
        : makeRevertPoint(workspace, userId, {
              name: `agentic-revert-${withCheckpointName}`,
              note: `Checkpoint created before optimistic execution.`,
          })
    if (!checkpointed.ok) return checkpointed

    const attempted = run(checkpointed.value.workspace)
    if (!attempted.ok) return attempted

    const validation = input.notebookId
        ? validateAfterMutation(attempted.value.workspace, userId, { notebookId: input.notebookId })
        : validateAfterMutation(attempted.value.workspace, userId, {})
    if (!validation.ok) return validation

    const failed = attempted.value.blockers.length > 0
    let workspaceResult = attempted.value.workspace
    let restoredFrom = false
    if (input.rollbackOnFailure && !input.dryRun && failed && !input.continueOnFailure) {
        const restore = checkpointed.value.workspace.snapshots?.find(item => item.name === `agentic-revert-${withCheckpointName}`)
        if (restore) {
            const restored = restoreWorkspaceSnapshot(checkpointed.value.workspace, userId, { snapshotId: restore.id })
            if (restored.ok) {
                workspaceResult = restored.value.restoredWorkspace
                restoredFrom = true
            }
        }
    }

    const observation = appendAgenticObservation(workspaceResult, {
        goal: "execute_plan_optimistic",
        status: failed ? "warning" : "ok",
        summary: `Executed ${operations.length} step(s) optimistically.`,
        plan: operations,
        blockers: attempted.value.blockers,
        note: restoredFrom ? `Restored from checkpoint agentic-revert-${withCheckpointName}` : undefined,
    })

    return ok({
        ...attempted.value,
        workspace: observation,
        rollbackAttempted: input.rollbackOnFailure === true,
        restoredFromCheckpoint: restoredFrom,
        checkpointName: `agentic-revert-${withCheckpointName}`,
        validation: validation.value,
        plan: operations,
    })
}

export const makeRevertPoint = (workspace: VisualNoteWorkspace, userId: string, input: { name?: string; note?: string; goal?: string }) => {
    const createdAt = new Date().toISOString()
    const result = snapshotWorkspace(workspace, userId, {
        name: safeTrim(input.name) || `agentic-revert-${createdAt}`,
        note: safeTrim(input.note) || (input.goal ? `Goal: ${input.goal}` : "Agentic revert point."),
    })
    if (!result.ok) return result

    return ok({ ...result.value, revertPointId: result.value.snapshot.id, createdAt })
}

export const agenticWorkspaceSnapshotBefore = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; name?: string; note?: string; goal?: string }) => {
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    return makeRevertPoint(workspace, userId, {
        name: input.name || `agentic-snapshot-before-${new Date().toISOString()}`,
        note: input.note,
        goal: input.goal,
    })
}
