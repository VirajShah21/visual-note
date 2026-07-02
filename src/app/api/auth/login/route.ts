import { z } from "zod"
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { createAppSession, verifyAppUserCredentials } from "@/server/auth/app-auth-store"
import { errorMessage } from "@/server/auth/route-errors"
import { createSessionCookie } from "@/server/auth/session-cookie"
import { checkLoginRateLimit, recordLoginFailure, recordLoginSuccess } from "@/server/auth/login-rate-limit"

export const runtime = "nodejs"

const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
})

export async function POST(request: Request) {
    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ error: "Application database auth is not configured." }, { status: 503 })

    try {
        const input = loginSchema.parse(await request.json().catch(() => ({})))
        const rateLimit = checkLoginRateLimit(request, input.email)
        if (!rateLimit.allowed)
            return Response.json({ error: `Too many failed login attempts. Try again in ${Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))} seconds.` }, { status: 429 })

        const user = await verifyAppUserCredentials(supabase, input.email, input.password)
        if (!user) {
            const failure = recordLoginFailure(request, input.email)
            if (failure.blocked)
                return Response.json({ error: `Too many failed login attempts. Try again in ${Math.max(1, Math.ceil(failure.retryAfterMs / 1000))} seconds.` }, { status: 429 })

            return Response.json({ error: "Invalid login credentials." }, { status: 401 })
        }

        const token = await createAppSession(supabase, user.id)
        recordLoginSuccess(request, input.email)
        return Response.json({ user }, { headers: { "Set-Cookie": createSessionCookie(token) } })
    } catch (error) {
        return Response.json({ error: errorMessage(error, "Unable to log in.") }, { status: 400 })
    }
}
