"use client"

import { useState } from "react"
import { Image as ImageIcon } from "lucide-react"
import { Grid, ImageBlockFigure, Pill, SelectField, Stack, TextAreaField, TextField } from "@/components/ui"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import styles from "../../../visual-note-app.module.css"
import { stringFrom } from "../../utils/visual-note-app.utils"

type VisualImageBlockProps = {
    data: VisualBlockData
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

export function VisualImageBlock({ data, onDataChange }: VisualImageBlockProps) {
    const [isEditingDetails, setIsEditingDetails] = useState(false)
    const updateField = (field: string, value: unknown) => onDataChange({ ...data, [field]: value })
    const size = sizeFrom(data.size)
    const borderRadius = numberFrom(data.borderRadius, 12)
    const borderWidth = numberFrom(data.borderWidth, 0)

    return (
        <Stack className={styles.visualBlock} gap="md">
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
                isEditing={isEditingDetails}
                onEdit={() => setIsEditingDetails(true)}
            />
            {isEditingDetails ? (
                <>
                    <Grid columns="two" gap="sm">
                        <TextField label="Image URL" value={stringFrom(data.url)} onChange={event => updateField("url", event.target.value)} />
                        <TextField label="Alt text" value={stringFrom(data.alt)} onChange={event => updateField("alt", event.target.value)} />
                        <TextField label="Title" value={stringFrom(data.title)} onChange={event => updateField("title", event.target.value)} />
                        <SelectField label="Size" value={size} options={sizeOptions} onValueChange={value => updateField("size", value)} />
                        <TextField
                            label="Border roundness"
                            type="number"
                            min={0}
                            value={String(borderRadius)}
                            onChange={event => updateField("borderRadius", Number(event.target.value))}
                        />
                        <TextField
                            label="Border thickness"
                            type="number"
                            min={0}
                            value={String(borderWidth)}
                            onChange={event => updateField("borderWidth", Number(event.target.value))}
                        />
                    </Grid>
                    <TextField label="Caption" value={stringFrom(data.caption)} onChange={event => updateField("caption", event.target.value)} />
                    <TextAreaField label="Overlay text" value={stringFrom(data.overlayText)} onChange={event => updateField("overlayText", event.target.value)} />
                </>
            ) : null}
        </Stack>
    )
}
