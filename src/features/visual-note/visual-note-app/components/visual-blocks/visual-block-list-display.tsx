"use client"

import { CheckCircle2, Clock, Plus, ShoppingCart, Vote } from "lucide-react"
import { type CSSProperties, type ReactNode } from "react"
import { Button, DateField, EditableVisualBlock, Grid, Heading, Pill, Stack, Text, TextField, TimeField } from "@/components/ui"
import type { VisualBlockData, VisualBlockKind } from "@/lib/visual-note/visual-blocks"
import { listCompletionText, packingListSummary, pollPreviewText, timelinePreviewText } from "../../utils/visual-block-preview"
import { dateInputValue, numberFrom, objectArrayFrom, replaceObjectAt, stringFrom, timeInputValue, timelineEventsFromData } from "../../utils/visual-note-app.utils"
import styles from "../../../visual-note-app.module.css"
import { InlineObjectItems } from "../inline-object-items"
import { VisualBlockRecipeDisplay } from "./visual-block-recipe-display"

type VisualBlockListDisplayProps = {
    visualKind: Extract<VisualBlockKind, "recipe" | "timeline" | "poll" | "packing-list" | "shopping-list" | "task-list">
    data: VisualBlockData
    isReadOnly?: boolean
    onDataChange: (data: VisualBlockData) => void
}

export function VisualBlockListDisplay({ visualKind, data, isReadOnly = false, onDataChange }: VisualBlockListDisplayProps) {
    const updateField = (field: string, value: unknown) => onDataChange({ ...data, [field]: value })
    const updateObjectList = (field: string, index: number, patch: Record<string, unknown>) => updateField(field, replaceObjectAt(objectArrayFrom(data[field]), index, patch))
    const addObjectListItem = (field: string, value: Record<string, unknown>) => updateField(field, [...objectArrayFrom(data[field]), value])
    const removeObjectListItem = (field: string, index: number) =>
        updateField(
            field,
            objectArrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index),
        )
    const header = (icon: ReactNode, title: string) => (
        <Stack className={styles.visualBlockHeader} direction="horizontal" gap="sm">
            <Pill>
                {icon}
                {title}
            </Pill>
        </Stack>
    )

    if (visualKind === "recipe") return <VisualBlockRecipeDisplay data={data} isReadOnly={isReadOnly} onDataChange={onDataChange} header={header} />

    if (visualKind === "timeline")
        return (
            <TimelineVisualBlock
                data={data}
                onUpdateField={updateField}
                onUpdateObjectList={updateObjectList}
                onAddObjectListItem={addObjectListItem}
                onRemoveObjectListItem={removeObjectListItem}
                header={header}
                isReadOnly={isReadOnly}
            />
        )

    if (visualKind === "poll")
        return (
            <PollVisualBlock
                data={data}
                onUpdateField={updateField}
                onUpdateObjectList={updateObjectList}
                onAddObjectListItem={addObjectListItem}
                onRemoveObjectListItem={removeObjectListItem}
                header={header}
                isReadOnly={isReadOnly}
            />
        )

    return (
        <ChecklistVisualBlock
            visualKind={visualKind}
            data={data}
            onUpdateField={updateField}
            onUpdateObjectList={updateObjectList}
            onAddObjectListItem={addObjectListItem}
            onRemoveObjectListItem={removeObjectListItem}
            header={header}
            isReadOnly={isReadOnly}
        />
    )
}

type ObjectListHandlers = {
    onUpdateField: (field: string, value: unknown) => void
    onUpdateObjectList: (field: string, index: number, patch: Record<string, unknown>) => void
    onAddObjectListItem: (field: string, value: Record<string, unknown>) => void
    onRemoveObjectListItem: (field: string, index: number) => void
    header: (icon: ReactNode, title: string) => ReactNode
    isReadOnly: boolean
}

function TimelineVisualBlock({
    data,
    onUpdateField,
    onUpdateObjectList,
    onAddObjectListItem,
    onRemoveObjectListItem,
    header,
    isReadOnly,
}: { data: VisualBlockData } & ObjectListHandlers) {
    const preview = (
        <>
            {header(<Clock size={13} />, "Timeline")}
            <Stack className={styles.heroPanel} gap="xs">
                <Heading size="md">{stringFrom(data.title, "Timeline")}</Heading>
                <Text>{timelinePreviewText(data)}</Text>
            </Stack>
        </>
    )

    return (
        <EditableVisualBlock preview={preview} readOnly={isReadOnly}>
            <TextField label="Title" value={stringFrom(data.title)} onChange={event => onUpdateField("title", event.target.value)} />
            <Stack className={styles.timelineTrack} gap="none">
                {timelineEventsFromData(data.events).map((eventItem, index) => (
                    <Stack key={`${index}-${eventItem.label}`} className={styles.timelineItem} gap="sm">
                        <Grid columns="three" gap="sm">
                            <TextField label="Label" value={stringFrom(eventItem.label)} onChange={event => onUpdateObjectList("events", index, { label: event.target.value })} />
                            <DateField label="Date" value={dateInputValue(eventItem.date)} onChange={event => onUpdateObjectList("events", index, { date: event.target.value })} />
                            <TimeField label="Time" value={timeInputValue(eventItem.time)} onChange={event => onUpdateObjectList("events", index, { time: event.target.value })} />
                        </Grid>
                        <Button variant="ghost" onClick={() => onRemoveObjectListItem("events", index)}>
                            Delete event
                        </Button>
                    </Stack>
                ))}
            </Stack>
            <Button icon={<Plus size={15} />} variant="ghost" onClick={() => onAddObjectListItem("events", { label: "New event", date: "", time: "" })}>
                Add event
            </Button>
        </EditableVisualBlock>
    )
}

function PollVisualBlock({
    data,
    onUpdateField,
    onUpdateObjectList,
    onAddObjectListItem,
    onRemoveObjectListItem,
    header,
    isReadOnly,
}: { data: VisualBlockData } & ObjectListHandlers) {
    const options = objectArrayFrom(data.options)
    const totalVotes = options.reduce((total, option) => total + numberFrom(option.votes, 0), 0)
    const preview = (
        <>
            {header(<Vote size={13} />, "Poll")}
            <Stack className={styles.heroPanel} gap="xs">
                <Heading size="md">{stringFrom(data.question, "Poll question")}</Heading>
                <Text>{pollPreviewText(data)}</Text>
            </Stack>
        </>
    )

    return (
        <EditableVisualBlock preview={preview} readOnly={isReadOnly}>
            <TextField label="Question" value={stringFrom(data.question)} onChange={event => onUpdateField("question", event.target.value)} />
            <Stack gap="sm">
                {options.map((option, index) => {
                    const votes = numberFrom(option.votes, 0)
                    const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0

                    return (
                        <Stack key={`${index}-${option.label}`} className={styles.pollOption} gap="xs">
                            <Grid columns="two" gap="sm">
                                <TextField
                                    label="Option"
                                    value={stringFrom(option.label)}
                                    onChange={event => onUpdateObjectList("options", index, { label: event.target.value })}
                                />
                                <TextField
                                    label="Votes"
                                    type="number"
                                    value={String(votes)}
                                    onChange={event => onUpdateObjectList("options", index, { votes: Number(event.target.value) })}
                                />
                            </Grid>
                            <Stack className={styles.pollBar} style={{ "--poll-percent": `${percent}%` } as CSSProperties}>
                                <Text size="small">{`${percent}%`}</Text>
                            </Stack>
                            <Stack direction="horizontal" gap="sm" className={styles.wrapRow}>
                                <Button variant="ghost" onClick={() => onUpdateObjectList("options", index, { votes: votes + 1 })}>
                                    Add vote
                                </Button>
                                <Button variant="ghost" onClick={() => onRemoveObjectListItem("options", index)}>
                                    Delete option
                                </Button>
                            </Stack>
                        </Stack>
                    )
                })}
            </Stack>
            <Button icon={<Plus size={15} />} variant="ghost" onClick={() => onAddObjectListItem("options", { label: "New option", votes: 0 })}>
                Add option
            </Button>
        </EditableVisualBlock>
    )
}

function ChecklistVisualBlock({
    visualKind,
    data,
    onUpdateField,
    onUpdateObjectList,
    onAddObjectListItem,
    onRemoveObjectListItem,
    header,
    isReadOnly,
}: { visualKind: VisualBlockListDisplayProps["visualKind"]; data: VisualBlockData } & ObjectListHandlers) {
    const listField = visualKind === "packing-list" ? "sections" : visualKind === "shopping-list" ? "items" : "tasks"
    const listItems = objectArrayFrom(data[listField])
    const title = visualKind === "packing-list" ? "Packing List" : visualKind === "shopping-list" ? "Shopping List" : "Task List"
    const icon = visualKind === "shopping-list" ? <ShoppingCart size={13} /> : <CheckCircle2 size={13} />
    const summary =
        visualKind === "packing-list"
            ? packingListSummary(data)
            : listCompletionText(listItems, visualKind === "task-list" ? "done" : "purchased", visualKind === "task-list" ? "task" : "item")
    const preview = (
        <>
            {header(icon, title)}
            <Stack className={styles.heroPanel} gap="xs">
                <Heading size="md">{stringFrom(data.title, title)}</Heading>
                <Text>{summary}</Text>
            </Stack>
        </>
    )

    return (
        <EditableVisualBlock preview={preview} readOnly={isReadOnly}>
            <TextField label="Title" value={stringFrom(data.title)} onChange={event => onUpdateField("title", event.target.value)} />
            <Stack gap="sm">
                {listItems.map((item, index) => (
                    <Stack key={`${index}-${item.title}-${item.name}-${item.label}`} className={styles.refinedItem} gap="sm">
                        <ListItemFields visualKind={visualKind} item={item} listField={listField} index={index} onUpdateObjectList={onUpdateObjectList} />
                        <Button variant="ghost" onClick={() => onRemoveObjectListItem(listField, index)}>
                            Delete
                        </Button>
                    </Stack>
                ))}
            </Stack>
            <Button icon={<Plus size={15} />} variant="ghost" onClick={() => onAddObjectListItem(listField, defaultVisualListItem(visualKind))}>
                Add item
            </Button>
        </EditableVisualBlock>
    )
}

function ListItemFields({
    visualKind,
    item,
    listField,
    index,
    onUpdateObjectList,
}: {
    visualKind: VisualBlockListDisplayProps["visualKind"]
    item: Record<string, unknown>
    listField: string
    index: number
    onUpdateObjectList: ObjectListHandlers["onUpdateObjectList"]
}) {
    if (visualKind === "packing-list")
        return (
            <>
                <TextField label="Section" value={stringFrom(item.title)} onChange={event => onUpdateObjectList(listField, index, { title: event.target.value })} />
                <InlineObjectItems
                    items={objectArrayFrom(item.items)}
                    onAdd={() => onUpdateObjectList(listField, index, { items: [...objectArrayFrom(item.items), { label: "New item", packed: false }] })}
                    onChange={(itemIndex, patch) => onUpdateObjectList(listField, index, { items: replaceObjectAt(objectArrayFrom(item.items), itemIndex, patch) })}
                    onRemove={itemIndex => onUpdateObjectList(listField, index, { items: objectArrayFrom(item.items).filter((_, nestedIndex) => nestedIndex !== itemIndex) })}
                />
            </>
        )

    return (
        <Grid columns="three" gap="sm">
            <TextField
                label={visualKind === "task-list" ? "Task" : "Item"}
                value={stringFrom(item.title || item.name)}
                onChange={event => onUpdateObjectList(listField, index, visualKind === "task-list" ? { title: event.target.value } : { name: event.target.value })}
            />
            <TextField
                label={visualKind === "task-list" ? "Owner" : "Quantity"}
                value={stringFrom(item.owner || item.quantity)}
                onChange={event => onUpdateObjectList(listField, index, visualKind === "task-list" ? { owner: event.target.value } : { quantity: event.target.value })}
            />
            <Button
                variant={item.done || item.purchased ? "primary" : "ghost"}
                onClick={() => onUpdateObjectList(listField, index, visualKind === "task-list" ? { done: !Boolean(item.done) } : { purchased: !Boolean(item.purchased) })}
            >
                {item.done || item.purchased ? "Done" : "Open"}
            </Button>
        </Grid>
    )
}

const defaultVisualListItem = (visualKind: VisualBlockListDisplayProps["visualKind"]) => {
    if (visualKind === "task-list") return { title: "New task", done: false, dueDate: "", owner: "" }
    if (visualKind === "shopping-list") return { name: "New item", quantity: "", purchased: false }
    return { title: "New section", items: [] }
}
