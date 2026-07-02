import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { loadWorkspaceForUser, saveWorkspaceForUser } from "./workspace-store"

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
    in() {
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

const failingSaveSupabase = () => {
    const upserts: Array<{ table: string; payload: unknown }> = []

    return {
        upserts,
        supabase: {
            from(table: string) {
                return {
                    ...query(resultsForTable(table)),
                    upsert(payload: unknown) {
                        upserts.push({ table, payload })
                        if (table === "visual_note_notebooks")
                            return Promise.resolve({
                                error: {
                                    code: "PGRST205",
                                    message: "Could not find the table public.visual_note_notebooks in the schema cache",
                                },
                            })

                        return Promise.resolve({ error: null })
                    },
                }
            },
        } as unknown as SupabaseClient,
    }
}

const resultsForTable = (table: string) => ({
    data: null,
    error:
        table === "visual_note_notebooks"
            ? {
                  code: "PGRST205",
                  message: "Could not find the table public.visual_note_notebooks in the schema cache",
              }
            : null,
})

test("returns null when a user has no normalized notebooks", async () => {
    const supabase = supabaseWithResults({
        visual_note_notebooks: {
            data: [],
            error: null,
        },
    })

    const loaded = await loadWorkspaceForUser(supabase, "user-1")

    assert.equal(loaded, null)
})

test("does not hide normalized workspace load schema errors", async () => {
    const supabase = supabaseWithResults({
        visual_note_notebooks: {
            error: {
                code: "PGRST205",
                message: "Could not find the table public.visual_note_notebooks in the schema cache",
            },
        },
    })

    await assert.rejects(
        () => loadWorkspaceForUser(supabase, "user-1"),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, "PGRST205")
            return true
        },
    )
})

test("surfaces normalized workspace save schema errors", async () => {
    const { supabase, upserts } = failingSaveSupabase()

    await assert.rejects(
        () => saveWorkspaceForUser(supabase, "user-1", workspace),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, "PGRST205")
            return true
        },
    )

    assert.equal(upserts.length, 1)
    assert.equal(upserts[0]?.table, "visual_note_notebooks")
})
