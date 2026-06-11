"use client"

import type { ArticleBlock } from "@/lib/visual-note/article-content"
import { visualBlockLabel } from "@/lib/visual-note/visual-blocks"
import styles from "./article-block-chip.module.css"

type ArticleBlockChipProps = {
    block: ArticleBlock
}

const previewText = (value: string, fallback: string) => {
    const trimmed = value.trim()
    if (!trimmed) return fallback
    if (trimmed.length <= 52) return trimmed

    return `${trimmed.slice(0, 49)}...`
}

const chipContent = (block: ArticleBlock) => {
    if (block.kind === "heading") return { label: `Heading ${block.level}`, detail: "" }
    if (block.kind === "image") return { label: "Image", detail: `URL: ${previewText(block.url, "Empty")} Alt: ${previewText(block.alt, "Empty")}` }
    if (block.kind === "paragraph") return { label: "Paragraph", detail: previewText(block.text, "Empty") }
    if (block.kind === "bulletList") return { label: "Bullets", detail: `${block.items.length} item${block.items.length === 1 ? "" : "s"}` }
    if (block.kind === "orderedList") return { label: "Numbered", detail: `${block.items.length} item${block.items.length === 1 ? "" : "s"}` }
    if (block.kind === "quote") return { label: "Quote", detail: `${block.lines.length} line${block.lines.length === 1 ? "" : "s"}` }
    if (block.kind === "code") return { label: "Code", detail: block.language || "text" }
    if (block.kind === "callout") return { label: "Callout", detail: block.tone }
    if (block.kind === "display") return { label: "Display", detail: `#${block.displayIndex + 1}` }
    if (block.kind === "visual") return { label: visualBlockLabel(block.visualKind), detail: `visual:${block.visualKind}` }

    return { label: "Divider", detail: "" }
}

export function ArticleBlockChip({ block }: ArticleBlockChipProps) {
    const { label, detail } = chipContent(block)

    return (
        <div className={styles.meta} aria-label={detail ? `${label}: ${detail}` : label}>
            <span className={styles.chip}>{label}</span>
            {detail ? <span className={styles.detail}>{detail}</span> : null}
        </div>
    )
}
