import { z } from "zod"
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { createAppSession, verifyAppUserCredentials } from "@/server/auth/app-auth-store"
import { createSessionCookie } from "@/server/auth/session-cookie"

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
        const user = await verifyAppUserCredentials(supabase, input.email, input.password)
        if (!user) return Response.json({ error: "Invalid login credentials." }, { status: 401 })

        const token = await createAppSession(supabase, user.id)
        return Response.json({ user }, { headers: { "Set-Cookie": createSessionCookie(token) } })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to log in."
        return Response.json({ error: message }, { status: 400 })
    }
}
