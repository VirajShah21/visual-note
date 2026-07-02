import type { MutableRefObject } from "react"
import type { ToastTone } from "@/components/ui"
import { saveVisualNoteWorkspace } from "@/lib/visual-note/workspace-api"
import type { VisualNoteWorkspace, VisualUser } from "@/lib/visual-note/types"
import { workspaceRecoveryStateForError, type WorkspaceRecoveryState } from "./use-visual-note-workspace-autosave"

type PushToast = (title: string, description?: string, tone?: ToastTone) => void

type RetryWorkspaceRecoveryOptions = {
    user: VisualUser | null
    workspace: VisualNoteWorkspace | null
    workspaceRecovery: WorkspaceRecoveryState
    workspaceRevision: string | null
    hasActiveSaveErrorRef: MutableRefObject<boolean>
    syncedWorkspaceRef: MutableRefObject<string>
    setNotice: (notice: string) => void
    setWorkspaceRevision: (revision: string | null) => void
    setWorkspaceRecovery: (state: WorkspaceRecoveryState) => void
    pushToast: PushToast
    openWorkspaceForUser: (user: VisualUser) => Promise<void>
}

export const retryWorkspaceRecovery = async ({
    hasActiveSaveErrorRef,
    openWorkspaceForUser,
    pushToast,
    setNotice,
    setWorkspaceRecovery,
    setWorkspaceRevision,
    syncedWorkspaceRef,
    user,
    workspace,
    workspaceRecovery,
    workspaceRevision,
}: RetryWorkspaceRecoveryOptions) => {
    if (!user) return
    if (workspaceRecovery.status === "conflict") {
        await openWorkspaceForUser(user)
        return
    }
    if (!workspace) return

    setWorkspaceRecovery({ message: "Retrying remote workspace save.", status: "saving" })
    try {
        const serializedWorkspace = JSON.stringify(workspace)
        const response = await saveVisualNoteWorkspace(workspace, { revision: workspaceRevision })
        syncedWorkspaceRef.current = serializedWorkspace
        setWorkspaceRevision(response.revision)
        hasActiveSaveErrorRef.current = false
        setWorkspaceRecovery({ message: "", status: "synced" })
        setNotice("Workspace changes are saved to the Visual Note workspace store.")
        pushToast("Workspace saved", "Remote workspace saves have recovered.", "info")
    } catch (error) {
        const recovery = workspaceRecoveryStateForError(error)
        hasActiveSaveErrorRef.current = true
        setWorkspaceRecovery(recovery)
        setNotice(recovery.message)
        pushToast("Workspace save failed", recovery.message, "error")
    }
}
