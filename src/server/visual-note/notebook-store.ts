import type { SupabaseClient } from "@supabase/supabase-js"
import type { Notebook, NotebookEditorSettings } from "@/lib/visual-note/types"
import { defaultNotebookEditorSettings } from "@/lib/visual-note/types"
import { normalizeNotebookEditorSettings } from "@/lib/visual-note/factories"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

type NotebookRow = {
    id: string
    user_id: string
    title: string
    slug: string
    summary: string
    color: string
    editor_settings: Record<string, unknown>
    created_at: string
}

export type NotebookSummary = {
    id: string
    userId: string
    title: string
    slug: string
    summary: string
    color: string
    createdAt: string
    editorSettings: NotebookEditorSettings
}

const toWorkspaceNotebook = (row: NotebookRow): NotebookSummary => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    color: row.color,
    createdAt: row.created_at,
    editorSettings: normalizeNotebookEditorSettings((row.editor_settings ?? {}) as Partial<NotebookEditorSettings>),
})

export const listNotebooksForUser = async (supabase: SupabaseClient, userId: string): Promise<Notebook[]> => {
    const { data, error } = await supabase
        .from("visual_note_notebooks")
        .select("id,user_id,title,slug,summary,color,editor_settings,created_at")
        .eq("user_id", userId)
        .order("created_at")
    if (error) throw error

    return (data ?? []).map(row => ({
        ...(toWorkspaceNotebook(row as NotebookRow) as Notebook),
        createdAt: toWorkspaceNotebook(row as NotebookRow).createdAt,
    }))
}

export const upsertNotebooks = async (supabase: SupabaseClient, userId: string, notebooks: VisualNoteWorkspace["notebooks"]) => {
    const rows = notebooks
        .filter(item => item.userId === userId)
        .map(item => ({
            id: item.id,
            user_id: item.userId,
            title: item.title,
            slug: item.slug,
            summary: item.summary,
            color: item.color,
            editor_settings: item.editorSettings ?? defaultNotebookEditorSettings,
            updated_at: new Date().toISOString(),
        }))

    if (rows.length === 0) return

    const { error } = await supabase.from("visual_note_notebooks").upsert(rows, { onConflict: "id" })
    if (error) throw error
}

export const upsertNotebook = async (supabase: SupabaseClient, notebook: Notebook): Promise<void> => {
    const { error } = await supabase.from("visual_note_notebooks").upsert(
        {
            id: notebook.id,
            user_id: notebook.userId,
            title: notebook.title,
            slug: notebook.slug,
            summary: notebook.summary,
            color: notebook.color,
            editor_settings: notebook.editorSettings ?? defaultNotebookEditorSettings,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
    )
    if (error) throw error
}

export const deleteNotebooksNotIn = async (
    supabase: SupabaseClient,
    userId: string,
    allowedNotebookIds: Set<string>,
    deleteUpdatedBefore?: string,
) => {
    const ids = [...allowedNotebookIds]
    const staleBefore = deleteUpdatedBefore
    if (ids.length === 0) {
        let query = supabase.from("visual_note_notebooks").delete().eq("user_id", userId)
        if (staleBefore) query = query.lte("updated_at", staleBefore)
        const { error: clearError } = await query
        if (clearError) throw clearError
        return
    }

    let query = supabase
        .from("visual_note_notebooks")
        .delete()
        .eq("user_id", userId)
        .not("id", "in", `(${ids.map(id => `'${id}'`).join(",")})`)

    if (staleBefore) query = query.lte("updated_at", staleBefore)

    const { error } = await query
    if (error) throw error
}

export const listNotebookIdsForUser = async (supabase: SupabaseClient, userId: string): Promise<string[]> => {
    const { data, error } = await supabase.from("visual_note_notebooks").select("id").eq("user_id", userId)
    if (error) throw error

    return (data ?? []).map(item => item.id as string)
}

export const userOwnsNotebook = async (supabase: SupabaseClient, userId: string, notebookId: string): Promise<boolean> => {
    const { data, error } = await supabase.from("visual_note_notebooks").select("id").eq("user_id", userId).eq("id", notebookId).maybeSingle()
    if (error) return false

    return Boolean(data?.id)
}

export const normalizeNotebookMetadata = (notebook: Partial<Notebook> & { userId: string }): Notebook => ({
    id: notebook.id ?? "",
    userId: notebook.userId,
    title: notebook.title ?? "Notebook",
    slug: notebook.slug ?? "notebook",
    summary: notebook.summary ?? "A structured web notebook with sections, topics, views, components, and data.",
    color: notebook.color ?? "#2f7d5c",
    createdAt: notebook.createdAt ?? new Date().toISOString(),
    editorSettings: normalizeNotebookEditorSettings(notebook.editorSettings),
})
