import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest } from "@/lib/supabase/server"
import { loadWorkspaceForUserWithRevision, resolveWorkspaceRevision, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"
import { isWorkspaceConflictError, parseWorkspaceSaveRequest } from "./route-contract"

export const runtime = "nodejs"

export async function GET(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    try {
        const { workspace, revision } = await loadWorkspaceForUserWithRevision(auth.supabase, auth.userId)
        return Response.json({ workspace, revision }, { headers: { ETag: `"${revision}"` } })
    } catch (error) {
        recordVisualNoteEvent({ event: "workspace.load_failed", severity: "error", userId: auth.userId, error })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load workspace." }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    try {
        const parsed = await parseWorkspaceSaveRequest(request)
        if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })

        await saveWorkspaceForUser(auth.supabase, auth.userId, parsed.workspace, parsed.revision, parsed.baseWorkspace)
        const nextRevision = await resolveWorkspaceRevision(auth.supabase, auth.userId)
        return Response.json({ revision: nextRevision })
    } catch (error) {
        if (isWorkspaceConflictError(error)) {
            recordVisualNoteEvent({ event: "workspace.save_conflict", severity: "warn", userId: auth.userId, error })
            return Response.json({ error: error.message }, { status: 409 })
        }

        recordVisualNoteEvent({ event: "workspace.save_failed", severity: "error", userId: auth.userId, error })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to save workspace." }, { status: 500 })
    }
}
