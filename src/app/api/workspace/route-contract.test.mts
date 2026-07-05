import assert from "node:assert/strict"
import test from "node:test"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { isWorkspaceConflictError, parseIfMatchRevision, parseWorkspaceSaveRequest } from "./route-contract"

const workspace: VisualNoteWorkspace = {
    notebooks: [
        {
            id: "notebook-1",
            userId: "user-1",
            title: "Notebook",
            slug: "notebook",
            summary: "A notebook",
            color: "#2f7d5c",
            createdAt: "2026-01-01T00:00:00.000Z",
        },
    ],
    pages: [{ id: "page-1", notebookId: "notebook-1", title: "Home", position: 0 }],
    topics: [{ id: "topic-1", pageId: "page-1", title: "Start", summary: "", position: 0 }],
    views: [{ id: "view-1", topicId: "topic-1", title: "Article", mode: "article", content: "# Article", displays: [] }],
}

const workspaceRequest = (body: unknown) =>
    new Request("http://visual-note.test/api/workspace", {
        body: typeof body === "string" ? body : JSON.stringify(body),
        method: "PUT",
    })

test("rejects malformed workspace save JSON", async () => {
    const parsed = await parseWorkspaceSaveRequest(workspaceRequest("{"))

    assert.deepEqual(parsed, { ok: false, error: "Workspace is required.", status: 400 })
})

test("rejects workspace saves without a workspace payload", async () => {
    const parsed = await parseWorkspaceSaveRequest(workspaceRequest({ revision: "revision-1" }))

    assert.deepEqual(parsed, { ok: false, error: "Workspace is required.", status: 400 })
})

test("rejects non-string workspace revisions", async () => {
    const parsed = await parseWorkspaceSaveRequest(workspaceRequest({ workspace, revision: 42 }))

    assert.deepEqual(parsed, { ok: false, error: "Revision must be a string.", status: 400 })
})

test("normalizes accepted workspace save revisions", async () => {
    const parsed = await parseWorkspaceSaveRequest(workspaceRequest({ baseWorkspace: workspace, workspace, revision: " revision-1 " }))

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return

    assert.deepEqual(parsed.baseWorkspace, workspace)
    assert.deepEqual(parsed.workspace, workspace)
    assert.equal(parsed.revision, "revision-1")
})

test("requires revision with baseWorkspace", async () => {
    const parsed = await parseWorkspaceSaveRequest(
        workspaceRequest({
            workspace,
            baseWorkspace: workspace,
        }),
    )

    assert.deepEqual(parsed, { ok: false, error: "Revision is required for workspace save.", status: 400 })
})

test("requires revision for all workspace saves", async () => {
    const parsed = await parseWorkspaceSaveRequest(
        workspaceRequest({
            workspace,
            revision: null,
        }),
    )

    assert.deepEqual(parsed, { ok: false, error: "Revision is required for workspace save.", status: 400 })
})

test("rejects invalid If-Match revision headers", async () => {
    const request = new Request("http://visual-note.test/api/workspace", {
        body: JSON.stringify({ workspace }),
        method: "PUT",
        headers: {
            "if-match": '""',
        },
    })
    const parsed = await parseWorkspaceSaveRequest(request)

    assert.deepEqual(parsed, { ok: false, error: "Invalid If-Match revision header.", status: 400 })
})

test("rejects mismatched revision and If-Match header", async () => {
    const request = new Request("http://visual-note.test/api/workspace", {
        body: JSON.stringify({ workspace, revision: "revision-body", baseWorkspace: workspace }),
        method: "PUT",
        headers: {
            "if-match": '"revision-header"',
        },
    })
    const parsed = await parseWorkspaceSaveRequest(request)

    assert.deepEqual(parsed, {
        ok: false,
        error: "Revision in payload must match If-Match header.",
        status: 400,
    })
})

test("accepts baseWorkspace with valid If-Match header", async () => {
    const parsed = await parseWorkspaceSaveRequest(
        new Request("http://visual-note.test/api/workspace", {
            body: JSON.stringify({ workspace, baseWorkspace: workspace }),
            method: "PUT",
            headers: {
                "if-match": '"revision-header"',
            },
        }),
    )

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return

    assert.equal(parsed.revision, "revision-header")
    assert.deepEqual(parsed.baseWorkspace, workspace)
})

test("accepts revision from a valid If-Match header", async () => {
    const request = new Request("http://visual-note.test/api/workspace", {
        body: JSON.stringify({ workspace }),
        method: "PUT",
        headers: {
            "if-match": '"revision-header"',
        },
    })
    const parsed = await parseWorkspaceSaveRequest(request)

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.revision, "revision-header")
})

test("parses unquoted revision from If-Match headers", () => {
    assert.equal(parseIfMatchRevision("revision-1"), "revision-1")
    assert.equal(parseIfMatchRevision('"revision-2"'), "revision-2")
    assert.equal(parseIfMatchRevision('W/"revision-3"'), "revision-3")
    assert.equal(parseIfMatchRevision('   "revision-4"   '), "revision-4")
    assert.equal(parseIfMatchRevision(""), null)
    assert.equal(parseIfMatchRevision("   "), null)
})

test("classifies workspace conflict errors for route status mapping", () => {
    const error = new Error("Workspace changed")
    ;(error as Error & { code?: string }).code = "workspace_conflict"

    assert.equal(isWorkspaceConflictError(error), true)
    assert.equal(isWorkspaceConflictError(new Error("Other failure")), false)
})
