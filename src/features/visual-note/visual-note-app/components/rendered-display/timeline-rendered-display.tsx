"use client"

import { Pencil, Plus } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
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
    const addTimelineEvent = () => {
        const nextEvents = [...timelineEvents, { label: "New event", date: "", time: "" }]
        onDataChange({ ...data, events: nextEvents })
        setEditingTimelineEventIndex(nextEvents.length - 1)
    }
    const updateTimelineEvent = (index: number, key: string, value: string) => onDataChange({ ...data, events: replaceObjectAt(timelineEvents, index, { [key]: value }) })
    const removeTimelineEvent = (index: number) => {
        onDataChange({ ...data, events: timelineEvents.filter((_, itemIndex) => itemIndex !== index) })
        setEditingTimelineEventIndex(current => (current === null || current === index ? null : current > index ? current - 1 : current))
    }

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
                        <MotionStack
                            key={`${index}-${eventItem.label}-${eventItem.date}-${eventItem.time}`}
                            className={styles.timelineItem}
                            gap="sm"
                            initial={{ opacity: 0, y: 30, scale: 0.965, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -10, scale: 0.97, filter: "blur(2px)" }}
                            transition={timelineItemRevealTransition(index)}
                            layout
                        >
                            {editingTimelineEventIndex === index ? (
                                <Stack gap="md">
                                    <Grid columns="two">
                                        <TextField label="Label" value={stringFrom(eventItem.label)} onChange={event => updateTimelineEvent(index, "label", event.target.value)} />
                                        <DateField label="Date" value={dateInputValue(eventItem.date)} onChange={event => updateTimelineEvent(index, "date", event.target.value)} />
                                        <TimeField label="Time" value={timeInputValue(eventItem.time)} onChange={event => updateTimelineEvent(index, "time", event.target.value)} />
                                    </Grid>
                                    <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                                        <Button variant="ghost" onClick={() => setEditingTimelineEventIndex(null)}>
                                            Done
                                        </Button>
                                        <Button variant="danger" onClick={() => removeTimelineEvent(index)}>
                                            Delete Event
                                        </Button>
                                    </Stack>
                                </Stack>
                            ) : (
                                <TimelineEventSummary eventItem={eventItem} isReadOnly={isReadOnly} onEdit={() => setEditingTimelineEventIndex(index)} />
                            )}
                        </MotionStack>
                    ))}
                </AnimatePresence>
            </Stack>
        </Stack>
    )
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
