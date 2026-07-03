"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button, Card, ExportWizard, Grid, NotebookEditorNavbar, NotebookHome, NotebookSettingsWorkspace, ScrollArea, Stack, Text, ToastShelf } from "@/components/ui"
import { defaultNotebookEditorSettings } from "@/lib/visual-note/types"
import { searchNotebook } from "@/lib/visual-note/search-api"
import type { NotebookSearchResult } from "@/lib/visual-note/search"
import type { VisualNoteAppProps } from "./types/visual-note-app.types"
import { AuthPanel } from "./components/auth-panel"
import { SectionSidebar } from "./components/section-sidebar"
import { ViewWorkspace } from "./components/view-workspace"
import { useVisualNoteAppController } from "./hooks/use-visual-note-app-controller"
import { createNotebookSearchResults } from "./utils/notebook-search"
import { STORAGE_CONTENT_WARNING } from "@/lib/visual-note/storage-messages"
import styles from "../visual-note-app.module.css"

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

const SEARCH_CACHE_TTL_MS = 30_000
const SEARCH_CACHE_MAX_ENTRIES = 64

const pruneSearchCache = (cache: Map<string, SearchCacheEntry>) => {
    for (const key of cache.keys()) {
        if (cache.size <= SEARCH_CACHE_MAX_ENTRIES) break
        cache.delete(key)
    }
}

export function VisualNoteApp({ mode = "home", initialNotebookId = "" }: VisualNoteAppProps) {
    const { actions, authStatus, galleryItems, isLoading, notice, sections, selected, toastMessages, user, workspace, workspaceRecovery } =
        useVisualNoteAppController(initialNotebookId)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isExportOpen, setIsExportOpen] = useState(false)
    const [workspaceView, setWorkspaceView] = useState<"editor" | "settings">("editor")
    const [searchQuery, setSearchQuery] = useState("")
    const [remoteSearch, setRemoteSearch] = useState<RemoteSearchState | null>(null)
    const searchCache = useRef(new Map<string, SearchCacheEntry>())
    const [isSearching, setIsSearching] = useState(false)
    const [searchError, setSearchError] = useState(false)
    const searchQueryTrimmed = searchQuery.trim()
    const searchKey = `${selected.currentSelection.notebookId}:${selected.currentSelection.pageId}:${searchQueryTrimmed}`
    const searchResults = remoteSearch?.key === searchKey ? remoteSearch.results : []
    const searchHasMore = remoteSearch?.key === searchKey ? remoteSearch.hasMore : false
    const editorSettings = selected.notebook?.editorSettings ?? defaultNotebookEditorSettings
    const appAuthReady = authStatus === "ready"
    const storageSetupMissing = workspaceRecovery.message.includes(STORAGE_CONTENT_WARNING)
    const showRecoveryBanner =
        workspaceRecovery.status === "offline" || workspaceRecovery.status === "conflict" || workspaceRecovery.status === "error" || workspaceRecovery.status === "warning"
    const recoveryActionLabel = workspaceRecovery.status === "conflict"
        ? "Reload remote workspace"
        : workspaceRecovery.status === "offline"
          ? "Retry when online"
          : storageSetupMissing
            ? "Open notebook settings"
            : "Retry save"
    const recoveryAction = storageSetupMissing ? openSettings : actions.retryWorkspaceRecovery
    const openExportDialog = useCallback(() => setIsExportOpen(true), [])
    const toggleSidebar = useCallback(() => setIsSidebarOpen(current => !current), [])
    const openSettings = useCallback(() => setWorkspaceView("settings"), [])
    const openEditor = useCallback(() => setWorkspaceView("editor"), [])

    const runSearch = useCallback(
        async (append: boolean, signal: AbortSignal) => {
            const query = searchQueryTrimmed
            const notebookId = selected.currentSelection.notebookId
            if (!query || !notebookId) return

            const currentPageId = selected.currentSelection.pageId
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
                    currentPageId,
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

                        return {
                            key: searchKey,
                            results: response.results,
                            hasMore: response.hasMore,
                        }
                    }

                    const next: RemoteSearchState = {
                        key: searchKey,
                        results: [...previous.results, ...response.results],
                        hasMore: response.hasMore,
                    }
                    searchCache.current.set(cacheKey, {
                        key: searchKey,
                        results: next.results,
                        hasMore: next.hasMore,
                        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
                    })
                    pruneSearchCache(searchCache.current)

                    return {
                        key: next.key,
                        results: next.results,
                        hasMore: next.hasMore,
                    }
                })
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") return

                const fallbackResults = workspace ? createNotebookSearchResults(workspace, selected.currentSelection, query) : []
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
                if (append && remoteSearch?.key === searchKey) {
                    setRemoteSearch(previous =>
                        previous?.key === searchKey ? { ...previous, hasMore: false } : previous ?? { key: searchKey, results: [], hasMore: false },
                    )
                } else {
                    setRemoteSearch({ key: searchKey, results: [], hasMore: false })
                }
            } finally {
                if (!signal.aborted) setIsSearching(false)
            }
        },
        [searchKey, searchQueryTrimmed, remoteSearch?.key, remoteSearch?.results.length, selected.currentSelection, selected.currentSelection.notebookId, selected.currentSelection.pageId, workspace],
    )

    useEffect(() => {
        const notebookId = selected.currentSelection.notebookId
        if (!searchQueryTrimmed || !notebookId) {
            setRemoteSearch(null)
            setSearchError(false)
            return
        }

        if (remoteSearch?.key !== searchKey) {
            setRemoteSearch(null)
            setSearchError(false)
        }

        const controller = new AbortController()
        const timeout = window.setTimeout(() => {
            void runSearch(false, controller.signal)
        }, 180)

        return () => {
            window.clearTimeout(timeout)
            controller.abort()
        }
    }, [runSearch, searchKey, searchQueryTrimmed, selected.currentSelection.notebookId, remoteSearch?.key])

    const loadMoreSearchResults = useCallback(() => {
        if (!searchHasMore || isSearching) return

        const controller = new AbortController()
        void runSearch(true, controller.signal)
    }, [isSearching, runSearch, searchHasMore])
    const selectSection = useCallback(
        (sectionId: string) => {
            setWorkspaceView("editor")
            actions.selectSection(sectionId)
        },
        [actions],
    )
    const selectTopic = useCallback(
        (topicId: string) => {
            setWorkspaceView("editor")
            actions.selectTopic(topicId)
        },
        [actions],
    )
    const selectNotebook = useCallback(
        (notebookId: string) => {
            setWorkspaceView("editor")
            actions.selectNotebook(notebookId)
        },
        [actions],
    )
    const selectSearchResult = useCallback(
        (result: (typeof searchResults)[number]) => {
            setWorkspaceView("editor")
            actions.selectSearchResult(result)
        },
        [actions],
    )

    if (isLoading)
        return (
            <Stack className={styles.app} gap="lg">
                <Card>
                    <Text>Loading Visual Note...</Text>
                </Card>
            </Stack>
        )

    if (!user || !workspace)
        return (
            <>
                <AuthPanel authStatus={authStatus} notice={notice} onSignIn={actions.signIn} onRegister={actions.register} />
                <ToastShelf messages={toastMessages} onDismiss={actions.dismissToast} />
            </>
        )

    if (mode === "home")
        return (
            <Stack className={styles.app}>
                <NotebookHome
                    mcpTokensEnabled={appAuthReady}
                    userLabel={user.email}
                    storageLabel="Database storage"
                    notebooks={galleryItems}
                    onCreateNotebook={actions.createNotebookAndOpen}
                    onSignOut={actions.signOut}
                />
                <ToastShelf messages={toastMessages} onDismiss={actions.dismissToast} />
            </Stack>
        )

    return (
        <Stack className={styles.app} gap="none">
            <Grid className={styles.workspace} gap="none">
                <NotebookEditorNavbar
                    currentNotebookId={selected.currentSelection.notebookId}
                    notebookTitle={selected.notebook?.title}
                    recentNotebooks={galleryItems}
                    searchQuery={searchQuery}
                    searchResults={searchResults}
                    searchHasMore={searchHasMore}
                    searchLoading={isSearching}
                    searchError={searchError}
                    sidebarOpen={isSidebarOpen}
                    editorSettings={editorSettings}
                    onExport={openExportDialog}
                    onHomeSelect={actions.openHome}
                    onNotebookSelect={selectNotebook}
                    onSearchChange={setSearchQuery}
                    onSearchLoadMore={loadMoreSearchResults}
                    onSearchResultSelect={selectSearchResult}
                    onMoreSettings={openSettings}
                    onSettingsChange={actions.updateNotebookEditorSettings}
                    onToggleSidebar={toggleSidebar}
                />
                <Grid
                    className={`${styles.contentGrid} ${isSidebarOpen ? "" : styles.contentGridSidebarClosed}`}
                    gap="none"
                    style={isSidebarOpen ? { gridTemplateColumns: "280px minmax(0, 1fr)" } : undefined}
                >
                    {isSidebarOpen ? (
                        <SectionSidebar
                            sections={sections}
                            topics={workspace.topics}
                            activeSectionId={selected.currentSelection.pageId}
                            activeTopicId={selected.currentSelection.topicId}
                            onCreateSection={actions.addSection}
                            onRenameSection={actions.renameSection}
                            onDeleteSection={actions.deleteSection}
                            onCreateTopic={actions.addTopic}
                            onRenameTopic={actions.renameTopic}
                            onDeleteTopic={actions.deleteTopic}
                            onSelectSection={selectSection}
                            onSelectTopic={selectTopic}
                        />
                    ) : null}
                    <ScrollArea className={styles.content}>
                        {showRecoveryBanner ? (
                            <Card className={styles.recoveryBanner} padding="compact" role="status">
                                <Stack direction="horizontal" gap="md" className={styles.recoveryBannerContent}>
                                    <Stack gap="xs">
                                        <Text tone="strong">
                                            {workspaceRecovery.status === "conflict" ? "Workspace conflict detected" : "Workspace changes are not synced"}
                                        </Text>
                                        <Text size="small">{workspaceRecovery.message}</Text>
                                    </Stack>
                                    <Button variant="secondary" onClick={recoveryAction}>
                                        {recoveryActionLabel}
                                    </Button>
                                </Stack>
                            </Card>
                        ) : null}
                        {workspaceView === "settings" ? (
                            <NotebookSettingsWorkspace
                                notebookId={selected.currentSelection.notebookId}
                                notebookTitle={selected.notebook?.title ?? "Notebook"}
                                notebookPublished={selected.notebook?.published === true}
                                notebookPublishedAt={selected.notebook?.publishedAt}
                                notebookRevision={workspaceRevision}
                                storageEnabled={appAuthReady}
                                onPublish={actions.publishNotebook}
                                onDone={openEditor}
                            />
                        ) : (
                            <ViewWorkspace
                                view={selected.view}
                                editorSettings={editorSettings}
                                onUpdateView={actions.updateView}
                                onUpdateDisplay={actions.updateDisplay}
                                onUploadImage={appAuthReady ? actions.uploadImage : undefined}
                            />
                        )}
                    </ScrollArea>
                </Grid>
            </Grid>
            <ExportWizard open={isExportOpen} selection={selected.currentSelection} workspace={workspace} onOpenChange={setIsExportOpen} />
            <ToastShelf messages={toastMessages} onDismiss={actions.dismissToast} />
        </Stack>
    )
}
