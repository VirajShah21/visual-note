"use client"

import { useCallback, useMemo, useState } from "react"
import { Card, Grid, MarkdownPreviewDialog, NotebookEditorNavbar, NotebookHome, ScrollArea, Stack, Text, ToastShelf } from "@/components/ui"
import { defaultNotebookEditorSettings } from "@/lib/visual-note/types"
import type { VisualNoteAppProps } from "./types/visual-note-app.types"
import { AuthPanel } from "./components/auth-panel"
import { SectionSidebar } from "./components/section-sidebar"
import { ViewWorkspace } from "./components/view-workspace"
import { useVisualNoteAppController } from "./hooks/use-visual-note-app-controller"
import { createNotebookSearchResults } from "./utils/notebook-search"
import { stringFrom } from "./utils/visual-note-app.utils"
import styles from "../visual-note-app.module.css"

export function VisualNoteApp({ mode = "home", initialNotebookId = "" }: VisualNoteAppProps) {
    const { actions, galleryItems, isLoading, notice, sections, selected, supabaseStatus, toastMessages, user, workspace } = useVisualNoteAppController(initialNotebookId)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isExportOpen, setIsExportOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const searchResults = useMemo(
        () => (workspace ? createNotebookSearchResults(workspace, selected.currentSelection, searchQuery) : []),
        [searchQuery, selected.currentSelection, workspace],
    )
    const markdownSource = selected.view ? stringFrom(selected.view.content) : ""
    const editorSettings = selected.notebook?.editorSettings ?? defaultNotebookEditorSettings
    const openExportDialog = useCallback(() => setIsExportOpen(true), [])
    const toggleSidebar = useCallback(() => setIsSidebarOpen(current => !current), [])

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
                <AuthPanel notice={notice} supabaseStatus={supabaseStatus} onSignIn={actions.signIn} onRegister={actions.register} />
                <ToastShelf messages={toastMessages} onDismiss={actions.dismissToast} />
            </>
        )

    if (mode === "home")
        return (
            <Stack className={styles.app}>
                <NotebookHome
                    userLabel={user.email}
                    storageLabel={supabaseStatus === "configured" ? "Supabase connected" : "Demo storage"}
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
                    sidebarOpen={isSidebarOpen}
                    editorSettings={editorSettings}
                    onExport={openExportDialog}
                    onHomeSelect={actions.openHome}
                    onNotebookSelect={actions.selectNotebook}
                    onSearchChange={setSearchQuery}
                    onSearchResultSelect={actions.selectSearchResult}
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
                            onSelectSection={actions.selectSection}
                            onSelectTopic={actions.selectTopic}
                        />
                    ) : null}
                    <ScrollArea className={styles.content}>
                        <ViewWorkspace view={selected.view} editorSettings={editorSettings} onUpdateView={actions.updateView} onUpdateDisplay={actions.updateDisplay} />
                    </ScrollArea>
                </Grid>
            </Grid>
            <MarkdownPreviewDialog markdown={markdownSource} open={isExportOpen} onOpenChange={setIsExportOpen} />
            <ToastShelf messages={toastMessages} onDismiss={actions.dismissToast} />
        </Stack>
    )
}
