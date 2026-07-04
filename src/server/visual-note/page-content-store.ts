import type { SupabaseClient } from "@supabase/supabase-js"
import { loadPageById, makePageObjectKey } from "@/server/visual-note/page-store"
import { deleteS3Object, readS3Object, uploadS3Object } from "@/server/storage/s3"
import { resolveNotebookStorage } from "@/server/storage/notebook-storage"
import { STORAGE_CONTENT_WARNING } from "@/lib/visual-note/storage-messages"

const streamToText = async (stream: NodeJS.ReadableStream): Promise<string> => {
    const chunks: Uint8Array[] = []
    for await (const chunk of stream) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk))

    return Buffer.concat(chunks).toString("utf8")
}

type AuthContext = {
    supabase: SupabaseClient
    userId: string
}

const isMissingObjectError = (error: unknown) => {
    if (!(error instanceof Error)) return false

    const details = error as Error & { name?: string; Code?: string; code?: string; $metadata?: { httpStatusCode?: number } }
    return details.name === "NoSuchKey" || details.Code === "NoSuchKey" || details.code === "NoSuchKey" || details.$metadata?.httpStatusCode === 404
}

const isMissingStorageEncryptionKeyError = (error: unknown) => error instanceof Error && error.message.includes("VISUAL_NOTE_S3_ENCRYPTION_KEY")

export const readPageMarkdown = async (context: AuthContext, pageId: string): Promise<string | null> => {
    const page = await loadPageById(context.supabase, context.userId, pageId)
    if (!page) return null

    const notebookStorage = await resolveNotebookStorage(context.supabase, context.userId, page.notebook_id).catch(error => {
        if (isMissingStorageEncryptionKeyError(error)) return null
        throw error
    })
    if (!notebookStorage) return null

    const result = await readS3Object({
        connection: notebookStorage.connection,
        bucketName: notebookStorage.bucketName,
        objectKey: page.content_object_key,
    }).catch(error => {
        if (isMissingObjectError(error)) return null
        throw error
    })
    if (!result) return null
    if (!result.body) return null

    return await streamToText(result.body)
}

export const savePageMarkdown = async (context: AuthContext, page: { notebookId: string; id: string }, content: string, objectKeyOverride?: string) => {
    const result = await savePageMarkdownIfConfigured(context, page, content, objectKeyOverride)
    if (!result.saved) throw new Error(STORAGE_CONTENT_WARNING)

    return result.objectKey
}

export const savePageMarkdownIfConfigured = async (context: AuthContext, page: { notebookId: string; id: string }, content: string, objectKeyOverride?: string) => {
    const objectKey = objectKeyOverride ?? makePageObjectKey(page.notebookId, page.id)
    const notebookStorage = await resolveNotebookStorage(context.supabase, context.userId, page.notebookId).catch(error => {
        if (isMissingStorageEncryptionKeyError(error)) return null
        throw error
    })
    if (!notebookStorage) return { saved: false, objectKey }

    await uploadS3Object({
        body: Buffer.from(content, "utf8"),
        bucketName: notebookStorage.bucketName,
        connection: notebookStorage.connection,
        objectKey,
        contentType: "text/markdown; charset=utf-8",
        metadata: {
            notebookid: page.notebookId,
            pageid: page.id,
        },
    })

    return { saved: true, objectKey }
}

export const deletePageMarkdown = async (context: AuthContext, page: { notebookId: string; id: string }, objectKeyOverride?: string) => {
    const notebookStorage = await resolveNotebookStorage(context.supabase, context.userId, page.notebookId)
    if (!notebookStorage) throw new Error("Configure notebook storage before deleting page content from MinIO.")

    const objectKey = objectKeyOverride ?? makePageObjectKey(page.notebookId, page.id)
    await deleteS3Object({
        connection: notebookStorage.connection,
        bucketName: notebookStorage.bucketName,
        objectKey,
    })
}
