"use client"

import { PanelLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button, ContextActions, Heading, InfoPopover, ModalDialog, Pill, ScrollArea, Stack, TextField } from "@/components/ui"
import type { SectionSidebarProps } from "../types/visual-note-app.types"
import styles from "../../visual-note-app.module.css"

export function SectionSidebar({
    sections,
    topics,
    activeSectionId,
    activeTopicId,
    onCreateSection,
    onRenameSection,
    onDeleteSection,
    onCreateTopic,
    onRenameTopic,
    onDeleteTopic,
    onSelectTopic,
    onSelectSection,
}: SectionSidebarProps) {
    const [title, setTitle] = useState("New section")
    const [itemTitle, setItemTitle] = useState("New item")
    const [editTitle, setEditTitle] = useState("")
    const [editingTopicId, setEditingTopicId] = useState("")
    const [editingSectionId, setEditingSectionId] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false)
    const [activeSectionIdForTopic, setActiveSectionIdForTopic] = useState("")

    const create = () => {
        if (!onCreateSection(title)) return
        setTitle("New section")
        setIsCreateOpen(false)
    }
    const createTopic = () => {
        if (!activeSectionIdForTopic || !onCreateTopic(activeSectionIdForTopic, itemTitle)) return
        setItemTitle("New item")
        setIsCreateTopicOpen(false)
    }
    const openEditTopic = (topicId: string) => {
        const topic = topics.find(item => item.id === topicId)
        if (!topic) return
        setEditingTopicId(topic.id)
        setEditTitle(topic.title)
    }
    const openEditSection = (sectionId: string) => {
        const section = sections.find(item => item.id === sectionId)
        if (!section) return
        setEditingSectionId(section.id)
        setEditTitle(section.title)
    }
    const renameSection = () => {
        if (!onRenameSection(editingSectionId, editTitle)) return
        setEditingSectionId("")
        setEditTitle("")
    }
    const rename = () => {
        if (!onRenameTopic(editingTopicId, editTitle)) return
        setEditingTopicId("")
        setEditTitle("")
    }
    const openTopicCreator = (sectionId: string) => {
        setActiveSectionIdForTopic(sectionId)
        setItemTitle("New item")
        setIsCreateTopicOpen(true)
    }

    return (
        <ScrollArea className={styles.sidebar}>
            <Stack gap="lg">
                <Stack gap="xs">
                    <Pill>
                        <PanelLeft size={14} />
                        Sections
                        <InfoPopover title="Sections" label="Section details">
                            Topics are section-specific items in the notebook sidebar.
                        </InfoPopover>
                    </Pill>
                </Stack>
                <Stack gap="sm">
                    {sections.map(section => (
                        <SectionGroup
                            key={section.id}
                            section={section}
                            topics={topics.filter(topic => topic.pageId === section.id).sort((a, b) => a.position - b.position)}
                            activeSectionId={activeSectionId}
                            activeTopicId={activeTopicId}
                            onDeleteSection={onDeleteSection}
                            onDeleteTopic={onDeleteTopic}
                            onOpenEditSection={openEditSection}
                            onOpenEditTopic={openEditTopic}
                            onOpenTopicCreator={openTopicCreator}
                            onSelectSection={onSelectSection}
                            onSelectTopic={onSelectTopic}
                        />
                    ))}
                </Stack>
                <Button icon={<Plus size={15} />} onClick={() => setIsCreateOpen(true)} fullWidth>
                    New section
                </Button>
            </Stack>
            <SectionDialogs
                title={title}
                itemTitle={itemTitle}
                editTitle={editTitle}
                editingTopicId={editingTopicId}
                editingSectionId={editingSectionId}
                isCreateOpen={isCreateOpen}
                isCreateTopicOpen={isCreateTopicOpen}
                onCreate={create}
                onCreateTopic={createTopic}
                onRename={rename}
                onRenameSection={renameSection}
                onSetTitle={setTitle}
                onSetItemTitle={setItemTitle}
                onSetEditTitle={setEditTitle}
                onSetCreateOpen={setIsCreateOpen}
                onSetCreateTopicOpen={setIsCreateTopicOpen}
                onSetEditingTopicId={setEditingTopicId}
                onSetEditingSectionId={setEditingSectionId}
            />
        </ScrollArea>
    )
}

type SectionGroupProps = {
    section: SectionSidebarProps["sections"][number]
    topics: SectionSidebarProps["topics"]
    activeSectionId: string
    activeTopicId: string
    onDeleteSection: (sectionId: string) => boolean
    onDeleteTopic: (topicId: string) => boolean
    onOpenEditSection: (sectionId: string) => void
    onOpenEditTopic: (topicId: string) => void
    onOpenTopicCreator: (sectionId: string) => void
    onSelectSection: (sectionId: string) => void
    onSelectTopic: (topicId: string) => void
}

function SectionGroup({
    section,
    topics,
    activeSectionId,
    activeTopicId,
    onDeleteSection,
    onDeleteTopic,
    onOpenEditSection,
    onOpenEditTopic,
    onOpenTopicCreator,
    onSelectSection,
    onSelectTopic,
}: SectionGroupProps) {
    return (
        <Stack className={styles.sectionGroup} gap="sm">
            <ContextActions
                className={styles.sectionHeaderTrigger}
                items={[
                    { label: "Rename section", icon: <Pencil size={14} />, onSelect: () => onOpenEditSection(section.id) },
                    { label: "Delete section", icon: <Trash2 size={14} />, onSelect: () => onDeleteSection(section.id) },
                ]}
            >
                <Heading
                    className={`${styles.sectionTitle} ${section.id === activeSectionId ? styles.activeSectionTitle : ""}`}
                    size="sm"
                    onClick={() => onSelectSection(section.id)}
                >
                    {section.title}
                </Heading>
            </ContextActions>
            <Stack className={styles.sectionPageList} gap="xs">
                {topics.map(topic => (
                    <ContextActions
                        key={topic.id}
                        className={styles.topicContextTrigger}
                        items={[
                            { label: "Rename item", icon: <Pencil size={14} />, onSelect: () => onOpenEditTopic(topic.id) },
                            { label: "Delete item", icon: <Trash2 size={14} />, onSelect: () => onDeleteTopic(topic.id) },
                        ]}
                    >
                        <Button
                            className={`${styles.navButton} ${styles.topicSelectButton} ${topic.id === activeTopicId ? styles.activeNavButton : ""}`}
                            onClick={() => onSelectTopic(topic.id)}
                            fullWidth
                        >
                            {topic.title}
                        </Button>
                    </ContextActions>
                ))}
                <Button icon={<Plus size={15} />} onClick={() => onOpenTopicCreator(section.id)} fullWidth>
                    New item
                </Button>
            </Stack>
        </Stack>
    )
}

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

function SectionDialogs(props: SectionDialogsProps) {
    return (
        <>
            <ModalDialog open={props.isCreateOpen} title="Create section" description="Sections are sidebar groups for this notebook." onOpenChange={props.onSetCreateOpen}>
                <Stack gap="md">
                    <TextField label="Section title" value={props.title} onChange={event => props.onSetTitle(event.target.value)} />
                    <Button icon={<Plus size={15} />} variant="primary" onClick={props.onCreate} fullWidth>
                        Create section
                    </Button>
                </Stack>
            </ModalDialog>
            <ModalDialog open={props.isCreateTopicOpen} title="Create item" description="Add a sidebar item to this section." onOpenChange={props.onSetCreateTopicOpen}>
                <Stack gap="md">
                    <TextField label="Item title" value={props.itemTitle} onChange={event => props.onSetItemTitle(event.target.value)} />
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
                onOpenChange={open => !open && props.onSetEditingTopicId("")}
                onValueChange={props.onSetEditTitle}
                onRename={props.onRename}
            />
            <RenameDialog
                title="Rename section"
                description="Update this sidebar section title."
                open={Boolean(props.editingSectionId)}
                value={props.editTitle}
                onOpenChange={open => !open && props.onSetEditingSectionId("")}
                onValueChange={props.onSetEditTitle}
                onRename={props.onRenameSection}
            />
        </>
    )
}

function RenameDialog({
    title,
    description,
    open,
    value,
    onOpenChange,
    onValueChange,
    onRename,
}: {
    title: string
    description: string
    open: boolean
    value: string
    onOpenChange: (open: boolean) => void
    onValueChange: (value: string) => void
    onRename: () => void
}) {
    return (
        <ModalDialog open={open} title={title} description={description} onOpenChange={onOpenChange}>
            <Stack gap="md">
                <TextField label={title} value={value} onChange={event => onValueChange(event.target.value)} />
                <Button icon={<Pencil size={15} />} variant="primary" onClick={onRename} fullWidth>
                    Rename
                </Button>
            </Stack>
        </ModalDialog>
    )
}
