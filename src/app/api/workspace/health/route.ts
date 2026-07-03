import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest } from "@/lib/supabase/server"
import { createEmptyWorkspace } from "@/lib/visual-note/factories"
import { repairWorkspaceConsistency, workspaceHealthCheck } from "@/server/visual-note/workspace-operations"
import { loadWorkspaceForUser, resolveWorkspaceRevision, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"

export const runtime = "nodejs"

export async function GET(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    try {
        const workspace = (await loadWorkspaceForUser(auth.supabase, auth.userId)) ?? createEmptyWorkspace()
        return Response.json(workspaceHealthCheck(workspace, auth.userId))
    } catch (error) {
        recordVisualNoteEvent({ event: "workspace.health_failed", severity: "error", userId: auth.userId, error })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to check workspace health." }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    try {
        const workspace = (await loadWorkspaceForUser(auth.supabase, auth.userId)) ?? createEmptyWorkspace()
        const result = repairWorkspaceConsistency(workspace, auth.userId)
        if (!result.ok) return Response.json(result, { status: 400 })

        const { repairedWorkspace, ...repair } = result.value
        if (repairedWorkspace) {
            await saveWorkspaceForUser(auth.supabase, auth.userId, repairedWorkspace)
            const revision = await resolveWorkspaceRevision(auth.supabase, auth.userId)
            return Response.json({ ok: true, ...repair, revision })
        }

        return Response.json({ ok: true, ...repair })
    } catch (error) {
        recordVisualNoteEvent({ event: "workspace.repair_failed", severity: "error", userId: auth.userId, error })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to repair workspace." }, { status: 500 })
    }
}
