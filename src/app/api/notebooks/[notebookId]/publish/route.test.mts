import assert from "node:assert/strict"
import test from "node:test"
import { runPublishPost, type PublishRouteDependencies } from "./route"

const authContext = {
    userId: "user-1",
    supabase: {} as never,
}

const readResponseBody = async (response: Response) => response.json()

const makeRequest = (body: unknown) =>
    new Request("http://visual-note.test/api/notebooks/notebook-1/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
    })

const publishedNotebook = {
    id: "notebook-1",
    userId: "user-1",
    title: "Notebook",
    slug: "notebook",
    summary: "",
    color: "#fff",
    createdAt: "2026-01-01T00:00:00.000Z",
    published: true,
}

const makeDependencies = (overrides: Partial<PublishRouteDependencies> = {}): PublishRouteDependencies => ({
    exportPublishBundle: () => ({
        ok: true,
        value: {
            notebookId: "notebook-1",
            notebookTitle: "Notebook",
            markdown: "# Title",
            web: "<html></html>",
            json: JSON.stringify({ notebook: {} }),
            diagnostics: { includeHtml: true, includeJson: true, manifestHash: "abc" },
        },
    }),
    loadWorkspaceForUser: async () => ({ notebooks: [publishedNotebook], pages: [], topics: [], views: [] } as never),
    parsePublishRequest: async () => ({ ok: true, input: { action: "preview", includeHtml: true } }),
    publishNotebook: async () => ({
        ok: true,
        value: {
            workspace: {
                notebooks: [publishedNotebook],
                pages: [],
                topics: [],
                views: [],
            },
            notebook: publishedNotebook,
        },
    }),
    resolveWorkspaceRevision: async () => "v1",
    saveWorkspaceForUser: async () => ({} as never),
    userOwnsNotebook: async () => true,
    ...overrides,
} as PublishRouteDependencies)

test("POST returns preview result", async () => {
    const response = await runPublishPost(authContext, makeRequest({ action: "preview", includeHtml: true }), "notebook-1", {
        ...makeDependencies(),
        parsePublishRequest: async () => ({ ok: true, input: { action: "preview", includeHtml: true, includeJson: false } }),
    })

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.preview.notebookId, "notebook-1")
})

test("POST maps missing workspace on publish to 404", async () => {
    const response = await runPublishPost(authContext, makeRequest({ action: "publish", revision: "v1" }), "notebook-1", {
        ...makeDependencies(),
        parsePublishRequest: async () => ({ ok: true, input: { action: "publish", revision: "v1" } }),
        loadWorkspaceForUser: async () => null as never,
    })

    assert.equal(response.status, 404)
    assert.equal((await readResponseBody(response)).error, "Workspace not found.")
})

test("POST rejects ownership failures", async () => {
    const response = await runPublishPost(authContext, makeRequest({ action: "preview", includeHtml: true }), "notebook-1", {
        ...makeDependencies(),
        parsePublishRequest: async () => ({ ok: true, input: { action: "preview", includeHtml: true } }),
        userOwnsNotebook: async () => false,
    })

    assert.equal(response.status, 404)
    assert.equal((await readResponseBody(response)).error, "Notebook not found.")
})
