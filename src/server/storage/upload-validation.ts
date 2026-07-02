const maxImageUploadBytes = 500 * 1024 * 1024
const maxMultipartOverheadBytes = 1024 * 1024
const maxImageUploadRequestBytes = maxImageUploadBytes + maxMultipartOverheadBytes

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"])

type UploadValidationError = {
    message: string
    status: 400 | 413 | 415
}

const error = (message: string, status: UploadValidationError["status"]): UploadValidationError => ({ message, status })

const startsWith = (body: Buffer, signature: number[]) => signature.every((byte, index) => body[index] === byte)

const isValidPng = (body: Buffer) => startsWith(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const isValidJpeg = (body: Buffer) => startsWith(body, [0xff, 0xd8, 0xff])

const isValidGif = (body: Buffer) => startsWith(body, [0x47, 0x49, 0x46, 0x38])

const isValidWebp = (body: Buffer) => body.length >= 12 && body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP"

const isValidAvif = (body: Buffer) => body.length >= 12 && body.subarray(4, 8).toString("ascii") === "ftyp" && body.subarray(8, 12).toString("ascii").includes("avif")

export const validateUploadContentLength = (request: Request): UploadValidationError | null => {
    const contentLength = request.headers.get("content-length")
    if (!contentLength) return error("Image uploads require a Content-Length header.", 400)

    const parsedLength = Number(contentLength)
    if (!Number.isFinite(parsedLength) || parsedLength < 0) return error("Image uploads require a valid Content-Length header.", 400)
    if (parsedLength > maxImageUploadRequestBytes) return error("Images must be 500 MB or smaller.", 413)

    return null
}

export const validateImageUpload = (file: File, body: Buffer): UploadValidationError | null => {
    if (!allowedImageTypes.has(file.type)) return error("Only PNG, JPEG, WebP, GIF, and AVIF image uploads are supported.", 415)
    if (file.size > maxImageUploadBytes || body.byteLength > maxImageUploadBytes) return error("Images must be 500 MB or smaller.", 413)
    if (file.size !== body.byteLength) return error("Image upload size did not match the decoded request body.", 400)

    const signatureMatches =
        (file.type === "image/png" && isValidPng(body)) ||
        (file.type === "image/jpeg" && isValidJpeg(body)) ||
        (file.type === "image/webp" && isValidWebp(body)) ||
        (file.type === "image/gif" && isValidGif(body)) ||
        (file.type === "image/avif" && isValidAvif(body))

    if (!signatureMatches) return error("Image content does not match its declared file type.", 415)

    return null
}
