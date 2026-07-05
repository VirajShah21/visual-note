import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { listNotebooksForUser, upsertNotebooks } from "./notebook-store"

test("loads durable notebook publish metadata", async () => {
    const supabase = {
        from() {
            return {
                select() {
                    return this
                },
                eq() {
                    return this
                },
                order() {
                    return Promise.resolve({
                        data: [
                            {
                                id: "notebook-1",
                                user_id: "user-1",
                                title: "Published",
                                slug: "published",
                                summary: "Ready",
                                color: "#2f7d5c",
                                published: true,
                                published_at: "2026-07-02T12:00:00.000Z",
                                editor_settings: {},
                                created_at: "2026-07-01T12:00:00.000Z",
                            },
                        ],
                        error: null,
                    })
                },
            }
        },
    } as unknown as SupabaseClient

    const notebooks = await listNotebooksForUser(supabase, "user-1")

    assert.equal(notebooks[0]?.published, true)
    assert.equal(notebooks[0]?.publishedAt, "2026-07-02T12:00:00.000Z")
})

test("persists notebook publish metadata on upsert", async () => {
    let payload: unknown
    const supabase = {
        from() {
            return {
                upsert(nextPayload: unknown) {
                    payload = nextPayload
                    return Promise.resolve({ error: null })
                },
            }
        },
    } as unknown as SupabaseClient

    await upsertNotebooks(supabase, "user-1", [
        {
            id: "notebook-1",
            userId: "user-1",
            title: "Published",
            slug: "published",
            summary: "Ready",
            color: "#2f7d5c",
            published: true,
            publishedAt: "2026-07-02T12:00:00.000Z",
            createdAt: "2026-07-01T12:00:00.000Z",
        },
    ])

    assert.equal(Array.isArray(payload), true)
    assert.equal((payload as Array<Record<string, unknown>>)[0]?.published, true)
    assert.equal((payload as Array<Record<string, unknown>>)[0]?.published_at, "2026-07-02T12:00:00.000Z")
})
