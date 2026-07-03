import assert from "node:assert/strict"
import test from "node:test"
import { runSearchGet, type NotebookSearchRouteDependencies } from "./route"
import { parseSearchRequest } from "./route-contract"

const authContext = {
    userId: "user-1",
    supabase: {} as never,
}

const readResponseBody = async (response: Response) => response.json()

const makeDependencies = (overrides: Partial<NotebookSearchRouteDependencies> = {}): NotebookSearchRouteDependencies => ({
    authenticateSupabaseRequest: async () => authContext as never,
    parseSearchRequest,
    userOwnsNotebook: async () => true,
    searchNotebookForUser: async () => ({
        query: "notes",
        limit: 8,
        offset: 0,
        hasMore: false,
        results: [],
    }),
    ...overrides,
})

test("GET maps ownership failures to 404", async () => {
    const response = await runSearchGet(
        authContext,
        new Request("https://visual-note.test/api/notebooks/notebook-1/search?q=notes"),
        "notebook-1",
        makeDependencies({
            userOwnsNotebook: async () => false,
        }),
    )

    assert.equal(response.status, 404)
    assert.deepEqual(await readResponseBody(response), { error: "Notebook not found." })
})

test("GET maps invalid search params to status 400", async () => {
    const response = await runSearchGet(
        authContext,
        new Request(`https://visual-note.test/api/notebooks/notebook-1/search?${new URLSearchParams({ q: "x".repeat(201) })}`),
        "notebook-1",
        makeDependencies(),
    )

    assert.equal(response.status, 400)
    assert.equal((await readResponseBody(response)).error, "Search query is too long.")
})

test("GET returns search results from dependencies", async () => {
    const response = await runSearchGet(
        authContext,
        new Request("https://visual-note.test/api/notebooks/notebook-1/search?currentPageId=page-1&limit=5&offset=10&q=notes"),
        "notebook-1",
        makeDependencies({
            searchNotebookForUser: async () => ({
                query: "notes",
                limit: 5,
                offset: 10,
                hasMore: false,
                results: [
                    {
                        id: "page-1-topic-1-view-1",
                        pageId: "page-1",
                        topicId: "topic-1",
                        viewId: "view-1",
                        title: "Intro",
                        context: "notes",
                        location: "Home / Intro",
                        isCurrentPage: true,
                    },
                ],
            }),
        }),
    )

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.results.length, 1)
    assert.equal(body.results[0].id, "page-1-topic-1-view-1")
})

test("GET maps search failures to status 500", async () => {
    const response = await runSearchGet(
        authContext,
        new Request("https://visual-note.test/api/notebooks/notebook-1/search?q=notes"),
        "notebook-1",
        makeDependencies({
            searchNotebookForUser: async () => {
                throw new Error("search failed")
            },
        }),
    )

    assert.equal(response.status, 500)
    assert.equal((await readResponseBody(response)).error, "search failed")
})
