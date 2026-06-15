"use client"

import { type ChangeEvent, useCallback } from "react"
import { DateField, SelectField, TextAreaField, TextField, TimeField } from "@/components/ui"
import { InlineStringList } from "./inline-string-list"

type FieldControlProps = {
    label: string
    field: string
    value: string
    onUpdateField: (field: string, value: unknown) => void
}

export function VisualDataTextField({ label, field, value, onUpdateField }: FieldControlProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <TextField label={label} value={value} onChange={handleChange} />
}

export function VisualDataNumberField({ label, field, value, onUpdateField }: FieldControlProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, Number(event.target.value)), [field, onUpdateField])

    return <TextField label={label} type="number" value={value} onChange={handleChange} />
}

export function VisualDataTextAreaField({ label, field, value, onUpdateField }: FieldControlProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <TextAreaField label={label} value={value} onChange={handleChange} />
}

export function VisualDataDateField({ label, field, value, onUpdateField }: FieldControlProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <DateField label={label} value={value} onChange={handleChange} />
}

export function VisualDataTimeField({ label, field, value, onUpdateField }: FieldControlProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <TimeField label={label} value={value} onChange={handleChange} />
}

type SelectOption = {
    label: string
    value: string
}

type VisualDataSelectFieldProps = FieldControlProps & {
    className?: string
    options: SelectOption[]
}

export function VisualDataSelectField({ className, label, field, value, options, onUpdateField }: VisualDataSelectFieldProps) {
    const handleValueChange = useCallback((nextValue: string) => onUpdateField(field, nextValue), [field, onUpdateField])

    return <SelectField className={className} label={label} value={value} options={options} onValueChange={handleValueChange} />
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
