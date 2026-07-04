import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest, getSupabaseServiceRoleClient, userOwnsNotebook } from "@/lib/supabase/server"
import { loadNotebookStorageSettings, saveNotebookStorageSettings } from "@/server/storage/notebook-storage"
import type { NotebookStorageSettingsInput } from "@/lib/visual-note/storage-settings"
import { parseStorageSettingsRequest } from "./route-contract"

export const runtime = "nodejs"

type Authenticated = { supabase: Parameters<typeof loadNotebookStorageSettings>[0]; userId: string }

export type StorageSettingsRouteDependencies = {
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    loadNotebookStorageSettings: typeof loadNotebookStorageSettings
    saveNotebookStorageSettings: typeof saveNotebookStorageSettings
    parseStorageSettingsRequest: typeof parseStorageSettingsRequest
    userOwnsNotebook: typeof userOwnsNotebook
}

const defaultStorageSettingsRouteDependencies: StorageSettingsRouteDependencies = {
    getSupabaseServiceRoleClient,
    loadNotebookStorageSettings,
    saveNotebookStorageSettings,
    parseStorageSettingsRequest,
    userOwnsNotebook,
}

export const runStorageSettingsGet = async (auth: Authenticated, notebookId: string, dependencies = defaultStorageSettingsRouteDependencies) => {
    if (!(await dependencies.userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })
    const storageSupabase = dependencies.getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })

    try {
        const settings = await dependencies.loadNotebookStorageSettings(storageSupabase, auth.userId, notebookId)
        return Response.json({ settings })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load storage settings." }, { status: 500 })
    }
}

export const runStorageSettingsPut = async (auth: Authenticated, request: Request, notebookId: string, dependencies = defaultStorageSettingsRouteDependencies) => {
    if (!(await dependencies.userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })
    const storageSupabase = dependencies.getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })

    try {
        const parsed = await dependencies.parseStorageSettingsRequest(request)
        if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })

        const input = parsed.input as NotebookStorageSettingsInput

        const settings = await dependencies.saveNotebookStorageSettings(storageSupabase, auth.userId, notebookId, input)
        return Response.json({ settings })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save storage settings."
        const status = message.toLowerCase().includes("duplicate key") ? 409 : 500
        return Response.json({ error: message }, { status })
    }
}

export async function GET(request: Request, context: RouteContext<"/api/notebooks/[notebookId]/storage-settings">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    return runStorageSettingsGet(auth, notebookId)
}

export async function PUT(request: Request, context: RouteContext<"/api/notebooks/[notebookId]/storage-settings">) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    return runStorageSettingsPut(auth, request, notebookId)
}
