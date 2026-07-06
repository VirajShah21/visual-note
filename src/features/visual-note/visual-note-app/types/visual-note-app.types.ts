import type { DisplayInstance, NotebookEditorSettings, NotebookPage, NotebookView, VisualNoteWorkspace } from "@/lib/visual-note/types"
import type { VisualBlockData, VisualBlockKind } from "@/lib/visual-note/visual-blocks"
import type { NotebookEditorRecentNotebook } from "@/components/ui"

export type VisualNoteAppProps = {
    mode?: "home" | "notebook"
    initialNotebookId?: string
}

export type WorkspaceRecoveryStatus = "synced" | "saving" | "offline" | "conflict" | "error"

export type AuthPanelProps = {
    authStatus: "ready" | "unconfigured"
    notice: string
    onSignIn: (email: string, password: string, name?: string) => Promise<void>
    onRegister: (email: string, password: string, name: string) => Promise<void>
}

export type SectionSidebarProps = {
    sections: NotebookPage[]
    topics: VisualNoteWorkspace["topics"]
    activeSectionId: string
    activeTopicId: string
    currentNotebookId?: string
    notebookTitle?: string
    recentNotebooks?: NotebookEditorRecentNotebook[]
    onCreateSection: (title: string) => boolean
    onRenameSection: (sectionId: string, title: string) => boolean
    onDeleteSection: (sectionId: string) => boolean
    onCreateTopic: (sectionId: string, title: string) => boolean
    onRenameTopic: (topicId: string, title: string) => boolean
    onDeleteTopic: (topicId: string) => boolean
    onHomeSelect: () => void
    onNotebookSelect: (notebookId: string) => void
    onSelectTopic: (topicId: string) => void
    onSelectSection: (sectionId: string) => void
}

export type ViewWorkspaceProps = {
    view: NotebookView | null
    editorSettings: NotebookEditorSettings
    onUpdateView: (view: NotebookView) => void
    onUpdateDisplay: (display: DisplayInstance) => void
    onUploadImage?: (file: File) => Promise<{ url: string; alt?: string }>
}

export type ArticleWorkspaceProps = {
    view: NotebookView
    editorSettings: NotebookEditorSettings
    onUpdateView: (view: NotebookView) => void
    onUpdateDisplay: (display: DisplayInstance) => void
    onUploadImage?: (file: File) => Promise<{ url: string; alt?: string }>
}

export type VisualBlockDisplayProps = {
    visualKind: VisualBlockKind
    data: VisualBlockData
    raw: string
    parseError?: string
    isReadOnly?: boolean
    onDataChange: (data: VisualBlockData) => void
}

export type DisplayDataEditorProps = {
    display: DisplayInstance
    onDataChange: (data: Record<string, unknown>) => void
}

export type RenderedDisplayProps = {
    display: DisplayInstance
    onUpdate: (display: DisplayInstance) => void
    isReadOnly?: boolean
}
