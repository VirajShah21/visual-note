export type ComponentKind = "data-card" | "checklist" | "timeline" | "dashboard" | "work-logs" | "bugs-list" | "shopping-list" | "pull-request" | "url" | "code-block"

export type ViewMode = "article" | "structured" | "dashboard"

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
}

export type NotebookPage = {
  id: string
  notebookId: string
  title: string
  position: number
}

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
