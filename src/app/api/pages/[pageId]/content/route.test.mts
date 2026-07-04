import assert from "node:assert/strict"
import test from "node:test"
import { runContentGet, runContentPut, type Authenticated, type PageContentRouteDependencies } from "./route"
import { STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT } from "@/lib/visual-note/storage-messages"

const auth = {
    supabase: {} as never,
    userId: "user-1",
} as Authenticated

const readResponseBody = async (response: Response) => response.json()
type SavePageMarkdown = PageContentRouteDependencies["savePageMarkdown"]

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

test("GET returns markdown payload when page content is present", async () => {
    const response = await runContentGet(auth, "page-1", {
        loadPageById: async () => basePageRow,
        userOwnsNotebook: async () => true,
        readPageMarkdown: async () => "# Welcome",
        savePageMarkdown: async () => "x",
        makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
        cleanupWorkspaceAssetOrphans: async () => [],
    } as unknown as PageContentRouteDependencies)

    assert.equal(response.status, 200)
    assert.deepEqual(await readResponseBody(response), {
        pageId: "page-1",
        markdown: "# Welcome",
    })
})

test("GET maps missing content to status 404", async () => {
    const response = await runContentGet(auth, "page-1", {
        loadPageById: async () => basePageRow,
        userOwnsNotebook: async () => true,
        readPageMarkdown: async () => null,
        savePageMarkdown: async () => "x",
        makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
        cleanupWorkspaceAssetOrphans: async () => [],
    } as unknown as PageContentRouteDependencies)

    assert.equal(response.status, 404)
    assert.deepEqual(await readResponseBody(response), { error: "Page content not found." })
})

test("GET returns 404 when notebook is not owned", async () => {
    const response = await runContentGet(auth, "page-1", {
        loadPageById: async () => basePageRow,
        userOwnsNotebook: async () => false,
        readPageMarkdown: async () => "# Welcome",
        savePageMarkdown: async () => "x",
        makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
        cleanupWorkspaceAssetOrphans: async () => [],
    } as unknown as PageContentRouteDependencies)

    assert.equal(response.status, 404)
    assert.deepEqual(await readResponseBody(response), { error: "Page not found." })
})

test("PUT updates markdown and returns content key", async () => {
    let received: { notebookId: string; id: string; markdown: string } | null = null
    let cleanupCalled = false

    const response = await runContentPut(
        auth,
        new Request("http://visual-note.test/api/pages/page-1/content", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markdown: "# Updated" }),
        }),
        "page-1",
        {
            loadPageById: async () => basePageRow,
            userOwnsNotebook: async () => true,
            readPageMarkdown: async () => null,
            savePageMarkdown: async (_context: Parameters<SavePageMarkdown>[0], _page: Parameters<SavePageMarkdown>[1], markdown: string, objectKey: string) => {
                received = {
                    notebookId: basePageRow.notebook_id,
                    id: basePageRow.id,
                    markdown,
                }
                return objectKey
            },
            makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
            cleanupWorkspaceAssetOrphans: async () => {
                cleanupCalled = true
            },
        } as unknown as PageContentRouteDependencies,
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await readResponseBody(response), {
        pageId: "page-1",
        contentObjectKey: "notebooks/notebook-1/pages/page-1.md",
    })
    assert.equal((received as { markdown: string } | null)?.markdown, "# Updated")
    assert.equal(cleanupCalled, true)
})

test("PUT maps invalid payload to status 400", async () => {
    const response = await runContentPut(auth, new Request("http://visual-note.test/api/pages/page-1/content", { method: "PUT" }), "page-1", {
        loadPageById: async () => basePageRow,
        userOwnsNotebook: async () => true,
        readPageMarkdown: async () => null,
        savePageMarkdown: async () => "x",
        makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
        cleanupWorkspaceAssetOrphans: async () => [],
    } as unknown as PageContentRouteDependencies)

    assert.equal(response.status, 400)
    assert.deepEqual(await readResponseBody(response), { error: "Invalid content payload." })
})

test("PUT maps save failures to status 500", async () => {
    const response = await runContentPut(
        auth,
        new Request("http://visual-note.test/api/pages/page-1/content", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markdown: "# Failed" }),
        }),
        "page-1",
        {
            loadPageById: async () => basePageRow,
            userOwnsNotebook: async () => true,
            readPageMarkdown: async () => null,
            savePageMarkdown: async () => {
                throw new Error("save failed")
            },
            makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
            cleanupWorkspaceAssetOrphans: async () => [],
        } as unknown as PageContentRouteDependencies,
    )

    assert.equal(response.status, 500)
    assert.deepEqual(await readResponseBody(response), { error: "save failed" })
})

test("PUT returns warning when notebook storage is not configured for content save", async () => {
    const response = await runContentPut(
        auth,
        new Request("http://visual-note.test/api/pages/page-1/content", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markdown: "# Updated" }),
        }),
        "page-1",
        {
            loadPageById: async () => basePageRow,
            userOwnsNotebook: async () => true,
            readPageMarkdown: async () => null,
            savePageMarkdown: async () => "x",
            savePageMarkdownIfConfigured: async () => ({ saved: false, objectKey: "notebooks/notebook-1/pages/page-1.md" }),
            makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
            cleanupWorkspaceAssetOrphans: async () => {},
        } as unknown as PageContentRouteDependencies,
    )

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.deepEqual(body.warnings, [STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT])
    assert.equal(body.contentObjectKey, "notebooks/notebook-1/pages/page-1.md")
})

test("PUT maps asset cleanup failures to status 500", async () => {
    const response = await runContentPut(
        auth,
        new Request("http://visual-note.test/api/pages/page-1/content", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markdown: "# Failed" }),
        }),
        "page-1",
        {
            loadPageById: async () => basePageRow,
            userOwnsNotebook: async () => true,
            readPageMarkdown: async () => null,
            savePageMarkdown: async () => "notebooks/notebook-1/pages/page-1.md",
            makePageObjectKey: () => "notebooks/notebook-1/pages/page-1.md",
            cleanupWorkspaceAssetOrphans: async () => {
                throw new Error("cleanup failed")
            },
        } as unknown as PageContentRouteDependencies,
    )

    assert.equal(response.status, 500)
    assert.deepEqual(await readResponseBody(response), { error: "cleanup failed" })
})
