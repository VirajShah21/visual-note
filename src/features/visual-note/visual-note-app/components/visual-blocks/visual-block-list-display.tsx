"use client"

import { CheckCircle2, Clock, ShoppingCart, Vote } from "lucide-react"
import { type CSSProperties, type ReactNode, useCallback } from "react"
import {
    DataTextField,
    EditableVisualBlock,
    Grid,
    Heading,
    ObjectListActionButton,
    ObjectListAddButton,
    ObjectListDateField,
    ObjectListNumberField,
    ObjectListRemoveButton,
    ObjectListTextField,
    ObjectListTimeField,
    Pill,
    Stack,
    Text,
} from "@/components/ui"
import type { ObjectListHandlers } from "@/components/ui"
import type { VisualBlockData, VisualBlockKind } from "@/lib/visual-note/visual-blocks"
import { listCompletionText, packingListSummary, pollPreviewText, timelinePreviewText } from "@features/visual-note/visual-note-app/utils/visual-block-preview"
import {
    dateInputValue,
    numberFrom,
    objectArrayFrom,
    replaceObjectAt,
    stringFrom,
    timeInputValue,
    timelineEventsFromData,
} from "@features/visual-note/visual-note-app/utils/visual-note-app.utils"
import styles from "../../../visual-note-app.module.css"
import { defaultVisualListItem, VisualListItemFields } from "./visual-block-list-controls"
import { VisualBlockRecipeDisplay } from "./visual-block-recipe-display"

type VisualBlockListDisplayProps = {
    visualKind: Extract<VisualBlockKind, "recipe" | "timeline" | "poll" | "packing-list" | "shopping-list" | "task-list">
    data: VisualBlockData
    isReadOnly?: boolean
    onDataChange: (data: VisualBlockData) => void
}

export function VisualBlockListDisplay({ visualKind, data, isReadOnly = false, onDataChange }: VisualBlockListDisplayProps) {
    const updateField = useCallback((field: string, value: unknown) => onDataChange({ ...data, [field]: value }), [data, onDataChange])
    const updateObjectList = useCallback(
        (field: string, index: number, patch: Record<string, unknown>) => updateField(field, replaceObjectAt(objectArrayFrom(data[field]), index, patch)),
        [data, updateField],
    )
    const addObjectListItem = useCallback((field: string, value: Record<string, unknown>) => updateField(field, [...objectArrayFrom(data[field]), value]), [data, updateField])
    const removeObjectListItem = useCallback(
        (field: string, index: number) =>
            updateField(
                field,
                objectArrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index),
            ),
        [data, updateField],
    )
    const header = useCallback(
        (icon: ReactNode, title: string) => (
            <Stack className={styles.visualBlockHeader} direction="horizontal" gap="sm">
                <Pill>
                    {icon}
                    {title}
                </Pill>
            </Stack>
        ),
        [],
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

type VisualBlockListHandlers = ObjectListHandlers & {
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
}: { data: VisualBlockData } & VisualBlockListHandlers) {
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
            <DataTextField label="Title" field="title" value={stringFrom(data.title)} onUpdateField={onUpdateField} />
            <Stack className={styles.timelineTrack} gap="none">
                {timelineEventsFromData(data.events).map((eventItem, index) => (
                    <Stack key={`${index}-${eventItem.label}`} className={styles.timelineItem} gap="sm">
                        <Grid columns="three" gap="sm">
                            <ObjectListTextField
                                label="Label"
                                field="events"
                                index={index}
                                itemKey="label"
                                value={stringFrom(eventItem.label)}
                                onUpdateObjectList={onUpdateObjectList}
                            />
                            <ObjectListDateField
                                label="Date"
                                field="events"
                                index={index}
                                itemKey="date"
                                value={dateInputValue(eventItem.date)}
                                onUpdateObjectList={onUpdateObjectList}
                            />
                            <ObjectListTimeField
                                label="Time"
                                field="events"
                                index={index}
                                itemKey="time"
                                value={timeInputValue(eventItem.time)}
                                onUpdateObjectList={onUpdateObjectList}
                            />
                        </Grid>
                        <ObjectListRemoveButton field="events" index={index} onRemoveObjectListItem={onRemoveObjectListItem}>
                            Delete event
                        </ObjectListRemoveButton>
                    </Stack>
                ))}
            </Stack>
            <ObjectListAddButton field="events" value={{ label: "New event", date: "", time: "" }} onAddObjectListItem={onAddObjectListItem}>
                Add event
            </ObjectListAddButton>
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
}: { data: VisualBlockData } & VisualBlockListHandlers) {
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
            <DataTextField label="Question" field="question" value={stringFrom(data.question)} onUpdateField={onUpdateField} />
            <Stack gap="sm">
                {options.map((option, index) => {
                    const votes = numberFrom(option.votes, 0)
                    const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0

                    return (
                        <Stack key={`${index}-${option.label}`} className={styles.pollOption} gap="xs">
                            <Grid columns="two" gap="sm">
                                <ObjectListTextField
                                    label="Option"
                                    field="options"
                                    index={index}
                                    itemKey="label"
                                    value={stringFrom(option.label)}
                                    onUpdateObjectList={onUpdateObjectList}
                                />
                                <ObjectListNumberField label="Votes" field="options" index={index} itemKey="votes" value={String(votes)} onUpdateObjectList={onUpdateObjectList} />
                            </Grid>
                            <Stack className={styles.pollBar} style={{ "--poll-percent": `${percent}%` } as CSSProperties}>
                                <Text size="small">{`${percent}%`}</Text>
                            </Stack>
                            <Stack direction="horizontal" gap="sm" className={styles.wrapRow}>
                                <ObjectListActionButton field="options" index={index} patch={{ votes: votes + 1 }} onUpdateObjectList={onUpdateObjectList}>
                                    Add vote
                                </ObjectListActionButton>
                                <ObjectListRemoveButton field="options" index={index} onRemoveObjectListItem={onRemoveObjectListItem}>
                                    Delete option
                                </ObjectListRemoveButton>
                            </Stack>
                        </Stack>
                    )
                })}
            </Stack>
            <ObjectListAddButton field="options" value={{ label: "New option", votes: 0 }} onAddObjectListItem={onAddObjectListItem}>
                Add option
            </ObjectListAddButton>
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
}: { visualKind: VisualBlockListDisplayProps["visualKind"]; data: VisualBlockData } & VisualBlockListHandlers) {
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
            <DataTextField label="Title" field="title" value={stringFrom(data.title)} onUpdateField={onUpdateField} />
            <Stack gap="sm">
                {listItems.map((item, index) => (
                    <Stack key={`${index}-${item.title}-${item.name}-${item.label}`} className={styles.refinedItem} gap="sm">
                        <VisualListItemFields visualKind={visualKind} item={item} listField={listField} index={index} onUpdateObjectList={onUpdateObjectList} />
                        <ObjectListRemoveButton field={listField} index={index} onRemoveObjectListItem={onRemoveObjectListItem}>
                            Delete
                        </ObjectListRemoveButton>
                    </Stack>
                ))}
            </Stack>
            <ObjectListAddButton field={listField} value={defaultVisualListItem(visualKind)} onAddObjectListItem={onAddObjectListItem}>
                Add item
            </ObjectListAddButton>
        </EditableVisualBlock>
    )
}
