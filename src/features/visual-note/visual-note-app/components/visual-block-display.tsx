"use client"

import { CalendarDays, Code2, Contact, MapPin } from "lucide-react"
import { type ReactNode, useCallback } from "react"
import { DataDateField, DataTextAreaField, DataTextField, DataTimeField, EditableVisualBlock, Grid, Heading, InlineStringListForField, Pill, Stack, Text } from "@/components/ui"
import type { VisualBlockDisplayProps } from "../types/visual-note-app.types"
import { calendarPreviewText, joinedPreviewText } from "../utils/visual-block-preview"
import { arrayFrom, dateInputValue, replaceStringAt, stringFrom, timeInputValue } from "../utils/visual-note-app.utils"
import styles from "../../visual-note-app.module.css"
import { VisualBlockChartDisplay } from "./visual-block-chart-display"
import { VisualBlockListDisplay } from "./visual-blocks/visual-block-list-display"
import { VisualImageBlock } from "./visual-blocks/visual-image-block"
import { VisualPullRequestBlock } from "./visual-blocks/visual-pull-request-block"

export function VisualBlockDisplay({ visualKind, data, raw, parseError, isReadOnly = false, onDataChange }: VisualBlockDisplayProps) {
    const updateField = useCallback((field: string, value: unknown) => onDataChange({ ...data, [field]: value }), [data, onDataChange])
    const updateStringList = useCallback(
        (field: string, index: number, value: string) => updateField(field, replaceStringAt(arrayFrom(data[field]), index, value)),
        [data, updateField],
    )
    const addStringListItem = useCallback((field: string, value: string) => updateField(field, [...arrayFrom(data[field]), value]), [data, updateField])
    const removeStringListItem = useCallback(
        (field: string, index: number) =>
            updateField(
                field,
                arrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index),
            ),
        [data, updateField],
    )
    const header = useCallback(
        (icon: ReactNode, title: string, action?: ReactNode) => (
            <Stack className={styles.visualBlockHeader} direction="horizontal" gap="sm">
                <Pill>
                    {icon}
                    {title}
                </Pill>
                {action}
            </Stack>
        ),
        [],
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
                    <DataTextField label="Title" field="title" value={stringFrom(data.title)} onUpdateField={updateField} />
                    <DataDateField label="Date" field="date" value={dateInputValue(data.date)} onUpdateField={updateField} />
                    <DataTimeField label="Start" field="startTime" value={timeInputValue(data.startTime)} onUpdateField={updateField} />
                    <DataTimeField label="End" field="endTime" value={timeInputValue(data.endTime)} onUpdateField={updateField} />
                    <DataTextField label="Location" field="location" value={stringFrom(data.location)} onUpdateField={updateField} />
                </Grid>
                <DataTextAreaField label="Notes" field="notes" value={stringFrom(data.notes)} onUpdateField={updateField} />
                <InlineStringListForField
                    title="Attendees"
                    items={arrayFrom(data.attendees)}
                    field="attendees"
                    newItem="New attendee"
                    onAddStringListItem={addStringListItem}
                    onUpdateStringList={updateStringList}
                    onRemoveStringListItem={removeStringListItem}
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
                    <DataTextField label="Name" field="name" value={stringFrom(data.name)} onUpdateField={updateField} />
                    <DataTextField label="Role" field="role" value={stringFrom(data.role)} onUpdateField={updateField} />
                    <DataTextField label="Company" field="company" value={stringFrom(data.company)} onUpdateField={updateField} />
                    <DataTextField label="Email" field="email" value={stringFrom(data.email)} onUpdateField={updateField} />
                    <DataTextField label="Phone" field="phone" value={stringFrom(data.phone)} onUpdateField={updateField} />
                </Grid>
                <InlineStringListForField
                    title="Links"
                    items={arrayFrom(data.links)}
                    field="links"
                    newItem="https://example.com"
                    onAddStringListItem={addStringListItem}
                    onUpdateStringList={updateStringList}
                    onRemoveStringListItem={removeStringListItem}
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
                <DataTextField label="Label" field="label" value={stringFrom(data.label)} onUpdateField={updateField} />
                <InlineStringListForField
                    title="Address lines"
                    items={arrayFrom(data.lines)}
                    field="lines"
                    newItem="Address line"
                    onAddStringListItem={addStringListItem}
                    onUpdateStringList={updateStringList}
                    onRemoveStringListItem={removeStringListItem}
                />
                <DataTextField label="Map URL" field="mapUrl" value={stringFrom(data.mapUrl)} onUpdateField={updateField} />
                <DataTextAreaField label="Notes" field="notes" value={stringFrom(data.notes)} onUpdateField={updateField} />
            </EditableVisualBlock>
        )

    return <VisualBlockChartDisplay data={data} isReadOnly={isReadOnly} onDataChange={onDataChange} />
}
