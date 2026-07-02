import { Readable } from "stream"
import { authenticateSupabaseRequest, getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { loadAssetStorage } from "@/server/storage/notebook-storage"
import { deleteS3Object, readS3Object } from "@/server/storage/s3"

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

        const object = await readS3Object({
            bucketName: resolved.asset.bucketName,
            connection: resolved.connection,
            objectKey: resolved.asset.objectKey,
        })
        if (!object.body) return Response.json({ error: "Asset body not found." }, { status: 404 })

        const headers = new Headers({
            "Cache-Control": "private, max-age=300",
            "Content-Type": object.contentType ?? resolved.asset.contentType,
        })
        if (object.contentLength != null) headers.set("Content-Length", String(object.contentLength))

        return new Response(Readable.toWeb(object.body) as ReadableStream, { headers })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to read asset." }, { status: 500 })
    }
}

export async function DELETE(request: Request, context: RouteContext<"/api/assets/[assetId]">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { assetId } = await context.params
    const storageSupabase = getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })

    const resolved = await loadAssetStorage(storageSupabase, auth.userId, assetId)
    if (!resolved) return Response.json({ error: "Asset not found." }, { status: 404 })

    const { data, error: deleteError } = await storageSupabase.from("visual_note_assets").delete().eq("id", assetId).eq("user_id", auth.userId).select("id").maybeSingle()

    if (deleteError) return Response.json({ error: deleteError.message ?? "Unable to delete asset." }, { status: 500 })
    if (!data) return Response.json({ error: "Asset not found." }, { status: 404 })

    await deleteS3Object({
        bucketName: resolved.asset.bucketName,
        connection: resolved.connection,
        objectKey: resolved.asset.objectKey,
    }).catch(() => {})

    return Response.json({ ok: true })
}
