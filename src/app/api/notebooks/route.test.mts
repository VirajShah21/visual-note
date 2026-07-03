import assert from "node:assert/strict"
import test from "node:test"
import { runNotebooksGet, runNotebooksPost, type NotebooksRouteDependencies } from "./route"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

const authContext = {
    userId: "user-1",
    supabase: {} as never,
}

const emptyWorkspace: VisualNoteWorkspace = {
    notebooks: [],
    pages: [],
    topics: [],
    views: [],
}

const readResponseBody = async (response: Response) => response.json()

const makeDependencies = (overrides: Partial<NotebooksRouteDependencies> = {}): NotebooksRouteDependencies => ({
    authenticateSupabaseMutationRequest: async () => authContext as never,
    authenticateSupabaseRequest: async () => authContext as never,
    createExportDocument: input => ({
        notebookId: input.selection.notebookId,
        notebookTitle: "Notebook",
        slug: "notebook",
        scope: "page",
        pages: [],
    }),
    createNotebook: (userId, title) => ({
        id: "notebook-1",
        userId,
        title,
        slug: "my-notebook",
        summary: "A structured web notebook",
        color: "#2f7d5c",
        createdAt: "2026-01-01T00:00:00.000Z",
        editorSettings: { blockInfo: "show", contents: "show", mode: "editing" },
    }),
    createPage: (notebookId, title, position) => ({
        id: "page-1",
        notebookId,
        title,
        position,
    }),
    createTopic: (pageId, title, position) => ({ id: "topic-1", pageId, title, summary: "Start", position }),
    createView: (topicId, title) => ({ id: "view-1", topicId, title, mode: "article", position: 0, content: "# Article", displays: [] }),
    loadWorkspaceForUser: async () => emptyWorkspace,
    makePageObjectKey: (notebookId, pageId) => `${notebookId}/${pageId}.md`,
    renderMarkdownExport: () => "# Exported",
    resolveExportAssets: async () => ({ assets: [], assetBySource: new Map(), warnings: [] }),
    savePageMarkdownIfConfigured: async () => ({ saved: true }),
    upsertNotebooks: async () => {},
    upsertPages: async () => {},
    ...overrides,
})

test("GET returns workspace data", async () => {
    const response = await runNotebooksGet(
        authContext,
        makeDependencies({
            loadWorkspaceForUser: async () => ({
                notebooks: [
                    {
                        id: "notebook-1",
                        userId: "user-1",
                        title: "Notebook",
                        slug: "notebook",
                        summary: "",
                        color: "",
                        createdAt: "2026-01-01",
                    },
                ],
                pages: [],
                topics: [],
                views: [],
            }),
        }),
    )

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.workspace.notebooks.length, 1)
    assert.equal(body.workspace.notebooks[0].title, "Notebook")
})

test("GET maps workspace load failures to 500", async () => {
    const response = await runNotebooksGet(
        authContext,
        makeDependencies({
            loadWorkspaceForUser: async () => {
                throw new Error("load failed")
            },
        }),
    )

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "load failed")
})

test("POST returns 400 on malformed JSON", async () => {
    const response = await runNotebooksPost(
        authContext,
        new Request("https://visual-note.test/api/notebooks", {
            method: "POST",
            body: "{title",
            headers: { "content-type": "application/json" },
        }),
        makeDependencies(),
    )

    assert.equal(response.status, 400)
    assert.equal((await readResponseBody(response)).error, "Invalid notebook request.")
})

test("POST returns 400 on invalid notebook payload", async () => {
    const response = await runNotebooksPost(
        authContext,
        new Request("https://visual-note.test/api/notebooks", {
            method: "POST",
            body: JSON.stringify({ summary: "No title" }),
            headers: { "content-type": "application/json" },
        }),
        makeDependencies(),
    )

    assert.equal(response.status, 400)
    assert.equal((await readResponseBody(response)).error, "Invalid notebook request.")
})

test("POST creates notebook without homepage when createHomePage is false", async () => {
    let notebookUpsertCount = 0
    let pagesWritten = 0

    const response = await runNotebooksPost(
        authContext,
        new Request("https://visual-note.test/api/notebooks", {
            method: "POST",
            body: JSON.stringify({ title: "Homeless", createHomePage: false }),
            headers: { "content-type": "application/json" },
        }),
        makeDependencies({
            upsertNotebooks: async (_, __, notebooks) => {
                assert.equal(notebooks.length, 1)
                assert.equal(notebooks[0].title, "Homeless")
                notebookUpsertCount += 1
            },
            upsertPages: async () => {
                pagesWritten += 1
            },
            loadWorkspaceForUser: async () => null as unknown as VisualNoteWorkspace,
        }),
    )

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.notebook.title, "Homeless")
    assert.equal(notebookUpsertCount, 1)
    assert.equal(body.workspace, null)
    assert.equal(pagesWritten, 0)
})

test("POST creates homepage content when storage is configured", async () => {
    let pagesUpserted = 0
    let pageSaved = false

    const response = await runNotebooksPost(
        authContext,
        new Request("https://visual-note.test/api/notebooks", {
            method: "POST",
            body: JSON.stringify({ title: "With Home" }),
            headers: { "content-type": "application/json" },
        }),
        makeDependencies({
            upsertPages: async () => {
                pagesUpserted += 1
            },
            savePageMarkdownIfConfigured: async () => {
                pageSaved = true
                return { saved: true }
            },
            loadWorkspaceForUser: async () => ({
                notebooks: [
                    {
                        id: "notebook-1",
                        userId: "user-1",
                        title: "With Home",
                        slug: "with-home",
                        summary: "A structured web notebook",
                        color: "#2f7d5c",
                        createdAt: "2026-01-01T00:00:00.000Z",
                    },
                ],
                pages: [
                    {
                        id: "page-1",
                        notebookId: "notebook-1",
                        title: "Home",
                        position: 0,
                        content_object_key: "notebook-1/page-1.md",
                    },
                ],
                topics: [
                    {
                        id: "topic-1",
                        pageId: "page-1",
                        title: "Start",
                        summary: "Start",
                        position: 0,
                    },
                ],
                views: [
                    {
                        id: "view-1",
                        topicId: "topic-1",
                        title: "Welcome",
                        mode: "article",
                        position: 0,
                        content: "# Article",
                        displays: [],
                    },
                ],
            }),
        }),
    )

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(pagesUpserted, 1)
    assert.equal(pageSaved, true)
    assert.equal(body.notebook.title, "With Home")
})

test("POST requires storage configuration for homepage markdown save", async () => {
    const response = await runNotebooksPost(
        authContext,
        new Request("https://visual-note.test/api/notebooks", {
            method: "POST",
            body: JSON.stringify({ title: "Needs Storage" }),
            headers: { "content-type": "application/json" },
        }),
        makeDependencies({
            savePageMarkdownIfConfigured: async () => ({ saved: false }),
        }),
    )

    assert.equal(response.status, 400)
    const body = await readResponseBody(response)
    assert.equal(body.error, "Configure notebook storage before saving page content to MinIO.")
})

test("POST maps upsert failures to 500", async () => {
    const response = await runNotebooksPost(
        authContext,
        new Request("https://visual-note.test/api/notebooks", {
            method: "POST",
            body: JSON.stringify({ title: "Failure", createHomePage: false }),
            headers: { "content-type": "application/json" },
        }),
        makeDependencies({
            upsertNotebooks: async () => {
                throw new Error("db down")
            },
        }),
    )

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "db down")
})
