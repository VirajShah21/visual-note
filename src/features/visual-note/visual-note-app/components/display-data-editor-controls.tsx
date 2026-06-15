"use client"

import { Plus } from "lucide-react"
import { type ChangeEvent, type ReactNode, useCallback } from "react"
import { Button, DateField, TextAreaField, TextField, TimeField } from "@/components/ui"
import { StringListEditor } from "./string-list-editor"

type DataFieldProps = {
    label: string
    field: string
    value: string
    onUpdateField: (field: string, value: string) => void
}

export function DataTextField({ label, field, value, onUpdateField }: DataFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <TextField label={label} value={value} onChange={handleChange} />
}

export function DataTextAreaField({ label, field, value, onUpdateField }: DataFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <TextAreaField label={label} value={value} onChange={handleChange} />
}

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

type ObjectFieldProps = {
    label: string
    field: string
    index: number
    itemKey: string
    value: string
    onUpdateObjectItem: (field: string, index: number, key: string, value: string) => void
}

export function ObjectTextField({ label, field, index, itemKey, value, onUpdateObjectItem }: ObjectFieldProps) {
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => onUpdateObjectItem(field, index, itemKey, event.target.value),
        [field, index, itemKey, onUpdateObjectItem],
    )

    return <TextField label={label} value={value} onChange={handleChange} />
}

export function ObjectDateField({ label, field, index, itemKey, value, onUpdateObjectItem }: ObjectFieldProps) {
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => onUpdateObjectItem(field, index, itemKey, event.target.value),
        [field, index, itemKey, onUpdateObjectItem],
    )

    return <DateField label={label} value={value} onChange={handleChange} />
}

export function ObjectTimeField({ label, field, index, itemKey, value, onUpdateObjectItem }: ObjectFieldProps) {
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => onUpdateObjectItem(field, index, itemKey, event.target.value),
        [field, index, itemKey, onUpdateObjectItem],
    )

    return <TimeField label={label} value={value} onChange={handleChange} />
}

export function ObjectTextAreaField({ label, field, index, itemKey, value, onUpdateObjectItem }: ObjectFieldProps) {
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => onUpdateObjectItem(field, index, itemKey, event.target.value),
        [field, index, itemKey, onUpdateObjectItem],
    )

    return <TextAreaField label={label} value={value} onChange={handleChange} />
}

type ObjectRemoveButtonProps = {
    field: string
    index: number
    children: ReactNode
    onRemoveObjectItem: (field: string, index: number) => void
}

export function ObjectRemoveButton({ field, index, children, onRemoveObjectItem }: ObjectRemoveButtonProps) {
    const handleClick = useCallback(() => onRemoveObjectItem(field, index), [field, index, onRemoveObjectItem])

    return (
        <Button variant="ghost" onClick={handleClick} fullWidth>
            {children}
        </Button>
    )
}

type ObjectAddButtonProps = {
    field: string
    item: Record<string, unknown>
    children: ReactNode
    onAddObjectItem: (field: string, item: Record<string, unknown>) => void
}

export function ObjectAddButton({ field, item, children, onAddObjectItem }: ObjectAddButtonProps) {
    const handleClick = useCallback(() => onAddObjectItem(field, item), [field, item, onAddObjectItem])

    return (
        <Button icon={<Plus size={15} />} onClick={handleClick} fullWidth>
            {children}
        </Button>
    )
}
