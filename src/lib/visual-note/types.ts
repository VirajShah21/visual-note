export type ComponentKind = "data-card" | "checklist" | "timeline" | "dashboard" | "work-logs" | "bugs-list" | "shopping-list" | "pull-request" | "url" | "code-block"

export type ViewMode = "article" | "structured" | "dashboard"
export type ArticleBlockInfoMode = "show" | "type-only" | "metadata-only"
export type ArticleContentsMode = "show" | "hide-title" | "hide"
export type ArticleEditorMode = "editing" | "source" | "reader"

export type NotebookEditorSettings = {
    blockInfo: ArticleBlockInfoMode
    contents: ArticleContentsMode
    mode: ArticleEditorMode
}

export const defaultNotebookEditorSettings: NotebookEditorSettings = {
    blockInfo: "show",
    contents: "show",
    mode: "editing",
}

export type VisualUser = {
    id: string
    email: string
    name: string
}

export type Notebook = {
    id: string
    userId: string
    title: string
    slug: string
    summary: string
    color: string
    createdAt: string
    editorSettings?: NotebookEditorSettings
}

export type NotebookPage = {
    id: string
    notebookId: string
    title: string
    position: number
}

export type NotebookSection = NotebookPage

export type Topic = {
    id: string
    pageId: string
    title: string
    summary: string
    position: number
}

export type NotebookView = {
    id: string
    topicId: string
    title: string
    mode: ViewMode
    content: string
    displays: DisplayInstance[]
    componentIds?: string[]
}

export type DisplayInstance = {
    id: string
    name: string
    kind: ComponentKind
    data: Record<string, unknown>
}

export type VisualComponent = DisplayInstance & {
    notebookId: string
    description: string
}

export type VisualNoteWorkspace = {
    notebooks: Notebook[]
    pages: NotebookPage[]
    topics: Topic[]
    views: NotebookView[]
    components?: VisualComponent[]
}

export type SelectionState = {
    notebookId: string
    pageId: string
    topicId: string
    viewId: string
}
