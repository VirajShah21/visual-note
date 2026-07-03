import assert from "node:assert/strict"
import test from "node:test"
import { runAssetsPost } from "./route"
import type { AssetUploadRouteDependencies } from "./route"

const authContext = {
    userId: "user-1",
    supabase: {} as never,
}

type AssetEvent = { event: string; metadata?: Record<string, unknown>; severity?: string }

const makeFile = (name = "image.png", type = "image/png", size = 3) => new File([new Uint8Array(size)], name, { type })

const readResponseBody = async (response: Response) => response.json()

const makeUploadRequest = (body = "image") =>
    new Request("http://visual-note.test/api/notebooks/notebook-1/assets", {
        method: "POST",
        body,
        headers: { "content-length": String(body.length), "content-type": "multipart/form-data; boundary=boundary" },
    })

const makeDependencies = (overrides: Partial<AssetUploadRouteDependencies> = {}, events: AssetEvent[] = []) => ({
    createAssetObjectKey: () => "notebook-1/images/object-key",
    createAssetRecord: async () => ({ id: "asset-1", objectKey: "object-key", contentType: "image/png", fileName: "image.png", byteSize: 3 }),
    getSupabaseServiceRoleClient: () => ({}) as never,
    parseAssetUploadRequest: async () => ({
        ok: true,
        file: makeFile(),
    }),
    recordVisualNoteEvent: entry => {
        events.push(entry)
    },
    resolveNotebookStorage: async () => ({
        notebookId: "notebook-1",
        userId: "user-1",
        connectionId: "connection-1",
        bucketName: "bucket",
        connection: {
            endpointUrl: "",
            region: "us-east-1",
            forcePathStyle: false,
            accessKeyId: "AKIA",
            secretAccessKey: "SECRET",
        },
    }),
    userOwnsNotebook: async () => true,
    uploadS3Object: async () => {},
    validateImageUpload: () => null,
    ...overrides,
} as AssetUploadRouteDependencies)

test("POST stores image uploads and returns asset payload", async () => {
    const response = await runAssetsPost(authContext, makeUploadRequest(), "notebook-1", makeDependencies())

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.asset.id, "asset-1")
    assert.equal(body.asset.url, "/api/assets/asset-1")
})

test("POST maps unauthorized notebook access to 404", async () => {
    const response = await runAssetsPost(authContext, makeUploadRequest(), "notebook-1", {
        ...makeDependencies(),
        userOwnsNotebook: async () => false,
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await readResponseBody(response), { error: "Notebook not found." })
})

test("POST maps missing storage service access to 503", async () => {
    const response = await runAssetsPost(authContext, makeUploadRequest(), "notebook-1", {
        ...makeDependencies(),
        getSupabaseServiceRoleClient: () => null,
    })

    assert.equal(response.status, 503)
    assert.deepEqual(await readResponseBody(response), { error: "Server database access is not configured for storage routes." })
})

test("POST maps rejected upload payloads", async () => {
    const response = await runAssetsPost(authContext, makeUploadRequest(), "notebook-1", {
        ...makeDependencies(),
        parseAssetUploadRequest: async () => ({ ok: false, error: "Image file is required.", status: 400 }),
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await readResponseBody(response), { error: "Image file is required." })
})

test("POST blocks missing notebook storage configuration", async () => {
    const response = await runAssetsPost(authContext, makeUploadRequest(), "notebook-1", {
        ...makeDependencies(),
        resolveNotebookStorage: async () => null,
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await readResponseBody(response), { error: "Configure notebook storage before uploading images." })
})

test("POST maps upload validation failures", async () => {
    const response = await runAssetsPost(authContext, makeUploadRequest(), "notebook-1", {
        ...makeDependencies(),
        validateImageUpload: () => ({ message: "Unsupported image type.", status: 415 }),
    })

    assert.equal(response.status, 415)
    assert.equal((await readResponseBody(response)).error, "Unsupported image type.")
})

test("POST records validation rejection events", async () => {
    const events: AssetEvent[] = []
    const response = await runAssetsPost(authContext, makeUploadRequest(), "notebook-1", {
        ...makeDependencies({}, events),
        validateImageUpload: () => ({ message: "Unsupported image type.", status: 415 }),
    })

    assert.equal(response.status, 415)
    assert.equal(events.some(item => item.event === "asset.upload_rejected"), true)
})

test("POST maps upload errors to status 500", async () => {
    const response = await runAssetsPost(authContext, makeUploadRequest(), "notebook-1", {
        ...makeDependencies(),
        uploadS3Object: async () => {
            throw new Error("upload failed")
        },
    })

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "upload failed")
})

test("POST records upload failures", async () => {
    const events: AssetEvent[] = []
    const response = await runAssetsPost(authContext, makeUploadRequest(), "notebook-1", {
        ...makeDependencies({}, events),
        uploadS3Object: async () => {
            throw new Error("upload failed")
        },
    })

    assert.equal(response.status, 500)
    assert.equal(events.some(item => item.event === "asset.upload_failed"), true)
})

test("POST maps asset record failures to status 500", async () => {
    const response = await runAssetsPost(authContext, makeUploadRequest(), "notebook-1", {
        ...makeDependencies(),
        createAssetRecord: async () => {
            throw new Error("db down")
        },
    })

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "db down")
})
