"use client"

import { CheckCircle2, CircleDot, GitBranch, GitPullRequest, XCircle } from "lucide-react"
import { useCallback } from "react"
import { DataTextField, EditableVisualBlock, Grid, Heading, InlineStringListForField, Pill, Stack, Text } from "@/components/ui"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import { arrayFrom, replaceStringAt, stringFrom } from "../../utils/visual-note-app.utils"
import styles from "./visual-pull-request-block.module.css"

type VisualPullRequestBlockProps = {
    data: VisualBlockData
    isReadOnly?: boolean
    onDataChange: (data: VisualBlockData) => void
}

const statusTone = (status: string) => {
    const normalized = status.toLowerCase()
    if (normalized.includes("merge")) return "merged"
    if (normalized.includes("close")) return "closed"
    return "open"
}

export function VisualPullRequestBlock({ data, isReadOnly = false, onDataChange }: VisualPullRequestBlockProps) {
    const url = stringFrom(data.url)
    const status = stringFrom(data.status, "Open")
    const tone = statusTone(status)
    const labels = arrayFrom(data.labels)
    const reviewers = arrayFrom(data.reviewers)
    const notes = arrayFrom(data.notes)
    const baseBranch = stringFrom(data.baseBranch, "base")
    const headBranch = stringFrom(data.headBranch, "branch")
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
    const preview = (
        <Stack className={styles.card} gap="md">
            <Stack className={styles.cardHeader} direction="horizontal" gap="sm">
                <Stack className={styles.titleGroup} gap="xs">
                    <Heading size="md">{stringFrom(data.title, "Pull request title")}</Heading>
                    <Pill className={styles.numberPill}>
                        <GitPullRequest size={13} />
                        {stringFrom(data.number, "PR")}
                    </Pill>
                </Stack>
                <Text as="span" className={`${styles.stateBadge} ${styles[tone]}`}>
                    {tone === "closed" ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                    {status}
                </Text>
            </Stack>
            <Stack className={styles.branchRow} direction="horizontal" gap="xs">
                <Pill className={styles.branchPill}>
                    <GitBranch size={13} />
                    Base:
                    {baseBranch}
                </Pill>
                <Pill className={styles.branchPill}>
                    <GitBranch size={13} />
                    PR:
                    {headBranch}
                </Pill>
            </Stack>
            <Text size="small">
                {stringFrom(data.author, "Unknown author")} wants to merge changes
                {reviewers.length ? ` with ${reviewers.length} reviewer${reviewers.length === 1 ? "" : "s"}` : ""}.
            </Text>
            {labels.length ? (
                <Stack className={styles.labels} direction="horizontal" gap="xs">
                    {labels.map(label => (
                        <Pill key={label} className={styles.labelPill}>
                            {label}
                        </Pill>
                    ))}
                </Stack>
            ) : null}
            {notes.length ? (
                <Stack className={styles.noteList} gap="xs">
                    {notes.map(note => (
                        <Stack key={note} className={styles.noteItem} direction="horizontal" gap="sm">
                            <CircleDot size={13} />
                            <Text size="small">{note}</Text>
                        </Stack>
                    ))}
                </Stack>
            ) : (
                <Text size="small">No pull request notes provided.</Text>
            )}
            {reviewers.length ? (
                <Stack className={styles.reviewers} direction="horizontal" gap="xs">
                    <Text size="small">Reviewers</Text>
                    {reviewers.map(reviewer => (
                        <Pill key={reviewer}>{reviewer}</Pill>
                    ))}
                </Stack>
            ) : null}
        </Stack>
    )

    return (
        <EditableVisualBlock preview={preview} previewClassName={styles.cardFrame} previewPadding="none" readOnly={isReadOnly}>
            <Grid columns="two" gap="sm">
                <DataTextField label="Title" field="title" value={stringFrom(data.title)} onUpdateField={updateField} />
                <DataTextField label="URL" field="url" value={url} onUpdateField={updateField} />
                <DataTextField label="Number" field="number" value={stringFrom(data.number)} onUpdateField={updateField} />
                <DataTextField label="Status" field="status" value={stringFrom(data.status)} onUpdateField={updateField} />
                <DataTextField label="Author" field="author" value={stringFrom(data.author)} onUpdateField={updateField} />
                <DataTextField label="Base branch" field="baseBranch" value={stringFrom(data.baseBranch)} onUpdateField={updateField} />
                <DataTextField label="PR branch" field="headBranch" value={stringFrom(data.headBranch)} onUpdateField={updateField} />
                <DataTextField label="Source" field="source" value={stringFrom(data.source)} onUpdateField={updateField} />
            </Grid>
            <InlineStringListForField
                title="Labels"
                items={labels}
                field="labels"
                newItem="label"
                onAddStringListItem={addStringListItem}
                onUpdateStringList={updateStringList}
                onRemoveStringListItem={removeStringListItem}
            />
            <InlineStringListForField
                title="Reviewers"
                items={reviewers}
                field="reviewers"
                newItem="Reviewer"
                onAddStringListItem={addStringListItem}
                onUpdateStringList={updateStringList}
                onRemoveStringListItem={removeStringListItem}
            />
            <InlineStringListForField
                title="Notes"
                items={notes}
                field="notes"
                newItem="New note"
                onAddStringListItem={addStringListItem}
                onUpdateStringList={updateStringList}
                onRemoveStringListItem={removeStringListItem}
            />
        </EditableVisualBlock>
    )
}
