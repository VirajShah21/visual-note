"use client"

import { type MouseEvent, type RefObject, useCallback } from "react"
import { Button } from "@ui/button"
import { cx } from "@ui/class-name"
import { Card, Stack, Text } from "@ui/primitives"
import styles from "../../article-editor.module.css"
import type { ArticleEditorCommand } from "@ui/article-editor/types"

type CommandMenuProps = {
    commandRef: RefObject<HTMLDivElement | null>
    items: ArticleEditorCommand[]
    selectedIndex: number
    position: { top: number; left: number }
    onApply: (command: ArticleEditorCommand) => void
    onDismiss: () => void
}

export function CommandMenu({ commandRef, items, selectedIndex, position, onApply, onDismiss }: CommandMenuProps) {
    return (
        <Card className={styles.commandMenu} ref={commandRef} style={{ top: `${position.top}px`, left: `${position.left}px` }}>
            <Stack gap="sm">
                <Text tone="strong" size="small">
                    Insert command
                </Text>
                <Stack className={styles.commandList} gap="xs">
                    {items.length === 0 ? (
                        <Text size="small">No matching command</Text>
                    ) : (
                        items.map((command, index) => <CommandMenuItem key={command.id} command={command} isActive={index === selectedIndex} onApply={onApply} />)
                    )}
                </Stack>
                <Button variant="ghost" onClick={onDismiss}>
                    Dismiss
                </Button>
            </Stack>
        </Card>
    )
}

function CommandMenuItem({ command, isActive, onApply }: { command: ArticleEditorCommand; isActive: boolean; onApply: (command: ArticleEditorCommand) => void }) {
    const handleMouseDown = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault()
            onApply(command)
        },
        [command, onApply],
    )

    return (
        <Button variant="ghost" className={cx(styles.commandButton, isActive && styles.commandButtonActive)} onMouseDown={handleMouseDown}>
            <Text tone={isActive ? "strong" : "muted"}>{command.label}</Text>
            <Text size="small">{command.description}</Text>
        </Button>
    )
}
