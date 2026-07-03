import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest, getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { createMcpToken, InvalidMcpScopeError, listMcpTokens, validateAndNormalizeMcpScopes } from "@/server/mcp/token-store"
import { parseMcpTokenCreateRequest } from "../route-contract"

export const runtime = "nodejs"

type Authenticated = { supabase: ReturnType<typeof getSupabaseServiceRoleClient>; userId: string }

export type McpTokenRouteDependencies = {
    getTokenStore: () => Authenticated["supabase"]
    listMcpTokens: typeof listMcpTokens
    createMcpToken: typeof createMcpToken
    parseMcpTokenCreateRequest: typeof parseMcpTokenCreateRequest
    validateAndNormalizeMcpScopes: typeof validateAndNormalizeMcpScopes
}

const defaultMcpTokenRouteDependencies: McpTokenRouteDependencies = {
    getTokenStore: () => getSupabaseServiceRoleClient(),
    listMcpTokens,
    createMcpToken,
    parseMcpTokenCreateRequest,
    validateAndNormalizeMcpScopes,
}

export const runMcpTokenList = async (auth: Authenticated, dependencies = defaultMcpTokenRouteDependencies) => {
    const supabase = dependencies.getTokenStore()
    if (!supabase) return Response.json({ error: "Server database access is required for MCP token management." }, { status: 503 })

    try {
        const tokens = await dependencies.listMcpTokens(supabase, auth.userId)
        return Response.json({ tokens })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load MCP tokens." }, { status: 500 })
    }
}

export const runMcpTokenCreate = async (auth: Authenticated, request: Request, dependencies = defaultMcpTokenRouteDependencies) => {
    const supabase = dependencies.getTokenStore()
    if (!supabase) return Response.json({ error: "Server database access is required for MCP token management." }, { status: 503 })

    try {
        const parsed = await dependencies.parseMcpTokenCreateRequest(request)
        if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })

        const normalizedScopes = dependencies.validateAndNormalizeMcpScopes(parsed.scopes)
        const created = await dependencies.createMcpToken(supabase, auth.userId, parsed.name, normalizedScopes)

        return Response.json(created, { status: 201 })
    } catch (error) {
        if (error instanceof InvalidMcpScopeError) return Response.json({ error: error.message }, { status: 400 })

        return Response.json({ error: error instanceof Error ? error.message : "Unable to create MCP token." }, { status: 500 })
    }
}

export async function GET(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    return runMcpTokenList(auth)
}

export async function POST(request: Request) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    return runMcpTokenCreate(auth, request)
}
