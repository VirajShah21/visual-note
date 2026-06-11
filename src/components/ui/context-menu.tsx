"use client"

import { ContextMenu } from "@base-ui/react/context-menu"
import type { ReactNode } from "react"
import { cx } from "./class-name"
import styles from "./context-menu.module.css"

type ContextAction = {
    label: string
    icon?: ReactNode
    onSelect: () => void
}

type ContextActionsProps = {
    children: ReactNode
    className?: string
    items: ContextAction[]
}

export function ContextActions({ children, className, items }: ContextActionsProps) {
    return (
        <ContextMenu.Root>
            <ContextMenu.Trigger className={cx(styles.trigger, className)}>{children}</ContextMenu.Trigger>
            <ContextMenu.Portal>
                <ContextMenu.Positioner className={styles.positioner} sideOffset={6} collisionPadding={12}>
                    <ContextMenu.Popup className={styles.popup}>
                        {items.map(item => (
                            <ContextMenu.Item key={item.label} className={cx(styles.item)} onClick={item.onSelect}>
                                {item.icon}
                                {item.label}
                            </ContextMenu.Item>
                        ))}
                    </ContextMenu.Popup>
                </ContextMenu.Positioner>
            </ContextMenu.Portal>
        </ContextMenu.Root>
    )
}
