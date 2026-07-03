"use client"

import { useCallback, useState } from "react"
import { Button, Card, ExportWizard, Grid, NotebookEditorNavbar, NotebookHome, NotebookSettingsWorkspace, ScrollArea, Stack, Text, ToastShelf } from "@/components/ui"
import { defaultNotebookEditorSettings } from "@/lib/visual-note/types"
import type { VisualNoteAppProps } from "./types/visual-note-app.types"
import { AuthPanel } from "./components/auth-panel"
import { SectionSidebar } from "./components/section-sidebar"
import { ViewWorkspace } from "./components/view-workspace"
import { useVisualNoteAppController } from "./hooks/use-visual-note-app-controller"
import { useNotebookSearch } from "./hooks/use-notebook-search"
import { STORAGE_CONTENT_WARNING } from "@/lib/visual-note/storage-messages"
import styles from "../visual-note-app.module.css"

export function VisualNoteApp({ mode = "home", initialNotebookId = "" }: VisualNoteAppProps) {
    const { actions, authStatus, galleryItems, isLoading, notice, sections, selected, toastMessages, user, workspace, workspaceRecovery, workspaceRevision } =
        useVisualNoteAppController(initialNotebookId)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isExportOpen, setIsExportOpen] = useState(false)
    const [workspaceView, setWorkspaceView] = useState<"editor" | "settings">("editor")
    const { isSearching, loadMoreSearchResults, searchError, searchHasMore, searchQuery, searchResults, setSearchQuery } = useNotebookSearch({
        currentSelection: selected.currentSelection,
        workspace,
    })
    const editorSettings = selected.notebook?.editorSettings ?? defaultNotebookEditorSettings
    const appAuthReady = authStatus === "ready"
    const storageSetupMissing = workspaceRecovery.message.includes(STORAGE_CONTENT_WARNING)
    const showRecoveryBanner =
        workspaceRecovery.status === "offline" || workspaceRecovery.status === "conflict" || workspaceRecovery.status === "error" || workspaceRecovery.status === "warning"
    const recoveryActionLabel =
        workspaceRecovery.status === "conflict"
            ? "Reload remote workspace"
            : workspaceRecovery.status === "offline"
              ? "Retry when online"
              : storageSetupMissing
                ? "Open notebook settings"
                : "Retry save"
    const openExportDialog = useCallback(() => setIsExportOpen(true), [])
    const toggleSidebar = useCallback(() => setIsSidebarOpen(current => !current), [])
    const openSettings = useCallback(() => setWorkspaceView("settings"), [])
    const openEditor = useCallback(() => setWorkspaceView("editor"), [])
    const recoveryAction = storageSetupMissing ? openSettings : actions.retryWorkspaceRecovery

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
                                        <Text tone="strong">{workspaceRecovery.status === "conflict" ? "Workspace conflict detected" : "Workspace changes are not synced"}</Text>
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
