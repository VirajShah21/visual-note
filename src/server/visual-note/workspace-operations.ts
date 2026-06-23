import { parseArticleContent, serializeArticleContent, type ArticleBlock } from "@/lib/visual-note/article-content"
import { createPage, createTopic, createView } from "@/lib/visual-note/factories"
import type { Notebook, NotebookPage, NotebookView, Topic, VisualNoteWorkspace } from "@/lib/visual-note/types"
import { defaultVisualBlockData, serializeVisualBlockBody, type VisualBlockData, type VisualBlockKind } from "@/lib/visual-note/visual-blocks"

export type WorkspaceOperationResult<T> = { ok: true; value: T } | { ok: false; error: "not_found" | "invalid_input"; message: string }

export type NotebookSummary = {
    id: string
    title: string
    slug: string
    summary: string
    color: string
    createdAt: string
    pageCount: number
    topicCount: number
    viewCount: number
    displayCount: number
}

export type NotebookTree = Notebook & {
    pages: Array<NotebookPage & { topics: Array<Topic & { views: NotebookView[] }> }>
}

type ViewContext = {
    notebook: Notebook
    page: NotebookPage
    topic: Topic
    view: NotebookView
}

const ok = <T>(value: T): WorkspaceOperationResult<T> => ({ ok: true, value })

const notFound = (message: string): WorkspaceOperationResult<never> => ({ ok: false, error: "not_found", message })

const invalidInput = (message: string): WorkspaceOperationResult<never> => ({ ok: false, error: "invalid_input", message })

const byPosition = <T extends { position: number }>(items: T[]) => [...items].sort((first, second) => first.position - second.position)

const normalizedTitle = (title: string) => title.trim().toLowerCase()

const findOwnedNotebook = (workspace: VisualNoteWorkspace, userId: string, notebookId: string) =>
    workspace.notebooks.find(notebook => notebook.id === notebookId && notebook.userId === userId)

const findViewContext = (workspace: VisualNoteWorkspace, userId: string, viewId: string): ViewContext | null => {
    const view = workspace.views.find(item => item.id === viewId)
    const topic = workspace.topics.find(item => item.id === view?.topicId)
    const page = workspace.pages.find(item => item.id === topic?.pageId)
    const notebook = workspace.notebooks.find(item => item.id === page?.notebookId && item.userId === userId)
    if (!view || !topic || !page || !notebook) return null

    return { notebook, page, topic, view }
}

export const listNotebooks = (workspace: VisualNoteWorkspace, userId: string): NotebookSummary[] =>
    workspace.notebooks
        .filter(notebook => notebook.userId === userId)
        .map(notebook => {
            const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
            const pageIds = new Set(pages.map(page => page.id))
            const topics = workspace.topics.filter(topic => pageIds.has(topic.pageId))
            const topicIds = new Set(topics.map(topic => topic.id))
            const views = workspace.views.filter(view => topicIds.has(view.topicId))

            return {
                id: notebook.id,
                title: notebook.title,
                slug: notebook.slug,
                summary: notebook.summary,
                color: notebook.color,
                createdAt: notebook.createdAt,
                pageCount: pages.length,
                topicCount: topics.length,
                viewCount: views.length,
                displayCount: views.reduce((total, view) => total + view.displays.length, 0),
            }
        })

export const readNotebookTree = (workspace: VisualNoteWorkspace, userId: string, notebookId: string): WorkspaceOperationResult<NotebookTree> => {
    const notebook = findOwnedNotebook(workspace, userId, notebookId)
    if (!notebook) return notFound("Notebook not found.")

    return ok({
        ...notebook,
        pages: byPosition(workspace.pages.filter(page => page.notebookId === notebook.id)).map(page => ({
            ...page,
            topics: byPosition(workspace.topics.filter(topic => topic.pageId === page.id)).map(topic => ({
                ...topic,
                views: workspace.views.filter(view => view.topicId === topic.id),
            })),
        })),
    })
}

export const readArticle = (workspace: VisualNoteWorkspace, userId: string, viewId: string) => {
    const context = findViewContext(workspace, userId, viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    return ok({
        notebook: context.notebook,
        page: context.page,
        topic: context.topic,
        view: context.view,
        blocks: parsed.blocks,
        headings: parsed.headings,
        visualBlocks: parsed.blocks.flatMap((block, blockIndex) =>
            block.kind === "visual" ? [{ blockIndex, visualKind: block.visualKind, data: block.data, parseError: block.parseError }] : [],
        ),
    })
}

export const replaceArticleContent = (workspace: VisualNoteWorkspace, userId: string, viewId: string, content: string) => {
    const context = findViewContext(workspace, userId, viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(content, context.view.displays.length)
    const serialized = serializeArticleContent(parsed.blocks)
    const reparsed = parseArticleContent(serialized, context.view.displays.length)
    if (reparsed.blocks.length !== parsed.blocks.length) return invalidInput("Article content did not survive serialization.")

    return ok({
        workspace: updateView(workspace, { ...context.view, content: serialized }),
        view: { ...context.view, content: serialized },
    })
}

export const createArticle = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId: string; pageTitle: string; topicTitle: string; articleTitle?: string; content?: string },
) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    const pageTitle = input.pageTitle.trim()
    const topicTitle = input.topicTitle.trim()
    if (!notebook) return notFound("Notebook not found.")
    if (!pageTitle || !topicTitle) return invalidInput("Page title and topic title are required.")

    let nextWorkspace = workspace
    let page = workspace.pages.find(item => item.notebookId === notebook.id && normalizedTitle(item.title) === normalizedTitle(pageTitle))
    let createdPage = false
    if (!page) {
        page = createPage(notebook.id, pageTitle, workspace.pages.filter(item => item.notebookId === notebook.id).length)
        nextWorkspace = { ...nextWorkspace, pages: [...nextWorkspace.pages, page] }
        createdPage = true
    }

    let topic = nextWorkspace.topics.find(item => item.pageId === page.id && normalizedTitle(item.title) === normalizedTitle(topicTitle))
    let createdTopic = false
    if (!topic) {
        topic = createTopic(page.id, topicTitle, nextWorkspace.topics.filter(item => item.pageId === page.id).length)
        nextWorkspace = { ...nextWorkspace, topics: [...nextWorkspace.topics, topic] }
        createdTopic = true
    }

    let view = nextWorkspace.views.find(item => item.topicId === topic.id && item.mode === "article")
    let createdView = false
    if (!view) {
        view = createView(topic.id, input.articleTitle?.trim() || "Article", "article")
        nextWorkspace = { ...nextWorkspace, views: [...nextWorkspace.views, view] }
        createdView = true
    }

    if (input.content !== undefined) {
        const replaced = replaceArticleContent(nextWorkspace, userId, view.id, input.content)
        if (!replaced.ok) return replaced
        nextWorkspace = replaced.value.workspace
        view = replaced.value.view
    }

    return ok({ workspace: nextWorkspace, notebook, page, topic, view, createdPage, createdTopic, createdView })
}

export const upsertVisualBlock = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { viewId: string; visualKind: VisualBlockKind; data: VisualBlockData; blockIndex?: number },
) => {
    const context = findViewContext(workspace, userId, input.viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    const block = createVisualArticleBlock(input.visualKind, input.data)
    const blocks = [...parsed.blocks]
    const blockIndex = input.blockIndex
    if (blockIndex === undefined) blocks.push(block)
    else if (blocks[blockIndex]?.kind === "visual") blocks[blockIndex] = block
    else return notFound("Visual block not found at the requested block index.")

    const content = serializeArticleContent(blocks)
    const view = { ...context.view, content }
    return ok({ workspace: updateView(workspace, view), view, blockIndex: blockIndex ?? blocks.length - 1 })
}

export const removeVisualBlock = (workspace: VisualNoteWorkspace, userId: string, viewId: string, blockIndex: number) => {
    const context = findViewContext(workspace, userId, viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    if (parsed.blocks[blockIndex]?.kind !== "visual") return notFound("Visual block not found at the requested block index.")

    const content = serializeArticleContent(parsed.blocks.filter((_, index) => index !== blockIndex))
    const view = { ...context.view, content }
    return ok({ workspace: updateView(workspace, view), view })
}

const updateView = (workspace: VisualNoteWorkspace, view: NotebookView): VisualNoteWorkspace => ({
    ...workspace,
    views: workspace.views.map(item => (item.id === view.id ? view : item)),
})

const createVisualArticleBlock = (visualKind: VisualBlockKind, data: VisualBlockData): Extract<ArticleBlock, { kind: "visual" }> => {
    const mergedData = { ...defaultVisualBlockData(visualKind), ...data }
    return {
        kind: "visual",
        visualKind,
        data: mergedData,
        raw: serializeVisualBlockBody(mergedData),
    }
}
