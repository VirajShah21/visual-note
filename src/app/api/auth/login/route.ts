import { z } from "zod"
import { getSupabaseServiceRoleClient, rejectCrossOriginMutation } from "@/lib/supabase/server"
import { createAppSession, verifyAppUserCredentials } from "@/server/auth/app-auth-store"
import { errorMessage } from "@/server/auth/route-errors"
import { createSessionCookie } from "@/server/auth/session-cookie"
import { checkLoginRateLimit, recordLoginFailure, recordLoginSuccess } from "@/server/auth/login-rate-limit"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"

export const runtime = "nodejs"

export const suspiciousFailureAttempts = 6

export type LoginRouteDependencies = {
    checkLoginRateLimit: typeof checkLoginRateLimit
    createAppSession: typeof createAppSession
    createSessionCookie: typeof createSessionCookie
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    recordLoginFailure: typeof recordLoginFailure
    recordLoginSuccess: typeof recordLoginSuccess
    recordVisualNoteEvent: typeof recordVisualNoteEvent
    rejectCrossOriginMutation: typeof rejectCrossOriginMutation
    verifyAppUserCredentials: typeof verifyAppUserCredentials
    errorMessage: (error: unknown, fallback: string) => string
}

export const runLogin = async (request: Request, dependencies = defaultLoginRouteDependencies) => {
    const originError = dependencies.rejectCrossOriginMutation(request)
    if (originError) return originError

    const supabase = dependencies.getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ error: "Application database auth is not configured." }, { status: 503 })

    try {
        const input = loginSchema.parse(await request.json().catch(() => ({})))
        const rateLimit = dependencies.checkLoginRateLimit(request, input.email)
        if (!rateLimit.allowed) {
            dependencies.recordVisualNoteEvent({ event: "auth.login_rate_limited", severity: "warn", metadata: { email: input.email } })
            return Response.json({ error: `Too many failed login attempts. Try again in ${Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))} seconds.` }, { status: 429 })
        }

        const user = await dependencies.verifyAppUserCredentials(supabase, input.email, input.password)
        if (!user) {
            const failure = dependencies.recordLoginFailure(request, input.email)
            if (failure.blocked) {
                dependencies.recordVisualNoteEvent({ event: "auth.login_lockout_started", severity: "warn", metadata: { attempts: failure.attempts, email: input.email } })
                return Response.json({ error: `Too many failed login attempts. Try again in ${Math.max(1, Math.ceil(failure.retryAfterMs / 1000))} seconds.` }, { status: 429 })
            }

            if (failure.attempts >= suspiciousFailureAttempts)
                dependencies.recordVisualNoteEvent({ event: "auth.login_suspicious", severity: "warn", metadata: { attempts: failure.attempts, email: input.email } })

            dependencies.recordVisualNoteEvent({ event: "auth.login_failed", severity: "warn", metadata: { attempts: failure.attempts, email: input.email } })
            return Response.json({ error: "Invalid login credentials." }, { status: 401 })
        }

        const token = await dependencies.createAppSession(supabase, user.id)
        dependencies.recordLoginSuccess(request, input.email)
        dependencies.recordVisualNoteEvent({ event: "auth.login_succeeded", userId: user.id })
        return Response.json({ user }, { headers: { "Set-Cookie": dependencies.createSessionCookie(token) } })
    } catch (error) {
        dependencies.recordVisualNoteEvent({ event: "auth.login_error", severity: "error", error })
        return Response.json({ error: dependencies.errorMessage(error, "Unable to log in.") }, { status: 400 })
    }
}

const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
})

const defaultLoginRouteDependencies: LoginRouteDependencies = {
    checkLoginRateLimit,
    createAppSession,
    createSessionCookie,
    getSupabaseServiceRoleClient,
    recordLoginFailure,
    recordLoginSuccess,
    recordVisualNoteEvent,
    rejectCrossOriginMutation,
    verifyAppUserCredentials,
    errorMessage,
}

export async function POST(request: Request) {
    return runLogin(request)
}
