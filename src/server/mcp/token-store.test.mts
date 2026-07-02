import assert from "node:assert/strict"
import test from "node:test"
import { createMcpToken, InvalidMcpScopeError, listMcpTokens, logMcpToolAudit, legacyMcpScope, mcpScopeRead, mcpScopeWrite, validateAndNormalizeMcpScopes } from "@server/mcp/token-store"

type FakeInsertable = {
    from: (table: string) => {
        insert: (value: unknown) => Promise<{ data: null; error: null }>
    }
}

test("legacy token scope maps to read and write", () => {
    assert.deepEqual(validateAndNormalizeMcpScopes([legacyMcpScope]), [mcpScopeRead, mcpScopeWrite])
})

test("missing read scope is rejected by tool contract in practice", () => {
    assert.deepEqual(validateAndNormalizeMcpScopes([mcpScopeWrite]), [mcpScopeWrite])
})

test("invalid explicit token scopes are rejected", () => {
    assert.throws(() => validateAndNormalizeMcpScopes(["visual-note:mcp:reed"]), InvalidMcpScopeError)
    assert.throws(() => validateAndNormalizeMcpScopes([]), InvalidMcpScopeError)
    assert.throws(() => validateAndNormalizeMcpScopes("visual-note:mcp:read"), InvalidMcpScopeError)
})

test("omitted token scopes default to read and write", async () => {
    const inserted: unknown[] = []
    const fakeSupabase = {
        from: () => ({
            insert: (event: unknown) => {
                inserted.push(event)
                return {
                    select: () => ({
                        single: () =>
                            Promise.resolve({
                                data: {
                                    id: "token-1",
                                    user_id: "user-1",
                                    name: "Codex",
                                    token_prefix: "vn_mcp_fake",
                                    scopes: [mcpScopeRead, mcpScopeWrite],
                                    last_used_at: null,
                                    revoked_at: null,
                                    expires_at: null,
                                    created_at: "2026-07-02T00:00:00.000Z",
                                },
                                error: null,
                            }),
                    }),
                }
            },
        }),
    }

    await createMcpToken(fakeSupabase as never, "user-1", "Codex")

    assert.deepEqual((inserted[0] as { scopes: string[] }).scopes, [mcpScopeRead, mcpScopeWrite])
})

test("logs forbidden and success audit entries", async () => {
    const inserted: unknown[] = []
    const fakeSupabase = {
        from: () => ({
            insert: (event: unknown) => {
                inserted.push(event)
                return Promise.resolve({ data: null, error: null })
            },
        }),
    } as unknown as FakeInsertable

    const tokenId = "token-1"
    const userId = "user-1"
    await logMcpToolAudit(fakeSupabase as never, {
        tokenId,
        userId,
        toolName: "read_article",
        scopeRequired: [mcpScopeRead],
        scopeSatisfied: [mcpScopeRead],
        success: false,
        denialReason: "missing_scope:read",
    })
    await logMcpToolAudit(fakeSupabase as never, {
        tokenId,
        userId,
        toolName: "read_article",
        scopeRequired: [mcpScopeRead],
        scopeSatisfied: [mcpScopeRead],
        success: true,
    })

    assert.equal(inserted.length, 2)
    const denied = inserted[0] as { success: boolean; denial_reason: string | null }
    const success = inserted[1] as { success: boolean; denial_reason: string | null }
    assert.equal(denied.success, false)
    assert.equal(success.success, true)
    assert.equal(typeof denied.denial_reason, "string")
    assert.equal(success.denial_reason, null)
})

test("lists token audit metadata without loading full audit rows", async () => {
    const tokenId = "token-1"
    const userId = "user-1"
    const auditSelects: string[] = []

    const query = (result: unknown, trackSelect = false) => {
        const builder = {
            select: (columns: string) => {
                if (trackSelect) auditSelects.push(columns)
                return builder
            },
            eq: () => builder,
            like: () => builder,
            not: () => builder,
            order: () => builder,
            limit: () => builder,
            maybeSingle: () => Promise.resolve(result),
            then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
        }

        return builder
    }

    const fakeSupabase = {
        from: (table: string) => {
            if (table === "visual_note_mcp_tokens")
                return query({
                    data: [
                        {
                            id: tokenId,
                            user_id: userId,
                            name: "Codex",
                            token_prefix: "vn_mcp_fake",
                            scopes: [mcpScopeRead],
                            last_used_at: null,
                            revoked_at: null,
                            expires_at: null,
                            created_at: "2026-07-02T00:00:00.000Z",
                        },
                    ],
                    error: null,
                })

            const nextResult =
                auditSelects.length === 0
                    ? { count: 2, error: null }
                    : auditSelects.length === 1
                      ? { count: 1, error: null }
                      : { data: { created_at: "2026-07-02T01:00:00.000Z" }, error: null }

            return query(nextResult, true)
        },
    }

    const tokens = await listMcpTokens(fakeSupabase as never, userId)

    assert.equal(tokens[0]?.failedAttempts, 2)
    assert.equal(tokens[0]?.deniedAttempts, 1)
    assert.equal(tokens[0]?.lastAttemptAt, "2026-07-02T01:00:00.000Z")
    assert.deepEqual(auditSelects, ["id", "id", "created_at"])
})
