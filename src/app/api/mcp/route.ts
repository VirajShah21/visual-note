import { createMcpHandler, getPublicOrigin, withMcpAuth } from "mcp-handler"
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { registerVisualNoteMcpTools } from "@/server/mcp/visual-note-server"
import { verifyMcpToken } from "@/server/mcp/token-store"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"

export const runtime = "nodejs"

const allowedOriginsFromEnv = () =>
    (process.env.MCP_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean)

const originIsAllowed = (request: Request) => {
    const origin = request.headers.get("origin")
    if (!origin) return true

    const publicOrigin = getPublicOrigin(request)
    return new Set([publicOrigin, new URL(request.url).origin, ...allowedOriginsFromEnv()]).has(origin)
}

const rejectInvalidOrigin = (request: Request) => {
    if (originIsAllowed(request)) return null

    return Response.json({ error: "Origin is not allowed." }, { status: 403 })
}

const verifyVisualNoteMcpToken = async (_request: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
    if (!bearerToken) return undefined

    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) return undefined

    const token = await verifyMcpToken(supabase, bearerToken)
    if (!token) return undefined

    return {
        token: bearerToken,
        clientId: token.tokenId,
        scopes: token.scopes,
        extra: {
            tokenId: token.tokenId,
            userId: token.userId,
            scopes: token.scopes,
        },
    }
}

type McpRouteDependencies = {
    logEvent: (event: Parameters<typeof recordVisualNoteEvent>[0]) => void
    now: () => string
}

const defaultMcpRouteDependencies: McpRouteDependencies = {
    logEvent: recordVisualNoteEvent,
    now: () => new Date().toISOString(),
}

const logMcpRequestFailure = async (request: Request, response: Response, dependencies = defaultMcpRouteDependencies) => {
    dependencies.logEvent({
        event: response.status === 401 ? "mcp.auth_failed" : "mcp.request_blocked",
        severity: "warn",
        metadata: {
            method: request.method,
            path: new URL(request.url).pathname,
            status: response.status,
            reason: response.status === 401 ? "auth_required" : "mcp_request_blocked",
            timestamp: dependencies.now(),
        },
    })

    return response
}

const mcpHandler = createMcpHandler(
    server => {
        registerVisualNoteMcpTools(server)
    },
    {
        serverInfo: {
            name: "visual-note",
            version: "0.1.0",
        },
    },
    {
        basePath: "/api",
        disableSse: true,
        maxDuration: 60,
    },
)

const authenticatedHandler = withMcpAuth(async request => mcpHandler(request), verifyVisualNoteMcpToken, { required: true })

const handler = async (request: Request, dependencies = defaultMcpRouteDependencies) => {
    const originError = rejectInvalidOrigin(request)
    if (originError) return logMcpRequestFailure(request, originError, dependencies)

    const response = await authenticatedHandler(request)
    if (response instanceof Response && response.status >= 400) return logMcpRequestFailure(request, response, dependencies)

    return response
}

export const POST = (request: Request) => handler(request)
export const GET = (request: Request) => handler(request)
export const runMcpHandler = handler

export const OPTIONS = (request: Request, dependencies = defaultMcpRouteDependencies) => {
    const originError = rejectInvalidOrigin(request)
    if (originError) return logMcpRequestFailure(request, originError, dependencies)

    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Last-Event-ID",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Origin": request.headers.get("origin") ?? getPublicOrigin(request),
            "Access-Control-Max-Age": "86400",
        },
    })
}
