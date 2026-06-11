"use client"

import { BookOpenText, Download, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import type { ChangeEventHandler } from "react"
import { Button } from "./button"
import { cx } from "./class-name"
import styles from "./notebook-editor-navbar.module.css"

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

export type NotebookEditorNavbarProps = {
    searchQuery: string
    searchResults: NotebookEditorSearchResult[]
    sidebarOpen: boolean
    notebookTitle?: string
    onExport: () => void
    onSearchChange: (query: string) => void
    onSearchResultSelect: (result: NotebookEditorSearchResult) => void
    onToggleSidebar: () => void
}

export function NotebookEditorNavbar({
    searchQuery,
    searchResults,
    sidebarOpen,
    notebookTitle = "Visual Note",
    onExport,
    onSearchChange,
    onSearchResultSelect,
    onToggleSidebar,
}: NotebookEditorNavbarProps) {
    const handleSearchChange: ChangeEventHandler<HTMLInputElement> = event => onSearchChange(event.target.value)
    const hasQuery = searchQuery.trim().length > 0

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
                <div className={styles.brandArea} aria-label="Visual Note">
                    <span className={styles.brandMark}>
                        <BookOpenText size={17} />
                    </span>
                    <span className={styles.brandText}>
                        <span className={styles.brandName}>Visual Note</span>
                        <span className={styles.notebookTitle}>{notebookTitle}</span>
                    </span>
                </div>
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
            <Button icon={<Download size={15} />} variant="secondary" onClick={onExport}>
                Export
            </Button>
        </div>
    )
}
