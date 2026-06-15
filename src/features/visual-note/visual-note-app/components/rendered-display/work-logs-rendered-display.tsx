"use client"

import { Clock, ExternalLink as ExternalLinkIcon, Pencil, Plus } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { type ChangeEvent, useCallback, useState } from "react"
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
    const updateData = useCallback((nextData: Record<string, unknown>) => onDataChange(nextData), [onDataChange])
    const addWorkLog = useCallback(() => {
        const nextWorkLogs = [...workLogs, defaultListItems.workLog]
        updateData({ ...data, workLogs: nextWorkLogs })
        setEditingWorkLogIndex(nextWorkLogs.length - 1)
    }, [data, updateData, workLogs])
    const updateWorkLog = useCallback(
        (index: number, key: string, value: string) => updateData({ ...data, workLogs: replaceObjectAt(workLogs, index, { [key]: value }) }),
        [data, updateData, workLogs],
    )
    const removeWorkLog = useCallback(
        (index: number) => {
            updateData({ ...data, workLogs: workLogs.filter((_, itemIndex) => itemIndex !== index) })
            setEditingWorkLogIndex(current => (current === null || current === index ? null : current > index ? current - 1 : current))
        },
        [data, updateData, workLogs],
    )
    const clearEditingWorkLog = useCallback(() => setEditingWorkLogIndex(null), [])

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
                            onSetEditingWorkLogIndex={setEditingWorkLogIndex}
                            onDone={clearEditingWorkLog}
                            onRemove={removeWorkLog}
                            onUpdate={updateWorkLog}
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
    onSetEditingWorkLogIndex: (index: number) => void
    onDone: () => void
    onRemove: (index: number) => void
    onUpdate: (index: number, key: string, value: string) => void
}

function WorkLogItem({ log, index, isReadOnly, isEditing, onSetEditingWorkLogIndex, onDone, onRemove, onUpdate }: WorkLogItemProps) {
    const pullRequestUrl = stringFrom(log.pullRequestUrl)
    const handleEdit = useCallback(() => onSetEditingWorkLogIndex(index), [index, onSetEditingWorkLogIndex])
    const handleRemove = useCallback(() => onRemove(index), [index, onRemove])

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
                        <WorkLogTextField label="Timestamp" itemKey="timestamp" index={index} value={stringFrom(log.timestamp)} onUpdate={onUpdate} />
                        <WorkLogTextField label="Time worked" itemKey="timeWorked" index={index} value={stringFrom(log.timeWorked)} onUpdate={onUpdate} />
                    </Grid>
                    <WorkLogTextField label="Title" itemKey="title" index={index} value={stringFrom(log.title)} onUpdate={onUpdate} />
                    <WorkLogTextAreaField label="Description" itemKey="description" index={index} value={stringFrom(log.description)} onUpdate={onUpdate} />
                    <WorkLogTextField label="Pull request URL" itemKey="pullRequestUrl" index={index} value={stringFrom(log.pullRequestUrl)} onUpdate={onUpdate} />
                    <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                        <Button variant="ghost" onClick={onDone}>
                            Done
                        </Button>
                        <Button variant="danger" onClick={handleRemove}>
                            Delete Work Log
                        </Button>
                    </Stack>
                </Stack>
            ) : (
                <WorkLogSummary log={log} isReadOnly={isReadOnly} onEdit={handleEdit} />
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

type WorkLogFieldProps = {
    label: string
    itemKey: string
    index: number
    value: string
    onUpdate: (index: number, key: string, value: string) => void
}

function WorkLogTextField({ label, itemKey, index, value, onUpdate }: WorkLogFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onUpdate(index, itemKey, event.target.value), [index, itemKey, onUpdate])

    return <TextField label={label} value={value} onChange={handleChange} />
}

function WorkLogTextAreaField({ label, itemKey, index, value, onUpdate }: WorkLogFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => onUpdate(index, itemKey, event.target.value), [index, itemKey, onUpdate])

    return <TextAreaField label={label} value={value} onChange={handleChange} />
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
