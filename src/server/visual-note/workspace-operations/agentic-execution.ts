import { repairWorkspaceConsistency } from "./health"
import { validateAfterMutation } from "./change-plans"
import { workspacePolicyEngine } from "./policies"
import { restoreRevertPoint } from "./agentic-snapshots"
import { executePlanOptimistic, planRiskProfile } from "./agentic-risk"
import { analyzeWorkspaceGaps } from "./analysis"
import { findOwnedNotebook, scopedWorkspaceEntities } from "./selectors"
import { ChangePlanOperation, invalidInput, notFound, ok } from "./result"
import { VisualNoteWorkspace } from "./types"

export const agenticPlanGuardrail = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        maxRisk?: "low" | "medium" | "high"
        notebookId?: string
        runValidation?: boolean
    },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")
    const maxRisk = input.maxRisk ?? "high"
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const risk = planRiskProfile(workspace, userId, {
        notebookId: input.notebookId,
        plan: input.plan,
    })
    if (!risk.ok) return risk

    const riskOrder = { low: 1, medium: 2, high: 3 }
    const approved: ChangePlanOperation[] = []
    const rejected: Array<{ tool: string; reason: string; risk: "low" | "medium" | "high" }> = []
    const policy = input.notebookId ? workspacePolicyEngine(workspace, userId, { action: "validate", notebookId: input.notebookId }) : undefined

    risk.value.operationRisk.forEach(item => {
        const level = item.risk
        if (riskOrder[level] > riskOrder[maxRisk]) {
            rejected.push({ tool: item.tool, risk: level, reason: item.reasons.join(", ") || "Risk exceeds configured threshold." })
            return
        }

        approved.push({ tool: item.tool, input: input.plan[item.index]?.input ?? {} })
    })

    const validation = input.runValidation ? validateAfterMutation(workspace, userId, input.notebookId ? { notebookId: input.notebookId } : {}) : undefined
    if (validation && !validation.ok) return validation

    const policyFailed = input.notebookId && policy && policy.ok && policy.value.passed === false && Array.isArray(policy.value.violations) ? policy.value.violations.length : 0
    const blockers: string[] = [...risk.value.blockerRisk]
    if (policyFailed) blockers.push(`Policy validation blocked: ${policyFailed} rule violation(s).`)

    return ok({
        status: blockers.length === 0 && approved.length > 0 ? "go" : "hold",
        overallRisk: risk.value.overallRisk,
        riskThreshold: maxRisk,
        approvedPlan: approved,
        rejectedPlan: rejected,
        blockers,
        validation: validation ? validation.value : undefined,
        policy: input.notebookId ? (policy?.ok ? policy.value : undefined) : undefined,
    })
}

export const agenticExecuteWithSla = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        notebookId?: string
        continueOnFailure?: boolean
        dryRun?: boolean
        maxSteps?: number
        rollbackOnFailure?: boolean
        slaMs?: number
        maxBlockers?: number
        maxWarnings?: number
        rollbackOnSlaFailure?: boolean
        checkpointLabel?: string
    },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const startMs = Date.now()
    const execution = executePlanOptimistic(workspace, userId, {
        ...input,
        continueOnFailure: input.continueOnFailure ?? false,
        dryRun: input.dryRun ?? false,
        rollbackOnFailure: input.rollbackOnFailure ?? false,
        checkpointLabel: input.checkpointLabel ?? `sla-${startMs}`,
    })
    if (!execution.ok) return execution

    const elapsedMs = Date.now() - startMs
    const blockers = execution.value.blockers ?? []
    const slaMs = typeof input.slaMs === "number" && input.slaMs > 0 ? input.slaMs : Number.POSITIVE_INFINITY
    const warningCount = execution.value.validation?.warnings.length ?? 0
    const statusParts = []

    if (elapsedMs > slaMs) statusParts.push(`Execution exceeded SLA ${slaMs}ms.`)
    if (input.maxBlockers !== undefined && blockers.length > input.maxBlockers) statusParts.push(`Blockers exceeded ${input.maxBlockers}.`)
    if (input.maxWarnings !== undefined && warningCount > input.maxWarnings) statusParts.push(`Warnings exceeded ${input.maxWarnings}.`)

    const slaMet = statusParts.length === 0

    let restoredFromSla = false
    let restoredFromCheckpoint = false
    if (!slaMet && (input.rollbackOnSlaFailure ?? false) && !input.dryRun && !input.rollbackOnFailure) {
        const restored = restoreRevertPoint(execution.value.workspace as VisualNoteWorkspace, userId, {})
        if (restored.ok) {
            restoredFromSla = true
            restoredFromCheckpoint = true
            return ok({
                ...execution.value,
                workspace: restored.value.restoredWorkspace,
                slaMs,
                elapsedMs,
                slaMet: false,
                slaViolations: statusParts,
                restoredFromSla,
                restoredFromCheckpoint,
            })
        }
    }

    return ok({
        ...execution.value,
        slaMs,
        elapsedMs,
        slaMet,
        slaViolations: statusParts,
        restoredFromSla,
        restoredFromCheckpoint,
    })
}

export const agenticAutoRepair = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includeDrift?: boolean; dryRun?: boolean }) => {
    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    if (scope.notebooks.length === 0) return notFound("No matching notebook found.")

    const gaps = analyzeWorkspaceGaps(workspace, userId, {
        notebookId: input.notebookId,
        includeHealthSummary: true,
    })
    const baseRepairOps = [{ tool: "repair_workspace_consistency", input: {} }]
    const plan = input.notebookId ? [...baseRepairOps, { tool: "reconcile_external_reference", input: { notebookId: input.notebookId, includeDisplayUrls: true } }] : baseRepairOps

    if (input.dryRun)
        return ok({
            dryRun: true,
            plan,
            gaps: gaps.ok ? gaps.value : { totalGaps: 0, suggestions: [] },
        })

    const repaired = repairWorkspaceConsistency(workspace, userId)
    if (!repaired.ok) return repaired
    if (!repaired.value.repairedWorkspace) return invalidInput("Unable to repair workspace consistency.")

    const nextWorkspace = repaired.value.repairedWorkspace
    const validation = input.notebookId ? validateAfterMutation(nextWorkspace, userId, { notebookId: input.notebookId }) : validateAfterMutation(nextWorkspace, userId, {})
    if (!validation.ok) return validation

    return ok({
        dryRun: false,
        plan,
        repaired: repaired.value,
        validation: validation.value,
        workspace: nextWorkspace,
        note: `Applied ${repaired.value.repaired ? repaired.value.repairedCount : 0} repair operation(s).`,
    })
}
