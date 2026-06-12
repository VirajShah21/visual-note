"use client"

import { Popover } from "@base-ui/react/popover"
import { BookOpen, BookOpenText, Braces, Download, Eye, FileCode2, Home, Info, ListTree, PanelLeftClose, PanelLeftOpen, PencilLine, Search, Settings } from "lucide-react"
import { useMemo, useState, type ChangeEventHandler } from "react"
import type { ArticleBlockInfoMode, ArticleContentsMode, ArticleEditorMode, NotebookEditorSettings } from "@/lib/visual-note/types"
import { Button } from "./button"
import { cx } from "./class-name"
import styles from "./notebook-editor-navbar.module.css"
import { ToolbarMenu, type ToolbarMenuGroup } from "./toolbar-menu"

export type NotebookEditorSearchResult = {
    id: string
    pageId: string
    topicId: string
    viewId: string
    title: string
    context: string
    location: string
    isCurrentPage: boolean
}

export type NotebookEditorRecentNotebook = {
    id: string
    title: string
    summary: string
    color: string
    updatedLabel: string
    createdAt?: string
}

export type NotebookEditorNavbarProps = {
    searchQuery: string
    searchResults: NotebookEditorSearchResult[]
    sidebarOpen: boolean
    editorSettings: NotebookEditorSettings
    currentNotebookId?: string
    notebookTitle?: string
    onExport: () => void
    onHomeSelect: () => void
    onNotebookSelect: (notebookId: string) => void
    onSearchChange: (query: string) => void
    onSearchResultSelect: (result: NotebookEditorSearchResult) => void
    onSettingsChange: (settings: Partial<NotebookEditorSettings>) => void
    onToggleSidebar: () => void
    recentNotebooks?: NotebookEditorRecentNotebook[]
}

export function NotebookEditorNavbar({
    searchQuery,
    searchResults,
    sidebarOpen,
    editorSettings,
    currentNotebookId = "",
    notebookTitle = "Visual Note",
    onExport,
    onHomeSelect,
    onNotebookSelect,
    onSearchChange,
    onSearchResultSelect,
    onSettingsChange,
    onToggleSidebar,
    recentNotebooks = [],
}: NotebookEditorNavbarProps) {
    const [isNotebookSwitcherOpen, setIsNotebookSwitcherOpen] = useState(false)
    const handleSearchChange: ChangeEventHandler<HTMLInputElement> = event => onSearchChange(event.target.value)
    const hasQuery = searchQuery.trim().length > 0
    const switcherNotebooks = useMemo(
        () =>
            [...recentNotebooks]
                .filter(notebook => notebook.id !== currentNotebookId)
                .sort((first, second) => Date.parse(second.createdAt ?? "") - Date.parse(first.createdAt ?? ""))
                .slice(0, 3),
        [currentNotebookId, recentNotebooks],
    )
    const selectHome = () => {
        setIsNotebookSwitcherOpen(false)
        onHomeSelect()
    }
    const selectNotebook = (notebookId: string) => {
        setIsNotebookSwitcherOpen(false)
        onNotebookSelect(notebookId)
    }
    const settingsGroups: ToolbarMenuGroup[] = [
        {
            id: "block-info",
            label: "Block Info",
            icon: <Info size={15} />,
            value: editorSettings.blockInfo,
            onValueChange: value => onSettingsChange({ blockInfo: value as ArticleBlockInfoMode }),
            options: [
                { label: "Show", value: "show", icon: <Eye size={14} /> },
                { label: "Show Type Only", value: "type-only", icon: <Braces size={14} /> },
                { label: "Show Metadata Only", value: "metadata-only", icon: <Info size={14} /> },
            ],
        },
        {
            id: "outline",
            label: "Outline",
            icon: <ListTree size={15} />,
            value: editorSettings.contents,
            onValueChange: value => onSettingsChange({ contents: value as ArticleContentsMode }),
            options: [
                { label: "Show", value: "show", icon: <Eye size={14} /> },
                { label: "Hide Title", value: "hide-title", icon: <ListTree size={14} /> },
                { label: "Hide", value: "hide", icon: <PanelLeftClose size={14} /> },
            ],
        },
        {
            id: "mode",
            label: "Mode",
            icon: <PencilLine size={15} />,
            value: editorSettings.mode,
            onValueChange: value => onSettingsChange({ mode: value as ArticleEditorMode }),
            options: [
                { label: "Editing", value: "editing", icon: <PencilLine size={14} /> },
                { label: "Source Code", value: "source", icon: <FileCode2 size={14} /> },
                { label: "Reader", value: "reader", icon: <BookOpen size={14} /> },
            ],
        },
    ]

    return (
        <div className={styles.navbar}>
            <div className={styles.leftGroup}>
                <Button
                    aria-label={sidebarOpen ? "Collapse sections sidebar" : "Expand sections sidebar"}
                    icon={sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                    iconOnly
                    variant="ghost"
                    onClick={onToggleSidebar}
                />
                <Popover.Root open={isNotebookSwitcherOpen} onOpenChange={setIsNotebookSwitcherOpen}>
                    <Popover.Trigger className={styles.brandButton} aria-label="Switch notebook">
                        <span className={styles.brandMark}>
                            <BookOpenText size={17} />
                        </span>
                        <span className={styles.brandText}>
                            <span className={styles.brandName}>Visual Note</span>
                            <span className={styles.notebookTitle}>{notebookTitle}</span>
                        </span>
                    </Popover.Trigger>
                    <Popover.Portal>
                        <Popover.Positioner className={styles.switcherPositioner} side="bottom" align="start" sideOffset={8} collisionPadding={12}>
                            <Popover.Popup className={styles.switcherPopup}>
                                <Popover.Title className={styles.switcherTitle}>Switch notebook</Popover.Title>
                                <button className={styles.switcherItem} type="button" onClick={selectHome}>
                                    <span className={styles.switcherIcon}>
                                        <Home size={15} />
                                    </span>
                                    <span className={styles.switcherText}>
                                        <span className={styles.switcherName}>Home</span>
                                        <span className={styles.switcherMeta}>All notebooks</span>
                                    </span>
                                </button>
                                {switcherNotebooks.map(notebook => (
                                    <button key={notebook.id} className={styles.switcherItem} type="button" onClick={() => selectNotebook(notebook.id)}>
                                        <span className={styles.notebookSwatch} style={{ backgroundColor: notebook.color }} />
                                        <span className={styles.switcherText}>
                                            <span className={styles.switcherName}>{notebook.title}</span>
                                            <span className={styles.switcherMeta}>{notebook.updatedLabel}</span>
                                        </span>
                                    </button>
                                ))}
                            </Popover.Popup>
                        </Popover.Positioner>
                    </Popover.Portal>
                </Popover.Root>
            </div>
            <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} size={16} />
                <input className={styles.searchInput} value={searchQuery} placeholder="Search notebook" aria-label="Search notebook" onChange={handleSearchChange} />
                {hasQuery ? (
                    <div className={styles.searchResults} role="listbox" aria-label="Notebook search results">
                        {searchResults.length ? (
                            searchResults.map(result => (
                                <button
                                    key={result.id}
                                    className={styles.searchResult}
                                    type="button"
                                    role="option"
                                    aria-selected={false}
                                    onClick={() => onSearchResultSelect(result)}
                                >
                                    <span className={styles.resultHeader}>
                                        <span className={styles.resultTitle}>{result.title}</span>
                                        <span className={cx(styles.resultBadge, result.isCurrentPage && styles.resultBadgeActive)}>
                                            {result.isCurrentPage ? "Current page" : "Other page"}
                                        </span>
                                    </span>
                                    <span className={styles.resultLocation}>{result.location}</span>
                                    <span className={styles.resultContext}>{result.context}</span>
                                </button>
                            ))
                        ) : (
                            <span className={styles.emptyResults}>No matches in this notebook</span>
                        )}
                    </div>
                ) : null}
            </div>
            <div className={styles.rightGroup}>
                <ToolbarMenu label="Notebook editor settings" icon={<Settings size={16} />} groups={settingsGroups} />
                <Button icon={<Download size={15} />} variant="secondary" onClick={onExport}>
                    Export
                </Button>
            </div>
        </div>
    )
}
