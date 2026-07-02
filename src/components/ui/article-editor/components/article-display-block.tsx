"use client"

import { Stack, Text } from "@ui/primitives"
import type { ArticleBlock } from "@/lib/visual-note/article-content"
import type { DisplayInstance } from "@/lib/visual-note/types"
import type { ArticleEditorProps } from "@ui/article-editor/types"
import styles from "../../article-editor.module.css"

type DisplayBlockProps = {
    block: Extract<ArticleBlock, { kind: "display" }>
    blockIndex: number
    displays: DisplayInstance[]
    renderDisplay?: ArticleEditorProps["renderDisplay"]
}

export function DisplayBlock({ block, displays, renderDisplay }: DisplayBlockProps) {
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
