import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { cleanupWorkspaceAssetOrphans, cleanupWorkspaceAssetOrphansForAllUsers } from "@/server/visual-note/workspace-store"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"

export const runtime = "nodejs"

type CleanupRequestBody = {
    userId?: string
    deleteUpdatedBefore?: string
}

type AssetCleanupDependencies = {
    cleanupWorkspaceAssetOrphans: typeof cleanupWorkspaceAssetOrphans
    cleanupWorkspaceAssetOrphansForAllUsers: typeof cleanupWorkspaceAssetOrphansForAllUsers
    getMaintenanceToken: () => string | undefined
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    recordVisualNoteEvent: (event: Parameters<typeof recordVisualNoteEvent>[0]) => void
}

const defaultAssetCleanupDependencies: AssetCleanupDependencies = {
    cleanupWorkspaceAssetOrphans,
    cleanupWorkspaceAssetOrphansForAllUsers,
    getMaintenanceToken: () => process.env.VISUAL_NOTE_MAINTENANCE_TOKEN,
    getSupabaseServiceRoleClient,
    recordVisualNoteEvent,
}

const isIsoDateString = (value: string) => Number.isFinite(Date.parse(value))

export const runAssetCleanup = async (request: Request, dependencies = defaultAssetCleanupDependencies) => {
    const expectedToken = dependencies.getMaintenanceToken()
    const token = request.headers.get("x-maintenance-token")
    if (!expectedToken) {
        return Response.json({ error: "Maintenance token is not configured." }, { status: 503 })
    }
    if (!token || token !== expectedToken) {
        return Response.json({ error: "Unauthorized maintenance request." }, { status: 401 })
    }

    const supabase = dependencies.getSupabaseServiceRoleClient()
    if (!supabase) {
        return Response.json({ error: "Application database access is required for asset cleanup." }, { status: 503 })
    }

    let body: CleanupRequestBody = {}
    const hasBody = (request.headers.get("content-length") ?? "0") !== "0"
    if (hasBody) {
        try {
            const parsed = await request.json()
            if (typeof parsed === "object" && parsed !== null) body = parsed as CleanupRequestBody
            else body = {}
        } catch {
            return Response.json({ error: "Invalid cleanup payload." }, { status: 400 })
        }
    }

    if (body.deleteUpdatedBefore && !isIsoDateString(body.deleteUpdatedBefore)) {
        return Response.json({ error: "deleteUpdatedBefore must be an ISO date string." }, { status: 400 })
    }

    try {
        if (body.userId) {
            const summary = await dependencies.cleanupWorkspaceAssetOrphans(
                supabase,
                body.userId,
                undefined,
                body.deleteUpdatedBefore,
            )
            dependencies.recordVisualNoteEvent({
                event: "assets.cleanup_executed",
                severity: "info",
                metadata: {
                    mode: "user",
                    userId: body.userId,
                    ...summary,
                },
            })

            return Response.json({ userId: body.userId, ...summary })
        }

        const result = await dependencies.cleanupWorkspaceAssetOrphansForAllUsers(supabase, body.deleteUpdatedBefore)
        dependencies.recordVisualNoteEvent({
            event: "assets.cleanup_executed",
            severity: "info",
            metadata: {
                mode: "all",
                usersScanned: result.usersScanned,
                deletedAssetRecords: result.deletedAssetRecords,
            },
        })
        return Response.json(result)
    } catch (error) {
        dependencies.recordVisualNoteEvent({
            event: "assets.cleanup_failed",
            severity: "error",
            error,
        })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to run asset cleanup." }, { status: 500 })
    }
}

export async function POST(request: Request) {
    return runAssetCleanup(request)
}
