import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { findAppSessionByToken, rotateAppSession } from "@/server/auth/app-auth-store"
import { clearSessionCookie, createSessionCookie, readSessionCookie, sessionNeedsRotation } from "@/server/auth/session-cookie"

export const runtime = "nodejs"

export async function GET(request: Request) {
    const token = readSessionCookie(request)
    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ authReady: false, user: null })
    if (!token) return Response.json({ authReady: true, user: null })

    const session = await findAppSessionByToken(supabase, token)
    if (!session) return Response.json({ authReady: true, user: null }, { headers: { "Set-Cookie": clearSessionCookie() } })

    const headers = new Headers()
    if (sessionNeedsRotation(session.expiresAt)) {
        const nextToken = await rotateAppSession(supabase, token, session.user.id)
        headers.set("Set-Cookie", createSessionCookie(nextToken))
    }

    return Response.json({ authReady: true, user: session.user }, { headers })
}
