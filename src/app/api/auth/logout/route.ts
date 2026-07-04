import { getSupabaseServiceRoleClient, rejectCrossOriginMutation } from "@/lib/supabase/server"
import { revokeAppSession } from "@/server/auth/app-auth-store"
import { clearSessionCookie, readSessionCookie } from "@/server/auth/session-cookie"

export const runtime = "nodejs"

export type LogoutRouteDependencies = {
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    rejectCrossOriginMutation: typeof rejectCrossOriginMutation
    readSessionCookie: typeof readSessionCookie
    revokeAppSession: typeof revokeAppSession
    clearSessionCookie: typeof clearSessionCookie
}

const defaultLogoutRouteDependencies: LogoutRouteDependencies = {
    getSupabaseServiceRoleClient,
    rejectCrossOriginMutation,
    readSessionCookie,
    revokeAppSession,
    clearSessionCookie,
}

export const runLogout = async (request: Request, dependencies = defaultLogoutRouteDependencies) => {
    const originError = dependencies.rejectCrossOriginMutation(request)
    if (originError) return originError

    const supabase = dependencies.getSupabaseServiceRoleClient()
    const token = dependencies.readSessionCookie(request)
    if (supabase && token) await dependencies.revokeAppSession(supabase, token)

    return Response.json({ ok: true }, { headers: { "Set-Cookie": dependencies.clearSessionCookie() } })
}

export async function POST(request: Request) {
    return runLogout(request)
}
