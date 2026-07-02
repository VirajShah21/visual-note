import { getSupabaseServiceRoleClient, rejectCrossOriginMutation } from "@/lib/supabase/server"
import { revokeAppSession } from "@/server/auth/app-auth-store"
import { clearSessionCookie, readSessionCookie } from "@/server/auth/session-cookie"

export const runtime = "nodejs"

export async function POST(request: Request) {
    const originError = rejectCrossOriginMutation(request)
    if (originError) return originError

    const supabase = getSupabaseServiceRoleClient()
    const token = readSessionCookie(request)
    if (supabase && token) await revokeAppSession(supabase, token)

    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } })
}
