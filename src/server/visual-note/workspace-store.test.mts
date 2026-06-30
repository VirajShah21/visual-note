import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { loadWorkspaceForUser } from "./workspace-store"

const legacyWorkspace: VisualNoteWorkspace = {
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

type QueryResult = {
    data?: unknown
    error?: unknown
}

const query = (result: QueryResult) => ({
    select() {
        return this
    },
    eq() {
        return this
    },
    order() {
        return Promise.resolve(result)
    },
    maybeSingle() {
        return Promise.resolve(result)
    },
})

const supabaseWithResults = (results: Record<string, QueryResult>) =>
    ({
        from(table: string) {
            return query(results[table] ?? { data: null, error: null })
        },
    }) as unknown as SupabaseClient

test("falls back to the legacy workspace when normalized workspace tables are unavailable", async () => {
    const supabase = supabaseWithResults({
        visual_note_notebooks: {
            error: {
                code: "PGRST205",
                message: "Could not find the table public.visual_note_notebooks in the schema cache",
            },
        },
        visual_note_workspaces: {
            data: { workspace: legacyWorkspace },
            error: null,
        },
    })

    const workspace = await loadWorkspaceForUser(supabase, "user-1")

    assert.equal(workspace?.notebooks[0]?.id, "notebook-1")
    assert.equal(workspace?.views[0]?.id, "view-1")
})

test("does not hide non-schema workspace load errors behind legacy fallback", async () => {
    const supabase = supabaseWithResults({
        visual_note_notebooks: {
            error: {
                code: "42501",
                message: "permission denied for table visual_note_notebooks",
            },
        },
        visual_note_workspaces: {
            data: { workspace: legacyWorkspace },
            error: null,
        },
    })

    await assert.rejects(
        () => loadWorkspaceForUser(supabase, "user-1"),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, "42501")
            return true
        },
    )
})
