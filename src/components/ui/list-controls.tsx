"use client"

import { Pencil, Plus } from "lucide-react"
import { type ChangeEvent, useCallback } from "react"
import { Button } from "./button"
import { TextField } from "./form-controls"
import { InfoPopover, ModalDialog } from "./overlays"
import { Card, Grid, Heading, Pill, Stack, Text } from "./primitives"
import styles from "./bound-controls.module.css"

type StringListEditorForFieldProps = {
    title: string
    items: string[]
    label: string
    field: string
    newItem: string
    onAddListItem: (field: string, value: string) => void
    onUpdateListItem: (field: string, index: number, value: string) => void
    onRemoveListItem: (field: string, index: number) => void
}

export function StringListEditorForField({ title, items, label, field, newItem, onAddListItem, onUpdateListItem, onRemoveListItem }: StringListEditorForFieldProps) {
    const handleAdd = useCallback(() => onAddListItem(field, newItem), [field, newItem, onAddListItem])
    const handleChange = useCallback((index: number, value: string) => onUpdateListItem(field, index, value), [field, onUpdateListItem])
    const handleRemove = useCallback((index: number) => onRemoveListItem(field, index), [field, onRemoveListItem])

    return <StringListEditor title={title} items={items} label={label} onAdd={handleAdd} onChange={handleChange} onRemove={handleRemove} />
}

type StringListEditorProps = {
    title: string
    items: string[]
    label: string
    onAdd: () => void
    onChange: (index: number, value: string) => void
    onRemove: (index: number) => void
}

export function StringListEditor({ title, items, label, onAdd, onChange, onRemove }: StringListEditorProps) {
    return (
        <Stack gap="md">
            <Heading size="sm">{title}</Heading>
            {items.map((item, index) => (
                <StringListEditorItem key={`${index}-${item}`} item={item} index={index} label={label} onChange={onChange} onRemove={onRemove} />
            ))}
            <Button icon={<Plus size={15} />} onClick={onAdd} fullWidth>
                Add {label.toLowerCase()}
            </Button>
        </Stack>
    )
}

type StringListEditorItemProps = {
    item: string
    index: number
    label: string
    onChange: (index: number, value: string) => void
    onRemove: (index: number) => void
}

function StringListEditorItem({ item, index, label, onChange, onRemove }: StringListEditorItemProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onChange(index, event.target.value), [index, onChange])
    const handleRemove = useCallback(() => onRemove(index), [index, onRemove])

    return (
        <Card padding="compact">
            <Stack gap="md">
                <TextField label={`${label} ${index + 1}`} value={item} onChange={handleChange} />
                <Button variant="ghost" onClick={handleRemove} fullWidth>
                    Remove {label.toLowerCase()}
                </Button>
            </Stack>
        </Card>
    )
}

type InlineStringListProps = {
    title: string
    items: string[]
    onAdd: () => void
    onChange: (index: number, value: string) => void
    onRemove: (index: number) => void
}

export function InlineStringList({ title, items, onAdd, onChange, onRemove }: InlineStringListProps) {
    return (
        <Stack gap="sm">
            <Heading size="sm">{title}</Heading>
            {items.map((item, index) => (
                <InlineStringListItem key={`${index}-${item}`} title={title} item={item} index={index} onChange={onChange} onRemove={onRemove} />
            ))}
            <Button icon={<Plus size={15} />} variant="ghost" onClick={onAdd}>
                Add
            </Button>
        </Stack>
    )
}

type InlineStringListItemProps = {
    title: string
    item: string
    index: number
    onChange: (index: number, value: string) => void
    onRemove: (index: number) => void
}

function InlineStringListItem({ title, item, index, onChange, onRemove }: InlineStringListItemProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onChange(index, event.target.value), [index, onChange])
    const handleRemove = useCallback(() => onRemove(index), [index, onRemove])

    return (
        <Stack direction="horizontal" gap="sm" className={styles.wrapRow}>
            <TextField label={`${title} ${index + 1}`} value={item} onChange={handleChange} />
            <Button variant="ghost" onClick={handleRemove}>
                Remove
            </Button>
        </Stack>
    )
}

type InlineStringListForFieldProps = {
    title: string
    items: string[]
    field: string
    newItem: string
    onAddStringListItem: (field: string, value: string) => void
    onUpdateStringList: (field: string, index: number, value: string) => void
    onRemoveStringListItem: (field: string, index: number) => void
}

export function InlineStringListForField({ title, items, field, newItem, onAddStringListItem, onUpdateStringList, onRemoveStringListItem }: InlineStringListForFieldProps) {
    const handleAdd = useCallback(() => onAddStringListItem(field, newItem), [field, newItem, onAddStringListItem])
    const handleChange = useCallback((index: number, value: string) => onUpdateStringList(field, index, value), [field, onUpdateStringList])
    const handleRemove = useCallback((index: number) => onRemoveStringListItem(field, index), [field, onRemoveStringListItem])

    return <InlineStringList title={title} items={items} onAdd={handleAdd} onChange={handleChange} onRemove={handleRemove} />
}

type InlineObjectItemsProps = {
    items: Array<Record<string, unknown>>
    onAdd: () => void
    onChange: (index: number, patch: Record<string, unknown>) => void
    onRemove: (index: number) => void
}

export function InlineObjectItems({ items, onAdd, onChange, onRemove }: InlineObjectItemsProps) {
    return (
        <Stack gap="sm">
            {items.map((item, index) => (
                <InlineObjectItem key={`${index}-${item.label}`} item={item} index={index} onChange={onChange} onRemove={onRemove} />
            ))}
            <Button icon={<Plus size={15} />} variant="ghost" onClick={onAdd}>
                Add packed item
            </Button>
        </Stack>
    )
}

type InlineObjectItemProps = {
    item: Record<string, unknown>
    index: number
    onChange: (index: number, patch: Record<string, unknown>) => void
    onRemove: (index: number) => void
}

function InlineObjectItem({ item, index, onChange, onRemove }: InlineObjectItemProps) {
    const handleLabelChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onChange(index, { label: event.target.value }), [index, onChange])
    const handlePackedChange = useCallback(() => onChange(index, { packed: !Boolean(item.packed) }), [index, item.packed, onChange])
    const handleRemove = useCallback(() => onRemove(index), [index, onRemove])

    return (
        <Grid columns="two" gap="sm">
            <TextField label="Item" value={stringFrom(item.label)} onChange={handleLabelChange} />
            <Button variant={item.packed ? "primary" : "ghost"} onClick={handlePackedChange}>
                {item.packed ? "Packed" : "Open"}
            </Button>
            <Button variant="ghost" onClick={handleRemove}>
                Remove
            </Button>
        </Grid>
    )
}

export function DetailCell({ label, value }: { label: string; value: string }) {
    return (
        <Stack className={styles.detailCell} gap="xs">
            <Text size="small">{label}</Text>
            <Text tone="strong">{value}</Text>
        </Stack>
    )
}

export function InfoCard({ title, children }: { title: string; children: string }) {
    return (
        <Card>
            <Stack direction="horizontal" gap="sm">
                <Pill>{title}</Pill>
                <InfoPopover title={title} label={`${title} details`}>
                    {children}
                </InfoPopover>
            </Stack>
        </Card>
    )
}

type RenameDialogProps = {
    title: string
    description: string
    open: boolean
    value: string
    onOpenChange: (open: boolean) => void
    onValueChange: (value: string) => void
    onRename: () => void
}

export function RenameDialog({ title, description, open, value, onOpenChange, onValueChange, onRename }: RenameDialogProps) {
    const handleValueChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value), [onValueChange])

    return (
        <ModalDialog open={open} title={title} description={description} onOpenChange={onOpenChange}>
            <Stack gap="md">
                <TextField label={title} value={value} onChange={handleValueChange} />
                <Button icon={<Pencil size={15} />} variant="primary" onClick={onRename} fullWidth>
                    Rename
                </Button>
            </Stack>
        </ModalDialog>
    )
}

function stringFrom(value: unknown, fallback = "") {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    return fallback
}
