import assert from "node:assert/strict"
import test from "node:test"
import { saveVisualNoteWorkspace } from "./workspace-api"

const workspace = {
    notebooks: [],
    pages: [],
    topics: [],
    views: [],
}

const createMockResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    })

const captureFetchRequest = async (revision: string | null, status = 200) => {
    const requests: Request[] = []
    const mock = async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init)
        requests.push(request)

        return createMockResponse(status, {
            revision: "revision-after-save",
            ok: true,
        })
    }

    const previous = globalThis.fetch
    globalThis.fetch = mock as typeof fetch

    try {
        const result = await saveVisualNoteWorkspace(workspace as never, { revision })
        return { requests, result }
    } finally {
        globalThis.fetch = previous
    }
}

test("includes If-Match header when revision is provided", async () => {
    const { requests } = await captureFetchRequest("revision-123")

    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.headers.get("if-match"), '"revision-123"')
})

test("does not include If-Match header when revision is absent", async () => {
    const { requests } = await captureFetchRequest(null)

    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.headers.get("if-match"), null)
})

test("trims whitespace from revision before sending If-Match", async () => {
    const { requests } = await captureFetchRequest("  revision-456  ")

    assert.equal(requests[0]?.headers.get("if-match"), '"revision-456"')
})
