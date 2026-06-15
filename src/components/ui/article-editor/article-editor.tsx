"use client"

import { AnimatePresence, motion } from "motion/react"
import { useCallback } from "react"
import { MarkdownSourceEditor } from "../markdown-source-editor"
import { Stack } from "../primitives"
import styles from "../article-editor.module.css"
import { ArticleBlockChip, ArticleBlockRenderer, ArticleTableOfContents, CommandMenu } from "./components"
import { useArticleEditorController } from "./hooks/use-article-editor-controller"
import type { ArticleEditorProps } from "./types"

export function ArticleEditor({
    value,
    displays,
    onChange,
    blockInfoMode = "show",
    contentsMode = "show",
    editorMode = "editing",
    readOnly = false,
    renderDisplay,
    renderVisualBlock,
}: ArticleEditorProps) {
    const {
        boundedSelectedCommandIndex,
        commandItems,
        commandRef,
        commandState,
        editorRef,
        menuPosition,
        parsed,
        selectedBlockRange,
        selectionRect,
        applyCommand,
        dismissCommand,
        handlers,
        selectionHandlers,
    } = useArticleEditorController({ value, displays, onChange, renderDisplay, renderVisualBlock })
    const isSourceMode = editorMode === "source"
    const isReaderMode = readOnly || editorMode === "reader"
    const activeSelectionHandlers = isSourceMode || isReaderMode ? {} : selectionHandlers
    const applyActiveCommand = useCallback(
        (command: (typeof commandItems)[number]) => {
            if (!commandState) return

            applyCommand(commandState.blockIndex, commandState.field, commandState.listIndex, command)
        },
        [applyCommand, commandState],
    )

    if (isSourceMode)
        return (
            <Stack className={styles.articleEditorSource} gap="none" ref={editorRef}>
                <MarkdownSourceEditor value={value} onChange={onChange} />
            </Stack>
        )

    return (
        <Stack className={`${styles.articleEditor} ${isReaderMode ? styles.articleEditorReader : ""}`} gap="sm" ref={editorRef} {...activeSelectionHandlers}>
            {selectionRect ? (
                <motion.div
                    aria-hidden="true"
                    className={styles.articleSelectionMarquee}
                    style={{
                        height: selectionRect.height,
                        left: selectionRect.left,
                        top: selectionRect.top,
                        width: selectionRect.width,
                    }}
                />
            ) : null}
            <Stack className={styles.blockList} gap="xs">
                <AnimatePresence mode="popLayout">
                    {parsed.blocks.map((block, blockIndex) => {
                        const isSelected = !isReaderMode && selectedBlockRange ? blockIndex >= selectedBlockRange.start && blockIndex <= selectedBlockRange.end : false

                        return (
                            <motion.div
                                key={blockIndex}
                                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                                transition={{ type: "spring", stiffness: 210, damping: 24 }}
                                className={`${styles.articleBlockRow} ${isSelected ? styles.articleBlockRowSelected : ""}`}
                                data-article-block-index={blockIndex}
                                layout
                            >
                                <ArticleBlockChip block={block} mode={blockInfoMode} />
                                <Stack className={styles.articleBlockContent} gap="sm">
                                    <ArticleBlockRenderer
                                        block={block}
                                        blockIndex={blockIndex}
                                        displays={displays}
                                        handlers={handlers}
                                        readOnly={isReaderMode}
                                        renderDisplay={renderDisplay}
                                        renderVisualBlock={renderVisualBlock}
                                    />
                                </Stack>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </Stack>
            {contentsMode === "hide" ? null : <ArticleTableOfContents headings={parsed.headings} hideTitle={contentsMode === "hide-title"} />}

            {commandState && !isReaderMode ? (
                <CommandMenu
                    commandRef={commandRef}
                    items={commandItems}
                    selectedIndex={boundedSelectedCommandIndex}
                    position={menuPosition}
                    onApply={applyActiveCommand}
                    onDismiss={dismissCommand}
                />
            ) : null}
        </Stack>
    )
}
