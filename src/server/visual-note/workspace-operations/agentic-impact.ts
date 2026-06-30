import { applyChangePlan, computeChangeImpact, validateAfterMutation } from "./change-plans"
import { planRiskProfile } from "./agentic-risk"
import { countScopeState, findOwnedNotebook, scopedWorkspaceEntities } from "./selectors"
import { cloneWorkspace, invalidInput, notFound, ok } from "./result"
import { VisualNoteWorkspace } from "./types"

export const agenticImpactScoper = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        notebookId?: string
        maxSteps?: number
    },
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

    const risk = planRiskProfile(workspace, userId, {
        notebookId: input.notebookId,
        plan: input.plan,
    })
    if (!risk.ok) return risk

    const touched = {
        notebooks: [...new Set(impact.value.operationReports.flatMap(item => item.touched.notebooks))],
        pages: [...new Set(impact.value.operationReports.flatMap(item => item.touched.pages))],
        topics: [...new Set(impact.value.operationReports.flatMap(item => item.touched.topics))],
        views: [...new Set(impact.value.operationReports.flatMap(item => item.touched.views))],
    }

    return ok({
        scope: input.notebookId ? "notebook" : "workspace",
        notebookId: input.notebookId,
        touched,
        impact: {
            before: countScopeState(scopedWorkspaceEntities(workspace, userId, input.notebookId)),
            after: {
                notebooks: impact.value.workspacePreview.notebookCount,
                pages: impact.value.workspacePreview.pageCount,
                topics: impact.value.workspacePreview.topicCount,
                views: impact.value.workspacePreview.viewCount,
            },
            changed: impact.value.executed,
            blockers: impact.value.operationReports.flatMap(item => item.warnings),
        },
        risk: risk.value,
        estimatedWork: {
            operationCount: impact.value.operationReports.length,
            warningDensity: impact.value.operationReports.length ? impact.value.operationReports.filter(item => item.warnings.length > 0).length : 0,
        },
    })
}

export const agenticMultiNotebookBatch = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        batches: Array<{
            notebookId: string
            plan: Array<{ tool: string; input: Record<string, unknown> }>
            maxSteps?: number
        }>
        execute?: boolean
        continueOnFailure?: boolean
        dryRun?: boolean
        rollbackOnFailure?: boolean
    },
) => {
    if (!Array.isArray(input.batches) || input.batches.length === 0) return invalidInput("At least one batch is required.")

    const execute = input.execute ?? false
    const dryRun = input.dryRun ?? false
    const results: Array<{
        notebookId: string
        status: "ok" | "blocked" | "skipped"
        blockers: string[]
        applied: number
        workspaceChanged: boolean
    }> = []

    let nextWorkspace = cloneWorkspace(workspace)

    for (const batch of input.batches) {
        const notebook = findOwnedNotebook(nextWorkspace, userId, batch.notebookId)
        if (!notebook) {
            const failure = {
                notebookId: batch.notebookId,
                status: "skipped" as const,
                blockers: ["Notebook not found."],
                applied: 0,
                workspaceChanged: false,
            }
            results.push(failure)
            if (input.continueOnFailure) continue
            return invalidInput(`Notebook not found: ${batch.notebookId}`)
        }

        if (batch.plan.length === 0) {
            results.push({
                notebookId: notebook.id,
                status: "skipped",
                blockers: ["Batch plan empty."],
                applied: 0,
                workspaceChanged: false,
            })
            continue
        }

        if (!execute || dryRun) {
            const impact = computeChangeImpact(nextWorkspace, userId, {
                operations: batch.plan,
                maxSteps: batch.maxSteps,
            })
            if (!impact.ok) {
                results.push({
                    notebookId: notebook.id,
                    status: "blocked",
                    blockers: [impact.message],
                    applied: 0,
                    workspaceChanged: false,
                })
                if (!input.continueOnFailure) return invalidInput(impact.message)
                continue
            }

            results.push({
                notebookId: notebook.id,
                status: "ok",
                blockers: impact.value.operationReports.flatMap(item => item.warnings),
                applied: impact.value.operationReports.length,
                workspaceChanged: false,
            })
            continue
        }

        const beforeApply = cloneWorkspace(nextWorkspace)
        const applied = applyChangePlan(nextWorkspace, userId, {
            operations: batch.plan,
            continueOnFailure: input.continueOnFailure,
            dryRun,
            maxSteps: batch.maxSteps,
        })
        if (!applied.ok) {
            results.push({
                notebookId: notebook.id,
                status: "blocked",
                blockers: ["Unable to apply batch plan."],
                applied: 0,
                workspaceChanged: false,
            })
            if (!input.continueOnFailure) return applied
            continue
        }

        const failed = applied.value.blockers.length > 0 && !input.continueOnFailure
        if (failed && input.rollbackOnFailure) nextWorkspace = beforeApply
        else nextWorkspace = applied.value.workspace

        const validation = validateAfterMutation(nextWorkspace, userId, { notebookId: notebook.id })

        if (!validation.ok) {
            if (!input.continueOnFailure) return validation
            results.push({
                notebookId: notebook.id,
                status: "blocked",
                blockers: [validation.message],
                applied: applied.value.applied,
                workspaceChanged: nextWorkspace !== beforeApply,
            })
            continue
        }

        results.push({
            notebookId: notebook.id,
            status: failed ? "blocked" : "ok",
            blockers: applied.value.blockers,
            applied: applied.value.applied,
            workspaceChanged: nextWorkspace !== beforeApply,
        })
    }

    return ok({
        execute,
        dryRun,
        totalBatches: input.batches.length,
        results,
        workspace: execute ? nextWorkspace : workspace,
    })
}
