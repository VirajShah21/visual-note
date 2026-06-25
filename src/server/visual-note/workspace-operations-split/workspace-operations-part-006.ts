import { ensureUniqueSlug, findOwnedView } from "./workspace-operations-part-005"
import { findOwnedNotebook } from "./workspace-operations-part-004"
import { byPosition, cloneWorkspace, invalidInput, normalizeTitle, notFound, ok, safeTrim, slugify } from "./workspace-operations-part-002"
import { createNotebookRecord, createPageRecord, createTopicRecord, createViewRecord, Notebook, ViewMode, VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-005"

export const resolveView = (workspace: VisualNoteWorkspace, userId: string, input: { viewId?: string; title?: string; topicId?: string }) => {
    if (input.viewId) {
        const context = findOwnedView(workspace, userId, input.viewId)
        if (!context) return notFound("View not found.")
        return ok(context.view)
    }

    const title = normalizeTitle(safeTrim(input.title))
    if (!title) return invalidInput("viewId or title is required.")

    const matches = workspace.views.filter(view => {
        if (input.topicId && view.topicId !== input.topicId) return false
        const context = findOwnedView(workspace, userId, view.id)
        return Boolean(context) && normalizeTitle(view.title) === title
    })

    if (matches.length === 0) return notFound("View not found.")
    if (matches.length > 1) return invalidInput("View title is ambiguous. Use viewId.")
    return ok(matches[0]!)
}

export const listPages = (workspace: VisualNoteWorkspace, userId: string, notebookId?: string) =>
    ok(
        byPosition(workspace.pages)
            .filter(page => (!notebookId || page.notebookId === notebookId) && Boolean(findOwnedNotebook(workspace, userId, page.notebookId)))
            .map(page => ({
                ...page,
                topicCount: workspace.topics.filter(topic => topic.pageId === page.id).length,
                viewCount: workspace.views.filter(view => workspace.topics.some(topic => topic.id === view.topicId && topic.pageId === page.id)).length,
            })),
    )

export const createNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { title: string; summary?: string; color?: string; slug?: string }) => {
    const title = safeTrim(input.title)
    if (!title) return invalidInput("title is required.")

    const created = createNotebookRecord(userId, title)
    created.slug = ensureUniqueSlug(workspace, slugify(safeTrim(input.slug) || created.slug), userId)
    if (input.summary?.trim()) created.summary = input.summary.trim()
    if (input.color?.trim()) created.color = input.color.trim()
    created.createdAt = new Date().toISOString()

    return ok({
        workspace: {
            ...workspace,
            notebooks: [...workspace.notebooks, created],
        },
        notebook: created,
    })
}

export const createArticle = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId: string; pageTitle: string; topicTitle: string; articleTitle?: string; content?: string; mode?: ViewMode },
) => {
    const notebookId = input.notebookId
    if (!notebookId) return notFound("Notebook not found.")
    const notebook = findOwnedNotebook(workspace, userId, notebookId)
    if (!notebook) return notFound("Notebook not found.")

    let createdPage = false
    let createdTopic = false
    let createdView = false

    const normalizedPageTitle = safeTrim(input.pageTitle)
    if (!normalizedPageTitle) return invalidInput("pageTitle is required.")
    const normalizedTopicTitle = safeTrim(input.topicTitle)
    if (!normalizedTopicTitle) return invalidInput("topicTitle is required.")

    const pageSiblings = byPosition(workspace.pages.filter(item => item.notebookId === notebook.id))
    const existingPage = pageSiblings.find(item => normalizeTitle(item.title) === normalizeTitle(normalizedPageTitle))
    let nextWorkspace = cloneWorkspace(workspace)

    let page = existingPage
    if (!page) {
        createdPage = true
        page = {
            ...createPageRecord(notebook.id, normalizedPageTitle, pageSiblings.length),
            content: "",
        }
        nextWorkspace = {
            ...nextWorkspace,
            pages: [...nextWorkspace.pages, page],
        }
    }

    const topicSiblings = byPosition(nextWorkspace.topics.filter(topic => topic.pageId === page.id))
    const existingTopic = topicSiblings.find(item => normalizeTitle(item.title) === normalizeTitle(normalizedTopicTitle))
    let topic = existingTopic
    if (!topic) {
        createdTopic = true
        topic = {
            ...createTopicRecord(page.id, normalizedTopicTitle, topicSiblings.length),
            summary: "A focused subdivision inside this section.",
        }
        nextWorkspace = {
            ...nextWorkspace,
            topics: [...nextWorkspace.topics, topic],
        }
    }

    const articleTitle = safeTrim(input.articleTitle || `${topic.title} article`) || `${topic.title} article`
    const topicViews = byPosition(nextWorkspace.views.filter(view => view.topicId === topic.id))
    let view = topicViews.find(view => view.title === articleTitle) ?? topicViews.find(view => normalizeTitle(view.title) === "article")
    if (!view) {
        createdView = true
        const created = createViewRecord(topic.id, articleTitle, input.mode ?? "article")
        view = {
            ...created,
            content: safeTrim(input.content) || created.content,
        }
        nextWorkspace = {
            ...nextWorkspace,
            views: [...nextWorkspace.views, view],
        }
    } else if (input.content) {
        view = { ...view, content: input.content.trim() || view.content }
        nextWorkspace = {
            ...nextWorkspace,
            views: nextWorkspace.views.map(item => (item.id === view?.id ? view : item)),
        }
    }

    return ok({
        workspace: nextWorkspace,
        notebook,
        page,
        topic,
        view,
        createdPage,
        createdTopic,
        createdView,
    })
}

export const renameNotebook = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId: string; title?: string; summary?: string; color?: string; slug?: string; published?: boolean },
) => {
    const notebookId = input.notebookId
    if (!notebookId) return notFound("Notebook not found.")
    const notebook = findOwnedNotebook(workspace, userId, notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const next = { ...notebook } as Notebook
    if (safeTrim(input.title)) {
        next.title = safeTrim(input.title)
        next.slug = ensureUniqueSlug(workspace, slugify(safeTrim(input.slug) || next.title), userId)
    }
    if (input.summary !== undefined) next.summary = input.summary
    if (input.color !== undefined) next.color = input.color
    if (safeTrim(input.slug)) next.slug = ensureUniqueSlug(workspace, slugify(input.slug as string), userId)
    if (typeof input.published === "boolean") {
        next.published = input.published
        next.publishedAt = input.published ? new Date().toISOString() : undefined
    }

    return ok({
        workspace: {
            ...workspace,
            notebooks: workspace.notebooks.map(item => (item.id === input.notebookId ? next : item)),
        },
        notebook: next,
    })
}

export const deleteNotebook = (workspace: VisualNoteWorkspace, userId: string, notebookId: string) => {
    const notebook = findOwnedNotebook(workspace, userId, notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const pageIds = new Set(workspace.pages.filter(page => page.notebookId === notebook.id).map(page => page.id))
    const topicIds = new Set(workspace.topics.filter(topic => pageIds.has(topic.pageId)).map(topic => topic.id))
    return ok({
        workspace: {
            ...workspace,
            notebooks: workspace.notebooks.filter(item => item.id !== notebook.id),
            pages: workspace.pages.filter(page => !pageIds.has(page.id)),
            topics: workspace.topics.filter(topic => !pageIds.has(topic.pageId)),
            views: workspace.views.filter(view => !topicIds.has(view.topicId)),
        },
    })
}
