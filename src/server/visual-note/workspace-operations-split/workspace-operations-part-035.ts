import { applyChangePlan, publishDiagnose, validateAfterMutation } from "./workspace-operations-part-034"
import { analyzeWorkspaceGaps } from "./workspace-operations-part-012"
import { findOwnedNotebook } from "./workspace-operations-part-004"
import { parseOutlineSections } from "./workspace-operations-part-003"
import { ChangePlanOperation, invalidInput, notFound, ok, safeTrim } from "./workspace-operations-part-002"
import { VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-034"

export const diffNotebookState = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; snapshotId?: string }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const snapshot = input.snapshotId ? workspace.snapshots?.find(item => item.id === input.snapshotId) : workspace.snapshots?.[0]
    if (!snapshot) return notFound("No snapshot data available.")

    const snapshotNotebook = snapshot.workspace.notebooks.find(item => item.id === input.notebookId)
    if (!snapshotNotebook) return notFound("Notebook not found in snapshot.")

    const currentPageIds = new Set(workspace.pages.filter(page => page.notebookId === input.notebookId).map(item => item.id))
    const snapshotPageIds = new Set(snapshot.workspace.pages.filter(page => page.notebookId === input.notebookId).map(item => item.id))
    const currentTopicIds = new Set(workspace.topics.filter(topic => currentPageIds.has(topic.pageId)).map(item => item.id))
    const snapshotTopicIds = new Set(snapshot.workspace.topics.filter(topic => snapshotPageIds.has(topic.pageId)).map(item => item.id))
    const currentViewIds = new Set(workspace.views.filter(view => currentTopicIds.has(view.topicId)).map(item => item.id))
    const snapshotViewIds = new Set(snapshot.workspace.views.filter(view => snapshotTopicIds.has(view.topicId)).map(item => item.id))

    return ok({
        notebookId: notebook.id,
        snapshotId: snapshot.id,
        delta: {
            added: {
                pages: [...currentPageIds].filter(id => !snapshotPageIds.has(id)),
                topics: [...currentTopicIds].filter(id => !snapshotTopicIds.has(id)),
                views: [...currentViewIds].filter(id => !snapshotViewIds.has(id)),
            },
            removed: {
                pages: [...snapshotPageIds].filter(id => !currentPageIds.has(id)),
                topics: [...snapshotTopicIds].filter(id => !currentTopicIds.has(id)),
                views: [...snapshotViewIds].filter(id => !currentViewIds.has(id)),
            },
        },
        current: {
            pages: currentPageIds.size,
            topics: currentTopicIds.size,
            views: currentViewIds.size,
        },
        snapshot: {
            title: snapshotNotebook.title,
            pages: snapshotPageIds.size,
            topics: snapshotTopicIds.size,
            views: snapshotViewIds.size,
        },
    })
}

export const taskSuggestAndExecute = (workspace: VisualNoteWorkspace, userId: string, input: { goal: string; notebookId?: string; execute?: boolean }) => {
    const goal = safeTrim(input.goal).toLowerCase()
    if (!goal) return invalidInput("goal is required.")

    const actions: ChangePlanOperation[] = []
    if (!input.notebookId) return notFound("notebookId is required for task suggestions.")

    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    if (goal.includes("publish")) {
        const diagnose = publishDiagnose(workspace, userId, { notebookId: notebook.id })
        if (diagnose.ok && diagnose.value.ready) actions.push({ tool: "publish_notebook", input: { notebookId: notebook.id, publish: true } })
    }

    const topics = workspace.topics.filter(topic => workspace.pages.some(page => page.notebookId === notebook.id && workspace.pages.some(page => topic.pageId === page.id)))
    if (goal.includes("structure") || goal.includes("outline") || goal.includes("gap") || goal.includes("complete"))
        if (goal.includes("create") && topics.length === 0) {
            const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
            if (pages.length === 0)
                actions.push({
                    tool: "create_page",
                    input: { notebookId: notebook.id, title: "Overview" },
                })

            if (pages[0])
                actions.push({
                    tool: "create_topic",
                    input: { pageId: pages[0].id, title: "Getting Started" },
                })
        }

    if (actions.length === 0)
        return ok({
            goal,
            plan: [],
            note: "No safe automatic plan steps were generated for this goal.",
            blockers: ["Goal did not map to supported agent actions."],
            applied: 0,
            execute: false,
            workspace,
        })

    if (!input.execute)
        return ok({
            goal,
            plan: actions,
            execute: false,
            blockers: [],
            workspace,
        })

    const applied = applyChangePlan(workspace, userId, { operations: actions })
    if (!applied.ok) return invalidInput("Plan execution failed.")

    return ok({
        goal,
        plan: actions,
        execute: true,
        blockers: applied.value.blockers,
        applied: applied.value.applied,
        workspace: applied.value.workspace,
    })
}

export const generateOutlineFromText = (workspace: VisualNoteWorkspace, userId: string, input: { text: string; maxSections?: number; maxViewsPerSection?: number }) => {
    const text = safeTrim(input.text)
    if (!text) return invalidInput("text is required.")

    const notebooks = workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (notebooks.length === 0) return notFound("No notebook found for user.")

    const sections = parseOutlineSections(text)
    if (sections.length === 0) return invalidInput("Unable to parse outline. Use headings, bullets, or plain lines for sections.")

    const maxSections = Math.max(1, Math.min(input.maxSections ?? sections.length, sections.length, 12))
    const maxViewsPerSection = Math.max(1, input.maxViewsPerSection ?? 8)
    const normalized = sections.slice(0, maxSections).map(section => ({
        title: section.title,
        views: section.views.slice(0, maxViewsPerSection),
    }))

    return ok({
        mode: "outline",
        sectionCount: normalized.length,
        totalViewCount: normalized.reduce((total, section) => total + section.views.length, 0),
        outline: normalized,
    })
}

export const planAgenticWorkflow = (workspace: VisualNoteWorkspace, userId: string, input: { goal: string; notebookId: string; includePrechecks?: boolean }) => {
    const goal = safeTrim(input.goal).toLowerCase()
    if (!goal) return invalidInput("goal is required.")

    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const suggestion = taskSuggestAndExecute(workspace, userId, {
        goal,
        notebookId: notebook.id,
        execute: false,
    })
    if (!suggestion.ok) return suggestion

    const plan = [...suggestion.value.plan]
    if (input.includePrechecks) {
        const gaps = analyzeWorkspaceGaps(workspace, userId, {
            notebookId: notebook.id,
            includeHealthSummary: true,
        })

        if (gaps.ok) {
            plan.unshift({ tool: "analyze_workspace_gaps", input: { notebookId: notebook.id, includeHealthSummary: true } })
            if (gaps.value.severity.errors > 0) plan.push({ tool: "repair_workspace", input: {} })
        }
    }

    return ok({
        goal,
        notebookId: notebook.id,
        confidence: plan.length > 0 ? "high" : "low",
        prechecks: input.includePrechecks ? "enabled" : "disabled",
        plan,
        note: plan.length ? undefined : "No safe automatic plan steps were generated for this goal.",
    })
}

export const executePlanWithGuarantees = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: { tool: string; input?: Record<string, unknown> }[]
        continueOnFailure?: boolean
        dryRun?: boolean
        maxSteps?: number
        rollbackOnFailure?: boolean
        notebookId?: string
    },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan must be a non-empty array.")

    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const operations = input.plan.slice(0, input.maxSteps ?? input.plan.length).map(operation => ({
        ...operation,
        input: operation.input ?? {},
    }))
    const attempted = applyChangePlan(workspace, userId, {
        operations,
        continueOnFailure: input.continueOnFailure,
        dryRun: input.dryRun,
    })
    if (!attempted.ok) return attempted

    const failed = attempted.value.blockers.length > 0 && attempted.value.applied < operations.length
    const rolledBack = input.rollbackOnFailure === true && !input.dryRun && !input.continueOnFailure && failed
    const targetWorkspace = rolledBack ? workspace : attempted.value.workspace
    const validate = input.notebookId ? validateAfterMutation(targetWorkspace, userId, { notebookId: input.notebookId }) : validateAfterMutation(targetWorkspace, userId, {})
    if (!validate.ok) return validate

    return ok({
        ...attempted.value,
        workspace: targetWorkspace,
        rolledBack,
        rollbackRequested: input.rollbackOnFailure === true,
        validation: validate.value,
    })
}
