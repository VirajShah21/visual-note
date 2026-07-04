import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { hydrateViewsFromPageMarkdown, upsertPages } from "./page-store"

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
