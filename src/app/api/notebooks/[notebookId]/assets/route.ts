import { authenticateSupabaseRequest, getSupabaseServiceRoleClient, userOwnsNotebook } from "@/lib/supabase/server"
import { createAssetObjectKey, createAssetRecord, resolveNotebookStorage } from "@/server/storage/notebook-storage"
import { uploadS3Object } from "@/server/storage/s3"

export const runtime = "nodejs"

const maxImageUploadBytes = 500 * 1024 * 1024
const maxMultipartOverheadBytes = 1024 * 1024
const maxImageUploadRequestBytes = maxImageUploadBytes + maxMultipartOverheadBytes

const validateUploadContentLength = (request: Request) => {
    const contentLength = request.headers.get("content-length")
    if (!contentLength) return "Image uploads require a Content-Length header."

    const parsedLength = Number(contentLength)
    if (!Number.isFinite(parsedLength) || parsedLength < 0) return "Image uploads require a valid Content-Length header."
    if (parsedLength > maxImageUploadRequestBytes) return "Images must be 500 MB or smaller."

    return null
}

export async function POST(request: Request, context: RouteContext<"/api/notebooks/[notebookId]/assets">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    if (!(await userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })
    const storageSupabase = getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })
    const contentLengthError = validateUploadContentLength(request)
    if (contentLengthError) return Response.json({ error: contentLengthError }, { status: contentLengthError.includes("500 MB") ? 413 : 400 })

    try {
        const formData = await request.formData()
        const file = formData.get("file")
        if (!(file instanceof File)) return Response.json({ error: "Image file is required." }, { status: 400 })
        if (!file.type.startsWith("image/")) return Response.json({ error: "Only image uploads are supported." }, { status: 400 })
        if (file.size > maxImageUploadBytes) return Response.json({ error: "Images must be 500 MB or smaller." }, { status: 413 })

        const storage = await resolveNotebookStorage(storageSupabase, auth.userId, notebookId)
        if (!storage) return Response.json({ error: "Configure notebook storage before uploading images." }, { status: 400 })

        const body = Buffer.from(await file.arrayBuffer())
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
