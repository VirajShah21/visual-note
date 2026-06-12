"use client"

import { CalendarDays, Code2, Contact, MapPin, Plus, Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { Button, DateField, EditableVisualBlock, Grid, Heading, Pill, SelectField, SimpleChart, Stack, Text, TextAreaField, TextField, TimeField } from "@/components/ui"
import type { VisualBlockDisplayProps } from "../types/visual-note-app.types"
import { calendarPreviewText, joinedPreviewText } from "../utils/visual-block-preview"
import { arrayFrom, chartRowsFromData, dateInputValue, objectArrayFrom, replaceObjectAt, replaceStringAt, stringFrom, timeInputValue } from "../utils/visual-note-app.utils"
import styles from "../../visual-note-app.module.css"
import { InlineStringList } from "./inline-string-list"
import { VisualBlockListDisplay } from "./visual-blocks/visual-block-list-display"
import { VisualImageBlock } from "./visual-blocks/visual-image-block"
import { VisualPullRequestBlock } from "./visual-blocks/visual-pull-request-block"

export function VisualBlockDisplay({ visualKind, data, raw, parseError, isReadOnly = false, onDataChange }: VisualBlockDisplayProps) {
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

    if (visualKind === "image") return <VisualImageBlock data={data} isReadOnly={isReadOnly} onDataChange={onDataChange} />

    if (
        visualKind === "recipe" ||
        visualKind === "timeline" ||
        visualKind === "poll" ||
        visualKind === "packing-list" ||
        visualKind === "shopping-list" ||
        visualKind === "task-list"
    )
        return <VisualBlockListDisplay visualKind={visualKind} data={data} isReadOnly={isReadOnly} onDataChange={onDataChange} />

    if (visualKind === "pull-request") return <VisualPullRequestBlock data={data} isReadOnly={isReadOnly} onDataChange={onDataChange} />

    if (visualKind === "calendar-event")
        return (
            <EditableVisualBlock
                readOnly={isReadOnly}
                preview={
                    <>
                        {header(<CalendarDays size={13} />, "Calendar Event")}
                        <Stack className={styles.heroPanel} gap="xs">
                            <Heading size="md">{stringFrom(data.title, "Event")}</Heading>
                            <Text>{calendarPreviewText(data)}</Text>
                        </Stack>
                    </>
                }
            >
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
            </EditableVisualBlock>
        )

    if (visualKind === "contact-card")
        return (
            <EditableVisualBlock
                readOnly={isReadOnly}
                preview={
                    <>
                        {header(<Contact size={13} />, "Contact Card")}
                        <Stack className={styles.heroPanel} gap="xs">
                            <Heading size="md">{stringFrom(data.name, "Contact")}</Heading>
                            <Text>
                                {joinedPreviewText(
                                    [joinedPreviewText([stringFrom(data.role), stringFrom(data.company)], "Contact details"), stringFrom(data.email), stringFrom(data.phone)],
                                    "Contact details",
                                )}
                            </Text>
                        </Stack>
                    </>
                }
            >
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
            </EditableVisualBlock>
        )

    if (visualKind === "address-card")
        return (
            <EditableVisualBlock
                readOnly={isReadOnly}
                preview={
                    <>
                        {header(<MapPin size={13} />, "Address Card")}
                        <Stack className={styles.heroPanel} gap="xs">
                            <Heading size="md">{stringFrom(data.label, "Address")}</Heading>
                            <Text>{joinedPreviewText([arrayFrom(data.lines).join(", "), stringFrom(data.notes)], "Address details")}</Text>
                        </Stack>
                    </>
                }
            >
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
            </EditableVisualBlock>
        )

    const rows = chartRowsFromData(data.data)
    const chartType = stringFrom(data.type, "bar") === "line" ? "line" : "bar"

    return (
        <EditableVisualBlock
            readOnly={isReadOnly}
            preview={
                <>
                    {header(<Sparkles size={13} />, "Chart")}
                    <SimpleChart title={stringFrom(data.title, "Chart")} type={chartType} rows={rows} xLabel={stringFrom(data.xLabel)} yLabel={stringFrom(data.yLabel)} />
                </>
            }
        >
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
        </EditableVisualBlock>
    )
}
