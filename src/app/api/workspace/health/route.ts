import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest } from "@/lib/supabase/server"
import { createEmptyWorkspace } from "@/lib/visual-note/factories"
import { repairWorkspaceConsistency, workspaceHealthCheck } from "@/server/visual-note/workspace-operations"
import { resolveWorkspaceRevision } from "@/server/visual-note/workspace-revision-store"
import { loadWorkspaceForUser, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"

export const runtime = "nodejs"

type Authenticated = { supabase: Parameters<typeof loadWorkspaceForUser>[0]; userId: string }

export type WorkspaceHealthDependencies = {
    createEmptyWorkspace: typeof createEmptyWorkspace
    loadWorkspaceForUser: typeof loadWorkspaceForUser
    recordVisualNoteEvent: (event: Parameters<typeof recordVisualNoteEvent>[0]) => void
    repairWorkspaceConsistency: typeof repairWorkspaceConsistency
    resolveWorkspaceRevision: typeof resolveWorkspaceRevision
    saveWorkspaceForUser: typeof saveWorkspaceForUser
    workspaceHealthCheck: typeof workspaceHealthCheck
}

const defaultWorkspaceHealthDependencies: WorkspaceHealthDependencies = {
    createEmptyWorkspace,
    loadWorkspaceForUser,
    recordVisualNoteEvent,
    repairWorkspaceConsistency,
    resolveWorkspaceRevision,
    saveWorkspaceForUser,
    workspaceHealthCheck,
}

export const runWorkspaceHealthGet = async (auth: Authenticated, dependencies = defaultWorkspaceHealthDependencies) => {
    try {
        const workspace = (await dependencies.loadWorkspaceForUser(auth.supabase, auth.userId)) ?? dependencies.createEmptyWorkspace()
        return Response.json(dependencies.workspaceHealthCheck(workspace, auth.userId))
    } catch (error) {
        dependencies.recordVisualNoteEvent({ event: "workspace.health_failed", severity: "error", userId: auth.userId, error })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to check workspace health." }, { status: 500 })
    }
}

export const runWorkspaceHealthPost = async (auth: Authenticated, dependencies = defaultWorkspaceHealthDependencies) => {
    try {
        const workspace = (await dependencies.loadWorkspaceForUser(auth.supabase, auth.userId)) ?? dependencies.createEmptyWorkspace()
        const result = dependencies.repairWorkspaceConsistency(workspace, auth.userId)
        if (!result.ok) return Response.json(result, { status: 400 })

        const { repairedWorkspace, ...repair } = result.value
        if (repairedWorkspace) {
            await dependencies.saveWorkspaceForUser(auth.supabase, auth.userId, repairedWorkspace)
            const revision = await dependencies.resolveWorkspaceRevision(auth.supabase, auth.userId)
            return Response.json({ ok: true, ...repair, revision })
        }

        return Response.json({ ok: true, ...repair })
    } catch (error) {
        dependencies.recordVisualNoteEvent({ event: "workspace.repair_failed", severity: "error", userId: auth.userId, error })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to repair workspace." }, { status: 500 })
    }
}

export async function GET(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    return runWorkspaceHealthGet(auth)
}

export async function POST(request: Request) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    return runWorkspaceHealthPost(auth)
}
