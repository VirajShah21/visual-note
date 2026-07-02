import { Readable } from "stream"
import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest, getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { loadAssetStorage } from "@/server/storage/notebook-storage"
import { deleteS3Object, readS3Object } from "@/server/storage/s3"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"
import { isAllowedImageContentType } from "@/server/storage/upload-validation"

export const runtime = "nodejs"

export async function GET(request: Request, context: RouteContext<"/api/assets/[assetId]">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { assetId } = await context.params
    const storageSupabase = getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })

    try {
        const resolved = await loadAssetStorage(storageSupabase, auth.userId, assetId)
        if (!resolved) return Response.json({ error: "Asset not found." }, { status: 404 })
        if (!isAllowedImageContentType(resolved.asset.contentType)) return Response.json({ error: "Asset type is not supported for private delivery." }, { status: 415 })

        const object = await readS3Object({
            bucketName: resolved.asset.bucketName,
            connection: resolved.connection,
            objectKey: resolved.asset.objectKey,
        })
        if (!object.body) return Response.json({ error: "Asset body not found." }, { status: 404 })
        const contentType = object.contentType ?? resolved.asset.contentType
        if (!isAllowedImageContentType(contentType)) return Response.json({ error: "Stored asset type is not supported for private delivery." }, { status: 415 })

        const headers = new Headers({
            "Cache-Control": "private, max-age=300, no-transform",
            "Content-Disposition": `inline; filename="${encodeURIComponent(resolved.asset.fileName)}"`,
            "Content-Type": contentType,
            "Referrer-Policy": "same-origin",
            "X-Content-Type-Options": "nosniff",
        })
        if (object.contentLength != null) headers.set("Content-Length", String(object.contentLength))

        return new Response(Readable.toWeb(object.body) as ReadableStream, { headers })
    } catch (error) {
        recordVisualNoteEvent({ event: "asset.read_failed", severity: "error", userId: auth.userId, metadata: { assetId }, error })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to read asset." }, { status: 500 })
    }
}

export async function DELETE(request: Request, context: RouteContext<"/api/assets/[assetId]">) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { assetId } = await context.params
    const storageSupabase = getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })

    const resolved = await loadAssetStorage(storageSupabase, auth.userId, assetId)
    if (!resolved) return Response.json({ error: "Asset not found." }, { status: 404 })

    const { data, error: deleteError } = await storageSupabase.from("visual_note_assets").delete().eq("id", assetId).eq("user_id", auth.userId).select("id").maybeSingle()

    if (deleteError) {
        recordVisualNoteEvent({ event: "asset.delete_record_failed", severity: "error", userId: auth.userId, metadata: { assetId }, error: deleteError })
        return Response.json({ error: deleteError.message ?? "Unable to delete asset." }, { status: 500 })
    }
    if (!data) return Response.json({ error: "Asset not found." }, { status: 404 })

    await deleteS3Object({
        bucketName: resolved.asset.bucketName,
        connection: resolved.connection,
        objectKey: resolved.asset.objectKey,
    }).catch(error =>
        recordVisualNoteEvent({ event: "asset.delete_object_failed", severity: "warn", userId: auth.userId, metadata: { assetId, objectKey: resolved.asset.objectKey }, error }),
    )

    return Response.json({ ok: true })
}
