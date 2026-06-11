"use client"

import { Clock, ExternalLink as ExternalLinkIcon, Pencil, Plus } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { Button, ExternalLink, Grid, Heading, Pill, Stack, Text, TextAreaField, TextField } from "@/components/ui"
import { defaultListItems, objectArrayFrom, replaceObjectAt, stringFrom, timelineItemRevealTransition } from "../../utils/visual-note-app.utils"
import styles from "../../../visual-note-app.module.css"

const MotionStack = motion(Stack)

type WorkLogsRenderedDisplayProps = {
    data: Record<string, unknown>
    isReadOnly: boolean
    onDataChange: (data: Record<string, unknown>) => void
}

export function WorkLogsRenderedDisplay({ data, isReadOnly, onDataChange }: WorkLogsRenderedDisplayProps) {
    const [editingWorkLogIndex, setEditingWorkLogIndex] = useState<number | null>(null)
    const workLogs = objectArrayFrom(data.workLogs)
    const updateData = (nextData: Record<string, unknown>) => onDataChange(nextData)
    const addWorkLog = () => {
        const nextWorkLogs = [...workLogs, defaultListItems.workLog]
        updateData({ ...data, workLogs: nextWorkLogs })
        setEditingWorkLogIndex(nextWorkLogs.length - 1)
    }
    const updateWorkLog = (index: number, key: string, value: string) => updateData({ ...data, workLogs: replaceObjectAt(workLogs, index, { [key]: value }) })
    const removeWorkLog = (index: number) => {
        updateData({ ...data, workLogs: workLogs.filter((_, itemIndex) => itemIndex !== index) })
        setEditingWorkLogIndex(current => (current === null || current === index ? null : current > index ? current - 1 : current))
    }

    return (
        <Stack gap="md">
            {isReadOnly ? null : (
                <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                    <Button icon={<Plus size={15} />} variant="secondary" onClick={addWorkLog}>
                        Add Work Log
                    </Button>
                </Stack>
            )}
            <Stack className={styles.refinedList} gap="sm">
                <AnimatePresence mode="popLayout">
                    {workLogs.map((log, index) => (
                        <WorkLogItem
                            key={`${log.timestamp}-${log.title}`}
                            log={log}
                            index={index}
                            isReadOnly={isReadOnly}
                            isEditing={editingWorkLogIndex === index}
                            onEdit={() => setEditingWorkLogIndex(index)}
                            onDone={() => setEditingWorkLogIndex(null)}
                            onRemove={() => removeWorkLog(index)}
                            onUpdate={(key, value) => updateWorkLog(index, key, value)}
                        />
                    ))}
                </AnimatePresence>
            </Stack>
        </Stack>
    )
}

type WorkLogItemProps = {
    log: Record<string, unknown>
    index: number
    isReadOnly: boolean
    isEditing: boolean
    onEdit: () => void
    onDone: () => void
    onRemove: () => void
    onUpdate: (key: string, value: string) => void
}

function WorkLogItem({ log, index, isReadOnly, isEditing, onEdit, onDone, onRemove, onUpdate }: WorkLogItemProps) {
    const pullRequestUrl = stringFrom(log.pullRequestUrl)

    return (
        <MotionStack
            className={styles.refinedItem}
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
                        <TextField label="Timestamp" value={stringFrom(log.timestamp)} onChange={event => onUpdate("timestamp", event.target.value)} />
                        <TextField label="Time worked" value={stringFrom(log.timeWorked)} onChange={event => onUpdate("timeWorked", event.target.value)} />
                    </Grid>
                    <TextField label="Title" value={stringFrom(log.title)} onChange={event => onUpdate("title", event.target.value)} />
                    <TextAreaField label="Description" value={stringFrom(log.description)} onChange={event => onUpdate("description", event.target.value)} />
                    <TextField label="Pull request URL" value={stringFrom(log.pullRequestUrl)} onChange={event => onUpdate("pullRequestUrl", event.target.value)} />
                    <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                        <Button variant="ghost" onClick={onDone}>
                            Done
                        </Button>
                        <Button variant="danger" onClick={onRemove}>
                            Delete Work Log
                        </Button>
                    </Stack>
                </Stack>
            ) : (
                <WorkLogSummary log={log} isReadOnly={isReadOnly} onEdit={onEdit} />
            )}
            {isEditing ? null : <Text>{stringFrom(log.description, "No description provided.")}</Text>}
            {isEditing || !pullRequestUrl ? null : (
                <Stack className={styles.itemFooter} direction="horizontal" gap="sm">
                    <ExternalLink href={pullRequestUrl}>
                        <ExternalLinkIcon size={14} />
                        Pull request
                    </ExternalLink>
                </Stack>
            )}
        </MotionStack>
    )
}

function WorkLogSummary({ log, isReadOnly, onEdit }: { log: Record<string, unknown>; isReadOnly: boolean; onEdit: () => void }) {
    return (
        <Stack className={styles.itemHeader} direction="horizontal" gap="sm">
            <Stack gap="xs">
                <Heading size="sm">{stringFrom(log.title, "Work log")}</Heading>
                <Text size="small">{stringFrom(log.timestamp, "No timestamp")}</Text>
            </Stack>
            <Stack gap="xs" className={styles.wrapRow}>
                <Pill>
                    <Clock size={13} />
                    {stringFrom(log.timeWorked, "Time worked")}
                </Pill>
                {isReadOnly ? null : (
                    <Button icon={<Pencil size={14} />} variant="ghost" onClick={onEdit}>
                        Edit
                    </Button>
                )}
            </Stack>
        </Stack>
    )
}
