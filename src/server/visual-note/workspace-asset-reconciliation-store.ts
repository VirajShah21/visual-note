import type { SupabaseClient } from "@supabase/supabase-js"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { deleteAssetObjects, deleteAssetsNotInNotebooks, deleteAssetsNotReferencedByWorkspace } from "@/server/storage/notebook-asset-cleanup"

export type WorkspaceAssetCleanupResult = {
    deletedReferencedAssets: number
    deletedMissingNotebookAssets: number
    deletedAssetRecords: number
}

export type WorkspaceAssetReconciliationResult = {
    usersScanned: number
    deletedReferencedAssets: number
    deletedMissingNotebookAssets: number
    deletedAssetRecords: number
}

type WorkspaceLoader = (supabase: SupabaseClient, userId: string) => Promise<VisualNoteWorkspace | null>
type WorkspaceCleanup = (supabase: SupabaseClient, userId: string, workspace?: VisualNoteWorkspace, deleteUpdatedBefore?: string) => Promise<WorkspaceAssetCleanupResult>

const emptyCleanupResult = (): WorkspaceAssetCleanupResult => ({
    deletedReferencedAssets: 0,
    deletedMissingNotebookAssets: 0,
    deletedAssetRecords: 0,
})

export const cleanupWorkspaceAssetOrphansForUser = async (
    supabase: SupabaseClient,
    userId: string,
    loadWorkspace: WorkspaceLoader,
    workspace?: VisualNoteWorkspace,
    deleteUpdatedBefore?: string,
): Promise<WorkspaceAssetCleanupResult> => {
    const current = workspace ?? (await loadWorkspace(supabase, userId))
    if (!current) return emptyCleanupResult()

    const notebookIds = new Set<string>(current.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.id))
    if (notebookIds.size === 0) return emptyCleanupResult()

    const deletedUnreferencedAssets = await deleteAssetsNotReferencedByWorkspace(supabase, userId, current, deleteUpdatedBefore)
    await deleteAssetObjects(deletedUnreferencedAssets)

    const deletedAssets = await deleteAssetsNotInNotebooks(supabase, userId, notebookIds, deleteUpdatedBefore)
    await deleteAssetObjects(deletedAssets)

    return {
        deletedReferencedAssets: deletedUnreferencedAssets.length,
        deletedMissingNotebookAssets: deletedAssets.length,
        deletedAssetRecords: deletedUnreferencedAssets.length + deletedAssets.length,
    }
}

const listUserIdsWithAssetRecords = async (supabase: SupabaseClient) => {
    const userIds = new Set<string>()
    const pageSize = 500
    let page = 0

    while (true) {
        const start = page * pageSize
        const end = start + pageSize - 1
        const { data, error } = await supabase.from("visual_note_assets").select("user_id").range(start, end)
        if (error) throw error

        if (!data || data.length === 0) return [...userIds]

        data.forEach(row => {
            if (typeof (row as { user_id?: string }).user_id === "string") userIds.add((row as { user_id: string }).user_id)
        })

        if (data.length < pageSize) break
        page += 1
    }

    return [...userIds]
}

export const cleanupWorkspaceAssetOrphansForEveryUser = async (
    supabase: SupabaseClient,
    cleanupWorkspace: WorkspaceCleanup,
    deleteUpdatedBefore?: string,
): Promise<WorkspaceAssetReconciliationResult> => {
    const userIds = await listUserIdsWithAssetRecords(supabase)
    let deletedReferencedAssets = 0
    let deletedMissingNotebookAssets = 0

    for (const userId of userIds) {
        const summary = await cleanupWorkspace(supabase, userId, undefined, deleteUpdatedBefore)
        deletedReferencedAssets += summary.deletedReferencedAssets
        deletedMissingNotebookAssets += summary.deletedMissingNotebookAssets
    }

    return {
        usersScanned: userIds.length,
        deletedReferencedAssets,
        deletedMissingNotebookAssets,
        deletedAssetRecords: deletedReferencedAssets + deletedMissingNotebookAssets,
    }
}
