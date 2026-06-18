"use client"

import { Tabs } from "@base-ui/react/tabs"
import { useCallback, type ReactNode } from "react"
import { cx } from "./class-name"
import styles from "./segmented-control.module.css"

export type SegmentedControlOption<Value extends string> = {
    icon?: ReactNode
    label: string
    value: Value
}

type SegmentedControlProps<Value extends string> = {
    className?: string
    label: string
    options: Array<SegmentedControlOption<Value>>
    value: Value
    onValueChange: (value: Value) => void
}

export function SegmentedControl<Value extends string>({ className, label, options, value, onValueChange }: SegmentedControlProps<Value>) {
    const handleValueChange = useCallback(
        (nextValue: unknown) => {
            if (typeof nextValue === "string") onValueChange(nextValue as Value)
        },
        [onValueChange],
    )

    return (
        <Tabs.Root className={cx(styles.root, className)} value={value} onValueChange={handleValueChange}>
            <Tabs.List className={styles.list} aria-label={label}>
                <Tabs.Indicator className={styles.indicator} renderBeforeHydration />
                {options.map(option => (
                    <Tabs.Tab key={option.value} className={styles.item} value={option.value}>
                        {option.icon}
                        <span>{option.label}</span>
                    </Tabs.Tab>
                ))}
            </Tabs.List>
        </Tabs.Root>
    )
}
