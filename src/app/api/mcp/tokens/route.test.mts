import assert from "node:assert/strict"
import test from "node:test"
import { InvalidMcpScopeError } from "@/server/mcp/token-store"
import { runMcpTokenCreate, runMcpTokenList, type McpTokenRouteDependencies } from "./route"

const auth = {
    userId: "user-1",
    supabase: {} as never,
}

const readResponseBody = async (response: Response) => response.json()

test("GET maps missing token store to service unavailable", async () => {
    const response = await runMcpTokenList(auth, {
        getTokenStore: () => null,
        listMcpTokens: async () => {
            throw new Error("should not be called")
        },
        createMcpToken: async () => {
            throw new Error("should not be called")
        },
        parseMcpTokenCreateRequest: async () => {
            throw new Error("should not be called")
        },
        validateAndNormalizeMcpScopes: () => [],
    } as McpTokenRouteDependencies)

    assert.equal(response.status, 503)
    assert.deepEqual(await readResponseBody(response), { error: "Server database access is required for MCP token management." })
})

test("GET returns token list from dependencies", async () => {
    const tokens = [{ id: "token-1", userId: "user-1", name: "CI", tokenPrefix: "vn_mcp_", scopes: ["visual-note:mcp:read"], createdAt: "2026-01-01T00:00:00.000Z" }]
    const response = await runMcpTokenList(auth, {
        getTokenStore: () => ({}) as never,
        listMcpTokens: async () => tokens as never,
        createMcpToken: async () => {
            throw new Error("should not be called")
        },
        parseMcpTokenCreateRequest: async () => {
            throw new Error("should not be called")
        },
        validateAndNormalizeMcpScopes: () => [],
    } as McpTokenRouteDependencies)

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.deepEqual(body.tokens, tokens)
})

test("GET maps token store failures to status 500", async () => {
    const response = await runMcpTokenList(auth, {
        getTokenStore: () => ({}) as never,
        listMcpTokens: async () => {
            throw new Error("token db down")
        },
        createMcpToken: async () => {
            throw new Error("should not be called")
        },
        parseMcpTokenCreateRequest: async () => {
            throw new Error("should not be called")
        },
        validateAndNormalizeMcpScopes: () => [],
    } as McpTokenRouteDependencies)

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "token db down")
})

test("POST maps parse failures to their mapped status", async () => {
    const request = new Request("http://visual-note.test/api/mcp/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
    })
    const response = await runMcpTokenCreate(auth, request, {
        getTokenStore: () => ({}) as never,
        listMcpTokens: async () => {
            throw new Error("should not be called")
        },
        createMcpToken: async () => {
            throw new Error("should not be called")
        },
        parseMcpTokenCreateRequest: async () => ({ ok: false, error: "Invalid request body.", status: 400 }),
        validateAndNormalizeMcpScopes: () => [],
    } as McpTokenRouteDependencies)

    assert.equal(response.status, 400)
    assert.equal((await readResponseBody(response)).error, "Invalid request body.")
})

test("POST maps invalid scopes to status 400", async () => {
    const request = new Request("http://visual-note.test/api/mcp/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "CI", scopes: ["visual-note:mcp:invalid"] }),
    })
    const response = await runMcpTokenCreate(auth, request, {
        getTokenStore: () => ({}) as never,
        listMcpTokens: async () => {
            throw new Error("should not be called")
        },
        parseMcpTokenCreateRequest: async () => ({ ok: true, name: "CI", scopes: ["visual-note:mcp:invalid"] as unknown }),
        validateAndNormalizeMcpScopes: () => {
            throw new InvalidMcpScopeError()
        },
        createMcpToken: async () => {
            throw new Error("should not be called")
        },
    } as McpTokenRouteDependencies)

    assert.equal(response.status, 400)
    const body = await readResponseBody(response)
    assert.equal(body.error.includes("MCP token scopes must include at least one valid scope"), true)
})

test("POST returns created token payload with 201", async () => {
    const request = new Request("http://visual-note.test/api/mcp/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "CI", scopes: ["visual-note:mcp:read"] }),
    })
    const created = {
        token: "vn_mcp_123",
        record: {
            id: "token-1",
            userId: "user-1",
            name: "CI",
            tokenPrefix: "vn_mcp_",
            scopes: ["visual-note:mcp:read"],
            lastUsedAt: null,
            revokedAt: null,
            expiresAt: null,
            createdAt: "2026-07-03T00:00:00.000Z",
            failedAttempts: 0,
            deniedAttempts: 0,
            lastAttemptAt: null,
        },
    }

    const response = await runMcpTokenCreate(auth, request, {
        getTokenStore: () => ({}) as never,
        listMcpTokens: async () => {
            throw new Error("should not be called")
        },
        createMcpToken: async () => created,
        parseMcpTokenCreateRequest: async () => ({ ok: true, name: "CI", scopes: ["visual-note:mcp:read"] as unknown }),
        validateAndNormalizeMcpScopes: () => ["visual-note:mcp:read"],
    } as McpTokenRouteDependencies)

    assert.equal(response.status, 201)
    assert.deepEqual(await readResponseBody(response), created)
})
