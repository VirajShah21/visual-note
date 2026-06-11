"use client"

import type { RefObject } from "react"
import { Button } from "../../button"
import { cx } from "../../class-name"
import { Card, Stack, Text } from "../../primitives"
import styles from "../../article-editor.module.css"
import type { ArticleEditorCommand } from "../types"

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
                        items.map((command, index) => {
                            const isActive = index === selectedIndex

                            return (
                                <Button
                                    key={command.id}
                                    variant="ghost"
                                    className={cx(styles.commandButton, isActive && styles.commandButtonActive)}
                                    onMouseDown={event => {
                                        event.preventDefault()
                                        onApply(command)
                                    }}
                                >
                                    <Text tone={isActive ? "strong" : "muted"}>{command.label}</Text>
                                    <Text size="small">{command.description}</Text>
                                </Button>
                            )
                        })
                    )}
                </Stack>
                <Button variant="ghost" onClick={onDismiss}>
                    Dismiss
                </Button>
            </Stack>
        </Card>
    )
}
