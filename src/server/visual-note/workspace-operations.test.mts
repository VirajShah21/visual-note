import assert from "node:assert/strict"
import test from "node:test"
import { parseArticleContent } from "@lib/visual-note/article-content"
import { serializeVisualBlockBody } from "@lib/visual-note/visual-blocks"
import type { VisualNoteWorkspace } from "@lib/visual-note/types"
import * as workspaceOperations from "./workspace-operations"
import { visualNoteCoreToolNames, visualNoteToolDefinitions } from "@server/mcp/visual-note-tools"

const { createArticle, createNotebook, readArticle, readNotebookTree, removeVisualBlock, replaceArticleContent, repairWorkspaceConsistency, upsertVisualBlock } =
    workspaceOperations

const expectedCoreToolNames = [
    "list_notebooks",
    "read_notebook",
    "create_article",
    "create_notebook",
    "create_workspace_snapshot",
    "export_publish_bundle",
    "read_article",
    "replace_article_content",
    "upsert_visual_block",
    "remove_visual_block",
    "workspace_health_check",
    "repair_workspace_consistency",
    "publish_notebook",
    "unpublish_notebook",
    "list_workspace_snapshots",
    "restore_workspace_snapshot",
].sort()

const baseWorkspace = (): VisualNoteWorkspace => ({
    notebooks: [
        {
            id: "notebook-1",
            userId: "user-1",
            title: "Book",
            slug: "book",
            summary: "A notebook",
            color: "#2f7d5c",
            createdAt: "2026-06-21T00:00:00.000Z",
        },
        {
            id: "notebook-2",
            userId: "user-2",
            title: "Other",
            slug: "other",
            summary: "",
            color: "#2f7d5c",
            createdAt: "2026-06-21T00:00:00.000Z",
        },
    ],
    pages: [
        { id: "page-2", notebookId: "notebook-1", title: "Second", position: 1 },
        { id: "page-1", notebookId: "notebook-1", title: "First", position: 0 },
        { id: "page-3", notebookId: "notebook-2", title: "Private", position: 0 },
    ],
    topics: [
        { id: "topic-2", pageId: "page-1", title: "Beta", summary: "", position: 1 },
        { id: "topic-1", pageId: "page-1", title: "Alpha", summary: "", position: 0 },
        { id: "topic-3", pageId: "page-2", title: "Gamma", summary: "", position: 0 },
        { id: "topic-4", pageId: "page-3", title: "Hidden", summary: "", position: 0 },
    ],
    views: [
        { id: "view-1", topicId: "topic-1", title: "Alpha article", mode: "article", content: "# Alpha\n\nIntro", displays: [] },
        { id: "view-2", topicId: "topic-2", title: "Beta article", mode: "article", content: "Beta", displays: [] },
        { id: "view-3", topicId: "topic-4", title: "Hidden article", mode: "article", content: "Hidden", displays: [] },
    ],
})

test("exports the core workspace operation facade at runtime", () => {
    assert.equal(typeof workspaceOperations.listNotebooks, "function")
    assert.equal(typeof workspaceOperations.readNotebookTree, "function")
    assert.equal(typeof workspaceOperations.createArticle, "function")
    assert.equal(typeof workspaceOperations.createNotebook, "function")
    assert.equal(typeof workspaceOperations.readArticle, "function")
    assert.equal(typeof workspaceOperations.replaceArticleContent, "function")
    assert.equal(typeof workspaceOperations.upsertVisualBlock, "function")
    assert.equal(typeof workspaceOperations.removeVisualBlock, "function")
})

test("exposes only the core MCP tool registry", () => {
    assert.deepEqual(Array.from(visualNoteCoreToolNames).sort(), expectedCoreToolNames)
    assert.deepEqual(visualNoteToolDefinitions.map(tool => tool.name).sort(), expectedCoreToolNames)
    assert.equal(new Set(visualNoteToolDefinitions.map(tool => tool.name)).size, expectedCoreToolNames.length)
})

test("reads notebook trees in page and topic position order", () => {
    const result = readNotebookTree(baseWorkspace(), "user-1", "notebook-1")

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(
        result.value.pages.map((page: { title: string }) => page.title),
        ["First", "Second"],
    )
    assert.deepEqual(
        result.value.pages[0]?.topics.map((topic: { title: string }) => topic.title),
        ["Alpha", "Beta"],
    )
})

test("creates or reuses notebook page-topic paths and updates article content", () => {
    const workspace = baseWorkspace()
    const result = createArticle(workspace, "user-1", {
        notebookId: "notebook-1",
        pageTitle: "First",
        topicTitle: "Alpha",
        articleTitle: "Updated",
        content: "## Reused\n\nContent",
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.createdPage, false)
    assert.equal(result.value.createdTopic, false)
    assert.equal(result.value.createdView, true)
    assert.equal(result.value.workspace.pages.length, workspace.pages.length)
    assert.match(result.value.view.content, /## Reused/)
})

test("createNotebook keeps slug unique across notebooks owned by the same user", () => {
    const result = createNotebook(baseWorkspace(), "user-1", { title: "Book" })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.value.notebook.slug, "book-2")
    assert.equal(result.value.workspace.notebooks.length, 3)
    assert.equal(
        result.value.workspace.notebooks.some(notebook => notebook.slug === "book-2"),
        true,
    )
})

test("replaces article content through structured parse and serialization", () => {
    const visualBody = serializeVisualBlockBody({ title: "Project", events: [{ label: "Start", date: "2026-06-21", time: "09:00" }] })
    const content = ["# Heading", "- one\n- two", ":::note", "remember this", ":::", "```ts", "const value = 1", "```", "```visual:timeline", visualBody, "```"].join("\n\n")
    const result = replaceArticleContent(baseWorkspace(), "user-1", "view-1", content)

    assert.equal(result.ok, true)
    if (!result.ok) return
    const parsed = parseArticleContent(result.value.view.content, 0)
    assert.deepEqual(
        parsed.blocks.map(block => block.kind),
        ["heading", "bulletList", "callout", "code", "visual"],
    )
})

test("inserts, updates, and removes visual blocks", () => {
    const inserted = upsertVisualBlock(baseWorkspace(), "user-1", {
        viewId: "view-1",
        visualKind: "task-list",
        data: { title: "Tasks", tasks: [{ title: "Ship MCP", done: false }] },
    })
    assert.equal(inserted.ok, true)
    if (!inserted.ok) return
    assert.match(inserted.value.view.content, /```visual:task-list/)

    const updated = upsertVisualBlock(inserted.value.workspace, "user-1", {
        viewId: "view-1",
        blockIndex: inserted.value.blockIndex,
        visualKind: "poll",
        data: { question: "Ready?", options: [{ label: "Yes", votes: 1 }] },
    })
    assert.equal(updated.ok, true)
    if (!updated.ok) return
    assert.match(updated.value.view.content, /```visual:poll/)

    const removed = removeVisualBlock(updated.value.workspace, "user-1", "view-1", updated.value.blockIndex)
    assert.equal(removed.ok, true)
    if (!removed.ok) return
    assert.doesNotMatch(removed.value.view.content, /```visual:/)
})

test("repairs orphaned pages and views while preserving foreign-owned data", () => {
    const result = repairWorkspaceConsistency(
        {
            ...baseWorkspace(),
            pages: [
                ...baseWorkspace().pages,
                {
                    id: "orphan-page",
                    notebookId: "missing-notebook",
                    title: "Orphan",
                    position: 99,
                },
            ],
            views: [
                ...baseWorkspace().views,
                {
                    id: "orphan-view",
                    topicId: "missing-topic",
                    title: "Orphan view",
                    mode: "article",
                    content: "# Orphan",
                    displays: [],
                },
            ],
        },
        "user-1",
    )

    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.deepEqual(result.value.orphanPages, ["orphan-page"])
    assert.deepEqual(result.value.orphanViews, ["orphan-view"])
    assert.deepEqual(result.value.orphanTopics, [])
    assert.equal(result.value.repaired, true)
    const repaired = result.value.repairedWorkspace
    assert.ok(repaired)
    assert.equal(
        repaired.pages.some(page => page.id === "orphan-page"),
        false,
    )
    assert.equal(
        repaired.views.some(view => view.id === "orphan-view"),
        false,
    )
    assert.equal(
        repaired.notebooks.some(notebook => notebook.id === "notebook-2"),
        true,
    )
    assert.equal(
        repaired.pages.some(page => page.id === "page-3"),
        true,
    )
    assert.equal(
        repaired.views.some(view => view.id === "view-3"),
        true,
    )
})

test("does not expose or mutate notebooks owned by another user", () => {
    const workspace = baseWorkspace()
    const readResult = readArticle(workspace, "user-1", "view-3")
    const replaceResult = replaceArticleContent(workspace, "user-1", "view-3", "Changed")

    assert.deepEqual(readResult, { ok: false, error: "not_found", message: "Article not found." })
    assert.equal(replaceResult.ok, false)
    assert.equal(workspace.views.find(view => view.id === "view-3")?.content, "Hidden")
})
