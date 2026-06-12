"use client"

import { useState, type ReactNode } from "react"
import { Button } from "./button"
import { cx } from "./class-name"
import { EditableFrame } from "./editable-frame"
import { Stack } from "./primitives"
import styles from "./editable-visual-block.module.css"

type EditableVisualBlockProps = {
    preview: ReactNode
    children: ReactNode
    className?: string
    previewClassName?: string
    previewPadding?: "normal" | "none"
    editLabel?: string
    doneLabel?: string
    readOnly?: boolean
}

export function EditableVisualBlock({
    preview,
    children,
    className,
    previewClassName,
    previewPadding = "normal",
    editLabel = "Click to edit",
    doneLabel = "Done",
    readOnly = false,
}: EditableVisualBlockProps) {
    const [isEditing, setIsEditing] = useState(false)
    const previewContent = (
        <Stack className={cx(styles.previewContent, previewPadding === "none" && styles.previewContentFlush)} gap="md">
            {preview}
        </Stack>
    )

    return (
        <Stack className={cx(readOnly && styles.readOnlyBlock, className)} gap="md">
            {readOnly ? (
                <Stack className={cx(styles.previewFrame, styles.readOnlyPreviewFrame, previewClassName)} gap="none">
                    {previewContent}
                </Stack>
            ) : (
                <EditableFrame className={cx(styles.previewFrame, previewClassName)} editLabel={editLabel} isEditing={isEditing} onClick={() => setIsEditing(true)}>
                    {previewContent}
                </EditableFrame>
            )}
            {isEditing && !readOnly ? (
                <Stack className={styles.editorPanel} gap="md">
                    {children}
                    <Stack className={styles.editorActions} direction="horizontal" gap="sm">
                        <Button variant="ghost" onClick={() => setIsEditing(false)}>
                            {doneLabel}
                        </Button>
                    </Stack>
                </Stack>
            ) : null}
        </Stack>
    )
}
