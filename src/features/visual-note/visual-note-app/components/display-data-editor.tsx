"use client"

import { Plus } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { Button, Card, DateField, Grid, Heading, Stack, TextAreaField, TextField, TimeField } from "@/components/ui"
import {
    arrayFrom,
    dateInputValue,
    defaultListItems,
    objectArrayFrom,
    replaceObjectAt,
    replaceStringAt,
    stringFrom,
    timeInputValue,
    timelineEventsFromData,
    timelineItemRevealTransition,
} from "../utils/visual-note-app.utils"
import type { DisplayDataEditorProps } from "../types/visual-note-app.types"
import { StringListEditor } from "./string-list-editor"

const MotionCard = motion(Card)

export function DisplayDataEditor({ display, onDataChange }: DisplayDataEditorProps) {
    const data = display.data
    const updateField = (field: string, value: string) => onDataChange({ ...data, [field]: value })
    const updateListItem = (field: string, index: number, value: string) => onDataChange({ ...data, [field]: replaceStringAt(arrayFrom(data[field]), index, value) })
    const addListItem = (field: string, value: string) => onDataChange({ ...data, [field]: [...arrayFrom(data[field]), value] })
    const removeListItem = (field: string, index: number) => onDataChange({ ...data, [field]: arrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index) })
    const updateObjectItem = (field: string, index: number, key: string, value: string) => {
        onDataChange({ ...data, [field]: replaceObjectAt(objectArrayFrom(data[field]), index, { [key]: value }) })
    }
    const addObjectItem = (field: string, item: Record<string, unknown>) => onDataChange({ ...data, [field]: [...objectArrayFrom(data[field]), item] })
    const removeObjectItem = (field: string, index: number) => onDataChange({ ...data, [field]: objectArrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index) })

    if (display.kind === "data-card")
        return (
            <Stack gap="md">
                <TextField label="Label" value={stringFrom(data.label)} onChange={event => updateField("label", event.target.value)} />
                <TextField label="Value" value={stringFrom(data.value)} onChange={event => updateField("value", event.target.value)} />
            </Stack>
        )

    if (display.kind === "checklist")
        return (
            <StringListEditor
                title="Checklist items"
                items={arrayFrom(data.items)}
                label="Item"
                onAdd={() => addListItem("items", "New checklist item")}
                onChange={(index, value) => updateListItem("items", index, value)}
                onRemove={index => removeListItem("items", index)}
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
                                    <TextField
                                        label="Label"
                                        value={stringFrom(eventItem.label)}
                                        onChange={event => updateObjectItem("events", index, "label", event.target.value)}
                                    />
                                    <DateField
                                        label="Date"
                                        value={dateInputValue(eventItem.date)}
                                        onChange={event => updateObjectItem("events", index, "date", event.target.value)}
                                    />
                                    <TimeField
                                        label="Time"
                                        value={timeInputValue(eventItem.time)}
                                        onChange={event => updateObjectItem("events", index, "time", event.target.value)}
                                    />
                                </Grid>
                                <Button variant="ghost" onClick={() => removeObjectItem("events", index)} fullWidth>
                                    Delete Event
                                </Button>
                            </Stack>
                        </MotionCard>
                    ))}
                </AnimatePresence>
                <Button icon={<Plus size={15} />} onClick={() => addObjectItem("events", { label: "New event", date: "", time: "" })} fullWidth>
                    Add Event
                </Button>
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
                                <TextField label="Label" value={stringFrom(metric.label)} onChange={event => updateObjectItem("metrics", index, "label", event.target.value)} />
                                <TextField label="Value" value={stringFrom(metric.value)} onChange={event => updateObjectItem("metrics", index, "value", event.target.value)} />
                            </Grid>
                            <Button variant="ghost" onClick={() => removeObjectItem("metrics", index)} fullWidth>
                                Delete Metric
                            </Button>
                        </Stack>
                    </Card>
                ))}
                <Button icon={<Plus size={15} />} onClick={() => addObjectItem("metrics", { label: "New metric", value: "0" })} fullWidth>
                    Add Metric
                </Button>
            </Stack>
        )

    if (display.kind === "work-logs")
        return (
            <Stack gap="md">
                <Heading size="sm">Work logs</Heading>
                {objectArrayFrom(data.workLogs).map((log, index) => (
                    <Card key={`${index}-${log.title}`} padding="compact">
                        <Stack gap="md">
                            <Grid columns="two">
                                <TextField
                                    label="Timestamp"
                                    value={stringFrom(log.timestamp)}
                                    onChange={event => updateObjectItem("workLogs", index, "timestamp", event.target.value)}
                                />
                                <TextField
                                    label="Time worked"
                                    value={stringFrom(log.timeWorked)}
                                    onChange={event => updateObjectItem("workLogs", index, "timeWorked", event.target.value)}
                                />
                            </Grid>
                            <TextField label="Title" value={stringFrom(log.title)} onChange={event => updateObjectItem("workLogs", index, "title", event.target.value)} />
                            <TextAreaField
                                label="Description"
                                value={stringFrom(log.description)}
                                onChange={event => updateObjectItem("workLogs", index, "description", event.target.value)}
                            />
                            <TextField
                                label="Pull request URL"
                                value={stringFrom(log.pullRequestUrl)}
                                onChange={event => updateObjectItem("workLogs", index, "pullRequestUrl", event.target.value)}
                            />
                            <Button variant="ghost" onClick={() => removeObjectItem("workLogs", index)} fullWidth>
                                Delete Work Log
                            </Button>
                        </Stack>
                    </Card>
                ))}
                <Button icon={<Plus size={15} />} onClick={() => addObjectItem("workLogs", defaultListItems.workLog)} fullWidth>
                    Add Work Log
                </Button>
            </Stack>
        )

    if (display.kind === "bugs-list")
        return (
            <Stack gap="md">
                <Heading size="sm">Bugs</Heading>
                {objectArrayFrom(data.bugs).map((bug, index) => (
                    <Card key={`${index}-${bug.title}`} padding="compact">
                        <Stack gap="md">
                            <Grid columns="two">
                                <TextField label="Title" value={stringFrom(bug.title)} onChange={event => updateObjectItem("bugs", index, "title", event.target.value)} />
                                <TextField label="Severity" value={stringFrom(bug.severity)} onChange={event => updateObjectItem("bugs", index, "severity", event.target.value)} />
                            </Grid>
                            <TextAreaField
                                label="Description"
                                value={stringFrom(bug.description)}
                                onChange={event => updateObjectItem("bugs", index, "description", event.target.value)}
                            />
                            <TextField
                                label="GitHub issue or Jira ticket URL"
                                value={stringFrom(bug.ticketUrl)}
                                onChange={event => updateObjectItem("bugs", index, "ticketUrl", event.target.value)}
                            />
                            <Button variant="ghost" onClick={() => removeObjectItem("bugs", index)} fullWidth>
                                Delete Bug
                            </Button>
                        </Stack>
                    </Card>
                ))}
                <Button icon={<Plus size={15} />} onClick={() => addObjectItem("bugs", defaultListItems.bug)} fullWidth>
                    Add Bug
                </Button>
            </Stack>
        )

    if (display.kind === "shopping-list")
        return (
            <Stack gap="md">
                <Heading size="sm">Shopping items</Heading>
                {objectArrayFrom(data.shoppingItems).map((item, index) => (
                    <Card key={`${index}-${item.product}`} padding="compact">
                        <Stack gap="md">
                            <Grid columns="two">
                                <TextField label="Brand" value={stringFrom(item.brand)} onChange={event => updateObjectItem("shoppingItems", index, "brand", event.target.value)} />
                                <TextField
                                    label="Product"
                                    value={stringFrom(item.product)}
                                    onChange={event => updateObjectItem("shoppingItems", index, "product", event.target.value)}
                                />
                                <TextField
                                    label="Model or variant"
                                    value={stringFrom(item.modelVariant)}
                                    onChange={event => updateObjectItem("shoppingItems", index, "modelVariant", event.target.value)}
                                />
                                <TextField label="Store" value={stringFrom(item.store)} onChange={event => updateObjectItem("shoppingItems", index, "store", event.target.value)} />
                                <TextField
                                    label="Store location"
                                    value={stringFrom(item.storeLocation)}
                                    onChange={event => updateObjectItem("shoppingItems", index, "storeLocation", event.target.value)}
                                />
                                <TextField
                                    label="Store URL"
                                    value={stringFrom(item.storeUrl)}
                                    onChange={event => updateObjectItem("shoppingItems", index, "storeUrl", event.target.value)}
                                />
                            </Grid>
                            <Button variant="ghost" onClick={() => removeObjectItem("shoppingItems", index)} fullWidth>
                                Delete Item
                            </Button>
                        </Stack>
                    </Card>
                ))}
                <Button icon={<Plus size={15} />} onClick={() => addObjectItem("shoppingItems", defaultListItems.shoppingItem)} fullWidth>
                    Add Shopping Item
                </Button>
            </Stack>
        )

    if (display.kind === "pull-request")
        return (
            <Stack gap="md">
                <TextField label="PR URL" value={stringFrom(data.prUrl)} onChange={event => updateField("prUrl", event.target.value)} />
                <Grid columns="two">
                    <TextField label="PR number or ID" value={stringFrom(data.prNumber)} onChange={event => updateField("prNumber", event.target.value)} />
                    <TextField label="Author" value={stringFrom(data.author)} onChange={event => updateField("author", event.target.value)} />
                    <TextField label="Reviewer" value={stringFrom(data.reviewer)} onChange={event => updateField("reviewer", event.target.value)} />
                </Grid>
                <TextField label="PR title" value={stringFrom(data.title)} onChange={event => updateField("title", event.target.value)} />
                <TextAreaField label="PR description" value={stringFrom(data.description)} onChange={event => updateField("description", event.target.value)} />
                <StringListEditor
                    title="Comments"
                    items={arrayFrom(data.comments)}
                    label="Comment"
                    onAdd={() => addListItem("comments", "New comment")}
                    onChange={(index, value) => updateListItem("comments", index, value)}
                    onRemove={index => removeListItem("comments", index)}
                />
            </Stack>
        )

    if (display.kind === "url")
        return (
            <Stack gap="md">
                <TextField label="URL" value={stringFrom(data.url)} onChange={event => updateField("url", event.target.value)} />
                <TextField label="Page title" value={stringFrom(data.pageTitle)} onChange={event => updateField("pageTitle", event.target.value)} />
                <TextAreaField label="Page description" value={stringFrom(data.pageDescription)} onChange={event => updateField("pageDescription", event.target.value)} />
                <TextField label="Banner image" value={stringFrom(data.bannerImage)} onChange={event => updateField("bannerImage", event.target.value)} />
                <TextField label="Social preview image" value={stringFrom(data.socialPreviewImage)} onChange={event => updateField("socialPreviewImage", event.target.value)} />
                <TextField label="Favicon" value={stringFrom(data.favicon)} onChange={event => updateField("favicon", event.target.value)} />
                <StringListEditor
                    title="Keywords"
                    items={arrayFrom(data.keywords)}
                    label="Keyword"
                    onAdd={() => addListItem("keywords", "New keyword")}
                    onChange={(index, value) => updateListItem("keywords", index, value)}
                    onRemove={index => removeListItem("keywords", index)}
                />
            </Stack>
        )

    return (
        <Stack gap="md">
            <TextAreaField label="Code" value={stringFrom(data.code)} onChange={event => updateField("code", event.target.value)} />
            <Grid columns="two">
                <TextField label="Language" value={stringFrom(data.language)} onChange={event => updateField("language", event.target.value)} />
                <TextField label="GitHub or external URL" value={stringFrom(data.sourceUrl)} onChange={event => updateField("sourceUrl", event.target.value)} />
            </Grid>
        </Stack>
    )
}
