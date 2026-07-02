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

export async function POST(request: Request) {
    const originError = rejectCrossOriginMutation(request)
    if (originError) return originError

    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ error: "Application database auth is not configured." }, { status: 503 })

    try {
        const input = registerSchema.parse(await request.json().catch(() => ({})))
        const user = await createAppUser(supabase, input.email, input.password, input.name)
        const token = await createAppSession(supabase, user.id)
        return Response.json({ user }, { status: 201, headers: { "Set-Cookie": createSessionCookie(token) } })
    } catch (error) {
        const message = errorMessage(error, "Unable to register account.")
        const status = errorCode(error) === "23505" || message.toLowerCase().includes("duplicate") ? 409 : 400
        return Response.json({ error: status === 409 ? "An account with this email already exists." : message }, { status })
    }
}
