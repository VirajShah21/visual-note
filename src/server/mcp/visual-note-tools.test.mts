import assert from "node:assert/strict"
import test from "node:test"
import { mcpScopeRead, mcpScopeWrite } from "@server/mcp/token-store"
import { visualNoteToolDefinitions, type VisualNoteToolName } from "@server/mcp/visual-note-tools"
import { requestContextFrom, type ToolExtra } from "@server/mcp/visual-note-server-core"

const readToolPayload = async (name: VisualNoteToolName, scopes: string[]) => {
    const tool = visualNoteToolDefinitions.find(entry => entry.name === name)
    assert.equal(Boolean(tool), true)

    return tool!.handler({ viewId: "view-1" }, {
        authInfo: {
            token: "vn_mcp_fake",
            extra: {
                userId: "user-1",
                scopes,
                tokenId: "token-1",
            },
        },
    } as ToolExtra)
}

type ToolHandlerResult = ReturnType<NonNullable<(typeof visualNoteToolDefinitions)[number]["handler"]>>

const parsePayload = async (result: Awaited<ToolHandlerResult>) => {
    const text = result.content?.[0]?.text
    assert.equal(typeof text, "string")

    return JSON.parse(text)
}

test("read tools require read scope", async () => {
    const definitions = Object.fromEntries(visualNoteToolDefinitions.map(tool => [tool.name, tool.requiredScopes.requiredScopes])) as Record<VisualNoteToolName, string[]>

    assert.deepEqual(definitions.read_notebook, [mcpScopeRead])
    assert.deepEqual(definitions.read_article, [mcpScopeRead])
    assert.deepEqual(definitions.list_notebooks, [mcpScopeRead])
})

test("request context accepts top-level MCP auth scopes", () => {
    const context = requestContextFrom({
        token: "vn_mcp_fake",
        scopes: [mcpScopeRead],
        extra: {
            userId: "user-1",
            tokenId: "token-1",
        },
    })

    assert.deepEqual(context?.scopes, [mcpScopeRead])
})

test("request context treats missing MCP auth scopes as empty", () => {
    const context = requestContextFrom({
        token: "vn_mcp_fake",
        extra: {
            userId: "user-1",
            tokenId: "token-1",
        },
    })

    assert.deepEqual(context?.scopes, [])
})

test("write tools require write scope", () => {
    const definitions = Object.fromEntries(visualNoteToolDefinitions.map(tool => [tool.name, tool.requiredScopes.requiredScopes])) as Record<VisualNoteToolName, string[]>

    assert.deepEqual(definitions.create_article, [mcpScopeWrite])
    assert.deepEqual(definitions.create_notebook, [mcpScopeWrite])
    assert.deepEqual(definitions.replace_article_content, [mcpScopeWrite])
    assert.deepEqual(definitions.upsert_visual_block, [mcpScopeWrite])
    assert.deepEqual(definitions.remove_visual_block, [mcpScopeWrite])
})

test("read tool returns deterministic forbidden payload when scope is missing", async () => {
    const result = await readToolPayload("read_article", [mcpScopeWrite])
    const payload = await parsePayload(result)

    assert.equal(payload.ok, false)
    assert.equal(payload.error, "forbidden")
    assert.equal(payload.tool, "read_article")
    assert.deepEqual(payload.requiredScopes, [mcpScopeRead])
    assert.deepEqual(payload.scopeSatisfied, [mcpScopeWrite])
    assert.deepEqual(payload.missingScopes, [mcpScopeRead])
})

test("write tool returns deterministic forbidden payload when scope is missing", async () => {
    const result = await readToolPayload("create_article", [mcpScopeRead])
    const payload = await parsePayload(result)

    assert.equal(payload.ok, false)
    assert.equal(payload.error, "forbidden")
    assert.equal(payload.tool, "create_article")
    assert.deepEqual(payload.requiredScopes, [mcpScopeWrite])
    assert.deepEqual(payload.scopeSatisfied, [mcpScopeRead])
    assert.deepEqual(payload.missingScopes, [mcpScopeWrite])
})
