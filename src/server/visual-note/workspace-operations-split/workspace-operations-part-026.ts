import { findOwnedNotebook, scopedWorkspaceEntities } from "./workspace-operations-part-004"
import { tokenize } from "./workspace-operations-part-003"
import { invalidInput, notFound, ok, safeTrim } from "./workspace-operations-part-002"
import { VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-025"

export const agenticPlanReconciler = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        notebookId?: string
    },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    const notebookIds = new Set(scope.notebooks.map(item => item.id))
    const pageIds = new Set(scope.pages.map(item => item.id))
    const topicIds = new Set(scope.topics.map(item => item.id))
    const viewIds = new Set(scope.views.map(item => item.id))
    const displayIds = new Set(scope.views.flatMap(view => view.displays.map(display => display.id)))

    const findByTitle = (haystack: Array<{ id: string; title: string }>, title: string) => {
        const normalized = safeTrim(title).toLowerCase()
        if (!normalized) return undefined
        return haystack.find(item => item.title.toLowerCase() === normalized) ?? haystack.find(item => item.title.toLowerCase().includes(normalized))
    }

    const reconcile = (op: { tool: string; input: Record<string, unknown> }) => {
        const next = { ...op.input }
        const unresolved: Array<{ tool: string; reason: string }> = []

        const setId = (field: string, options: { set: Set<string>; entityType: "notebook" | "page" | "topic" | "view"; fallback?: string }) => {
            const raw = typeof next[field] === "string" ? String(next[field]) : ""
            if (!raw) {
                const label = options.fallback ? String(next[options.fallback] ?? "") : ""
                const found = label ? findByTitle(entityCandidates(options.entityType), label) : undefined
                if (!found) {
                    unresolved.push({
                        tool: op.tool,
                        reason: `${field} is missing and no fallback title provided.`,
                    })
                    return
                }
                next[field] = found.id
                return
            }

            if (!options.set.has(raw)) {
                unresolved.push({ tool: op.tool, reason: `${field} ${raw} no longer exists.` })
                const fallback = options.fallback ? findByTitle(entityCandidates(options.entityType), String(next[options.fallback] ?? "")) : undefined
                if (fallback) next[field] = fallback.id
            }
        }

        const entityCandidates = (type: "notebook" | "page" | "topic" | "view") => {
            if (type === "notebook") return [...workspace.notebooks.filter(item => item.userId === userId).map(item => ({ id: item.id, title: item.title }))]

            if (type === "page") return [...scope.pages.map(item => ({ id: item.id, title: item.title }))]

            if (type === "topic") return [...scope.topics.map(item => ({ id: item.id, title: item.title }))]

            return [...scope.views.map(item => ({ id: item.id, title: item.title }))]
        }

        setId("notebookId", { set: notebookIds, entityType: "notebook", fallback: "notebookTitle" })
        setId("pageId", { set: pageIds, entityType: "page", fallback: "pageTitle" })
        setId("topicId", { set: topicIds, entityType: "topic", fallback: "topicTitle" })
        setId("viewId", { set: viewIds, entityType: "view", fallback: "viewTitle" })

        const arrays = ["pageIds", "topicIds", "viewIds", "displayIds", "ids"] as const
        arrays.forEach(field => {
            const values = next[field]
            if (!Array.isArray(values)) return
            const targetSet =
                field === "pageIds" ? pageIds : field === "topicIds" ? topicIds : field === "viewIds" ? viewIds : field === "displayIds" ? displayIds : new Set<string>()
            const nextIds = values.filter(item => typeof item === "string" && targetSet.has(item))
            if (nextIds.length !== values.length)
                unresolved.push({
                    tool: op.tool,
                    reason: `${field} had stale entries and was filtered.`,
                })

            next[field] = nextIds
        })

        return { operation: { ...op, input: next }, unresolved }
    }

    const reconciled: Array<{ tool: string; input: Record<string, unknown> }> = []
    const unresolved: Array<{ tool: string; reason: string }> = []

    input.plan.forEach(op => {
        const result = reconcile(op)
        if (!result) return
        reconciled.push(result.operation)
        unresolved.push(...result.unresolved)
    })

    return ok({
        originalCount: input.plan.length,
        reconciledCount: reconciled.length,
        plan: reconciled,
        unresolved,
        changed: unresolved.length === 0 ? false : true,
    })
}

export const agenticGoalExpander = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        goal: string
        notebookId?: string
        maxSubgoals?: number
    },
) => {
    const goal = safeTrim(input.goal)
    if (!goal) return invalidInput("goal is required.")

    const notebook = input.notebookId ? findOwnedNotebook(workspace, userId, input.notebookId) : workspace.notebooks.find(item => item.userId === userId)
    if (input.notebookId && !notebook) return notFound("Notebook not found.")

    const tokens = new Set(tokenize(goal).map(item => item.toLowerCase()))
    const maxSubgoals = Math.max(1, Math.min(input.maxSubgoals ?? 6, 16))
    const expanded = [] as Array<{ id: string; goal: string; tools: string[]; rationale: string }>

    if (tokens.has("publish") || tokens.has("release"))
        expanded.push({
            id: "publish-readiness",
            goal: "Validate publish readiness and blockers for target notebook.",
            tools: ["agentic_publish_readiness_gate", "publish_diagnose", "publish_notebook"],
            rationale: "Publish requires contract and policy checks before change visibility.",
        })

    if (tokens.has("structure") || tokens.has("restructure"))
        expanded.push({
            id: "structure",
            goal: "Improve page-topic-view layout and reduce empty content.",
            tools: ["agentic_suggest_restructure", "agentic_component_pipeline", "agentic_plan_optimizer"],
            rationale: "Structure changes are lower risk if done in order by page and topic.",
        })

    if (tokens.has("reference") || tokens.has("link"))
        expanded.push({
            id: "references",
            goal: "Find and reconcile unresolved references and broken links.",
            tools: ["agentic_reference_rewrite", "reconcile_external_reference", "agentic_plan_reconciler"],
            rationale: "Reference rewrites keep content navigable without data loss.",
        })

    expanded.push({
        id: "health",
        goal: "Run health checks and produce a safe execution plan.",
        tools: ["agentic_observe_workspace", "analyze_workspace_gaps", "agentic_preflight_gate"],
        rationale: "Gate checks should precede all large automated edits.",
    })

    if (tokens.has("repair") || tokens.has("fix"))
        expanded.push({
            id: "repair",
            goal: "Repair drift, duplicates, and stale structure before final output.",
            tools: ["agentic_auto_repair", "agentic_change_set", "agentic_plan_dryrun"],
            rationale: "Repairs lower failure probability and improve publish quality.",
        })

    return ok({
        goal,
        notebookId: notebook?.id,
        notebookTitle: notebook?.title,
        maxSubgoals,
        expandedGoals: expanded.slice(0, maxSubgoals),
    })
}
