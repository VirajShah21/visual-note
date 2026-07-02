type EventSeverity = "info" | "warn" | "error"

type VisualNoteEvent = {
    event: string
    severity?: EventSeverity
    userId?: string
    metadata?: Record<string, unknown>
    error?: unknown
}

const errorMetadata = (error: unknown) => {
    if (!(error instanceof Error)) return { message: String(error) }

    return {
        message: error.message,
        name: error.name,
        code: (error as { code?: unknown }).code,
    }
}

export const recordVisualNoteEvent = ({ event, severity = "info", userId, metadata = {}, error }: VisualNoteEvent) => {
    const payload = {
        event,
        metadata,
        severity,
        timestamp: new Date().toISOString(),
        userId,
        ...(error === undefined ? {} : { error: errorMetadata(error) }),
    }

    if (severity === "error") console.error(JSON.stringify(payload))
    else if (severity === "warn") console.warn(JSON.stringify(payload))
    else console.info(JSON.stringify(payload))
}
