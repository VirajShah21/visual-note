import type { SupabaseClient } from "@supabase/supabase-js"
import type { NotebookSearchResponse, NotebookSearchResult } from "@/lib/visual-note/search"
import type { NotebookView, Topic } from "@/lib/visual-note/types"
import { listPagesByNotebook, type PageRow } from "@/server/visual-note/page-store"

type SearchNotebookInput = {
    currentPageId?: string
    limit?: number
    offset?: number
    query: string
}

const maxSearchLimit = 25

const normalize = (value: string) => value.trim().toLowerCase()

const stringFrom = (value: unknown) => (typeof value === "string" ? value : "")

const clampLimit = (value: number | undefined) => Math.min(maxSearchLimit, Math.max(1, Number.isFinite(value) ? Math.trunc(value ?? 8) : 8))

const clampOffset = (value: number | undefined) => Math.max(0, Number.isFinite(value) ? Math.trunc(value ?? 0) : 0)

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

const createResultsFromRows = (pageRows: PageRow[], input: SearchNotebookInput): NotebookSearchResult[] => {
    const normalizedQuery = normalize(input.query)
    if (!normalizedQuery) return []

    return pageRows.flatMap(page => {
        const topics = [...page.topics].sort((first, second) => first.position - second.position)
        return topics.flatMap((topic: Topic) => {
            const views = page.views.filter((view: NotebookView) => view.topicId === topic.id)
            return views
                .map(view => {
                    const content = stringFrom(view.content)
                    const searchable = normalize([page.title, topic.title, view.title, content].join(" "))
                    if (!searchable.includes(normalizedQuery)) return null

                    return {
                        id: `${page.id}-${topic.id}-${view.id}`,
                        pageId: page.id,
                        topicId: topic.id,
                        viewId: view.id,
                        title: topic.title,
                        context: createContext(content || view.title || page.title, normalizedQuery),
                        location: `${page.title} / ${topic.title}`,
                        isCurrentPage: page.id === input.currentPageId,
                    }
                })
                .filter(result => result !== null)
        })
    })
}

export const createNotebookSearchResponse = (pageRows: PageRow[], input: SearchNotebookInput): NotebookSearchResponse => {
    const limit = clampLimit(input.limit)
    const offset = clampOffset(input.offset)
    const results = createResultsFromRows(pageRows, input).sort((first, second) => {
        if (first.isCurrentPage !== second.isCurrentPage) return first.isCurrentPage ? -1 : 1
        return first.location.localeCompare(second.location)
    })
    const windowed = results.slice(offset, offset + limit)

    return {
        query: input.query,
        limit,
        offset,
        hasMore: offset + limit < results.length,
        results: windowed,
    }
}

export const searchNotebookForUser = async (supabase: SupabaseClient, userId: string, notebookId: string, input: SearchNotebookInput) => {
    const pages = await listPagesByNotebook(supabase, userId, notebookId)
    return createNotebookSearchResponse(pages, input)
}
