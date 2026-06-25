import { applyChangePlanOperation } from "./workspace-operations-part-033"
import { agenticPlanGuardrail } from "./workspace-operations-part-021"
import { agenticObserveWorkspace } from "./workspace-operations-part-020"
import { publishPreflightMultiNotebook } from "./workspace-operations-part-019"
import { findOwnedNotebook } from "./workspace-operations-part-004"
import { cloneWorkspace, notFound, ok } from "./workspace-operations-part-002"
import { VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-024"

export const agenticPreflightGate = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId?: string
        plan?: Array<{ tool: string; input: Record<string, unknown> }>
        maxRisk?: "low" | "medium" | "high"
        includePolicy?: boolean
        includePublishReadiness?: boolean
    },
) => {
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const observation = agenticObserveWorkspace(workspace, userId, {
        notebookId: input.notebookId,
        includePolicy: input.includePolicy,
    })
    if (!observation.ok) return observation

    const guardrail = input.plan?.length
        ? agenticPlanGuardrail(workspace, userId, {
              notebookId: input.notebookId,
              plan: input.plan,
              maxRisk: input.maxRisk,
          })
        : undefined
    if (guardrail && !guardrail.ok) return guardrail

    const publishReadiness = input.includePublishReadiness
        ? publishPreflightMultiNotebook(workspace, userId, {
              notebookIds: input.notebookId ? [input.notebookId] : undefined,
              includeRecoveryPlan: false,
          })
        : undefined
    if (publishReadiness && !publishReadiness.ok) return publishReadiness

    const blockers = [...(observation.value.health?.blockers ? [`Health blockers: ${observation.value.health.blockers}`] : []), ...(!guardrail ? [] : [])]

    const guardrailBlockers = guardrail?.ok ? (guardrail.value.blockers ?? []) : []
    return ok({
        status: blockers.length === 0 ? "go" : "hold",
        notebookId: input.notebookId,
        blockers: [...new Set([...blockers, ...guardrailBlockers])],
        observation: {
            health: observation.value.health,
            duplicates: observation.value.duplicates,
            drift: observation.value.drift,
            policy: observation.value.policy,
        },
        guardrail: guardrail?.ok ? guardrail.value : undefined,
        publishReadiness: publishReadiness?.ok ? publishReadiness.value : undefined,
    })
}

export const agenticPlanOptimizer = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        maxSteps?: number
    },
) => {
    const maxSteps = Math.max(1, input.maxSteps ?? input.plan.length)
    const readTools = new Set([
        "read_workspace",
        "read_notebook",
        "resolve_notebook",
        "resolve_page",
        "resolve_topic",
        "resolve_view",
        "list_pages",
        "read_page",
        "read_article",
        "read_view_as_markdown",
        "read_view_as_blocks",
        "search_workspace",
        "search_semantic",
        "analyze_workspace_gaps",
        "workspace_health_check",
        "analyze_orphaned_data",
        "list_display_kinds",
        "find_duplicate_or_stale_content",
    ])

    const signature = (op: { tool: string; input: Record<string, unknown> }) => {
        const normalizedInput = Object.keys(op.input)
            .sort()
            .map(key => `${key}:${String(op.input[key])}`)
            .join(",")
        return `${op.tool}|${normalizedInput}`
    }

    const deduped: Array<{ tool: string; input: Record<string, unknown> }> = []
    const removed: Array<{ tool: string; reason: string }> = []
    const seen = new Set<string>()

    input.plan.slice(0, maxSteps).forEach(item => {
        if (readTools.has(item.tool)) {
            removed.push({ tool: item.tool, reason: "Read tool removed from mutation-focused execution." })
            return
        }

        const key = signature(item)
        if (seen.has(key)) {
            removed.push({ tool: item.tool, reason: "Duplicate operation removed." })
            return
        }

        const applied = applyChangePlanOperation(cloneWorkspace(workspace), userId, item)
        if (!applied.ok) {
            removed.push({ tool: item.tool, reason: `Unsupported op: ${applied.message}` })
            return
        }

        deduped.push(item)
        seen.add(key)
    })

    return ok({
        originalCount: input.plan.length,
        optimizedCount: deduped.length,
        plan: deduped,
        removed,
        warnings: deduped.length < input.plan.length ? ["Plan was reordered and filtered to safe, executable operations."] : [],
    })
}
