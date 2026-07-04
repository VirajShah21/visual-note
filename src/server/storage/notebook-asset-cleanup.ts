import type { SupabaseClient } from "@supabase/supabase-js"
import { decryptStorageSecret } from "./encryption"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { deleteS3Object } from "./s3"

type AssetRow = {
    id: string
    notebook_id: string
    bucket_name: string
    object_key: string
    visual_note_s3_connections?: {
        endpoint_url: string | null
        region: string
        force_path_style: boolean
        access_key_id: string
        encrypted_secret_access_key: string
    }
}

type DeletedAssetRow = {
    id: string
    notebookId: string
    objectKey: string
    bucketName: string
    connection?: {
        endpointUrl: string | null
        region: string
        forcePathStyle: boolean
        accessKeyId: string
        secretAccessKey: string
    }
}

const deletedAssetSelection =
    "id,notebook_id,object_key,bucket_name,visual_note_s3_connections(id,name,endpoint_url,region,force_path_style,access_key_id,encrypted_secret_access_key)"

const privateAssetPattern = /\/api\/assets\/([a-z0-9-]+)/gi

const mapDeletedAssetRow = (row: unknown) => {
    const raw = row as AssetRow
    const connection = raw.visual_note_s3_connections
    if (!connection) return { id: raw.id, notebookId: raw.notebook_id, objectKey: raw.object_key, bucketName: raw.bucket_name } as DeletedAssetRow

    return {
        id: raw.id,
        notebookId: raw.notebook_id,
        objectKey: raw.object_key,
        bucketName: raw.bucket_name,
        connection: {
            endpointUrl: connection.endpoint_url,
            region: connection.region,
            forcePathStyle: connection.force_path_style,
            accessKeyId: connection.access_key_id,
            secretAccessKey: decryptStorageSecret(connection.encrypted_secret_access_key),
        },
    } as DeletedAssetRow
}

export const collectPrivateAssetIdsFromValue = (value: unknown) => {
    const ids = new Set<string>()

    const visit = (entry: unknown) => {
        if (typeof entry === "string") {
            for (const match of entry.matchAll(privateAssetPattern)) if (match[1]) ids.add(match[1])
            return
        }

        if (Array.isArray(entry)) {
            entry.forEach(visit)
            return
        }

        if (entry && typeof entry === "object") Object.values(entry).forEach(visit)
    }

    visit(value)
    return ids
}

export const deleteAssetsNotInNotebooks = async (supabase: SupabaseClient, userId: string, allowedNotebookIds: Set<string>, deleteUpdatedBefore?: string) => {
    const ids = [...allowedNotebookIds]
    const excludedIds = `(${ids.map(id => `'${id}'`).join(",")})`

    let lookupQuery = supabase.from("visual_note_assets").select(deletedAssetSelection).eq("user_id", userId)
    if (ids.length > 0) lookupQuery = lookupQuery.not("notebook_id", "in", excludedIds)
    if (deleteUpdatedBefore) lookupQuery = lookupQuery.lte("updated_at", deleteUpdatedBefore)

    const { data, error: lookupError } = await lookupQuery
    if (lookupError) throw lookupError

    const deleted = (data ?? []).map(mapDeletedAssetRow)

    let deleteQuery = supabase.from("visual_note_assets").delete().eq("user_id", userId)
    if (ids.length > 0) deleteQuery = deleteQuery.not("notebook_id", "in", excludedIds)
    if (deleteUpdatedBefore) deleteQuery = deleteQuery.lte("updated_at", deleteUpdatedBefore)

    const { error } = await deleteQuery
    if (error) throw error

    return deleted
}

export const deleteAssetObjects = (assets: Awaited<ReturnType<typeof deleteAssetsNotReferencedByWorkspace>>[number][]) =>
    Promise.allSettled(
        assets.map(asset =>
            asset.connection
                ? deleteS3Object({
                      bucketName: asset.bucketName,
                      connection: asset.connection,
                      objectKey: asset.objectKey,
                  }).catch(() => {})
                : Promise.resolve(),
        ),
    )

export const deleteAssetsNotReferencedByWorkspace = async (supabase: SupabaseClient, userId: string, workspace: VisualNoteWorkspace, deleteUpdatedBefore?: string) => {
    const notebookIds = [...new Set(workspace.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.id))]
    if (notebookIds.length === 0) return []

    const referencedIds = [...collectPrivateAssetIdsFromValue(workspace)]
    const excludedAssetIds = `(${referencedIds.map(id => `'${id}'`).join(",")})`

    let lookupQuery = supabase.from("visual_note_assets").select(deletedAssetSelection).eq("user_id", userId).in("notebook_id", notebookIds)
    if (referencedIds.length > 0) lookupQuery = lookupQuery.not("id", "in", excludedAssetIds)
    if (deleteUpdatedBefore) lookupQuery = lookupQuery.lte("updated_at", deleteUpdatedBefore)

    const { data, error: lookupError } = await lookupQuery
    if (lookupError) throw lookupError

    const deleted = (data ?? []).map(mapDeletedAssetRow)

    let deleteQuery = supabase.from("visual_note_assets").delete().eq("user_id", userId).in("notebook_id", notebookIds)
    if (referencedIds.length > 0) deleteQuery = deleteQuery.not("id", "in", excludedAssetIds)
    if (deleteUpdatedBefore) deleteQuery = deleteQuery.lte("updated_at", deleteUpdatedBefore)

    const { error } = await deleteQuery
    if (error) throw error

    return deleted
}
