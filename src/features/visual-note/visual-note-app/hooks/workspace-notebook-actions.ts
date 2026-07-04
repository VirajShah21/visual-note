import type { MutableRefObject } from "react"
import type { ToastTone } from "@/components/ui"
import { createNotebook, createPage, createTopic, createView } from "@/lib/visual-note/factories"
import { STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT } from "@/lib/visual-note/storage-messages"
import type { SelectionState, VisualNoteWorkspace, VisualUser } from "@/lib/visual-note/types"
import { saveVisualNoteWorkspace } from "@/lib/visual-note/workspace-api"
import { workspaceRecoveryStateForError, type WorkspaceRecoveryState } from "./use-visual-note-workspace-autosave"

type PushToast = (title: string, description?: string, tone?: ToastTone) => void

type CreateNotebookAndOpenOptions = {
    title: string
    user: VisualUser | null
    workspace: VisualNoteWorkspace | null
    workspaceRevision: string | null
    hasActiveSaveErrorRef: MutableRefObject<boolean>
    syncedWorkspaceRef: MutableRefObject<string>
    setNotice: (notice: string) => void
    setSelection: (selection: SelectionState) => void
    setWorkspace: (workspace: VisualNoteWorkspace) => void
    setWorkspaceRecovery: (state: WorkspaceRecoveryState) => void
    setWorkspaceRevision: (revision: string | null) => void
    pushToast: PushToast
    openNotebook: (notebookId: string) => void
}

const createNotebookWorkspace = (user: VisualUser, workspace: VisualNoteWorkspace, title: string) => {
    const notebook = createNotebook(user.id, title)
    const page = createPage(notebook.id, "Home", 0)
    const topic = createTopic(page.id, "Start", 0)
    const view = createView(topic.id, "Welcome")

    return {
        notebook,
        selection: { notebookId: notebook.id, pageId: page.id, topicId: topic.id, viewId: view.id },
        workspace: {
            ...workspace,
            notebooks: [...workspace.notebooks, notebook],
            pages: [...workspace.pages, page],
            topics: [...workspace.topics, topic],
            views: [...workspace.views, view],
        },
    }
}

export const createNotebookAndOpen = async ({
    hasActiveSaveErrorRef,
    openNotebook,
    pushToast,
    setNotice,
    setSelection,
    setWorkspace,
    setWorkspaceRecovery,
    setWorkspaceRevision,
    syncedWorkspaceRef,
    title,
    user,
    workspace,
    workspaceRevision,
}: CreateNotebookAndOpenOptions) => {
    const trimmedTitle = title.trim()
    if (!user || !workspace || !trimmedTitle) {
        pushToast("Notebook title required", "Add a title before creating a notebook.", "error")
        return false
    }

    const trimmedRevision = workspaceRevision?.trim()
    if (!trimmedRevision) {
        const message = "Workspace revision is missing. Reload the workspace before creating a notebook."
        hasActiveSaveErrorRef.current = true
        setWorkspaceRecovery({ message, status: "error" })
        setNotice(message)
        pushToast("Notebook create blocked", message, "error")
        return false
    }

    const created = createNotebookWorkspace(user, workspace, trimmedTitle)
    setWorkspaceRecovery({ message: "Creating notebook in the remote workspace.", status: "saving" })

    try {
        const serializedWorkspace = JSON.stringify(created.workspace)
        const baseWorkspace = syncedWorkspaceRef.current ? (JSON.parse(syncedWorkspaceRef.current) as VisualNoteWorkspace) : null
        const response = await saveVisualNoteWorkspace(created.workspace, { baseWorkspace, revision: trimmedRevision })
        syncedWorkspaceRef.current = serializedWorkspace
        setWorkspaceRevision(response.revision)
        setWorkspace(created.workspace)
        setSelection(created.selection)
        hasActiveSaveErrorRef.current = false

        if (response.warnings.length > 0) {
            const message = response.warnings.find(item => item.includes(STORAGE_CONTENT_WARNING))
                ? STORAGE_SETUP_HINT
                : (response.warnings[0] ?? "Notebook created with warnings.")
            setWorkspaceRecovery({ message, status: "warning" })
            setNotice(message)
            pushToast("Notebook created with warnings", message, "error")
        } else {
            setWorkspaceRecovery({ message: "", status: "synced" })
            pushToast("Notebook created", `${trimmedTitle} is ready with a starter section, topic, and view.`)
        }

        openNotebook(created.notebook.id)
        return true
    } catch (error) {
        const recovery = workspaceRecoveryStateForError(error)
        hasActiveSaveErrorRef.current = true
        setWorkspaceRecovery(recovery)
        setNotice(recovery.message)
        pushToast("Notebook create failed", recovery.message, "error")
        return false
    }
}
