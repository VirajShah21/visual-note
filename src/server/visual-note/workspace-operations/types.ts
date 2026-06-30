import type { ChangePlanOperation } from "./result"
import type { Notebook, NotebookPage, NotebookView, Topic, ViewMode } from "@/lib/visual-note/types"

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

export type NotebookTree = Notebook & {
    pages: Array<NotebookPage & { topics: Array<Topic & { views: NotebookView[] }> }>
}

export type SearchMatch = {
    kind: "notebook" | "page" | "topic" | "view" | "display"
    id: string
    title: string
    notebookId: string
    pageId?: string
    topicId?: string
    viewId?: string
    snippet?: string
    score: number
}

export type SearchWorkspaceResult = {
    query: string
    matches: SearchMatch[]
}

export type SemanticSearchMatch = SearchMatch & { semanticScore: number }

export type SearchWorkspaceSemanticResult = {
    query: string
    matches: SemanticSearchMatch[]
    notes: string[]
}

export type DuplicateContentMatch = {
    scope: "notebook" | "page" | "topic" | "view"
    kind: "title" | "content"
    canonical: string
    ids: string[]
    title: string
}

export type DuplicateContentReport = {
    notebookId?: string
    matches: DuplicateContentMatch[]
    totalGroups: number
}

export type NextStepSuggestion = {
    priority: "high" | "medium" | "low"
    action: string
    detail: string
}

export type LayoutSuggestion = {
    mode: ViewMode
    reason: string
    addedDisplays: string[]
    changed: boolean
}

export type RenderProfile = {
    viewId: string
    blockCount: number
    headingCount: number
    displayCount: number
    visualBlockCount: number
    rawLength: number
    estimatedComplexity: "low" | "medium" | "high"
    estimatedRenderCost: number
}

export type TopicSemanticsEdge = {
    topicId: string
    score: number
    reason: string
}

export type TopicSemanticsNode = {
    topicId: string
    pageId: string
    notebookId: string
    title: string
    summary: string
}

export type TopicSemanticsGraph = {
    notebookId?: string
    nodes: TopicSemanticsNode[]
    edges: Array<{
        fromTopicId: string
        toTopicId: string
        weight: number
        reason: string
    }>
}

export type ExecutionRiskProfile = {
    plan: ChangePlanOperation[]
    overallRisk: "low" | "medium" | "high"
    operationRisk: Array<{
        index: number
        tool: string
        risk: "low" | "medium" | "high"
        reasons: string[]
    }>
    blockerRisk: string[]
}

export type ReconciliationCandidate = {
    sourceViewId: string
    link: string
    kind: "markdown-link" | "display-url"
    context: string
    status: "unresolved" | "supported"
}

export type AgenticObservationInput = {
    action: "read" | "append"
    maxItems?: number
    goal?: string
    status?: "ok" | "warning" | "failed"
    summary?: string
    plan?: Array<{ tool: string; input: Record<string, unknown> }>
    blockers?: string[]
    note?: string
}

export type AgenticPlanGuardrailRisk = {
    name: string
    level: "low" | "medium" | "high"
    reason: string
    recommendation?: string
}

export type AgenticDryRunResult = {
    status: "ok" | "risk" | "blocked"
    before: { notebooks: number; pages: number; topics: number; views: number; displays: number }
    after: { notebooks: number; pages: number; topics: number; views: number; displays: number }
    touched: {
        notebooks: string[]
        pages: string[]
        topics: string[]
        views: string[]
    }
    operationReports: Array<{ tool: string; input: Record<string, unknown>; issueCount: number; warnings: string[] }>
    changed: number
    blockedCount: number
    warnings: string[]
}

export type AgenticToolCandidate = {
    tool: string
    confidence: number
    reason: string
    suggestedInput?: Record<string, unknown>
}

export type AgenticWorkflowStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

export type AgenticWorkflowJob = {
    jobId: string
    goal?: string
    notebookId?: string
    status: AgenticWorkflowStatus
    execute: boolean
    dryRun: boolean
    createdAt: string
    updatedAt: string
    stepCount: number
    blockers: string[]
    warnings: string[]
    note: string
    plan?: Array<{ tool: string; input: Record<string, unknown> }>
    result?: {
        blockers: string[]
        warnings: string[]
        validation?: {
            blockers: string[]
            warnings: string[]
            blockersCount: number
            warningCount: number
        }
    }
}

export type DriftReason = {
    scope: "notebook" | "page" | "topic" | "view"
    id: string
    title: string
    reason: string
    suggestion: string
}
