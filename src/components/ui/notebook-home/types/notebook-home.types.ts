import type { ReactNode } from "react"

export type NotebookGalleryItem = {
    id: string
    title: string
    summary: string
    color: string
    href: string
    createdAt: string
    updatedLabel: string
    pageCount: number
    topicCount: number
    viewCount: number
    displayCount: number
    pageTitles: string[]
    topicTitles: string[]
}

export type NotebookHomeProps = {
    userLabel: string
    storageLabel: string
    notebooks: NotebookGalleryItem[]
    onCreateNotebook: (title: string) => boolean
    onSignOut: () => void
}

export type NotebookHomeShellProps = {
    children: ReactNode
}

export type NotebookHomeContentProps = {
    children: ReactNode
}

export type NotebookNavigationRailProps = {
    userLabel: string
    storageLabel: string
    onSignOut: () => void
}

export type NotebookNavItemProps = {
    active?: boolean
    icon: ReactNode
    label: string
}

export type NotebookTopBarProps = {
    query: string
    onQueryChange: (query: string) => void
    onCreate: () => void
}

export type NotebookTitleFieldProps = {
    value: string
    onChange: (value: string) => void
}

export type NotebookSearchFieldProps = {
    value: string
    onChange: (value: string) => void
}

export type NotebookGalleryProps = {
    notebooks: NotebookGalleryItem[]
}

export type NotebookGalleryCardProps = {
    notebook: NotebookGalleryItem
    index: number
}

export type NotebookWebsitePreviewProps = {
    notebook: NotebookGalleryItem
}

export type NotebookStatProps = {
    label: string
    value: number
}
