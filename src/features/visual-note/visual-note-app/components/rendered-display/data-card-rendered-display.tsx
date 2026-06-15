"use client"

import { Pencil } from "lucide-react"
import { useCallback, useState } from "react"
import { Button, Heading, Stack, Text } from "@/components/ui"
import type { DisplayInstance } from "@/lib/visual-note/types"
import { stringFrom } from "../../utils/visual-note-app.utils"
import styles from "../../../visual-note-app.module.css"
import { DisplayDataEditor } from "../display-data-editor"

type DataCardRenderedDisplayProps = {
    data: Record<string, unknown>
    display: DisplayInstance
    isReadOnly: boolean
    onDataChange: (data: Record<string, unknown>) => void
}

export function DataCardRenderedDisplay({ data, display, isReadOnly, onDataChange }: DataCardRenderedDisplayProps) {
    const [editingDataCard, setEditingDataCard] = useState(false)
    const closeEditor = useCallback(() => setEditingDataCard(false), [])
    const openEditor = useCallback(() => setEditingDataCard(true), [])

    if (isReadOnly)
        return (
            <Stack className={styles.heroPanel} gap="md">
                <Text tone="strong">{stringFrom(data.label, "Label")}</Text>
                <Heading size="md">{stringFrom(data.value, "Value")}</Heading>
            </Stack>
        )

    return (
        <Stack gap="md">
            {editingDataCard ? (
                <Stack gap="md">
                    <DisplayDataEditor display={display} onDataChange={onDataChange} />
                    <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                        <Button variant="ghost" onClick={closeEditor}>
                            Done
                        </Button>
                    </Stack>
                </Stack>
            ) : (
                <Stack className={styles.heroPanel} gap="md">
                    <Text tone="strong">{stringFrom(data.label, "Label")}</Text>
                    <Heading size="md">{stringFrom(data.value, "Value")}</Heading>
                    <Button icon={<Pencil size={14} />} variant="ghost" onClick={openEditor}>
                        Edit
                    </Button>
                </Stack>
            )}
        </Stack>
    )
}
