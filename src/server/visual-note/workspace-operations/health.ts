import { createVisualArticleBlock } from "./visual-blocks"
import { exportNotebook } from "./exports"
import { findOwnedView, readNotebookTree, writeViewContent } from "./read-model"
import { byIds, findOwnedNotebook } from "./selectors"
import { byPosition, HealthCheckIssue, HealthCheckResult, invalidInput, notFound, ok, OrphanAnalysisResult } from "./result"
import { parseArticleContent, serializeArticleContent, VisualBlockData, VisualBlockKind, VisualNoteWorkspace, WorkspaceOperationResult } from "./types"

export const exportPublishBundle = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; includeHtml?: boolean; includeJson?: boolean }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const markdownExport = exportNotebook(workspace, userId, { notebookId: notebook.id, format: "markdown" })
    if (!markdownExport.ok) return markdownExport

    const webExport = input.includeHtml ? exportNotebook(workspace, userId, { notebookId: notebook.id, format: "web" }) : undefined
    const readback = readNotebookTree(workspace, userId, notebook.id)
    if (!readback.ok) return readback

    const body = {
        notebook: readback.value,
        metadata: {
            id: notebook.id,
            title: notebook.title,
            summary: notebook.summary,
            pageCount: readback.value.pages.length,
            topicCount: readback.value.pages.reduce((count, page) => count + page.topics.length, 0),
            viewCount: readback.value.pages.reduce((count, page) => count + page.topics.reduce((inner, topic) => inner + topic.views.length, 0), 0),
        },
        generatedAt: new Date().toISOString(),
    }

    return ok({
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        markdown: "markdown" in markdownExport.value ? markdownExport.value.markdown : "",
        web: webExport?.ok ? webExport.value.html : undefined,
        json: input.includeJson ? JSON.stringify(body) : undefined,
        diagnostics: {
            includeHtml: input.includeHtml ?? false,
            includeJson: input.includeJson ?? false,
            manifestHash: body.notebook.id.split("-").pop() || "0",
        },
    })
}

export const workspaceHealthCheck = (workspace: VisualNoteWorkspace, userId: string): WorkspaceOperationResult<HealthCheckResult> => {
    const issues: HealthCheckIssue[] = []
    const notebooks = workspace.notebooks.filter(notebook => notebook.userId === userId)
    const notebookIds = new Set(notebooks.map(notebook => notebook.id))
    const allNotebookIds = byIds(workspace.notebooks)
    const pages = workspace.pages.filter(page => notebookIds.has(page.notebookId))
    const pageIds = byIds(pages)
    const allPageIds = byIds(workspace.pages.filter(page => allNotebookIds.has(page.notebookId)))
    const topics = workspace.topics.filter(topic => pageIds.has(topic.pageId))
    const topicIds = byIds(topics)
    const allTopicIds = byIds(workspace.topics.filter(topic => allPageIds.has(topic.pageId)))
    const views = workspace.views.filter(view => topicIds.has(view.topicId))

    for (const notebook of notebooks) {
        const sortedPages = byPosition(pages.filter(item => item.notebookId === notebook.id))
        if (sortedPages.some((page, index) => page.position !== index))
            issues.push({
                severity: "warning",
                scope: "notebook",
                id: notebook.id,
                message: `Notebook ${notebook.title} has non-normalized page positions.`,
            })
    }

    for (const page of pages) {
        const sortedTopics = byPosition(topics.filter(topic => topic.pageId === page.id))
        if (sortedTopics.some((topic, index) => topic.position !== index))
            issues.push({
                severity: "warning",
                scope: "page",
                id: page.id,
                message: `Page ${page.title} has non-normalized topic positions.`,
            })
    }

    for (const topic of topics) {
        const sortedViews = byPosition(views.filter(view => view.topicId === topic.id))
        if (sortedViews.some((view, index) => view.position !== index))
            issues.push({
                severity: "warning",
                scope: "topic",
                id: topic.id,
                message: `Topic ${topic.title} has non-normalized view positions.`,
            })
    }

    for (const page of workspace.pages)
        if (!allNotebookIds.has(page.notebookId))
            issues.push({
                severity: "error",
                scope: "page",
                id: page.id,
                message: `Page ${page.title} belongs to an unknown notebook.`,
            })

    for (const topic of workspace.topics)
        if (!allPageIds.has(topic.pageId))
            issues.push({
                severity: "error",
                scope: "topic",
                id: topic.id,
                message: `Topic ${topic.title} belongs to an unknown page.`,
            })

    for (const view of workspace.views)
        if (!allTopicIds.has(view.topicId))
            issues.push({
                severity: "error",
                scope: "view",
                id: view.id,
                message: `View ${view.title} belongs to an unknown topic.`,
            })

    return ok({
        notebookCount: notebooks.length,
        pageCount: pages.length,
        topicCount: topics.length,
        viewCount: views.length,
        issues,
    })
}

export const analyzeOrphanedData = (workspace: VisualNoteWorkspace, _userId: string): WorkspaceOperationResult<OrphanAnalysisResult> => {
    const allNotebookIds = byIds(workspace.notebooks)
    const orphanPages = workspace.pages.filter(page => !allNotebookIds.has(page.notebookId)).map(page => page.id)
    const allPageIds = byIds(workspace.pages.filter(page => allNotebookIds.has(page.notebookId)))
    const orphanTopics = workspace.topics.filter(topic => !allPageIds.has(topic.pageId)).map(topic => topic.id)
    const allTopicIds = byIds(workspace.topics.filter(topic => allPageIds.has(topic.pageId)))
    const orphanViews = workspace.views.filter(view => !allTopicIds.has(view.topicId)).map(view => view.id)

    return ok({
        orphanPages,
        orphanTopics,
        orphanViews,
        repaired: false,
    })
}

export const repairWorkspaceConsistency = (workspace: VisualNoteWorkspace, userId: string): WorkspaceOperationResult<OrphanAnalysisResult> => {
    const analyzed = analyzeOrphanedData(workspace, userId)
    if (!analyzed.ok) return analyzed

    const notebookIds = new Set(workspace.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.id))
    const allNotebookIds = byIds(workspace.notebooks)
    const ownedPages = workspace.pages.filter(page => notebookIds.has(page.notebookId)).map((page, index) => ({ ...page, position: index }))
    const foreignPages = workspace.pages.filter(page => !notebookIds.has(page.notebookId) && allNotebookIds.has(page.notebookId))
    const pages = byPosition([...ownedPages, ...foreignPages])
    const pageIds = byIds(pages)
    const topics = byPosition(workspace.topics.filter(topic => pageIds.has(topic.pageId)).map((topic, index) => ({ ...topic, position: index })))
    const topicIds = byIds(topics)
    const views = byPosition(workspace.views.filter(view => topicIds.has(view.topicId)).map((view, index) => ({ ...view, position: index })))
    const repairedWorkspace = {
        ...workspace,
        pages,
        topics,
        views,
    }

    return ok({
        orphanPages: analyzed.value.orphanPages,
        orphanTopics: analyzed.value.orphanTopics,
        orphanViews: analyzed.value.orphanViews,
        repairedWorkspace,
        repaired: analyzed.value.orphanPages.length > 0 || analyzed.value.orphanTopics.length > 0 || analyzed.value.orphanViews.length > 0,
    })
}

export const upsertVisualBlock = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { viewId: string; visualKind: VisualBlockKind; data: VisualBlockData; blockIndex?: number },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    const block = createVisualArticleBlock(input.visualKind, input.data)
    const blocks = [...parsed.blocks]
    if (input.blockIndex == null) blocks.push(block)
    else if (input.blockIndex < 0 || input.blockIndex > blocks.length) return invalidInput("blockIndex is out of range.")
    else if (blocks[input.blockIndex]?.kind === "visual") blocks[input.blockIndex] = block
    else return notFound("Visual block not found at the requested block index.")

    const content = serializeArticleContent(blocks)
    const updated = writeViewContent(workspace, context.view.id, content, context.view.displays.length)
    return ok({
        ...updated,
        view: { ...context.view, content },
        blockIndex: input.blockIndex == null ? blocks.length - 1 : input.blockIndex,
    })
}

export const removeVisualBlock = (workspace: VisualNoteWorkspace, userId: string, viewId: string, blockIndex: number) => {
    const context = findOwnedView(workspace, userId, viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    if (parsed.blocks[blockIndex]?.kind !== "visual") return notFound("Visual block not found at the requested block index.")

    const content = serializeArticleContent(parsed.blocks.filter((_, index) => index !== blockIndex))
    const updated = writeViewContent(workspace, context.view.id, content, context.view.displays.length)
    return ok({ ...updated, view: { ...context.view, content } })
}
