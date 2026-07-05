import assert from "node:assert/strict"
import test from "node:test"
import { parsePublishRequest } from "./route-contract"

const publishRequest = (body: unknown) =>
    new Request("http://visual-note.test/api/notebooks/notebook-1/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
    })

test("accepts a valid preview publish request", async () => {
    const parsed = await parsePublishRequest(publishRequest({ action: "preview", includeHtml: true, includeJson: false }))

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.input.action, "preview")
    assert.equal(parsed.input.includeHtml, true)
    assert.equal(parsed.input.includeJson, false)
})

test("requires revision for publish action", async () => {
    const parsed = await parsePublishRequest(publishRequest({ action: "publish", includeHtml: true }))

    assert.equal(parsed.ok, false)
    if (parsed.ok) return
    assert.equal(parsed.status, 400)
    assert.equal(parsed.error, "revision is required for publish and unpublish actions.")
})

test("rejects invalid action values", async () => {
    const parsed = await parsePublishRequest(publishRequest({ action: "archive" }))

    assert.equal(parsed.ok, false)
    if (parsed.ok) return
    assert.equal(parsed.status, 400)
    assert.equal(parsed.error, "action must be preview, publish, or unpublish.")
})
