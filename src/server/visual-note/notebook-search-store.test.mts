import assert from "node:assert/strict"
import test from "node:test"
import type { PageRow } from "./page-store"
import { createNotebookSearchResponse } from "./notebook-search-store"

const pageRows: PageRow[] = [
    {
        id: "page-1",
        user_id: "user-1",
        notebook_id: "notebook-1",
        title: "Planning",
        position: 0,
        content_object_key: "notebooks/notebook-1/pages/page-1.md",
        created_at: "2026-07-01T00:00:00.000Z",
        topics: [
            {
                id: "topic-1",
                pageId: "page-1",
                title: "Risks",
                summary: "",
                position: 0,
            },
        ],
        views: [
            {
                id: "view-1",
                topicId: "topic-1",
                title: "Risk log",
                mode: "article",
                content: "Concurrency risk and storage risk",
                displays: [],
            },
        ],
    },
    {
        id: "page-2",
        user_id: "user-1",
        notebook_id: "notebook-1",
        title: "Operations",
        position: 1,
        content_object_key: "notebooks/notebook-1/pages/page-2.md",
        created_at: "2026-07-01T00:00:00.000Z",
        topics: [
            {
                id: "topic-2",
                pageId: "page-2",
                title: "Incidents",
                summary: "",
                position: 0,
            },
        ],
        views: [
            {
                id: "view-2",
                topicId: "topic-2",
                title: "Incident review",
                mode: "article",
                content: "Storage risk response",
                displays: [],
            },
        ],
    },
]

test("creates paginated notebook search responses", () => {
    const response = createNotebookSearchResponse(pageRows, {
        limit: 1,
        offset: 0,
        query: "risk",
    })

    assert.equal(response.results.length, 1)
    assert.equal(response.hasMore, true)
    assert.equal(typeof response.results[0]?.title, "string")
})

test("prioritizes matches from the current page", () => {
    const response = createNotebookSearchResponse(pageRows, {
        currentPageId: "page-2",
        query: "risk",
    })

    assert.equal(response.results[0]?.pageId, "page-2")
    assert.equal(response.results[0]?.isCurrentPage, true)
})
