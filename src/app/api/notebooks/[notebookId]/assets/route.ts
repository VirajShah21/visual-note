import { authenticateSupabaseMutationRequest, getSupabaseServiceRoleClient, userOwnsNotebook } from "@/lib/supabase/server"
import { createAssetObjectKey, createAssetRecord, resolveNotebookStorage } from "@/server/storage/notebook-storage"
import { deleteS3Object, uploadS3Object } from "@/server/storage/s3"
import { validateImageUpload } from "@/server/storage/upload-validation"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"
import { parseAssetUploadRequest } from "./route-contract"

export const runtime = "nodejs"

type Authenticated = { supabase: Parameters<typeof resolveNotebookStorage>[0]; userId: string }

export type AssetUploadRouteDependencies = {
    createAssetObjectKey: typeof createAssetObjectKey
    createAssetRecord: typeof createAssetRecord
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    deleteS3Object: typeof deleteS3Object
    parseAssetUploadRequest: typeof parseAssetUploadRequest
    recordVisualNoteEvent: typeof recordVisualNoteEvent
    resolveNotebookStorage: typeof resolveNotebookStorage
    userOwnsNotebook: typeof userOwnsNotebook
    uploadS3Object: typeof uploadS3Object
    validateImageUpload: typeof validateImageUpload
}

const defaultAssetUploadRouteDependencies: AssetUploadRouteDependencies = {
    createAssetObjectKey,
    createAssetRecord,
    getSupabaseServiceRoleClient,
    deleteS3Object,
    parseAssetUploadRequest,
    recordVisualNoteEvent,
    resolveNotebookStorage,
    userOwnsNotebook,
    uploadS3Object,
    validateImageUpload,
}

export const runAssetsPost = async (auth: Authenticated, request: Request, notebookId: string, dependencies = defaultAssetUploadRouteDependencies) => {
    if (!(await dependencies.userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })
    const storageSupabase = dependencies.getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })
    const parsedAsset = await dependencies.parseAssetUploadRequest(request)
    if (!parsedAsset.ok) {
        dependencies.recordVisualNoteEvent({
            event: "asset.upload_rejected",
            severity: "warn",
            userId: auth.userId,
            metadata: { notebookId, reason: parsedAsset.error },
        })
        return Response.json({ error: parsedAsset.error }, { status: parsedAsset.status })
    }

    const { file } = parsedAsset

    try {
        const storage = await dependencies.resolveNotebookStorage(storageSupabase, auth.userId, notebookId)
        if (!storage) return Response.json({ error: "Configure notebook storage before uploading images." }, { status: 400 })

        const body = Buffer.from(await file.arrayBuffer())
        const uploadError = dependencies.validateImageUpload(file, body)
        if (uploadError) {
            dependencies.recordVisualNoteEvent({
                event: "asset.upload_rejected",
                severity: "warn",
                userId: auth.userId,
                metadata: { contentType: file.type, notebookId, reason: uploadError.message },
            })
            return Response.json({ error: uploadError.message }, { status: uploadError.status })
        }

        const objectKey = dependencies.createAssetObjectKey(notebookId, file.name)
        await dependencies.uploadS3Object({
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

        try {
            const asset = await dependencies.createAssetRecord(storageSupabase, storage, {
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
            await dependencies
                .deleteS3Object({
                    connection: storage.connection,
                    bucketName: storage.bucketName,
                    objectKey,
                })
                .catch(() => {})
            throw error
        }
    } catch (error) {
        dependencies.recordVisualNoteEvent({ event: "asset.upload_failed", severity: "error", userId: auth.userId, metadata: { notebookId }, error })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to upload image." }, { status: 500 })
    }
}

export async function POST(request: Request, context: RouteContext<"/api/notebooks/[notebookId]/assets">) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    return runAssetsPost(auth, request, notebookId)
}
