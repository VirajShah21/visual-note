"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { NotebookSearchResult } from "@/lib/visual-note/search"
import { searchNotebook } from "@/lib/visual-note/search-api"
import type { SelectionState, VisualNoteWorkspace } from "@/lib/visual-note/types"
import { createNotebookSearchResults } from "@features/visual-note/visual-note-app/utils/notebook-search"

type RemoteSearchState = {
    key: string
    results: NotebookSearchResult[]
    hasMore: boolean
}

type SearchCacheEntry = {
    key: string
    results: NotebookSearchResult[]
    hasMore: boolean
    expiresAt: number
}

type NotebookSearchConfig = {
    currentSelection: SelectionState
    workspace: VisualNoteWorkspace | null
}

const SEARCH_CACHE_TTL_MS = 30_000
const SEARCH_CACHE_MAX_ENTRIES = 64

const pruneSearchCache = (cache: Map<string, SearchCacheEntry>) => {
    for (const key of cache.keys()) {
        if (cache.size <= SEARCH_CACHE_MAX_ENTRIES) break
        cache.delete(key)
    }
}

export const useNotebookSearch = ({ currentSelection, workspace }: NotebookSearchConfig) => {
    const [searchQuery, setSearchQuery] = useState("")
    const [remoteSearch, setRemoteSearch] = useState<RemoteSearchState | null>(null)
    const searchCache = useRef(new Map<string, SearchCacheEntry>())
    const [isSearching, setIsSearching] = useState(false)
    const [searchError, setSearchError] = useState(false)
    const searchQueryTrimmed = searchQuery.trim()
    const searchKey = `${currentSelection.notebookId}:${currentSelection.pageId}:${searchQueryTrimmed}`
    const searchResults = remoteSearch?.key === searchKey ? remoteSearch.results : []
    const searchHasMore = remoteSearch?.key === searchKey ? remoteSearch.hasMore : false

    const runSearch = useCallback(
        async (append: boolean, signal: AbortSignal) => {
            const query = searchQueryTrimmed
            const notebookId = currentSelection.notebookId
            if (!query || !notebookId) return

            const offset = append && remoteSearch?.key === searchKey ? remoteSearch.results.length : 0
            const cacheKey = `remote:${searchKey}:${offset}`
            const cacheEntry = searchCache.current.get(cacheKey)
            const now = Date.now()
            if (cacheEntry && cacheEntry.expiresAt > now) {
                setRemoteSearch({ key: cacheEntry.key, results: cacheEntry.results, hasMore: cacheEntry.hasMore })
                setSearchError(false)
                setIsSearching(false)
                return
            }
            setIsSearching(true)
            setSearchError(false)

            try {
                const response = await searchNotebook(notebookId, {
                    currentPageId: currentSelection.pageId,
                    limit: 8,
                    offset,
                    query,
                    signal,
                })

                if (signal.aborted) return

                setRemoteSearch(previous => {
                    if (!append || previous?.key !== searchKey) {
                        const cached = {
                            key: searchKey,
                            results: response.results,
                            hasMore: response.hasMore,
                        }
                        searchCache.current.set(cacheKey, {
                            ...cached,
                            expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
                        })
                        pruneSearchCache(searchCache.current)

                        return cached
                    }

                    const next: RemoteSearchState = {
                        key: searchKey,
                        results: [...previous.results, ...response.results],
                        hasMore: response.hasMore,
                    }
                    searchCache.current.set(cacheKey, {
                        ...next,
                        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
                    })
                    pruneSearchCache(searchCache.current)

                    return next
                })
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") return

                const fallbackResults = workspace ? createNotebookSearchResults(workspace, currentSelection, query) : []
                if (!append && fallbackResults.length > 0) {
                    setRemoteSearch({
                        key: searchKey,
                        results: fallbackResults,
                        hasMore: false,
                    })
                    setSearchError(false)
                    return
                }

                setSearchError(true)
                if (append && remoteSearch?.key === searchKey)
                    setRemoteSearch(previous => (previous?.key === searchKey ? { ...previous, hasMore: false } : (previous ?? { key: searchKey, results: [], hasMore: false })))
                else setRemoteSearch({ key: searchKey, results: [], hasMore: false })
            } finally {
                if (!signal.aborted) setIsSearching(false)
            }
        },
        [currentSelection, remoteSearch, searchKey, searchQueryTrimmed, workspace],
    )

    useEffect(() => {
        const notebookId = currentSelection.notebookId
        const controller = new AbortController()
        const timeout = window.setTimeout(
            () => {
                if (!searchQueryTrimmed || !notebookId) {
                    setRemoteSearch(null)
                    setSearchError(false)
                    return
                }

                if (remoteSearch?.key !== searchKey) {
                    setRemoteSearch(null)
                    setSearchError(false)
                }

                void runSearch(false, controller.signal)
            },
            searchQueryTrimmed && notebookId ? 180 : 0,
        )

        return () => {
            window.clearTimeout(timeout)
            controller.abort()
        }
    }, [currentSelection, remoteSearch?.key, runSearch, searchKey, searchQueryTrimmed])

    const loadMoreSearchResults = useCallback(() => {
        if (!searchHasMore || isSearching) return

        const controller = new AbortController()
        void runSearch(true, controller.signal)
    }, [isSearching, runSearch, searchHasMore])

    return {
        isSearching,
        loadMoreSearchResults,
        searchError,
        searchHasMore,
        searchQuery,
        searchResults,
        setSearchQuery,
    }
}
