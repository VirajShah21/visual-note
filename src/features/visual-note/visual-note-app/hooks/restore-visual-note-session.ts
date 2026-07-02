import { loadCurrentVisualNoteSession } from "@/lib/visual-note/auth-api"
import { createEmptyWorkspace, normalizeWorkspace } from "@/lib/visual-note/factories"
import { loadVisualNoteWorkspaceState } from "@/lib/visual-note/workspace-api"
import type { SelectionState, VisualNoteWorkspace, VisualUser } from "@/lib/visual-note/types"
import { blankSelection, coerceSingleArticleViewPerTopic, ensureSelectionHasArticleView } from "@features/visual-note/visual-note-app/utils/visual-note-app.utils"

export type AppAuthStatus = "ready" | "unconfigured"

export type RestoredVisualNoteSession = {
    authStatus: AppAuthStatus
    user: VisualUser | null
    workspace?: VisualNoteWorkspace
    workspaceRevision?: string | null
    selection?: SelectionState
}

export const restoreVisualNoteSession = async (initialNotebookId: string): Promise<RestoredVisualNoteSession> => {
    const session = await loadCurrentVisualNoteSession()

    if (session.user) return restoreWorkspaceForUser(session.user, initialNotebookId)

    return { authStatus: session.authReady ? "ready" : "unconfigured", user: null }
}

const restoreWorkspaceForUser = async (user: VisualUser, initialNotebookId: string) => {
    const remote = await loadVisualNoteWorkspaceState()
    const remoteWorkspace = remote.workspace
    const workspace = coerceSingleArticleViewPerTopic(normalizeWorkspace(remoteWorkspace ?? createEmptyWorkspace()))
    const resolved = ensureSelectionHasArticleView(workspace, { ...blankSelection, notebookId: initialNotebookId })

    return {
        authStatus: "ready" as const,
        user,
        workspace: resolved.workspace,
        workspaceRevision: remote.revision,
        selection: resolved.selection,
    }
}
