import assert from "node:assert/strict"
import { Readable } from "node:stream"
import test from "node:test"
import { runAssetGet, type AssetRouteDependencies } from "./route"

const authContext = {
    userId: "user-1",
    supabase: {} as never,
}

const readResponseBody = async (response: Response) => response.json()

const createSignedRequest = (assetId: string, expiresAt = "2099-01-01T00:00:00.000Z") => {
    const exp = new Date(expiresAt).getTime()
    const body = `${assetId}-${exp}`
    const signature = Buffer.from(body).toString("hex")
    return new Request(`https://visual-note.test/api/assets/${assetId}?exp=${exp}&sig=${signature}`)
}

const makeDependencies = (overrides: Partial<AssetRouteDependencies> = {}): AssetRouteDependencies => ({
    authenticateSupabaseMutationRequest: async () => authContext as never,
    authenticateSupabaseRequest: async () => authContext as never,
    deleteS3Object: async () => {},
    getSupabaseServiceRoleClient: () =>
        ({
            from: () => ({
                delete: () => ({
                    eq: () => ({
                        eq: () => ({
                            select: () => ({
                                maybeSingle: async () => ({ data: { id: "asset-1" }, error: null }),
                            }),
                        }),
                    }),
                }),
            }),
        }) as never,
    isAssetRequestAllowedByOrigin: () => true,
    isAllowedImageContentType: () => true,
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
    loadSignedAssetStorage: async () => ({
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
    readS3Object: async () => ({
        body: Readable.from([Buffer.from("abcd")]),
        contentType: "image/png",
        contentLength: 4,
    }),
    recordVisualNoteEvent: () => {},
    verifySignedAssetRequest: () => false,
    ...overrides,
})

test("GET returns asset stream on successful private read", async () => {
    const response = await runAssetGet(new Request("https://visual-note.test/api/assets/asset-1"), { params: Promise.resolve({ assetId: "asset-1" }) } as any, {
        ...makeDependencies(),
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-type"), "image/png")
})

test("GET rejects cross-site unsigned reads", async () => {
    const response = await runAssetGet(
        new Request("https://visual-note.test/api/assets/asset-1", {
            headers: { "sec-fetch-site": "cross-site", Origin: "https://evil.example" },
        }),
        { params: Promise.resolve({ assetId: "asset-1" }) } as any,
        makeDependencies({
            isAssetRequestAllowedByOrigin: () => false,
        }),
    )

    assert.equal(response.status, 403)
    assert.equal((await readResponseBody(response)).error, "Asset request blocked due to cross-site access.")
})

test("GET allows signed requests even from cross-site referers", async () => {
    const response = await runAssetGet(
        createSignedRequest("asset-1"),
        { params: Promise.resolve({ assetId: "asset-1" }) } as any,
        makeDependencies({ verifySignedAssetRequest: () => true }),
    )

    assert.equal(response.status, 200)
})

test("GET maps unsupported types to status 415", async () => {
    const response = await runAssetGet(new Request("https://visual-note.test/api/assets/asset-1"), { params: Promise.resolve({ assetId: "asset-1" }) } as any, {
        ...makeDependencies(),
        isAllowedImageContentType: () => false,
    })

    assert.equal(response.status, 415)
    assert.equal((await readResponseBody(response)).error, "Asset type is not supported for private delivery.")
})

test("GET maps not found to status 404", async () => {
    const response = await runAssetGet(new Request("https://visual-note.test/api/assets/missing"), { params: Promise.resolve({ assetId: "missing" }) } as any, {
        ...makeDependencies(),
        loadAssetStorage: async () => null,
    })

    assert.equal(response.status, 404)
    assert.equal((await readResponseBody(response)).error, "Asset not found.")
})
