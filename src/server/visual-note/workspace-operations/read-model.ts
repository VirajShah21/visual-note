import { byIds, findOwnedNotebook, findOwnedPage } from "./selectors"
import { byPosition, invalidInput, normalizeTitle, notFound, ok, safeTrim } from "./result"
import { NotebookSummary, parseArticleContent, serializeArticleContent, VisualNoteWorkspace } from "./types"

export const findOwnedTopic = (workspace: VisualNoteWorkspace, userId: string, topicId: string) => {
    const topic = workspace.topics.find(item => item.id === topicId)
    if (!topic) return null

    const pageContext = findOwnedPage(workspace, userId, topic.pageId)
    if (!pageContext) return null

    return { page: pageContext.page, notebook: pageContext.notebook, topic }
}

export const findOwnedView = (workspace: VisualNoteWorkspace, userId: string, viewId: string) => {
    const view = workspace.views.find(item => item.id === viewId)
    if (!view) return null

    const topicContext = findOwnedTopic(workspace, userId, view.topicId)
    if (!topicContext) return null

    return { ...topicContext, view }
}

export const normalizeWorkspace = (workspace: VisualNoteWorkspace, userId: string) => {
    const userNotebookIds = new Set(workspace.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.id))
    const pages = byPosition(workspace.pages.filter(page => userNotebookIds.has(page.notebookId))).map((page, index) => ({ ...page, position: index }))
    const topicPages = pages.map(page => page.id)
    const topics = byPosition(workspace.topics.filter(topic => topicPages.includes(topic.pageId))).map((topic, index) => ({
        ...topic,
        position: index,
    }))
    const topicIds = topics.map(topic => topic.id)
    const views = byPosition(workspace.views.filter(view => topicIds.includes(view.topicId))).map((view, index) => ({
        ...view,
        position: index,
    }))

    return {
        ...workspace,
        pages,
        topics,
        views,
        notebooks: workspace.notebooks.filter(notebook => userNotebookIds.has(notebook.id)),
    }
}

export const ensureUniqueSlug = (workspace: VisualNoteWorkspace, base: string, userId: string) => {
    const used = new Set(workspace.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.slug))
    if (!used.has(base)) return base

    let attempt = 2
    let candidate = `${base}-${attempt}`
    while (used.has(candidate)) {
        attempt += 1
        candidate = `${base}-${attempt}`
    }

    return candidate
}

export const writeViewContent = (workspace: VisualNoteWorkspace, viewId: string, content: string, displaysLength: number) => {
    const parsed = parseArticleContent(content, displaysLength)
    return {
        workspace: {
            ...workspace,
            views: workspace.views.map(view => (view.id === viewId ? { ...view, content: serializeArticleContent(parsed.blocks) } : view)),
        },
        view: workspace.views.find(view => view.id === viewId)!,
    }
}

export const listNotebooks = (workspace: VisualNoteWorkspace, userId: string): NotebookSummary[] =>
    normalizeWorkspace(workspace, userId).notebooks.map(notebook => {
        const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
        const pageIds = byIds(pages)
        const topics = workspace.topics.filter(topic => pageIds.has(topic.pageId))
        const topicIds = byIds(topics)
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
            displayCount: views.reduce((sum, view) => sum + view.displays.length, 0),
        }
    })

export const readWorkspace = (workspace: VisualNoteWorkspace, userId: string) => {
    const notebooks = listNotebooks(workspace, userId)
    return ok({
        notebooks,
        pageCount: notebooks.reduce((sum, item) => sum + item.pageCount, 0),
        topicCount: notebooks.reduce((sum, item) => sum + item.topicCount, 0),
        viewCount: notebooks.reduce((sum, item) => sum + item.viewCount, 0),
        displayCount: notebooks.reduce((sum, item) => sum + item.displayCount, 0),
    })
}

export const readNotebookTree = (workspace: VisualNoteWorkspace, userId: string, notebookId: string) => {
    const notebook = findOwnedNotebook(workspace, userId, notebookId)
    if (!notebook) return notFound("Notebook not found.")

    return ok({
        ...notebook,
        pages: byPosition(workspace.pages.filter(page => page.notebookId === notebook.id)).map(page => ({
            ...page,
            topics: byPosition(workspace.topics.filter(topic => topic.pageId === page.id)).map(topic => ({
                ...topic,
                views: byPosition(workspace.views.filter(view => view.topicId === topic.id)),
            })),
        })),
    })
}

export const readPageContext = (workspace: VisualNoteWorkspace, userId: string, pageId: string) => {
    const context = findOwnedPage(workspace, userId, pageId)
    if (!context) return notFound("Page not found.")

    return ok({
        notebook: context.notebook,
        page: context.page,
        topics: byPosition(workspace.topics.filter(topic => topic.pageId === context.page.id)).map(topic => ({
            ...topic,
            views: byPosition(workspace.views.filter(view => view.topicId === topic.id)),
        })),
    })
}

export const resolveNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; title?: string }) => {
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
        return ok(notebook)
    }

    const title = normalizeTitle(safeTrim(input.title))
    if (!title) return invalidInput("notebookId or title is required.")

    const matches = workspace.notebooks.filter(notebook => {
        if (notebook.userId !== userId) return false
        return normalizeTitle(notebook.title) === title || normalizeTitle(notebook.slug) === title
    })
    if (matches.length === 0) return notFound("Notebook not found.")
    if (matches.length > 1) return invalidInput("Notebook title is ambiguous. Use notebookId.")

    return ok(matches[0]!)
}

export const resolvePage = (workspace: VisualNoteWorkspace, userId: string, input: { pageId?: string; title?: string; notebookId?: string }) => {
    if (input.pageId) {
        const context = findOwnedPage(workspace, userId, input.pageId)
        if (!context) return notFound("Page not found.")
        if (input.notebookId && context.page.notebookId !== input.notebookId) return notFound("Page not found.")
        return ok(context.page)
    }

    const title = normalizeTitle(safeTrim(input.title))
    if (!title) return invalidInput("pageId or title is required.")
    const matches = workspace.pages.filter(page => {
        if (page.notebookId !== input.notebookId && input.notebookId) return false
        const notebook = findOwnedNotebook(workspace, userId, page.notebookId)
        if (!notebook) return false
        return normalizeTitle(page.title) === title
    })
    if (matches.length === 0) return notFound("Page not found.")
    if (matches.length > 1) return invalidInput("Page title is ambiguous. Use pageId.")
    return ok(matches[0]!)
}

export const resolveTopic = (workspace: VisualNoteWorkspace, userId: string, input: { topicId?: string; title?: string; pageId?: string }) => {
    if (input.topicId) {
        const context = findOwnedTopic(workspace, userId, input.topicId)
        if (!context) return notFound("Topic not found.")
        if (input.pageId && context.page.id !== input.pageId) return notFound("Topic not found.")
        return ok(context.topic)
    }

    const title = normalizeTitle(safeTrim(input.title))
    if (!title) return invalidInput("topicId or title is required.")

    const candidates = workspace.topics.filter(topic => {
        if (input.pageId && topic.pageId !== input.pageId) return false
        const pageContext = findOwnedPage(workspace, userId, topic.pageId)
        return Boolean(pageContext)
    })

    const matches = candidates.filter(topic => normalizeTitle(topic.title) === title)
    if (matches.length === 0) return notFound("Topic not found.")
    if (matches.length > 1) return invalidInput("Topic title is ambiguous. Use topicId.")
    return ok(matches[0]!)
}
