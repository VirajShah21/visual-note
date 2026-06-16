"use client"

import { type ChangeEvent, type KeyboardEvent, useCallback } from "react"
import { Button } from "../../button"
import { cx } from "../../class-name"
import { Divider, Pill, Stack, Text } from "../../primitives"
import { isListBlock, type ArticleBlock } from "@/lib/visual-note/article-content"
import type { DisplayInstance } from "@/lib/visual-note/types"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import type { ArticleBlockHandlers, ArticleEditorProps } from "../types"
import type { EditorField } from "../types"
import { articleHeadingTargetId } from "../utils/heading-target"
import { denormalizeParagraphText, headingLevelClassName } from "../utils/text"
import styles from "../../article-editor.module.css"
import { DisplayBlock } from "./article-display-block"
import { BlockTextarea } from "./block-textarea"
import { InlineLinkTextarea } from "./inline-link-textarea"
import { MarkdownImageBlock } from "./markdown-image-block"
import { ReadableArticleBlock } from "./readable-article-block"

type ArticleBlockRendererProps = {
    block: ArticleBlock
    blockIndex: number
    displays: DisplayInstance[]
    handlers: ArticleBlockHandlers
    readOnly?: boolean
    renderDisplay?: ArticleEditorProps["renderDisplay"]
    renderVisualBlock?: ArticleEditorProps["renderVisualBlock"]
    onUploadImage?: ArticleEditorProps["onUploadImage"]
}

export function ArticleBlockRenderer({ block, blockIndex, displays, handlers, readOnly = false, renderDisplay, renderVisualBlock, onUploadImage }: ArticleBlockRendererProps) {
    if (readOnly)
        return (
            <ReadableArticleBlock
                block={block}
                blockIndex={blockIndex}
                displays={displays}
                renderDisplay={renderDisplay}
                renderVisualBlock={renderVisualBlock}
                handlers={handlers}
            />
        )

    if (block.kind === "paragraph")
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <ArticleInlineInput
                    className={cx(styles.blockInput, styles.blockInputParagraph)}
                    value={denormalizeParagraphText(block.text)}
                    blockIndex={blockIndex}
                    field="paragraph"
                    placeholder="Start typing"
                    handlers={handlers}
                />
            </Stack>
        )

    if (block.kind === "heading")
        return (
            <Stack id={articleHeadingTargetId(block.id)} gap="xs" className={styles.articleBlock}>
                <ArticleInlineInput
                    className={cx(styles.blockInput, styles.blockInputHeading, styles[headingLevelClassName(block.level)])}
                    blockIndex={blockIndex}
                    field="heading"
                    value={block.text}
                    aria-label={`Heading ${block.level}`}
                    handlers={handlers}
                />
            </Stack>
        )

    if (block.kind === "subtitle")
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <ArticleInlineInput
                    className={cx(styles.blockInput, styles.blockInputSubtitle)}
                    blockIndex={blockIndex}
                    field="subtitle"
                    value={block.text}
                    aria-label="Page subtitle"
                    placeholder="Add a subtitle"
                    handlers={handlers}
                />
            </Stack>
        )

    if (block.kind === "quote")
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <ArticleInlineInput
                    className={cx(styles.blockInput, styles.blockInputQuote)}
                    blockIndex={blockIndex}
                    field="quote"
                    value={block.lines.join("\n")}
                    placeholder="Quote text"
                    handlers={handlers}
                />
            </Stack>
        )

    if (block.kind === "callout")
        return (
            <Stack gap="xs" className={cx(styles.articleBlock, styles.calloutBlock)}>
                <Stack className={styles.blockLabelRow} direction="horizontal" gap="sm">
                    <Pill>{block.tone}</Pill>
                    <CalloutToneButton blockIndex={blockIndex} tone="note" handlers={handlers}>
                        Note
                    </CalloutToneButton>
                    <CalloutToneButton blockIndex={blockIndex} tone="tip" handlers={handlers}>
                        Tip
                    </CalloutToneButton>
                    <CalloutToneButton blockIndex={blockIndex} tone="warning" handlers={handlers}>
                        Warning
                    </CalloutToneButton>
                </Stack>
                <ArticleInlineInput className={cx(styles.blockInput, styles.blockInputCallout)} blockIndex={blockIndex} field="callout" value={block.text} handlers={handlers} />
            </Stack>
        )

    if (block.kind === "code")
        return (
            <Stack gap="xs" className={cx(styles.articleBlock, styles.codeBlock)}>
                <Text tone="muted" size="small">{`Code block (${block.language})`}</Text>
                <ArticleCodeInput
                    className={cx(styles.blockInput, styles.blockInputCode)}
                    blockIndex={blockIndex}
                    value={block.code}
                    placeholder="Enter code"
                    handlers={handlers}
                />
            </Stack>
        )

    if (isListBlock(block))
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <Stack gap="xs">
                    {block.items.map((item, itemIndex) => (
                        <ArticleListItem key={`${blockIndex}-${itemIndex}`} blockKind={block.kind} blockIndex={blockIndex} item={item} itemIndex={itemIndex} handlers={handlers} />
                    ))}
                </Stack>
            </Stack>
        )

    if (block.kind === "divider")
        return (
            <Stack className={styles.articleBlock}>
                <Divider />
            </Stack>
        )

    if (block.kind === "image")
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <MarkdownImageBlock blockIndex={blockIndex} alt={block.alt} url={block.url} handlers={handlers} onUploadImage={onUploadImage} />
            </Stack>
        )

    if (block.kind === "display") return <DisplayBlock block={block} blockIndex={blockIndex} displays={displays} renderDisplay={renderDisplay} />

    if (block.kind === "visual")
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <Stack className={styles.displayBlock} gap="sm">
                    <RenderedVisualBlock block={block} blockIndex={blockIndex} handlers={handlers} renderVisualBlock={renderVisualBlock} />
                </Stack>
            </Stack>
        )

    return null
}

type ArticleInputProps = {
    className: string
    blockIndex: number
    field: EditorField
    value: string
    placeholder?: string
    "aria-label"?: string
    handlers: ArticleBlockHandlers
}

function ArticleInlineInput({ className, blockIndex, field, value, placeholder, "aria-label": ariaLabel, handlers }: ArticleInputProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => handlers.onInputChange(blockIndex, field, undefined, event), [blockIndex, field, handlers])
    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => handlers.onInputKeyDown(blockIndex, field, undefined, event), [blockIndex, field, handlers])

    return (
        <InlineLinkTextarea
            className={className}
            data-block-index={blockIndex}
            data-editor-field={field}
            value={value}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
        />
    )
}

function ArticleCodeInput({ className, blockIndex, value, placeholder, handlers }: Omit<ArticleInputProps, "field" | "aria-label">) {
    const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => handlers.onInputChange(blockIndex, "code", undefined, event), [blockIndex, handlers])
    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => handlers.onInputKeyDown(blockIndex, "code", undefined, event), [blockIndex, handlers])

    return <BlockTextarea className={className} data-block-index={blockIndex} value={value} placeholder={placeholder} onChange={handleChange} onKeyDown={handleKeyDown} />
}

type CalloutToneButtonProps = {
    blockIndex: number
    tone: "note" | "tip" | "warning"
    handlers: ArticleBlockHandlers
    children: string
}

function CalloutToneButton({ blockIndex, tone, handlers, children }: CalloutToneButtonProps) {
    const handleClick = useCallback(() => handlers.updateCalloutTone(blockIndex, tone), [blockIndex, handlers, tone])

    return (
        <Button variant="ghost" onClick={handleClick}>
            {children}
        </Button>
    )
}

type ArticleListItemProps = {
    blockKind: "bulletList" | "orderedList"
    blockIndex: number
    item: string
    itemIndex: number
    handlers: ArticleBlockHandlers
}

function ArticleListItem({ blockKind, blockIndex, item, itemIndex, handlers }: ArticleListItemProps) {
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => handlers.onInputChange(blockIndex, "list-item", itemIndex, event),
        [blockIndex, handlers, itemIndex],
    )
    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLTextAreaElement>) => handlers.onInputKeyDown(blockIndex, "list-item", itemIndex, event),
        [blockIndex, handlers, itemIndex],
    )
    return (
        <Stack className={styles.listRow} direction="horizontal" gap="sm">
            <Text size="small">{blockKind === "bulletList" ? "•" : `${itemIndex + 1}.`}</Text>
            <InlineLinkTextarea
                className={cx(styles.blockInput, blockKind === "orderedList" ? styles.blockInputOrderedList : styles.blockInputBulletList)}
                data-block-index={blockIndex}
                data-list-index={itemIndex}
                value={item}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
            />
        </Stack>
    )
}

type RenderedVisualBlockProps = {
    block: Extract<ArticleBlock, { kind: "visual" }>
    blockIndex: number
    handlers: ArticleBlockHandlers
    renderVisualBlock?: ArticleEditorProps["renderVisualBlock"]
}

function RenderedVisualBlock({ block, blockIndex, handlers, renderVisualBlock }: RenderedVisualBlockProps) {
    const handleDataChange = useCallback((data: VisualBlockData) => handlers.updateVisualBlockData(blockIndex, data), [blockIndex, handlers])

    return renderVisualBlock?.(block, handleDataChange) ?? <Text size="small">{`visual:${block.visualKind}`}</Text>
}
