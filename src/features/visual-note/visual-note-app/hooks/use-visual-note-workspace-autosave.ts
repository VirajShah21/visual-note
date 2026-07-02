import { useEffect, useRef, type MutableRefObject } from "react"
import { saveVisualNoteWorkspace } from "@/lib/visual-note/workspace-api"
import type { ToastTone } from "@/components/ui"
import type { VisualNoteWorkspace, VisualUser } from "@/lib/visual-note/types"

type UseVisualNoteWorkspaceAutosaveOptions = {
    user: VisualUser | null
    workspace: VisualNoteWorkspace | null
    setNotice: (notice: string) => void
    pushToast: (title: string, description?: string, tone?: ToastTone) => void
    hasActiveSaveErrorRef: MutableRefObject<boolean>
    syncedWorkspaceRef: MutableRefObject<string>
    saveDelayMs?: number
}

export const useVisualNoteWorkspaceAutosave = ({
    user,
    workspace,
    setNotice,
    pushToast,
    hasActiveSaveErrorRef,
    syncedWorkspaceRef,
    saveDelayMs = 500,
}: UseVisualNoteWorkspaceAutosaveOptions) => {
    const saveRequestIdRef = useRef(0)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saveAbortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        if (!user || !workspace) return

        const serializedWorkspace = JSON.stringify(workspace)
        if (serializedWorkspace === syncedWorkspaceRef.current) return

        const requestId = saveRequestIdRef.current + 1
        saveRequestIdRef.current = requestId
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

        if (saveAbortRef.current) saveAbortRef.current.abort()

        const abortController = new AbortController()
        saveAbortRef.current = abortController

        saveTimeoutRef.current = setTimeout(() => {
            void saveVisualNoteWorkspace(workspace, { signal: abortController.signal })
                .then(() => {
                    if (saveRequestIdRef.current !== requestId) return
                    syncedWorkspaceRef.current = serializedWorkspace
                    if (!hasActiveSaveErrorRef.current) return

                    hasActiveSaveErrorRef.current = false
                    setNotice("Workspace changes are saved to the Visual Note workspace store.")
                    pushToast("Workspace saved", "Remote workspace saves have recovered.", "info")
                })
                .catch(error => {
                    if (saveRequestIdRef.current !== requestId) return
                    if (error instanceof Error && error.name === "AbortError") return

                    const message = error instanceof Error ? error.message : "Unable to save workspace."
                    hasActiveSaveErrorRef.current = true
                    setNotice(message)
                    pushToast("Workspace save failed", message, "error")
                })
        }, saveDelayMs)

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
            if (saveAbortRef.current) saveAbortRef.current.abort()
        }
    }, [hasActiveSaveErrorRef, pushToast, setNotice, saveDelayMs, syncedWorkspaceRef, user, workspace])
}
