import { analyzeOrphanedData } from "./health"
import { executePlanWithGuarantees, planAgenticWorkflow } from "./planning"
import { generateTopicFromOutline, rewriteViewLayoutForMode } from "./layouts"
import { workspacePolicyEngine } from "./policies"
import { planRiskProfile } from "./agentic-risk"
import { analyzeWorkspaceGaps } from "./analysis"
import { createPage } from "./pages"
import { createNotebook } from "./notebooks"
import { findOwnedView } from "./read-model"
import { defaultWorkspacePolicyRules, findOwnedNotebook } from "./selectors"
import { parseOutlineSections } from "./utils"
import { cloneWorkspace, invalidInput, notFound, ok, PublishContractCheck, safeTrim, slugify } from "./result"
import { parseArticleContent, ViewMode, VisualNoteWorkspace } from "./types"

export const createNotebookFromOutline = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        title: string
        outline: string
        summary?: string
        color?: string
        slug?: string
        mode?: ViewMode
        dryRun?: boolean
    },
) => {
    const title = safeTrim(input.title)
    const sections = parseOutlineSections(input.outline)
    if (!title) return invalidInput("title is required.")
    if (sections.length === 0) return invalidInput("outline is required.")

    const nextWorkspace = cloneWorkspace(workspace)
    const created = createNotebook(nextWorkspace, userId, {
        title,
        summary: safeTrim(input.summary) || "Notebook from outline.",
        color: safeTrim(input.color),
        slug: safeTrim(input.slug) || slugify(title),
    })
    if (!created.ok) return created

    let cursor = created.value.workspace
    const page = createPage(cursor, userId, {
        notebookId: created.value.notebook.id,
        title: "Overview",
        position: 0,
    })
    if (!page.ok) return page

    cursor = page.value.workspace
    const fromOutline = generateTopicFromOutline(cursor, userId, {
        notebookId: created.value.notebook.id,
        pageId: page.value.page.id,
        outline: input.outline,
        topicMode: input.mode,
    })
    if (!fromOutline.ok) return fromOutline

    if (input.dryRun)
        return ok({
            dryRun: true,
            notebook: created.value.notebook,
            created: { sections: sections.length, topics: fromOutline.value.createdTopicIds.length, views: fromOutline.value.createdViewIds.length },
        })

    return ok({
        dryRun: false,
        notebook: created.value.notebook,
        created: {
            sections: sections.length,
            topics: fromOutline.value.createdTopicIds.length,
            views: fromOutline.value.createdViewIds.length,
        },
        workspace: fromOutline.value.workspace,
    })
}

export const migrateViewToModeWithValidation = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { viewId: string; mode: ViewMode; addRecommendedDisplays?: boolean; runValidation?: boolean; dryRun?: boolean },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const rewritten = rewriteViewLayoutForMode(workspace, userId, {
        viewId: input.viewId,
        mode: input.mode,
        addRecommendedDisplays: input.addRecommendedDisplays ?? false,
    })
    if (!rewritten.ok) return rewritten

    if (input.dryRun) return ok({ ...rewritten.value, dryRun: true, workspace, validation: undefined })

    if (!input.runValidation) return ok({ ...rewritten.value, dryRun: false, validation: undefined })
    const contract = validatePublishContract(workspace, userId, { notebookId: context.notebook.id })

    return ok({
        ...rewritten.value,
        validation: contract.ok ? contract.value : contract,
        dryRun: false,
    })
}

export const validatePublishContract = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
    const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
    const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))
    const checks: PublishContractCheck[] = []

    const addCheck = (name: string, ok: boolean, message: string) => checks.push({ name, passed: ok, message })

    addCheck("notebook-summary", safeTrim(notebook.summary).length > 0, "Notebook summary should be non-empty.")
    addCheck("has-pages", pages.length > 0, "Notebook has at least one page.")
    addCheck("has-topics", topics.length > 0, "Notebook has at least one topic.")
    addCheck("has-views", views.length > 0, "Notebook has at least one view.")
    const orphaned = analyzeOrphanedData(workspace, userId)
    const orphanCount = orphaned.ok ? orphaned.value.orphanPages.length + orphaned.value.orphanTopics.length + orphaned.value.orphanViews.length : 0
    addCheck("no-orphans", orphanCount === 0, `No orphan pages/topics/views. (found ${orphanCount})`)

    const warnings: string[] = []
    let blocking = 0
    views.forEach(view => {
        if (!view.content.trim()) warnings.push(`View ${view.title} has empty content.`)
        if (view.displays.length === 0 && !view.content.trim()) warnings.push(`View ${view.title} has no visual structure or content.`)
        const parsed = parseArticleContent(view.content, view.displays.length)
        if (parsed.blocks.some(block => block.kind === "display" && (block as { displayIndex?: number }).displayIndex === -1))
            addCheck(`display-boundary-${view.id}`, false, `View ${view.title} has invalid display reference`)
    })

    checks.forEach(check => {
        if (!check.passed) blocking += 1
    })

    return ok({
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        blockingChecks: checks,
        passed: checks.every(check => check.passed),
        blockerCount: blocking,
        warnings,
    })
}

export const publishReadinessGate = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; includeRecoveryPlan?: boolean }) => {
    const contract = validatePublishContract(workspace, userId, input)
    if (!contract.ok) return contract

    const health = analyzeWorkspaceGaps(workspace, userId, { notebookId: input.notebookId, includeHealthSummary: true })
    const policy = workspacePolicyEngine(workspace, userId, {
        action: "validate",
        notebookId: input.notebookId,
        policyRules: defaultWorkspacePolicyRules,
    })

    const gates = {
        contract: contract.value.passed ? "passed" : "failed",
        publishContract: contract.value,
        structure: health.ok ? "checked" : "failed",
        policy: policy.ok ? "validated" : "failed",
        recoveryPlan: input.includeRecoveryPlan ? ["Repair gaps", "Re-run publish_readiness_gate"] : undefined,
    }

    return ok({
        notebookId: input.notebookId,
        gate: contract.value.passed && health.ok ? "green" : "red",
        passed: contract.value.passed && health.ok,
        gates,
        blockers: [...(!health.ok ? [health.message] : []), ...(!policy.ok ? [policy.message] : [])].filter(Boolean),
    })
}

export const runAgenticWorkflow = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { goal: string; notebookId: string; execute?: boolean; prechecks?: boolean; dryRun?: boolean },
) => {
    const plan = planAgenticWorkflow(workspace, userId, {
        goal: input.goal,
        notebookId: input.notebookId,
        includePrechecks: input.prechecks ?? false,
    })
    if (!plan.ok) return plan

    if (!input.execute) return ok({ ...plan.value, dryRun: true })
    if (input.dryRun) return ok({ ...plan.value, dryRun: true })

    const executed = executePlanWithGuarantees(workspace, userId, {
        plan: plan.value.plan.map(item => ({ tool: item.tool, input: item.input })),
        notebookId: input.notebookId,
        continueOnFailure: false,
        rollbackOnFailure: true,
        dryRun: false,
    })
    if (!executed.ok) return executed

    return ok({ ...plan.value, ...executed.value, dryRun: false })
}

export const goalToAgentPlan = (workspace: VisualNoteWorkspace, userId: string, input: { goal: string; notebookId?: string; includePrechecks?: boolean }) => {
    const goal = safeTrim(input.goal)
    if (!goal) return invalidInput("goal is required.")
    if (!input.notebookId) return notFound("notebookId is required.")

    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const plan = planAgenticWorkflow(workspace, userId, {
        goal,
        notebookId: notebook.id,
        includePrechecks: input.includePrechecks ?? true,
    })
    if (!plan.ok) return plan

    const risk = planRiskProfile(workspace, userId, { plan: plan.value.plan })
    if (!risk.ok) return risk

    return ok({
        ...plan.value,
        goal,
        riskProfile: risk.value,
    })
}
