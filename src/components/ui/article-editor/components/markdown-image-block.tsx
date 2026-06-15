"use client"

import { type ChangeEvent, useCallback, useState } from "react"
import { TextField } from "../../form-controls"
import { ImageBlockFigure } from "../../image-block"
import type { ArticleBlockHandlers } from "../types"
import styles from "../../article-editor.module.css"

type MarkdownImageBlockProps = {
    blockIndex: number
    alt: string
    url: string
    handlers: ArticleBlockHandlers
    readOnly?: boolean
}

export function MarkdownImageBlock({ blockIndex, alt, url, handlers, readOnly = false }: MarkdownImageBlockProps) {
    const [isEditingDetails, setIsEditingDetails] = useState(false)
    const startEditing = useCallback(() => setIsEditingDetails(true), [])
    const updateUrl = useCallback((event: ChangeEvent<HTMLInputElement>) => handlers.updateImageField(blockIndex, { url: event.target.value }), [blockIndex, handlers])
    const updateAlt = useCallback((event: ChangeEvent<HTMLInputElement>) => handlers.updateImageField(blockIndex, { alt: event.target.value }), [blockIndex, handlers])

    return (
        <div className={styles.markdownImageBlock}>
            <ImageBlockFigure url={url} alt={alt} borderRadius={8} isEditing={isEditingDetails} onEdit={readOnly ? undefined : startEditing} />
            {isEditingDetails && !readOnly ? (
                <div className={styles.imageFieldGrid}>
                    <TextField label="Image URL" value={url} placeholder="https://example.com/image.jpg" onChange={updateUrl} />
                    <TextField label="Alt text" value={alt} placeholder="Describe the image" onChange={updateAlt} />
                </div>
            ) : null}
        </div>
    )
}
