import assert from "node:assert/strict"
import test from "node:test"
import { createSignedAssetUrl, verifySignedAssetRequest } from "./asset-signing"

test("verifies unexpired signed asset URLs", () => {
    const expiresAt = new Date("2026-07-03T12:05:00.000Z").getTime()
    const url = createSignedAssetUrl("asset-1", expiresAt, "test-secret")
    const request = new Request(`https://visual-note.test${url}`)

    assert.equal(verifySignedAssetRequest(request, "asset-1", new Date("2026-07-03T12:00:00.000Z").getTime(), "test-secret"), true)
})

test("rejects expired or tampered signed asset URLs", () => {
    const expiresAt = new Date("2026-07-03T12:05:00.000Z").getTime()
    const url = createSignedAssetUrl("asset-1", expiresAt, "test-secret")

    assert.equal(verifySignedAssetRequest(new Request(`https://visual-note.test${url}`), "asset-1", new Date("2026-07-03T12:06:00.000Z").getTime(), "test-secret"), false)
    assert.equal(
        verifySignedAssetRequest(
            new Request(`https://visual-note.test${url.replace("asset-1", "asset-2")}`),
            "asset-2",
            new Date("2026-07-03T12:00:00.000Z").getTime(),
            "test-secret",
        ),
        false,
    )
})
