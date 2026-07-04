import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { hydrateViewsFromPageMarkdown, upsertPages } from "./page-store"
import { pageMarkdownFromWorkspace } from "./workspace-store-save-helpers"

const topics = [
    { id: "topic-1", pageId: "page-1", title: "Start", summary: "", position: 0 },
    { id: "topic-2", pageId: "page-1", title: "Details", summary: "", position: 1 },
]

const views = [
    { id: "view-1", topicId: "topic-1", title: "Article", mode: "article" as const, content: "Stored body", displays: [] },
    { id: "view-2", topicId: "topic-2", title: "Article", mode: "article" as const, content: "Stored body", displays: [] },
]

test("upsertPages strips article body content from persisted view metadata", async () => {
    let payload: Array<{ views: typeof views }> = []
    const supabase = {
        from() {
            return {
                upsert(value: typeof payload) {
                    payload = value
                    return Promise.resolve({ error: null })
                },
            }
        },
    } as unknown as SupabaseClient

    await upsertPages(supabase, "user-1", [
        {
            page: { id: "page-1", notebookId: "notebook-1", title: "Home", position: 0 },
            notebookId: "notebook-1",
            topics,
            views,
            contentObjectKey: "notebooks/notebook-1/pages/page-1.md",
        },
    ])

    assert.equal(payload[0].views[0].content, "")
    assert.equal(payload[0].views[1].content, "")
})

test("hydrateViewsFromPageMarkdown restores selected article content from topic sections", () => {
    const markdown = ["# Home", "", "## Start", "", "Intro", "", "## Body heading", "Still part of Start.", "", "## Details", "", "Second topic."].join("\n")
    const hydrated = hydrateViewsFromPageMarkdown(topics, views, markdown)

    assert.equal(hydrated[0].content, "Intro\n\n## Body heading\nStill part of Start.")
    assert.equal(hydrated[1].content, "Second topic.")
})

test("marked page markdown preserves image blocks, secondary views, and repeated headings", async () => {
    const workspace = {
        notebooks: [
            {
                id: "notebook-1",
                userId: "user-1",
                title: "Notebook",
                slug: "notebook",
                summary: "",
                color: "#111111",
                createdAt: "2026-01-01T00:00:00.000Z",
            },
        ],
        pages: [{ id: "page-1", notebookId: "notebook-1", title: "Home", position: 0 }],
        topics,
        views: [
            {
                id: "view-1",
                topicId: "topic-1",
                title: "Article",
                mode: "article" as const,
                content: ["Intro", "", "## Details", "This heading matches the next topic.", "", "![Diagram](/api/assets/asset-1)"].join("\n"),
                displays: [],
            },
            { id: "view-secondary", topicId: "topic-1", title: "Dashboard", mode: "dashboard" as const, content: "Secondary content", displays: [] },
            { id: "view-2", topicId: "topic-2", title: "Article", mode: "article" as const, content: "Second topic.", displays: [] },
        ],
    }

    const markdown = await pageMarkdownFromWorkspace(workspace, "page-1")
    const hydrated = hydrateViewsFromPageMarkdown(topics, workspace.views, markdown)

    assert.match(markdown, /<!-- visual-note:topic topic-1 -->/)
    assert.match(markdown, /<!-- visual-note:view view-secondary -->/)
    assert.match(markdown, /!\[Diagram\]\(\/api\/assets\/asset-1\)/)
    assert.match(hydrated[0].content, /## Details\n\nThis heading matches the next topic\./)
    assert.match(hydrated[0].content, /!\[Diagram\]\(\/api\/assets\/asset-1\)/)
    assert.equal(hydrated[1].content, "Secondary content")
    assert.equal(hydrated[2].content, "Second topic.")
})
