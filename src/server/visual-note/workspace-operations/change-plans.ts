import { analyzeOrphanedData, workspaceHealthCheck } from "./health"
import { applyChangePlanOperation } from "./change-plan-operation"
import { analyzeNotebookHealth, searchWorkspace } from "./search"
import { lintArticle, listDisplayKinds } from "./displays"
import { readArticle, readViewAsBlocks, readViewAsMarkdown } from "./articles"
import { listPages } from "./notebooks"
import { listNotebooks, readNotebookTree, readWorkspace } from "./read-model"
import { findOwnedNotebook, touchedFromInput } from "./selectors"
import { ChangePlanOperation, cloneWorkspace, invalidInput, notFound, ok, ToolImpactReport } from "./result"
import { parseArticleContent, VisualNoteWorkspace } from "./types"

export const collectIssueSummary = (workspace: VisualNoteWorkspace, userId: string) => {
    const health = workspaceHealthCheck(workspace, userId)
    return health.ok
        ? {
              issues: health.value.issues.length,
              totalIssues: health.value.issues.length,
              blockers: health.value.issues.filter(item => item.severity === "error").length,
          }
        : { issues: 0, totalIssues: 0, blockers: 0 }
}

export const computeChangeImpact = (workspace: VisualNoteWorkspace, userId: string, input: { operations: ChangePlanOperation[]; maxSteps?: number }) => {
    if (!Array.isArray(input.operations) || input.operations.length === 0) return invalidInput("operations must be a non-empty array.")
    const operations = input.operations.slice(0, input.maxSteps ?? input.operations.length)

    let nextWorkspace = cloneWorkspace(workspace)
    const operationReports: ToolImpactReport[] = []

    for (const operation of operations) {
        const applied = applyChangePlanOperation(nextWorkspace, userId, operation)
        if (!applied.ok) return invalidInput(`Unsupported operation during impact analysis: ${operation.tool}. ${applied.message}`)

        nextWorkspace = applied.value.workspace
        const stats = collectIssueSummary(nextWorkspace, userId)

        operationReports.push({
            tool: operation.tool,
            touched: touchedFromInput(operation),
            issueCount: stats.totalIssues,
            warnings: stats.blockers > 0 ? ["Simulated workspace has blockers. Consider validating after mutation before publish."] : [],
        })
    }

    const finalStats = collectIssueSummary(nextWorkspace, userId)
    return ok({
        operationReports,
        executed: true,
        workspacePreview: {
            notebookCount: nextWorkspace.notebooks.filter(notebook => notebook.userId === userId).length,
            pageCount: nextWorkspace.pages.length,
            topicCount: nextWorkspace.topics.length,
            viewCount: nextWorkspace.views.length,
            issueCount: finalStats.totalIssues,
            blockers: finalStats.blockers,
        },
    })
}

export const applyChangePlan = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { operations: ChangePlanOperation[]; continueOnFailure?: boolean; dryRun?: boolean; maxSteps?: number },
) => {
    if (!Array.isArray(input.operations) || input.operations.length === 0) return invalidInput("operations must be a non-empty array.")

    const operations = input.operations.slice(0, input.maxSteps ?? input.operations.length)
    let nextWorkspace = cloneWorkspace(workspace)
    const operationReports: ToolImpactReport[] = []
    const blockers: string[] = []

    for (const operation of operations) {
        const applied = applyChangePlanOperation(nextWorkspace, userId, operation)
        if (!applied.ok) {
            blockers.push(`Unable to apply ${operation.tool}: ${applied.message}`)
            if (!input.continueOnFailure)
                return ok({
                    workspace,
                    operationReports,
                    blockers,
                    applied: operationReports.length,
                    skipped: operations.length - operationReports.length,
                    dryRun: input.dryRun ?? false,
                })

            continue
        }

        nextWorkspace = input.dryRun ? nextWorkspace : applied.value.workspace
        operationReports.push({
            tool: operation.tool,
            touched: touchedFromInput(operation),
            issueCount: 0,
            warnings: [],
        })
    }

    return ok({
        workspace: nextWorkspace,
        operationReports,
        blockers,
        applied: operationReports.length,
        skipped: 0,
        dryRun: input.dryRun ?? false,
    })
}

export const applyValidationForPlan = (workspace: VisualNoteWorkspace, userId: string, notebookId?: string) => {
    const validation = notebookId ? validateAfterMutation(workspace, userId, { notebookId }) : validateAfterMutation(workspace, userId, {})
    return validation.ok ? validation.value : { blockers: [validation.message], warnings: [], blockersCount: 1, warningCount: 0 }
}

export const batchMutateWorkspace = (workspace: VisualNoteWorkspace, userId: string, input: { operations: ChangePlanOperation[]; continueOnFailure?: boolean }) =>
    applyChangePlan(workspace, userId, input)

export const batchReadWorkspace = (workspace: VisualNoteWorkspace, userId: string, input: { operations: Array<{ tool: string; input?: Record<string, unknown> }> }) => {
    if (!Array.isArray(input.operations) || input.operations.length === 0) return invalidInput("operations must be a non-empty array.")

    const supported = input.operations.map(operation => {
        const tool = String(operation.tool)
        const options = (operation.input ?? {}) as Record<string, unknown>

        if (tool === "read_workspace") return readWorkspace(workspace, userId)
        if (tool === "list_notebooks") return ok(listNotebooks(workspace, userId))
        if (tool === "read_notebook") return readNotebookTree(workspace, userId, String(options.notebookId ?? ""))
        if (tool === "list_pages") return listPages(workspace, userId, options.notebookId as string | undefined)
        if (tool === "read_article") return readArticle(workspace, userId, String(options.viewId ?? ""))
        if (tool === "read_view_as_markdown") return readViewAsMarkdown(workspace, userId, String(options.viewId ?? ""))
        if (tool === "read_view_as_blocks") return readViewAsBlocks(workspace, userId, String(options.viewId ?? ""))
        if (tool === "search_workspace")
            return searchWorkspace(workspace, userId, {
                query: String(options.query ?? ""),
                kinds: (options.kinds as Array<"notebook" | "page" | "topic" | "view" | "display">) ?? ["notebook", "page", "topic", "view", "display"],
            })

        if (tool === "list_display_kinds") return listDisplayKinds()
        if (tool === "workspace_health_check") return workspaceHealthCheck(workspace, userId)
        if (tool === "analyze_orphaned_data") return analyzeOrphanedData(workspace, userId)

        return invalidInput(`Unsupported read tool: ${tool}`)
    })

    return ok({
        results: supported.map((result, index) => ({
            index,
            input: input.operations[index],
            ok: result.ok,
            ...(result.ok ? { value: result.value } : { error: result.error, message: result.message }),
        })),
        total: input.operations.length,
        failures: supported.filter(result => !result.ok).length,
    })
}

export const validateAfterMutation = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; viewId?: string }) => {
    const workspaceChecks: Array<{ name: string; ok: boolean; details: string }> = []
    const blockers: string[] = []
    const warnings: string[] = []

    if (input.notebookId) {
        const health = analyzeNotebookHealth(workspace, userId, { notebookId: input.notebookId })
        if (!health.ok) {
            blockers.push(health.message)
            workspaceChecks.push({ name: "notebook_health", ok: false, details: health.message })
        } else {
            workspaceChecks.push({ name: "notebook_health", ok: true, details: `Found ${health.value.issues.length} issues.` })
            if (health.value.issues.some(item => item.severity === "error")) blockers.push("Notebook has blocking integrity issues.")
        }
    }

    if (input.viewId) {
        const lint = lintArticle(workspace, userId, input.viewId)
        workspaceChecks.push({
            name: "view_round_trip",
            ok: lint.ok ? lint.value.valid : false,
            details: lint.ok ? `Lint found ${lint.value.warnings.length} warnings.` : lint.message,
        })
        if (!lint.ok || !lint.value.valid) blockers.push(`Unable to validate article ${input.viewId}.`)
        if (lint.ok) warnings.push(...lint.value.warnings)
    }

    const health = workspaceHealthCheck(workspace, userId)
    if (health.ok) {
        workspaceChecks.push({ name: "workspace_integrity", ok: health.value.issues.length === 0, details: `${health.value.issues.length} integrity warnings found.` })
        if (health.value.issues.length > 0) warnings.push(...health.value.issues.map(item => item.message))
    } else blockers.push(health.message)

    return ok({ workspaceChecks, blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] })
}

export const publishDiagnose = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
    const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
    const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))

    const blockers: string[] = []
    const warnings: string[] = []
    if (!notebook.summary.trim()) warnings.push("Notebook summary is empty.")
    if (pages.length === 0) blockers.push("Notebook has no pages.")
    if (topics.length === 0) blockers.push("Notebook has no topics.")
    if (views.length === 0) blockers.push("Notebook has no views.")

    views.forEach(view => {
        if (!view.content.trim()) warnings.push(`View ${view.title} is empty.`)
        if (view.displays.length > 0) {
            const parsed = parseArticleContent(view.content, view.displays.length)
            if (parsed.blocks.some(block => block.kind === "display" && (block.displayIndex < 0 || block.displayIndex >= view.displays.length)))
                blockers.push(`View ${view.title} has invalid display references.`)
        }
    })

    const unique = [...new Set([...blockers, ...warnings])]

    return ok({
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        ready: blockers.length === 0,
        blockers,
        warnings: unique.filter(item => !blockers.includes(item)),
        viewCount: views.length,
        topicCount: topics.length,
        pageCount: pages.length,
    })
}
