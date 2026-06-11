"use client"

import { CheckCircle2, CircleDot, GitBranch, GitPullRequest, XCircle } from "lucide-react"
import { useState } from "react"
import { Button, EditableFrame, Grid, Heading, Pill, Stack, Text, TextField } from "@/components/ui"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import { arrayFrom, replaceStringAt, stringFrom } from "../../utils/visual-note-app.utils"
import { InlineStringList } from "../inline-string-list"
import styles from "./visual-pull-request-block.module.css"

type VisualPullRequestBlockProps = {
    data: VisualBlockData
    onDataChange: (data: VisualBlockData) => void
}

const statusTone = (status: string) => {
    const normalized = status.toLowerCase()
    if (normalized.includes("merge")) return "merged"
    if (normalized.includes("close")) return "closed"
    return "open"
}

export function VisualPullRequestBlock({ data, onDataChange }: VisualPullRequestBlockProps) {
    const [isEditing, setIsEditing] = useState(false)
    const url = stringFrom(data.url)
    const status = stringFrom(data.status, "Open")
    const tone = statusTone(status)
    const labels = arrayFrom(data.labels)
    const reviewers = arrayFrom(data.reviewers)
    const notes = arrayFrom(data.notes)
    const baseBranch = stringFrom(data.baseBranch, "base")
    const headBranch = stringFrom(data.headBranch, "branch")
    const updateField = (field: string, value: unknown) => onDataChange({ ...data, [field]: value })
    const updateStringList = (field: string, index: number, value: string) => updateField(field, replaceStringAt(arrayFrom(data[field]), index, value))
    const addStringListItem = (field: string, value: string) => updateField(field, [...arrayFrom(data[field]), value])
    const removeStringListItem = (field: string, index: number) =>
        updateField(
            field,
            arrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index),
        )

    return (
        <Stack className={styles.pullRequestBlock} gap="md">
            <EditableFrame className={styles.cardFrame} isEditing={isEditing} onClick={() => setIsEditing(true)}>
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
            </EditableFrame>
            {isEditing ? (
                <Stack className={styles.editor} gap="md">
                    <Grid columns="two" gap="sm">
                        <TextField label="Title" value={stringFrom(data.title)} onChange={event => updateField("title", event.target.value)} />
                        <TextField label="URL" value={url} onChange={event => updateField("url", event.target.value)} />
                        <TextField label="Number" value={stringFrom(data.number)} onChange={event => updateField("number", event.target.value)} />
                        <TextField label="Status" value={stringFrom(data.status)} onChange={event => updateField("status", event.target.value)} />
                        <TextField label="Author" value={stringFrom(data.author)} onChange={event => updateField("author", event.target.value)} />
                        <TextField label="Base branch" value={stringFrom(data.baseBranch)} onChange={event => updateField("baseBranch", event.target.value)} />
                        <TextField label="PR branch" value={stringFrom(data.headBranch)} onChange={event => updateField("headBranch", event.target.value)} />
                        <TextField label="Source" value={stringFrom(data.source)} onChange={event => updateField("source", event.target.value)} />
                    </Grid>
                    <InlineStringList
                        title="Labels"
                        items={labels}
                        onAdd={() => addStringListItem("labels", "label")}
                        onChange={(index, value) => updateStringList("labels", index, value)}
                        onRemove={index => removeStringListItem("labels", index)}
                    />
                    <InlineStringList
                        title="Reviewers"
                        items={reviewers}
                        onAdd={() => addStringListItem("reviewers", "Reviewer")}
                        onChange={(index, value) => updateStringList("reviewers", index, value)}
                        onRemove={index => removeStringListItem("reviewers", index)}
                    />
                    <InlineStringList
                        title="Notes"
                        items={notes}
                        onAdd={() => addStringListItem("notes", "New note")}
                        onChange={(index, value) => updateStringList("notes", index, value)}
                        onRemove={index => removeStringListItem("notes", index)}
                    />
                    <Button variant="ghost" onClick={() => setIsEditing(false)}>
                        Done
                    </Button>
                </Stack>
            ) : null}
        </Stack>
    )
}
