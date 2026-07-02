import type { NotebookSearchResponse } from "./search"

const parseError = async (response: Response, fallback: string) => {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return body?.error ?? fallback
}

export const searchNotebook = async (
    notebookId: string,
    input: {
        currentPageId?: string
        limit?: number
        offset?: number
        query: string
        signal?: AbortSignal
    },
): Promise<NotebookSearchResponse> => {
    const params = new URLSearchParams({
        q: input.query,
        limit: String(input.limit ?? 8),
        offset: String(input.offset ?? 0),
    })
    if (input.currentPageId) params.set("currentPageId", input.currentPageId)

    const response = await fetch(`/api/notebooks/${encodeURIComponent(notebookId)}/search?${params.toString()}`, { signal: input.signal })
    if (!response.ok) throw new Error(await parseError(response, "Unable to search notebook."))

    return (await response.json()) as NotebookSearchResponse
}
