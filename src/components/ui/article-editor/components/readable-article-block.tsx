"use client"

import { cx } from "../../class-name"
import { Divider, Pill, Stack, Text } from "../../primitives"
import { isListBlock, type ArticleBlock } from "@/lib/visual-note/article-content"
import type { DisplayInstance } from "@/lib/visual-note/types"
import type { ArticleBlockHandlers, ArticleEditorProps } from "../types"
import { articleHeadingTargetId } from "../utils/heading-target"
import { denormalizeParagraphText } from "../utils/text"
import styles from "../../article-editor.module.css"
import { DisplayBlock } from "./article-display-block"
import { HighlightedCodeBlock } from "./highlighted-code-block"
import { ReadableInlineContent } from "./inline-link-textarea"
import { MarkdownImageBlock } from "./markdown-image-block"

type ReadableArticleBlockProps = {
    block: ArticleBlock
    blockIndex: number
    displays: DisplayInstance[]
    handlers: ArticleBlockHandlers
    renderDisplay?: ArticleEditorProps["renderDisplay"]
    renderVisualBlock?: ArticleEditorProps["renderVisualBlock"]
}

export function ReadableArticleBlock({ block, blockIndex, displays, handlers, renderDisplay, renderVisualBlock }: ReadableArticleBlockProps) {
    if (block.kind === "paragraph") return <ReaderText text={denormalizeParagraphText(block.text)} className={styles.readerParagraph} />

    if (block.kind === "heading")
        return (
            <Stack id={articleHeadingTargetId(block.id)} gap="xs" className={styles.articleBlock}>
                <Text className={cx(styles.readerHeading, styles[`readerHeading${block.level}`])} tone="strong">
                    <ReadableInlineContent text={block.text || "Untitled section"} />
                </Text>
            </Stack>
        )

    if (block.kind === "subtitle") return <ReaderText text={block.text} className={styles.readerSubtitle} tone="muted" />

    if (block.kind === "quote") return <ReaderText text={block.lines.join("\n")} className={styles.readerQuote} />

    if (block.kind === "callout")
        return (
            <Stack gap="xs" className={cx(styles.articleBlock, styles.calloutBlock)}>
                <Pill>{block.tone}</Pill>
                <Text className={styles.readerText} tone="strong">
                    <ReadableInlineContent text={block.text} />
                </Text>
            </Stack>
        )

    if (block.kind === "code") return <HighlightedCodeBlock code={block.code} language={block.language} />

    if (isListBlock(block))
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                {block.items.map((item, itemIndex) => (
                    <Stack key={`${blockIndex}-${itemIndex}`} className={styles.listRow} direction="horizontal" gap="sm">
                        <Text size="small">{block.kind === "bulletList" ? "•" : `${itemIndex + 1}.`}</Text>
                        <Text className={styles.readerText} tone="strong">
                            <ReadableInlineContent text={item} />
                        </Text>
                    </Stack>
                ))}
            </Stack>
        )

    if (block.kind === "divider") return <DividerBlock />

    if (block.kind === "image")
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <MarkdownImageBlock blockIndex={blockIndex} alt={block.alt} url={block.url} handlers={handlers} readOnly />
            </Stack>
        )

    if (block.kind === "display") return <DisplayBlock block={block} blockIndex={blockIndex} displays={displays} renderDisplay={renderDisplay} />

    if (block.kind === "visual")
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <Stack className={styles.displayBlock} gap="sm">
                    {renderVisualBlock?.(block, data => handlers.updateVisualBlockData(blockIndex, data)) ?? <Text size="small">{`visual:${block.visualKind}`}</Text>}
                </Stack>
            </Stack>
        )

    return null
}

function ReaderText({ text, className, tone = "strong" }: { text: string; className?: string; tone?: "muted" | "strong" }) {
    return (
        <Stack gap="xs" className={styles.articleBlock}>
            <Text className={cx(styles.readerText, className)} tone={tone}>
                <ReadableInlineContent text={text} />
            </Text>
        </Stack>
    )
}

function DividerBlock() {
    return (
        <Stack className={styles.articleBlock}>
            <Divider />
        </Stack>
    )
}
