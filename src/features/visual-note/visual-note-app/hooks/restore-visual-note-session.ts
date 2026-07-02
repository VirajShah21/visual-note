import { loadCurrentVisualNoteSession } from "@/lib/visual-note/auth-api"
import { createEmptyWorkspace, normalizeWorkspace } from "@/lib/visual-note/factories"
import { loadVisualNoteWorkspace } from "@/lib/visual-note/workspace-api"
import type { SelectionState, VisualNoteWorkspace, VisualUser } from "@/lib/visual-note/types"
import { blankSelection, coerceSingleArticleViewPerTopic, ensureSelectionHasArticleView } from "../utils/visual-note-app.utils"

export type AppAuthStatus = "ready" | "unconfigured"

export type RestoredVisualNoteSession = {
    authStatus: AppAuthStatus
    user: VisualUser | null
    workspace?: VisualNoteWorkspace
    selection?: SelectionState
}

export const restoreVisualNoteSession = async (initialNotebookId: string): Promise<RestoredVisualNoteSession> => {
    const session = await loadCurrentVisualNoteSession()

    if (session.user) return restoreWorkspaceForUser(session.user, initialNotebookId)

    return { authStatus: session.authReady ? "ready" : "unconfigured", user: null }
}

const restoreWorkspaceForUser = async (user: VisualUser, initialNotebookId: string) => {
    const remoteWorkspace = await loadVisualNoteWorkspace()
    const workspace = coerceSingleArticleViewPerTopic(normalizeWorkspace(remoteWorkspace ?? createEmptyWorkspace()))
    const resolved = ensureSelectionHasArticleView(workspace, { ...blankSelection, notebookId: initialNotebookId })

    return { authStatus: "ready" as const, user, workspace: resolved.workspace, selection: resolved.selection }
}
