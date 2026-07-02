import { ArticleBlockInfoMode, ArticleContentsMode, VisualNoteWorkspace, WorkspaceOperationResult } from "./types"

export type ArticlePatchOperation =
    | { op: "insert"; index?: number; markdown: string }
    | { op: "replace"; index: number; markdown: string }
    | { op: "remove"; index: number }
    | { op: "move"; from: number; to: number }

export type HealthCheckIssue = {
    severity: "warning" | "error"
    message: string
    scope: "notebook" | "page" | "topic" | "view"
    id: string
}

export type HealthCheckResult = {
    notebookCount: number
    pageCount: number
    topicCount: number
    viewCount: number
    issues: HealthCheckIssue[]
}

export type OrphanAnalysisResult = {
    orphanPages: string[]
    orphanTopics: string[]
    orphanViews: string[]
    repairedWorkspace?: VisualNoteWorkspace
    repaired: boolean
}

export type Positioned = {
    id: string
    position?: number
}

export const createId = () => `${Date.now()}-${crypto.randomUUID()}`

export const defaultEditorSettings = {
    blockInfo: "show" as ArticleBlockInfoMode,
    contents: "show" as ArticleContentsMode,
    mode: "editing" as const,
}

export const ok = <T>(value: T): WorkspaceOperationResult<T> => ({ ok: true, value: value as T & Record<string, unknown> })

export const notFound = (message: string): WorkspaceOperationResult<never> => ({ ok: false, error: "not_found", message })

export const invalidInput = (message: string): WorkspaceOperationResult<never> => ({ ok: false, error: "invalid_input", message })

export const byPosition = <T extends Positioned>(items: T[]) => [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

export const normalizeTitle = (value: string) => value.trim().toLowerCase()

export const safeTrim = (value?: string) => (value ? value.trim() : "")

export const clampIndex = (value: number, max: number) => Math.max(0, Math.min(Math.floor(value), max))

export const cloneWorkspace = (workspace: VisualNoteWorkspace) => JSON.parse(JSON.stringify(workspace)) as VisualNoteWorkspace

export const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "notebook"
