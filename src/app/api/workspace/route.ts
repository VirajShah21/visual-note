import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest } from "@/lib/supabase/server"
import { loadWorkspaceForUserWithRevision, resolveWorkspaceRevision, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"
import { isWorkspaceConflictError, parseWorkspaceSaveRequest } from "./route-contract"

type Authenticated = { supabase: Parameters<typeof loadWorkspaceForUserWithRevision>[0]; userId: string }

export type WorkspaceRouteDependencies = {
    loadWorkspaceForUserWithRevision: typeof loadWorkspaceForUserWithRevision
    resolveWorkspaceRevision: typeof resolveWorkspaceRevision
    saveWorkspaceForUser: typeof saveWorkspaceForUser
    logEvent: (event: Parameters<typeof recordVisualNoteEvent>[0]) => void
    isWorkspaceConflictError: (error: unknown) => boolean
    isWorkspaceIntegrityError: (error: unknown) => error is Error & { code?: string }
    isWorkspaceStorageError: (error: unknown) => error is Error & { code?: string }
}

type WorkspaceSaveResult = Awaited<ReturnType<typeof parseWorkspaceSaveRequest>>

const defaultWorkspaceRouteDependencies: WorkspaceRouteDependencies = {
    loadWorkspaceForUserWithRevision,
    resolveWorkspaceRevision,
    saveWorkspaceForUser,
    logEvent: recordVisualNoteEvent,
    isWorkspaceConflictError,
    isWorkspaceIntegrityError: (error: unknown): error is Error & { code?: string } =>
        error instanceof Error && (error as { code?: string }).code === "workspace_integrity",
    isWorkspaceStorageError: (error: unknown): error is Error & { code?: string } =>
        error instanceof Error && (error as { code?: string }).code === "workspace_storage_not_configured",
}

export const runWorkspaceLoad = async (auth: Authenticated, dependencies = defaultWorkspaceRouteDependencies) => {
    try {
        const { workspace, revision } = await dependencies.loadWorkspaceForUserWithRevision(auth.supabase, auth.userId)
        return Response.json({ workspace, revision }, { headers: { ETag: `"${revision}"` } })
    } catch (error) {
        dependencies.logEvent({ event: "workspace.load_failed", severity: "error", userId: auth.userId, error })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load workspace." }, { status: 500 })
    }
}

export const runWorkspaceSave = async (auth: Authenticated, parsed: WorkspaceSaveResult, dependencies = defaultWorkspaceRouteDependencies) => {
    if (!parsed.ok) {
        dependencies.logEvent({
            event: "workspace.save_request_invalid",
            severity: "warn",
            userId: auth.userId,
            metadata: {
                reason: parsed.error,
                status: parsed.status,
            },
        })
        return Response.json({ error: parsed.error }, { status: parsed.status })
    }

    try {
        await dependencies.saveWorkspaceForUser(auth.supabase, auth.userId, parsed.workspace, parsed.revision, parsed.baseWorkspace)
        const nextRevision = await dependencies.resolveWorkspaceRevision(auth.supabase, auth.userId)
        return Response.json({ revision: nextRevision })
    } catch (error) {
        if (dependencies.isWorkspaceIntegrityError(error)) {
            dependencies.logEvent({
                event: "workspace.save_payload_invalid",
                severity: "warn",
                userId: auth.userId,
                metadata: {
                    reason: error.message,
                    issues: (error as { issues?: string[] }).issues,
                },
            })
            return Response.json({ error: error.message }, { status: 400 })
        }

        if (dependencies.isWorkspaceConflictError(error)) {
            dependencies.logEvent({ event: "workspace.save_conflict", severity: "warn", userId: auth.userId, error })
            return Response.json({ error: error instanceof Error ? error.message : "Unable to save workspace." }, { status: 409 })
        }

        if (dependencies.isWorkspaceStorageError(error)) {
            dependencies.logEvent({
                event: "workspace.save_storage_not_configured",
                severity: "warn",
                userId: auth.userId,
                metadata: {
                    reason: error.message,
                },
            })
            return Response.json({ error: error instanceof Error ? error.message : "Configure notebook storage before saving workspace content." }, { status: 400 })
        }

        dependencies.logEvent({ event: "workspace.save_failed", severity: "error", userId: auth.userId, error })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to save workspace." }, { status: 500 })
    }
}

export const runtime = "nodejs"

export async function GET(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    return runWorkspaceLoad(auth)
}

export async function PUT(request: Request) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const parsed = await parseWorkspaceSaveRequest(request)
    return runWorkspaceSave(auth, parsed)
}
