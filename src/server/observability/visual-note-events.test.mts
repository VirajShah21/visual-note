import assert from "node:assert/strict"
import test from "node:test"
import { recordVisualNoteEvent } from "./visual-note-events"

test("writes structured Visual Note event payloads", () => {
    const previousInfo = console.info
    let payload = ""
    console.info = (value?: unknown) => {
        payload = String(value)
    }

    try {
        recordVisualNoteEvent({
            event: "workspace.save_conflict",
            metadata: { revision: "r-1" },
            userId: "user-1",
        })
    } finally {
        console.info = previousInfo
    }

    const parsed = JSON.parse(payload) as { event: string; metadata: { revision: string }; severity: string; userId: string }
    assert.equal(parsed.event, "workspace.save_conflict")
    assert.equal(parsed.metadata.revision, "r-1")
    assert.equal(parsed.severity, "info")
    assert.equal(parsed.userId, "user-1")
})
