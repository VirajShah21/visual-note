import assert from "node:assert/strict"
import test from "node:test"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { parsePageUpdateRequest } from "./route-contract"

const pagePayload: VisualNoteWorkspace["pages"][number] & {
    notebookId: string
    id: string
    content?: string
    position: number
} = {
    id: "page-1",
    notebookId: "notebook-1",
    title: "Home",
    position: 0,
}

const payload = {
    notebook: {
        id: "notebook-1",
        userId: "user-1",
        title: "Notebook",
        slug: "notebook",
        summary: "A notebook",
        color: "#2f7d5c",
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    page: pagePayload,
    topics: [{ id: "topic-1", pageId: "page-1", title: "Start", summary: "", position: 0 }],
    views: [{
        id: "view-1",
        topicId: "topic-1",
        title: "Article",
        mode: "article",
        content: "# Article",
        displays: [{ name: "", kind: "data-card" }],
    }],
    markdown: "# updated",
}

const pageRequest = (body: unknown) =>
    new Request("http://visual-note.test/api/pages/page-1", {
        body: typeof body === "string" ? body : JSON.stringify(body),
        method: "PUT",
    })

test("rejects non-object page payload bodies", async () => {
    const parsed = await parsePageUpdateRequest(pageRequest("{"), "page-1")

    assert.deepEqual(parsed, { ok: false, error: "Invalid page update payload.", status: 400 })
})

test("rejects page id mismatch", async () => {
    const parsed = await parsePageUpdateRequest(pageRequest(payload), "other-page")

    assert.deepEqual(parsed, { ok: false, error: "Page identifier mismatch.", status: 400 })
})

test("parses and normalizes page payload", async () => {
    const parsed = await parsePageUpdateRequest(pageRequest(payload), "page-1")

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return

    assert.equal(parsed.page.id, "page-1")
    assert.equal(parsed.markdown, "# updated")
    assert.equal(parsed.views.length, 1)
    assert.equal(parsed.views[0].displays[0].kind, "data-card")
    assert.equal(parsed.views[0].displays[0].name, "Display")
    assert.equal(parsed.views[0].displays[0].id.startsWith("display-"), true)
})
