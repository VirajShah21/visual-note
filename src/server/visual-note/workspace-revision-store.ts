import type { SupabaseClient } from "@supabase/supabase-js"
import { assertWorkspaceStoreReady } from "@/server/visual-note/workspace-readiness"

const normalizeRevisionTimestamp = (value: string | null | undefined) => value ?? "0"

const latestUpdatedAt = async (supabase: SupabaseClient, userId: string, table: "visual_note_notebooks" | "visual_note_pages") => {
    const { data, error } = await supabase.from(table).select("updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle()
    if (error) throw error

    return normalizeRevisionTimestamp((data as { updated_at?: string } | null)?.updated_at)
}

const rowCount = async (supabase: SupabaseClient, userId: string, table: "visual_note_notebooks" | "visual_note_pages") => {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId)
    if (error) throw error

    return count ?? 0
}

export const resolveWorkspaceRevision = async (supabase: SupabaseClient, userId: string) => {
    await assertWorkspaceStoreReady(supabase)

    const [notebookUpdatedAt, pageUpdatedAt, notebookCount, pageCount] = await Promise.all([
        latestUpdatedAt(supabase, userId, "visual_note_notebooks"),
        latestUpdatedAt(supabase, userId, "visual_note_pages"),
        rowCount(supabase, userId, "visual_note_notebooks"),
        rowCount(supabase, userId, "visual_note_pages"),
    ])

    return `v1|notebooks:${notebookCount}:${notebookUpdatedAt}|pages:${pageCount}:${pageUpdatedAt}`
}
