"use client"

import { Plus } from "lucide-react"
import { type ChangeEvent, type ReactNode, useCallback } from "react"
import { Button } from "./button"
import { DateField, SelectField, TextAreaField, TextField, TimeField } from "./form-controls"

type SelectOption = {
    label: string
    value: string
}

type DataFieldProps = {
    label: string
    field: string
    value: string
    onUpdateField: (field: string, value: string) => void
}

type DataNumberFieldProps = Omit<DataFieldProps, "onUpdateField"> & {
    onUpdateField: (field: string, value: number) => void
}

type DataSelectFieldProps = Omit<DataFieldProps, "onUpdateField"> & {
    className?: string
    options: SelectOption[]
    onUpdateField: (field: string, value: string) => void
}

export function DataTextField({ label, field, value, onUpdateField }: DataFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <TextField label={label} value={value} onChange={handleChange} />
}

export function DataNumberField({ label, field, value, onUpdateField }: DataNumberFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, Number(event.target.value)), [field, onUpdateField])

    return <TextField label={label} type="number" value={value} onChange={handleChange} />
}

export function DataTextAreaField({ label, field, value, onUpdateField }: DataFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <TextAreaField label={label} value={value} onChange={handleChange} />
}

export function DataDateField({ label, field, value, onUpdateField }: DataFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <DateField label={label} value={value} onChange={handleChange} />
}

export function DataTimeField({ label, field, value, onUpdateField }: DataFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <TimeField label={label} value={value} onChange={handleChange} />
}

export function DataSelectField({ className, label, field, value, options, onUpdateField }: DataSelectFieldProps) {
    const handleValueChange = useCallback((nextValue: string) => onUpdateField(field, nextValue), [field, onUpdateField])

    return <SelectField className={className} label={label} value={value} options={options} onValueChange={handleValueChange} />
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

export type ObjectListHandlers = {
    onUpdateField: (field: string, value: unknown) => void
    onUpdateObjectList: (field: string, index: number, patch: Record<string, unknown>) => void
    onAddObjectListItem: (field: string, value: Record<string, unknown>) => void
    onRemoveObjectListItem: (field: string, index: number) => void
}

type ObjectListFieldProps = {
    label: string
    field: string
    index: number
    itemKey: string
    value: string
    onUpdateObjectList: ObjectListHandlers["onUpdateObjectList"]
}

export function ObjectListTextField({ label, field, index, itemKey, value, onUpdateObjectList }: ObjectListFieldProps) {
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => onUpdateObjectList(field, index, { [itemKey]: event.target.value }),
        [field, index, itemKey, onUpdateObjectList],
    )

    return <TextField label={label} value={value} onChange={handleChange} />
}

export function ObjectListNumberField({ label, field, index, itemKey, value, onUpdateObjectList }: ObjectListFieldProps) {
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => onUpdateObjectList(field, index, { [itemKey]: Number(event.target.value) }),
        [field, index, itemKey, onUpdateObjectList],
    )

    return <TextField label={label} type="number" value={value} onChange={handleChange} />
}

export function ObjectListDateField({ label, field, index, itemKey, value, onUpdateObjectList }: ObjectListFieldProps) {
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => onUpdateObjectList(field, index, { [itemKey]: event.target.value }),
        [field, index, itemKey, onUpdateObjectList],
    )

    return <DateField label={label} value={value} onChange={handleChange} />
}

export function ObjectListTimeField({ label, field, index, itemKey, value, onUpdateObjectList }: ObjectListFieldProps) {
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => onUpdateObjectList(field, index, { [itemKey]: event.target.value }),
        [field, index, itemKey, onUpdateObjectList],
    )

    return <TimeField label={label} value={value} onChange={handleChange} />
}

type ObjectListActionButtonProps = {
    field: string
    index: number
    patch: Record<string, unknown>
    variant?: "primary" | "ghost"
    children: ReactNode
    onUpdateObjectList: ObjectListHandlers["onUpdateObjectList"]
}

export function ObjectListActionButton({ field, index, patch, variant = "ghost", children, onUpdateObjectList }: ObjectListActionButtonProps) {
    const handleClick = useCallback(() => onUpdateObjectList(field, index, patch), [field, index, patch, onUpdateObjectList])

    return (
        <Button variant={variant} onClick={handleClick}>
            {children}
        </Button>
    )
}

type ObjectListRemoveButtonProps = {
    field: string
    index: number
    children: ReactNode
    onRemoveObjectListItem: ObjectListHandlers["onRemoveObjectListItem"]
}

export function ObjectListRemoveButton({ field, index, children, onRemoveObjectListItem }: ObjectListRemoveButtonProps) {
    const handleClick = useCallback(() => onRemoveObjectListItem(field, index), [field, index, onRemoveObjectListItem])

    return (
        <Button variant="ghost" onClick={handleClick}>
            {children}
        </Button>
    )
}

type ObjectListAddButtonProps = {
    field: string
    value: Record<string, unknown>
    children: ReactNode
    onAddObjectListItem: ObjectListHandlers["onAddObjectListItem"]
}

export function ObjectListAddButton({ field, value, children, onAddObjectListItem }: ObjectListAddButtonProps) {
    const handleClick = useCallback(() => onAddObjectListItem(field, value), [field, value, onAddObjectListItem])

    return (
        <Button icon={<Plus size={15} />} variant="ghost" onClick={handleClick}>
            {children}
        </Button>
    )
}
