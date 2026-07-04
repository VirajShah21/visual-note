import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { savePageMarkdownIfConfigured } from "./page-content-store"

const supabaseWithoutNotebookStorage = () =>
    ({
        from() {
            return {
                select() {
                    return this
                },
                eq() {
                    return this
                },
                maybeSingle() {
                    return Promise.resolve({ data: null, error: null })
                },
            }
        },
    }) as unknown as SupabaseClient

test("skips markdown object writes when notebook storage is not configured", async () => {
    const result = await savePageMarkdownIfConfigured(
        {
            supabase: supabaseWithoutNotebookStorage(),
            userId: "user-1",
        },
        { notebookId: "notebook-1", id: "page-1" },
        "# Draft",
    )

    assert.deepEqual(result, {
        saved: false,
        objectKey: "notebooks/notebook-1/pages/page-1.md",
    })
})
