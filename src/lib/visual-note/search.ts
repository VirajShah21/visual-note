export type NotebookSearchResult = {
    id: string
    pageId: string
    topicId: string
    viewId: string
    title: string
    context: string
    location: string
    isCurrentPage: boolean
}

export type NotebookSearchResponse = {
    query: string
    limit: number
    offset: number
    hasMore: boolean
    results: NotebookSearchResult[]
}
