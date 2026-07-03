import { useEffect, useRef, type MutableRefObject } from "react"
import { saveVisualNoteWorkspace } from "@/lib/visual-note/workspace-api"
import type { SaveVisualNoteWorkspaceError } from "@/lib/visual-note/workspace-api"
import type { ToastTone } from "@/components/ui"
import type { VisualNoteWorkspace, VisualUser } from "@/lib/visual-note/types"

type UseVisualNoteWorkspaceAutosaveOptions = {
    user: VisualUser | null
    workspace: VisualNoteWorkspace | null
    setNotice: (notice: string) => void
    pushToast: (title: string, description?: string, tone?: ToastTone) => void
    hasActiveSaveErrorRef: MutableRefObject<boolean>
    setWorkspaceRevision: (revision: string | null) => void
    workspaceRevision: string | null
    syncedWorkspaceRef: MutableRefObject<string>
    setWorkspaceRecovery: (state: WorkspaceRecoveryState) => void
    workspaceRecovery: WorkspaceRecoveryState
    retryWorkspaceRecovery: () => void
    saveDelayMs?: number
}

export type WorkspaceRecoveryState = {
    message: string
    status: "synced" | "saving" | "offline" | "conflict" | "error"
}

export const workspaceRecoveryStateForError = (error: unknown): WorkspaceRecoveryState => {
    const status = (error as SaveVisualNoteWorkspaceError | null)?.status
    if (status === 409)
        return {
            message: "Workspace was updated in another session. Reload to keep changes in sync.",
            status: "conflict",
        }

    if (typeof navigator !== "undefined" && !navigator.onLine)
        return {
            message: "You appear to be offline. Changes will retry when connectivity returns.",
            status: "offline",
        }

    return {
        message: error instanceof Error ? error.message : "Unable to save workspace.",
        status: "error",
    }
}

export const useVisualNoteWorkspaceAutosave = ({
    user,
    workspace,
    setNotice,
    pushToast,
    hasActiveSaveErrorRef,
    setWorkspaceRevision,
    workspaceRevision,
    syncedWorkspaceRef,
    setWorkspaceRecovery,
    workspaceRecovery,
    retryWorkspaceRecovery,
    saveDelayMs = 500,
}: UseVisualNoteWorkspaceAutosaveOptions) => {
    const saveRequestIdRef = useRef(0)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saveAbortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        if (!user || !workspace) return

        const serializedWorkspace = JSON.stringify(workspace)
        if (serializedWorkspace === syncedWorkspaceRef.current) return
        const baseWorkspace = syncedWorkspaceRef.current ? (JSON.parse(syncedWorkspaceRef.current) as VisualNoteWorkspace) : null

        const requestId = saveRequestIdRef.current + 1
        saveRequestIdRef.current = requestId
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

        if (saveAbortRef.current) saveAbortRef.current.abort()

        const abortController = new AbortController()
        saveAbortRef.current = abortController
        setWorkspaceRecovery({ message: "Workspace changes are waiting for remote save.", status: "saving" })

        saveTimeoutRef.current = setTimeout(() => {
            void saveVisualNoteWorkspace(workspace, {
                baseWorkspace,
                signal: abortController.signal,
                revision: workspaceRevision,
            })
                .then(response => {
                    if (saveRequestIdRef.current !== requestId) return
                    syncedWorkspaceRef.current = serializedWorkspace
                    setWorkspaceRevision(response.revision)
                    setWorkspaceRecovery({ message: "", status: "synced" })
                    if (!hasActiveSaveErrorRef.current) return

                    hasActiveSaveErrorRef.current = false
                    setNotice("Workspace changes are saved to the Visual Note workspace store.")
                    pushToast("Workspace saved", "Remote workspace saves have recovered.", "info")
                })
                .catch(error => {
                    if (saveRequestIdRef.current !== requestId) return
                    if (error instanceof Error && error.name === "AbortError") return

                    const recovery = workspaceRecoveryStateForError(error)

                    hasActiveSaveErrorRef.current = true
                    setWorkspaceRecovery(recovery)
                    setNotice(recovery.message)
                    pushToast("Workspace save failed", recovery.message, "error")
                })
        }, saveDelayMs)

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
            if (saveAbortRef.current) saveAbortRef.current.abort()
        }
    }, [hasActiveSaveErrorRef, pushToast, saveDelayMs, setNotice, setWorkspaceRecovery, setWorkspaceRevision, syncedWorkspaceRef, user, workspace, workspaceRevision])

    useEffect(() => {
        if (typeof window === "undefined") return
        if (workspaceRecovery.status !== "offline" && workspaceRecovery.status !== "error") return

        const onOnline = () => {
            void retryWorkspaceRecovery()
        }

        window.addEventListener("online", onOnline)
        return () => window.removeEventListener("online", onOnline)
    }, [retryWorkspaceRecovery, workspaceRecovery.status])
}
