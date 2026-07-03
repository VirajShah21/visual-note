import assert from "node:assert/strict"
import test from "node:test"
import { runAssetCleanup } from "./route"

type AssetCleanupDependencies = Parameters<typeof runAssetCleanup>[1]

type TestEvent = {
    event: string
}

test("POST returns 503 when maintenance token is not configured", async () => {
    const response = await runAssetCleanup(new Request("http://visual-note.test/api/maintenance/assets", { method: "POST" }), {
        cleanupWorkspaceAssetOrphans: async () => ({ deletedReferencedAssets: 0, deletedMissingNotebookAssets: 0, deletedAssetRecords: 0 }),
        cleanupWorkspaceAssetOrphansForAllUsers: async () => ({
            usersScanned: 0,
            deletedReferencedAssets: 0,
            deletedMissingNotebookAssets: 0,
            deletedAssetRecords: 0,
        }),
        getMaintenanceToken: () => undefined,
        getSupabaseServiceRoleClient: () => ({} as never),
        recordVisualNoteEvent: () => {},
    } as unknown as AssetCleanupDependencies)

    assert.equal(response.status, 503)
})

test("POST rejects missing maintenance token", async () => {
    const response = await runAssetCleanup(new Request("http://visual-note.test/api/maintenance/assets", { method: "POST" }), {
        cleanupWorkspaceAssetOrphans: async () => ({ deletedReferencedAssets: 0, deletedMissingNotebookAssets: 0, deletedAssetRecords: 0 }),
        cleanupWorkspaceAssetOrphansForAllUsers: async () => ({
            usersScanned: 0,
            deletedReferencedAssets: 0,
            deletedMissingNotebookAssets: 0,
            deletedAssetRecords: 0,
        }),
        getMaintenanceToken: () => "maintenance-token",
        getSupabaseServiceRoleClient: () => ({} as never),
        recordVisualNoteEvent: () => {},
    } as unknown as AssetCleanupDependencies)

    assert.equal(response.status, 401)
})

test("POST validates ISO update cutoff date", async () => {
    const response = await runAssetCleanup(
        new Request("http://visual-note.test/api/maintenance/assets", {
            method: "POST",
            headers: { "x-maintenance-token": "maintenance-token" },
            body: JSON.stringify({ deleteUpdatedBefore: "not-a-date" }),
        }),
        {
            cleanupWorkspaceAssetOrphans: async () => ({ deletedReferencedAssets: 0, deletedMissingNotebookAssets: 0, deletedAssetRecords: 0 }),
            cleanupWorkspaceAssetOrphansForAllUsers: async () => ({
                usersScanned: 0,
                deletedReferencedAssets: 0,
                deletedMissingNotebookAssets: 0,
                deletedAssetRecords: 0,
            }),
            getMaintenanceToken: () => "maintenance-token",
            getSupabaseServiceRoleClient: () => ({} as never),
            recordVisualNoteEvent: () => {},
        } as unknown as AssetCleanupDependencies,
    )

    assert.equal(response.status, 400)
})

test("POST runs global cleanup and emits event", async () => {
    const events: TestEvent[] = []

    const response = await runAssetCleanup(
        new Request("http://visual-note.test/api/maintenance/assets", {
            method: "POST",
            headers: { "x-maintenance-token": "maintenance-token" },
        }),
        {
            cleanupWorkspaceAssetOrphans: async () => ({ deletedReferencedAssets: 0, deletedMissingNotebookAssets: 0, deletedAssetRecords: 0 }),
            cleanupWorkspaceAssetOrphansForAllUsers: async () => ({
                usersScanned: 3,
                deletedReferencedAssets: 4,
                deletedMissingNotebookAssets: 6,
                deletedAssetRecords: 10,
            }),
            getMaintenanceToken: () => "maintenance-token",
            getSupabaseServiceRoleClient: () => ({} as never),
            recordVisualNoteEvent: event => {
                events.push(event)
            },
        } as unknown as AssetCleanupDependencies,
    )

    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.usersScanned, 3)
    assert.equal(body.deletedAssetRecords, 10)
    assert.equal(events.some(item => item.event === "assets.cleanup_executed"), true)
})
