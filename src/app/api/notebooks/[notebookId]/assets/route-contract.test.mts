import assert from "node:assert/strict"
import test from "node:test"
import { parseAssetUploadRequest } from "./route-contract"

const makeFile = (filename = "image.png", type = "image/png") => new File([new Uint8Array([1, 2, 3])], filename, { type })

const assetUploadRequest = (formData: FormData, contentLength = "12") =>
    new Request("http://visual-note.test/api/notebooks/notebook-1/assets", {
        method: "POST",
        body: formData,
        headers: { "content-length": contentLength },
    })

test("rejects malformed multipart request bodies", async () => {
    const parsed = await parseAssetUploadRequest(
        new Request("http://visual-note.test/api/notebooks/notebook-1/assets", {
            method: "POST",
            body: "not-a-form-body",
            headers: { "content-length": "16" },
        }),
    )

    assert.deepEqual(parsed, { ok: false, error: "Invalid asset upload payload.", status: 400 })
})

test("rejects asset upload when no file is present", async () => {
    const formData = new FormData()
    formData.set("caption", "missing-file")
    const parsed = await parseAssetUploadRequest(assetUploadRequest(formData, "40"))

    assert.deepEqual(parsed, { ok: false, error: "Image file is required.", status: 400 })
})

test("rejects non-file form values for file field", async () => {
    const formData = new FormData()
    formData.set("file", "not-a-file")
    const parsed = await parseAssetUploadRequest(assetUploadRequest(formData, "45"))

    assert.deepEqual(parsed, { ok: false, error: "Image file is required.", status: 400 })
})

test("accepts valid file uploads", async () => {
    const formData = new FormData()
    formData.set("file", makeFile())
    const parsed = await parseAssetUploadRequest(assetUploadRequest(formData, "42"))

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.file.name, "image.png")
    assert.equal(parsed.file.type, "image/png")
})

test("reports missing content-length", async () => {
    const formData = new FormData()
    formData.set("file", makeFile())
    const request = new Request("http://visual-note.test/api/notebooks/notebook-1/assets", {
        method: "POST",
        body: formData,
    })
    const parsed = await parseAssetUploadRequest(request)

    assert.deepEqual(parsed, { ok: false, error: "Image uploads require a Content-Length header.", status: 400 })
})
