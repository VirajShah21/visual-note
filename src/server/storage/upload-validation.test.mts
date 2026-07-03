import assert from "node:assert/strict"
import test from "node:test"
import { isAllowedImageContentType, validateImageUpload, validateUploadContentLength } from "./upload-validation"

const fileFrom = (body: Buffer, type: string) => new File([new Uint8Array(body)], "image", { type })

test("accepts supported image uploads with matching file signatures", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    assert.equal(validateImageUpload(fileFrom(png, "image/png"), png), null)
})

test("rejects unsupported image MIME types", () => {
    const svg = Buffer.from("<svg></svg>")
    const result = validateImageUpload(fileFrom(svg, "image/svg+xml"), svg)

    assert.equal(result?.status, 415)
})

test("rejects spoofed image content", () => {
    const text = Buffer.from("not a png")
    const result = validateImageUpload(fileFrom(text, "image/png"), text)

    assert.equal(result?.status, 415)
    assert.match(result?.message ?? "", /does not match/)
})

test("requires upload content length", () => {
    const result = validateUploadContentLength(new Request("http://localhost/upload"))

    assert.equal(result?.status, 400)
})

test("shares the supported private image delivery allowlist", () => {
    assert.equal(isAllowedImageContentType("image/webp"), true)
    assert.equal(isAllowedImageContentType("image/svg+xml"), false)
})
