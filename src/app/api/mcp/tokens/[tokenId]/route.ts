import { authenticateSupabaseMutationRequest, getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { revokeMcpToken } from "@/server/mcp/token-store"

export const runtime = "nodejs"

export async function DELETE(request: Request, context: RouteContext<"/api/mcp/tokens/[tokenId]">) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ error: "Server database access is required for MCP token management." }, { status: 503 })

    try {
        const { tokenId } = await context.params
        const revoked = await revokeMcpToken(supabase, auth.userId, tokenId)
        if (!revoked) return Response.json({ error: "Token not found." }, { status: 404 })

        return Response.json({ ok: true })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to revoke MCP token." }, { status: 500 })
    }
}
