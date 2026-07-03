import assert from "node:assert/strict"
import test from "node:test"
import { parseMcpTokenCreateRequest } from "./route-contract"

const request = (body: unknown) =>
    new Request("http://visual-note.test/api/mcp/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
    })

test("rejects malformed MCP token payloads", async () => {
    const parsed = await parseMcpTokenCreateRequest(request("{"))

    assert.deepEqual(parsed, { ok: false, error: "Invalid request body.", status: 400 })
})

test("rejects non-array scope declarations", async () => {
    const parsed = await parseMcpTokenCreateRequest(request({ name: "CI", scopes: "visual-note:mcp:read" }))

    assert.deepEqual(parsed, { ok: false, error: "Scopes must be an array when provided.", status: 400 })
})

test("accepts valid MCP token body", async () => {
    const parsed = await parseMcpTokenCreateRequest(request({ name: "  CI Token  ", scopes: ["visual-note:mcp:read"] }))

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return

    assert.equal(parsed.name, "CI Token")
    assert.deepEqual(parsed.scopes, ["visual-note:mcp:read"])
})
