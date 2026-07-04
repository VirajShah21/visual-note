import type { SupabaseClient } from "@supabase/supabase-js"
import type { NotebookPage, NotebookView, VisualNoteWorkspace, WorkspaceSnapshot } from "@/lib/visual-note/types"

type WorkspaceSnapshotRow = {
    id: string
    name: string
    note: string | null
    created_at: string
    workspace: Omit<VisualNoteWorkspace, "snapshots">
}

const snapshotsTable = "visual_note_workspace_snapshots"

type SnapshotWorkspace = Omit<VisualNoteWorkspace, "snapshots">

const stripPageContent = (page: NotebookPage): NotebookPage => {
    const next = { ...page }
    delete next.content
    return next
}

const stripViewContent = (view: NotebookView): NotebookView => ({ ...view, content: "" })

export const sanitizeSnapshotWorkspace = (workspace: SnapshotWorkspace): SnapshotWorkspace => ({
    notebooks: workspace.notebooks,
    pages: workspace.pages.map(stripPageContent),
    topics: workspace.topics,
    views: workspace.views.map(stripViewContent),
})

const toSnapshot = (row: WorkspaceSnapshotRow): WorkspaceSnapshot => ({
    id: row.id,
    name: row.name,
    note: row.note ?? undefined,
    createdAt: row.created_at,
    workspace: sanitizeSnapshotWorkspace(row.workspace),
})

export const listWorkspaceSnapshotsForUser = async (supabase: SupabaseClient, userId: string): Promise<WorkspaceSnapshot[]> => {
    const { data, error } = await supabase.from(snapshotsTable).select("id,name,note,created_at,workspace").eq("user_id", userId).order("created_at", { ascending: true })
    if (error) throw error

    return ((data ?? []) as WorkspaceSnapshotRow[]).map(toSnapshot)
}

export const upsertWorkspaceSnapshotsForUser = async (supabase: SupabaseClient, userId: string, snapshots: WorkspaceSnapshot[] | undefined) => {
    if (!snapshots || snapshots.length === 0) return

    const rows = snapshots.slice(-30).map(snapshot => ({
        id: snapshot.id,
        user_id: userId,
        name: snapshot.name,
        note: snapshot.note ?? null,
        created_at: snapshot.createdAt,
        workspace: sanitizeSnapshotWorkspace(snapshot.workspace),
    }))

    const { error } = await supabase.from(snapshotsTable).upsert(rows, { onConflict: "id" })
    if (error) throw error

    const retainedIds = rows.map(row => row.id)
    const { data: existingRows, error: listError } = await supabase.from(snapshotsTable).select("id").eq("user_id", userId)
    if (listError) throw listError

    const staleIds = (existingRows ?? []).map(row => (row as { id?: unknown }).id).filter((id): id is string => typeof id === "string" && !retainedIds.includes(id))
    if (staleIds.length === 0) return

    const { error: deleteError } = await supabase.from(snapshotsTable).delete().eq("user_id", userId).in("id", staleIds)
    if (deleteError) throw deleteError
}
