import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAppSession, findAppSessionByToken } from "./app-auth-store"
import { sessionNeedsRotation } from "./session-cookie"

const createSessionSupabase = () => {
    const operations: string[] = []
    const supabase = {
        from() {
            return {
                delete() {
                    operations.push("delete")
                    return this
                },
                insert() {
                    operations.push("insert")
                    return Promise.resolve({ error: null })
                },
                lte() {
                    operations.push("lte")
                    return Promise.resolve({ error: null })
                },
            }
        },
    } as unknown as SupabaseClient

    return { operations, supabase }
}

test("cleans expired sessions before issuing a new session", async () => {
    const { operations, supabase } = createSessionSupabase()

    const token = await createAppSession(supabase, "user-1")

    assert.equal(token.startsWith("vn_session_"), true)
    assert.deepEqual(operations, ["delete", "lte", "insert"])
})

test("revokes expired sessions during lookup", async () => {
    const operations: string[] = []
    const supabase = {
        from() {
            return {
                delete() {
                    operations.push("delete")
                    return this
                },
                eq() {
                    operations.push("eq")
                    return this
                },
                maybeSingle() {
                    operations.push("maybeSingle")
                    return Promise.resolve({
                        data: {
                            expires_at: "2000-01-01T00:00:00.000Z",
                            visual_note_users: { id: "user-1", email: "user@example.com", name: "User" },
                        },
                        error: null,
                    })
                },
                select() {
                    operations.push("select")
                    return this
                },
            }
        },
    } as unknown as SupabaseClient

    const session = await findAppSessionByToken(supabase, "expired-token")

    assert.equal(session, null)
    assert.deepEqual(operations, ["select", "eq", "maybeSingle", "delete", "eq"])
})

test("detects sessions that should rotate before expiry", () => {
    const now = new Date("2026-07-03T12:00:00.000Z").getTime()

    assert.equal(sessionNeedsRotation("2026-07-09T12:00:00.000Z", now), true)
    assert.equal(sessionNeedsRotation("2026-07-20T12:00:00.000Z", now), false)
})
