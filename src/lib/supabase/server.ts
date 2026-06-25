import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { findUserBySessionToken } from "@/server/auth/app-auth-store"
import { readSessionCookie } from "@/server/auth/session-cookie"

export type AuthenticatedSupabaseContext = {
    supabase: SupabaseClient
    userId: string
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
    const token = readSessionCookie(request)
    if (!token) return Response.json({ error: "Authentication required." }, { status: 401 })

    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ error: "Application database auth is not configured." }, { status: 503 })

    const user = await findUserBySessionToken(supabase, token)
    if (!user) return Response.json({ error: "Authentication required." }, { status: 401 })

    return { supabase, userId: user.id }
}

export const loadOwnedWorkspace = async ({ supabase, userId }: AuthenticatedSupabaseContext) => {
    const { data, error } = await supabase.from("visual_note_workspaces").select("workspace").eq("user_id", userId).maybeSingle()
    if (error) return null

    return (data?.workspace as VisualNoteWorkspace | undefined) ?? null
}

export const userOwnsNotebook = async (context: AuthenticatedSupabaseContext, notebookId: string) => {
    const { data, error } = await context.supabase.from("visual_note_notebooks").select("id").eq("user_id", context.userId).eq("id", notebookId).maybeSingle()

    if (!error && data?.id) return true

    const workspace = await loadOwnedWorkspace(context)
    return Boolean(workspace?.notebooks.some(notebook => notebook.id === notebookId && notebook.userId === context.userId))
}
