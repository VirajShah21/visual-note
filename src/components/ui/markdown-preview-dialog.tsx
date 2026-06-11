"use client"

import hljs from "highlight.js/lib/core"
import markdown from "highlight.js/lib/languages/markdown"
import { ClipboardCopy } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "./button"
import { ModalDialog } from "./overlays"
import { Stack, Text } from "./primitives"
import styles from "./markdown-preview-dialog.module.css"

hljs.registerLanguage("markdown", markdown)

export type MarkdownPreviewDialogProps = {
    markdown: string
    open: boolean
    title?: string
    onOpenChange: (open: boolean) => void
}

export function MarkdownPreviewDialog({ markdown: source, open, title = "Markdown preview", onOpenChange }: MarkdownPreviewDialogProps) {
    const [copyLabel, setCopyLabel] = useState("Copy markdown")
    const highlighted = useMemo(() => hljs.highlight(source || "", { language: "markdown" }).value, [source])

    const copyMarkdown = async () => {
        await navigator.clipboard.writeText(source)
        setCopyLabel("Copied")
        window.setTimeout(() => setCopyLabel("Copy markdown"), 1200)
    }

    return (
        <ModalDialog open={open} title={title} description="Preview the selected article as markdown source." onOpenChange={onOpenChange}>
            <Stack gap="md">
                <div className={styles.toolbar}>
                    <Text size="small">Current article markdown</Text>
                    <Button icon={<ClipboardCopy size={15} />} variant="secondary" onClick={copyMarkdown} disabled={!source}>
                        {copyLabel}
                    </Button>
                </div>
                {source ? (
                    <pre className={styles.preview} aria-label="Markdown source preview">
                        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                    </pre>
                ) : (
                    <div className={styles.emptyState}>
                        <Text>No article is selected for export.</Text>
                    </div>
                )}
            </Stack>
        </ModalDialog>
    )
}
