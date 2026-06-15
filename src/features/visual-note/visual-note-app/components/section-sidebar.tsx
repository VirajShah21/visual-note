"use client"

import { PanelLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Button, ContextActions, Heading, InfoPopover, Pill, ScrollArea, Stack } from "@/components/ui"
import type { SectionSidebarProps } from "../types/visual-note-app.types"
import styles from "../../visual-note-app.module.css"
import { SectionDialogs } from "./section-sidebar-dialogs"

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

    const create = useCallback(() => {
        if (!onCreateSection(title)) return
        setTitle("New section")
        setIsCreateOpen(false)
    }, [onCreateSection, title])
    const createTopic = useCallback(() => {
        if (!activeSectionIdForTopic || !onCreateTopic(activeSectionIdForTopic, itemTitle)) return
        setItemTitle("New item")
        setIsCreateTopicOpen(false)
    }, [activeSectionIdForTopic, itemTitle, onCreateTopic])
    const openEditTopic = useCallback(
        (topicId: string) => {
            const topic = topics.find(item => item.id === topicId)
            if (!topic) return
            setEditingTopicId(topic.id)
            setEditTitle(topic.title)
        },
        [topics],
    )
    const openEditSection = useCallback(
        (sectionId: string) => {
            const section = sections.find(item => item.id === sectionId)
            if (!section) return
            setEditingSectionId(section.id)
            setEditTitle(section.title)
        },
        [sections],
    )
    const renameSection = useCallback(() => {
        if (!onRenameSection(editingSectionId, editTitle)) return
        setEditingSectionId("")
        setEditTitle("")
    }, [editTitle, editingSectionId, onRenameSection])
    const rename = useCallback(() => {
        if (!onRenameTopic(editingTopicId, editTitle)) return
        setEditingTopicId("")
        setEditTitle("")
    }, [editTitle, editingTopicId, onRenameTopic])
    const openTopicCreator = useCallback((sectionId: string) => {
        setActiveSectionIdForTopic(sectionId)
        setItemTitle("New item")
        setIsCreateTopicOpen(true)
    }, [])
    const openCreateDialog = useCallback(() => setIsCreateOpen(true), [])

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
                <Button icon={<Plus size={15} />} onClick={openCreateDialog} fullWidth>
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
    const renameSectionItem = useMemo(
        () => ({ label: "Rename section", icon: <Pencil size={14} />, onSelect: () => onOpenEditSection(section.id) }),
        [onOpenEditSection, section.id],
    )
    const deleteSectionItem = useMemo(() => ({ label: "Delete section", icon: <Trash2 size={14} />, onSelect: () => onDeleteSection(section.id) }), [onDeleteSection, section.id])
    const sectionItems = useMemo(() => [renameSectionItem, deleteSectionItem], [deleteSectionItem, renameSectionItem])
    const handleSelectSection = useCallback(() => onSelectSection(section.id), [onSelectSection, section.id])
    const handleOpenTopicCreator = useCallback(() => onOpenTopicCreator(section.id), [onOpenTopicCreator, section.id])

    return (
        <Stack className={styles.sectionGroup} gap="sm">
            <ContextActions className={styles.sectionHeaderTrigger} items={sectionItems}>
                <Heading className={`${styles.sectionTitle} ${section.id === activeSectionId ? styles.activeSectionTitle : ""}`} size="sm" onClick={handleSelectSection}>
                    {section.title}
                </Heading>
            </ContextActions>
            <Stack className={styles.sectionPageList} gap="xs">
                {topics.map(topic => (
                    <SectionTopicItem
                        key={topic.id}
                        topic={topic}
                        activeTopicId={activeTopicId}
                        onDeleteTopic={onDeleteTopic}
                        onOpenEditTopic={onOpenEditTopic}
                        onSelectTopic={onSelectTopic}
                    />
                ))}
                <Button icon={<Plus size={15} />} onClick={handleOpenTopicCreator} fullWidth>
                    New item
                </Button>
            </Stack>
        </Stack>
    )
}

type SectionTopicItemProps = {
    topic: SectionSidebarProps["topics"][number]
    activeTopicId: string
    onDeleteTopic: (topicId: string) => boolean
    onOpenEditTopic: (topicId: string) => void
    onSelectTopic: (topicId: string) => void
}

function SectionTopicItem({ topic, activeTopicId, onDeleteTopic, onOpenEditTopic, onSelectTopic }: SectionTopicItemProps) {
    const renameItem = useMemo(() => ({ label: "Rename item", icon: <Pencil size={14} />, onSelect: () => onOpenEditTopic(topic.id) }), [onOpenEditTopic, topic.id])
    const deleteItem = useMemo(() => ({ label: "Delete item", icon: <Trash2 size={14} />, onSelect: () => onDeleteTopic(topic.id) }), [onDeleteTopic, topic.id])
    const items = useMemo(() => [renameItem, deleteItem], [deleteItem, renameItem])
    const handleSelect = useCallback(() => onSelectTopic(topic.id), [onSelectTopic, topic.id])

    return (
        <ContextActions className={styles.topicContextTrigger} items={items}>
            <Button className={`${styles.navButton} ${styles.topicSelectButton} ${topic.id === activeTopicId ? styles.activeNavButton : ""}`} onClick={handleSelect} fullWidth>
                {topic.title}
            </Button>
        </ContextActions>
    )
}
