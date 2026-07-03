import { Readable } from "stream"
import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest, getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { loadAssetStorage, loadSignedAssetStorage } from "@/server/storage/notebook-storage"
import { verifySignedAssetRequest } from "@/server/storage/asset-signing"
import { deleteS3Object, readS3Object } from "@/server/storage/s3"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"
import { isAllowedImageContentType } from "@/server/storage/upload-validation"

export const runtime = "nodejs"

type Authenticated = { supabase: never; userId: string } | null

export type AssetRouteDependencies = {
    authenticateSupabaseMutationRequest: typeof authenticateSupabaseMutationRequest
    authenticateSupabaseRequest: typeof authenticateSupabaseRequest
    deleteS3Object: typeof deleteS3Object
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    isAssetRequestAllowedByOrigin: typeof isAssetRequestAllowedByOrigin
    isAllowedImageContentType: typeof isAllowedImageContentType
    loadAssetStorage: typeof loadAssetStorage
    loadSignedAssetStorage: typeof loadSignedAssetStorage
    readS3Object: typeof readS3Object
    recordVisualNoteEvent: (event: Parameters<typeof recordVisualNoteEvent>[0]) => void
    verifySignedAssetRequest: typeof verifySignedAssetRequest
}

export const isAssetRequestAllowedByOrigin = (request: Request, isSignedRequest: boolean) => {
    if (isSignedRequest) return true

    const requestOrigin = new URL(request.url).origin
    const secFetchSite = request.headers.get("sec-fetch-site")
    if (secFetchSite && secFetchSite.toLowerCase() === "cross-site") return false

    const origin = request.headers.get("origin")
    if (origin && origin !== requestOrigin) return false

    const referer = request.headers.get("referer")
    if (!referer) return true
    try {
        return new URL(referer, request.url).origin === requestOrigin
    } catch {
        return false
    }
}

const defaultAssetRouteDependencies: AssetRouteDependencies = {
    authenticateSupabaseMutationRequest,
    authenticateSupabaseRequest,
    deleteS3Object,
    getSupabaseServiceRoleClient,
    isAssetRequestAllowedByOrigin,
    isAllowedImageContentType,
    loadAssetStorage,
    loadSignedAssetStorage,
    readS3Object,
    recordVisualNoteEvent,
    verifySignedAssetRequest,
}

export const runAssetGet = async (request: Request, context: RouteContext<"/api/assets/[assetId]">, dependencies = defaultAssetRouteDependencies) => {
    const { assetId } = await context.params
    const isSigned = dependencies.verifySignedAssetRequest(request, assetId)
    const auth: Authenticated = isSigned ? null : await dependencies.authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth
    if (!dependencies.isAssetRequestAllowedByOrigin(request, isSigned)) {
        dependencies.recordVisualNoteEvent({
            event: "asset.read_blocked",
            severity: "warn",
            userId: auth?.userId,
            metadata: { assetId, reason: "cross-site-request", signed: false },
        })
        return Response.json({ error: "Asset request blocked due to cross-site access." }, { status: 403 })
    }

    const storageSupabase = dependencies.getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })

    try {
        const userId = auth instanceof Response || auth === null ? "" : auth.userId
        const resolved = isSigned ? await dependencies.loadSignedAssetStorage(storageSupabase, assetId) : await dependencies.loadAssetStorage(storageSupabase, userId, assetId)
        if (!resolved) return Response.json({ error: "Asset not found." }, { status: 404 })
        if (!dependencies.isAllowedImageContentType(resolved.asset.contentType))
            return Response.json({ error: "Asset type is not supported for private delivery." }, { status: 415 })

        const object = await dependencies.readS3Object({
            bucketName: resolved.asset.bucketName,
            connection: resolved.connection,
            objectKey: resolved.asset.objectKey,
        })
        if (!object.body) return Response.json({ error: "Asset body not found." }, { status: 404 })
        const contentType = object.contentType ?? resolved.asset.contentType
        if (!dependencies.isAllowedImageContentType(contentType)) return Response.json({ error: "Stored asset type is not supported for private delivery." }, { status: 415 })

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
        dependencies.recordVisualNoteEvent({
            event: "asset.read_failed",
            severity: "error",
            userId: auth?.userId,
            metadata: { assetId, signed: isSigned },
            error,
        })
        return Response.json({ error: error instanceof Error ? error.message : "Unable to read asset." }, { status: 500 })
    }
}

export const runAssetDelete = async (request: Request, context: RouteContext<"/api/assets/[assetId]">, dependencies = defaultAssetRouteDependencies) => {
    const auth = await dependencies.authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { assetId } = await context.params
    const storageSupabase = dependencies.getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })

    const resolved = await dependencies.loadAssetStorage(storageSupabase, auth.userId, assetId)
    if (!resolved) return Response.json({ error: "Asset not found." }, { status: 404 })

    const { data, error: deleteError } = await storageSupabase.from("visual_note_assets").delete().eq("id", assetId).eq("user_id", auth.userId).select("id").maybeSingle()

    if (deleteError) {
        dependencies.recordVisualNoteEvent({ event: "asset.delete_record_failed", severity: "error", userId: auth.userId, metadata: { assetId }, error: deleteError })
        return Response.json({ error: deleteError.message ?? "Unable to delete asset." }, { status: 500 })
    }
    if (!data) return Response.json({ error: "Asset not found." }, { status: 404 })

    await dependencies.deleteS3Object({
        bucketName: resolved.asset.bucketName,
        connection: resolved.connection,
        objectKey: resolved.asset.objectKey,
    }).catch(error =>
        dependencies.recordVisualNoteEvent({
            event: "asset.delete_object_failed",
            severity: "warn",
            userId: auth.userId,
            metadata: { assetId, objectKey: resolved.asset.objectKey },
            error,
        }),
    )

    return Response.json({ ok: true })
}

export async function GET(request: Request, context: RouteContext<"/api/assets/[assetId]">) {
    return runAssetGet(request, context)
}

export async function DELETE(request: Request, context: RouteContext<"/api/assets/[assetId]">) {
    return runAssetDelete(request, context)
}
