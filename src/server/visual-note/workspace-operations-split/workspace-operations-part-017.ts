import { restoreWorkspaceSnapshot } from "./workspace-operations-part-038"
import { analyzeOrphanedData } from "./workspace-operations-part-037"
import { snapshotCompare } from "./workspace-operations-part-036"
import { validateAfterMutation } from "./workspace-operations-part-034"
import { workspacePolicyEngine } from "./workspace-operations-part-031"
import { makeRevertPoint } from "./workspace-operations-part-016"
import { validatePublishContract } from "./workspace-operations-part-015"
import { findDuplicateContent } from "./workspace-operations-part-012"
import { findOwnedNotebook } from "./workspace-operations-part-004"
import { createId, notFound, ok } from "./workspace-operations-part-002"
import { AgenticWorkflowJob, AgenticWorkflowStatus, VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-016"

export const agenticWorkspaceSnapshotAfter = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId?: string
        name?: string
        note?: string
        goal?: string
        beforePointId?: string
    },
) => {
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const result = makeRevertPoint(workspace, userId, {
        name: input.name || `agentic-snapshot-after-${new Date().toISOString()}`,
        note: input.note,
        goal: input.goal,
    })
    if (!result.ok) return result

    if (!input.beforePointId) return ok({ ...result.value, comparedTo: null })

    const before = workspace.snapshots?.find(item => item.id === input.beforePointId) ?? null
    if (!before) return ok({ ...result.value, comparedTo: null, beforePointMissing: true })

    const targetNotebookId = input.notebookId
    if (!targetNotebookId) return ok({ ...result.value, comparedTo: null, beforePointId: before.id, note: "After-snapshot recorded; provide notebookId for comparison details." })

    const compare = snapshotCompare(workspace, userId, { notebookId: targetNotebookId })
    if (!compare.ok) return ok({ ...result.value, comparedTo: null, beforePointId: before.id, beforePointMissing: true })

    return ok({
        ...result.value,
        beforePointId: before.id,
        comparedTo: compare.value,
        changedSinceBefore: {
            pages: compare.value.delta.added.pages.length + compare.value.delta.removed.pages.length,
            topics: compare.value.delta.added.topics.length + compare.value.delta.removed.topics.length,
            views: compare.value.delta.added.views.length + compare.value.delta.removed.views.length,
        },
    })
}

export const agenticWorkspaceRestorePoint = (workspace: VisualNoteWorkspace, userId: string, input: { revertPointId?: string }) => restoreRevertPoint(workspace, userId, input)

export const agenticRevertToLatestCheckpoint = (workspace: VisualNoteWorkspace, userId: string) => restoreRevertPoint(workspace, userId, {})

export const listAgenticRevertPoints = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string }) => {
    const revertPoints = [...(workspace.snapshots ?? [])]
        .filter(item => item.name.startsWith("agentic-revert-"))
        .filter(item => !input.notebookId || item.workspace.notebooks.some(notebook => notebook.id === input.notebookId && notebook.userId === userId))
        .map(item => ({
            id: item.id,
            name: item.name,
            createdAt: item.createdAt,
            note: item.note,
        }))
        .sort((left, right) => (left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0))

    return ok({
        count: revertPoints.length,
        points: revertPoints,
    })
}

export const restoreRevertPoint = (workspace: VisualNoteWorkspace, userId: string, input: { revertPointId?: string }) => {
    const candidates = (workspace.snapshots ?? []).filter(item => item.name.startsWith("agentic-revert-"))
    const target = input.revertPointId ? candidates.find(item => item.id === input.revertPointId) : candidates[0]
    if (!target) return notFound("No agentic revert point found.")

    return restoreWorkspaceSnapshot(workspace, userId, { snapshotId: target.id })
}

export const workflowJobs: Map<string, AgenticWorkflowJob> = new Map()

export const maxWorkflowJobs = 64

export const storeWorkflowJob = (job: AgenticWorkflowJob) => {
    workflowJobs.set(job.jobId, job)
    const items = [...workflowJobs.values()].sort((left, right) => (left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0))
    if (items.length > maxWorkflowJobs) items.slice(maxWorkflowJobs).forEach(item => workflowJobs.delete(item.jobId))
}

export const buildWorkflowJob = (
    fields: {
        goal?: string
        notebookId?: string
        execute: boolean
        dryRun: boolean
        plan?: Array<{ tool: string; input: Record<string, unknown> }>
    },
    initial: {
        status: AgenticWorkflowStatus
        note: string
        blockers?: string[]
        warnings?: string[]
        result?: AgenticWorkflowJob["result"]
    },
) => {
    const jobId = `agentic-workflow-${createId()}`
    const now = new Date().toISOString()

    return {
        jobId,
        goal: fields.goal,
        notebookId: fields.notebookId,
        execute: fields.execute,
        dryRun: fields.dryRun,
        stepCount: fields.plan?.length ?? 0,
        plan: fields.plan,
        createdAt: now,
        updatedAt: now,
        status: initial.status,
        blockers: initial.blockers ?? [],
        warnings: initial.warnings ?? [],
        note: initial.note,
        result: initial.result,
    } as AgenticWorkflowJob
}

export const agenticContractCheck = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includePolicy?: boolean }) => {
    if (!input.notebookId) {
        const notebooks = workspace.notebooks.filter(notebook => notebook.userId === userId)
        if (notebooks.length === 0) return notFound("No matching notebook found.")
        const checks = notebooks.map(notebook => {
            const contract = validatePublishContract(workspace, userId, { notebookId: notebook.id })
            const policy = input.includePolicy ? workspacePolicyEngine(workspace, userId, { action: "validate", notebookId: notebook.id }) : undefined
            return {
                notebookId: notebook.id,
                notebookTitle: notebook.title,
                contract: contract.ok ? contract.value : contract,
                policy: policy && policy.ok ? policy.value : policy,
            }
        })

        return ok({
            scope: "workspace",
            checks,
            passed: checks.every(item => "passed" in item.contract && item.contract.passed),
        })
    }

    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")
    const contract = validatePublishContract(workspace, userId, { notebookId: notebook.id })
    const policy = input.includePolicy ? workspacePolicyEngine(workspace, userId, { action: "validate", notebookId: notebook.id }) : undefined

    return ok({
        scope: "notebook",
        notebookId: notebook.id,
        contract: contract.ok ? contract.value : contract,
        policy: policy ? (policy.ok ? policy.value : policy) : undefined,
    })
}

export const assertWorkspaceInvariants = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; viewId?: string; strict?: boolean }) => {
    const strict = input.strict === true
    const health = input.notebookId ? validateAfterMutation(workspace, userId, { notebookId: input.notebookId }) : validateAfterMutation(workspace, userId, {})
    if (!health.ok) return health

    const duplicate = findDuplicateContent(workspace, userId, { notebookId: input.notebookId })
    if (!duplicate.ok) return duplicate
    const orphaned = analyzeOrphanedData(workspace, userId)
    if (!orphaned.ok) return orphaned

    const invariantViolations: string[] = []
    const warnings: string[] = []
    const invariantPass =
        health.value.blockers.length === 0 && orphaned.value.orphanPages.length === 0 && orphaned.value.orphanTopics.length === 0 && orphaned.value.orphanViews.length === 0
    if (strict && duplicate.value.matches.length > 0) invariantViolations.push(`Found ${duplicate.value.matches.length} duplicate content groups.`)

    if (health.value.blockers.length > 0 || !invariantPass) invariantViolations.push("Workspace health checks reported issues.")
    if (duplicate.value.matches.length > 0) warnings.push("Duplicate titles/content detected.")

    return ok({
        scope: input.notebookId ? "notebook" : "workspace",
        notebookId: input.notebookId,
        viewId: input.viewId,
        passed: invariantPass && invariantViolations.length === 0,
        invariantChecks: health.value.workspaceChecks,
        blockers: input.notebookId
            ? health.value.blockers
            : [...health.value.blockers, ...orphaned.value.orphanPages, ...orphaned.value.orphanTopics, ...orphaned.value.orphanViews],
        warnings: [...warnings, ...health.value.warnings],
        duplicateGroups: duplicate.value.matches,
    })
}
