"use client"

import { useCallback } from "react"
import { Grid, InlineObjectItems, ObjectListActionButton, ObjectListTextField } from "@/components/ui"
import type { ObjectListHandlers } from "@/components/ui"
import type { VisualBlockKind } from "@/lib/visual-note/visual-blocks"
import { objectArrayFrom, replaceObjectAt, stringFrom } from "@features/visual-note/visual-note-app/utils/visual-note-app.utils"

export type VisualBlockListKind = Extract<VisualBlockKind, "recipe" | "timeline" | "poll" | "packing-list" | "shopping-list" | "task-list">

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
