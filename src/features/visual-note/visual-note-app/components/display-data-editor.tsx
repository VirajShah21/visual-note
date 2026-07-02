"use client"

import { AnimatePresence, motion } from "motion/react"
import { useCallback } from "react"
import {
    Card,
    DataTextAreaField,
    DataTextField,
    Grid,
    Heading,
    ObjectAddButton,
    ObjectDateField,
    ObjectRemoveButton,
    ObjectTextField,
    ObjectTimeField,
    Stack,
    StringListEditorForField,
} from "@/components/ui"
import {
    arrayFrom,
    dateInputValue,
    objectArrayFrom,
    replaceObjectAt,
    replaceStringAt,
    stringFrom,
    timeInputValue,
    timelineEventsFromData,
    timelineItemRevealTransition,
} from "@features/visual-note/visual-note-app/utils/visual-note-app.utils"
import type { DisplayDataEditorProps } from "@features/visual-note/visual-note-app/types/visual-note-app.types"
import { BugsEditorSection, ShoppingItemsEditorSection, WorkLogsEditorSection } from "./display-data-editor-sections"

const MotionCard = motion(Card)

export function DisplayDataEditor({ display, onDataChange }: DisplayDataEditorProps) {
    const data = display.data
    const updateField = useCallback((field: string, value: string) => onDataChange({ ...data, [field]: value }), [data, onDataChange])
    const updateListItem = useCallback(
        (field: string, index: number, value: string) => onDataChange({ ...data, [field]: replaceStringAt(arrayFrom(data[field]), index, value) }),
        [data, onDataChange],
    )
    const addListItem = useCallback((field: string, value: string) => onDataChange({ ...data, [field]: [...arrayFrom(data[field]), value] }), [data, onDataChange])
    const removeListItem = useCallback(
        (field: string, index: number) => onDataChange({ ...data, [field]: arrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index) }),
        [data, onDataChange],
    )
    const updateObjectItem = useCallback(
        (field: string, index: number, key: string, value: string) => {
            onDataChange({ ...data, [field]: replaceObjectAt(objectArrayFrom(data[field]), index, { [key]: value }) })
        },
        [data, onDataChange],
    )
    const addObjectItem = useCallback(
        (field: string, item: Record<string, unknown>) => onDataChange({ ...data, [field]: [...objectArrayFrom(data[field]), item] }),
        [data, onDataChange],
    )
    const removeObjectItem = useCallback(
        (field: string, index: number) => onDataChange({ ...data, [field]: objectArrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index) }),
        [data, onDataChange],
    )

    if (display.kind === "data-card")
        return (
            <Stack gap="md">
                <DataTextField label="Label" field="label" value={stringFrom(data.label)} onUpdateField={updateField} />
                <DataTextField label="Value" field="value" value={stringFrom(data.value)} onUpdateField={updateField} />
            </Stack>
        )

    if (display.kind === "checklist")
        return (
            <StringListEditorForField
                title="Checklist items"
                items={arrayFrom(data.items)}
                label="Item"
                field="items"
                newItem="New checklist item"
                onAddListItem={addListItem}
                onUpdateListItem={updateListItem}
                onRemoveListItem={removeListItem}
            />
        )

    if (display.kind === "timeline")
        return (
            <Stack gap="md">
                <Heading size="sm">Events</Heading>
                <AnimatePresence mode="popLayout">
                    {timelineEventsFromData(data.events).map((eventItem, index) => (
                        <MotionCard
                            key={`${index}-${eventItem.label}-${eventItem.date}`}
                            padding="compact"
                            initial={{ opacity: 0, y: 24, scale: 0.965, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -10, scale: 0.97, filter: "blur(2px)" }}
                            transition={timelineItemRevealTransition(index)}
                        >
                            <Stack gap="md">
                                <Grid columns="two">
                                    <ObjectTextField
                                        label="Label"
                                        field="events"
                                        index={index}
                                        itemKey="label"
                                        value={stringFrom(eventItem.label)}
                                        onUpdateObjectItem={updateObjectItem}
                                    />
                                    <ObjectDateField
                                        label="Date"
                                        field="events"
                                        index={index}
                                        itemKey="date"
                                        value={dateInputValue(eventItem.date)}
                                        onUpdateObjectItem={updateObjectItem}
                                    />
                                    <ObjectTimeField
                                        label="Time"
                                        field="events"
                                        index={index}
                                        itemKey="time"
                                        value={timeInputValue(eventItem.time)}
                                        onUpdateObjectItem={updateObjectItem}
                                    />
                                </Grid>
                                <ObjectRemoveButton field="events" index={index} onRemoveObjectItem={removeObjectItem}>
                                    Delete Event
                                </ObjectRemoveButton>
                            </Stack>
                        </MotionCard>
                    ))}
                </AnimatePresence>
                <ObjectAddButton field="events" item={{ label: "New event", date: "", time: "" }} onAddObjectItem={addObjectItem}>
                    Add Event
                </ObjectAddButton>
            </Stack>
        )

    if (display.kind === "dashboard")
        return (
            <Stack gap="md">
                <Heading size="sm">Metrics</Heading>
                {objectArrayFrom(data.metrics).map((metric, index) => (
                    <Card key={`${index}-${metric.label}`} padding="compact">
                        <Stack gap="md">
                            <Grid columns="two">
                                <ObjectTextField
                                    label="Label"
                                    field="metrics"
                                    index={index}
                                    itemKey="label"
                                    value={stringFrom(metric.label)}
                                    onUpdateObjectItem={updateObjectItem}
                                />
                                <ObjectTextField
                                    label="Value"
                                    field="metrics"
                                    index={index}
                                    itemKey="value"
                                    value={stringFrom(metric.value)}
                                    onUpdateObjectItem={updateObjectItem}
                                />
                            </Grid>
                            <ObjectRemoveButton field="metrics" index={index} onRemoveObjectItem={removeObjectItem}>
                                Delete Metric
                            </ObjectRemoveButton>
                        </Stack>
                    </Card>
                ))}
                <ObjectAddButton field="metrics" item={{ label: "New metric", value: "0" }} onAddObjectItem={addObjectItem}>
                    Add Metric
                </ObjectAddButton>
            </Stack>
        )

    if (display.kind === "work-logs")
        return <WorkLogsEditorSection data={data} onAddObjectItem={addObjectItem} onRemoveObjectItem={removeObjectItem} onUpdateObjectItem={updateObjectItem} />

    if (display.kind === "bugs-list")
        return <BugsEditorSection data={data} onAddObjectItem={addObjectItem} onRemoveObjectItem={removeObjectItem} onUpdateObjectItem={updateObjectItem} />

    if (display.kind === "shopping-list")
        return <ShoppingItemsEditorSection data={data} onAddObjectItem={addObjectItem} onRemoveObjectItem={removeObjectItem} onUpdateObjectItem={updateObjectItem} />

    if (display.kind === "pull-request")
        return (
            <Stack gap="md">
                <DataTextField label="PR URL" field="prUrl" value={stringFrom(data.prUrl)} onUpdateField={updateField} />
                <Grid columns="two">
                    <DataTextField label="PR number or ID" field="prNumber" value={stringFrom(data.prNumber)} onUpdateField={updateField} />
                    <DataTextField label="Author" field="author" value={stringFrom(data.author)} onUpdateField={updateField} />
                    <DataTextField label="Reviewer" field="reviewer" value={stringFrom(data.reviewer)} onUpdateField={updateField} />
                </Grid>
                <DataTextField label="PR title" field="title" value={stringFrom(data.title)} onUpdateField={updateField} />
                <DataTextAreaField label="PR description" field="description" value={stringFrom(data.description)} onUpdateField={updateField} />
                <StringListEditorForField
                    title="Comments"
                    items={arrayFrom(data.comments)}
                    label="Comment"
                    field="comments"
                    newItem="New comment"
                    onAddListItem={addListItem}
                    onUpdateListItem={updateListItem}
                    onRemoveListItem={removeListItem}
                />
            </Stack>
        )

    if (display.kind === "url")
        return (
            <Stack gap="md">
                <DataTextField label="URL" field="url" value={stringFrom(data.url)} onUpdateField={updateField} />
                <DataTextField label="Page title" field="pageTitle" value={stringFrom(data.pageTitle)} onUpdateField={updateField} />
                <DataTextAreaField label="Page description" field="pageDescription" value={stringFrom(data.pageDescription)} onUpdateField={updateField} />
                <DataTextField label="Banner image" field="bannerImage" value={stringFrom(data.bannerImage)} onUpdateField={updateField} />
                <DataTextField label="Social preview image" field="socialPreviewImage" value={stringFrom(data.socialPreviewImage)} onUpdateField={updateField} />
                <DataTextField label="Favicon" field="favicon" value={stringFrom(data.favicon)} onUpdateField={updateField} />
                <StringListEditorForField
                    title="Keywords"
                    items={arrayFrom(data.keywords)}
                    label="Keyword"
                    field="keywords"
                    newItem="New keyword"
                    onAddListItem={addListItem}
                    onUpdateListItem={updateListItem}
                    onRemoveListItem={removeListItem}
                />
            </Stack>
        )

    return (
        <Stack gap="md">
            <DataTextAreaField label="Code" field="code" value={stringFrom(data.code)} onUpdateField={updateField} />
            <Grid columns="two">
                <DataTextField label="Language" field="language" value={stringFrom(data.language)} onUpdateField={updateField} />
                <DataTextField label="GitHub or external URL" field="sourceUrl" value={stringFrom(data.sourceUrl)} onUpdateField={updateField} />
            </Grid>
        </Stack>
    )
}
