"use client"

import { Plus } from "lucide-react"
import { type ChangeEvent, type ReactNode, useCallback } from "react"
import { Button, DateField, Grid, TextField, TimeField } from "@/components/ui"
import type { VisualBlockKind } from "@/lib/visual-note/visual-blocks"
import { objectArrayFrom, replaceObjectAt, stringFrom } from "../../utils/visual-note-app.utils"
import { InlineObjectItems } from "../inline-object-items"

export type VisualBlockListKind = Extract<VisualBlockKind, "recipe" | "timeline" | "poll" | "packing-list" | "shopping-list" | "task-list">

export type ObjectListHandlers = {
    onUpdateField: (field: string, value: unknown) => void
    onUpdateObjectList: (field: string, index: number, patch: Record<string, unknown>) => void
    onAddObjectListItem: (field: string, value: Record<string, unknown>) => void
    onRemoveObjectListItem: (field: string, index: number) => void
}

type FieldUpdateProps = {
    label: string
    field: string
    value: string
    onUpdateField: ObjectListHandlers["onUpdateField"]
}

export function VisualBlockField({ label, field, value, onUpdateField }: FieldUpdateProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdateField(field, event.target.value), [field, onUpdateField])

    return <TextField label={label} value={value} onChange={handleChange} />
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

type PackingSectionItemsEditorProps = {
    field: string
    index: number
    item: Record<string, unknown>
    onUpdateObjectList: ObjectListHandlers["onUpdateObjectList"]
}

export function PackingSectionItemsEditor({ field, index, item, onUpdateObjectList }: PackingSectionItemsEditorProps) {
    const items = objectArrayFrom(item.items)
    const handleAdd = useCallback(() => onUpdateObjectList(field, index, { items: [...items, { label: "New item", packed: false }] }), [field, index, items, onUpdateObjectList])
    const handleChange = useCallback(
        (itemIndex: number, patch: Record<string, unknown>) => onUpdateObjectList(field, index, { items: replaceObjectAt(items, itemIndex, patch) }),
        [field, index, items, onUpdateObjectList],
    )
    const handleRemove = useCallback(
        (itemIndex: number) =>
            onUpdateObjectList(field, index, {
                items: items.filter((_, nestedIndex) => nestedIndex !== itemIndex),
            }),
        [field, index, items, onUpdateObjectList],
    )

    return <InlineObjectItems items={items} onAdd={handleAdd} onChange={handleChange} onRemove={handleRemove} />
}

type VisualListItemFieldsProps = {
    visualKind: VisualBlockListKind
    item: Record<string, unknown>
    listField: string
    index: number
    onUpdateObjectList: ObjectListHandlers["onUpdateObjectList"]
}

export function VisualListItemFields({ visualKind, item, listField, index, onUpdateObjectList }: VisualListItemFieldsProps) {
    if (visualKind === "packing-list")
        return (
            <>
                <ObjectListTextField label="Section" field={listField} index={index} itemKey="title" value={stringFrom(item.title)} onUpdateObjectList={onUpdateObjectList} />
                <PackingSectionItemsEditor field={listField} index={index} item={item} onUpdateObjectList={onUpdateObjectList} />
            </>
        )

    return (
        <Grid columns="three" gap="sm">
            <ObjectListTextField
                label={visualKind === "task-list" ? "Task" : "Item"}
                field={listField}
                index={index}
                itemKey={visualKind === "task-list" ? "title" : "name"}
                value={stringFrom(item.title || item.name)}
                onUpdateObjectList={onUpdateObjectList}
            />
            <ObjectListTextField
                label={visualKind === "task-list" ? "Owner" : "Quantity"}
                field={listField}
                index={index}
                itemKey={visualKind === "task-list" ? "owner" : "quantity"}
                value={stringFrom(item.owner || item.quantity)}
                onUpdateObjectList={onUpdateObjectList}
            />
            <ObjectListActionButton
                field={listField}
                index={index}
                patch={visualKind === "task-list" ? { done: !Boolean(item.done) } : { purchased: !Boolean(item.purchased) }}
                variant={item.done || item.purchased ? "primary" : "ghost"}
                onUpdateObjectList={onUpdateObjectList}
            >
                {item.done || item.purchased ? "Done" : "Open"}
            </ObjectListActionButton>
        </Grid>
    )
}

export const defaultVisualListItem = (visualKind: VisualBlockListKind) => {
    if (visualKind === "task-list") return { title: "New task", done: false, dueDate: "", owner: "" }
    if (visualKind === "shopping-list") return { name: "New item", quantity: "", purchased: false }
    return { title: "New section", items: [] }
}
