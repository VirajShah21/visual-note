"use client"

import { CalendarDays, Code2, Contact, ExternalLink as ExternalLinkIcon, GitPullRequest, MapPin, Plus, Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { Button, DateField, ExternalLink, Grid, Heading, Pill, SelectField, SimpleChart, Stack, Text, TextAreaField, TextField, TimeField } from "@/components/ui"
import type { VisualBlockDisplayProps } from "../types/visual-note-app.types"
import {
    arrayFrom,
    calendarEventSchedule,
    chartRowsFromData,
    dateInputValue,
    objectArrayFrom,
    replaceObjectAt,
    replaceStringAt,
    stringFrom,
    timeInputValue,
} from "../utils/visual-note-app.utils"
import styles from "../../visual-note-app.module.css"
import { InlineStringList } from "./inline-string-list"
import { VisualBlockListDisplay } from "./visual-blocks/visual-block-list-display"

export function VisualBlockDisplay({ visualKind, data, raw, parseError, onDataChange }: VisualBlockDisplayProps) {
    const updateField = (field: string, value: unknown) => onDataChange({ ...data, [field]: value })
    const updateStringList = (field: string, index: number, value: string) => updateField(field, replaceStringAt(arrayFrom(data[field]), index, value))
    const addStringListItem = (field: string, value: string) => updateField(field, [...arrayFrom(data[field]), value])
    const removeStringListItem = (field: string, index: number) =>
        updateField(
            field,
            arrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index),
        )
    const updateObjectList = (field: string, index: number, patch: Record<string, unknown>) => updateField(field, replaceObjectAt(objectArrayFrom(data[field]), index, patch))
    const addObjectListItem = (field: string, value: Record<string, unknown>) => updateField(field, [...objectArrayFrom(data[field]), value])
    const header = (icon: ReactNode, title: string, action?: ReactNode) => (
        <Stack className={styles.visualBlockHeader} direction="horizontal" gap="sm">
            <Pill>
                {icon}
                {title}
            </Pill>
            {action}
        </Stack>
    )

    if (parseError)
        return (
            <Stack className={styles.visualBlockError} gap="sm">
                {header(<Code2 size={13} />, `visual:${visualKind}`)}
                <Text tone="strong">Unable to parse visual block data.</Text>
                <Text size="small">{parseError}</Text>
                <Text as="code" tone="code" className={styles.dataPreview}>
                    {raw}
                </Text>
            </Stack>
        )

    if (
        visualKind === "recipe" ||
        visualKind === "timeline" ||
        visualKind === "poll" ||
        visualKind === "packing-list" ||
        visualKind === "shopping-list" ||
        visualKind === "task-list"
    )
        return <VisualBlockListDisplay visualKind={visualKind} data={data} onDataChange={onDataChange} />

    if (visualKind === "pull-request")
        return (
            <Stack className={styles.visualBlock} gap="md">
                {header(
                    <GitPullRequest size={13} />,
                    "GitHub Pull Request",
                    stringFrom(data.url) ? (
                        <ExternalLink href={stringFrom(data.url)}>
                            <ExternalLinkIcon size={14} />
                            Open
                        </ExternalLink>
                    ) : null,
                )}
                <Stack className={styles.heroPanel} gap="sm">
                    <Pill>{stringFrom(data.number, "PR")}</Pill>
                    <Heading size="md">{stringFrom(data.title, "Pull request title")}</Heading>
                    <Text>{arrayFrom(data.notes).join(" ") || "No notes provided."}</Text>
                </Stack>
                <Grid columns="two" gap="sm">
                    <TextField label="Title" value={stringFrom(data.title)} onChange={event => updateField("title", event.target.value)} />
                    <TextField label="URL" value={stringFrom(data.url)} onChange={event => updateField("url", event.target.value)} />
                    <TextField label="Number" value={stringFrom(data.number)} onChange={event => updateField("number", event.target.value)} />
                    <TextField label="Status" value={stringFrom(data.status)} onChange={event => updateField("status", event.target.value)} />
                    <TextField label="Author" value={stringFrom(data.author)} onChange={event => updateField("author", event.target.value)} />
                    <TextField label="Source" value={stringFrom(data.source)} onChange={event => updateField("source", event.target.value)} />
                </Grid>
                <InlineStringList
                    title="Reviewers"
                    items={arrayFrom(data.reviewers)}
                    onAdd={() => addStringListItem("reviewers", "Reviewer")}
                    onChange={(index, value) => updateStringList("reviewers", index, value)}
                    onRemove={index => removeStringListItem("reviewers", index)}
                />
                <InlineStringList
                    title="Notes"
                    items={arrayFrom(data.notes)}
                    onAdd={() => addStringListItem("notes", "New note")}
                    onChange={(index, value) => updateStringList("notes", index, value)}
                    onRemove={index => removeStringListItem("notes", index)}
                />
            </Stack>
        )

    if (visualKind === "calendar-event")
        return (
            <Stack className={styles.visualBlock} gap="md">
                {header(<CalendarDays size={13} />, "Calendar Event")}
                <Stack className={styles.itemHeader} direction="horizontal" gap="sm">
                    <Stack gap="xs">
                        <Heading size="md">{stringFrom(data.title, "Event")}</Heading>
                        <Text>{calendarEventSchedule(data)}</Text>
                    </Stack>
                    <Pill>
                        <MapPin size={13} />
                        {stringFrom(data.location, "Location")}
                    </Pill>
                </Stack>
                <Grid columns="two" gap="sm">
                    <TextField label="Title" value={stringFrom(data.title)} onChange={event => updateField("title", event.target.value)} />
                    <DateField label="Date" value={dateInputValue(data.date)} onChange={event => updateField("date", event.target.value)} />
                    <TimeField label="Start" value={timeInputValue(data.startTime)} onChange={event => updateField("startTime", event.target.value)} />
                    <TimeField label="End" value={timeInputValue(data.endTime)} onChange={event => updateField("endTime", event.target.value)} />
                    <TextField label="Location" value={stringFrom(data.location)} onChange={event => updateField("location", event.target.value)} />
                </Grid>
                <TextAreaField label="Notes" value={stringFrom(data.notes)} onChange={event => updateField("notes", event.target.value)} />
                <InlineStringList
                    title="Attendees"
                    items={arrayFrom(data.attendees)}
                    onAdd={() => addStringListItem("attendees", "New attendee")}
                    onChange={(index, value) => updateStringList("attendees", index, value)}
                    onRemove={index => removeStringListItem("attendees", index)}
                />
            </Stack>
        )

    if (visualKind === "contact-card")
        return (
            <Stack className={styles.visualBlock} gap="md">
                {header(<Contact size={13} />, "Contact Card")}
                <Stack className={styles.heroPanel} gap="xs">
                    <Heading size="md">{stringFrom(data.name, "Contact")}</Heading>
                    <Text>{[stringFrom(data.role), stringFrom(data.company)].filter(Boolean).join(" at ") || "Contact details"}</Text>
                </Stack>
                <Grid columns="two" gap="sm">
                    <TextField label="Name" value={stringFrom(data.name)} onChange={event => updateField("name", event.target.value)} />
                    <TextField label="Role" value={stringFrom(data.role)} onChange={event => updateField("role", event.target.value)} />
                    <TextField label="Company" value={stringFrom(data.company)} onChange={event => updateField("company", event.target.value)} />
                    <TextField label="Email" value={stringFrom(data.email)} onChange={event => updateField("email", event.target.value)} />
                    <TextField label="Phone" value={stringFrom(data.phone)} onChange={event => updateField("phone", event.target.value)} />
                </Grid>
                <InlineStringList
                    title="Links"
                    items={arrayFrom(data.links)}
                    onAdd={() => addStringListItem("links", "https://example.com")}
                    onChange={(index, value) => updateStringList("links", index, value)}
                    onRemove={index => removeStringListItem("links", index)}
                />
            </Stack>
        )

    if (visualKind === "address-card")
        return (
            <Stack className={styles.visualBlock} gap="md">
                {header(<MapPin size={13} />, "Address Card", stringFrom(data.mapUrl) ? <ExternalLink href={stringFrom(data.mapUrl)}>Map</ExternalLink> : null)}
                <Stack className={styles.heroPanel} gap="xs">
                    <Heading size="md">{stringFrom(data.label, "Address")}</Heading>
                    <Text>{arrayFrom(data.lines).join(", ")}</Text>
                </Stack>
                <TextField label="Label" value={stringFrom(data.label)} onChange={event => updateField("label", event.target.value)} />
                <InlineStringList
                    title="Address lines"
                    items={arrayFrom(data.lines)}
                    onAdd={() => addStringListItem("lines", "Address line")}
                    onChange={(index, value) => updateStringList("lines", index, value)}
                    onRemove={index => removeStringListItem("lines", index)}
                />
                <TextField label="Map URL" value={stringFrom(data.mapUrl)} onChange={event => updateField("mapUrl", event.target.value)} />
                <TextAreaField label="Notes" value={stringFrom(data.notes)} onChange={event => updateField("notes", event.target.value)} />
            </Stack>
        )

    const rows = chartRowsFromData(data.data)
    const chartType = stringFrom(data.type, "bar") === "line" ? "line" : "bar"

    return (
        <Stack className={styles.visualBlock} gap="md">
            {header(<Sparkles size={13} />, "Chart")}
            <SimpleChart title={stringFrom(data.title, "Chart")} type={chartType} rows={rows} xLabel={stringFrom(data.xLabel)} yLabel={stringFrom(data.yLabel)} />
            <Grid columns="two" gap="sm">
                <TextField label="Title" value={stringFrom(data.title)} onChange={event => updateField("title", event.target.value)} />
                <SelectField
                    label="Type"
                    value={chartType}
                    options={[
                        { label: "Bar", value: "bar" },
                        { label: "Line", value: "line" },
                    ]}
                    onValueChange={value => updateField("type", value)}
                />
                <TextField label="X label" value={stringFrom(data.xLabel)} onChange={event => updateField("xLabel", event.target.value)} />
                <TextField label="Y label" value={stringFrom(data.yLabel)} onChange={event => updateField("yLabel", event.target.value)} />
            </Grid>
            <Stack gap="sm">
                <Heading size="sm">Data</Heading>
                {rows.map((row, index) => (
                    <Grid key={`${index}-${row.label}`} columns="two" gap="sm">
                        <TextField label="Label" value={row.label} onChange={event => updateObjectList("data", index, { label: event.target.value })} />
                        <TextField
                            label="Value"
                            type="number"
                            value={String(row.value)}
                            onChange={event => updateObjectList("data", index, { value: Number(event.target.value) })}
                        />
                    </Grid>
                ))}
                <Button icon={<Plus size={15} />} variant="ghost" onClick={() => addObjectListItem("data", { label: "New", value: 1 })}>
                    Add point
                </Button>
            </Stack>
        </Stack>
    )
}
