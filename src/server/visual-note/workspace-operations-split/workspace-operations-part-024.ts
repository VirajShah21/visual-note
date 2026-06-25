import { executePlanWithGuarantees } from "./workspace-operations-part-035"
import { computeChangeImpact } from "./workspace-operations-part-034"
import { agenticIntentToPlan } from "./workspace-operations-part-020"
import { buildWorkflowJob, storeWorkflowJob, workflowJobs } from "./workspace-operations-part-017"
import { appendAgenticObservation, findOwnedNotebook } from "./workspace-operations-part-004"
import { invalidInput, notFound, ok, safeTrim } from "./workspace-operations-part-002"
import { AgenticWorkflowJob, VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-023"

export const agenticWorkflowJob = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        goal?: string
        notebookId?: string
        plan?: Array<{ tool: string; input: Record<string, unknown> }>
        execute?: boolean
        dryRun?: boolean
        continueOnFailure?: boolean
        maxSteps?: number
        runPrechecks?: boolean
        rollbackOnFailure?: boolean
    },
) => {
    if (!safeTrim(input.goal) && (!Array.isArray(input.plan) || input.plan.length === 0)) return invalidInput("A goal or plan is required.")

    const execute = input.execute ?? false
    const dryRun = input.dryRun ?? false
    const resolvedNotebook = input.notebookId ? findOwnedNotebook(workspace, userId, input.notebookId) : workspace.notebooks.find(item => item.userId === userId)
    if (input.notebookId && !resolvedNotebook) return notFound("Notebook not found.")

    let plan = input.plan
    if ((!plan || plan.length === 0) && input.goal && resolvedNotebook) {
        const intent = agenticIntentToPlan(workspace, userId, {
            goal: input.goal,
            notebookId: resolvedNotebook.id,
            includePrechecks: input.runPrechecks ?? false,
        })
        if (!intent.ok) return intent
        plan = intent.value.plan
    }

    const selectedPlan = (plan ?? []).slice(0, Math.max(1, Math.min(input.maxSteps ?? plan?.length ?? 1, 300)))
    const initialJob = buildWorkflowJob(
        {
            goal: safeTrim(input.goal),
            notebookId: resolvedNotebook?.id,
            execute,
            dryRun,
            plan: selectedPlan,
        },
        {
            status: execute && !dryRun ? "running" : "queued",
            note: execute ? "Execution requested." : safeTrim(input.goal) ? "Plan prepared for execution request." : "Plan prepared for replay.",
        },
    )
    storeWorkflowJob(initialJob)

    if (!execute) {
        const impact = selectedPlan.length > 0 ? computeChangeImpact(workspace, userId, { operations: selectedPlan }) : undefined
        const finalJob: AgenticWorkflowJob = {
            ...initialJob,
            status: "completed",
            updatedAt: new Date().toISOString(),
            note: "Plan prepared without execution. Review before running.",
            result: {
                blockers: impact && impact.ok ? [...new Set(impact.value.operationReports.flatMap(item => item.warnings))] : [],
                warnings: [],
                validation: {
                    blockers: impact && impact.ok ? [impact.value.operationReports.filter(item => item.issueCount > 0).length.toString()] : [],
                    warnings: [],
                    blockersCount: impact && impact.ok ? impact.value.workspacePreview.blockers : 0,
                    warningCount: impact && impact.ok ? impact.value.operationReports.length : 0,
                },
            },
        }
        storeWorkflowJob(finalJob)

        return ok({
            ...finalJob,
            jobId: initialJob.jobId,
            plan: selectedPlan,
            runSummary: {
                status: "ready",
                impactWarnings: finalJob.result?.blockers.length ?? 0,
            },
        })
    }

    const executed = executePlanWithGuarantees(workspace, userId, {
        plan: selectedPlan,
        notebookId: resolvedNotebook?.id,
        continueOnFailure: input.continueOnFailure ?? false,
        dryRun,
        rollbackOnFailure: input.rollbackOnFailure ?? true,
        maxSteps: selectedPlan.length,
    })
    if (!executed.ok) {
        const failedJob = {
            ...initialJob,
            status: "failed",
            updatedAt: new Date().toISOString(),
            note: executed.message,
            blockers: [executed.message],
        } as AgenticWorkflowJob
        storeWorkflowJob(failedJob)
        return ok({
            job: failedJob,
            plan: selectedPlan,
            runSummary: {
                status: "failed",
                impactWarnings: failedJob.blockers.length,
            },
        })
    }

    const finalJob = {
        ...initialJob,
        status: executed.value.blockers.length > 0 ? "failed" : "completed",
        updatedAt: new Date().toISOString(),
        note: executed.value.validation?.blockers.length ? "Execution completed with blockers." : "Execution completed successfully.",
        blockers: executed.value.blockers,
        warnings: executed.value.validation?.warnings ?? [],
        result: {
            blockers: executed.value.blockers,
            warnings: executed.value.validation?.warnings ?? [],
            validation: {
                blockers: executed.value.validation?.blockers ?? [],
                warnings: executed.value.validation?.warnings ?? [],
                blockersCount: executed.value.validation?.blockers.length ?? 0,
                warningCount: executed.value.validation?.warnings.length ?? 0,
            },
        },
    } as AgenticWorkflowJob
    storeWorkflowJob(finalJob)

    const observation = appendAgenticObservation(executed.value.workspace, {
        goal: safeTrim(input.goal) || "agentic_workflow_job",
        status: executed.value.blockers.length > 0 ? "warning" : "ok",
        summary: `Workflow job ${initialJob.jobId} executed ${selectedPlan.length} step(s).`,
        plan: selectedPlan,
        blockers: executed.value.blockers,
    })

    return ok({
        job: finalJob,
        plan: selectedPlan,
        workspace: observation,
        execution: {
            applied: executed.value.applied,
            skipped: executed.value.skipped,
            dryRun: executed.value.dryRun,
            validation: executed.value.validation,
            workspaceChanged: observation !== workspace,
        },
    })
}

export const agenticWorkflowStatus = (workspace: VisualNoteWorkspace, userId: string, input: { jobId?: string }) => {
    if (input.jobId) {
        const job = workflowJobs.get(input.jobId)
        if (!job) return notFound("Workflow job not found.")
        return ok({ ...job })
    }

    const jobs = [...workflowJobs.values()].map(item => ({ ...item })).sort((left, right) => (left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0))

    return ok({
        total: jobs.length,
        jobs,
    })
}

export const agenticWorkflowCancel = (workspace: VisualNoteWorkspace, userId: string, input: { jobId: string }) => {
    if (!safeTrim(input.jobId)) return invalidInput("jobId is required.")
    const job = workflowJobs.get(input.jobId)
    if (!job) return notFound("Workflow job not found.")

    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled")
        return ok({
            ...job,
            status: job.status,
            cancelled: false,
            note: "Job is already terminal; no action taken.",
        })

    const cancelled = {
        ...job,
        status: "cancelled" as const,
        updatedAt: new Date().toISOString(),
        note: "Cancelled by user request.",
    }
    storeWorkflowJob(cancelled)
    return ok({ ...cancelled, cancelled: true })
}
