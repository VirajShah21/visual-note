"use client"

import { Button as BaseButton } from "@base-ui/react/button"
import { Input } from "@base-ui/react/input"
import { BookOpen, Braces, Download, Eye, FileCode2, Info, ListTree, PanelLeftClose, PanelLeftOpen, PencilLine, Search, Settings } from "lucide-react"
import { useCallback, type ChangeEventHandler, type MouseEventHandler } from "react"
import type { ArticleBlockInfoMode, ArticleContentsMode, ArticleEditorMode, NotebookEditorSettings } from "@/lib/visual-note/types"
import type { NotebookSearchResult } from "@/lib/visual-note/search"
import { Button } from "./button"
import { cx } from "./class-name"
import styles from "./notebook-editor-navbar.module.css"
import { ToolbarMenu, type ToolbarMenuGroup } from "./toolbar-menu"

export type NotebookEditorNavbarProps = {
    searchQuery: string
    searchResults: NotebookSearchResult[]
    searchHasMore: boolean
    searchLoading: boolean
    searchError: boolean
    sidebarOpen: boolean
    editorSettings: NotebookEditorSettings
    onExport: () => void
    onSearchLoadMore: () => void
    onSearchChange: (query: string) => void
    onSearchResultSelect: (result: NotebookSearchResult) => void
    onMoreSettings: () => void
    onSettingsChange: (settings: Partial<NotebookEditorSettings>) => void
    onToggleSidebar: () => void
}

export function NotebookEditorNavbar({
    searchQuery,
    searchResults,
    searchHasMore,
    searchLoading,
    searchError,
    sidebarOpen,
    editorSettings,
    onExport,
    onSearchChange,
    onSearchLoadMore,
    onSearchResultSelect,
    onMoreSettings,
    onSettingsChange,
    onToggleSidebar,
}: NotebookEditorNavbarProps) {
    const handleSearchChange: ChangeEventHandler<HTMLInputElement> = useCallback(event => onSearchChange(event.target.value), [onSearchChange])
    const handleSearchLoadMore: MouseEventHandler<HTMLButtonElement> = useCallback(
        event => {
            event.preventDefault()
            onSearchLoadMore()
        },
        [onSearchLoadMore],
    )
    const hasQuery = searchQuery.trim().length > 0
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
    const settingsActions = [
        {
            id: "more-settings",
            label: "More Settings",
            icon: <Settings size={14} />,
            onSelect: onMoreSettings,
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
            </div>
            <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} size={16} />
                <Input className={styles.searchInput} value={searchQuery} placeholder="Search notebook" aria-label="Search notebook" onChange={handleSearchChange} />
                {hasQuery ? (
                    <div className={styles.searchResults} role="listbox" aria-label="Notebook search results">
                        {searchResults.length ? (
                            searchResults.map(result => <SearchResultItem key={result.id} result={result} onSearchResultSelect={onSearchResultSelect} />)
                        ) : searchLoading ? (
                            <span className={styles.emptyResults}>Searching...</span>
                        ) : searchError ? (
                            <span className={styles.emptyResults}>Unable to search right now.</span>
                        ) : (
                            <span className={styles.emptyResults}>No matches in this notebook</span>
                        )}

                        {searchHasMore ? (
                            <Button className={styles.searchLoadMore} disabled={searchLoading} onClick={handleSearchLoadMore} variant="secondary">
                                Load more results
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>
            <div className={styles.rightGroup}>
                <ToolbarMenu label="Notebook editor settings" icon={<Settings size={16} />} groups={settingsGroups} actions={settingsActions} />
                <Button icon={<Download size={15} />} variant="secondary" onClick={onExport}>
                    Export
                </Button>
            </div>
        </div>
    )
}

function SearchResultItem({ result, onSearchResultSelect }: { result: NotebookSearchResult; onSearchResultSelect: (result: NotebookSearchResult) => void }) {
    const handleSelect = useCallback(() => onSearchResultSelect(result), [onSearchResultSelect, result])

    return (
        <BaseButton className={styles.searchResult} role="option" aria-selected={false} onClick={handleSelect}>
            <span className={styles.resultHeader}>
                <span className={styles.resultTitle}>{result.title}</span>
                <span className={cx(styles.resultBadge, result.isCurrentPage && styles.resultBadgeActive)}>{result.isCurrentPage ? "Current page" : "Other page"}</span>
            </span>
            <span className={styles.resultLocation}>{result.location}</span>
            <span className={styles.resultContext}>{result.context}</span>
        </BaseButton>
    )
}
