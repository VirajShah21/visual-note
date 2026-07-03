import assert from "node:assert/strict"
import test from "node:test"
import { OPTIONS, runMcpHandler } from "./route"

type TestEvent = {
    event: string
    severity?: string
    metadata?: {
        status?: number
        method?: string
    }
}

test("POST requests log MCP auth failures", async () => {
    const events: TestEvent[] = []

    const response = await runMcpHandler(new Request("http://visual-note.test/api/mcp", { method: "POST" }), {
        logEvent: event => events.push(event),
        now: () => "2026-07-03T00:00:00.000Z",
    })

    assert.equal(response.status, 401)
    assert.equal(events.length, 1)
    assert.equal(events[0].event, "mcp.auth_failed")
    assert.equal(events[0].metadata?.status, 401)
    assert.equal(events[0].metadata?.method, "POST")
})

test("OPTIONS with blocked origin logs mcp.request_blocked", async () => {
    const events: TestEvent[] = []

    const response = await OPTIONS(new Request("http://visual-note.test/api/mcp", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), {
        logEvent: event => events.push(event),
        now: () => "2026-07-03T00:00:00.000Z",
    })

    assert.equal(response.status, 403)
    assert.equal(events.length, 1)
    assert.equal(events[0].event, "mcp.request_blocked")
    assert.equal(events[0].metadata?.status, 403)
    assert.equal(events[0].metadata?.method, "OPTIONS")
})
