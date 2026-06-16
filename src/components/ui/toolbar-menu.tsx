"use client"

import { Menu } from "@base-ui/react/menu"
import { Check, ChevronRight } from "lucide-react"
import { type ReactNode, useCallback } from "react"
import { cx } from "./class-name"
import styles from "./toolbar-menu.module.css"

export type ToolbarMenuOption<Value extends string = string> = {
    label: string
    value: Value
    icon?: ReactNode
}

export type ToolbarMenuGroup<Value extends string = string> = {
    id: string
    label: string
    icon?: ReactNode
    value: Value
    options: ToolbarMenuOption<Value>[]
    onValueChange: (value: Value) => void
}

export type ToolbarMenuAction = {
    id: string
    label: string
    icon?: ReactNode
    onSelect: () => void
}

type ToolbarMenuProps = {
    label: string
    icon: ReactNode
    groups: ToolbarMenuGroup[]
    actions?: ToolbarMenuAction[]
    className?: string
}

export function ToolbarMenu({ label, icon, groups, actions = [], className }: ToolbarMenuProps) {
    return (
        <Menu.Root>
            <Menu.Trigger className={cx(styles.trigger, className)} aria-label={label}>
                {icon}
            </Menu.Trigger>
            <Menu.Portal>
                <Menu.Positioner className={styles.positioner} side="bottom" align="end" sideOffset={8} collisionPadding={12}>
                    <Menu.Popup className={styles.popup}>
                        {groups.map(group => (
                            <ToolbarSubmenu key={group.id} group={group} />
                        ))}
                        {actions.map(action => (
                            <Menu.Item key={action.id} className={styles.item} closeOnClick onClick={action.onSelect}>
                                <span className={styles.itemIcon}>{action.icon}</span>
                                <span className={styles.itemLabel}>{action.label}</span>
                            </Menu.Item>
                        ))}
                    </Menu.Popup>
                </Menu.Positioner>
            </Menu.Portal>
        </Menu.Root>
    )
}

function ToolbarSubmenu({ group }: { group: ToolbarMenuGroup }) {
    const handleValueChange = useCallback((value: string) => group.onValueChange(value), [group])

    return (
        <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger className={styles.item}>
                <span className={styles.itemIcon}>{group.icon}</span>
                <span className={styles.itemLabel}>{group.label}</span>
                <span className={styles.summary}>{group.options.find(option => option.value === group.value)?.label}</span>
                <ChevronRight className={styles.chevron} size={14} />
            </Menu.SubmenuTrigger>
            <Menu.Portal>
                <Menu.Positioner className={styles.positioner} side="right" align="start" sideOffset={6} collisionPadding={12}>
                    <Menu.Popup className={styles.popup}>
                        <Menu.RadioGroup value={group.value} onValueChange={handleValueChange}>
                            {group.options.map(option => (
                                <Menu.RadioItem key={option.value} className={styles.item} closeOnClick value={option.value}>
                                    <span className={styles.itemIcon}>{option.icon}</span>
                                    <span className={styles.itemLabel}>{option.label}</span>
                                    <Menu.RadioItemIndicator className={styles.check}>
                                        <Check size={14} />
                                    </Menu.RadioItemIndicator>
                                </Menu.RadioItem>
                            ))}
                        </Menu.RadioGroup>
                    </Menu.Popup>
                </Menu.Positioner>
            </Menu.Portal>
        </Menu.SubmenuRoot>
    )
}
