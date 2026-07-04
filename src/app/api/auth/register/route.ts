import { z } from "zod"
import { getSupabaseServiceRoleClient, rejectCrossOriginMutation } from "@/lib/supabase/server"
import { createAppSession, createAppUser } from "@/server/auth/app-auth-store"
import { errorCode, errorMessage } from "@/server/auth/route-errors"
import { createSessionCookie } from "@/server/auth/session-cookie"

export const runtime = "nodejs"

const registerSchema = z.object({
    email: z.string().trim().email(),
    name: z.string().trim().min(1),
    password: z.string().min(6),
})

export type RegisterRouteDependencies = {
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    rejectCrossOriginMutation: typeof rejectCrossOriginMutation
    createAppUser: typeof createAppUser
    createAppSession: typeof createAppSession
    errorCode: typeof errorCode
    errorMessage: typeof errorMessage
    createSessionCookie: typeof createSessionCookie
}

const defaultRegisterRouteDependencies: RegisterRouteDependencies = {
    getSupabaseServiceRoleClient,
    rejectCrossOriginMutation,
    createAppUser,
    createAppSession,
    errorCode,
    errorMessage,
    createSessionCookie,
}

export const runRegister = async (request: Request, dependencies = defaultRegisterRouteDependencies) => {
    const originError = dependencies.rejectCrossOriginMutation(request)
    if (originError) return originError

    const supabase = dependencies.getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ error: "Application database auth is not configured." }, { status: 503 })

    try {
        const input = registerSchema.parse(await request.json().catch(() => ({})))
        const user = await dependencies.createAppUser(supabase, input.email, input.password, input.name)
        const token = await dependencies.createAppSession(supabase, user.id)
        return Response.json({ user }, { status: 201, headers: { "Set-Cookie": dependencies.createSessionCookie(token) } })
    } catch (error) {
        const message = dependencies.errorMessage(error, "Unable to register account.")
        const status = dependencies.errorCode(error) === "23505" || message.toLowerCase().includes("duplicate") ? 409 : 400
        return Response.json({ error: status === 409 ? "An account with this email already exists." : message }, { status })
    }
}

export async function POST(request: Request) {
    return runRegister(request)
}
