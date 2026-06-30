import { executePlanWithGuarantees } from "./planning"
import { agenticContractCheck } from "./agentic-snapshots"
import { publishReadinessGate } from "./publish-workflows"
import { linkTopicsBySemantics, proposeNavigationOrder } from "./navigation"
import { findOwnedNotebook, topicSimilarityScore } from "./selectors"
import { ChangePlanOperation, invalidInput, notFound, ok } from "./result"
import { TopicSemanticsGraph, TopicSemanticsNode, VisualNoteWorkspace } from "./types"

export const topicSemanticsGraph = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; threshold?: number; maxEdgesPerTopic?: number }) => {
    const threshold = Math.max(0.05, Math.min(input.threshold ?? 0.16, 1))
    const maxEdgesPerTopic = Math.max(1, Math.min(input.maxEdgesPerTopic ?? 8, 24))

    const notebooks = input.notebookId
        ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (notebooks.length === 0) return notFound("No matching notebook found.")

    const notebookIds = new Set(notebooks.map(notebook => notebook?.id).filter(Boolean) as string[])
    const pages = workspace.pages.filter(page => notebookIds.has(page.notebookId))
    const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
    const nodes: TopicSemanticsNode[] = topics.map(topic => {
        const page = pages.find(item => item.id === topic.pageId)
        const notebookId = page ? page.notebookId : ""
        return { topicId: topic.id, pageId: topic.pageId, notebookId, title: topic.title, summary: topic.summary }
    })

    const edges: TopicSemanticsGraph["edges"] = []
    for (let index = 0; index < topics.length; index += 1) {
        const current = topics[index]!
        const ranked = topics
            .map((candidate, candidateIndex) => {
                if (candidateIndex <= index) return undefined
                const score = topicSimilarityScore(current, candidate)
                if (score < threshold) return undefined
                return {
                    topicId: candidate.id,
                    score: Number(score.toFixed(3)),
                }
            })
            .filter((item): item is { topicId: string; score: number } => Boolean(item))
            .sort((left, right) => right.score - left.score)
            .slice(0, maxEdgesPerTopic)

        ranked.forEach(item => {
            edges.push({
                fromTopicId: current.id,
                toTopicId: item.topicId,
                weight: item.score,
                reason: `Shared semantic overlap score ${item.score}.`,
            })
        })
    }

    return ok({
        nodes,
        edges,
        threshold,
        maxEdgesPerTopic,
        sourceCount: nodes.length,
    } as TopicSemanticsGraph & { threshold: number; maxEdgesPerTopic: number; sourceCount: number })
}

export const agenticSemanticGraphSync = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId?: string
        threshold?: number
        maxEdgesPerTopic?: number
        topicCount?: number
        targetTopicId?: string
        apply?: boolean
        dryRun?: boolean
    },
) => {
    const graph = topicSemanticsGraph(workspace, userId, {
        notebookId: input.notebookId,
        threshold: input.threshold,
        maxEdgesPerTopic: input.maxEdgesPerTopic,
    })
    if (!graph.ok) return graph

    const synced = linkTopicsBySemantics(workspace, userId, {
        notebookId: input.notebookId,
        targetTopicId: input.targetTopicId,
        threshold: input.threshold,
        topicCount: input.topicCount,
        execute: input.apply,
        dryRun: input.dryRun,
    })
    if (!synced.ok) return synced

    return ok({
        ...graph.value,
        synced: {
            requested: synced.value.proposals,
            applied: synced.value.executed && !input.dryRun,
            changed: synced.value.changed,
            count: synced.value.proposals.length,
        },
        workspace: synced.value.workspace,
    })
}

export const navigationRestructurePlan = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; execute?: boolean; dryRun?: boolean }) => {
    const planned = proposeNavigationOrder(workspace, userId, { notebookId: input.notebookId, execute: false, dryRun: input.dryRun })
    if (!planned.ok) return planned

    const operations: ChangePlanOperation[] = []
    const pageIds = planned.value.planned?.pageIds ?? []
    operations.push({ tool: "reorder_pages", input: { notebookId: input.notebookId, pageIds } })

    planned.value.planned.topicOrders.forEach(item => {
        operations.push({ tool: "reorder_topics", input: { pageId: item.pageId, topicIds: item.topicIds } })
    })
    planned.value.planned.viewOrders.forEach(item => {
        operations.push({ tool: "reorder_views", input: { topicId: item.topicId, viewIds: item.viewIds } })
    })

    if (!input.execute) return ok({ ...planned.value, plan: operations, applied: false })

    const executed = executePlanWithGuarantees(workspace, userId, {
        plan: operations,
        notebookId: input.notebookId,
        continueOnFailure: false,
        rollbackOnFailure: true,
        dryRun: input.dryRun ?? false,
    })
    if (!executed.ok) return executed

    return ok({ ...planned.value, ...executed.value, plan: operations, applied: true })
}

export const agenticNavigationRestructurePlan = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; execute?: boolean; dryRun?: boolean }) =>
    navigationRestructurePlan(workspace, userId, input)

export const publishPreflightMultiNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { notebookIds?: string[]; includeRecoveryPlan?: boolean }) => {
    const targetNotebooks = input.notebookIds?.length
        ? workspace.notebooks.filter(notebook => notebook.userId === userId && input.notebookIds?.includes(notebook.id))
        : workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (targetNotebooks.length === 0) return notFound("No matching notebooks found.")

    const results = targetNotebooks
        .map(notebook => {
            const gate = publishReadinessGate(workspace, userId, {
                notebookId: notebook.id,
                includeRecoveryPlan: input.includeRecoveryPlan,
            })
            return { notebookId: notebook.id, notebookTitle: notebook.title, gate: gate.ok ? gate.value : gate }
        })
        .sort((left, right) => {
            const leftPassed = "passed" in left.gate && left.gate.passed
            const rightPassed = "passed" in right.gate && right.gate.passed
            if (leftPassed === rightPassed) return 0
            return leftPassed ? -1 : 1
        })

    return ok({
        includeRecoveryPlan: input.includeRecoveryPlan ?? false,
        notebooks: results.length,
        results,
        canPublishAll: results.every(item => typeof item.gate === "object" && item.gate && "passed" in item.gate && item.gate.passed === true),
        blockers: results.flatMap(item => {
            if (typeof item.gate !== "object") return []
            return "blockers" in item.gate ? item.gate.blockers : [item.gate.message]
        }),
    })
}

export const agenticPublishReadinessMulti = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookIds?: string[]; includeRecoveryPlan?: boolean; includePolicy?: boolean },
) => {
    if (input.notebookIds?.length === 0) return invalidInput("notebookIds cannot be empty.")

    const gate = publishPreflightMultiNotebook(workspace, userId, {
        notebookIds: input.notebookIds,
        includeRecoveryPlan: input.includeRecoveryPlan,
    })
    if (!gate.ok) return gate

    const contract = gate.value.results.map(result => {
        const contractResult = agenticContractCheck(workspace, userId, {
            notebookId: result.notebookId,
            includePolicy: input.includePolicy,
        })
        return contractResult.ok
            ? {
                  notebookId: result.notebookId,
                  notebookTitle: result.notebookTitle,
                  readiness: result.gate,
                  contract: contractResult.value,
              }
            : {
                  notebookId: result.notebookId,
                  notebookTitle: result.notebookTitle,
                  readiness: result.gate,
                  contract: null,
                  error: contractResult.message,
              }
    })

    return ok({ ...gate.value, includePolicy: input.includePolicy ?? false, contract })
}
