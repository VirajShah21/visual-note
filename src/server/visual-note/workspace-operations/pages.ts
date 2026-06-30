import { ensureUniqueSlug } from "./read-model"
import { findOwnedNotebook, findOwnedPage, moveById, reorderByIds } from "./selectors"
import { cloneWithNewIds } from "./utils"
import { byPosition, clampIndex, createId, defaultEditorSettings, invalidInput, notFound, ok, safeTrim, slugify } from "./result"
import { createNotebookRecord, createPageRecord, createTopicRecord, NotebookView, VisualNoteWorkspace } from "./types"

export const duplicateNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { sourceNotebookId: string; title?: string }) => {
    const source = findOwnedNotebook(workspace, userId, input.sourceNotebookId)
    if (!source) return notFound("Notebook not found.")

    const target = {
        ...createNotebookRecord(userId, safeTrim(input.title) || `Copy of ${source.title}`),
        summary: source.summary,
        color: source.color,
        slug: ensureUniqueSlug(workspace, `copy-${slugify(source.slug)}`, userId),
        createdAt: new Date().toISOString(),
        editorSettings: source.editorSettings ?? defaultEditorSettings,
    }

    const sourcePages = byPosition(workspace.pages.filter(page => page.notebookId === source.id))
    const pageMap = new Map<string, string>()
    const pages = sourcePages.map((page, position) => {
        const nextId = `page-${createId()}`
        pageMap.set(page.id, nextId)
        return {
            ...page,
            id: nextId,
            notebookId: target.id,
            position,
            title: page.title,
        }
    })

    const topicMap = new Map<string, string>()
    const topics = workspace.topics
        .filter(topic => pageMap.has(topic.pageId))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((topic, position) => {
            const nextId = `topic-${createId()}`
            topicMap.set(topic.id, nextId)
            return {
                ...topic,
                id: nextId,
                pageId: pageMap.get(topic.pageId) as string,
                position,
            }
        })

    const views = workspace.views
        .filter(view => topicMap.has(view.topicId))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((view, position) => ({
            ...cloneWithNewIds(view),
            id: `view-${createId()}`,
            topicId: topicMap.get(view.topicId) as string,
            position,
        })) as NotebookView[]

    return ok({
        workspace: {
            ...workspace,
            notebooks: [...workspace.notebooks, target],
            pages: [...workspace.pages, ...pages],
            topics: [...workspace.topics, ...topics],
            views: [...workspace.views, ...views],
        },
        notebook: target,
    })
}

export const createPage = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; title: string; position?: number }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const title = safeTrim(input.title)
    if (!title) return invalidInput("Page title is required.")

    const siblings = byPosition(workspace.pages.filter(page => page.notebookId === notebook.id))
    const targetPosition = clampIndex(input.position ?? siblings.length, siblings.length)
    const page = {
        ...createPageRecord(notebook.id, title, targetPosition),
        content: "",
    }
    const nextSiblings = [
        ...siblings.slice(0, targetPosition).map(page => page),
        ...[page],
        ...siblings.slice(targetPosition).map((item, index) => ({
            ...item,
            position: targetPosition + index + 1,
        })),
    ]

    return ok({
        workspace: {
            ...workspace,
            pages: [...workspace.pages.filter(item => item.notebookId !== notebook.id), ...nextSiblings],
        },
        page,
        notebook,
    })
}

export const renamePage = (workspace: VisualNoteWorkspace, userId: string, input: { pageId: string; title?: string; position?: number }) => {
    const context = findOwnedPage(workspace, userId, input.pageId)
    if (!context) return notFound("Page not found.")

    const siblings = byPosition(workspace.pages.filter(item => item.notebookId === context.page.notebookId))
    const currentPosition = siblings.findIndex(item => item.id === context.page.id)
    const target = input.position === undefined ? currentPosition : clampIndex(input.position, siblings.length - 1)
    const moved = moveById(siblings, context.page.id, target)
    if (!moved) return invalidInput("Unable to reorder page.")

    const page = {
        ...context.page,
        title: safeTrim(input.title) || context.page.title,
        position: target,
    }
    const next = moved.map(item => (item.id === context.page.id ? page : item))

    return ok({
        workspace: {
            ...workspace,
            pages: [...workspace.pages.filter(item => item.notebookId !== context.page.notebookId), ...next],
        },
        page,
    })
}

export const reorderPages = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; pageIds: string[] }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")
    const siblings = byPosition(workspace.pages.filter(page => page.notebookId === notebook.id))
    const nextSiblings = reorderByIds(siblings, input.pageIds)
    if (!nextSiblings) return invalidInput("pageIds must include every page for the notebook.")

    return ok({
        workspace: {
            ...workspace,
            pages: [...workspace.pages.filter(page => page.notebookId !== notebook.id), ...nextSiblings],
        },
    })
}

export const movePageToNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { pageId: string; targetNotebookId: string; position?: number }) => {
    const sourceContext = findOwnedPage(workspace, userId, input.pageId)
    if (!sourceContext) return notFound("Page not found.")

    const targetNotebook = findOwnedNotebook(workspace, userId, input.targetNotebookId)
    if (!targetNotebook) return notFound("Target notebook not found.")

    if (sourceContext.page.notebookId === targetNotebook.id)
        return reorderPages(workspace, userId, {
            notebookId: sourceContext.page.notebookId,
            pageIds: byPosition(workspace.pages.filter(page => page.notebookId === sourceContext.page.notebookId)).map(page => page.id),
        })

    const sourceSiblingPages = byPosition(workspace.pages.filter(page => page.notebookId === sourceContext.page.notebookId && page.id !== input.pageId))
    const targetSiblingPages = byPosition(workspace.pages.filter(page => page.notebookId === targetNotebook.id))
    const movedPage = { ...sourceContext.page, notebookId: targetNotebook.id }
    const targetPosition = clampIndex(input.position ?? targetSiblingPages.length, targetSiblingPages.length)
    const nextTarget = [
        ...targetSiblingPages.slice(0, targetPosition),
        { ...movedPage, position: targetPosition },
        ...targetSiblingPages.slice(targetPosition).map((item, index) => ({ ...item, position: targetPosition + index + 1 })),
    ]
    const nextSource = sourceSiblingPages.map((page, index) => ({ ...page, position: index }))

    return ok({
        workspace: {
            ...workspace,
            pages: [...workspace.pages.filter(item => item.notebookId !== sourceContext.page.notebookId && item.notebookId !== targetNotebook.id), ...nextSource, ...nextTarget],
        },
        page: movedPage,
    })
}

export const deletePage = (workspace: VisualNoteWorkspace, userId: string, pageId: string) => {
    const context = findOwnedPage(workspace, userId, pageId)
    if (!context) return notFound("Page not found.")

    const topicIds = new Set(workspace.topics.filter(topic => topic.pageId === context.page.id).map(topic => topic.id))
    return ok({
        workspace: {
            ...workspace,
            pages: workspace.pages.filter(item => item.id !== pageId),
            topics: workspace.topics.filter(topic => topic.pageId !== context.page.id),
            views: workspace.views.filter(view => !topicIds.has(view.topicId)),
        },
        page: context.page,
    })
}

export const createTopic = (workspace: VisualNoteWorkspace, userId: string, input: { pageId: string; title: string; summary?: string; position?: number }) => {
    const context = findOwnedPage(workspace, userId, input.pageId)
    if (!context) return notFound("Page not found.")

    const title = safeTrim(input.title)
    if (!title) return invalidInput("Topic title is required.")

    const siblings = byPosition(workspace.topics.filter(topic => topic.pageId === context.page.id))
    const position = clampIndex(input.position ?? siblings.length, siblings.length)
    const topic = {
        ...createTopicRecord(context.page.id, title, position),
        summary: safeTrim(input.summary) || "A focused subdivision inside this section.",
    }
    const nextSiblings = [...siblings.slice(0, position), topic, ...siblings.slice(position).map((item, index) => ({ ...item, position: position + index + 1 }))]

    return ok({
        workspace: {
            ...workspace,
            topics: [...workspace.topics.filter(topic => topic.pageId !== context.page.id), ...nextSiblings],
        },
        topic,
    })
}
