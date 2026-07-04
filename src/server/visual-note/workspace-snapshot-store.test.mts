import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { listWorkspaceSnapshotsForUser, upsertWorkspaceSnapshotsForUser } from "./workspace-snapshot-store"
import type { WorkspaceSnapshot } from "@/lib/visual-note/types"

const snapshotWorkspace = {
    notebooks: [],
    pages: [],
    topics: [],
    views: [],
}

test("loads durable workspace snapshots in creation order", async () => {
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
                        data: [{ id: "snapshot-1", name: "Before publish", note: null, created_at: "2026-07-03T12:00:00.000Z", workspace: snapshotWorkspace }],
                        error: null,
                    })
                },
            }
        },
    } as unknown as SupabaseClient

    const snapshots = await listWorkspaceSnapshotsForUser(supabase, "user-1")

    assert.deepEqual(snapshots, [{ id: "snapshot-1", name: "Before publish", note: undefined, createdAt: "2026-07-03T12:00:00.000Z", workspace: snapshotWorkspace }])
})

test("persists workspace snapshots without nested snapshot payloads", async () => {
    let payload: unknown
    const supabase = {
        from() {
            return {
                upsert(nextPayload: unknown) {
                    payload = nextPayload
                    return Promise.resolve({ error: null })
                },
                select() {
                    return this
                },
                eq() {
                    return Promise.resolve({ data: [{ id: "snapshot-1" }], error: null })
                },
            }
        },
    } as unknown as SupabaseClient
    const snapshots: WorkspaceSnapshot[] = [
        {
            id: "snapshot-1",
            name: "Before repair",
            note: "Manual checkpoint",
            createdAt: "2026-07-03T12:00:00.000Z",
            workspace: snapshotWorkspace,
        },
    ]

    await upsertWorkspaceSnapshotsForUser(supabase, "user-1", snapshots)

    assert.equal(Array.isArray(payload), true)
    assert.deepEqual((payload as Array<Record<string, unknown>>)[0], {
        id: "snapshot-1",
        user_id: "user-1",
        name: "Before repair",
        note: "Manual checkpoint",
        created_at: "2026-07-03T12:00:00.000Z",
        workspace: snapshotWorkspace,
    })
})
