import { authenticateSupabaseMutationRequest, getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { createSignedAssetUrl } from "@/server/storage/asset-signing"
import { loadAssetStorage } from "@/server/storage/notebook-storage"

export const runtime = "nodejs"

export type AssetSignRouteDependencies = {
    authenticateSupabaseMutationRequest: typeof authenticateSupabaseMutationRequest
    createSignedAssetUrl: typeof createSignedAssetUrl
    getSupabaseServiceRoleClient: typeof getSupabaseServiceRoleClient
    loadAssetStorage: typeof loadAssetStorage
}

const defaultAssetSignRouteDependencies: AssetSignRouteDependencies = {
    authenticateSupabaseMutationRequest,
    createSignedAssetUrl,
    getSupabaseServiceRoleClient,
    loadAssetStorage,
}

const buildExpiry = (expiresParam: string | null) => {
    const parsed = Number(expiresParam)
    if (!Number.isFinite(parsed) || parsed <= 0) return 300

    return Math.max(60, Math.min(3600, Math.trunc(parsed)))
}

export const runAssetSignGet = async (
    request: Request,
    context: RouteContext<"/api/assets/[assetId]/sign">,
    dependencies = defaultAssetSignRouteDependencies,
) => {
    const auth = await dependencies.authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const userId = auth.userId

    const { assetId } = await context.params
    const storageSupabase = dependencies.getSupabaseServiceRoleClient()
    if (!storageSupabase) return Response.json({ error: "Server database access is not configured for storage routes." }, { status: 503 })

    const storage = await dependencies.loadAssetStorage(storageSupabase, userId, assetId)
    if (!storage) return Response.json({ error: "Asset not found." }, { status: 404 })

    const requestedTtl = buildExpiry(new URL(request.url).searchParams.get("ttlSeconds"))
    const expiresAt = Date.now() + requestedTtl * 1000
    const signedUrl = dependencies.createSignedAssetUrl(assetId, expiresAt)
    if (!signedUrl) return Response.json({ error: "Asset signing is not configured." }, { status: 503 })

    return Response.json({
        url: signedUrl,
        expiresAt: new Date(expiresAt).toISOString(),
        ttlSeconds: requestedTtl,
    })
}

export async function GET(request: Request, context: RouteContext<"/api/assets/[assetId]/sign">) {
    return runAssetSignGet(request, context)
}
