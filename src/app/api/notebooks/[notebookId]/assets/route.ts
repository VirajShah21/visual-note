import { authenticateSupabaseRequest, getSupabaseServiceRoleClient, userOwnsNotebook } from "@/lib/supabase/server"
import { createAssetObjectKey, createAssetRecord, resolveNotebookStorage } from "@/server/storage/notebook-storage"
import { uploadS3Object } from "@/server/storage/s3"
import { validateImageUpload, validateUploadContentLength } from "@/server/storage/upload-validation"

export const runtime = "nodejs"

export async function POST(request: Request, context: RouteContext<"/api/notebooks/[notebookId]/assets">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    if (!(await userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })
    const storageSupabase = getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })
    const contentLengthError = validateUploadContentLength(request)
    if (contentLengthError) return Response.json({ error: contentLengthError.message }, { status: contentLengthError.status })

    try {
        const formData = await request.formData()
        const file = formData.get("file")
        if (!(file instanceof File)) return Response.json({ error: "Image file is required." }, { status: 400 })

        const storage = await resolveNotebookStorage(storageSupabase, auth.userId, notebookId)
        if (!storage) return Response.json({ error: "Configure notebook storage before uploading images." }, { status: 400 })

        const body = Buffer.from(await file.arrayBuffer())
        const uploadError = validateImageUpload(file, body)
        if (uploadError) return Response.json({ error: uploadError.message }, { status: uploadError.status })

        const objectKey = createAssetObjectKey(notebookId, file.name)
        await uploadS3Object({
            body,
            bucketName: storage.bucketName,
            connection: storage.connection,
            contentType: file.type,
            objectKey,
            metadata: {
                notebookid: notebookId,
                filename: file.name,
            },
        })

        const asset = await createAssetRecord(storageSupabase, storage, {
            name: file.name,
            contentType: file.type,
            byteSize: body.byteLength,
            objectKey,
        })

        return Response.json({
            asset: {
                id: asset.id,
                url: `/api/assets/${asset.id}`,
                fileName: asset.fileName,
                contentType: asset.contentType,
                byteSize: asset.byteSize,
            },
        })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to upload image." }, { status: 500 })
    }
}
