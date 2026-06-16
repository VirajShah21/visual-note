import { authenticateSupabaseRequest, getSupabaseServiceRoleClient, userOwnsNotebook } from "@/lib/supabase/server"
import { loadNotebookStorageSettings, saveNotebookStorageSettings } from "@/server/storage/notebook-storage"
import type { NotebookStorageSettingsInput } from "@/lib/visual-note/storage-settings"

export const runtime = "nodejs"

export async function GET(request: Request, context: RouteContext<"/api/notebooks/[notebookId]/storage-settings">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    if (!(await userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })
    const storageSupabase = getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Supabase service role is not configured for storage routes." }, { status: 503 })

    try {
        const settings = await loadNotebookStorageSettings(storageSupabase, auth.userId, notebookId)
        return Response.json({ settings })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load storage settings." }, { status: 500 })
    }
}

export async function PUT(request: Request, context: RouteContext<"/api/notebooks/[notebookId]/storage-settings">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    if (!(await userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })
    const storageSupabase = getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Supabase service role is not configured for storage routes." }, { status: 503 })

    try {
        const input = (await request.json()) as NotebookStorageSettingsInput
        const validation = validateSettingsInput(input)
        if (validation) return Response.json({ error: validation }, { status: 400 })

        const settings = await saveNotebookStorageSettings(storageSupabase, auth.userId, notebookId, input)
        return Response.json({ settings })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save storage settings."
        const status = message.toLowerCase().includes("duplicate key") ? 409 : 500
        return Response.json({ error: message }, { status })
    }
}

const validateSettingsInput = (input: NotebookStorageSettingsInput) => {
    if (!input.connectionName?.trim()) return "Connection name is required."
    if (!input.region?.trim()) return "Region is required."
    if (!input.accessKeyId?.trim()) return "Access key ID is required."
    if (!input.connectionId && !input.secretAccessKey?.trim()) return "Secret access key is required."
    if (!input.bucketName?.trim()) return "Bucket name is required."
    return null
}
