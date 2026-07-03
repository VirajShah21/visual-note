type EventSeverity = "info" | "warn" | "error"

type VisualNoteEvent = {
    event: string
    severity?: EventSeverity
    userId?: string
    metadata?: Record<string, unknown>
    error?: unknown
}

type VisualNoteEventMetrics = {
    generatedAt: string
    totalEvents: number
    byEvent: Record<string, number>
    bySeverity: Record<EventSeverity, number>
}

type EventMetricState = {
    startedAt: string
    totalEvents: number
    byEvent: Map<string, number>
    bySeverity: Map<EventSeverity, number>
}

const eventMetricsState: EventMetricState = {
    startedAt: new Date().toISOString(),
    totalEvents: 0,
    byEvent: new Map(),
    bySeverity: new Map([
        ["info", 0],
        ["warn", 0],
        ["error", 0],
    ]),
}

const errorMetadata = (error: unknown) => {
    if (!(error instanceof Error)) return { message: String(error) }

    return {
        message: error.message,
        name: error.name,
        code: (error as { code?: unknown }).code,
    }
}

const incrementEventCount = (event: string) => {
    eventMetricsState.byEvent.set(event, (eventMetricsState.byEvent.get(event) ?? 0) + 1)
}

const incrementSeverityCount = (severity: EventSeverity) => {
    eventMetricsState.bySeverity.set(severity, (eventMetricsState.bySeverity.get(severity) ?? 0) + 1)
}

export const recordVisualNoteEvent = ({ event, severity = "info", userId, metadata = {}, error }: VisualNoteEvent) => {
    const normalizedSeverity = severity
    eventMetricsState.totalEvents += 1
    incrementEventCount(event)
    incrementSeverityCount(normalizedSeverity)

    const payload = {
        event,
        metadata,
        severity: normalizedSeverity,
        timestamp: new Date().toISOString(),
        userId,
        ...(error === undefined ? {} : { error: errorMetadata(error) }),
    }

    if (severity === "error") console.error(JSON.stringify(payload))
    else if (severity === "warn") console.warn(JSON.stringify(payload))
    else console.info(JSON.stringify(payload))
}

export const snapshotVisualNoteMetrics = (): VisualNoteEventMetrics => ({
    generatedAt: new Date().toISOString(),
    totalEvents: eventMetricsState.totalEvents,
    byEvent: [...eventMetricsState.byEvent].reduce(
        (acc, [event, count]) => {
            acc[event] = count
            return acc
        },
        {} as Record<string, number>,
    ),
    bySeverity: {
        info: eventMetricsState.bySeverity.get("info") ?? 0,
        warn: eventMetricsState.bySeverity.get("warn") ?? 0,
        error: eventMetricsState.bySeverity.get("error") ?? 0,
    },
})

export const resetVisualNoteMetrics = () => {
    eventMetricsState.totalEvents = 0
    eventMetricsState.startedAt = new Date().toISOString()
    eventMetricsState.byEvent.clear()
    eventMetricsState.bySeverity.set("info", 0)
    eventMetricsState.bySeverity.set("warn", 0)
    eventMetricsState.bySeverity.set("error", 0)
}
