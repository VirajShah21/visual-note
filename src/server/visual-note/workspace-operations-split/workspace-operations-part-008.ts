import { findOwnedTopic, findOwnedView } from "./workspace-operations-part-005"
import { findOwnedPage, moveById, reorderByIds } from "./workspace-operations-part-004"
import { cloneWithNewIds } from "./workspace-operations-part-003"
import { byPosition, clampIndex, createId, invalidInput, notFound, ok, safeTrim } from "./workspace-operations-part-002"
import { createViewRecord, NotebookView, ViewMode, VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-007"

export const renameTopic = (workspace: VisualNoteWorkspace, userId: string, input: { topicId: string; title?: string; summary?: string; position?: number }) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")

    const siblings = byPosition(workspace.topics.filter(topic => topic.pageId === context.page.id))
    const target = input.position === undefined ? siblings.findIndex(item => item.id === context.topic.id) : clampIndex(input.position, siblings.length - 1)
    const reordered = moveById(siblings, context.topic.id, target)
    if (!reordered) return invalidInput("Unable to reorder topic.")

    const nextTopic = {
        ...context.topic,
        title: safeTrim(input.title) || context.topic.title,
        summary: input.summary !== undefined ? input.summary : context.topic.summary,
    }
    const nextSiblings = reordered.map(item => (item.id === context.topic.id ? nextTopic : item))

    return ok({
        workspace: {
            ...workspace,
            topics: [...workspace.topics.filter(topic => topic.pageId !== context.page.id), ...nextSiblings],
        },
        topic: nextTopic,
    })
}

export const reorderTopics = (workspace: VisualNoteWorkspace, userId: string, input: { pageId: string; topicIds: string[] }) => {
    const context = findOwnedPage(workspace, userId, input.pageId)
    if (!context) return notFound("Page not found.")
    const siblings = byPosition(workspace.topics.filter(topic => topic.pageId === context.page.id))
    const nextSiblings = reorderByIds(siblings, input.topicIds)
    if (!nextSiblings) return invalidInput("topicIds must include every topic in the page.")

    return ok({
        workspace: {
            ...workspace,
            topics: [...workspace.topics.filter(topic => topic.pageId !== context.page.id), ...nextSiblings],
        },
    })
}

export const moveTopicToPage = (workspace: VisualNoteWorkspace, userId: string, input: { topicId: string; targetPageId: string; position?: number }) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")
    const targetPage = findOwnedPage(workspace, userId, input.targetPageId)
    if (!targetPage) return notFound("Target page not found.")

    if (context.page.id === targetPage.page.id)
        return renameTopic(workspace, userId, {
            topicId: input.topicId,
            title: context.topic.title,
            summary: context.topic.summary,
            position: input.position,
        })

    const sourceSiblings = byPosition(workspace.topics.filter(topic => topic.pageId === context.page.id && topic.id !== context.topic.id))
    const sourceNormalized = sourceSiblings.map((topic, index) => ({ ...topic, position: index }))
    const targetSiblings = byPosition(workspace.topics.filter(topic => topic.pageId === targetPage.page.id))
    const targetPosition = clampIndex(input.position ?? targetSiblings.length, targetSiblings.length)
    const movedTopic = { ...context.topic, pageId: targetPage.page.id }
    const nextTarget = [
        ...targetSiblings.slice(0, targetPosition),
        { ...movedTopic, position: targetPosition },
        ...targetSiblings.slice(targetPosition).map((item, index) => ({ ...item, position: targetPosition + index + 1 })),
    ]

    return ok({
        workspace: {
            ...workspace,
            topics: [...workspace.topics.filter(topic => topic.pageId !== context.page.id && topic.pageId !== targetPage.page.id), ...sourceNormalized, ...nextTarget],
        },
        topic: movedTopic,
    })
}

export const duplicateTopic = (workspace: VisualNoteWorkspace, userId: string, input: { topicId: string; targetPageId?: string; title?: string; position?: number }) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")

    const targetContext = input.targetPageId ? findOwnedPage(workspace, userId, input.targetPageId) : { page: context.page, notebook: context.notebook }
    if (!targetContext) return notFound("Target page not found.")

    const topicTitle = safeTrim(input.title) || `Copy of ${context.topic.title}`
    const siblings = byPosition(workspace.topics.filter(item => item.pageId === targetContext.page.id))
    const position = clampIndex(input.position ?? siblings.length, siblings.length)
    const mapped = cloneWithNewIds(context.topic)
    const topic = {
        ...mapped,
        id: `topic-${createId()}`,
        title: topicTitle,
        pageId: targetContext.page.id,
        position,
    }

    const topicViews = byPosition(workspace.views.filter(view => view.topicId === context.topic.id)).map((view, index) => ({
        ...cloneWithNewIds(view),
        id: `view-${createId()}`,
        topicId: topic.id,
        position: index,
    })) as NotebookView[]

    const nextSiblings = [...siblings.slice(0, position), topic, ...siblings.slice(position).map((item, index) => ({ ...item, position: position + index + 1 }))]
    return ok({
        workspace: {
            ...workspace,
            topics: [...workspace.topics.filter(topic => topic.pageId !== targetContext.page.id), ...nextSiblings],
            views: [...workspace.views, ...topicViews],
        },
        topic,
        views: topicViews,
    })
}

export const deleteTopic = (workspace: VisualNoteWorkspace, userId: string, topicId: string) => {
    const context = findOwnedTopic(workspace, userId, topicId)
    if (!context) return notFound("Topic not found.")

    return ok({
        workspace: {
            ...workspace,
            topics: workspace.topics.filter(topic => topic.id !== topicId),
            views: workspace.views.filter(view => view.topicId !== topicId),
        },
        topic: context.topic,
    })
}

export const createView = (workspace: VisualNoteWorkspace, userId: string, input: { topicId: string; title: string; mode?: ViewMode; position?: number; content?: string }) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")

    const title = safeTrim(input.title)
    if (!title) return invalidInput("View title is required.")

    const siblings = byPosition(workspace.views.filter(view => view.topicId === context.topic.id))
    const position = clampIndex(input.position ?? siblings.length, siblings.length)
    const created = {
        ...createViewRecord(context.topic.id, title, input.mode ?? "article"),
        content: safeTrim(input.content) || createViewRecord(context.topic.id, title, input.mode ?? "article").content,
        position,
    }
    const nextSiblings = [...siblings.slice(0, position), created, ...siblings.slice(position).map((item, index) => ({ ...item, position: position + index + 1 }))]

    return ok({
        workspace: {
            ...workspace,
            views: [...workspace.views.filter(view => view.topicId !== context.topic.id), ...nextSiblings],
        },
        view: created,
    })
}

export const duplicateView = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; targetTopicId?: string; title?: string; position?: number }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")
    const targetTopic = input.targetTopicId ? findOwnedTopic(workspace, userId, input.targetTopicId) : context
    if (!targetTopic) return notFound("Target topic not found.")

    const siblings = byPosition(workspace.views.filter(view => view.topicId === targetTopic.topic.id))
    const position = clampIndex(input.position ?? siblings.length, siblings.length)
    const view = {
        ...cloneWithNewIds(context.view),
        id: `view-${createId()}`,
        topicId: targetTopic.topic.id,
        title: safeTrim(input.title) || `Copy of ${context.view.title}`,
        position,
    } as NotebookView

    const nextSiblings = [...siblings.slice(0, position), view, ...siblings.slice(position).map((item, index) => ({ ...item, position: position + index + 1 }))]
    return ok({
        workspace: {
            ...workspace,
            views: [...workspace.views.filter(view => view.topicId !== targetTopic.topic.id), ...nextSiblings],
        },
        view,
    })
}

export const renameView = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; title?: string; mode?: ViewMode }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const next = {
        ...context.view,
        title: safeTrim(input.title) || context.view.title,
        mode: input.mode ?? context.view.mode,
    }
    return ok({
        workspace: {
            ...workspace,
            views: workspace.views.map(view => (view.id === context.view.id ? next : view)),
        },
        view: next,
    })
}

export const reorderViews = (workspace: VisualNoteWorkspace, userId: string, input: { topicId: string; viewIds: string[] }) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")
    const siblings = byPosition(workspace.views.filter(view => view.topicId === context.topic.id))
    const nextSiblings = reorderByIds(siblings, input.viewIds)
    if (!nextSiblings) return invalidInput("viewIds must include every view in topic.")

    return ok({
        workspace: {
            ...workspace,
            views: [...workspace.views.filter(view => view.topicId !== context.topic.id), ...nextSiblings],
        },
    })
}
