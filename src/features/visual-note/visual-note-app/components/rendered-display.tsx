"use client"

import { type ReactNode, useCallback } from "react"
import { Stack } from "@/components/ui"
import type { ComponentKind } from "@/lib/visual-note/types"
import type { RenderedDisplayProps } from "../types/visual-note-app.types"
import { readableKind } from "../utils/visual-note-app.utils"
import styles from "../../visual-note-app.module.css"
import { DisplayDataEditor } from "./display-data-editor"
import { DataCardRenderedDisplay } from "./rendered-display/data-card-rendered-display"
import { DetailRenderedDisplay } from "./rendered-display/detail-rendered-display"
import { TimelineRenderedDisplay } from "./rendered-display/timeline-rendered-display"
import { WorkLogsRenderedDisplay } from "./rendered-display/work-logs-rendered-display"

export function RenderedDisplay({ display, onUpdate, isReadOnly = false }: RenderedDisplayProps) {
    const updateData = useCallback((nextData: Record<string, unknown>) => onUpdate({ ...display, data: nextData }), [display, onUpdate])
    const editor = isReadOnly ? null : (
        <Stack className={styles.inlineDisplayEditor} gap="md">
            <DisplayDataEditor display={display} onDataChange={updateData} />
        </Stack>
    )
    const displayHeader = useCallback(
        (icon: ReactNode, action?: ReactNode) => (
            <DetailRenderedDisplay.Header icon={icon} title={display.name} kindLabel={readableKind(display.kind as ComponentKind)} action={action} />
        ),
        [display.kind, display.name],
    )

    if (display.kind === "data-card") return <DataCardRenderedDisplay data={display.data} display={display} isReadOnly={isReadOnly} onDataChange={updateData} />

    if (display.kind === "work-logs") return <WorkLogsRenderedDisplay data={display.data} isReadOnly={isReadOnly} onDataChange={updateData} />

    if (display.kind === "timeline") return <TimelineRenderedDisplay displayName={display.name} data={display.data} isReadOnly={isReadOnly} onDataChange={updateData} />

    return <DetailRenderedDisplay display={display} editor={editor} displayHeader={displayHeader} />
}
