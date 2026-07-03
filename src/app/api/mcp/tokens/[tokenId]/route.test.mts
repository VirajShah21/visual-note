import assert from "node:assert/strict"
import test from "node:test"
import { runMcpTokenDelete, type McpTokenByIdRouteDependencies } from "./route"

const readResponseBody = async (response: Response) => response.json()

const makeDependencies = (overrides: Partial<McpTokenByIdRouteDependencies> = {}) => ({
    authenticateSupabaseMutationRequest: async () => ({ supabase: {} as never, userId: "user-1" }),
    getSupabaseServiceRoleClient: () => ({} as never),
    revokeMcpToken: async () => true,
    ...overrides,
} as McpTokenByIdRouteDependencies)

const context = (tokenId: string): RouteContext<"/api/mcp/tokens/[tokenId]"> => ({
    params: Promise.resolve({ tokenId }) as never,
} as RouteContext<"/api/mcp/tokens/[tokenId]">)

test("rejects unauthorized token deletion requests", async () => {
    const response = await runMcpTokenDelete(new Request("https://app.test/api/mcp/tokens/token-1", { method: "DELETE" }), context("token-1"), {
        ...makeDependencies(),
        authenticateSupabaseMutationRequest: async () => Response.json({ error: "Authentication required." }, { status: 401 }),
    })

    assert.equal(response.status, 401)
    assert.deepEqual(await readResponseBody(response), { error: "Authentication required." })
})

test("returns unavailable when token store client is missing", async () => {
    const response = await runMcpTokenDelete(new Request("https://app.test/api/mcp/tokens/token-1", { method: "DELETE" }), context("token-1"), {
        ...makeDependencies(),
        getSupabaseServiceRoleClient: () => null,
    })

    assert.equal(response.status, 503)
    assert.deepEqual(await readResponseBody(response), { error: "Server database access is required for MCP token management." })
})

test("returns not found when token is missing", async () => {
    const response = await runMcpTokenDelete(new Request("https://app.test/api/mcp/tokens/missing", { method: "DELETE" }), context("missing"), {
        ...makeDependencies(),
        revokeMcpToken: async () => false,
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await readResponseBody(response), { error: "Token not found." })
})

test("revokes token and returns success", async () => {
    const response = await runMcpTokenDelete(
        new Request("https://app.test/api/mcp/tokens/token-2", { method: "DELETE" }),
        context("token-2"),
        makeDependencies(),
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await readResponseBody(response), { ok: true })
})
