import { ArticleBlockInfoMode, ArticleContentsMode, VisualNoteWorkspace, WorkspaceOperationResult } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-001"

export type ContractCheck = {
    name: string
    passed: boolean
    details: string
}

export type SchemaEvolutionProposal = {
    scope: "notebook" | "page" | "topic" | "view"
    id: string
    title: string
    action: string
    reason: string
    migration?: Record<string, unknown>
}

export type WorkspaceOpportunity = {
    id: string
    scope: "notebook" | "page" | "topic" | "view"
    priority: "high" | "medium" | "low"
    action: string
    detail: string
    targetId: string
    targetTitle: string
}

export type ViewTitleCanonicalization = {
    targetType: "notebook" | "page" | "topic" | "view"
    targetId: string
    before: string
    after: string
}

export type DatasetCardField = {
    name: string
    type: "string" | "number" | "boolean" | "array" | "object" | "null" | "unknown"
    sample: unknown
}

export type PublishContractCheck = {
    name: string
    passed: boolean
    message: string
}

export type WorkspacePolicyRule = {
    id: string
    name: string
    severity: "low" | "medium" | "high"
    check: "notebook_summary" | "non_empty_titles" | "display_or_content" | "layout_density"
}

export type ChangePlanOperation = {
    tool: string
    input: Record<string, unknown>
}

export type ArticlePatchOperation =
    | { op: "insert"; index?: number; markdown: string }
    | { op: "replace"; index: number; markdown: string }
    | { op: "remove"; index: number }
    | { op: "move"; from: number; to: number }

export type WorkspaceMutationResultValue = object & { workspace: VisualNoteWorkspace }

export type PassableContractPayload = {
    passed?: boolean
}

export type ToolImpactReport = {
    tool: string
    touched: {
        notebooks: string[]
        pages: string[]
        topics: string[]
        views: string[]
        displays: string[]
    }
    issueCount: number
    warnings: string[]
}

export type ValidationAfterMutationResult = {
    workspaceChecks: Array<{ name: string; ok: boolean; details: string }>
    blockers: string[]
    warnings: string[]
}

export type PublishDiagnoseResult = {
    notebookId: string
    notebookTitle: string
    ready: boolean
    blockers: string[]
    warnings: string[]
    viewCount: number
    topicCount: number
    pageCount: number
}

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

export type MCPToolSummary = {
    name: string
    description: string
    input: string
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

export const hasPassedContract = (value: PassableContractPayload) => value.passed === true

export const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "notebook"

export const parseMarkdownSafePath = (path: string) =>
    path
        .split(".")
        .map(segment => segment.trim())
        .filter(Boolean)
        .map(segment => (/^\d+$/.test(segment) ? Number(segment) : segment))

export const setByPath = <T>(value: T, path: string, nextValue: unknown): T => {
    const segments = parseMarkdownSafePath(path)
    if (segments.length === 0) return nextValue as T

    const cloned = structuredClone(value as object) as Record<string, unknown>
    let cursor: Record<string, unknown> | unknown[] = cloned

    for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index]
        if (typeof segment === "number") {
            if (!Array.isArray(cursor)) return cloned as T

            if (cursor[segment] === undefined) cursor[segment] = {}
            cursor = cursor[segment] as Record<string, unknown>
            continue
        }

        if (cursor[segment] == null || typeof cursor[segment] !== "object" || Array.isArray(cursor[segment])) cursor[segment] = {}

        cursor = cursor[segment] as Record<string, unknown>
    }

    const last = segments[segments.length - 1]
    if (typeof last === "number") {
        if (!Array.isArray(cursor)) return cloned as T
        cursor[last] = nextValue
    } else cursor[last] = nextValue

    return cloned as T
}
