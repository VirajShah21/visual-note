"use client"

import { Button as BaseButton } from "@base-ui/react/button"
import type { ComponentProps, ReactNode } from "react"
import { cx } from "./class-name"
import styles from "./editable-frame.module.css"

type EditableFrameProps = Omit<ComponentProps<typeof BaseButton>, "className" | "children"> & {
    children: ReactNode
    className?: string
    editLabel?: string
    isEditing?: boolean
}

export function EditableFrame({ children, className, editLabel = "Click to edit", isEditing = false, type = "button", ...props }: EditableFrameProps) {
    return (
        <BaseButton className={cx(styles.frame, className, isEditing && styles.editingFrame)} type={type} aria-label={editLabel} {...props}>
            {children}
            {!isEditing ? <span className={styles.editOverlay}>{editLabel}</span> : null}
        </BaseButton>
    )
}
