"use client"

import { Image as ImageIcon } from "lucide-react"
import { type ChangeEvent, useCallback } from "react"
import { DataSelectField, DataTextAreaField, DataTextField, EditableVisualBlock, Grid, ImageBlockFigure, Pill, Stack, TextField } from "@/components/ui"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import { stringFrom } from "@features/visual-note/visual-note-app/utils/visual-note-app.utils"
import styles from "../../../visual-note-app.module.css"

type VisualImageBlockProps = {
    data: VisualBlockData
    isReadOnly?: boolean
    onDataChange: (data: VisualBlockData) => void
}

const sizeOptions = [
    { label: "Full width", value: "full" },
    { label: "Wide", value: "wide" },
    { label: "Medium", value: "medium" },
    { label: "Small", value: "small" },
]

const sizeFrom = (value: unknown) => {
    const size = stringFrom(value, "full")
    if (size === "wide" || size === "medium" || size === "small") return size

    return "full"
}

const numberFrom = (value: unknown, fallback: number) => {
    const parsed = typeof value === "number" ? value : Number.parseFloat(stringFrom(value))
    if (Number.isFinite(parsed)) return parsed

    return fallback
}

export function VisualImageBlock({ data, isReadOnly = false, onDataChange }: VisualImageBlockProps) {
    const updateField = useCallback((field: string, value: unknown) => onDataChange({ ...data, [field]: value }), [data, onDataChange])
    const size = sizeFrom(data.size)
    const borderRadius = numberFrom(data.borderRadius, 12)
    const borderWidth = numberFrom(data.borderWidth, 0)
    const preview = (
        <>
            <Stack className={styles.visualBlockHeader} direction="horizontal" gap="sm">
                <Pill>
                    <ImageIcon size={13} />
                    Image
                </Pill>
            </Stack>
            <ImageBlockFigure
                url={stringFrom(data.url)}
                alt={stringFrom(data.alt, "Image")}
                title={stringFrom(data.title)}
                caption={stringFrom(data.caption)}
                overlayText={stringFrom(data.overlayText)}
                size={size}
                borderRadius={borderRadius}
                borderWidth={borderWidth}
            />
        </>
    )

    return (
        <EditableVisualBlock preview={preview} readOnly={isReadOnly}>
            <Grid columns="two" gap="sm">
                <DataTextField label="Image URL" field="url" value={stringFrom(data.url)} onUpdateField={updateField} />
                <DataTextField label="Alt text" field="alt" value={stringFrom(data.alt)} onUpdateField={updateField} />
                <DataTextField label="Title" field="title" value={stringFrom(data.title)} onUpdateField={updateField} />
                <DataSelectField label="Size" field="size" value={size} options={sizeOptions} onUpdateField={updateField} />
                <ImageNumberField label="Border roundness" field="borderRadius" value={String(borderRadius)} onUpdateField={updateField} />
                <ImageNumberField label="Border thickness" field="borderWidth" value={String(borderWidth)} onUpdateField={updateField} />
            </Grid>
            <DataTextField label="Caption" field="caption" value={stringFrom(data.caption)} onUpdateField={updateField} />
            <DataTextAreaField label="Overlay text" field="overlayText" value={stringFrom(data.overlayText)} onUpdateField={updateField} />
        </EditableVisualBlock>
    )
}

function ImageNumberField({ label, field, value, onUpdateField }: { label: string; field: string; value: string; onUpdateField: (field: string, value: unknown) => void }) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, Number(event.target.value)), [field, onUpdateField])

    return <TextField label={label} type="number" min={0} value={value} onChange={handleChange} />
}
