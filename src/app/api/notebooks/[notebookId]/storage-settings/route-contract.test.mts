import assert from "node:assert/strict"
import test from "node:test"
import { validateStorageSettingsInput, parseStorageSettingsRequest } from "./route-contract"

const baseInput = {
    connectionName: "MinIO connection",
    region: "us-east-1",
    accessKeyId: "AKIA123",
    secretAccessKey: "secret",
    bucketName: "notebook-bucket",
    endpointUrl: "",
    forcePathStyle: false,
}

const settingsRequest = (body: unknown) =>
    new Request("http://visual-note.test/api/notebooks/notebook-1/storage-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
    })

test("validates required storage settings fields", () => {
    assert.equal(validateStorageSettingsInput(baseInput), null)
    assert.equal(validateStorageSettingsInput({ ...baseInput, connectionName: "   " }), "Connection name is required.")
    assert.equal(validateStorageSettingsInput({ ...baseInput, region: "" }), "Region is required.")
    assert.equal(validateStorageSettingsInput({ ...baseInput, accessKeyId: "" }), "Access key ID is required.")
    assert.equal(validateStorageSettingsInput({ ...baseInput, connectionId: "connection-1", secretAccessKey: "" }), null)
    assert.equal(validateStorageSettingsInput({ ...baseInput, bucketName: "" }), "Bucket name is required.")
})

test("rejects non-object storage settings payload", async () => {
    const parsed = await parseStorageSettingsRequest(settingsRequest("{"))

    assert.deepEqual(parsed, { ok: false, error: "Invalid storage settings payload.", status: 400 })
})

test("accepts valid storage settings payload", async () => {
    const parsed = await parseStorageSettingsRequest(settingsRequest(baseInput))

    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.input.bucketName, "notebook-bucket")
})
