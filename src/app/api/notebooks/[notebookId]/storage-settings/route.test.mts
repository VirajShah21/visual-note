import assert from "node:assert/strict"
import test from "node:test"
import { runStorageSettingsGet, runStorageSettingsPut } from "./route"
import type { NotebookStorageSettingsInput } from "@/lib/visual-note/storage-settings"
import type { StorageSettingsRouteDependencies } from "./route"

const authContext = {
    userId: "user-1",
    supabase: {} as never,
}

const readResponseBody = async (response: Response) => response.json()

const baseInput: NotebookStorageSettingsInput = {
    connectionId: "connection-1",
        connectionName: "MinIO",
    region: "us-east-1",
    accessKeyId: "access-1",
    secretAccessKey: "secret",
    bucketName: "bucket",
    endpointUrl: "https://minio.local",
    forcePathStyle: false,
}

const makeRequest = () =>
    new Request("http://visual-note.test/api/notebooks/notebook-1/storage-settings", {
        method: "PUT",
        body: JSON.stringify(baseInput),
        headers: { "content-type": "application/json" },
    })

const makeDependencies = (overrides: Partial<StorageSettingsRouteDependencies> = {}): StorageSettingsRouteDependencies => ({
    getSupabaseServiceRoleClient: () => ({}) as never,
    loadNotebookStorageSettings: async () => ({
        connectionId: "connection-1",
        connectionName: "MinIO",
        region: "us-east-1",
        endpointUrl: "",
        forcePathStyle: false,
        accessKeyId: "access-1",
        hasSecretAccessKey: true,
        bucketName: "bucket",
    }),
    saveNotebookStorageSettings: async () => ({
        connectionId: "connection-1",
        connectionName: "MinIO",
        region: "us-east-1",
        endpointUrl: "",
        forcePathStyle: false,
        accessKeyId: "access-1",
        hasSecretAccessKey: true,
        bucketName: "bucket",
    }),
    parseStorageSettingsRequest: async () => ({ ok: true, input: baseInput }),
    userOwnsNotebook: async () => true,
    ...overrides,
})

test("GET returns configured notebook storage settings", async () => {
    const response = await runStorageSettingsGet(authContext, "notebook-1", makeDependencies())

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.settings.bucketName, "bucket")
})

test("GET maps missing notebook ownership to 404", async () => {
    const response = await runStorageSettingsGet(authContext, "notebook-1", {
        ...makeDependencies(),
        userOwnsNotebook: async () => false,
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await readResponseBody(response), { error: "Notebook not found." })
})

test("GET maps missing storage client to 503", async () => {
    const response = await runStorageSettingsGet(authContext, "notebook-1", {
        ...makeDependencies(),
        getSupabaseServiceRoleClient: () => null,
    })

    assert.equal(response.status, 503)
    assert.deepEqual(await readResponseBody(response), { error: "Server database access is not configured for storage routes." })
})

test("GET maps storage load failures to 500", async () => {
    const response = await runStorageSettingsGet(authContext, "notebook-1", {
        ...makeDependencies(),
        loadNotebookStorageSettings: async () => {
            throw new Error("read failed")
        },
    })

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "read failed")
})

test("PUT maps validation failures to status", async () => {
    const response = await runStorageSettingsPut(authContext, makeRequest(), "notebook-1", {
        ...makeDependencies(),
        parseStorageSettingsRequest: async () => ({ ok: false, error: "Invalid storage settings payload.", status: 400 }),
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await readResponseBody(response), { error: "Invalid storage settings payload." })
})

test("PUT writes storage settings and returns stored values", async () => {
    const response = await runStorageSettingsPut(authContext, makeRequest(), "notebook-1", makeDependencies())

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.settings.bucketName, "bucket")
})
test("PUT maps missing storage config to 503", async () => {
    const response = await runStorageSettingsPut(authContext, makeRequest(), "notebook-1", {
        ...makeDependencies(),
        getSupabaseServiceRoleClient: () => null,
    })

    assert.equal(response.status, 503)
    assert.deepEqual(await readResponseBody(response), { error: "Server database access is not configured for storage routes." })
})

test("PUT maps duplicate save conflicts to status 409", async () => {
    const response = await runStorageSettingsPut(authContext, makeRequest(), "notebook-1", {
        ...makeDependencies(),
        saveNotebookStorageSettings: async () => {
            throw new Error("duplicate key value violates unique constraint")
        },
    })

    assert.equal(response.status, 409)
    assert.equal((await readResponseBody(response)).error, "duplicate key value violates unique constraint")
})

test("PUT maps unknown save failures to status 500", async () => {
    const response = await runStorageSettingsPut(authContext, makeRequest(), "notebook-1", {
        ...makeDependencies(),
        saveNotebookStorageSettings: async () => {
            throw new Error("unable to save")
        },
    })

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "unable to save")
})
