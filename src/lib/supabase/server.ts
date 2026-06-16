import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

export type AuthenticatedSupabaseContext = {
    supabase: SupabaseClient
    userId: string
}

export const getSupabaseServerClient = (accessToken: string) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return null

    return createClient(url, key, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    })
}

export const getSupabaseServiceRoleClient = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}

export const authenticateSupabaseRequest = async (request: Request): Promise<AuthenticatedSupabaseContext | Response> => {
    const header = request.headers.get("authorization") ?? ""
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : ""
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 })

    const supabase = getSupabaseServerClient(token)
    if (!supabase) return Response.json({ error: "Supabase is not configured for server routes." }, { status: 503 })

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return Response.json({ error: "Authentication required." }, { status: 401 })

    return { supabase, userId: data.user.id }
}

export const loadOwnedWorkspace = async ({ supabase, userId }: AuthenticatedSupabaseContext) => {
    const { data, error } = await supabase.from("visual_note_workspaces").select("workspace").eq("user_id", userId).maybeSingle()
    if (error) return null

    return (data?.workspace as VisualNoteWorkspace | undefined) ?? null
}

export const userOwnsNotebook = async (context: AuthenticatedSupabaseContext, notebookId: string) => {
    const workspace = await loadOwnedWorkspace(context)
    return Boolean(workspace?.notebooks.some(notebook => notebook.id === notebookId && notebook.userId === context.userId))
}
