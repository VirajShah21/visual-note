import { createHmac, timingSafeEqual } from "crypto"

const signingSecret = () => process.env.VISUAL_NOTE_ASSET_SIGNING_SECRET ?? ""

const signaturePayload = (assetId: string, expiresAt: number) => `${assetId}.${expiresAt}`

const sign = (assetId: string, expiresAt: number, secret: string) => createHmac("sha256", secret).update(signaturePayload(assetId, expiresAt)).digest("hex")

export const createSignedAssetUrl = (assetId: string, expiresAt: number, secret = signingSecret()) => {
    if (!secret) return ""

    const signature = sign(assetId, expiresAt, secret)
    return `/api/assets/${encodeURIComponent(assetId)}?exp=${expiresAt}&sig=${signature}`
}

export const verifySignedAssetRequest = (request: Request, assetId: string, now = Date.now(), secret = signingSecret()) => {
    if (!secret) return false

    const url = new URL(request.url)
    const expiresAt = Number(url.searchParams.get("exp"))
    const signature = url.searchParams.get("sig") ?? ""
    if (!Number.isFinite(expiresAt) || expiresAt <= now || !signature) return false

    const expected = sign(assetId, expiresAt, secret)
    const actualBuffer = Buffer.from(signature, "hex")
    const expectedBuffer = Buffer.from(expected, "hex")
    if (actualBuffer.byteLength !== expectedBuffer.byteLength) return false

    return timingSafeEqual(actualBuffer, expectedBuffer)
}
