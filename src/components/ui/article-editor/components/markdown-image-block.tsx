"use client"

import { TextField } from "../../form-controls"
import { ImageBlockFigure } from "../../image-block"
import type { ArticleBlockHandlers } from "../types"
import styles from "../../article-editor.module.css"

type MarkdownImageBlockProps = {
    blockIndex: number
    alt: string
    url: string
    handlers: ArticleBlockHandlers
}

export function MarkdownImageBlock({ blockIndex, alt, url, handlers }: MarkdownImageBlockProps) {
    return (
        <div className={styles.markdownImageBlock}>
            <ImageBlockFigure url={url} alt={alt} borderRadius={8} />
            <div className={styles.imageFieldGrid}>
                <TextField
                    label="Image URL"
                    value={url}
                    placeholder="https://example.com/image.jpg"
                    onChange={event => handlers.updateImageField(blockIndex, { url: event.target.value })}
                />
                <TextField label="Alt text" value={alt} placeholder="Describe the image" onChange={event => handlers.updateImageField(blockIndex, { alt: event.target.value })} />
            </div>
        </div>
    )
}
