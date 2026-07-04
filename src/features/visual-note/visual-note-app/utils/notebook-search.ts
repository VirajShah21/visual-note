import type { NotebookSearchResult } from "@/lib/visual-note/search"
import type { SelectionState, VisualNoteWorkspace } from "@/lib/visual-note/types"
import { stringFrom } from "./visual-note-app.utils"

const normalize = (value: string) => value.trim().toLowerCase()

const createContext = (content: string, query: string) => {
    const normalizedContent = content.replace(/\s+/g, " ").trim()
    if (!normalizedContent) return "Article content"

    const matchIndex = normalizedContent.toLowerCase().indexOf(query)
    if (matchIndex < 0) return normalizedContent.slice(0, 130)

    const start = Math.max(0, matchIndex - 44)
    const end = Math.min(normalizedContent.length, matchIndex + query.length + 86)
    const prefix = start > 0 ? "... " : ""
    const suffix = end < normalizedContent.length ? " ..." : ""
    return `${prefix}${normalizedContent.slice(start, end)}${suffix}`
}

export const createNotebookSearchResults = (workspace: VisualNoteWorkspace, selection: SelectionState, query: string): NotebookSearchResult[] => {
    const normalizedQuery = normalize(query)
    if (!normalizedQuery) return []

    const pages = workspace.pages.filter(page => page.notebookId === selection.notebookId).sort((a, b) => a.position - b.position)
    const results = pages.flatMap(page => {
        const topics = workspace.topics.filter(topic => topic.pageId === page.id).sort((a, b) => a.position - b.position)
        return topics.flatMap(topic => {
            const views = workspace.views.filter(view => view.topicId === topic.id)
            return views
                .map(view => {
                    const content = stringFrom(view.content)
                    const searchable = normalize([page.title, topic.title, content].join(" "))
                    if (!searchable.includes(normalizedQuery)) return null

                    return {
                        id: `${page.id}-${topic.id}-${view.id}`,
                        pageId: page.id,
                        topicId: topic.id,
                        viewId: view.id,
                        title: topic.title,
                        context: createContext(content || page.title, normalizedQuery),
                        location: `${page.title} / ${topic.title}`,
                        isCurrentPage: page.id === selection.pageId,
                    }
                })
                .filter(result => result !== null)
        })
    })

    return results
        .sort((a, b) => {
            if (a.isCurrentPage !== b.isCurrentPage) return a.isCurrentPage ? -1 : 1
            return a.location.localeCompare(b.location)
        })
        .slice(0, 8)
}
