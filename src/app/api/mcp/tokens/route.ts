import { authenticateSupabaseRequest, getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { createMcpToken, listMcpTokens } from "@/server/mcp/token-store"

export const runtime = "nodejs"

const getTokenStore = () => getSupabaseServiceRoleClient()

export async function GET(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const supabase = getTokenStore()
    if (!supabase) return Response.json({ error: "Server database access is required for MCP token management." }, { status: 503 })

    try {
        const tokens = await listMcpTokens(supabase, auth.userId)
        return Response.json({ tokens })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load MCP tokens." }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const supabase = getTokenStore()
    if (!supabase) return Response.json({ error: "Server database access is required for MCP token management." }, { status: 503 })

    try {
        const input = (await request.json().catch(() => ({}))) as { name?: string }
        const created = await createMcpToken(supabase, auth.userId, input.name ?? "")
        return Response.json(created, { status: 201 })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to create MCP token." }, { status: 500 })
    }
}
