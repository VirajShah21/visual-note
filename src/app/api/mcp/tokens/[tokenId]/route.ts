import { authenticateSupabaseMutationRequest, getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { revokeMcpToken } from "@/server/mcp/token-store"

export const runtime = "nodejs"

export type McpTokenByIdRouteDependencies = {
    authenticateSupabaseMutationRequest: typeof authenticateSupabaseMutationRequest
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    revokeMcpToken: typeof revokeMcpToken
}

type Authenticated = { supabase: Parameters<typeof revokeMcpToken>[0]; userId: string }
type McpTokenByIdRouteContext = { params: Promise<{ tokenId: string }> }

const defaultMcpTokenByIdRouteDependencies: McpTokenByIdRouteDependencies = {
    authenticateSupabaseMutationRequest,
    getSupabaseServiceRoleClient,
    revokeMcpToken,
}

export const runMcpTokenDelete = async (request: Request, context: McpTokenByIdRouteContext, dependencies = defaultMcpTokenByIdRouteDependencies) => {
    const auth = await dependencies.authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const typedAuth = auth as Authenticated
    const supabase = dependencies.getSupabaseServiceRoleClient()
    if (!supabase) return Response.json({ error: "Server database access is required for MCP token management." }, { status: 503 })

    try {
        const { tokenId } = await context.params
        const revoked = await dependencies.revokeMcpToken(supabase, typedAuth.userId, tokenId)
        if (!revoked) return Response.json({ error: "Token not found." }, { status: 404 })

        return Response.json({ ok: true })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to revoke MCP token." }, { status: 500 })
    }
}

export async function DELETE(request: Request, context: McpTokenByIdRouteContext) {
    return runMcpTokenDelete(request, context)
}
