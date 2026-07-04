import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { findAppSessionByToken, rotateAppSession } from "@/server/auth/app-auth-store"
import { clearSessionCookie, createSessionCookie, readSessionCookie, sessionNeedsRotation } from "@/server/auth/session-cookie"

export const runtime = "nodejs"

export type SessionRouteDependencies = {
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    readSessionCookie: typeof readSessionCookie
    findAppSessionByToken: typeof findAppSessionByToken
    rotateAppSession: typeof rotateAppSession
    clearSessionCookie: typeof clearSessionCookie
    createSessionCookie: typeof createSessionCookie
    sessionNeedsRotation: typeof sessionNeedsRotation
}

const defaultSessionRouteDependencies: SessionRouteDependencies = {
    getSupabaseServiceRoleClient,
    readSessionCookie,
    findAppSessionByToken,
    rotateAppSession,
    clearSessionCookie,
    createSessionCookie,
    sessionNeedsRotation,
}

export const runSessionGet = async (request: Request, dependencies = defaultSessionRouteDependencies) => {
    const token = dependencies.readSessionCookie(request)
    const supabase = dependencies.getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ authReady: false, user: null })
    if (!token) return Response.json({ authReady: true, user: null })

    const session = await dependencies.findAppSessionByToken(supabase, token)
    if (!session) return Response.json({ authReady: true, user: null }, { headers: { "Set-Cookie": dependencies.clearSessionCookie() } })

    const headers = new Headers()
    if (dependencies.sessionNeedsRotation(session.expiresAt)) {
        const nextToken = await dependencies.rotateAppSession(supabase, token, session.user.id)
        headers.set("Set-Cookie", dependencies.createSessionCookie(nextToken))
    }

    return Response.json({ authReady: true, user: session.user }, { headers })
}

export async function GET(request: Request) {
    return runSessionGet(request)
}
