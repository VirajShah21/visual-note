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

const captureFetchRequest = async (revision: string, status = 200, body: unknown = { revision: "revision-after-save", ok: true }) => {
    const requests: Request[] = []
    const mock = async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init)
        requests.push(request)

        return createMockResponse(status, {
            ...body,
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

test("trims whitespace from revision before sending If-Match", async () => {
    const { requests } = await captureFetchRequest("  revision-456  ")

    assert.equal(requests[0]?.headers.get("if-match"), '"revision-456"')
})

test("requires revision before saving", async () => {
    await assert.rejects(
        () =>
            saveVisualNoteWorkspace(workspace as never, {
                revision: null,
            } as never),
        error => {
            assert.equal((error as Error).message, "Workspace revision is required before saving.")
            return true
        },
    )
})

test("throws a typed status error when saving workspace fails", async () => {
    await assert.rejects(
        () => captureFetchRequest("revision-123", 500, { error: "Unable to save workspace." }),
        error => {
            assert.equal((error as { status?: number }).status, 500)
            assert.match((error as Error).message, /Unable to save workspace/)
            return true
        },
    )
})

test("preserves conflict status when workspace save is rejected", async () => {
    await assert.rejects(
        () => captureFetchRequest("revision-123", 409, { error: "Workspace conflict" }),
        error => {
            assert.equal((error as { status?: number }).status, 409)
            assert.equal((error as Error).message, "Workspace conflict")
            return true
        },
    )
})
