import assert from "node:assert/strict"
import test from "node:test"
import { runAssetSignGet } from "./route"
import type { AssetSignRouteDependencies } from "./route"

const authContext = {
    userId: "user-1",
    supabase: {} as never,
}

const readResponseBody = async (response: Response) => response.json()

const makeDependencies = (overrides: Partial<AssetSignRouteDependencies> = {}): AssetSignRouteDependencies => ({
    authenticateSupabaseMutationRequest: async () => authContext as never,
    createSignedAssetUrl: (assetId, expiresAt) => `/api/assets/${assetId}?exp=${expiresAt}&sig=abc`,
    getSupabaseServiceRoleClient: () => ({}) as never,
    loadAssetStorage: async () => ({
        asset: {
            id: "asset-1",
            notebookId: "notebook-1",
            bucketName: "bucket",
            objectKey: "notebooks/notebook-1/image.png",
            contentType: "image/png",
            fileName: "image.png",
            byteSize: 4,
        },
        connection: {
            endpointUrl: "https://s3.example",
            region: "us-east-1",
            forcePathStyle: false,
            accessKeyId: "AKIA",
            secretAccessKey: "SECRET",
        },
    }),
    ...overrides,
})

test("GET signs a private asset URL", async () => {
    const response = await runAssetSignGet(new Request("https://visual-note.test/api/assets/asset-1/sign?ttlSeconds=180"), { params: Promise.resolve({ assetId: "asset-1" }) } as any, makeDependencies())

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.ttlSeconds, 180)
    assert.equal(typeof body.url, "string")
})

test("GET maps unsigned storage access to 404", async () => {
    const response = await runAssetSignGet(new Request("https://visual-note.test/api/assets/missing/sign"), { params: Promise.resolve({ assetId: "missing" }) } as any, {
        ...makeDependencies(),
        loadAssetStorage: async () => null,
    })

    assert.equal(response.status, 404)
    assert.equal((await readResponseBody(response)).error, "Asset not found.")
})

test("GET maps missing signing secret to 503", async () => {
    const response = await runAssetSignGet(new Request("https://visual-note.test/api/assets/asset-1/sign"), { params: Promise.resolve({ assetId: "asset-1" }) } as any, {
        ...makeDependencies(),
        createSignedAssetUrl: () => "",
    })

    assert.equal(response.status, 503)
    assert.equal((await readResponseBody(response)).error, "Asset signing is not configured.")
})

test("GET maps missing storage service to 503", async () => {
    const response = await runAssetSignGet(new Request("https://visual-note.test/api/assets/asset-1/sign"), { params: Promise.resolve({ assetId: "asset-1" }) } as any, {
        ...makeDependencies(),
        getSupabaseServiceRoleClient: () => null,
    })

    assert.equal(response.status, 503)
    assert.equal((await readResponseBody(response)).error, "Server database access is not configured for storage routes.")
})
