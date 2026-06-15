"use client"

import { Pencil, Plus } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { type ChangeEvent, useCallback, useState } from "react"
import { Button, DateField, Grid, Heading, Stack, Text, TimeField, TextField } from "@/components/ui"
import {
    dateInputValue,
    replaceObjectAt,
    stringFrom,
    timeInputValue,
    timelineEventsFromData,
    timelineItemRevealTransition,
    timelineScheduleText,
} from "../../utils/visual-note-app.utils"
import styles from "../../../visual-note-app.module.css"

const MotionStack = motion(Stack)

type TimelineRenderedDisplayProps = {
    displayName: string
    data: Record<string, unknown>
    isReadOnly: boolean
    onDataChange: (data: Record<string, unknown>) => void
}

export function TimelineRenderedDisplay({ displayName, data, isReadOnly, onDataChange }: TimelineRenderedDisplayProps) {
    const [editingTimelineEventIndex, setEditingTimelineEventIndex] = useState<number | null>(null)
    const timelineEvents = timelineEventsFromData(data.events)
    const addTimelineEvent = useCallback(() => {
        const nextEvents = [...timelineEvents, { label: "New event", date: "", time: "" }]
        onDataChange({ ...data, events: nextEvents })
        setEditingTimelineEventIndex(nextEvents.length - 1)
    }, [data, onDataChange, timelineEvents])
    const updateTimelineEvent = useCallback(
        (index: number, key: string, value: string) => onDataChange({ ...data, events: replaceObjectAt(timelineEvents, index, { [key]: value }) }),
        [data, onDataChange, timelineEvents],
    )
    const removeTimelineEvent = useCallback(
        (index: number) => {
            onDataChange({ ...data, events: timelineEvents.filter((_, itemIndex) => itemIndex !== index) })
            setEditingTimelineEventIndex(current => (current === null || current === index ? null : current > index ? current - 1 : current))
        },
        [data, onDataChange, timelineEvents],
    )
    const clearEditingTimelineEvent = useCallback(() => setEditingTimelineEventIndex(null), [])

    return (
        <Stack className={styles.timelineDisplay} gap="md">
            <Stack className={styles.toolbar} direction="horizontal" gap="sm">
                <Heading size="sm">{displayName}</Heading>
                {isReadOnly ? null : (
                    <Button icon={<Plus size={15} />} variant="secondary" onClick={addTimelineEvent}>
                        Add Event
                    </Button>
                )}
            </Stack>
            <Stack className={styles.timelineTrack} gap="none">
                <AnimatePresence mode="popLayout">
                    {timelineEvents.map((eventItem, index) => (
                        <TimelineEventItem
                            key={`${index}-${eventItem.label}-${eventItem.date}-${eventItem.time}`}
                            eventItem={eventItem}
                            index={index}
                            isReadOnly={isReadOnly}
                            isEditing={editingTimelineEventIndex === index}
                            onSetEditingTimelineEventIndex={setEditingTimelineEventIndex}
                            onDone={clearEditingTimelineEvent}
                            onRemove={removeTimelineEvent}
                            onUpdate={updateTimelineEvent}
                        />
                    ))}
                </AnimatePresence>
            </Stack>
        </Stack>
    )
}

type TimelineEventItemProps = {
    eventItem: Record<string, unknown>
    index: number
    isReadOnly: boolean
    isEditing: boolean
    onSetEditingTimelineEventIndex: (index: number) => void
    onDone: () => void
    onRemove: (index: number) => void
    onUpdate: (index: number, key: string, value: string) => void
}

function TimelineEventItem({ eventItem, index, isReadOnly, isEditing, onSetEditingTimelineEventIndex, onDone, onRemove, onUpdate }: TimelineEventItemProps) {
    const handleEdit = useCallback(() => onSetEditingTimelineEventIndex(index), [index, onSetEditingTimelineEventIndex])
    const handleRemove = useCallback(() => onRemove(index), [index, onRemove])

    return (
        <MotionStack
            className={styles.timelineItem}
            gap="sm"
            initial={{ opacity: 0, y: 30, scale: 0.965, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, scale: 0.97, filter: "blur(2px)" }}
            transition={timelineItemRevealTransition(index)}
            layout
        >
            {isEditing ? (
                <Stack gap="md">
                    <Grid columns="two">
                        <TimelineEventTextField label="Label" itemKey="label" index={index} value={stringFrom(eventItem.label)} onUpdate={onUpdate} />
                        <TimelineEventDateField label="Date" itemKey="date" index={index} value={dateInputValue(eventItem.date)} onUpdate={onUpdate} />
                        <TimelineEventTimeField label="Time" itemKey="time" index={index} value={timeInputValue(eventItem.time)} onUpdate={onUpdate} />
                    </Grid>
                    <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                        <Button variant="ghost" onClick={onDone}>
                            Done
                        </Button>
                        <Button variant="danger" onClick={handleRemove}>
                            Delete Event
                        </Button>
                    </Stack>
                </Stack>
            ) : (
                <TimelineEventSummary eventItem={eventItem} isReadOnly={isReadOnly} onEdit={handleEdit} />
            )}
        </MotionStack>
    )
}

type TimelineEventFieldProps = {
    label: string
    itemKey: string
    index: number
    value: string
    onUpdate: (index: number, key: string, value: string) => void
}

function TimelineEventTextField({ label, itemKey, index, value, onUpdate }: TimelineEventFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdate(index, itemKey, event.target.value), [index, itemKey, onUpdate])

    return <TextField label={label} value={value} onChange={handleChange} />
}

function TimelineEventDateField({ label, itemKey, index, value, onUpdate }: TimelineEventFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdate(index, itemKey, event.target.value), [index, itemKey, onUpdate])

    return <DateField label={label} value={value} onChange={handleChange} />
}

function TimelineEventTimeField({ label, itemKey, index, value, onUpdate }: TimelineEventFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdate(index, itemKey, event.target.value), [index, itemKey, onUpdate])

    return <TimeField label={label} value={value} onChange={handleChange} />
}

function TimelineEventSummary({ eventItem, isReadOnly, onEdit }: { eventItem: Record<string, unknown>; isReadOnly: boolean; onEdit: () => void }) {
    return (
        <Stack className={styles.toolbar} direction="horizontal" gap="sm">
            <Stack gap="xs">
                <Text tone="strong">{String(eventItem.label ?? "Event")}</Text>
                <Text size="small">{timelineScheduleText(eventItem)}</Text>
            </Stack>
            {isReadOnly ? null : (
                <Button icon={<Pencil size={14} />} variant="ghost" onClick={onEdit}>
                    Edit
                </Button>
            )}
        </Stack>
    )
}
