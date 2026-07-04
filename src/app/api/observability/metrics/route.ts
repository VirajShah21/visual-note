import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { recordVisualNoteEvent, snapshotVisualNoteMetrics } from "@/server/observability/visual-note-events"

export const runtime = "nodejs"

type ObservabilityDependencies = {
    getMaintenanceToken: () => string | undefined
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    recordVisualNoteEvent: (event: Parameters<typeof recordVisualNoteEvent>[0]) => void
    snapshotVisualNoteMetrics: typeof snapshotVisualNoteMetrics
}

const defaultObservabilityDependencies: ObservabilityDependencies = {
    getMaintenanceToken: () => process.env.VISUAL_NOTE_MAINTENANCE_TOKEN,
    getSupabaseServiceRoleClient,
    recordVisualNoteEvent,
    snapshotVisualNoteMetrics,
}

export const runObservabilityMetricsGet = async (request: Request, dependencies = defaultObservabilityDependencies) => {
    const expectedToken = dependencies.getMaintenanceToken()
    const actualToken = request.headers.get("x-maintenance-token")
    if (!expectedToken) return Response.json({ error: "Maintenance token is not configured." }, { status: 503 })

    if (!actualToken || actualToken !== expectedToken) return Response.json({ error: "Unauthorized maintenance request." }, { status: 401 })

    const supabase = dependencies.getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ error: "Application database access is required for observability metrics." }, { status: 503 })

    dependencies.recordVisualNoteEvent({ event: "observability.metrics_read", severity: "info" })
    return Response.json(dependencies.snapshotVisualNoteMetrics())
}

export async function GET(request: Request) {
    return runObservabilityMetricsGet(request)
}
