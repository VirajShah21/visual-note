import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { findUserBySessionToken } from "@/server/auth/app-auth-store"
import { readSessionCookie } from "@/server/auth/session-cookie"

export const runtime = "nodejs"

export async function GET(request: Request) {
    const token = readSessionCookie(request)
    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ authReady: false, user: null })
    if (!token) return Response.json({ authReady: true, user: null })

    const user = await findUserBySessionToken(supabase, token)
    return Response.json({ authReady: true, user })
}
