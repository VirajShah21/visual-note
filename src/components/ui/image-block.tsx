"use client"

/* eslint-disable @next/next/no-img-element -- User-authored article images use arbitrary URLs and need native intrinsic sizing. */

import { createElement, type CSSProperties } from "react"
import { cx } from "./class-name"
import styles from "./image-block.module.css"

export type ImageBlockSize = "full" | "wide" | "medium" | "small"

type ImageBlockFigureProps = {
    url: string
    alt: string
    title?: string
    caption?: string
    overlayText?: string
    size?: ImageBlockSize
    borderRadius?: number
    borderWidth?: number
    className?: string
    editLabel?: string
    isEditing?: boolean
    onEdit?: () => void
}

const sizeClass = (size: ImageBlockSize) => {
    if (size === "wide") return styles.sizeWide
    if (size === "medium") return styles.sizeMedium
    if (size === "small") return styles.sizeSmall

    return styles.sizeFull
}

const imageSource = (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return ""
    if (/^(https?:|data:image\/|blob:)/i.test(trimmed) || trimmed.startsWith("/")) return trimmed

    return `https://${trimmed}`
}

export function ImageBlockFigure({
    url,
    alt,
    title,
    caption,
    overlayText,
    size = "full",
    borderRadius = 0,
    borderWidth = 0,
    className,
    editLabel = "Click to edit",
    isEditing = false,
    onEdit,
}: ImageBlockFigureProps) {
    const src = imageSource(url)
    const imageStyle = {
        "--image-border-radius": `${Math.max(0, borderRadius)}px`,
        "--image-border-width": `${Math.max(0, borderWidth)}px`,
    } as CSSProperties
    const content = (
        <>
            {src ? <img className={styles.image} src={src} alt={alt} title={title || undefined} /> : <div className={styles.placeholder}>Paste an image URL</div>}
            {overlayText ? <div className={styles.overlay}>{overlayText}</div> : null}
            {onEdit && !isEditing ? <span className={styles.editOverlay}>{editLabel}</span> : null}
        </>
    )

    return (
        <figure className={cx(styles.figure, sizeClass(size), className)} style={imageStyle}>
            {onEdit ? (
                <button type="button" className={cx(styles.frame, styles.editableFrame, isEditing && styles.editingFrame)} aria-label={editLabel} onClick={onEdit}>
                    {content}
                </button>
            ) : (
                <div className={styles.frame}>{content}</div>
            )}
            {caption ? createElement("figcaption", { className: styles.caption }, caption) : null}
        </figure>
    )
}
