import type { SupabaseClient } from "@supabase/supabase-js"
import { canEncryptStorageSecrets, decryptStorageSecret, encryptStorageSecret } from "./encryption"
import type { S3ConnectionConfig } from "./s3"
import type { NotebookStorageSettings, NotebookStorageSettingsInput } from "@/lib/visual-note/storage-settings"
import { deleteS3Object } from "@/server/storage/s3"

type S3ConnectionRow = {
    id: string
    user_id: string
    name: string
    endpoint_url: string | null
    region: string
    force_path_style: boolean
    access_key_id: string
    encrypted_secret_access_key: string
}

type NotebookStorageRow = {
    notebook_id: string
    user_id: string
    connection_id: string
    bucket_name: string
    visual_note_s3_connections?: S3ConnectionRow
}

type AssetRow = {
    id: string
    user_id: string
    notebook_id: string
    connection_id: string
    bucket_name: string
    object_key: string
    content_type: string
    file_name: string
    byte_size: number | null
    metadata: Record<string, unknown>
    visual_note_s3_connections?: S3ConnectionRow
}

export type ResolvedNotebookStorage = {
    notebookId: string
    userId: string
    connectionId: string
    bucketName: string
    connection: S3ConnectionConfig
}

export type CreatedAsset = {
    id: string
    objectKey: string
    contentType: string
    fileName: string
    byteSize: number
}

export const createAssetObjectKey = (notebookId: string, fileName: string) => {
    const safeName =
        fileName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, "-")
            .replace(/^-+|-+$/g, "") || "image"
    return [notebookId, "images", `${crypto.randomUUID()}-${safeName}`].join("/")
}

export const mapStorageSettings = (storage: NotebookStorageRow | null): NotebookStorageSettings | null => {
    const connection = storage?.visual_note_s3_connections
    if (!storage || !connection) return null

    return {
        connectionId: connection.id,
        connectionName: connection.name,
        endpointUrl: connection.endpoint_url ?? "",
        region: connection.region,
        forcePathStyle: connection.force_path_style,
        accessKeyId: connection.access_key_id,
        hasSecretAccessKey: Boolean(connection.encrypted_secret_access_key),
        bucketName: storage.bucket_name,
    }
}

export const loadNotebookStorageSettings = async (supabase: SupabaseClient, userId: string, notebookId: string) => {
    const { data, error } = await supabase
        .from("visual_note_notebook_storage")
        .select("notebook_id,user_id,connection_id,bucket_name,visual_note_s3_connections(*)")
        .eq("user_id", userId)
        .eq("notebook_id", notebookId)
        .maybeSingle()
    if (error) throw error

    return mapStorageSettings(data as NotebookStorageRow | null)
}

export const saveNotebookStorageSettings = async (supabase: SupabaseClient, userId: string, notebookId: string, input: NotebookStorageSettingsInput) => {
    if (!canEncryptStorageSecrets()) throw new Error("VISUAL_NOTE_S3_ENCRYPTION_KEY is required before saving S3 settings.")

    const now = new Date().toISOString()
    const connectionId = input.connectionId || crypto.randomUUID()
    const existingSecret = input.connectionId ? await loadExistingEncryptedSecret(supabase, userId, input.connectionId) : null
    const encryptedSecret = input.secretAccessKey?.trim() ? encryptStorageSecret(input.secretAccessKey.trim()) : existingSecret
    if (!encryptedSecret) throw new Error("Secret access key is required.")

    const { error: connectionError } = await supabase.from("visual_note_s3_connections").upsert({
        id: connectionId,
        user_id: userId,
        name: input.connectionName.trim(),
        endpoint_url: input.endpointUrl.trim() || null,
        region: input.region.trim() || "us-east-1",
        force_path_style: input.forcePathStyle,
        access_key_id: input.accessKeyId.trim(),
        encrypted_secret_access_key: encryptedSecret,
        updated_at: now,
    })
    if (connectionError) throw connectionError

    const { error: storageError } = await supabase.from("visual_note_notebook_storage").upsert(
        {
            notebook_id: notebookId,
            user_id: userId,
            connection_id: connectionId,
            bucket_name: input.bucketName.trim(),
            updated_at: now,
        },
        { onConflict: "user_id,notebook_id" },
    )
    if (storageError) throw storageError

    return loadNotebookStorageSettings(supabase, userId, notebookId)
}

export const resolveNotebookStorage = async (supabase: SupabaseClient, userId: string, notebookId: string): Promise<ResolvedNotebookStorage | null> => {
    if (!canEncryptStorageSecrets()) throw new Error("VISUAL_NOTE_S3_ENCRYPTION_KEY is required before using S3 settings.")

    const { data, error } = await supabase
        .from("visual_note_notebook_storage")
        .select("notebook_id,user_id,connection_id,bucket_name,visual_note_s3_connections(*)")
        .eq("user_id", userId)
        .eq("notebook_id", notebookId)
        .maybeSingle()
    if (error) throw error

    const storage = data as NotebookStorageRow | null
    const connection = storage?.visual_note_s3_connections
    if (!storage || !connection) return null

    return {
        notebookId,
        userId,
        connectionId: connection.id,
        bucketName: storage.bucket_name,
        connection: {
            endpointUrl: connection.endpoint_url,
            region: connection.region,
            forcePathStyle: connection.force_path_style,
            accessKeyId: connection.access_key_id,
            secretAccessKey: decryptStorageSecret(connection.encrypted_secret_access_key),
        },
    }
}

export const createAssetRecord = async (
    supabase: SupabaseClient,
    storage: ResolvedNotebookStorage,
    file: { name: string; contentType: string; byteSize: number; objectKey: string },
): Promise<CreatedAsset> => {
    const { data, error } = await supabase
        .from("visual_note_assets")
        .insert({
            user_id: storage.userId,
            notebook_id: storage.notebookId,
            connection_id: storage.connectionId,
            bucket_name: storage.bucketName,
            object_key: file.objectKey,
            content_type: file.contentType,
            file_name: file.name,
            byte_size: file.byteSize,
            metadata: {},
        })
        .select("id,object_key,content_type,file_name,byte_size")
        .single()
    if (error) throw error

    const asset = data as Pick<AssetRow, "id" | "object_key" | "content_type" | "file_name" | "byte_size">
    return {
        id: asset.id,
        objectKey: asset.object_key,
        contentType: asset.content_type,
        fileName: asset.file_name,
        byteSize: asset.byte_size ?? file.byteSize,
    }
}

export const loadAssetStorage = async (supabase: SupabaseClient, userId: string, assetId: string) => {
    if (!canEncryptStorageSecrets()) throw new Error("VISUAL_NOTE_S3_ENCRYPTION_KEY is required before reading S3 assets.")

    const { data, error } = await supabase.from("visual_note_assets").select("*,visual_note_s3_connections(*)").eq("user_id", userId).eq("id", assetId).maybeSingle()
    if (error) throw error

    return mapAssetStorage(data as AssetRow | null)
}

export const loadSignedAssetStorage = async (supabase: SupabaseClient, assetId: string) => {
    if (!canEncryptStorageSecrets()) throw new Error("VISUAL_NOTE_S3_ENCRYPTION_KEY is required before reading S3 assets.")

    const { data, error } = await supabase.from("visual_note_assets").select("*,visual_note_s3_connections(*)").eq("id", assetId).maybeSingle()
    if (error) throw error

    return mapAssetStorage(data as AssetRow | null)
}

export const deleteAssetRecord = async (supabase: SupabaseClient, userId: string, assetId: string) => {
    const resolved = await loadAssetStorage(supabase, userId, assetId)
    if (!resolved) return null

    const { data, error: deleteError } = await supabase
        .from("visual_note_assets")
        .delete()
        .eq("id", assetId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle()
    if (deleteError) throw deleteError
    if (!data) return null

    await deleteS3Object({
        bucketName: resolved.asset.bucketName,
        connection: resolved.connection,
        objectKey: resolved.asset.objectKey,
    }).catch(() => {})

    return { id: resolved.asset.id }
}

const mapAssetStorage = (asset: AssetRow | null) => {
    const connection = asset?.visual_note_s3_connections
    if (!asset || !connection) return null

    return {
        asset: {
            id: asset.id,
            notebookId: asset.notebook_id,
            bucketName: asset.bucket_name,
            objectKey: asset.object_key,
            contentType: asset.content_type,
            fileName: asset.file_name,
            byteSize: asset.byte_size,
        },
        connection: {
            endpointUrl: connection.endpoint_url,
            region: connection.region,
            forcePathStyle: connection.force_path_style,
            accessKeyId: connection.access_key_id,
            secretAccessKey: decryptStorageSecret(connection.encrypted_secret_access_key),
        },
    }
}

const loadExistingEncryptedSecret = async (supabase: SupabaseClient, userId: string, connectionId: string) => {
    const { data, error } = await supabase.from("visual_note_s3_connections").select("user_id,encrypted_secret_access_key").eq("id", connectionId).maybeSingle()
    if (error) throw error

    const connection = data as Pick<S3ConnectionRow, "user_id" | "encrypted_secret_access_key"> | null
    if (!connection || connection.user_id !== userId) throw new Error("Storage connection not found.")

    return connection.encrypted_secret_access_key
}
