"use client"

import { Card, Grid, NotebookHome, ScrollArea, Stack, Text, ToastShelf } from "@/components/ui"
import type { VisualNoteAppProps } from "./types/visual-note-app.types"
import { AuthPanel } from "./components/auth-panel"
import { SectionSidebar } from "./components/section-sidebar"
import { ViewWorkspace } from "./components/view-workspace"
import { useVisualNoteAppController } from "./hooks/use-visual-note-app-controller"
import styles from "../visual-note-app.module.css"

export function VisualNoteApp({ mode = "home", initialNotebookId = "" }: VisualNoteAppProps) {
    const { actions, galleryItems, isLoading, notice, sections, selected, supabaseStatus, toastMessages, user, workspace } = useVisualNoteAppController(initialNotebookId)

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
        <Stack className={styles.app}>
            <Grid className={styles.workspace}>
                <Grid className={styles.contentGrid} gap="none">
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
                    <ScrollArea className={styles.content}>
                        <ViewWorkspace view={selected.view} onUpdateView={actions.updateView} onUpdateDisplay={actions.updateDisplay} />
                    </ScrollArea>
                </Grid>
            </Grid>
            <ToastShelf messages={toastMessages} onDismiss={actions.dismissToast} />
        </Stack>
    )
}
