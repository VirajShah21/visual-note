"use client"

import { Plus } from "lucide-react"
import { type ChangeEvent, useCallback } from "react"
import { Button, ModalDialog, RenameDialog, Stack, TextField } from "@/components/ui"

type SectionDialogsProps = {
    title: string
    itemTitle: string
    editTitle: string
    editingTopicId: string
    editingSectionId: string
    isCreateOpen: boolean
    isCreateTopicOpen: boolean
    onCreate: () => void
    onCreateTopic: () => void
    onRename: () => void
    onRenameSection: () => void
    onSetTitle: (title: string) => void
    onSetItemTitle: (title: string) => void
    onSetEditTitle: (title: string) => void
    onSetCreateOpen: (open: boolean) => void
    onSetCreateTopicOpen: (open: boolean) => void
    onSetEditingTopicId: (id: string) => void
    onSetEditingSectionId: (id: string) => void
}

export function SectionDialogs(props: SectionDialogsProps) {
    const handleTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => props.onSetTitle(event.target.value), [props])
    const handleItemTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => props.onSetItemTitle(event.target.value), [props])
    const closeTopicRename = useCallback(
        (open: boolean) => {
            if (!open) props.onSetEditingTopicId("")
        },
        [props],
    )
    const closeSectionRename = useCallback(
        (open: boolean) => {
            if (!open) props.onSetEditingSectionId("")
        },
        [props],
    )

    return (
        <>
            <ModalDialog open={props.isCreateOpen} title="Create section" description="Sections are sidebar groups for this notebook." onOpenChange={props.onSetCreateOpen}>
                <Stack gap="md">
                    <TextField label="Section title" value={props.title} onChange={handleTitleChange} />
                    <Button icon={<Plus size={15} />} variant="primary" onClick={props.onCreate} fullWidth>
                        Create section
                    </Button>
                </Stack>
            </ModalDialog>
            <ModalDialog open={props.isCreateTopicOpen} title="Create item" description="Add a sidebar item to this section." onOpenChange={props.onSetCreateTopicOpen}>
                <Stack gap="md">
                    <TextField label="Item title" value={props.itemTitle} onChange={handleItemTitleChange} />
                    <Button icon={<Plus size={15} />} variant="primary" onClick={props.onCreateTopic} fullWidth>
                        Create item
                    </Button>
                </Stack>
            </ModalDialog>
            <RenameDialog
                title="Rename topic"
                description="Update this sidebar topic title."
                open={Boolean(props.editingTopicId)}
                value={props.editTitle}
                onOpenChange={closeTopicRename}
                onValueChange={props.onSetEditTitle}
                onRename={props.onRename}
            />
            <RenameDialog
                title="Rename section"
                description="Update this sidebar section title."
                open={Boolean(props.editingSectionId)}
                value={props.editTitle}
                onOpenChange={closeSectionRename}
                onValueChange={props.onSetEditTitle}
                onRename={props.onRenameSection}
            />
        </>
    )
}
