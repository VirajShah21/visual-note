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
    delete() {
        return this
    },
    select() {
        return this
    },
    eq() {
        return this
    },
    lte() {
        return this
    },
    not() {
        return this
    },
    in() {
        return this
    },
    order() {
        return Promise.resolve(result)
    },
    limit() {
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

const supabaseWithOwnershipConflict = () => {
    const upserts: Array<{ table: string; payload: unknown }> = []

    return {
        upserts,
        supabase: {
            from(table: string) {
                const notebookIdsByTable = table === "visual_note_notebooks" ? [{ id: "notebook-1", user_id: "intruder" }] : table === "visual_note_pages" ? [] : []

                return {
                    select() {
                        return this
                    },
                    in() {
                        return { data: notebookIdsByTable, error: null }
                    },
                    eq() {
                        return this
                    },
                    limit() {
                        return Promise.resolve({ data: null, error: null })
                    },
                    order() {
                        return Promise.resolve({ data: null, error: null })
                    },
                    upsert(payload: unknown) {
                        upserts.push({ table, payload })
                        return Promise.resolve({ error: null })
                    },
                }
            },
        } as unknown as SupabaseClient,
    }
}

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

test("reports normalized workspace readiness errors on load", async () => {
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
            assert.equal((error as { code?: string }).code, "workspace_schema_not_ready")
            assert.match((error as Error).message, /Visual Note normalized workspace storage is not ready/)
            return true
        },
    )
})

test("reports normalized workspace readiness errors before save writes", async () => {
    const { supabase, upserts } = failingSaveSupabase()

    await assert.rejects(
        () => saveWorkspaceForUser(supabase, "user-1", workspace),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, "workspace_schema_not_ready")
            return true
        },
    )

    assert.equal(upserts.length, 0)
})

test("rejects ownership-conflicting records on save", async () => {
    const { supabase, upserts } = supabaseWithOwnershipConflict()

    await assert.rejects(
        () => saveWorkspaceForUser(supabase, "user-1", workspace),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, "ownership_conflict")
            return true
        },
    )

    assert.equal(upserts.length, 0)
})

test("rejects page entries for unknown notebooks", async () => {
    const invalidPageWorkspace = {
        ...workspace,
        pages: [{ id: "page-2", notebookId: "missing-notebook", title: "Missing", position: 0 }],
        topics: [],
        views: [],
    }

    await assert.rejects(
        () =>
            saveWorkspaceForUser(
                supabaseWithResults({
                    visual_note_notebooks: { data: [], error: null },
                    visual_note_pages: { data: [], error: null },
                }),
                "user-1",
                invalidPageWorkspace,
            ),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, "workspace_integrity")
            assert.match((error as Error).message, /page:page-2/)
            return true
        },
    )
})

test("rejects topics referencing unknown pages", async () => {
    const invalidTopicWorkspace = {
        ...workspace,
        topics: [{ id: "topic-2", pageId: "missing-page", title: "Missing", summary: "", position: 0 }],
        views: [],
    }

    await assert.rejects(
        () =>
            saveWorkspaceForUser(
                supabaseWithResults({
                    visual_note_notebooks: { data: [], error: null },
                    visual_note_pages: { data: [], error: null },
                }),
                "user-1",
                invalidTopicWorkspace,
            ),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, "workspace_integrity")
            assert.match((error as Error).message, /topic:topic-2/)
            return true
        },
    )
})

test("rejects notebook ownership mismatch introduced by prior transfers", async () => {
    const transferAttempt = { ...workspace }

    await assert.rejects(
        () =>
            saveWorkspaceForUser(
                supabaseWithResults({
                    visual_note_notebooks: {
                        data: [{ id: "notebook-1", user_id: "user-2" }],
                        error: null,
                    },
                }),
                "user-1",
                transferAttempt,
            ),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, "ownership_conflict")
            return true
        },
    )
})

test("rejects page transfer away from the owning user", async () => {
    const transferAttempt = {
        ...workspace,
        pages: workspace.pages.map(page => ({ ...page, notebookId: "notebook-2" })),
    }

    await assert.rejects(
        () =>
            saveWorkspaceForUser(
                supabaseWithResults({
                    visual_note_notebooks: {
                        data: [
                            { id: "notebook-1", user_id: "user-1" },
                            { id: "notebook-2", user_id: "user-2" },
                        ],
                        error: null,
                    },
                    visual_note_pages: { data: [], error: null },
                }),
                "user-1",
                transferAttempt,
            ),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, "workspace_integrity")
            return true
        },
    )
})

test("rejects views referencing unknown topics", async () => {
    const invalidViewWorkspace = {
        ...workspace,
        views: [{ id: "view-2", topicId: "missing-topic", title: "Missing", mode: "article" as const, content: "# Missing", displays: [] }],
    }

    await assert.rejects(
        () =>
            saveWorkspaceForUser(
                supabaseWithResults({
                    visual_note_notebooks: { data: [], error: null },
                    visual_note_pages: { data: [] as Array<{ id: string; user_id: string }>, error: null },
                }),
                "user-1",
                invalidViewWorkspace,
            ),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, "workspace_integrity")
            assert.match((error as Error).message, /view:view-2/)
            return true
        },
    )
})
