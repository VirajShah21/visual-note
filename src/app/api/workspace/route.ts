import { authenticateSupabaseRequest } from "@/lib/supabase/server"
import { loadWorkspaceForUser, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

export const runtime = "nodejs"

export async function GET(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    try {
        const workspace = await loadWorkspaceForUser(auth)
        return Response.json({ workspace })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load workspace." }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    try {
        const body = (await request.json()) as { workspace?: VisualNoteWorkspace }
        if (!body.workspace) return Response.json({ error: "Workspace is required." }, { status: 400 })

        await saveWorkspaceForUser(auth.supabase, auth.userId, body.workspace)
        return Response.json({ ok: true })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to save workspace." }, { status: 500 })
    }
}
