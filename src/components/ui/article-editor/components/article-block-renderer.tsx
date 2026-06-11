"use client"

import { Button } from "../../button"
import { cx } from "../../class-name"
import { Divider, Pill, Stack, Text } from "../../primitives"
import { isListBlock, type ArticleBlock } from "@/lib/visual-note/article-content"
import type { DisplayInstance } from "@/lib/visual-note/types"
import type { ArticleBlockHandlers, ArticleEditorProps } from "../types"
import { articleHeadingTargetId } from "../utils/heading-target"
import { denormalizeParagraphText, headingLevelClassName } from "../utils/text"
import styles from "../../article-editor.module.css"
import { BlockTextarea } from "./block-textarea"
import { InlineLinkTextarea } from "./inline-link-textarea"
import { MarkdownImageBlock } from "./markdown-image-block"

type ArticleBlockRendererProps = {
    block: ArticleBlock
    blockIndex: number
    displays: DisplayInstance[]
    handlers: ArticleBlockHandlers
    renderDisplay?: ArticleEditorProps["renderDisplay"]
    renderVisualBlock?: ArticleEditorProps["renderVisualBlock"]
}

export function ArticleBlockRenderer({ block, blockIndex, displays, handlers, renderDisplay, renderVisualBlock }: ArticleBlockRendererProps) {
    if (block.kind === "paragraph")
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <InlineLinkTextarea
                    className={cx(styles.blockInput, styles.blockInputParagraph)}
                    value={denormalizeParagraphText(block.text)}
                    data-block-index={blockIndex}
                    data-editor-field="paragraph"
                    placeholder="Start typing"
                    onChange={event => handlers.onInputChange(blockIndex, "paragraph", undefined, event)}
                    onKeyDown={event => handlers.onInputKeyDown(blockIndex, "paragraph", undefined, event)}
                />
            </Stack>
        )

    if (block.kind === "heading")
        return (
            <Stack id={articleHeadingTargetId(block.id)} gap="xs" className={styles.articleBlock}>
                <InlineLinkTextarea
                    className={cx(styles.blockInput, styles.blockInputHeading, styles[headingLevelClassName(block.level)])}
                    data-block-index={blockIndex}
                    value={block.text}
                    aria-label={`Heading ${block.level}`}
                    onChange={event => handlers.onInputChange(blockIndex, "heading", undefined, event)}
                    onKeyDown={event => handlers.onInputKeyDown(blockIndex, "heading", undefined, event)}
                />
            </Stack>
        )

    if (block.kind === "quote")
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <InlineLinkTextarea
                    className={cx(styles.blockInput, styles.blockInputQuote)}
                    data-block-index={blockIndex}
                    value={block.lines.join("\n")}
                    placeholder="Quote text"
                    onChange={event => handlers.onInputChange(blockIndex, "quote", undefined, event)}
                    onKeyDown={event => handlers.onInputKeyDown(blockIndex, "quote", undefined, event)}
                />
            </Stack>
        )

    if (block.kind === "callout")
        return (
            <Stack gap="xs" className={cx(styles.articleBlock, styles.calloutBlock)}>
                <Stack className={styles.blockLabelRow} direction="horizontal" gap="sm">
                    <Pill>{block.tone}</Pill>
                    <Button variant="ghost" onClick={() => handlers.updateCalloutTone(blockIndex, "note")}>
                        Note
                    </Button>
                    <Button variant="ghost" onClick={() => handlers.updateCalloutTone(blockIndex, "tip")}>
                        Tip
                    </Button>
                    <Button variant="ghost" onClick={() => handlers.updateCalloutTone(blockIndex, "warning")}>
                        Warning
                    </Button>
                </Stack>
                <InlineLinkTextarea
                    className={cx(styles.blockInput, styles.blockInputCallout)}
                    data-block-index={blockIndex}
                    value={block.text}
                    onChange={event => handlers.onInputChange(blockIndex, "callout", undefined, event)}
                    onKeyDown={event => handlers.onInputKeyDown(blockIndex, "callout", undefined, event)}
                />
            </Stack>
        )

    if (block.kind === "code")
        return (
            <Stack gap="xs" className={cx(styles.articleBlock, styles.codeBlock)}>
                <Text tone="muted" size="small">{`Code block (${block.language})`}</Text>
                <BlockTextarea
                    className={cx(styles.blockInput, styles.blockInputCode)}
                    data-block-index={blockIndex}
                    value={block.code}
                    placeholder="Enter code"
                    onChange={event => handlers.onInputChange(blockIndex, "code", undefined, event)}
                    onKeyDown={event => handlers.onInputKeyDown(blockIndex, "code", undefined, event)}
                />
            </Stack>
        )

    if (isListBlock(block))
        return (
            <Stack gap="xs" className={styles.articleBlock}>
                <Stack gap="xs">
                    {block.items.map((item, itemIndex) => (
                        <Stack key={`${blockIndex}-${itemIndex}`} className={styles.listRow} direction="horizontal" gap="sm">
                            <Text size="small">{block.kind === "bulletList" ? "•" : `${itemIndex + 1}.`}</Text>
                            <InlineLinkTextarea
                                className={cx(styles.blockInput, block.kind === "orderedList" ? styles.blockInputOrderedList : styles.blockInputBulletList)}
                                data-block-index={blockIndex}
                                data-list-index={itemIndex}
                                value={item}
                                onChange={event => handlers.onInputChange(blockIndex, "list-item", itemIndex, event)}
                                onKeyDown={event => handlers.onInputKeyDown(blockIndex, "list-item", itemIndex, event)}
                            />
                            <Button variant="ghost" onClick={() => handlers.removeListItem(blockIndex, itemIndex)}>
                                Remove
                            </Button>
                        </Stack>
                    ))}
                </Stack>
                <Stack className={styles.blockActions} direction="horizontal" gap="sm">
                    <Button variant="ghost" onClick={() => handlers.addListItem(blockIndex)}>
                        Add item
                    </Button>
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
                <MarkdownImageBlock blockIndex={blockIndex} alt={block.alt} url={block.url} handlers={handlers} />
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

function DisplayBlock({
    block,
    displays,
    renderDisplay,
}: {
    block: Extract<ArticleBlock, { kind: "display" }>
    blockIndex: number
    displays: DisplayInstance[]
    renderDisplay?: ArticleEditorProps["renderDisplay"]
}) {
    const display = displays[block.displayIndex]

    return (
        <Stack gap="xs" className={styles.articleBlock}>
            {display ? (
                <Stack className={styles.displayBlock} gap="sm">
                    {renderDisplay?.(display, block.displayIndex)}
                </Stack>
            ) : (
                <Text size="small">{"{{display:" + String(block.displayIndex + 1) + "}"}</Text>
            )}
        </Stack>
    )
}
