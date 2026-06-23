import type { SupabaseClient } from "@supabase/supabase-js"
import { loadPageById, makePageObjectKey } from "@/server/visual-note/page-store"
import { readS3Object, uploadS3Object } from "@/server/storage/s3"
import { resolveNotebookStorage } from "@/server/storage/notebook-storage"

const streamToText = async (stream: NodeJS.ReadableStream): Promise<string> => {
    const chunks: Uint8Array[] = []
    for await (const chunk of stream) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk))
    }

    return Buffer.concat(chunks).toString("utf8")
}

type AuthContext = {
    supabase: SupabaseClient
    userId: string
}

export const readPageMarkdown = async (context: AuthContext, pageId: string): Promise<string | null> => {
    try {
        const page = await loadPageById(context.supabase, context.userId, pageId)
        if (!page) return null

        const notebookStorage = await resolveNotebookStorage(context.supabase, context.userId, page.notebook_id)
        if (!notebookStorage) return null

        const result = await readS3Object({
            connection: notebookStorage.connection,
            bucketName: notebookStorage.bucketName,
            objectKey: page.content_object_key,
        })
        if (!result.body) return null

        return await streamToText(result.body)
    } catch {
        return null
    }
}

export const savePageMarkdown = async (
    context: AuthContext,
    page: { notebookId: string; id: string },
    content: string,
    objectKeyOverride?: string,
) => {
    const notebookStorage = await resolveNotebookStorage(context.supabase, context.userId, page.notebookId)
    if (!notebookStorage) throw new Error("Configure notebook storage before saving page content to MinIO.")

    const objectKey = objectKeyOverride ?? makePageObjectKey(page.notebookId, page.id)
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

    return objectKey
}
