import assert from "node:assert/strict"
import test from "node:test"
import { runNotebookGet, runNotebookPut } from "./route"
import type { NotebookRouteDependencies } from "./route"

const authContext = {
    userId: "user-1",
    supabase: {} as never,
}

const readResponseBody = async (response: Response) => response.json()

const makeWorkspace = () => ({
    notebooks: [
        {
            id: "notebook-1",
            userId: "user-1",
            title: "Notebook",
            slug: "notebook",
            summary: "Base",
            color: "#111111",
            published: false,
            createdAt: "2026-06-01T00:00:00.000Z",
            editorSettings: { blockInfo: "show" as const, contents: "hide-title" as const, mode: "editing" as const },
        },
    ],
    pages: [
        { id: "page-2", notebookId: "notebook-1", title: "Second", position: 1, content_object_key: "c2" },
        { id: "page-1", notebookId: "notebook-1", title: "First", position: 0, content_object_key: "c1" },
    ],
    topics: [
        { id: "topic-1", pageId: "page-1", title: "Topic A", position: 1, summary: "" },
        { id: "topic-2", pageId: "page-1", title: "Topic B", position: 0, summary: "" },
    ],
    views: [{ id: "view-1", topicId: "topic-2", title: "View A", mode: "article" as const, content: "body", displays: [] }],
})

const baseDependencies = (overrides: Partial<NotebookRouteDependencies> = {}): NotebookRouteDependencies => ({
    authenticateSupabaseMutationRequest: async () => authContext as never,
    authenticateSupabaseRequest: async () => authContext as never,
    loadWorkspaceForUser: async () => makeWorkspace(),
    normalizeNotebookEditorSettings: value => ({
        blockInfo: value?.blockInfo ?? "show",
        contents: value?.contents ?? "show",
        mode: value?.mode ?? "editing",
    }),
    userOwnsNotebook: async () => true,
    upsertNotebooks: async () => {},
    ...overrides,
})

test("GET returns notebook with ordered pages, topics, and views", async () => {
    const response = await runNotebookGet(authContext, "notebook-1", baseDependencies())
    const body = await readResponseBody(response)

    assert.equal(response.status, 200)
    assert.equal(body.notebook.id, "notebook-1")
    assert.equal(body.pages[0].id, "page-1")
    assert.equal(body.pages[0].topics[0].id, "topic-2")
    assert.equal(body.pages[0].topics.length, 2)
})

test("GET maps missing ownership to 404", async () => {
    const response = await runNotebookGet(authContext, "notebook-1", {
        ...baseDependencies(),
        userOwnsNotebook: async () => false,
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await readResponseBody(response), { error: "Notebook not found." })
})

test("GET maps missing workspace to 404", async () => {
    const response = await runNotebookGet(authContext, "notebook-1", {
        ...baseDependencies(),
        loadWorkspaceForUser: async () => null,
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await readResponseBody(response), { error: "Notebook not found." })
})

test("PUT maps invalid payload to 400", async () => {
    const response = await runNotebookPut(
        authContext,
        new Request("https://visual-note.test/api/notebooks/notebook-1", {
            method: "PUT",
            body: JSON.stringify({ title: "" }),
            headers: { "content-type": "application/json" },
        }),
        "notebook-1",
        baseDependencies(),
    )

    assert.equal(response.status, 400)
    assert.equal((await readResponseBody(response)).error, "Invalid notebook payload.")
})

test("PUT maps malformed JSON to 400", async () => {
    const response = await runNotebookPut(
        authContext,
        new Request("https://visual-note.test/api/notebooks/notebook-1", {
            method: "PUT",
            body: "{title",
            headers: { "content-type": "application/json" },
        }),
        "notebook-1",
        baseDependencies(),
    )

    assert.equal(response.status, 400)
    assert.equal((await readResponseBody(response)).error, "Invalid notebook payload.")
})

test("PUT updates notebook and returns refreshed entity", async () => {
    const response = await runNotebookPut(
        authContext,
        new Request("https://visual-note.test/api/notebooks/notebook-1", {
            method: "PUT",
            body: JSON.stringify({ title: "New title", slug: "new-slug" }),
            headers: { "content-type": "application/json" },
        }),
        "notebook-1",
        baseDependencies({
            upsertNotebooks: async () => {},
            loadWorkspaceForUser: async () => ({
                ...makeWorkspace(),
                notebooks: [
                    { ...makeWorkspace().notebooks[0], title: "New title", slug: "new-slug", editorSettings: { blockInfo: "show", contents: "hide-title", mode: "editing" } },
                ],
            }),
        }),
    )

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.notebook.title, "New title")
    assert.equal(body.notebook.slug, "new-slug")
})

test("PUT maps upsert failures to status 500", async () => {
    const response = await runNotebookPut(
        authContext,
        new Request("https://visual-note.test/api/notebooks/notebook-1", {
            method: "PUT",
            body: JSON.stringify({ title: "New title" }),
            headers: { "content-type": "application/json" },
        }),
        "notebook-1",
        baseDependencies({
            upsertNotebooks: async () => {
                throw new Error("db down")
            },
        }),
    )

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "db down")
})
