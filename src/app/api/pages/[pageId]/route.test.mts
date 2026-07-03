import assert from "node:assert/strict"
import test from "node:test"
import { runPageDelete, runPageGet, runPageSave, type PageRouteDependencies } from "./route"
import type { PageUpdateParseResult } from "../route-contract"

const auth = {
    userId: "user-1",
    supabase: {} as never,
}

const parseContext = {
    ok: true,
    notebook: {
        id: "notebook-1",
        userId: "user-1",
        title: "Notebook",
        slug: "notebook-1",
        summary: "Summary",
        color: "#123456",
        createdAt: "2026-01-01T00:00:00.000Z",
        editorSettings: { blockInfo: "show", contents: "hide-title" },
    },
    page: {
        id: "page-1",
        notebookId: "notebook-1",
        title: "Welcome",
        position: 0,
    },
    topics: [],
    views: [
        {
            id: "view-1",
            topicId: "topic-1",
            title: "Article",
            mode: "article",
            content: "# Intro",
            displays: [{ id: "display-1", name: "Main", kind: "data-card", data: {} }],
        },
    ],
    markdown: "# Intro",
} as unknown as PageUpdateParseResult

const readResponseBody = async (response: Response) => response.json()

const basePageRow = {
    id: "page-1",
    notebook_id: "notebook-1",
    user_id: "user-1",
    title: "Welcome",
    position: 0,
    content_object_key: "notebooks/notebook-1/pages/page-1.md",
    topics: [],
    views: [],
    created_at: "2026-01-01T00:00:00.000Z",
}

test("GET returns page payload when owner exists", async () => {
    const response = await runPageGet(auth, "page-1", {
        loadPageById: async () => basePageRow,
        userOwnsNotebook: async () => true,
        listNotebooksForUser: async () => [],
        upsertNotebooks: async () => {},
        normalizeNotebookEditorSettings: value => value ?? {},
        makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
        readPageMarkdown: async () => "existing",
        savePageMarkdownIfConfigured: async () => ({ saved: false, objectKey: "x" }),
        upsertPages: async () => {},
        savePageMarkdown: async () => "x",
        deletePageMarkdown: async () => {},
        deletePage: async () => {},
        cleanupWorkspaceAssetOrphans: async () => [],
    } as PageRouteDependencies)

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.page.id, "page-1")
    assert.equal(body.page.notebookId, "notebook-1")
})

test("GET returns 404 when page cannot be found or owned", async () => {
    const notFound = await runPageGet(auth, "page-1", {
        loadPageById: async () => null,
        userOwnsNotebook: async () => false,
        listNotebooksForUser: async () => [],
        upsertNotebooks: async () => {},
        normalizeNotebookEditorSettings: value => value ?? {},
        makePageObjectKey: () => "",
        readPageMarkdown: async () => "x",
        savePageMarkdownIfConfigured: async () => ({ saved: false, objectKey: "x" }),
        upsertPages: async () => {},
        savePageMarkdown: async () => "x",
        deletePageMarkdown: async () => {},
        deletePage: async () => {},
        cleanupWorkspaceAssetOrphans: async () => [],
    } as PageRouteDependencies)

    assert.equal(notFound.status, 404)
    assert.deepEqual(await readResponseBody(notFound), { error: "Page not found." })

    const notOwned = await runPageGet(auth, "page-1", {
        loadPageById: async () => basePageRow,
        userOwnsNotebook: async () => false,
        listNotebooksForUser: async () => [],
        upsertNotebooks: async () => {},
        normalizeNotebookEditorSettings: value => value ?? {},
        makePageObjectKey: () => "",
        readPageMarkdown: async () => "x",
        savePageMarkdownIfConfigured: async () => ({ saved: false, objectKey: "x" }),
        upsertPages: async () => {},
        savePageMarkdown: async () => "x",
        deletePageMarkdown: async () => {},
        deletePage: async () => {},
        cleanupWorkspaceAssetOrphans: async () => [],
    } as PageRouteDependencies)

    assert.equal(notOwned.status, 404)
    assert.deepEqual(await readResponseBody(notOwned), { error: "Page not found." })
})

test("DELETE returns 404 for missing page", async () => {
    const response = await runPageDelete(auth, "page-1", {
        loadPageById: async () => null,
        userOwnsNotebook: async () => false,
        listNotebooksForUser: async () => [],
        upsertNotebooks: async () => {},
        normalizeNotebookEditorSettings: value => value ?? {},
        makePageObjectKey: () => "",
        readPageMarkdown: async () => null,
        savePageMarkdownIfConfigured: async () => ({ saved: false, objectKey: "x" }),
        upsertPages: async () => {},
        savePageMarkdown: async () => "x",
        deletePageMarkdown: async () => {},
        deletePage: async () => {},
        cleanupWorkspaceAssetOrphans: async () => [],
    } as PageRouteDependencies)

    assert.equal(response.status, 404)
    assert.deepEqual(await readResponseBody(response), { error: "Page not found." })
})

test("DELETE maps deletion failures to status 500", async () => {
    const response = await runPageDelete(auth, "page-1", {
        loadPageById: async () => basePageRow,
        userOwnsNotebook: async () => true,
        listNotebooksForUser: async () => [],
        upsertNotebooks: async () => {},
        normalizeNotebookEditorSettings: value => value ?? {},
        makePageObjectKey: () => "",
        readPageMarkdown: async () => null,
        savePageMarkdownIfConfigured: async () => ({ saved: false, objectKey: "x" }),
        upsertPages: async () => {},
        savePageMarkdown: async () => "x",
        deletePageMarkdown: async () => {},
        deletePage: async () => {
            throw new Error("delete failed")
        },
        cleanupWorkspaceAssetOrphans: async () => [],
    } as PageRouteDependencies)

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "delete failed")
})

test("PUT maps invalid payload to status 400", async () => {
    const response = await runPageSave(auth, { ok: false, error: "Invalid page update payload.", status: 400 }, {
        loadPageById: async () => basePageRow,
        userOwnsNotebook: async () => true,
        listNotebooksForUser: async () => [],
        upsertNotebooks: async () => {},
        normalizeNotebookEditorSettings: value => value ?? {},
        makePageObjectKey: () => "",
        readPageMarkdown: async () => null,
        savePageMarkdownIfConfigured: async () => ({ saved: false, objectKey: "x" }),
        upsertPages: async () => {},
        savePageMarkdown: async () => "x",
        deletePageMarkdown: async () => {},
        deletePage: async () => {},
        cleanupWorkspaceAssetOrphans: async () => [],
    } as PageRouteDependencies)

    assert.equal(response.status, 400)
    assert.deepEqual(await readResponseBody(response), { error: "Invalid page update payload." })
})

test("PUT creates missing page using existing notebook lookup", async () => {
    const upsertedNotebooks: Array<Record<string, unknown>> = []
    const upsertedPages: Array<Record<string, unknown>> = []
    const response = await runPageSave(auth, parseContext, {
        loadPageById: async () => null,
        userOwnsNotebook: async () => true,
        listNotebooksForUser: async () => [
            {
                id: "notebook-1",
                userId: "user-1",
                title: "Notebook",
                slug: "notebook-1",
                summary: "Summary",
                color: "#123456",
                createdAt: "2026-01-01T00:00:00.000Z",
                editorSettings: { blockInfo: "show", contents: "hide-title" },
            } as never,
        ],
        upsertNotebooks: async (_supabase, _userId, notebooks) => {
            upsertedNotebooks.push(...notebooks)
        },
        normalizeNotebookEditorSettings: value => value,
        makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
        readPageMarkdown: async () => null,
        savePageMarkdownIfConfigured: async () => ({ saved: true, objectKey: "x" }),
        upsertPages: async (_supabase, _userId, rows) => {
            upsertedPages.push(...rows)
        },
        savePageMarkdown: async () => "x",
        deletePageMarkdown: async () => {},
        deletePage: async () => {},
        cleanupWorkspaceAssetOrphans: async () => [],
    } as PageRouteDependencies)

    assert.equal(response.status, 200)
    assert.equal(upsertedNotebooks.length, 1)
    assert.equal(upsertedNotebooks[0].id, "notebook-1")
    assert.equal(upsertedPages.length, 1)
    assert.equal(upsertedPages[0].page.id, "page-1")
    assert.equal((await readResponseBody(response)).page.contentObjectKey, "notebooks/notebook-1/pages/page-1.md")
})

test("PUT rolls back page markdown on content write + database failure", async () => {
    let restoreCalled = false
    const response = await runPageSave(auth, parseContext, {
        loadPageById: async () => basePageRow,
        userOwnsNotebook: async () => true,
        listNotebooksForUser: async () => [],
        upsertNotebooks: async () => {},
        normalizeNotebookEditorSettings: value => value ?? {},
        makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
        readPageMarkdown: async () => null,
        savePageMarkdownIfConfigured: async () => ({ saved: true, objectKey: "notebooks/notebook-1/pages/page-1.md" }),
        upsertPages: async () => {
            throw new Error("page write failed")
        },
        savePageMarkdown: async () => {
            restoreCalled = true
            return "notebooks/notebook-1/pages/page-1.md"
        },
        deletePageMarkdown: async () => {
            restoreCalled = true
        },
        deletePage: async () => {},
        cleanupWorkspaceAssetOrphans: async () => [],
    } as PageRouteDependencies)

    assert.equal(response.status, 500)
    const body = await readResponseBody(response)
    assert.equal(body.error, "page write failed")
    assert.equal(restoreCalled, true)
})
