import type { NotebookPage, NotebookView, Topic } from "../types"
import type { ExportDocument, ExportDocumentInput, ExportPage, ExportTopic } from "./types"

export const slugifyExportName = (value: string, fallback = "visual-note") => {
    const slug = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")

    return slug || fallback
}

const byPosition = <T extends { position: number }>(first: T, second: T) => first.position - second.position

const findTopicView = (views: NotebookView[], topic: Topic) => {
    const topicViews = views.filter(view => view.topicId === topic.id)
    return topicViews.find(view => view.mode === "article") ?? topicViews[0] ?? null
}

const toExportTopic = (topic: Topic, views: NotebookView[]): ExportTopic => {
    const view = findTopicView(views, topic)

    return {
        id: topic.id,
        position: topic.position,
        title: topic.title,
        view: view
            ? {
                  id: view.id,
                  title: view.title,
                  content: view.content,
                  displays: view.displays,
              }
            : null,
    }
}

const toExportPage = (page: NotebookPage, topics: Topic[], views: NotebookView[]): ExportPage => ({
    id: page.id,
    position: page.position,
    title: page.title,
    topics: topics
        .filter(topic => topic.pageId === page.id)
        .sort(byPosition)
        .map(topic => toExportTopic(topic, views)),
})

export const createExportDocument = ({ scope, selection, workspace }: ExportDocumentInput): ExportDocument | null => {
    const notebook = workspace.notebooks.find(item => item.id === selection.notebookId)
    if (!notebook) return null

    const notebookPages = workspace.pages.filter(page => page.notebookId === notebook.id).sort(byPosition)
    const pages = scope === "page" ? notebookPages.filter(page => page.id === selection.pageId) : notebookPages
    if (pages.length === 0) return null

    return {
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        slug: slugifyExportName(notebook.slug || notebook.title),
        scope,
        pages: pages.map(page => toExportPage(page, workspace.topics, workspace.views)),
    }
}
