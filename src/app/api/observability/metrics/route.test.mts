import assert from "node:assert/strict"
import test from "node:test"
import { runObservabilityMetricsGet } from "./route"

type MetricsEvent = {
    event: string
    severity?: string
    metadata?: Record<string, unknown>
}

const readResponseBody = async (response: Response) => response.json()

type ObservabilityDependencies = Parameters<typeof runObservabilityMetricsGet>[1]

const runWithToken = (request: Request, events: MetricsEvent[], token = "maintenance-token") =>
    runObservabilityMetricsGet(request, {
        getMaintenanceToken: () => token,
        getSupabaseServiceRoleClient: () => ({}) as never,
        recordVisualNoteEvent: event => {
            events.push(event)
        },
        snapshotVisualNoteMetrics: () => ({
            generatedAt: "2026-07-03T00:00:00.000Z",
            totalEvents: 7,
            byEvent: { workspaceLoad: 5 },
            bySeverity: { info: 4, warn: 2, error: 1 },
        }),
    } as unknown as ObservabilityDependencies)

test("GET returns 503 when maintenance token is not configured", async () => {
    const response = await runObservabilityMetricsGet(new Request("http://visual-note.test/api/observability/metrics"), {
        getMaintenanceToken: () => undefined,
        getSupabaseServiceRoleClient: () => ({} as never),
        recordVisualNoteEvent: () => {},
        snapshotVisualNoteMetrics: () => ({
            generatedAt: "2026-07-03T00:00:00.000Z",
            totalEvents: 0,
            byEvent: {},
            bySeverity: { info: 0, warn: 0, error: 0 },
        }),
    } as unknown as ObservabilityDependencies)

    assert.equal(response.status, 503)
})

test("GET rejects missing maintenance token", async () => {
    const response = await runWithToken(new Request("http://visual-note.test/api/observability/metrics"), [{ event: "noop" }], "maintenance-token")
    // Token header omitted intentionally
    assert.equal(response.status, 401)
})

test("GET returns metrics snapshot with a valid maintenance token", async () => {
    const events: MetricsEvent[] = []
    const response = await runWithToken(
        new Request("http://visual-note.test/api/observability/metrics", {
            headers: { "x-maintenance-token": "maintenance-token" },
        }),
        events,
        "maintenance-token",
    )

    assert.equal(response.status, 200)
    const body = await readResponseBody(response)
    assert.equal(body.totalEvents, 7)
    assert.equal(body.bySeverity.info, 4)
    assert.equal(events.some(item => item.event === "observability.metrics_read"), true)
})
