"use client"

import { AnimatePresence, motion } from "motion/react"
import { Stack } from "../primitives"
import styles from "../article-editor.module.css"
import { ArticleBlockChip, ArticleBlockRenderer, ArticleTableOfContents, CommandMenu } from "./components"
import { useArticleEditorController } from "./hooks/use-article-editor-controller"
import type { ArticleEditorProps } from "./types"

export function ArticleEditor({ value, displays, onChange, renderDisplay, renderVisualBlock }: ArticleEditorProps) {
    const { boundedSelectedCommandIndex, commandItems, commandRef, commandState, editorRef, menuPosition, parsed, applyCommand, dismissCommand, handlers } =
        useArticleEditorController({ value, displays, onChange, renderDisplay, renderVisualBlock })

    return (
        <Stack className={styles.articleEditor} gap="sm" ref={editorRef}>
            <Stack className={styles.blockList} gap="xs">
                <AnimatePresence mode="popLayout">
                    {parsed.blocks.map((block, blockIndex) => (
                        <motion.div
                            key={blockIndex}
                            initial={{ opacity: 0, y: 10, scale: 0.985 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.99 }}
                            transition={{ type: "spring", stiffness: 210, damping: 24 }}
                            className={styles.articleBlockRow}
                            layout
                        >
                            <ArticleBlockChip block={block} />
                            <Stack gap="sm">
                                <ArticleBlockRenderer
                                    block={block}
                                    blockIndex={blockIndex}
                                    displays={displays}
                                    handlers={handlers}
                                    renderDisplay={renderDisplay}
                                    renderVisualBlock={renderVisualBlock}
                                />
                            </Stack>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </Stack>
            <ArticleTableOfContents headings={parsed.headings} />

            {commandState ? (
                <CommandMenu
                    commandRef={commandRef}
                    items={commandItems}
                    selectedIndex={boundedSelectedCommandIndex}
                    position={menuPosition}
                    onApply={command => applyCommand(commandState.blockIndex, commandState.field, commandState.listIndex, command)}
                    onDismiss={dismissCommand}
                />
            ) : null}
        </Stack>
    )
}
