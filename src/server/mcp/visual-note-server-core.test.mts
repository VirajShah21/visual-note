import assert from "node:assert/strict"
import test from "node:test"
import { mcpScopeRead, mcpScopeWrite } from "./token-store"
import { requestContextFrom, scopeDeniedPayload, withWorkspaceMutation, withWorkspaceReadResult } from "./visual-note-server-core"
import type { ToolExtra } from "./visual-note-server-core"

const testScopes: unknown[] = ["visual-note:mcp:read", "visual-note:mcp:write"]

test("requestContextFrom returns null when auth token is missing", () => {
    const context = requestContextFrom({
        token: "",
        clientId: "client-1",
        scopes: [],
        extra: {
            userId: "user-1",
        },
    })

    assert.equal(context, null)
})

test("requestContextFrom returns context when token and user are present", () => {
    const context = requestContextFrom({
        token: "vn_mcp_fake",
        clientId: "client-1",
        scopes: ["visual-note:mcp:read", "visual-note:mcp:write"],
        extra: {
            userId: "user-1",
            tokenId: "token-1",
            scopes: testScopes,
        },
    })

    assert.equal(context?.userId, "user-1")
    assert.deepEqual(context?.scopes, testScopes)
    assert.equal(context?.tokenId, "token-1")
})

test("scopeDeniedPayload includes deterministic missing fields", () => {
    const payload = scopeDeniedPayload("read_article", ["visual-note:mcp:read"], ["visual-note:mcp:read"], [])

    const parsed = JSON.parse(payload.content[0].text)
    assert.equal(parsed.ok, false)
    assert.equal(parsed.error, "forbidden")
    assert.deepEqual(parsed.requiredScopes, ["visual-note:mcp:read"])
    assert.deepEqual(parsed.missingScopes, ["visual-note:mcp:read"])
    assert.deepEqual(parsed.scopeSatisfied, [])
    assert.equal(parsed.tool, "read_article")
})

test("withWorkspaceReadResult blocks tools lacking read scope", async () => {
    const authInfo = { token: "vn_mcp_test", clientId: "client-1", scopes: [mcpScopeWrite], extra: { userId: "user-1", scopes: [mcpScopeWrite] } }
    const payload = await withWorkspaceReadResult({ authInfo } as unknown as ToolExtra, () => ({ ok: true, value: { allowed: true } }) as const, {
        toolName: "read_notebook",
        requiredScopes: [mcpScopeRead],
    })

    const parsed = JSON.parse(payload.content[0].text)
    assert.equal(parsed.ok, false)
    assert.equal(parsed.error, "forbidden")
    assert.deepEqual(parsed.missingScopes, [mcpScopeRead])
    assert.equal(parsed.requiredScopes[0], mcpScopeRead)
})

test("withWorkspaceMutation blocks tools lacking write scope", async () => {
    const authInfo = { token: "vn_mcp_test", clientId: "client-1", scopes: [mcpScopeRead], extra: { userId: "user-1", scopes: [mcpScopeRead] } }
    const payload = await withWorkspaceMutation(
        { authInfo } as unknown as ToolExtra,
        () => ({ ok: true, value: { workspace: { notebooks: [], pages: [], topics: [], views: [] } } }) as const,
        {
            toolName: "create_article",
            requiredScopes: [mcpScopeRead, mcpScopeWrite],
        },
    )

    const parsed = JSON.parse(payload.content[0].text)
    assert.equal(parsed.ok, false)
    assert.equal(parsed.error, "forbidden")
    assert.deepEqual(parsed.missingScopes, [mcpScopeWrite])
})
