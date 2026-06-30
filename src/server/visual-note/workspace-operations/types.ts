export { parseArticleContent, serializeArticleContent } from "@/lib/visual-note/article-content"
export type { ArticleBlock } from "@/lib/visual-note/article-content"
export {
    createDisplayInstance,
    defaultComponentData,
    defaultDisplayName,
    createNotebook as createNotebookRecord,
    createPage as createPageRecord,
    createTopic as createTopicRecord,
    createView as createViewRecord,
} from "@/lib/visual-note/factories"
export type { ComponentKind, Notebook, NotebookPage, NotebookView, Topic, ViewMode, VisualNoteWorkspace } from "@/lib/visual-note/types"
export { defaultVisualBlockData, isVisualBlockKind, serializeVisualBlockBody } from "@/lib/visual-note/visual-blocks"
export type { VisualBlockData, VisualBlockKind } from "@/lib/visual-note/visual-blocks"
export { createExportDocument } from "@/lib/visual-note/export/document"
export { renderMarkdownExport } from "@/lib/visual-note/export/markdown"
export { renderWebHtml } from "@/lib/visual-note/export/web"
export type { ArticleBlockInfoMode, ArticleContentsMode, NotebookEditorSettings } from "@/lib/visual-note/types"

export type WorkspaceOperationResult<T> = { ok: true; value: T & Record<string, unknown> } | { ok: false; error: "not_found" | "invalid_input"; message: string }

export type NotebookSummary = {
    id: string
    title: string
    slug: string
    summary: string
    color: string
    createdAt: string
    pageCount: number
    topicCount: number
    viewCount: number
    displayCount: number
}
