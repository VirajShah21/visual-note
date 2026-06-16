"use client"

import { Upload } from "lucide-react"
import { type ChangeEvent, useCallback, useRef, useState } from "react"
import { Button } from "../../button"
import { TextField } from "../../form-controls"
import { ImageBlockFigure } from "../../image-block"
import { Stack, Text } from "../../primitives"
import type { ArticleBlockHandlers } from "../types"
import styles from "../../article-editor.module.css"

type MarkdownImageBlockProps = {
    blockIndex: number
    alt: string
    url: string
    handlers: ArticleBlockHandlers
    readOnly?: boolean
    onUploadImage?: (file: File) => Promise<{ url: string; alt?: string }>
}

export function MarkdownImageBlock({ blockIndex, alt, url, handlers, readOnly = false, onUploadImage }: MarkdownImageBlockProps) {
    const [isEditingDetails, setIsEditingDetails] = useState(false)
    const [uploadError, setUploadError] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const startEditing = useCallback(() => setIsEditingDetails(true), [])
    const updateUrl = useCallback((event: ChangeEvent<HTMLInputElement>) => handlers.updateImageField(blockIndex, { url: event.target.value }), [blockIndex, handlers])
    const updateAlt = useCallback((event: ChangeEvent<HTMLInputElement>) => handlers.updateImageField(blockIndex, { alt: event.target.value }), [blockIndex, handlers])
    const openFilePicker = useCallback(() => fileInputRef.current?.click(), [])
    const uploadFile = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (!file || !onUploadImage) return
            setUploadError("")
            setIsUploading(true)
            try {
                const uploaded = await onUploadImage(file)
                handlers.updateImageField(blockIndex, { url: uploaded.url, alt: alt || uploaded.alt || file.name })
                setIsEditingDetails(false)
            } catch (error) {
                setUploadError(error instanceof Error ? error.message : "Unable to upload image.")
            } finally {
                setIsUploading(false)
            }
        },
        [alt, blockIndex, handlers, onUploadImage],
    )

    return (
        <div className={styles.markdownImageBlock}>
            <ImageBlockFigure url={url} alt={alt} borderRadius={8} isEditing={isEditingDetails} onEdit={readOnly ? undefined : startEditing} />
            {isEditingDetails && !readOnly ? (
                <Stack gap="sm">
                    <div className={styles.imageFieldGrid}>
                        <TextField label="Image URL" value={url} placeholder="https://example.com/image.jpg" onChange={updateUrl} />
                        <TextField label="Alt text" value={alt} placeholder="Describe the image" onChange={updateAlt} />
                    </div>
                    {onUploadImage ? (
                        <Stack direction="horizontal" gap="sm" className={styles.imageUploadRow}>
                            <input ref={fileInputRef} className={styles.hiddenFileInput} type="file" accept="image/*" onChange={uploadFile} />
                            <Button icon={<Upload size={15} />} variant="secondary" disabled={isUploading} onClick={openFilePicker}>
                                {isUploading ? "Uploading" : "Upload image"}
                            </Button>
                            {uploadError ? (
                                <Text as="span" size="small" className={styles.imageUploadError}>
                                    {uploadError}
                                </Text>
                            ) : null}
                        </Stack>
                    ) : null}
                </Stack>
            ) : null}
        </div>
    )
}
