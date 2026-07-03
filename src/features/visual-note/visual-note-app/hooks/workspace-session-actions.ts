import type { MutableRefObject } from "react"
import type { ToastTone } from "@/components/ui"
import { createEmptyWorkspace, normalizeWorkspace } from "@/lib/visual-note/factories"
import { loadVisualNoteWorkspaceState } from "@/lib/visual-note/workspace-api"
import { logoutVisualNoteUser } from "@/lib/visual-note/auth-api"
import type { SelectionState, VisualNoteWorkspace, VisualUser } from "@/lib/visual-note/types"
import { blankSelection, coerceSingleArticleViewPerTopic, ensureSelectionHasArticleView } from "@features/visual-note/visual-note-app/utils/visual-note-app.utils"
import type { AppAuthStatus } from "./restore-visual-note-session"
import type { WorkspaceRecoveryState } from "./use-visual-note-workspace-autosave"

type PushToast = (title: string, description?: string, tone?: ToastTone) => void

type OpenWorkspaceForUserOptions = {
    user: VisualUser
    initialNotebookId: string
    hasActiveSaveErrorRef: MutableRefObject<boolean>
    syncedWorkspaceRef: MutableRefObject<string>
    setAuthStatus: (status: AppAuthStatus) => void
    setNotice: (notice: string) => void
    setSelection: (selection: SelectionState) => void
    setUser: (user: VisualUser | null) => void
    setWorkspace: (workspace: VisualNoteWorkspace | null) => void
    setWorkspaceRecovery: (state: WorkspaceRecoveryState) => void
    setWorkspaceRevision: (revision: string | null) => void
    pushToast: PushToast
}

type SignOutOfWorkspaceOptions = {
    setAuthStatus: (status: AppAuthStatus) => void
    setNotice: (notice: string) => void
    setSelection: (selection: SelectionState) => void
    setUser: (user: VisualUser | null) => void
    setWorkspace: (workspace: VisualNoteWorkspace | null) => void
    setWorkspaceRecovery: (state: WorkspaceRecoveryState) => void
}

export const openWorkspaceForUser = async ({
    hasActiveSaveErrorRef,
    initialNotebookId,
    pushToast,
    setAuthStatus,
    setNotice,
    setSelection,
    setUser,
    setWorkspace,
    setWorkspaceRecovery,
    setWorkspaceRevision,
    syncedWorkspaceRef,
    user,
}: OpenWorkspaceForUserOptions) => {
    setAuthStatus("ready")
    setUser(user)
    try {
        const remote = await loadVisualNoteWorkspaceState()
        const nextWorkspace = coerceSingleArticleViewPerTopic(normalizeWorkspace(remote.workspace ?? createEmptyWorkspace()))
        const resolved = ensureSelectionHasArticleView(nextWorkspace, { ...blankSelection, notebookId: initialNotebookId })
        setWorkspaceRevision(remote.revision)
        setWorkspaceRecovery({ message: "", status: "synced" })
        syncedWorkspaceRef.current = JSON.stringify(resolved.workspace)
        setWorkspace(resolved.workspace)
        setSelection(resolved.selection)
        hasActiveSaveErrorRef.current = false
        setNotice("Workspace changes are saved to the Visual Note workspace store.")
        pushToast("Workspace opened", "Changes will save to the workspace database.", "info")
    } catch {
        const offlineMessage =
            typeof navigator !== "undefined" && !navigator.onLine
                ? "You appear to be offline. Workspace sync is paused until connection returns."
                : "Unable to open workspace. Please retry after signing in."

        hasActiveSaveErrorRef.current = false
        setWorkspace(null)
        setSelection(blankSelection)
        setWorkspaceRevision(null)
        setWorkspaceRecovery({ message: offlineMessage, status: offlineMessage.startsWith("You appear") ? "offline" : "error" })
        setNotice(offlineMessage)
        pushToast("Unable to open workspace", `${offlineMessage} Changes will not save yet.`, "error")
    }
}

export const signOutOfWorkspace = async ({ setAuthStatus, setNotice, setSelection, setUser, setWorkspace, setWorkspaceRecovery }: SignOutOfWorkspaceOptions) => {
    await logoutVisualNoteUser()
    setUser(null)
    setWorkspace(null)
    setSelection(blankSelection)
    setAuthStatus("ready")
    setNotice("")
    setWorkspaceRecovery({ message: "", status: "synced" })
}
