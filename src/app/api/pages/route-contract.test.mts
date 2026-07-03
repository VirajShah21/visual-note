import assert from "node:assert/strict"
import test from "node:test"
import { parsePageUpdateRequest } from "./route-contract"

const validPayload = {
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
            displays: [
                {
                    name: "Main Display",
                    kind: "data-card",
                    data: {},
                },
            ],
        },
    ],
}

const requestFor = (pageId: string, body: unknown) =>
    new Request(`http://visual-note.test/api/pages/${pageId}`, {
        method: "PUT",
        body: JSON.stringify(body),
    })

test("rejects malformed JSON", async () => {
    const parsed = await parsePageUpdateRequest(new Request("http://visual-note.test/api/pages/page-1", { method: "PUT", body: "{" }), "page-1")

    assert.deepEqual(parsed, { ok: false, error: "Invalid page update payload.", status: 400 })
})

test("rejects page id mismatch between URL and payload", async () => {
    const parsed = await parsePageUpdateRequest(requestFor("page-2", validPayload), "page-2")

    assert.deepEqual(parsed, { ok: false, error: "Page identifier mismatch.", status: 400 })
})

test("accepts valid page update payload", async () => {
    const payload = {
        ...validPayload,
        notebook: {
            id: "notebook-1",
            userId: "user-1",
            title: "Notebook",
            slug: "notebook",
            summary: "Summary",
            color: "#ff0000",
            createdAt: "2026-01-01T00:00:00.000Z",
            editorSettings: {
                blockInfo: "show",
                contents: "hide",
            },
        },
    }

    const parsed = await parsePageUpdateRequest(requestFor("page-1", payload), "page-1")

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return

    assert.equal(parsed.page.id, "page-1")
    assert.equal(parsed.notebook?.id, "notebook-1")
    assert.equal(parsed.views.length, 1)
    assert.equal(parsed.views[0]?.displays[0]?.kind, "data-card")
    assert.equal(parsed.views[0]?.displays[0]?.id?.startsWith("display-"), true)
})
