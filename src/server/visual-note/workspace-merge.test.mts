import assert from "node:assert/strict"
import test from "node:test"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { mergeWorkspaceFromBase } from "./workspace-merge"

const baseWorkspace = (): VisualNoteWorkspace => ({
    notebooks: [{ id: "notebook-1", userId: "user-1", title: "Base", slug: "base", summary: "", color: "#2f7d5c", createdAt: "2026-07-03T00:00:00.000Z" }],
    pages: [{ id: "page-1", notebookId: "notebook-1", title: "Home", position: 0 }],
    topics: [{ id: "topic-1", pageId: "page-1", title: "Topic", summary: "", position: 0 }],
    views: [{ id: "view-1", topicId: "topic-1", title: "Article", mode: "article", content: "Base", displays: [] }],
})

test("merges non-overlapping workspace edits", () => {
    const base = baseWorkspace()
    const current = { ...base, notebooks: [{ ...base.notebooks[0]!, title: "Remote" }] }
    const incoming = { ...base, views: [{ ...base.views[0]!, content: "Local" }] }

    const result = mergeWorkspaceFromBase(base, current, incoming)

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.workspace.notebooks[0]?.title, "Remote")
    assert.equal(result.workspace.views[0]?.content, "Local")
})

test("rejects overlapping workspace edits", () => {
    const base = baseWorkspace()
    const current = { ...base, views: [{ ...base.views[0]!, content: "Remote" }] }
    const incoming = { ...base, views: [{ ...base.views[0]!, content: "Local" }] }

    const result = mergeWorkspaceFromBase(base, current, incoming)

    assert.deepEqual(result, { ok: false, conflicts: ["view:view-1"] })
})
