"use client"

import { Input } from "@base-ui/react/input"
import { BookOpen, Grid2X2, Home, LayoutTemplate, LogOut, MoreHorizontal, Plus, Search, Share2, Sparkles } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useMemo, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { Button } from "./button"
import { cx } from "./class-name"
import { ModalDialog } from "./overlays"
import { Heading, Pill, Stack, Text } from "./primitives"
import styles from "./notebook-home.module.css"

export type NotebookGalleryItem = {
    id: string
    title: string
    summary: string
    color: string
    href: string
    updatedLabel: string
    pageCount: number
    topicCount: number
    viewCount: number
    displayCount: number
    pageTitles: string[]
    topicTitles: string[]
}

type NotebookHomeProps = {
    userLabel: string
    storageLabel: string
    notebooks: NotebookGalleryItem[]
    onCreateNotebook: (title: string) => boolean
    onSignOut: () => void
}

export function NotebookHome({ userLabel, storageLabel, notebooks, onCreateNotebook, onSignOut }: NotebookHomeProps) {
    const [query, setQuery] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [title, setTitle] = useState("New web notebook")

    const filteredNotebooks = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        if (!normalizedQuery) return notebooks

        return notebooks.filter(notebook => [notebook.title, notebook.summary, ...notebook.pageTitles, ...notebook.topicTitles].some(value => value.toLowerCase().includes(normalizedQuery)))
    }, [notebooks, query])

    const createNotebook = () => {
        if (!onCreateNotebook(title)) return

        setTitle("New web notebook")
        setIsCreateOpen(false)
    }

    return (
        <NotebookHomeShell>
            <NotebookNavigationRail userLabel={userLabel} storageLabel={storageLabel} onSignOut={onSignOut} />
            <NotebookHomeContent>
                <NotebookTopBar query={query} onQueryChange={setQuery} onCreate={() => setIsCreateOpen(true)} />
                <NotebookGallery notebooks={filteredNotebooks} />
            </NotebookHomeContent>
            <ModalDialog open={isCreateOpen} title="Create notebook" description="Start a structured notebook website." onOpenChange={setIsCreateOpen}>
                <Stack gap="md">
                    <NotebookTitleField value={title} onChange={setTitle} />
                    <Button icon={<Plus size={15} />} variant="primary" onClick={createNotebook} fullWidth>
                        Create notebook
                    </Button>
                </Stack>
            </ModalDialog>
        </NotebookHomeShell>
    )
}

type NotebookHomeShellProps = {
    children: ReactNode
}

export function NotebookHomeShell({ children }: NotebookHomeShellProps) {
    return <motion.div className={styles.shell}>{children}</motion.div>
}

type NotebookHomeContentProps = {
    children: ReactNode
}

export function NotebookHomeContent({ children }: NotebookHomeContentProps) {
    return <motion.main className={styles.content}>{children}</motion.main>
}

type NotebookNavigationRailProps = {
    userLabel: string
    storageLabel: string
    onSignOut: () => void
}

export function NotebookNavigationRail({ userLabel, storageLabel, onSignOut }: NotebookNavigationRailProps) {
    return (
        <motion.aside className={styles.rail}>
            <Stack gap="lg">
                <Stack gap="sm">
                    <Pill className={styles.brandPill}>
                        <Sparkles size={14} />
                        Visual Note
                    </Pill>
                    <Text size="small">{userLabel}</Text>
                </Stack>
                <Stack gap="sm">
                    <NotebookNavItem active icon={<Home size={15} />} label="Home" />
                    <NotebookNavItem icon={<BookOpen size={15} />} label="Recent" />
                    <NotebookNavItem icon={<LayoutTemplate size={15} />} label="Templates" />
                    <NotebookNavItem icon={<Share2 size={15} />} label="Shared" />
                </Stack>
            </Stack>
            <Stack gap="sm">
                <Pill>{storageLabel}</Pill>
                <Button icon={<LogOut size={15} />} variant="ghost" onClick={onSignOut}>
                    Sign out
                </Button>
            </Stack>
        </motion.aside>
    )
}

type NotebookNavItemProps = {
    active?: boolean
    icon: ReactNode
    label: string
}

export function NotebookNavItem({ active = false, icon, label }: NotebookNavItemProps) {
    return (
        <Button className={cx(styles.navItem, active && styles.activeNavItem)} variant="ghost" fullWidth>
            {icon}
            {label}
        </Button>
    )
}

type NotebookTopBarProps = {
    query: string
    onQueryChange: (query: string) => void
    onCreate: () => void
}

export function NotebookTopBar({ query, onQueryChange, onCreate }: NotebookTopBarProps) {
    return (
        <motion.header className={styles.topBar}>
            <Stack gap="xs">
                <Heading as="h1" size="hero">
                    Notebooks
                </Heading>
                <Stack className={styles.statRow} direction="horizontal" gap="sm">
                    <Pill>
                        <Grid2X2 size={13} />
                        Gallery
                    </Pill>
                </Stack>
            </Stack>
            <Stack className={styles.topActions} direction="horizontal" gap="sm">
                <NotebookSearchField value={query} onChange={onQueryChange} />
                <Button icon={<Plus size={15} />} variant="primary" onClick={onCreate}>
                    New notebook
                </Button>
            </Stack>
        </motion.header>
    )
}

type NotebookTitleFieldProps = {
    value: string
    onChange: (value: string) => void
}

export function NotebookTitleField({ value, onChange }: NotebookTitleFieldProps) {
    return (
        <motion.label className={styles.titleField}>
            <span className={styles.fieldLabel}>Notebook title</span>
            <Input className={styles.titleInput} value={value} onChange={event => onChange(event.target.value)} />
        </motion.label>
    )
}

type NotebookSearchFieldProps = {
    value: string
    onChange: (value: string) => void
}

export function NotebookSearchField({ value, onChange }: NotebookSearchFieldProps) {
    return (
        <motion.label className={styles.searchField}>
            <span className={styles.visuallyHidden}>Search notebooks</span>
            <Search size={16} />
            <Input className={styles.searchInput} placeholder="Search notebooks" value={value} onChange={event => onChange(event.target.value)} />
        </motion.label>
    )
}

type NotebookGalleryProps = {
    notebooks: NotebookGalleryItem[]
}

export function NotebookGallery({ notebooks }: NotebookGalleryProps) {
    if (notebooks.length === 0)
        return (
            <motion.div className={styles.emptyGallery}>
                <Heading size="md">No notebooks found</Heading>
                <Text>Try a different search or create a new notebook.</Text>
            </motion.div>
        )

    return (
        <motion.div className={styles.gallery}>
            {notebooks.map((notebook, index) => (
                <NotebookGalleryCard key={notebook.id} notebook={notebook} index={index} />
            ))}
        </motion.div>
    )
}

type NotebookGalleryCardProps = {
    notebook: NotebookGalleryItem
    index: number
}

export function NotebookGalleryCard({ notebook, index }: NotebookGalleryCardProps) {
    return (
        <motion.article className={styles.card} initial={{ opacity: 0, y: 18, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ type: "spring", stiffness: 170, damping: 22, delay: index * 0.04 }}>
            <Link className={styles.cardLink} href={notebook.href} aria-label={`Open ${notebook.title}`}>
                <NotebookWebsitePreview notebook={notebook} />
                <Stack className={styles.cardBody} gap="sm">
                    <Stack className={styles.cardTitleRow} direction="horizontal" gap="sm">
                        <Stack gap="xs">
                            <Heading size="md">{notebook.title}</Heading>
                            <Text size="small">{notebook.updatedLabel}</Text>
                        </Stack>
                        <MoreHorizontal size={18} />
                    </Stack>
                    <Text>{notebook.summary}</Text>
                    <Stack className={styles.statRow} direction="horizontal" gap="xs">
                        <NotebookStat label="Pages" value={notebook.pageCount} />
                        <NotebookStat label="Topics" value={notebook.topicCount} />
                        <NotebookStat label="Views" value={notebook.viewCount} />
                        <NotebookStat label="Data" value={notebook.displayCount} />
                    </Stack>
                </Stack>
            </Link>
        </motion.article>
    )
}

type NotebookWebsitePreviewProps = {
    notebook: NotebookGalleryItem
}

export function NotebookWebsitePreview({ notebook }: NotebookWebsitePreviewProps) {
    const pageTitles = notebook.pageTitles.length > 0 ? notebook.pageTitles.slice(0, 3) : ["Home"]
    const topicTitles = notebook.topicTitles.length > 0 ? notebook.topicTitles.slice(0, 3) : ["Start"]

    return (
        <motion.div className={styles.preview} style={{ "--notebook-color": notebook.color } as CSSProperties}>
            <motion.div className={styles.browserBar}>
                <span />
                <span />
                <span />
            </motion.div>
            <motion.div className={styles.previewTopNav}>
                {pageTitles.map(page => (
                    <span key={page}>{page}</span>
                ))}
            </motion.div>
            <motion.div className={styles.previewSite}>
                <motion.div className={styles.previewSidebar}>
                    {topicTitles.map(topic => (
                        <span key={topic}>{topic}</span>
                    ))}
                </motion.div>
                <motion.div className={styles.previewCanvas}>
                    <span className={styles.previewHero} />
                    <span className={styles.previewLine} />
                    <span className={styles.previewLineShort} />
                    <motion.div className={styles.previewWidgets}>
                        <span />
                        <span />
                        <span />
                    </motion.div>
                </motion.div>
            </motion.div>
        </motion.div>
    )
}

type NotebookStatProps = {
    label: string
    value: number
}

export function NotebookStat({ label, value }: NotebookStatProps) {
    return (
        <span className={styles.stat}>
            {value} {label}
        </span>
    )
}
