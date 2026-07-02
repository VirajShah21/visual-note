import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { findUserBySessionToken } from "@/server/auth/app-auth-store"
import { readSessionCookie } from "@/server/auth/session-cookie"

export type AuthenticatedSupabaseContext = {
    supabase: SupabaseClient
    userId: string
}

export const rejectCrossOriginMutation = (request: Request) => {
    const origin = request.headers.get("origin")
    if (!origin) return null

    try {
        if (new URL(origin).origin === new URL(request.url).origin) return null
    } catch {
        return Response.json({ error: "Invalid request origin." }, { status: 403 })
    }

    return Response.json({ error: "Cross-origin mutation requests are not allowed." }, { status: 403 })
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

export const authenticateSupabaseMutationRequest = async (request: Request): Promise<AuthenticatedSupabaseContext | Response> => {
    const originError = rejectCrossOriginMutation(request)
    if (originError) return originError

    return authenticateSupabaseRequest(request)
}

export const userOwnsNotebook = async (context: AuthenticatedSupabaseContext, notebookId: string) => {
    const { data, error } = await context.supabase.from("visual_note_notebooks").select("id").eq("user_id", context.userId).eq("id", notebookId).maybeSingle()

    if (error) throw error

    return Boolean(data?.id)
}
