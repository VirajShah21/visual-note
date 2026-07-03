import assert from "node:assert/strict"
import test from "node:test"
import { requestContextFrom, scopeDeniedPayload } from "./visual-note-server-core"

const testScopes: unknown[] = ["visual-note:mcp:read", "visual-note:mcp:write"]

test("requestContextFrom returns null when auth token is missing", () => {
    const context = requestContextFrom({
        token: "",
        extra: {
            userId: "user-1",
        },
    })

    assert.equal(context, null)
})

test("requestContextFrom returns context when token and user are present", () => {
    const context = requestContextFrom({
        token: "vn_mcp_fake",
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
