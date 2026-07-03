import assert from "node:assert/strict"
import test from "node:test"
import { recordVisualNoteEvent, resetVisualNoteMetrics, snapshotVisualNoteMetrics } from "./visual-note-events"

test("writes structured Visual Note event payloads", () => {
    resetVisualNoteMetrics()
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

test("tracks metrics by event and severity", () => {
    resetVisualNoteMetrics()
    recordVisualNoteEvent({ event: "workspace.save_success", severity: "info" })
    recordVisualNoteEvent({ event: "workspace.save_success", severity: "info", userId: "user-1" })
    recordVisualNoteEvent({ event: "workspace.save_failed", severity: "error" })

    const snapshot = snapshotVisualNoteMetrics()
    assert.equal(snapshot.totalEvents, 3)
    assert.equal(snapshot.byEvent["workspace.save_success"], 2)
    assert.equal(snapshot.byEvent["workspace.save_failed"], 1)
    assert.equal(snapshot.bySeverity.info, 2)
    assert.equal(snapshot.bySeverity.error, 1)
    assert.equal(snapshot.bySeverity.warn, 0)
})
