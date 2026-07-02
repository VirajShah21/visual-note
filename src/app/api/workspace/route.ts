import { authenticateSupabaseRequest } from "@/lib/supabase/server"
import { loadWorkspaceForUserWithRevision, resolveWorkspaceRevision, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

export const runtime = "nodejs"

export async function GET(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    try {
        const { workspace, revision } = await loadWorkspaceForUserWithRevision(auth.supabase, auth.userId)
        return Response.json({ workspace, revision })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load workspace." }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    try {
        const body = (await request.json().catch(() => null)) as { workspace?: VisualNoteWorkspace; revision?: string | null } | null
        if (!body?.workspace) return Response.json({ error: "Workspace is required." }, { status: 400 })
        if (body.revision != null && typeof body.revision !== "string") return Response.json({ error: "Revision must be a string." }, { status: 400 })

        const revision = body.revision?.trim()
        await saveWorkspaceForUser(auth.supabase, auth.userId, body.workspace, revision || undefined)
        const nextRevision = await resolveWorkspaceRevision(auth.supabase, auth.userId)
        return Response.json({ revision: nextRevision })
    } catch (error) {
        if (error instanceof Error && (error as { code?: string }).code === "workspace_conflict") return Response.json({ error: error.message }, { status: 409 })

        return Response.json({ error: error instanceof Error ? error.message : "Unable to save workspace." }, { status: 500 })
    }
}
