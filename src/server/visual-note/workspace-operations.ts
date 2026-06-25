/* eslint-disable max-lines */
import { parseArticleContent, serializeArticleContent, type ArticleBlock } from "@/lib/visual-note/article-content"
import {
    createDisplayInstance,
    defaultComponentData,
    defaultDisplayName,
    createNotebook as createNotebookRecord,
    createPage as createPageRecord,
    createTopic as createTopicRecord,
    createView as createViewRecord,
} from "@/lib/visual-note/factories"
import type { ComponentKind, Notebook, NotebookPage, NotebookView, Topic, ViewMode, VisualNoteWorkspace } from "@/lib/visual-note/types"
import { defaultVisualBlockData, isVisualBlockKind, serializeVisualBlockBody, type VisualBlockData, type VisualBlockKind } from "@/lib/visual-note/visual-blocks"
import { createExportDocument } from "@/lib/visual-note/export/document"
import { renderMarkdownExport } from "@/lib/visual-note/export/markdown"
import { renderWebHtml } from "@/lib/visual-note/export/web"
import type { ArticleBlockInfoMode, ArticleContentsMode, NotebookEditorSettings } from "@/lib/visual-note/types"

export type WorkspaceOperationResult<T> = { ok: true; value: T } | { ok: false; error: "not_found" | "invalid_input"; message: string }

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

type Positioned = {
    id: string
    position: number
}

const createId = () => `${Date.now()}-${crypto.randomUUID()}`
const defaultEditorSettings = {
    blockInfo: "show" as ArticleBlockInfoMode,
    contents: "show" as ArticleContentsMode,
    mode: "editing" as const,
}

const ok = <T>(value: T): WorkspaceOperationResult<T> => ({ ok: true, value })
const notFound = (message: string): WorkspaceOperationResult<never> => ({ ok: false, error: "not_found", message })
const invalidInput = (message: string): WorkspaceOperationResult<never> => ({ ok: false, error: "invalid_input", message })

const byPosition = <T extends Positioned>(items: T[]) => [...items].sort((a, b) => a.position - b.position)
const normalizeTitle = (value: string) => value.trim().toLowerCase()
const safeTrim = (value?: string) => (value ? value.trim() : "")
const clampIndex = (value: number, max: number) => Math.max(0, Math.min(Math.floor(value), max))
const cloneWorkspace = (workspace: VisualNoteWorkspace) => JSON.parse(JSON.stringify(workspace)) as VisualNoteWorkspace

const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "notebook"

const parseMarkdownSafePath = (path: string) =>
    path
        .split(".")
        .map(segment => segment.trim())
        .filter(Boolean)
        .map(segment => (/^\d+$/.test(segment) ? Number(segment) : segment))

const setByPath = <T>(value: T, path: string, nextValue: unknown): T => {
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

const cloneWithNewIds = (value: unknown) => {
    if (!value) return value
    if (typeof value !== "object") return value

    if (Array.isArray(value)) return value.map(cloneWithNewIds)

    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (key === "id" && typeof item === "string") return [key, `clone-${createId()}`]
            return [key, cloneWithNewIds(item)]
        }),
    )
}

const parseCsvRecords = (text: string) => {
    const rows = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line =>
            line
                .split(",")
                .map(item => item.trim().replace(/^"|"$/g, ""))
                .map(item => (item === "" ? null : item)),
        )
    if (rows.length === 0 || rows[0]!.length === 0) return []

    const headers = rows[0]!.map(column => String(column).toLowerCase())
    return rows.slice(1).map(row => {
        const item: Record<string, unknown> = {}
        headers.forEach((header, index) => {
            const next = row[index]
            item[header] = next
        })
        return item
    })
}

const inferComponentKindFromData = (data: unknown) => {
    if (Array.isArray(data) && data.every(item => item && typeof item === "object")) {
        const reasons: string[] = []

        if (data.every(item => Object.prototype.hasOwnProperty.call(item, "done") || Object.prototype.hasOwnProperty.call(item, "purchased"))) {
            reasons.push("Array entries include task or completion markers.")
            return { kind: "checklist" as ComponentKind, confidence: 0.9, reasons }
        }

        if (data.length > 0 && Object.prototype.hasOwnProperty.call(data[0] as object, "label") && Object.prototype.hasOwnProperty.call(data[0] as object, "date")) {
            reasons.push("Array entries look like time-ordered events.")
            return { kind: "timeline" as ComponentKind, confidence: 0.82, reasons }
        }

        if (data.every(item => item && typeof item === "object" && ("workHours" in (item as object) || "title" in (item as object)))) {
            reasons.push("Array includes log-like fields.")
            return { kind: "work-logs" as ComponentKind, confidence: 0.7, reasons }
        }

        reasons.push("Generic table-like array.")
        return { kind: "data-card" as ComponentKind, confidence: 0.6, reasons }
    }

    if (data && typeof data === "object" && !Array.isArray(data)) {
        const item = data as Record<string, unknown>
        if ("events" in item && Array.isArray(item.events)) return { kind: "timeline" as ComponentKind, confidence: 0.9, reasons: ["Object has event list."] }
        if ("items" in item && Array.isArray(item.items)) return { kind: "shopping-list" as ComponentKind, confidence: 0.82, reasons: ["Object has item list."] }
        if ("bugs" in item && Array.isArray(item.bugs)) return { kind: "bugs-list" as ComponentKind, confidence: 0.85, reasons: ["Object has bug list."] }
        if ("prUrl" in item || "prNumber" in item || "pullRequestUrl" in item) return { kind: "pull-request" as ComponentKind, confidence: 0.9, reasons: ["Object has PR fields."] }
        if ("code" in item || "language" in item) return { kind: "code-block" as ComponentKind, confidence: 0.88, reasons: ["Object has code fields."] }
        if ("workLogs" in item && Array.isArray(item.workLogs)) return { kind: "work-logs" as ComponentKind, confidence: 0.9, reasons: ["Object has work log list."] }
        if ("metrics" in item || "value" in item) return { kind: "dashboard" as ComponentKind, confidence: 0.67, reasons: ["Object has metric-like fields."] }

        return { kind: "data-card" as ComponentKind, confidence: 0.6, reasons: ["Fallback to generic card when structure is ambiguous."] }
    }

    return { kind: "data-card" as ComponentKind, confidence: 0.4, reasons: ["Fallback for non-object payloads."] }
}

const normalizeInputData = (input: unknown) => {
    if (typeof input === "string") {
        const trimmed = input.trim()
        if (!trimmed) return { data: null, error: "No data provided." }
        if (trimmed.startsWith("[") || trimmed.startsWith("{"))
            try {
                return { data: JSON.parse(trimmed) }
            } catch {
                return { error: "Unable to parse JSON payload." }
            }

        return { data: parseCsvRecords(trimmed) }
    }

    if (typeof input === "object") return { data: input }
    return { error: "Unsupported input format." }
}

const tokenize = (value: string) => {
    const tokens = safeTrim(value)
        .toLowerCase()
        .replace(/[\W_]+/g, " ")
        .split(" ")
        .filter(Boolean)

    return [...new Set(tokens)]
}

const jaccardSimilarity = (left: string[], right: string[]) => {
    if (left.length === 0 || right.length === 0) return 0

    const leftSet = new Set(left)
    const rightSet = new Set(right)
    const intersection = [...leftSet].filter(item => rightSet.has(item)).length
    const union = new Set([...leftSet, ...rightSet]).size
    return union === 0 ? 0 : intersection / union
}

type OutlineSection = {
    title: string
    views: string[]
}

const parseOutlineSections = (outline: string): OutlineSection[] => {
    const sections: OutlineSection[] = []
    let current: OutlineSection | null = null

    outline
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(line => {
            if (/^#{1,4}\s+/.test(line)) {
                const title = line.replace(/^#{1,4}\s+/, "").trim()
                if (!title) return
                current = { title, views: [] }
                sections.push(current)
                return
            }

            if (/^[-*]\s+/.test(line)) {
                const viewName = line.replace(/^[-*]\s+/, "").trim()
                if (!viewName) return

                if (!current) {
                    current = { title: "Section", views: [] }
                    sections.push(current)
                }

                current.views.push(viewName)
                return
            }

            if (!current) {
                const section = { title: line, views: ["Overview"] }
                sections.push(section)
                current = section
                return
            }

            if (!current.views.length) current.views.push(line)
        })

    return sections
}

const toCardType = (value: unknown): DatasetCardField["type"] => {
    if (value === null) return "null"
    if (Array.isArray(value)) return "array"
    if (typeof value === "string") return "string"
    if (typeof value === "number") return "number"
    if (typeof value === "boolean") return "boolean"
    if (typeof value === "object") return "object"
    return "unknown"
}

const canonicalizeTitle = (value: string) => {
    const trimmed = safeTrim(value)
    return trimmed || "Untitled"
}

const canonicalSiblingName = (value: string) => normalizeTitle(canonicalizeTitle(value))

const ensureUniqueByScope = (items: string[]) => {
    const used = new Set<string>()
    return items.map(raw => {
        const normalized = canonicalSiblingName(raw)
        if (!used.has(normalized)) {
            used.add(normalized)
            return raw
        }

        let index = 1
        let next = `${raw} (${index})`
        while (used.has(canonicalSiblingName(next))) {
            index += 1
            next = `${raw} (${index})`
        }
        used.add(canonicalSiblingName(next))
        return next
    })
}

const displayKindForMode = (mode: ViewMode) => (mode === "dashboard" ? "dashboard" : mode === "structured" ? "data-card" : "data-card")

const estimateRenderComplexity = (profile: Omit<RenderProfile, "estimatedComplexity" | "estimatedRenderCost">) => {
    const score = profile.blockCount * 0.7 + profile.headingCount * 1.5 + profile.visualBlockCount * 4 + profile.displayCount * 2 + profile.rawLength / 60
    const estimatedComplexity = score >= 80 ? "high" : score >= 35 ? "medium" : "low"
    return {
        estimatedComplexity,
        estimatedRenderCost: Math.max(1, Math.round(score)),
    }
}

const observationId = () => `obs-${createId()}`

const appendAgenticObservation = (
    workspace: VisualNoteWorkspace,
    record: {
        goal: string
        status: "ok" | "warning" | "failed"
        summary: string
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        blockers: string[]
        note?: string
    },
) => {
    const observations = [...(workspace.agenticObservations ?? [])].slice(-29)
    return {
        ...workspace,
        agenticObservations: [
            ...observations,
            {
                id: observationId(),
                createdAt: new Date().toISOString(),
                ...record,
            },
        ],
    }
}

const appendAgenticMemory = (
    workspace: VisualNoteWorkspace,
    record: {
        goal: string
        assumptions: string[]
        constraints: string[]
        nextActions: string[]
        scope?: "workspace" | "notebook"
        notebookId?: string
        status?: "ok" | "warning" | "failed"
        plan?: Array<{ tool: string; input: Record<string, unknown> }>
        summary?: string
        note?: string
    },
) => {
    const existing = [...(workspace.agenticMemory ?? [])].slice(-79)
    return {
        ...workspace,
        agenticMemory: [
            ...existing,
            {
                id: `agentic-memory-${createId()}`,
                createdAt: new Date().toISOString(),
                goal: safeTrim(record.goal),
                assumptions: (record.assumptions ?? []).map(item => safeTrim(item)).filter(Boolean),
                constraints: (record.constraints ?? []).map(item => safeTrim(item)).filter(Boolean),
                nextActions: (record.nextActions ?? []).map(item => safeTrim(item)).filter(Boolean),
                scope: record.scope || "workspace",
                notebookId: record.scope === "notebook" ? record.notebookId : undefined,
                status: record.status ?? "ok",
                plan: record.plan ?? [],
                summary: record.summary ? safeTrim(record.summary) : undefined,
                note: record.note ? safeTrim(record.note) : undefined,
            },
        ],
    }
}

const parseMarkdownLinks = (content: string) => {
    const matches = [...content.matchAll(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g)].map(match => ({
        label: match[1] ?? "",
        url: match[2] ?? "",
        raw: match[0] ?? "",
    }))
    const bareUrls = [...content.matchAll(/\bhttps?:\/\/[^\s)]+/g)].map(match => ({
        label: "bare-url",
        url: match[0] ?? "",
        raw: match[0] ?? "",
    }))

    return [...matches, ...bareUrls]
}

const collectDisplayUrls = (value: unknown, prefix: string, output: { key: string; url: string; path: string }[] = []) => {
    if (!value || typeof value !== "object") return output
    if (Array.isArray(value)) {
        value.forEach((item, index) => collectDisplayUrls(item, `${prefix}[${index}]`, output))
        return output
    }

    if (typeof value === "object")
        Object.entries(value as Record<string, unknown>).forEach(([key, next]) => {
            const path = prefix ? `${prefix}.${key}` : key
            if (typeof next === "string" && /^https?:\/\//.test(next)) {
                output.push({ key, url: next, path })
                return
            }

            collectDisplayUrls(next, path, output)
        })

    return output
}

const riskFromOperation = (operation: ChangePlanOperation, before: { issues: number; blockers: number }, after: { issues: number; blockers: number }) => {
    if (after.blockers > before.blockers) return { risk: "high" as const, reasons: [`Operation ${operation.tool} can increase blocking issues.`] }
    if (after.blockers > 0 && after.issues > before.issues) return { risk: "medium" as const, reasons: [`Operation ${operation.tool} changed issue balance.`] }
    return { risk: "low" as const, reasons: [] as string[] }
}

const defaultWorkspacePolicyRules: WorkspacePolicyRule[] = [
    {
        id: "notebook-summary",
        name: "Notebook summary should be present",
        severity: "medium",
        check: "notebook_summary",
    },
    {
        id: "non-empty-title",
        name: "Page/topic/view titles must be non-empty",
        severity: "high",
        check: "non_empty_titles",
    },
    {
        id: "display-or-content",
        name: "Every view should include either display or textual content",
        severity: "medium",
        check: "display_or_content",
    },
    {
        id: "layout-density",
        name: "Avoid very large views without enough structure",
        severity: "low",
        check: "layout_density",
    },
]

const topicSimilarityScore = (left: { title: string; summary?: string }, right: { title: string; summary?: string }) => {
    const leftTokens = tokenize(`${left.title} ${left.summary ?? ""}`)
    const rightTokens = tokenize(`${right.title} ${right.summary ?? ""}`)
    return jaccardSimilarity(leftTokens, rightTokens)
}

const touchedFromInput = (input: ChangePlanOperation) => {
    const touched = { notebooks: [], pages: [], topics: [], views: [], displays: [] } as {
        notebooks: string[]
        pages: string[]
        topics: string[]
        views: string[]
        displays: string[]
    }

    const value = input.input as Record<string, unknown>
    const setIfPresent = (field: keyof typeof touched, next: unknown) => {
        if (typeof next === "string" && next) touched[field].push(next)
    }

    setIfPresent("notebooks", value.notebookId)
    setIfPresent("notebooks", value.sourceNotebookId)
    setIfPresent("notebooks", value.targetNotebookId)
    setIfPresent("pages", value.pageId)
    setIfPresent("pages", value.targetPageId)
    setIfPresent("topics", value.topicId)
    setIfPresent("topics", value.targetTopicId)
    setIfPresent("views", value.viewId)
    setIfPresent("views", value.displayId)
    setIfPresent("displays", value.displayId)

    return touched
}

const scopedWorkspaceEntities = (workspace: VisualNoteWorkspace, userId: string, notebookId?: string) => {
    const notebookFilter = notebookId ? [findOwnedNotebook(workspace, userId, notebookId)].filter(Boolean) : workspace.notebooks.filter(notebook => notebook.userId === userId)
    const notebookIds = notebookFilter.filter((item): item is NonNullable<typeof item> => Boolean(item)).map(item => item.id)
    const pages = workspace.pages.filter(page => notebookIds.includes(page.notebookId))
    const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
    const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))
    const displays = views.flatMap(view => view.displays)

    return {
        notebooks: notebookFilter.filter((item): item is NonNullable<typeof item> => Boolean(item)),
        notebookIds,
        pages,
        topics,
        views,
        displays,
    }
}

const countScopeState = (scope: ReturnType<typeof scopedWorkspaceEntities>) => ({
    notebooks: scope.notebooks.length,
    pages: scope.pages.length,
    topics: scope.topics.length,
    views: scope.views.length,
    displays: scope.displays.length,
})

const moveById = <T extends Positioned>(items: T[], id: string, to: number) => {
    const index = items.findIndex(item => item.id === id)
    if (index < 0) return null

    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(clampIndex(to, next.length), 0, moved)

    return next.map((item, position) => ({ ...item, position }))
}

const reorderByIds = <T extends Positioned>(items: T[], ids: string[]) => {
    if (ids.length !== items.length) return null

    const byId = new Map(items.map(item => [item.id, item]))
    const found = ids.every(id => byId.has(id))
    if (!found) return null

    return ids.map((id, position) => ({ ...(byId.get(id) as T), position }))
}

const byIds = (items: { id: string }[]) => new Set(items.map(item => item.id))

const articleSnippet = (content: string, query: string, matchAt: number) => {
    const marker = normalizeTitle(query)
    const lower = content.toLowerCase()
    const found = lower.indexOf(marker, Math.max(0, matchAt - 80))
    if (found < 0) return content.slice(0, 160)

    const start = Math.max(0, found - 64)
    const end = Math.min(content.length, found + marker.length + 64)
    return `${start > 0 ? "..." : ""}${content.slice(start, end)}${end < content.length ? "..." : ""}`
}

const findOwnedNotebook = (workspace: VisualNoteWorkspace, userId: string, notebookId: string) => {
    const notebook = workspace.notebooks.find(item => item.id === notebookId)
    if (!notebook || notebook.userId !== userId) return null
    return notebook
}

const findOwnedNotebookByTitle = (workspace: VisualNoteWorkspace, userId: string, notebookTitle: string) => {
    const candidateTitle = normalizeTitle(safeTrim(notebookTitle))
    if (!candidateTitle) return null

    const match = workspace.notebooks.find(item => item.userId === userId && normalizeTitle(item.title) === candidateTitle)
    if (match) return match
    return workspace.notebooks.find(item => item.userId === userId && normalizeTitle(item.slug) === candidateTitle) ?? null
}

const findOwnedPage = (workspace: VisualNoteWorkspace, userId: string, pageId: string) => {
    const page = workspace.pages.find(item => item.id === pageId)
    if (!page) return null

    const notebook = findOwnedNotebook(workspace, userId, page.notebookId)
    if (!notebook) return null

    return { notebook, page }
}

const findOwnedTopic = (workspace: VisualNoteWorkspace, userId: string, topicId: string) => {
    const topic = workspace.topics.find(item => item.id === topicId)
    if (!topic) return null

    const pageContext = findOwnedPage(workspace, userId, topic.pageId)
    if (!pageContext) return null

    return { page: pageContext.page, notebook: pageContext.notebook, topic }
}

const findOwnedView = (workspace: VisualNoteWorkspace, userId: string, viewId: string) => {
    const view = workspace.views.find(item => item.id === viewId)
    if (!view) return null

    const topicContext = findOwnedTopic(workspace, userId, view.topicId)
    if (!topicContext) return null

    return { ...topicContext, view }
}

const normalizeWorkspace = (workspace: VisualNoteWorkspace, userId: string) => {
    const userNotebookIds = new Set(workspace.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.id))
    const pages = byPosition(workspace.pages.filter(page => userNotebookIds.has(page.notebookId))).map((page, index) => ({ ...page, position: index }))
    const topicPages = pages.map(page => page.id)
    const topics = byPosition(workspace.topics.filter(topic => topicPages.includes(topic.pageId))).map((topic, index) => ({
        ...topic,
        position: index,
    }))
    const topicIds = topics.map(topic => topic.id)
    const views = byPosition(workspace.views.filter(view => topicIds.includes(view.topicId))).map((view, index) => ({
        ...view,
        position: index,
    }))

    return {
        ...workspace,
        pages,
        topics,
        views,
        notebooks: workspace.notebooks.filter(notebook => userNotebookIds.has(notebook.id)),
    }
}

const ensureUniqueSlug = (workspace: VisualNoteWorkspace, base: string, userId: string) => {
    const used = new Set(workspace.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.slug))
    if (!used.has(base)) return base

    let attempt = 2
    let candidate = `${base}-${attempt}`
    while (used.has(candidate)) {
        attempt += 1
        candidate = `${base}-${attempt}`
    }

    return candidate
}

const writeViewContent = (workspace: VisualNoteWorkspace, viewId: string, content: string, displaysLength: number) => {
    const parsed = parseArticleContent(content, displaysLength)
    return {
        workspace: {
            ...workspace,
            views: workspace.views.map(view => (view.id === viewId ? { ...view, content: serializeArticleContent(parsed.blocks) } : view)),
        },
        view: workspace.views.find(view => view.id === viewId)!,
    }
}

export const listNotebooks = (workspace: VisualNoteWorkspace, userId: string): NotebookSummary[] =>
    normalizeWorkspace(workspace, userId).notebooks.map(notebook => {
        const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
        const pageIds = byIds(pages)
        const topics = workspace.topics.filter(topic => pageIds.has(topic.pageId))
        const topicIds = byIds(topics)
        const views = workspace.views.filter(view => topicIds.has(view.topicId))

        return {
            id: notebook.id,
            title: notebook.title,
            slug: notebook.slug,
            summary: notebook.summary,
            color: notebook.color,
            createdAt: notebook.createdAt,
            pageCount: pages.length,
            topicCount: topics.length,
            viewCount: views.length,
            displayCount: views.reduce((sum, view) => sum + view.displays.length, 0),
        }
    })

export const readWorkspace = (workspace: VisualNoteWorkspace, userId: string) => {
    const notebooks = listNotebooks(workspace, userId)
    return ok({
        notebooks,
        pageCount: notebooks.reduce((sum, item) => sum + item.pageCount, 0),
        topicCount: notebooks.reduce((sum, item) => sum + item.topicCount, 0),
        viewCount: notebooks.reduce((sum, item) => sum + item.viewCount, 0),
        displayCount: notebooks.reduce((sum, item) => sum + item.displayCount, 0),
    })
}

export const readNotebookTree = (workspace: VisualNoteWorkspace, userId: string, notebookId: string) => {
    const notebook = findOwnedNotebook(workspace, userId, notebookId)
    if (!notebook) return notFound("Notebook not found.")

    return ok({
        ...notebook,
        pages: byPosition(workspace.pages.filter(page => page.notebookId === notebook.id)).map(page => ({
            ...page,
            topics: byPosition(workspace.topics.filter(topic => topic.pageId === page.id)).map(topic => ({
                ...topic,
                views: byPosition(workspace.views.filter(view => view.topicId === topic.id)),
            })),
        })),
    })
}

export const readPageContext = (workspace: VisualNoteWorkspace, userId: string, pageId: string) => {
    const context = findOwnedPage(workspace, userId, pageId)
    if (!context) return notFound("Page not found.")

    return ok({
        notebook: context.notebook,
        page: context.page,
        topics: byPosition(workspace.topics.filter(topic => topic.pageId === context.page.id)).map(topic => ({
            ...topic,
            views: byPosition(workspace.views.filter(view => view.topicId === topic.id)),
        })),
    })
}

export const readPage = readPageContext

export const resolveNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; title?: string }) => {
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
        return ok(notebook)
    }

    const title = normalizeTitle(safeTrim(input.title))
    if (!title) return invalidInput("notebookId or title is required.")

    const matches = workspace.notebooks.filter(notebook => {
        if (notebook.userId !== userId) return false
        return normalizeTitle(notebook.title) === title || normalizeTitle(notebook.slug) === title
    })
    if (matches.length === 0) return notFound("Notebook not found.")
    if (matches.length > 1) return invalidInput("Notebook title is ambiguous. Use notebookId.")

    return ok(matches[0]!)
}

export const resolvePage = (workspace: VisualNoteWorkspace, userId: string, input: { pageId?: string; title?: string; notebookId?: string }) => {
    if (input.pageId) {
        const context = findOwnedPage(workspace, userId, input.pageId)
        if (!context) return notFound("Page not found.")
        if (input.notebookId && context.page.notebookId !== input.notebookId) return notFound("Page not found.")
        return ok(context.page)
    }

    const title = normalizeTitle(safeTrim(input.title))
    if (!title) return invalidInput("pageId or title is required.")
    const matches = workspace.pages.filter(page => {
        if (page.notebookId !== input.notebookId && input.notebookId) return false
        const notebook = findOwnedNotebook(workspace, userId, page.notebookId)
        if (!notebook) return false
        return normalizeTitle(page.title) === title
    })
    if (matches.length === 0) return notFound("Page not found.")
    if (matches.length > 1) return invalidInput("Page title is ambiguous. Use pageId.")
    return ok(matches[0]!)
}

export const resolveTopic = (workspace: VisualNoteWorkspace, userId: string, input: { topicId?: string; title?: string; pageId?: string }) => {
    if (input.topicId) {
        const context = findOwnedTopic(workspace, userId, input.topicId)
        if (!context) return notFound("Topic not found.")
        if (input.pageId && context.page.id !== input.pageId) return notFound("Topic not found.")
        return ok(context.topic)
    }

    const title = normalizeTitle(safeTrim(input.title))
    if (!title) return invalidInput("topicId or title is required.")

    const candidates = workspace.topics.filter(topic => {
        if (input.pageId && topic.pageId !== input.pageId) return false
        const pageContext = findOwnedPage(workspace, userId, topic.pageId)
        return Boolean(pageContext)
    })

    const matches = candidates.filter(topic => normalizeTitle(topic.title) === title)
    if (matches.length === 0) return notFound("Topic not found.")
    if (matches.length > 1) return invalidInput("Topic title is ambiguous. Use topicId.")
    return ok(matches[0]!)
}

export const resolveView = (workspace: VisualNoteWorkspace, userId: string, input: { viewId?: string; title?: string; topicId?: string }) => {
    if (input.viewId) {
        const context = findOwnedView(workspace, userId, input.viewId)
        if (!context) return notFound("View not found.")
        return ok(context.view)
    }

    const title = normalizeTitle(safeTrim(input.title))
    if (!title) return invalidInput("viewId or title is required.")

    const matches = workspace.views.filter(view => {
        if (input.topicId && view.topicId !== input.topicId) return false
        const context = findOwnedView(workspace, userId, view.id)
        return Boolean(context) && normalizeTitle(view.title) === title
    })

    if (matches.length === 0) return notFound("View not found.")
    if (matches.length > 1) return invalidInput("View title is ambiguous. Use viewId.")
    return ok(matches[0]!)
}

export const listPages = (workspace: VisualNoteWorkspace, userId: string, notebookId?: string) =>
    ok(
        byPosition(workspace.pages)
            .filter(page => (!notebookId || page.notebookId === notebookId) && Boolean(findOwnedNotebook(workspace, userId, page.notebookId)))
            .map(page => ({
                ...page,
                topicCount: workspace.topics.filter(topic => topic.pageId === page.id).length,
                viewCount: workspace.views.filter(view => workspace.topics.some(topic => topic.id === view.topicId && topic.pageId === page.id)).length,
            })),
    )

export const createNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { title: string; summary?: string; color?: string; slug?: string }) => {
    const title = safeTrim(input.title)
    if (!title) return invalidInput("title is required.")

    const created = createNotebookRecord(userId, title)
    created.slug = ensureUniqueSlug(workspace, slugify(safeTrim(input.slug) || created.slug), userId)
    if (input.summary?.trim()) created.summary = input.summary.trim()
    if (input.color?.trim()) created.color = input.color.trim()
    created.createdAt = new Date().toISOString()

    return ok({
        workspace: {
            ...workspace,
            notebooks: [...workspace.notebooks, created],
        },
        notebook: created,
    })
}

export const createArticle = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId: string; pageTitle: string; topicTitle: string; articleTitle?: string; content?: string; mode?: ViewMode },
) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    let createdPage = false
    let createdTopic = false
    let createdView = false

    const normalizedPageTitle = safeTrim(input.pageTitle)
    if (!normalizedPageTitle) return invalidInput("pageTitle is required.")
    const normalizedTopicTitle = safeTrim(input.topicTitle)
    if (!normalizedTopicTitle) return invalidInput("topicTitle is required.")

    const pageSiblings = byPosition(workspace.pages.filter(item => item.notebookId === notebook.id))
    const existingPage = pageSiblings.find(item => normalizeTitle(item.title) === normalizeTitle(normalizedPageTitle))
    let nextWorkspace = cloneWorkspace(workspace)

    let page = existingPage
    if (!page) {
        createdPage = true
        page = {
            ...createPageRecord(notebook.id, normalizedPageTitle, pageSiblings.length),
            content: "",
        }
        nextWorkspace = {
            ...nextWorkspace,
            pages: [...nextWorkspace.pages, page],
        }
    }

    const topicSiblings = byPosition(nextWorkspace.topics.filter(topic => topic.pageId === page.id))
    const existingTopic = topicSiblings.find(item => normalizeTitle(item.title) === normalizeTitle(normalizedTopicTitle))
    let topic = existingTopic
    if (!topic) {
        createdTopic = true
        topic = {
            ...createTopicRecord(page.id, normalizedTopicTitle, topicSiblings.length),
            summary: "A focused subdivision inside this section.",
        }
        nextWorkspace = {
            ...nextWorkspace,
            topics: [...nextWorkspace.topics, topic],
        }
    }

    const articleTitle = safeTrim(input.articleTitle || `${topic.title} article`) || `${topic.title} article`
    const topicViews = byPosition(nextWorkspace.views.filter(view => view.topicId === topic.id))
    let view = topicViews.find(view => view.title === articleTitle) ?? topicViews.find(view => normalizeTitle(view.title) === "article")
    if (!view) {
        createdView = true
        const created = createViewRecord(topic.id, articleTitle, input.mode ?? "article")
        view = {
            ...created,
            content: safeTrim(input.content) || created.content,
        }
        nextWorkspace = {
            ...nextWorkspace,
            views: [...nextWorkspace.views, view],
        }
    } else if (input.content) {
        view = { ...view, content: input.content.trim() || view.content }
        nextWorkspace = {
            ...nextWorkspace,
            views: nextWorkspace.views.map(item => (item.id === view?.id ? view : item)),
        }
    }

    return ok({
        workspace: nextWorkspace,
        notebook,
        page,
        topic,
        view,
        createdPage,
        createdTopic,
        createdView,
    })
}

export const renameNotebook = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId: string; title?: string; summary?: string; color?: string; slug?: string; published?: boolean },
) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const next = { ...notebook } as Notebook
    if (safeTrim(input.title)) {
        next.title = safeTrim(input.title)
        next.slug = ensureUniqueSlug(workspace, slugify(safeTrim(input.slug) || next.title), userId)
    }
    if (input.summary !== undefined) next.summary = input.summary
    if (input.color !== undefined) next.color = input.color
    if (safeTrim(input.slug)) next.slug = ensureUniqueSlug(workspace, slugify(input.slug as string), userId)
    if (typeof input.published === "boolean") {
        next.published = input.published
        next.publishedAt = input.published ? new Date().toISOString() : undefined
    }

    return ok({
        workspace: {
            ...workspace,
            notebooks: workspace.notebooks.map(item => (item.id === input.notebookId ? next : item)),
        },
        notebook: next,
    })
}

export const deleteNotebook = (workspace: VisualNoteWorkspace, userId: string, notebookId: string) => {
    const notebook = findOwnedNotebook(workspace, userId, notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const pageIds = new Set(workspace.pages.filter(page => page.notebookId === notebook.id).map(page => page.id))
    const topicIds = new Set(workspace.topics.filter(topic => pageIds.has(topic.pageId)).map(topic => topic.id))
    return ok({
        workspace: {
            ...workspace,
            notebooks: workspace.notebooks.filter(item => item.id !== notebook.id),
            pages: workspace.pages.filter(page => !pageIds.has(page.id)),
            topics: workspace.topics.filter(topic => !pageIds.has(topic.pageId)),
            views: workspace.views.filter(view => !topicIds.has(view.topicId)),
        },
    })
}

export const duplicateNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { sourceNotebookId: string; title?: string }) => {
    const source = findOwnedNotebook(workspace, userId, input.sourceNotebookId)
    if (!source) return notFound("Notebook not found.")

    const target = {
        ...createNotebookRecord(userId, safeTrim(input.title) || `Copy of ${source.title}`),
        summary: source.summary,
        color: source.color,
        slug: ensureUniqueSlug(workspace, `copy-${slugify(source.slug)}`, userId),
        createdAt: new Date().toISOString(),
        editorSettings: source.editorSettings ?? defaultEditorSettings,
    }

    const sourcePages = byPosition(workspace.pages.filter(page => page.notebookId === source.id))
    const pageMap = new Map<string, string>()
    const pages = sourcePages.map((page, position) => {
        const nextId = `page-${createId()}`
        pageMap.set(page.id, nextId)
        return {
            ...page,
            id: nextId,
            notebookId: target.id,
            position,
            title: page.title,
        }
    })

    const topicMap = new Map<string, string>()
    const topics = workspace.topics
        .filter(topic => pageMap.has(topic.pageId))
        .sort((a, b) => a.position - b.position)
        .map((topic, position) => {
            const nextId = `topic-${createId()}`
            topicMap.set(topic.id, nextId)
            return {
                ...topic,
                id: nextId,
                pageId: pageMap.get(topic.pageId) as string,
                position,
            }
        })

    const views = workspace.views
        .filter(view => topicMap.has(view.topicId))
        .sort((a, b) => a.position - b.position)
        .map((view, position) => ({
            ...cloneWithNewIds(view),
            id: `view-${createId()}`,
            topicId: topicMap.get(view.topicId) as string,
            position,
        })) as NotebookView[]

    return ok({
        workspace: {
            ...workspace,
            notebooks: [...workspace.notebooks, target],
            pages: [...workspace.pages, ...pages],
            topics: [...workspace.topics, ...topics],
            views: [...workspace.views, ...views],
        },
        notebook: target,
    })
}

export const createPage = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; title: string; position?: number }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const title = safeTrim(input.title)
    if (!title) return invalidInput("Page title is required.")

    const siblings = byPosition(workspace.pages.filter(page => page.notebookId === notebook.id))
    const targetPosition = clampIndex(input.position ?? siblings.length, siblings.length)
    const page = {
        ...createPageRecord(notebook.id, title, targetPosition),
        content: "",
    }
    const nextSiblings = [
        ...siblings.slice(0, targetPosition).map(page => page),
        ...[page],
        ...siblings.slice(targetPosition).map((item, index) => ({
            ...item,
            position: targetPosition + index + 1,
        })),
    ]

    return ok({
        workspace: {
            ...workspace,
            pages: [...workspace.pages.filter(item => item.notebookId !== notebook.id), ...nextSiblings],
        },
        page,
        notebook,
    })
}

export const renamePage = (workspace: VisualNoteWorkspace, userId: string, input: { pageId: string; title?: string; position?: number }) => {
    const context = findOwnedPage(workspace, userId, input.pageId)
    if (!context) return notFound("Page not found.")

    const siblings = byPosition(workspace.pages.filter(item => item.notebookId === context.page.notebookId))
    const currentPosition = siblings.findIndex(item => item.id === context.page.id)
    const target = input.position === undefined ? currentPosition : clampIndex(input.position, siblings.length - 1)
    const moved = moveById(siblings, context.page.id, target)
    if (!moved) return invalidInput("Unable to reorder page.")

    const page = {
        ...context.page,
        title: safeTrim(input.title) || context.page.title,
        position: target,
    }
    const next = moved.map(item => (item.id === context.page.id ? page : item))

    return ok({
        workspace: {
            ...workspace,
            pages: [...workspace.pages.filter(item => item.notebookId !== context.page.notebookId), ...next],
        },
        page,
    })
}

export const reorderPages = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; pageIds: string[] }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")
    const siblings = byPosition(workspace.pages.filter(page => page.notebookId === notebook.id))
    const nextSiblings = reorderByIds(siblings, input.pageIds)
    if (!nextSiblings) return invalidInput("pageIds must include every page for the notebook.")

    return ok({
        workspace: {
            ...workspace,
            pages: [...workspace.pages.filter(page => page.notebookId !== notebook.id), ...nextSiblings],
        },
    })
}

export const movePageToNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { pageId: string; targetNotebookId: string; position?: number }) => {
    const sourceContext = findOwnedPage(workspace, userId, input.pageId)
    if (!sourceContext) return notFound("Page not found.")

    const targetNotebook = findOwnedNotebook(workspace, userId, input.targetNotebookId)
    if (!targetNotebook) return notFound("Target notebook not found.")

    if (sourceContext.page.notebookId === targetNotebook.id)
        return reorderPages(workspace, userId, {
            notebookId: sourceContext.page.notebookId,
            pageIds: byPosition(workspace.pages.filter(page => page.notebookId === sourceContext.page.notebookId).map(page => page.id)),
        })

    const sourceSiblingPages = byPosition(workspace.pages.filter(page => page.notebookId === sourceContext.page.notebookId && page.id !== input.pageId))
    const targetSiblingPages = byPosition(workspace.pages.filter(page => page.notebookId === targetNotebook.id))
    const movedPage = { ...sourceContext.page, notebookId: targetNotebook.id }
    const targetPosition = clampIndex(input.position ?? targetSiblingPages.length, targetSiblingPages.length)
    const nextTarget = [
        ...targetSiblingPages.slice(0, targetPosition),
        { ...movedPage, position: targetPosition },
        ...targetSiblingPages.slice(targetPosition).map((item, index) => ({ ...item, position: targetPosition + index + 1 })),
    ]
    const nextSource = sourceSiblingPages.map((page, index) => ({ ...page, position: index }))

    return ok({
        workspace: {
            ...workspace,
            pages: [...workspace.pages.filter(item => item.notebookId !== sourceContext.page.notebookId && item.notebookId !== targetNotebook.id), ...nextSource, ...nextTarget],
        },
        page: movedPage,
    })
}

export const deletePage = (workspace: VisualNoteWorkspace, userId: string, pageId: string) => {
    const context = findOwnedPage(workspace, userId, pageId)
    if (!context) return notFound("Page not found.")

    const topicIds = new Set(workspace.topics.filter(topic => topic.pageId === context.page.id).map(topic => topic.id))
    return ok({
        workspace: {
            ...workspace,
            pages: workspace.pages.filter(item => item.id !== pageId),
            topics: workspace.topics.filter(topic => topic.pageId !== context.page.id),
            views: workspace.views.filter(view => !topicIds.has(view.topicId)),
        },
        page: context.page,
    })
}

export const createTopic = (workspace: VisualNoteWorkspace, userId: string, input: { pageId: string; title: string; summary?: string; position?: number }) => {
    const context = findOwnedPage(workspace, userId, input.pageId)
    if (!context) return notFound("Page not found.")

    const title = safeTrim(input.title)
    if (!title) return invalidInput("Topic title is required.")

    const siblings = byPosition(workspace.topics.filter(topic => topic.pageId === context.page.id))
    const position = clampIndex(input.position ?? siblings.length, siblings.length)
    const topic = {
        ...createTopicRecord(context.page.id, title, position),
        summary: safeTrim(input.summary) || "A focused subdivision inside this section.",
    }
    const nextSiblings = [...siblings.slice(0, position), topic, ...siblings.slice(position).map((item, index) => ({ ...item, position: position + index + 1 }))]

    return ok({
        workspace: {
            ...workspace,
            topics: [...workspace.topics.filter(topic => topic.pageId !== context.page.id), ...nextSiblings],
        },
        topic,
    })
}

export const renameTopic = (workspace: VisualNoteWorkspace, userId: string, input: { topicId: string; title?: string; summary?: string; position?: number }) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")

    const siblings = byPosition(workspace.topics.filter(topic => topic.pageId === context.page.id))
    const target = input.position === undefined ? siblings.findIndex(item => item.id === context.topic.id) : clampIndex(input.position, siblings.length - 1)
    const reordered = moveById(siblings, context.topic.id, target)
    if (!reordered) return invalidInput("Unable to reorder topic.")

    const nextTopic = {
        ...context.topic,
        title: safeTrim(input.title) || context.topic.title,
        summary: input.summary !== undefined ? input.summary : context.topic.summary,
    }
    const nextSiblings = reordered.map(item => (item.id === context.topic.id ? nextTopic : item))

    return ok({
        workspace: {
            ...workspace,
            topics: [...workspace.topics.filter(topic => topic.pageId !== context.page.id), ...nextSiblings],
        },
        topic: nextTopic,
    })
}

export const reorderTopics = (workspace: VisualNoteWorkspace, userId: string, input: { pageId: string; topicIds: string[] }) => {
    const context = findOwnedPage(workspace, userId, input.pageId)
    if (!context) return notFound("Page not found.")
    const siblings = byPosition(workspace.topics.filter(topic => topic.pageId === context.page.id))
    const nextSiblings = reorderByIds(siblings, input.topicIds)
    if (!nextSiblings) return invalidInput("topicIds must include every topic in the page.")

    return ok({
        workspace: {
            ...workspace,
            topics: [...workspace.topics.filter(topic => topic.pageId !== context.page.id), ...nextSiblings],
        },
    })
}

export const moveTopicToPage = (workspace: VisualNoteWorkspace, userId: string, input: { topicId: string; targetPageId: string; position?: number }) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")
    const targetPage = findOwnedPage(workspace, userId, input.targetPageId)
    if (!targetPage) return notFound("Target page not found.")

    if (context.page.id === targetPage.page.id)
        return renameTopic(workspace, userId, {
            topicId: input.topicId,
            title: context.topic.title,
            summary: context.topic.summary,
            position: input.position,
        })

    const sourceSiblings = byPosition(workspace.topics.filter(topic => topic.pageId === context.page.id && topic.id !== context.topic.id))
    const sourceNormalized = sourceSiblings.map((topic, index) => ({ ...topic, position: index }))
    const targetSiblings = byPosition(workspace.topics.filter(topic => topic.pageId === targetPage.page.id))
    const targetPosition = clampIndex(input.position ?? targetSiblings.length, targetSiblings.length)
    const movedTopic = { ...context.topic, pageId: targetPage.page.id }
    const nextTarget = [
        ...targetSiblings.slice(0, targetPosition),
        { ...movedTopic, position: targetPosition },
        ...targetSiblings.slice(targetPosition).map((item, index) => ({ ...item, position: targetPosition + index + 1 })),
    ]

    return ok({
        workspace: {
            ...workspace,
            topics: [...workspace.topics.filter(topic => topic.pageId !== context.page.id && topic.pageId !== targetPage.page.id), ...sourceNormalized, ...nextTarget],
        },
        topic: movedTopic,
    })
}

export const duplicateTopic = (workspace: VisualNoteWorkspace, userId: string, input: { topicId: string; targetPageId?: string; title?: string; position?: number }) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")

    const targetContext = input.targetPageId ? findOwnedPage(workspace, userId, input.targetPageId) : { page: context.page, notebook: context.notebook }
    if (!targetContext) return notFound("Target page not found.")

    const topicTitle = safeTrim(input.title) || `Copy of ${context.topic.title}`
    const siblings = byPosition(workspace.topics.filter(item => item.pageId === targetContext.page.id))
    const position = clampIndex(input.position ?? siblings.length, siblings.length)
    const mapped = cloneWithNewIds(context.topic)
    const topic = {
        ...mapped,
        id: `topic-${createId()}`,
        title: topicTitle,
        pageId: targetContext.page.id,
        position,
    }

    const topicViews = byPosition(workspace.views.filter(view => view.topicId === context.topic.id)).map((view, index) => ({
        ...cloneWithNewIds(view),
        id: `view-${createId()}`,
        topicId: topic.id,
        position: index,
    })) as NotebookView[]

    const nextSiblings = [...siblings.slice(0, position), topic, ...siblings.slice(position).map((item, index) => ({ ...item, position: position + index + 1 }))]
    return ok({
        workspace: {
            ...workspace,
            topics: [...workspace.topics.filter(topic => topic.pageId !== targetContext.page.id), ...nextSiblings],
            views: [...workspace.views, ...topicViews],
        },
        topic,
        views: topicViews,
    })
}

export const deleteTopic = (workspace: VisualNoteWorkspace, userId: string, topicId: string) => {
    const context = findOwnedTopic(workspace, userId, topicId)
    if (!context) return notFound("Topic not found.")

    return ok({
        workspace: {
            ...workspace,
            topics: workspace.topics.filter(topic => topic.id !== topicId),
            views: workspace.views.filter(view => view.topicId !== topicId),
        },
        topic: context.topic,
    })
}

export const createView = (workspace: VisualNoteWorkspace, userId: string, input: { topicId: string; title: string; mode?: ViewMode; position?: number; content?: string }) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")

    const title = safeTrim(input.title)
    if (!title) return invalidInput("View title is required.")

    const siblings = byPosition(workspace.views.filter(view => view.topicId === context.topic.id))
    const position = clampIndex(input.position ?? siblings.length, siblings.length)
    const created = {
        ...createViewRecord(context.topic.id, title, input.mode ?? "article"),
        content: safeTrim(input.content) || createViewRecord(context.topic.id, title, input.mode ?? "article").content,
        position,
    }
    const nextSiblings = [...siblings.slice(0, position), created, ...siblings.slice(position).map((item, index) => ({ ...item, position: position + index + 1 }))]

    return ok({
        workspace: {
            ...workspace,
            views: [...workspace.views.filter(view => view.topicId !== context.topic.id), ...nextSiblings],
        },
        view: created,
    })
}

export const duplicateView = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; targetTopicId?: string; title?: string; position?: number }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")
    const targetTopic = input.targetTopicId ? findOwnedTopic(workspace, userId, input.targetTopicId) : context
    if (!targetTopic) return notFound("Target topic not found.")

    const siblings = byPosition(workspace.views.filter(view => view.topicId === targetTopic.topic.id))
    const position = clampIndex(input.position ?? siblings.length, siblings.length)
    const view = {
        ...cloneWithNewIds(context.view),
        id: `view-${createId()}`,
        topicId: targetTopic.topic.id,
        title: safeTrim(input.title) || `Copy of ${context.view.title}`,
        position,
    } as NotebookView

    const nextSiblings = [...siblings.slice(0, position), view, ...siblings.slice(position).map((item, index) => ({ ...item, position: position + index + 1 }))]
    return ok({
        workspace: {
            ...workspace,
            views: [...workspace.views.filter(view => view.topicId !== targetTopic.topic.id), ...nextSiblings],
        },
        view,
    })
}

export const renameView = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; title?: string; mode?: ViewMode }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const next = {
        ...context.view,
        title: safeTrim(input.title) || context.view.title,
        mode: input.mode ?? context.view.mode,
    }
    return ok({
        workspace: {
            ...workspace,
            views: workspace.views.map(view => (view.id === context.view.id ? next : view)),
        },
        view: next,
    })
}

export const reorderViews = (workspace: VisualNoteWorkspace, userId: string, input: { topicId: string; viewIds: string[] }) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")
    const siblings = byPosition(workspace.views.filter(view => view.topicId === context.topic.id))
    const nextSiblings = reorderByIds(siblings, input.viewIds)
    if (!nextSiblings) return invalidInput("viewIds must include every view in topic.")

    return ok({
        workspace: {
            ...workspace,
            views: [...workspace.views.filter(view => view.topicId !== context.topic.id), ...nextSiblings],
        },
    })
}

export const moveViewToTopic = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; targetTopicId: string; position?: number }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const targetTopic = findOwnedTopic(workspace, userId, input.targetTopicId)
    if (!targetTopic) return notFound("Target topic not found.")

    if (context.topic.id === targetTopic.topic.id) {
        const siblings = byPosition(workspace.views.filter(item => item.topicId === context.topic.id))
        const position = input.position === undefined ? context.view.position : clampIndex(input.position, siblings.length - 1)
        const reordered = moveById(siblings, context.view.id, position)
        if (!reordered) return invalidInput("Unable to reorder view.")
        return ok({
            workspace: {
                ...workspace,
                views: [...workspace.views.filter(item => item.topicId !== context.topic.id), ...reordered],
            },
            view: reordered.find(item => item.id === context.view.id) as NotebookView,
        })
    }

    const sourceSiblings = byPosition(workspace.views.filter(view => view.topicId === context.topic.id && view.id !== context.view.id))
    const sourceNormalized = sourceSiblings.map((item, index) => ({ ...item, position: index }))
    const targetSiblings = byPosition(workspace.views.filter(view => view.topicId === targetTopic.topic.id))
    const targetPosition = clampIndex(input.position ?? targetSiblings.length, targetSiblings.length)
    const moved = { ...context.view, topicId: targetTopic.topic.id, position: targetPosition }
    const nextTarget = [
        ...targetSiblings.slice(0, targetPosition),
        moved,
        ...targetSiblings.slice(targetPosition).map((item, index) => ({ ...item, position: targetPosition + index + 1 })),
    ]

    return ok({
        workspace: {
            ...workspace,
            views: [...workspace.views.filter(view => view.topicId !== context.topic.id && view.topicId !== targetTopic.topic.id), ...sourceNormalized, ...nextTarget],
        },
        view: moved,
    })
}

export const createViewFromTemplate = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { topicId: string; title: string; template: "empty" | "research" | "roadmap"; mode?: ViewMode },
) => {
    const context = findOwnedTopic(workspace, userId, input.topicId)
    if (!context) return notFound("Topic not found.")

    const title = safeTrim(input.title)
    if (!title) return invalidInput("View title is required.")
    const template =
        input.template === "research"
            ? ["# Research", "", "## Questions", "- [ ] ", "", "## Decisions", "- [ ] ", "", "## Risks", "- [ ] "].join("\n")
            : input.template === "roadmap"
              ? ["# Roadmap", "", "## Upcoming", "- [ ] ", "", "## In progress", "- [ ] ", "", "## Completed", "- [ ] "].join("\n")
              : "# Article\n"
    const view = {
        ...createViewRecord(context.topic.id, title, input.mode ?? "article"),
        content: template,
    }
    return ok({
        workspace: {
            ...workspace,
            views: [...workspace.views.filter(item => item.topicId !== context.topic.id), ...byPosition(workspace.views.filter(item => item.topicId === context.topic.id)), view],
        },
        view,
    })
}

export const deleteView = (workspace: VisualNoteWorkspace, userId: string, viewId: string) => {
    const context = findOwnedView(workspace, userId, viewId)
    if (!context) return notFound("View not found.")

    const topicViews = byPosition(workspace.views.filter(view => view.topicId === context.topic.id && view.id !== viewId))
    const nextSiblings = topicViews.map((view, index) => ({ ...view, position: index }))

    return ok({
        workspace: {
            ...workspace,
            views: [...workspace.views.filter(view => view.topicId !== context.topic.id), ...nextSiblings],
        },
        view: context.view,
    })
}

export const changeViewMode = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; mode: ViewMode; keepContent?: boolean }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const next = {
        ...context.view,
        mode: input.mode,
        content: input.keepContent ? context.view.content : createViewRecord(context.topic.id, context.view.title, input.mode).content,
    }

    return ok({
        workspace: {
            ...workspace,
            views: workspace.views.map(view => (view.id === context.view.id ? next : view)),
        },
        view: next,
    })
}

export const readArticle = (workspace: VisualNoteWorkspace, userId: string, viewId: string) => {
    const context = findOwnedView(workspace, userId, viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    return ok({
        notebook: context.notebook,
        page: context.page,
        topic: context.topic,
        view: context.view,
        blocks: parsed.blocks,
        headings: parsed.headings,
        visualBlocks: parsed.blocks.flatMap((block, index) =>
            block.kind === "visual" ? [{ blockIndex: index, visualKind: block.visualKind, data: block.data, parseError: block.parseError }] : [],
        ),
    })
}

export const readViewAsMarkdown = (workspace: VisualNoteWorkspace, userId: string, viewId: string) => {
    const context = findOwnedView(workspace, userId, viewId)
    if (!context) return notFound("View not found.")

    const document = createExportDocument({
        scope: "page",
        selection: {
            notebookId: context.notebook.id,
            pageId: context.page.id,
            topicId: context.topic.id,
            viewId: context.view.id,
        },
        workspace,
    })
    if (!document) return invalidInput("Unable to build export document for this view.")

    const rendered = renderMarkdownExport(document, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
    return ok({ viewId: viewId, markdown: rendered, format: "markdown" })
}

export const readViewAsBlocks = (workspace: VisualNoteWorkspace, userId: string, viewId: string) => {
    const context = findOwnedView(workspace, userId, viewId)
    if (!context) return notFound("View not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    return ok({ viewId: context.view.id, blocks: parsed.blocks, headings: parsed.headings })
}

export const replaceArticleContent = (workspace: VisualNoteWorkspace, userId: string, viewId: string, content: string) => {
    const context = findOwnedView(workspace, userId, viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(content, context.view.displays.length)
    const serialized = serializeArticleContent(parsed.blocks)
    const reparsed = parseArticleContent(serialized, context.view.displays.length)
    if (reparsed.blocks.length !== parsed.blocks.length) return invalidInput("Article content did not survive serialization.")

    const updated = writeViewContent(workspace, context.view.id, serialized, context.view.displays.length)
    return ok({ ...updated, view: { ...context.view, content: serialized } })
}

export const insertArticleBlocks = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; blockIndex?: number; content: string }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("Article not found.")

    const source = safeTrim(input.content)
    if (!source) return invalidInput("content is required.")

    const nextBlocks = parseArticleContent(source, context.view.displays.length).blocks
    if (nextBlocks.length === 0) return invalidInput("No article blocks parsed.")
    const existing = parseArticleContent(context.view.content, context.view.displays.length).blocks
    const index = input.blockIndex == null ? existing.length : clampIndex(input.blockIndex, existing.length)
    const replaced = [...existing.slice(0, index), ...nextBlocks, ...existing.slice(index)]
    const content = serializeArticleContent(replaced)
    const updated = writeViewContent(workspace, context.view.id, content, context.view.displays.length)

    return ok({ ...updated, view: { ...context.view, content } })
}

export const replaceArticleBlock = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; blockIndex: number; blockMarkdown: string }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("Article not found.")

    const blocks = parseArticleContent(context.view.content, context.view.displays.length).blocks
    if (!blocks[input.blockIndex]) return notFound("Article block not found.")

    const replacement = parseArticleContent(safeTrim(input.blockMarkdown), context.view.displays.length).blocks
    if (replacement.length !== 1) return invalidInput("blockMarkdown must represent exactly one block.")

    const next = [...blocks]
    next[input.blockIndex] = replacement[0] as ArticleBlock
    const content = serializeArticleContent(next)
    const updated = writeViewContent(workspace, context.view.id, content, context.view.displays.length)
    return ok({ ...updated, view: { ...context.view, content } })
}

export const removeArticleBlock = (workspace: VisualNoteWorkspace, userId: string, viewId: string, blockIndex: number) => {
    const context = findOwnedView(workspace, userId, viewId)
    if (!context) return notFound("Article not found.")

    const blocks = parseArticleContent(context.view.content, context.view.displays.length).blocks
    if (!blocks[blockIndex]) return notFound("Article block not found.")
    const next = blocks.filter((_, index) => index !== blockIndex)
    const content = serializeArticleContent(next)
    const updated = writeViewContent(workspace, context.view.id, content, context.view.displays.length)
    return ok({ ...updated, view: { ...context.view, content } })
}

export const moveArticleBlock = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; fromIndex: number; toIndex: number }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("Article not found.")

    const blocks = parseArticleContent(context.view.content, context.view.displays.length).blocks
    if (!blocks[input.fromIndex]) return notFound("Source block not found.")
    const next = [...blocks]
    const [moved] = next.splice(input.fromIndex, 1)
    next.splice(clampIndex(input.toIndex, next.length), 0, moved)
    const content = serializeArticleContent(next)
    const updated = writeViewContent(workspace, context.view.id, content, context.view.displays.length)
    return ok({ ...updated, view: { ...context.view, content } })
}

export const patchArticleSection = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { viewId: string; headingId?: string; headingText?: string; sectionMarkdown: string },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("Article not found.")

    if (!input.headingId && !input.headingText) return invalidInput("headingId or headingText is required.")
    const section = safeTrim(input.sectionMarkdown)
    if (!section) return invalidInput("sectionMarkdown is required.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    const headingIndex = parsed.blocks.findIndex(block => {
        if (block.kind !== "heading") return false
        if (input.headingId && block.id === input.headingId) return true
        return block.text.toLowerCase() === safeTrim(input.headingText).toLowerCase()
    })
    if (headingIndex === -1) return notFound("Section heading not found.")
    const end = parsed.blocks.findIndex((block, index) => index > headingIndex && block.kind === "heading")
    const nextStart = headingIndex + 1
    const replacement = parseArticleContent(section, context.view.displays.length).blocks
    const nextBlocks = [...parsed.blocks.slice(0, nextStart), ...replacement, ...(end === -1 ? [] : parsed.blocks.slice(end))]
    const content = serializeArticleContent(nextBlocks)
    const updated = writeViewContent(workspace, context.view.id, content, context.view.displays.length)
    return ok({ ...updated, view: { ...context.view, content } })
}

export const applyArticlePatch = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        viewId: string
        operations: Array<
            | { op: "insert"; index?: number; markdown: string }
            | { op: "replace"; index: number; markdown: string }
            | { op: "remove"; index: number }
            | { op: "move"; from: number; to: number }
        >
    },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("Article not found.")
    const blocks = parseArticleContent(context.view.content, context.view.displays.length).blocks

    for (const operation of input.operations) {
        if (operation.op === "insert") {
            const inserted = parseArticleContent(safeTrim(operation.markdown), context.view.displays.length).blocks
            const index = operation.index == null ? blocks.length : clampIndex(operation.index, blocks.length)
            blocks.splice(index, 0, ...inserted)
            continue
        }
        if (operation.op === "replace") {
            if (!blocks[operation.index]) return notFound("Article block not found.")
            const replacement = parseArticleContent(safeTrim(operation.markdown), context.view.displays.length).blocks
            if (replacement.length === 0) return invalidInput("replace operation requires one block.")
            blocks.splice(operation.index, 1, replacement[0] as ArticleBlock)
            continue
        }
        if (operation.op === "remove") {
            if (!blocks[operation.index]) return notFound("Article block not found.")
            blocks.splice(operation.index, 1)
            continue
        }
        const next = moveById(
            blocks.map((item, index) => ({ ...item, id: createId(), position: index })),
            `tmp-${operation.from}`,
            clampIndex(operation.to, blocks.length - 1),
        )
        if (!next) return invalidInput("Unable to move block.")
        const [moved] = blocks.splice(operation.from, 1)
        blocks.splice(clampIndex(operation.to, blocks.length), 0, moved)
    }

    const content = serializeArticleContent(blocks)
    const updated = writeViewContent(workspace, context.view.id, content, context.view.displays.length)
    return ok({ ...updated, view: { ...context.view, content } })
}

export const lintArticle = (workspace: VisualNoteWorkspace, userId: string, viewId: string) => {
    const context = findOwnedView(workspace, userId, viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    const serialized = serializeArticleContent(parsed.blocks)
    const reparsed = parseArticleContent(serialized, context.view.displays.length)
    const warnings: string[] = []
    if (parsed.blocks.length !== reparsed.blocks.length) warnings.push("Article does not round-trip through parser/serializer.")

    parsed.blocks.forEach((block, index) => {
        if (block.kind === "display" && (block.displayIndex < 0 || block.displayIndex >= context.view.displays.length))
            warnings.push(`Display placeholder ${index + 1} points to missing display ${block.displayIndex}.`)

        if (block.kind === "visual" && block.parseError) warnings.push(`Visual block ${index + 1}: ${block.parseError}`)
    })

    return ok({
        viewId,
        valid: warnings.length === 0,
        warnings,
        blockCount: parsed.blocks.length,
        headingCount: parsed.headings.length,
    })
}

export const validateArticleBlocks = lintArticle

export const addDisplayToView = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { viewId: string; kind: ComponentKind; name?: string; data?: Record<string, unknown>; position?: number },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const displays = byPosition(context.view.displays)
    const position = clampIndex(input.position ?? displays.length, displays.length)
    const created = createDisplayInstance(input.kind, input.name?.trim() || defaultDisplayName(input.kind))
    const nextDisplay = {
        ...created,
        data: {
            ...defaultComponentData(input.kind),
            ...(input.data ?? {}),
        },
    }
    const next = [...displays.slice(0, position), nextDisplay, ...displays.slice(position).map((item, index) => ({ ...item, position: position + index + 1 }))]

    return ok({
        workspace: {
            ...workspace,
            views: workspace.views.map(view => (view.id === context.view.id ? { ...view, displays: next } : view)),
        },
        viewId: context.view.id,
        display: nextDisplay,
    })
}

export const removeDisplayFromView = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; displayId: string }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")
    if (!context.view.displays.find(item => item.id === input.displayId)) return notFound("Display not found.")
    const nextDisplays = context.view.displays.filter(item => item.id !== input.displayId).map((item, index) => ({ ...item, position: index }))
    return ok({
        workspace: {
            ...workspace,
            views: workspace.views.map(view => (view.id === context.view.id ? { ...view, displays: nextDisplays } : view)),
        },
        viewId: context.view.id,
    })
}

export const patchDisplayData = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; displayId: string; path?: string; data: Record<string, unknown> }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")
    const index = context.view.displays.findIndex(item => item.id === input.displayId)
    if (index < 0) return notFound("Display not found.")

    const display = context.view.displays[index]!
    const nextData = !input.path || input.path.trim() === "" ? input.data : setByPath<unknown>(display.data as object, input.path, input.data)
    const nextDisplay = { ...display, data: nextData as Record<string, unknown> }
    const nextDisplays = [...context.view.displays]
    nextDisplays[index] = nextDisplay

    return ok({
        workspace: {
            ...workspace,
            views: workspace.views.map(view => (view.id === context.view.id ? { ...view, displays: nextDisplays } : view)),
        },
        display: nextDisplay,
    })
}

export const setDisplayOrder = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; displayIds: string[] }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")
    const nextDisplays = reorderByIds(context.view.displays, input.displayIds)
    if (!nextDisplays) return invalidInput("displayIds must include every display in the view.")

    return ok({
        workspace: {
            ...workspace,
            views: workspace.views.map(view => (view.id === context.view.id ? { ...view, displays: nextDisplays } : view)),
        },
    })
}

export const listDisplayKinds = () =>
    ok({
        kinds: ["data-card", "checklist", "timeline", "dashboard", "work-logs", "bugs-list", "shopping-list", "pull-request", "url", "code-block"].map(kind => ({
            kind,
            label: defaultDisplayName(kind),
            defaultData: defaultComponentData(kind),
        })),
    })

export const searchWorkspace = (workspace: VisualNoteWorkspace, userId: string, input: { query: string; kinds?: Array<"notebook" | "page" | "topic" | "view" | "display"> }) => {
    const query = normalizeTitle(safeTrim(input.query))
    if (!query) return invalidInput("query is required.")
    const allowedKinds = new Set(input.kinds ?? ["notebook", "page", "topic", "view", "display"])
    const matches: SearchMatch[] = []
    const notebooks = workspace.notebooks.filter(item => item.userId === userId)

    for (const notebook of notebooks) {
        if (allowedKinds.has("notebook") && (normalizeTitle(notebook.title).includes(query) || normalizeTitle(notebook.summary).includes(query)))
            matches.push({
                kind: "notebook",
                id: notebook.id,
                title: notebook.title,
                notebookId: notebook.id,
                score: 100,
            })

        const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
        for (const page of pages) {
            if (allowedKinds.has("page") && normalizeTitle(page.title).includes(query))
                matches.push({
                    kind: "page",
                    id: page.id,
                    title: page.title,
                    notebookId: notebook.id,
                    pageId: page.id,
                    score: 85,
                })

            const topics = workspace.topics.filter(topic => topic.pageId === page.id)
            for (const topic of topics) {
                if (allowedKinds.has("topic") && (normalizeTitle(topic.title).includes(query) || normalizeTitle(topic.summary).includes(query)))
                    matches.push({
                        kind: "topic",
                        id: topic.id,
                        title: topic.title,
                        notebookId: notebook.id,
                        pageId: page.id,
                        topicId: topic.id,
                        score: 75,
                    })

                const views = workspace.views.filter(view => view.topicId === topic.id)
                for (const view of views) {
                    if (allowedKinds.has("view") && normalizeTitle(`${view.title} ${view.content}`).includes(query))
                        matches.push({
                            kind: "view",
                            id: view.id,
                            title: view.title,
                            notebookId: notebook.id,
                            pageId: page.id,
                            topicId: topic.id,
                            viewId: view.id,
                            snippet: articleSnippet(view.content, query, view.content.toLowerCase().indexOf(query)),
                            score: 65,
                        })

                    if (allowedKinds.has("display"))
                        view.displays.forEach(display => {
                            if (normalizeTitle(display.name).includes(query) || normalizeTitle(display.id).includes(query))
                                matches.push({
                                    kind: "display",
                                    id: display.id,
                                    title: display.name,
                                    notebookId: notebook.id,
                                    pageId: page.id,
                                    topicId: topic.id,
                                    viewId: view.id,
                                    score: 55,
                                })
                        })
                }
            }
        }
    }

    return ok({ query, matches: Array.from(new Map(matches.map(item => [`${item.kind}:${item.id}`, item])).values()) })
}

export const analyzeNotebookHealth = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string } = {}) => {
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")

        const pages = byPosition(workspace.pages.filter(page => page.notebookId === notebook.id))
        const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
        const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))
        const issues: HealthCheckIssue[] = []

        if (!notebook.summary.trim()) issues.push({ severity: "warning", scope: "notebook", id: notebook.id, message: "Notebook summary is empty." })
        if (pages.length === 0) issues.push({ severity: "warning", scope: "notebook", id: notebook.id, message: `Notebook ${notebook.title} has no pages.` })

        pages.forEach(page => {
            const pageTopics = topics.filter(topic => topic.pageId === page.id)
            if (pageTopics.length === 0) issues.push({ severity: "warning", scope: "page", id: page.id, message: `Page ${page.title} has no topics.` })
        })

        topics.forEach(topic => {
            const topicViews = views.filter(view => view.topicId === topic.id)
            if (topicViews.length === 0) issues.push({ severity: "warning", scope: "topic", id: topic.id, message: `Topic ${topic.title} has no views.` })
        })

        views.forEach(view => {
            const parsed = parseArticleContent(view.content, view.displays.length)
            parsed.blocks.forEach((block, index) => {
                if (block.kind === "display" && (block.displayIndex < 0 || block.displayIndex >= view.displays.length))
                    issues.push({
                        severity: "warning",
                        scope: "view",
                        id: view.id,
                        message: `View ${view.title} has invalid display placeholder ${index + 1}.`,
                    })
            })
            if (!view.content.trim()) issues.push({ severity: "error", scope: "view", id: view.id, message: `View ${view.title} is empty.` })
        })

        return ok({
            notebook: { id: notebook.id, title: notebook.title },
            notebookCount: 1,
            pageCount: pages.length,
            topicCount: topics.length,
            viewCount: views.length,
            issues,
        })
    }

    return workspaceHealthCheck(workspace, userId)
}

export const suggestNextSteps = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; pageId?: string; topicId?: string }) => {
    if (!input.notebookId && !input.pageId && !input.topicId) return notFound("notebookId, pageId, or topicId is required.")

    const suggestions: NextStepSuggestion[] = []

    if (input.topicId) {
        const context = findOwnedTopic(workspace, userId, input.topicId)
        if (!context) return notFound("Topic not found.")

        const views = workspace.views.filter(view => view.topicId === context.topic.id)
        if (views.length === 0) suggestions.push({ priority: "high", action: "add_view", detail: `Add at least one view under topic ${context.topic.title}.` })
        views.forEach(view => {
            if (!view.content.trim()) suggestions.push({ priority: "medium", action: "write_article", detail: `Add content to view ${view.title}.` })
            if (view.displays.length === 0) suggestions.push({ priority: "low", action: "add_display", detail: `Add a display to ${view.title}.` })
        })

        return ok({ suggestions })
    }

    if (input.pageId) {
        const context = findOwnedPage(workspace, userId, input.pageId)
        if (!context) return notFound("Page not found.")

        const topics = workspace.topics.filter(topic => topic.pageId === context.page.id)
        if (topics.length === 0) suggestions.push({ priority: "high", action: "add_topic", detail: `Add topics under page ${context.page.title}.` })

        topics.forEach(topic => {
            const views = workspace.views.filter(view => view.topicId === topic.id)
            if (views.length === 0) suggestions.push({ priority: "medium", action: "add_view", detail: `Add views under topic ${topic.title}.` })
        })

        return ok({ suggestions })
    }

    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const pages = byPosition(workspace.pages.filter(page => page.notebookId === notebook.id))
    if (pages.length === 0) {
        suggestions.push({ priority: "high", action: "add_page", detail: `Create pages inside notebook ${notebook.title}.` })
        return ok({ suggestions })
    }

    pages.forEach(page => {
        const topics = workspace.topics.filter(topic => topic.pageId === page.id)
        if (topics.length === 0) suggestions.push({ priority: "medium", action: "add_topic", detail: `Add topics to page ${page.title}.` })
    })

    return ok({ suggestions })
}

export const findDuplicateContent = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string }) => {
    const notebooks = input.notebookId
        ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (notebooks.length === 0) return notFound("No matching notebook found.")

    const titleBuckets = new Map<string, string[]>()
    const contentBuckets = new Map<string, string[]>()

    for (const notebook of notebooks) {
        if (!notebook) continue
        const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
        const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
        const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))

        pages.forEach(page => {
            const normalized = normalizeTitle(page.title)
            titleBuckets.set(`page:${normalized}`, [...(titleBuckets.get(`page:${normalized}`) ?? []), `page:${page.id}`])
        })
        topics.forEach(topic => {
            const normalized = normalizeTitle(topic.title)
            titleBuckets.set(`topic:${normalized}`, [...(titleBuckets.get(`topic:${normalized}`) ?? []), `topic:${topic.id}`])
        })
        views.forEach(view => {
            const normalizedTitle = normalizeTitle(view.title)
            titleBuckets.set(`view:${normalizedTitle}`, [...(titleBuckets.get(`view:${normalizedTitle}`) ?? []), `view:${view.id}`])

            const normalizedContent = normalizeTitle(view.content)
            if (normalizedContent) contentBuckets.set(normalizedContent, [...(contentBuckets.get(normalizedContent) ?? []), `view:${view.id}`])
        })
    }

    const matches: DuplicateContentMatch[] = []
    const titleDuplicates = [...titleBuckets.entries()] // [scope:id:normalized, ids]
        .filter(([, ids]) => ids.length > 1)
        .map(([scopeKey, ids]) => {
            const [scope, ...rest] = scopeKey.split(":")
            const id = ids[0]!
            const rawId = id.split(":")[1] ?? ""
            const canonical = rest.join(":")

            return {
                scope: (scope as "notebook" | "page" | "topic" | "view") ?? "page",
                kind: "title",
                canonical,
                ids: ids.map(value => value.split(":")[1] ?? value),
                title: rawId,
            }
        })

    const contentDuplicates = [...contentBuckets.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([canonical, ids]) => ({
            scope: "view" as const,
            kind: "content" as const,
            canonical,
            ids: ids.map(value => value.split(":")[1] ?? value),
            title: canonical,
        }))

    matches.push(...titleDuplicates, ...contentDuplicates)

    return ok({
        notebookId: input.notebookId,
        matches,
        totalGroups: matches.length,
    } as DuplicateContentReport)
}

export const normalizeArticleStructure = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; dryRun?: boolean }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    const normalizedContent = serializeArticleContent(parsed.blocks)
    const changed = normalizedContent !== context.view.content

    if (input.dryRun) return ok({ view: context.view, normalizedContent, changed, dryRun: true, blockCount: parsed.blocks.length, headingCount: parsed.headings.length })

    if (!changed) return ok({ view: context.view, normalizedContent, changed: false, dryRun: false, blockCount: parsed.blocks.length, headingCount: parsed.headings.length })

    const updated = writeViewContent(workspace, context.view.id, normalizedContent, context.view.displays.length)
    return ok({
        ...updated,
        view: { ...context.view, content: normalizedContent },
        normalizedContent,
        changed,
        dryRun: false,
        blockCount: parsed.blocks.length,
        headingCount: parsed.headings.length,
    })
}

export const analyzeWorkspaceGaps = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includeHealthSummary?: boolean }) => {
    const targets = input.notebookId ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean) : workspace.notebooks.filter(notebook => notebook.userId === userId)

    if (targets.length === 0) return notFound("No matching notebook found.")

    const issues: HealthCheckIssue[] = []
    targets.forEach(notebook => {
        if (!notebook) return
        const health = analyzeNotebookHealth(workspace, userId, { notebookId: notebook.id })
        if (!health.ok) return

        const notebookIssues = health.value.issues
        issues.push(
            ...notebookIssues.map(item => ({
                ...item,
                id: item.id,
                scope: item.scope,
                message: `${notebook.title}: ${item.message}`,
            })),
        )
    })

    const suggestionText = ["Review empty page/topic/view nodes", "Use rewrite_view_layout_for_mode to normalize display usage", "Run publish_diagnose before publishing"]
    const errorCount = issues.filter(issue => issue.severity === "error").length
    return ok({
        notebookIds: targets.map(notebook => notebook?.id ?? "").filter(Boolean),
        gaps: issues,
        totalGaps: issues.length,
        severity: {
            errors: errorCount,
            warnings: issues.length - errorCount,
        },
        suggestions: suggestionText,
        healthSummary: input.includeHealthSummary
            ? ({
                  notebookCount: targets.length,
                  issueCount: issues.length,
                  criticalIssueCount: errorCount,
              } as const)
            : undefined,
    })
}

export const discoverWorkspaceOpportunities = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includeSummary?: boolean; maxItems?: number }) => {
    const maxItems = clampIndex(input.maxItems ?? 25, 50)
    const targets = input.notebookId ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean) : workspace.notebooks.filter(notebook => notebook.userId === userId)

    if (targets.length === 0) return notFound("No matching notebook found.")

    const opportunities: WorkspaceOpportunity[] = []
    const duplicates = findDuplicateContent(workspace, userId, { notebookId: input.notebookId })
    const orphaned = analyzeOrphanedData(workspace, userId)
    const drift = contentDriftMonitor(workspace, userId, { notebookId: input.notebookId })

    const gap = analyzeWorkspaceGaps(workspace, userId, { notebookId: input.notebookId, includeHealthSummary: false })
    if (gap.ok && gap.value.gaps.length > 0)
        gap.value.gaps.slice(0, maxItems).forEach((item, index) => {
            opportunities.push({
                id: `gap-${index}`,
                scope: item.scope,
                priority: item.severity === "error" ? "high" : "medium",
                action: "repair_gap",
                detail: item.message,
                targetId: item.id,
                targetTitle: workspace.notebooks.some(notebook => notebook.id === item.id) ? item.id : item.id,
            })
        })

    if (duplicates.ok && duplicates.value.matches.length > 0)
        opportunities.push({
            id: "duplicate-content",
            scope: "view",
            priority: "low",
            action: "deduplicate",
            detail: `Found ${duplicates.value.totalGroups} duplicate title/content groups.`,
            targetId: input.notebookId ?? "workspace",
            targetTitle: input.notebookId ?? "Workspace",
        })

    if (orphaned.ok && orphaned.value.orphanPages.length > 0)
        opportunities.push({
            id: "orphan-pages",
            scope: "page",
            priority: "high",
            action: "repair_orphans",
            detail: `${orphaned.value.orphanPages.length} orphan page records found.`,
            targetId: input.notebookId ?? "workspace",
            targetTitle: input.notebookId ?? "Workspace",
        })

    if (drift.ok && drift.value.staleItems.length > 0)
        opportunities.push({
            id: "content-drift",
            scope: "view",
            priority: "medium",
            action: "refresh_stale_content",
            detail: `${drift.value.staleItems.length} content-drift candidates found.`,
            targetId: input.notebookId ?? "workspace",
            targetTitle: input.notebookId ?? "Workspace",
        })

    targets.forEach(notebook => {
        if (!notebook) return
        const pages = byPosition(workspace.pages.filter(page => page.notebookId === notebook.id))
        if (pages.length === 0)
            opportunities.push({
                id: `create-page-${notebook.id}`,
                scope: "notebook",
                priority: "high",
                action: "create_page",
                detail: `${notebook.title} has no pages.`,
                targetId: notebook.id,
                targetTitle: notebook.title,
            })

        pages.forEach(page => {
            const topics = byPosition(workspace.topics.filter(topic => topic.pageId === page.id))
            if (topics.length === 0)
                opportunities.push({
                    id: `create-topic-${page.id}`,
                    scope: "page",
                    priority: "medium",
                    action: "add_topic",
                    detail: `Page ${page.title} has no topics.`,
                    targetId: page.id,
                    targetTitle: page.title,
                })

            topics.forEach(topic => {
                const views = byPosition(workspace.views.filter(view => view.topicId === topic.id))
                if (views.length === 0)
                    opportunities.push({
                        id: `create-view-${topic.id}`,
                        scope: "topic",
                        priority: "medium",
                        action: "add_view",
                        detail: `Topic ${topic.title} has no views.`,
                        targetId: topic.id,
                        targetTitle: topic.title,
                    })
                else if (views.some(view => !view.content.trim() && view.displays.length === 0))
                    opportunities.push({
                        id: `fill-view-${topic.id}`,
                        scope: "topic",
                        priority: "low",
                        action: "auto_fill_defaults_for_view",
                        detail: `Topic ${topic.title} contains empty/untitled views.`,
                        targetId: topic.id,
                        targetTitle: topic.title,
                    })
            })
        })
    })

    const unique = opportunities.reduce<WorkspaceOpportunity[]>((next, candidate) => {
        if (next.length >= maxItems) return next
        if (!next.some(item => item.action === candidate.action && item.targetId === candidate.targetId && item.scope === candidate.scope)) next.push(candidate)
        return next
    }, [])

    return ok({
        notebookIds: targets.map(notebook => notebook?.id ?? "").filter(Boolean),
        opportunities: unique,
        totals: {
            count: unique.length,
            high: unique.filter(item => item.priority === "high").length,
            medium: unique.filter(item => item.priority === "medium").length,
            low: unique.filter(item => item.priority === "low").length,
        },
        includedPublishPolicyChecks: input.includeSummary ? 1 : 0,
    })
}

export const autoFillDefaultsForView = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        viewId: string
        targetMode?: ViewMode
        includeDisplay?: boolean
        includeArticlePlaceholder?: boolean
        dryRun?: boolean
    },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const targetMode = input.targetMode ?? context.view.mode
    const result: { changed: boolean; view: NotebookView; suggestions: string[]; displayAdded?: boolean; modeChanged: boolean; placeholderAdded?: boolean } = {
        changed: false,
        view: context.view,
        suggestions: [],
        modeChanged: false,
    }

    let nextWorkspace = cloneWorkspace(workspace)
    let nextView = context.view
    if (targetMode !== context.view.mode) {
        const switched = changeViewMode(nextWorkspace, userId, { viewId: context.view.id, mode: targetMode, keepContent: true })
        if (!switched.ok) return switched
        nextWorkspace = switched.value.workspace
        nextView = nextWorkspace.views.find(view => view.id === context.view.id) ?? context.view
        result.changed = true
        result.modeChanged = true
        result.suggestions.push(`Mode changed to ${targetMode}.`)
    }

    if (input.includeDisplay !== false) {
        const recommendation = displayKindForMode(targetMode)
        const hasRecommended = nextView.displays.some(item => item.kind === recommendation)
        if (!hasRecommended) {
            const added = addDisplayToView(nextWorkspace, userId, {
                viewId: nextView.id,
                kind: recommendation,
                name: `${context.view.title} ${recommendation} block`,
                data: { title: context.view.title },
            })
            if (!added.ok) return added
            nextWorkspace = added.value.workspace
            nextView = added.value.view ?? nextView
            result.changed = true
            result.displayAdded = true
            result.suggestions.push(`Added ${recommendation} display.`)
        }
    }

    if (input.includeArticlePlaceholder !== false) {
        const targetDisplayIndex = nextView.displays.length === 0 ? 0 : nextView.displays.length - 1
        const marker = `{{display:${targetDisplayIndex}}}`
        if (!nextView.content.includes(marker)) {
            const appended = `${nextView.content.trimEnd()}\n\n${marker}`
            const updated = writeViewContent(nextWorkspace, nextView.id, appended, nextView.displays.length)
            nextWorkspace = updated.workspace
            nextView = updated.view
            result.changed = true
            result.placeholderAdded = true
            result.suggestions.push(`Inserted display placeholder ${marker}.`)
        }
    }

    if (input.dryRun === true) return ok({ ...result, dryRun: true, workspace })
    if (!result.changed) return ok({ ...result, workspace, dryRun: false })
    return ok({ ...result, workspace: nextWorkspace, view: nextView, dryRun: false, changed: true })
}

export const canonicalizeViewTitles = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; dryRun?: boolean }) => {
    const notebooks = input.notebookId
        ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (notebooks.length === 0) return notFound("No matching notebook found.")

    const changes: ViewTitleCanonicalization[] = []
    let nextWorkspace = cloneWorkspace(workspace)

    for (const notebook of notebooks) {
        if (!notebook) continue
        const pages = byPosition(workspace.pages.filter(item => item.notebookId === notebook.id))
        const normalizedPages = ensureUniqueByScope(pages.map(page => canonicalizeTitle(page.title)))
        const nextPages = pages.map((page, index) => ({ ...page, title: normalizedPages[index]! }))
        nextPages.forEach((page, index) => {
            const previous = pages[index]!
            if (previous.title !== page.title)
                changes.push({
                    targetType: "page",
                    targetId: page.id,
                    before: previous.title,
                    after: page.title,
                })

            const topics = byPosition(workspace.topics.filter(topic => topic.pageId === page.id))
            const normalizedTopics = ensureUniqueByScope(topics.map(topic => canonicalizeTitle(topic.title)))
            const nextTopics = topics.map((topic, topicIndex) => ({ ...topic, title: canonicalizeTitle(normalizedTopics[topicIndex] ?? topic.title) }))
            nextTopics.forEach((topic, topicIndex) => {
                const previousTopic = topics[topicIndex]!
                if (previousTopic.title !== topic.title)
                    changes.push({
                        targetType: "topic",
                        targetId: topic.id,
                        before: previousTopic.title,
                        after: topic.title,
                    })

                const views = byPosition(workspace.views.filter(view => view.topicId === topic.id))
                const normalizedViews = ensureUniqueByScope(views.map(view => canonicalizeTitle(view.title)))
                views.forEach((view, viewIndex) => {
                    const canonical = canonicalizeTitle(normalizedViews[viewIndex] ?? view.title)
                    if (view.title !== canonical)
                        changes.push({
                            targetType: "view",
                            targetId: view.id,
                            before: view.title,
                            after: canonical,
                        })
                })
                nextWorkspace = {
                    ...nextWorkspace,
                    views: [
                        ...nextWorkspace.views.filter(item => item.topicId !== topic.id),
                        ...views.map((view, viewIndex) => ({
                            ...view,
                            title: canonicalizeTitle(normalizedViews[viewIndex] ?? view.title),
                        })),
                    ],
                }
            })
            nextWorkspace = {
                ...nextWorkspace,
                topics: [...nextWorkspace.topics.filter(item => item.pageId !== page.id), ...nextTopics.map((topic, topicIndex) => ({ ...topic, position: topicIndex }))],
                pages: [...nextWorkspace.pages.filter(item => item.notebookId !== notebook.id), ...nextPages.map((page, pageIndex) => ({ ...page, position: pageIndex }))],
            }
        })
    }

    if (input.dryRun) return ok({ changed: changes.length > 0, dryRun: true, changes, workspace })
    return ok({ changed: changes.length > 0, workspace: nextWorkspace, changes, dryRun: false })
}

export const linkTopicsBySemantics = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId?: string
        targetTopicId?: string
        topicCount?: number
        threshold?: number
        execute?: boolean
        dryRun?: boolean
    },
) => {
    const topics = (
        input.notebookId
            ? workspace.topics.filter(topic => {
                  const page = workspace.pages.find(item => item.id === topic.pageId)
                  if (!page) return false
                  const notebook = workspace.notebooks.find(item => item.id === page.notebookId)
                  return !!notebook && notebook.userId === userId && notebook.id === input.notebookId
              })
            : workspace.topics.filter(topic => {
                  const page = workspace.pages.find(item => item.id === topic.pageId)
                  const notebook = page ? workspace.notebooks.find(item => item.id === page.notebookId) : undefined
                  return !!notebook && notebook.userId === userId
              })
    ).filter(topic => !!findOwnedTopic(workspace, userId, topic.id))
    if (topics.length === 0) return notFound("No matching topics found.")

    const maxLinks = Math.max(1, Math.min(input.topicCount ?? 5, 10))
    const threshold = Math.max(0.05, Math.min(input.threshold ?? 0.18, 1))

    const relevant = input.targetTopicId ? topics.filter(topic => topic.id === input.targetTopicId) : topics
    if (relevant.length === 0) return notFound("targetTopicId not found.")

    const proposals = relevant
        .map(topic => {
            const links = topics
                .filter(candidate => candidate.id !== topic.id)
                .map(candidate => ({ candidate, score: topicSimilarityScore(topic, candidate) }))
                .filter(item => item.score >= threshold)
                .sort((left, right) => right.score - left.score)
                .slice(0, maxLinks)
                .map(item => ({
                    topicId: item.candidate.id,
                    topicTitle: item.candidate.title,
                    score: Number(item.score.toFixed(3)),
                }))

            return { topicId: topic.id, topicTitle: topic.title, links }
        })
        .filter(item => item.links.length > 0)

    let nextWorkspace = cloneWorkspace(workspace)
    if (input.execute && !input.dryRun)
        proposals.forEach(item => {
            const topicContext = findOwnedTopic(nextWorkspace, userId, item.topicId)
            if (!topicContext) return

            const firstView = byPosition(nextWorkspace.views.filter(view => view.topicId === topicContext.topic.id))[0]
            if (!firstView) return

            const linksHeading = "## Related topics"
            if (firstView.content.includes(linksHeading)) return

            const list = item.links.map(link => `- ${link.topicTitle} (${link.topicId}) • ${link.score}`).join("\n")
            const nextContent = `${firstView.content.trimEnd()}\n\n${linksHeading}\n${list}`
            const updated = writeViewContent(nextWorkspace, firstView.id, nextContent, firstView.displays.length)
            nextWorkspace = updated.workspace
        })

    return ok({
        proposals,
        executed: !!input.execute && !input.dryRun,
        dryRun: !!input.dryRun,
        changed: input.execute && !input.dryRun,
        workspace: input.execute && !input.dryRun ? nextWorkspace : workspace,
    })
}

export const proposeNavigationOrder = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; execute?: boolean; dryRun?: boolean }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const orderedPages = byPosition(workspace.pages.filter(page => page.notebookId === notebook.id)).sort((left, right) => {
        const leftOverview = left.title.toLowerCase().includes("overview")
        const rightOverview = right.title.toLowerCase().includes("overview")
        if (leftOverview !== rightOverview) return leftOverview ? -1 : 1
        return left.title.localeCompare(right.title)
    })
    const pageIds = orderedPages.map(item => item.id)
    const plannedViewOrders: Array<{ topicId: string; viewIds: string[] }> = []

    const topicOrders: Array<{ pageId: string; topicIds: string[] }> = []
    orderedPages.forEach(page => {
        const topics = byPosition(workspace.topics.filter(topic => topic.pageId === page.id)).sort((left, right) => {
            const leftOverview = left.title.toLowerCase().includes("overview")
            const rightOverview = right.title.toLowerCase().includes("overview")
            if (leftOverview !== rightOverview) return leftOverview ? -1 : 1
            return left.title.localeCompare(right.title)
        })
        topicOrders.push({ pageId: page.id, topicIds: topics.map(item => item.id) })

        topics.forEach(topic => {
            const viewIds = byPosition(workspace.views.filter(view => view.topicId === topic.id))
                .sort((left, right) => {
                    const leftHeadings = parseArticleContent(left.content, left.displays.length).headings.length
                    const rightHeadings = parseArticleContent(right.content, right.displays.length).headings.length
                    if (leftHeadings !== rightHeadings) return rightHeadings - leftHeadings
                    return left.title.localeCompare(right.title)
                })
                .map(item => item.id)
            plannedViewOrders.push({ topicId: topic.id, viewIds })
        })
    })

    let nextWorkspace = cloneWorkspace(workspace)
    if (input.execute && !input.dryRun) {
        const reorderedPages = reorderPages(nextWorkspace, userId, { notebookId: notebook.id, pageIds })
        if (!reorderedPages.ok) return reorderedPages
        nextWorkspace = reorderedPages.value.workspace

        topicOrders.forEach(item => {
            const reorderedTopics = reorderTopics(nextWorkspace, userId, { pageId: item.pageId, topicIds: item.topicIds })
            if (reorderedTopics.ok) nextWorkspace = reorderedTopics.value.workspace
        })

        for (const page of orderedPages) {
            const orderedTopics = topicOrders.find(item => item.pageId === page.id)?.topicIds ?? []
            for (const topicId of orderedTopics) {
                const topicViews = byPosition(nextWorkspace.views.filter(view => view.topicId === topicId)).sort((left, right) => {
                    const leftHeadings = parseArticleContent(left.content, left.displays.length).headings.length
                    const rightHeadings = parseArticleContent(right.content, right.displays.length).headings.length
                    if (leftHeadings !== rightHeadings) return rightHeadings - leftHeadings
                    return left.title.localeCompare(right.title)
                })
                const viewIds = topicViews.map(item => item.id)
                const reorderedViews = reorderViews(nextWorkspace, userId, { topicId, viewIds })
                if (reorderedViews.ok) nextWorkspace = reorderedViews.value.workspace
            }
        }
    }

    return ok({
        notebookId: notebook.id,
        planned: { pageIds, topicOrders, viewOrders: plannedViewOrders },
        changed: input.execute === true && !input.dryRun,
        dryRun: !!input.dryRun,
        workspace: input.execute && !input.dryRun ? nextWorkspace : workspace,
        applied: false,
    })
}

export const createNotebookFromOutline = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        title: string
        outline: string
        summary?: string
        color?: string
        slug?: string
        mode?: ViewMode
        dryRun?: boolean
    },
) => {
    const title = safeTrim(input.title)
    const sections = parseOutlineSections(input.outline)
    if (!title) return invalidInput("title is required.")
    if (sections.length === 0) return invalidInput("outline is required.")

    const nextWorkspace = cloneWorkspace(workspace)
    const created = createNotebook(nextWorkspace, userId, {
        title,
        summary: safeTrim(input.summary) || "Notebook from outline.",
        color: safeTrim(input.color),
        slug: safeTrim(input.slug) || slugify(title),
    })
    if (!created.ok) return created

    let cursor = created.value.workspace
    const page = createPage(cursor, userId, {
        notebookId: created.value.notebook.id,
        title: "Overview",
        position: 0,
    })
    if (!page.ok) return page

    cursor = page.value.workspace
    const fromOutline = generateTopicFromOutline(cursor, userId, {
        notebookId: created.value.notebook.id,
        pageId: page.value.page.id,
        outline: input.outline,
        topicMode: input.mode,
    })
    if (!fromOutline.ok) return fromOutline

    if (input.dryRun)
        return ok({
            dryRun: true,
            notebook: created.value.notebook,
            created: { sections: sections.length, topics: fromOutline.value.createdTopicIds.length, views: fromOutline.value.createdViewIds.length },
        })

    return ok({
        dryRun: false,
        notebook: created.value.notebook,
        created: {
            sections: sections.length,
            topics: fromOutline.value.createdTopicIds.length,
            views: fromOutline.value.createdViewIds.length,
        },
        workspace: fromOutline.value.workspace,
    })
}

export const migrateViewToModeWithValidation = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { viewId: string; mode: ViewMode; addRecommendedDisplays?: boolean; runValidation?: boolean; dryRun?: boolean },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const rewritten = rewriteViewLayoutForMode(workspace, userId, {
        viewId: input.viewId,
        mode: input.mode,
        addRecommendedDisplays: input.addRecommendedDisplays ?? false,
    })
    if (!rewritten.ok) return rewritten

    if (input.dryRun) return ok({ ...rewritten.value, dryRun: true, workspace, validation: undefined })

    if (!input.runValidation) return ok({ ...rewritten.value, dryRun: false, validation: undefined })
    const contract = validatePublishContract(workspace, userId, { notebookId: context.notebook.id })

    return ok({
        ...rewritten.value,
        validation: contract.ok ? contract.value : contract,
        dryRun: false,
    })
}

export const validatePublishContract = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
    const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
    const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))
    const checks: PublishContractCheck[] = []

    const addCheck = (name: string, ok: boolean, message: string) => checks.push({ name, passed: ok, message })

    addCheck("notebook-summary", safeTrim(notebook.summary).length > 0, "Notebook summary should be non-empty.")
    addCheck("has-pages", pages.length > 0, "Notebook has at least one page.")
    addCheck("has-topics", topics.length > 0, "Notebook has at least one topic.")
    addCheck("has-views", views.length > 0, "Notebook has at least one view.")
    const orphaned = analyzeOrphanedData(workspace, userId)
    const orphanCount = orphaned.ok ? orphaned.value.orphanPages.length + orphaned.value.orphanTopics.length + orphaned.value.orphanViews.length : 0
    addCheck("no-orphans", orphanCount === 0, `No orphan pages/topics/views. (found ${orphanCount})`)

    const warnings: string[] = []
    let blocking = 0
    views.forEach(view => {
        if (!view.content.trim()) warnings.push(`View ${view.title} has empty content.`)
        if (view.displays.length === 0 && !view.content.trim()) warnings.push(`View ${view.title} has no visual structure or content.`)
        const parsed = parseArticleContent(view.content, view.displays.length)
        if (parsed.blocks.some(block => block.kind === "display" && (block as { displayIndex?: number }).displayIndex === -1))
            addCheck(`display-boundary-${view.id}`, false, `View ${view.title} has invalid display reference`)
    })

    checks.forEach(check => {
        if (!check.passed) blocking += 1
    })

    return ok({
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        blockingChecks: checks,
        passed: checks.every(check => check.passed),
        blockerCount: blocking,
        warnings,
    })
}

export const publishReadinessGate = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; includeRecoveryPlan?: boolean }) => {
    const contract = validatePublishContract(workspace, userId, input)
    if (!contract.ok) return contract

    const health = analyzeWorkspaceGaps(workspace, userId, { notebookId: input.notebookId, includeHealthSummary: true })
    const policy = workspacePolicyEngine(workspace, userId, {
        action: "validate",
        notebookId: input.notebookId,
        policyRules: defaultWorkspacePolicyRules,
    })

    const gates = {
        contract: contract.value.passed ? "passed" : "failed",
        publishContract: contract.value,
        structure: health.ok ? "checked" : "failed",
        policy: policy.ok ? "validated" : "failed",
        recoveryPlan: input.includeRecoveryPlan ? ["Repair gaps", "Re-run publish_readiness_gate"] : undefined,
    }

    return ok({
        notebookId: input.notebookId,
        gate: contract.value.passed && health.ok ? "green" : "red",
        passed: contract.value.passed && health.ok,
        gates,
        blockers: [...(contract.ok ? [] : [contract.message]), ...(!health.ok ? [health.message] : []), ...(!policy.ok ? [policy.message] : [])].filter(Boolean),
    })
}

export const runAgenticWorkflow = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { goal: string; notebookId: string; execute?: boolean; prechecks?: boolean; dryRun?: boolean },
) => {
    const plan = planAgenticWorkflow(workspace, userId, {
        goal: input.goal,
        notebookId: input.notebookId,
        includePrechecks: input.prechecks ?? false,
    })
    if (!plan.ok) return plan

    if (!input.execute) return ok({ ...plan.value, dryRun: true })
    if (input.dryRun) return ok({ ...plan.value, dryRun: true })

    const executed = executePlanWithGuarantees(workspace, userId, {
        plan: plan.value.plan.map(item => ({ tool: item.tool, input: item.input })),
        notebookId: input.notebookId,
        continueOnFailure: false,
        rollbackOnFailure: true,
        dryRun: false,
    })
    if (!executed.ok) return executed

    return ok({ ...plan.value, ...executed.value, dryRun: false })
}

export const goalToAgentPlan = (workspace: VisualNoteWorkspace, userId: string, input: { goal: string; notebookId?: string; includePrechecks?: boolean }) => {
    const goal = safeTrim(input.goal)
    if (!goal) return invalidInput("goal is required.")
    if (!input.notebookId) return notFound("notebookId is required.")

    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const plan = planAgenticWorkflow(workspace, userId, {
        goal,
        notebookId: notebook.id,
        includePrechecks: input.includePrechecks ?? true,
    })
    if (!plan.ok) return plan

    const risk = planRiskProfile(workspace, userId, { plan: plan.value.plan })
    if (!risk.ok) return risk

    return ok({
        ...plan.value,
        goal,
        riskProfile: risk.value,
    })
}

export const agenticGoalToPipeline = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { goal: string; notebookId?: string; includePrechecks?: boolean; includeOptimized?: boolean },
) => {
    const plan = goalToAgentPlan(workspace, userId, {
        goal: input.goal,
        notebookId: input.notebookId,
        includePrechecks: input.includePrechecks ?? false,
    })
    if (!plan.ok) return plan

    if (!input.includeOptimized) {
        return ok({
            ...plan.value,
            toolChain: plan.value.plan,
            pipeline: "raw",
            prechecksEnabled: input.includePrechecks ?? false,
        })
    }

    const optimized = agenticPlanOptimizer(workspace, userId, {
        plan: plan.value.plan,
        maxSteps: plan.value.plan.length,
    })

    if (!optimized.ok) return optimized

    return ok({
        ...plan.value,
        toolChain: optimized.value.plan,
        pipeline: "optimized",
        plan: optimized.value.plan,
        prechecksEnabled: input.includePrechecks ?? false,
        optimization: {
            originalCount: optimized.value.originalCount,
            optimizedCount: optimized.value.optimizedCount,
            removed: optimized.value.removed,
            warnings: optimized.value.warnings,
        },
    })
}

export const planRiskProfile = (workspace: VisualNoteWorkspace, userId: string, input: { plan: Array<{ tool: string; input: Record<string, unknown> }>; notebookId?: string }) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan must be a non-empty array.")

    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    let nextWorkspace = cloneWorkspace(workspace)
    const blockers: string[] = []
    const operationRisk = input.plan.map((operation, index) => {
        const before = collectIssueSummary(nextWorkspace, userId)
        const applied = applyChangePlanOperation(nextWorkspace, userId, { ...operation, input: operation.input })
        if (!applied.ok) {
            blockers.push(`Operation ${operation.tool} blocked: ${applied.message}`)
            const risk = riskFromOperation(operation, before, before)
            return {
                index,
                tool: operation.tool,
                risk: "high" as const,
                reasons: [...risk.reasons, applied.message],
            }
        }

        const after = collectIssueSummary(applied.value.workspace, userId)
        nextWorkspace = applied.value.workspace
        const risk = riskFromOperation(operation, before, after)
        return { index, tool: operation.tool, risk: risk.risk, reasons: risk.reasons }
    })

    const hasHigh = operationRisk.some(item => item.risk === "high")
    const hasMedium = operationRisk.some(item => item.risk === "medium")
    const overallRisk: ExecutionRiskProfile["overallRisk"] = blockers.length > 0 ? "high" : hasHigh ? "high" : hasMedium ? "medium" : "low"
    const blockersSet = [...new Set(blockers)]

    return ok({
        plan: input.plan.map(item => ({ tool: item.tool, input: item.input })),
        overallRisk,
        operationRisk,
        blockerRisk: blockersSet,
    } as ExecutionRiskProfile)
}

export const executePlanOptimistic = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        notebookId?: string
        continueOnFailure?: boolean
        dryRun?: boolean
        maxSteps?: number
        rollbackOnFailure?: boolean
        checkpointLabel?: string
    },
) => {
    const operations = input.plan.slice(0, input.maxSteps ?? input.plan.length)
    if (operations.length === 0) return invalidInput("plan must be a non-empty array.")

    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const run = (sourceWorkspace: VisualNoteWorkspace) =>
        applyChangePlan(sourceWorkspace, userId, {
            operations,
            continueOnFailure: input.continueOnFailure ?? true,
            dryRun: input.dryRun,
        })

    const withCheckpointName = safeTrim(input.checkpointLabel || `agentic-${new Date().toISOString()}`)
    const checkpointed = input.dryRun
        ? { ok: true, value: workspace as { workspace: VisualNoteWorkspace } }
        : makeRevertPoint(workspace, userId, {
              name: `agentic-revert-${withCheckpointName}`,
              note: `Checkpoint created before optimistic execution.`,
          })
    if (!checkpointed.ok) return checkpointed

    const attempted = run(checkpointed.value.workspace)
    if (!attempted.ok) return attempted

    const validation = input.notebookId
        ? validateAfterMutation(attempted.value.workspace, userId, { notebookId: input.notebookId })
        : validateAfterMutation(attempted.value.workspace, userId, {})
    if (!validation.ok) return validation

    const failed = attempted.value.blockers.length > 0
    let workspaceResult = attempted.value.workspace
    let restoredFrom = false
    if (input.rollbackOnFailure && !input.dryRun && failed && !input.continueOnFailure) {
        const restore = checkpointed.value.workspace.snapshots?.find(item => item.name === `agentic-revert-${withCheckpointName}`)
        if (restore) {
            const restored = restoreWorkspaceSnapshot(checkpointed.value.workspace, userId, { snapshotId: restore.id })
            if (restored.ok) {
                workspaceResult = restored.value.restoredWorkspace
                restoredFrom = true
            }
        }
    }

    const observation = appendAgenticObservation(workspaceResult, {
        goal: "execute_plan_optimistic",
        status: failed ? "warning" : "ok",
        summary: `Executed ${operations.length} step(s) optimistically.`,
        plan: operations,
        blockers: attempted.value.blockers,
        note: restoredFrom ? `Restored from checkpoint agentic-revert-${withCheckpointName}` : undefined,
    })

    return ok({
        ...attempted.value,
        workspace: observation,
        rollbackAttempted: input.rollbackOnFailure === true,
        restoredFromCheckpoint: restoredFrom,
        checkpointName: `agentic-revert-${withCheckpointName}`,
        validation: validation.value,
        plan: operations,
    })
}

export const makeRevertPoint = (workspace: VisualNoteWorkspace, userId: string, input: { name?: string; note?: string; goal?: string }) => {
    const createdAt = new Date().toISOString()
    const result = snapshotWorkspace(workspace, userId, {
        name: safeTrim(input.name) || `agentic-revert-${createdAt}`,
        note: safeTrim(input.note) || (input.goal ? `Goal: ${input.goal}` : "Agentic revert point."),
    })
    if (!result.ok) return result

    return ok({ ...result.value, revertPointId: result.value.snapshot.id, createdAt })
}

export const agenticWorkspaceSnapshotBefore = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId?: string; name?: string; note?: string; goal?: string },
) => {
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    return makeRevertPoint(workspace, userId, {
        name: input.name || `agentic-snapshot-before-${new Date().toISOString()}`,
        note: input.note,
        goal: input.goal,
    })
}

export const agenticWorkspaceSnapshotAfter = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId?: string
        name?: string
        note?: string
        goal?: string
        beforePointId?: string
    },
) => {
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const result = makeRevertPoint(workspace, userId, {
        name: input.name || `agentic-snapshot-after-${new Date().toISOString()}`,
        note: input.note,
        goal: input.goal,
    })
    if (!result.ok) return result

    if (!input.beforePointId) return ok({ ...result.value, comparedTo: null })

    const before = workspace.snapshots?.find(item => item.id === input.beforePointId) ?? null
    if (!before) return ok({ ...result.value, comparedTo: null, beforePointMissing: true })

    const targetNotebookId = input.notebookId
    if (!targetNotebookId) return ok({ ...result.value, comparedTo: null, beforePointId: before.id, note: "After-snapshot recorded; provide notebookId for comparison details." })

    const compare = snapshotCompare(workspace, userId, { notebookId: targetNotebookId })
    if (!compare.ok) return ok({ ...result.value, comparedTo: null, beforePointId: before.id, beforePointMissing: true })

    return ok({
        ...result.value,
        beforePointId: before.id,
        comparedTo: compare.value,
        changedSinceBefore: {
            pages: compare.value.delta.added.pages.length + compare.value.delta.removed.pages.length,
            topics: compare.value.delta.added.topics.length + compare.value.delta.removed.topics.length,
            views: compare.value.delta.added.views.length + compare.value.delta.removed.views.length,
        },
    })
}

export const agenticWorkspaceRestorePoint = (workspace: VisualNoteWorkspace, userId: string, input: { revertPointId?: string }) => restoreRevertPoint(workspace, userId, input)

export const agenticRevertToLatestCheckpoint = (workspace: VisualNoteWorkspace, userId: string) => restoreRevertPoint(workspace, userId, {})

export const listAgenticRevertPoints = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string }) => {
    const revertPoints = [...(workspace.snapshots ?? [])]
        .filter(item => item.name.startsWith("agentic-revert-"))
        .filter(item => !input.notebookId || item.workspace.notebooks.some(notebook => notebook.id === input.notebookId && notebook.userId === userId))
        .map(item => ({
            id: item.id,
            name: item.name,
            createdAt: item.createdAt,
            note: item.note,
        }))
        .sort((left, right) => (left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0))

    return ok({
        count: revertPoints.length,
        points: revertPoints,
    })
}

export const restoreRevertPoint = (workspace: VisualNoteWorkspace, userId: string, input: { revertPointId?: string }) => {
    const candidates = (workspace.snapshots ?? []).filter(item => item.name.startsWith("agentic-revert-"))
    const target = input.revertPointId ? candidates.find(item => item.id === input.revertPointId) : candidates[0]
    if (!target) return notFound("No agentic revert point found.")

    return restoreWorkspaceSnapshot(workspace, userId, { snapshotId: target.id })
}

const workflowJobs: Map<string, AgenticWorkflowJob> = new Map()
const maxWorkflowJobs = 64

const storeWorkflowJob = (job: AgenticWorkflowJob) => {
    workflowJobs.set(job.jobId, job)
    const items = [...workflowJobs.values()].sort((left, right) => (left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0))
    if (items.length > maxWorkflowJobs) items.slice(maxWorkflowJobs).forEach(item => workflowJobs.delete(item.jobId))
}

const buildWorkflowJob = (
    fields: {
        goal?: string
        notebookId?: string
        execute: boolean
        dryRun: boolean
        plan?: Array<{ tool: string; input: Record<string, unknown> }>
    },
    initial: {
        status: AgenticWorkflowStatus
        note: string
        blockers?: string[]
        warnings?: string[]
        result?: AgenticWorkflowJob["result"]
    },
) => {
    const jobId = `agentic-workflow-${createId()}`
    const now = new Date().toISOString()

    return {
        jobId,
        goal: fields.goal,
        notebookId: fields.notebookId,
        execute: fields.execute,
        dryRun: fields.dryRun,
        stepCount: fields.plan?.length ?? 0,
        plan: fields.plan,
        createdAt: now,
        updatedAt: now,
        status: initial.status,
        blockers: initial.blockers ?? [],
        warnings: initial.warnings ?? [],
        note: initial.note,
        result: initial.result,
    } as AgenticWorkflowJob
}

export const agenticContractCheck = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includePolicy?: boolean }) => {
    if (!input.notebookId) {
        const notebooks = workspace.notebooks.filter(notebook => notebook.userId === userId)
        if (notebooks.length === 0) return notFound("No matching notebook found.")
        const checks = notebooks.map(notebook => {
            const contract = validatePublishContract(workspace, userId, { notebookId: notebook.id })
            const policy = input.includePolicy ? workspacePolicyEngine(workspace, userId, { action: "validate", notebookId: notebook.id }) : undefined
            return {
                notebookId: notebook.id,
                notebookTitle: notebook.title,
                contract: contract.ok ? contract.value : contract,
                policy: policy && policy.ok ? policy.value : policy,
            }
        })

        return ok({
            scope: "workspace",
            checks,
            passed: checks.every(item => item.contract.ok && item.contract.value.passed),
        })
    }

    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")
    const contract = validatePublishContract(workspace, userId, { notebookId: notebook.id })
    const policy = input.includePolicy ? workspacePolicyEngine(workspace, userId, { action: "validate", notebookId: notebook.id }) : undefined

    return ok({
        scope: "notebook",
        notebookId: notebook.id,
        contract: contract.ok ? contract.value : contract,
        policy: policy ? (policy.ok ? policy.value : policy) : undefined,
    })
}

export const assertWorkspaceInvariants = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; viewId?: string; strict?: boolean }) => {
    const strict = input.strict === true
    const health = input.notebookId ? validateAfterMutation(workspace, userId, { notebookId: input.notebookId }) : validateAfterMutation(workspace, userId, {})
    if (!health.ok) return health

    const duplicate = findDuplicateContent(workspace, userId, { notebookId: input.notebookId })
    if (!duplicate.ok) return duplicate
    const orphaned = analyzeOrphanedData(workspace, userId)
    if (!orphaned.ok) return orphaned

    const invariantViolations: string[] = []
    const warnings: string[] = []
    const invariantPass =
        health.value.blockers.length === 0 && orphaned.value.orphanPages.length === 0 && orphaned.value.orphanTopics.length === 0 && orphaned.value.orphanViews.length === 0
    if (strict && duplicate.value.matches.length > 0) invariantViolations.push(`Found ${duplicate.value.matches.length} duplicate content groups.`)

    if (!health.value.ok || !invariantPass) invariantViolations.push("Workspace health checks reported issues.")
    if (duplicate.value.matches.length > 0) warnings.push("Duplicate titles/content detected.")

    return ok({
        scope: input.notebookId ? "notebook" : "workspace",
        notebookId: input.notebookId,
        viewId: input.viewId,
        passed: invariantPass && invariantViolations.length === 0,
        invariantChecks: health.value.workspaceChecks,
        blockers: input.notebookId
            ? health.value.blockers
            : [...health.value.blockers, ...orphaned.value.orphanPages, ...orphaned.value.orphanTopics, ...orphaned.value.orphanViews],
        warnings: [...warnings, ...health.value.warnings],
        duplicateGroups: duplicate.value.matches,
    })
}

export const proposeSchemaEvolution = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string }) => {
    const notebookIds = input.notebookId
        ? [findOwnedNotebook(workspace, userId, input.notebookId)?.id].filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId).map(item => item.id)
    if (notebookIds.length === 0) return notFound("No matching notebook found.")

    const proposals: SchemaEvolutionProposal[] = []
    notebookIds.forEach(id => {
        const notebookId = id as string
        const notebook = workspace.notebooks.find(item => item.id === notebookId)
        if (!notebook) return
        const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
        const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
        const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))

        views.forEach(view => {
            const headings = parseArticleContent(view.content, view.displays.length).headings.length
            if (headings >= 8 && view.mode === "article" && view.displays.length === 0)
                proposals.push({
                    scope: "view",
                    id: view.id,
                    title: view.title,
                    action: "migrate_view_to_structured",
                    reason: "Large article-like view with many headings should be structured.",
                    migration: { mode: "structured" },
                })
            if (headings >= 6 && view.mode === "structured" && view.displays.length === 0)
                proposals.push({
                    scope: "view",
                    id: view.id,
                    title: view.title,
                    action: "add_primary_display",
                    reason: "Structured mode view should contain at least one display.",
                    migration: { kind: "data-card" },
                })
        })

        topics.forEach(topic => {
            if (topic.summary.length === 0)
                proposals.push({
                    scope: "topic",
                    id: topic.id,
                    title: topic.title,
                    action: "populate_topic_summary",
                    reason: "Topic summary is empty and can be used for semantic links.",
                })
        })
    })

    return ok({
        notebookIds,
        proposalCount: proposals.length,
        proposals,
        migrationPlanAvailable: proposals.length > 0,
    })
}

export const agenticSchemaEvolutionPlan = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId?: string; apply?: boolean; maxActions?: number },
) => {
    const proposal = proposeSchemaEvolution(workspace, userId, { notebookId: input.notebookId })
    if (!proposal.ok) return proposal

    const requested = input.maxActions ? Math.max(1, Math.min(input.maxActions, proposal.value.proposals.length)) : proposal.value.proposals.length
    const selected = proposal.value.proposals.slice(0, requested)
    const operations: ChangePlanOperation[] = []

    selected.forEach(item => {
        if (item.scope === "view" && item.action === "migrate_view_to_structured" && item.id) {
            operations.push({
                tool: "change_view_mode",
                input: {
                    viewId: item.id,
                    mode: "structured",
                    keepContent: true,
                },
            })
            return
        }

        if (item.scope === "view" && item.action === "add_primary_display" && item.id) {
            const kind = typeof item.migration?.kind === "string" ? item.migration.kind : "data-card"
            operations.push({
                tool: "add_display_to_view",
                input: {
                    viewId: item.id,
                    kind,
                    name: `Schema evolution ${kind}`,
                    data: {},
                },
            })
            return
        }

        if (item.scope === "topic" && item.action === "populate_topic_summary" && item.id) {
            operations.push({
                tool: "rename_topic",
                input: {
                    topicId: item.id,
                    summary: "This topic was auto-populated during schema evolution planning.",
                },
            })
        }
    })

    if (!input.apply) return ok({ ...proposal.value, requested: requested, operations, applied: false })

    if (operations.length === 0) return ok({ ...proposal.value, requested: 0, operations, applied: false, note: "No actionable schema evolution operations." })

    const applied = applyChangePlan(workspace, userId, { operations, maxSteps: operations.length })
    if (!applied.ok) return applied

    const validation = applyValidationForPlan(applied.value.workspace, userId, input.notebookId)
    return ok({
        ...proposal.value,
        requested,
        operations,
        applied: true,
        blockers: applied.value.blockers,
        validation,
        workspace: applied.value.workspace,
    })
}

export const reconcileExternalReference = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includeDisplayUrls?: boolean }) => {
    const notebooks = input.notebookId
        ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (notebooks.length === 0) return notFound("No matching notebook found.")

    const notebookIds = new Set(notebooks.filter((item): item is NonNullable<typeof item> => !!item).map(item => item.id))
    const viewIds = new Set(
        workspace.views
            .filter(view => {
                const page = workspace.topics.find(topic => topic.id === view.topicId)?.pageId
                const notebookId = page ? workspace.pages.find(page => page.id === page)?.notebookId : undefined
                return !!notebookId && notebookIds.has(notebookId)
            })
            .map(view => view.id),
    )

    const candidates: ReconciliationCandidate[] = []
    workspace.views.forEach(view => {
        if (!viewIds.has(view.id)) return
        const headings = parseArticleContent(view.content, view.displays.length).headings
        const links = parseMarkdownLinks(view.content)
        links.forEach(item => {
            const normalized = item.url.toLowerCase()
            const isInternalAnchor = item.url.startsWith("#")
            if (isInternalAnchor) {
                const headingMatch = headings.some(heading => heading.toLowerCase() === normalized.slice(1))
                candidates.push({
                    sourceViewId: view.id,
                    link: item.url,
                    kind: "markdown-link",
                    context: item.label,
                    status: headingMatch ? "supported" : "unresolved",
                })
                return
            }
            if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
                candidates.push({ sourceViewId: view.id, link: item.url, kind: "markdown-link", context: item.label, status: "supported" })
                return
            }
            candidates.push({
                sourceViewId: view.id,
                link: item.url,
                kind: "markdown-link",
                context: item.label,
                status: "unresolved",
            })
        })

        if (!input.includeDisplayUrls) return
        const urls = collectDisplayUrls(view.displays, "")
        urls.forEach(item => {
            const normalized = item.url.toLowerCase()
            const isKnown = normalized.startsWith("http://") || normalized.startsWith("https://")
            candidates.push({
                sourceViewId: view.id,
                link: item.url,
                kind: "display-url",
                context: `${item.key}:${item.path}`,
                status: isKnown ? "supported" : "unresolved",
            })
        })
    })

    return ok({
        notebookIds: [...notebookIds],
        supported: candidates.filter(item => item.status === "supported").length,
        unresolved: candidates.filter(item => item.status === "unresolved").length,
        candidates,
    })
}

export const topicSemanticsGraph = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; threshold?: number; maxEdgesPerTopic?: number }) => {
    const threshold = Math.max(0.05, Math.min(input.threshold ?? 0.16, 1))
    const maxEdgesPerTopic = Math.max(1, Math.min(input.maxEdgesPerTopic ?? 8, 24))

    const notebooks = input.notebookId
        ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (notebooks.length === 0) return notFound("No matching notebook found.")

    const notebookIds = new Set(notebooks.map(notebook => notebook?.id).filter(Boolean) as string[])
    const pages = workspace.pages.filter(page => notebookIds.has(page.notebookId))
    const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
    const nodes: TopicSemanticsNode[] = topics.map(topic => {
        const page = pages.find(item => item.id === topic.pageId)
        const notebookId = page ? page.notebookId : ""
        return { topicId: topic.id, pageId: topic.pageId, notebookId, title: topic.title, summary: topic.summary }
    })

    const edges: TopicSemanticsGraph["edges"] = []
    for (let index = 0; index < topics.length; index += 1) {
        const current = topics[index]!
        const ranked = topics
            .map((candidate, candidateIndex) => {
                if (candidateIndex <= index) return undefined
                const score = topicSimilarityScore(current, candidate)
                if (score < threshold) return undefined
                return {
                    topicId: candidate.id,
                    score: Number(score.toFixed(3)),
                }
            })
            .filter((item): item is { topicId: string; score: number } => Boolean(item))
            .sort((left, right) => right.score - left.score)
            .slice(0, maxEdgesPerTopic)

        ranked.forEach(item => {
            edges.push({
                fromTopicId: current.id,
                toTopicId: item.topicId,
                weight: item.score,
                reason: `Shared semantic overlap score ${item.score}.`,
            })
        })
    }

    return ok({
        nodes,
        edges,
        threshold,
        maxEdgesPerTopic,
        sourceCount: nodes.length,
    } as TopicSemanticsGraph & { threshold: number; maxEdgesPerTopic: number; sourceCount: number })
}

export const agenticSemanticGraphSync = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId?: string
        threshold?: number
        maxEdgesPerTopic?: number
        topicCount?: number
        targetTopicId?: string
        apply?: boolean
        dryRun?: boolean
    },
) => {
    const graph = topicSemanticsGraph(workspace, userId, {
        notebookId: input.notebookId,
        threshold: input.threshold,
        maxEdgesPerTopic: input.maxEdgesPerTopic,
    })
    if (!graph.ok) return graph

    const synced = linkTopicsBySemantics(workspace, userId, {
        notebookId: input.notebookId,
        targetTopicId: input.targetTopicId,
        threshold: input.threshold,
        topicCount: input.topicCount,
        execute: input.apply,
        dryRun: input.dryRun,
    })
    if (!synced.ok) return synced

    return ok({
        ...graph.value,
        synced: {
            requested: synced.value.proposals,
            applied: synced.value.executed && !input.dryRun,
            changed: synced.value.changed,
            count: synced.value.proposals.length,
        },
        workspace: synced.value.workspace,
    })
}

export const navigationRestructurePlan = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; execute?: boolean; dryRun?: boolean }) => {
    const planned = proposeNavigationOrder(workspace, userId, { notebookId: input.notebookId, execute: false, dryRun: input.dryRun })
    if (!planned.ok) return planned

    const operations: ChangePlanOperation[] = []
    const pageIds = planned.value.planned?.pageIds ?? []
    operations.push({ tool: "reorder_pages", input: { notebookId: input.notebookId, pageIds } })

    planned.value.planned.topicOrders.forEach(item => {
        operations.push({ tool: "reorder_topics", input: { pageId: item.pageId, topicIds: item.topicIds } })
    })
    planned.value.planned.viewOrders.forEach(item => {
        operations.push({ tool: "reorder_views", input: { topicId: item.topicId, viewIds: item.viewIds } })
    })

    if (!input.execute) return ok({ ...planned.value, plan: operations, applied: false })

    const executed = executePlanWithGuarantees(workspace, userId, {
        plan: operations,
        notebookId: input.notebookId,
        continueOnFailure: false,
        rollbackOnFailure: true,
        dryRun: input.dryRun ?? false,
    })
    if (!executed.ok) return executed

    return ok({ ...planned.value, ...executed.value, plan: operations, applied: true })
}

export const agenticNavigationRestructurePlan = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId: string; execute?: boolean; dryRun?: boolean },
) => navigationRestructurePlan(workspace, userId, input)

export const publishPreflightMultiNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { notebookIds?: string[]; includeRecoveryPlan?: boolean }) => {
    const targetNotebooks = input.notebookIds?.length
        ? workspace.notebooks.filter(notebook => notebook.userId === userId && input.notebookIds?.includes(notebook.id))
        : workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (targetNotebooks.length === 0) return notFound("No matching notebooks found.")

    const results = targetNotebooks
        .map(notebook => {
            const gate = publishReadinessGate(workspace, userId, {
                notebookId: notebook.id,
                includeRecoveryPlan: input.includeRecoveryPlan,
            })
            return { notebookId: notebook.id, notebookTitle: notebook.title, gate: gate.ok ? gate.value : gate }
        })
        .sort((left, right) => {
            const leftPassed = left.gate.ok && left.gate.value.passed
            const rightPassed = right.gate.ok && right.gate.value.passed
            if (leftPassed === rightPassed) return 0
            return leftPassed ? -1 : 1
        })

    return ok({
        includeRecoveryPlan: input.includeRecoveryPlan ?? false,
        notebooks: results.length,
        results,
        canPublishAll: results.every(item => typeof item.gate === "object" && item.gate && "passed" in item.gate && item.gate.passed === true),
        blockers: results.flatMap(item => {
            if (typeof item.gate !== "object" || item.gate === true) return []
            return item.gate.ok ? item.gate.value.blockers : [item.gate.message]
        }),
    })
}

export const agenticPublishReadinessMulti = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookIds?: string[]; includeRecoveryPlan?: boolean; includePolicy?: boolean },
) => {
    if (input.notebookIds?.length === 0) return invalidInput("notebookIds cannot be empty.")

    const gate = publishPreflightMultiNotebook(workspace, userId, {
        notebookIds: input.notebookIds,
        includeRecoveryPlan: input.includeRecoveryPlan,
    })
    if (!gate.ok) return gate

    const contract = gate.value.results.map(result => {
        const contractResult = agenticContractCheck(workspace, userId, {
            notebookId: result.notebookId,
            includePolicy: input.includePolicy,
        })
        return contractResult.ok
            ? {
                  notebookId: result.notebookId,
                  notebookTitle: result.notebookTitle,
                  readiness: result.gate,
                  contract: contractResult.value,
              }
            : {
                  notebookId: result.notebookId,
                  notebookTitle: result.notebookTitle,
                  readiness: result.gate,
                  contract: null,
                  error: contractResult.message,
              }
    })

    return ok({ ...gate.value, includePolicy: input.includePolicy ?? false, contract })
}

export const agenticObservationLog = (workspace: VisualNoteWorkspace, userId: string, input: AgenticObservationInput) => {
    const action = input.action === "append" ? "append" : "read"
    if (action === "append") {
        if (!safeTrim(input.summary)) return invalidInput("summary is required for append.")
        if (!safeTrim(input.goal)) return invalidInput("goal is required for append.")
        if (!input.plan) return invalidInput("plan is required for append.")
        const append = appendAgenticObservation(workspace, {
            goal: input.goal,
            status: input.status ?? "ok",
            summary: input.summary,
            plan: input.plan,
            blockers: input.blockers ?? [],
            note: input.note,
        })
        return ok({
            action: "append",
            observationCount: append.agenticObservations?.length ?? 0,
            observations: append.agenticObservations?.slice(-1) ?? [],
            workspace: append,
        })
    }

    const maxItems = clampIndex(input.maxItems ?? 20, 200)
    const observations = [...(workspace.agenticObservations ?? [])].reverse().filter(item => !input.status || item.status === input.status)
    const filtered = input.goal ? observations.filter(item => item.goal.includes(input.goal ?? "")) : observations
    return ok({
        action: "read",
        count: filtered.length,
        truncatedTo: maxItems,
        observations: filtered.slice(0, maxItems),
    })
}

export const agenticObserveWorkspace = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includePolicy?: boolean }) => {
    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    if (scope.notebooks.length === 0) return notFound("No matching notebook found.")

    const health = workspaceHealthCheck(workspace, userId)
    const drift = contentDriftMonitor(workspace, userId, { notebookId: input.notebookId })
    const duplicates = findDuplicateContent(workspace, userId, { notebookId: input.notebookId })
    const orphaned = analyzeOrphanedData(workspace, userId)

    if (!duplicates.ok) return duplicates
    if (!orphaned.ok) return orphaned
    if (!drift.ok) return drift

    const policy = input.includePolicy ? scope.notebooks.map(notebook => workspacePolicyEngine(workspace, userId, { action: "validate", notebookId: notebook.id })) : []
    const policyFailures = policy.filter(item => item.ok && item.value.passed === false).length

    const issueSummary = {
        total: health.ok ? health.value.issues.length : 0,
        blockers: health.ok ? health.value.issues.filter(item => item.severity === "error").length : 1,
        warnings: health.ok ? health.value.issues.filter(item => item.severity === "warning").length : 0,
    }

    return ok({
        scope: scope.notebookIds.length === 1 ? "notebook" : "workspace",
        notebookIds: scope.notebookIds,
        counts: countScopeState(scope),
        health: issueSummary,
        duplicates: {
            totalGroups: duplicates.value.totalGroups,
            totalMatches: duplicates.value.matches.length,
        },
        orphaned: {
            orphanPages: orphaned.value.orphanPages.length,
            orphanTopics: orphaned.value.orphanTopics.length,
            orphanViews: orphaned.value.orphanViews.length,
        },
        drift: {
            staleCount: drift.value.staleCount,
            staleThresholdDays: drift.value.staleThresholdDays,
        },
        policy: input.includePolicy
            ? {
                  validated: policyFailures === 0,
                  checkedNotebooks: scope.notebookIds.length,
                  failureCount: policyFailures,
              }
            : undefined,
        recentObservations: (workspace.agenticObservations ?? []).slice(-5),
    })
}

export const agenticIntentToPlan = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        goal: string
        notebookId?: string
        includePrechecks?: boolean
        maxSteps?: number
        constraints?: string[]
    },
) => {
    const goal = safeTrim(input.goal)
    if (!goal) return invalidInput("goal is required.")
    const targetNotebookId = safeTrim(input.notebookId) || (input.notebookId === "" ? "" : undefined)
    const notebook = targetNotebookId ? findOwnedNotebook(workspace, userId, targetNotebookId) : workspace.notebooks.find(item => item.userId === userId)
    if (!notebook) return notFound("No matching notebook found.")

    const plan = planAgenticWorkflow(workspace, userId, {
        goal,
        notebookId: notebook.id,
        includePrechecks: input.includePrechecks ?? false,
    })
    if (!plan.ok) return plan

    const normalizedConstraints = (input.constraints ?? []).map(item => safeTrim(item).toLowerCase()).filter(Boolean)
    const steps = [...plan.value.plan]
    const requested = new Set(normalizedConstraints)
    if (requested.has("publish") && !steps.some(item => item.tool === "publish_notebook")) {
        const diagnose = publishDiagnose(workspace, userId, { notebookId: notebook.id })
        if (diagnose.ok && diagnose.value.ready) steps.push({ tool: "publish_notebook", input: { notebookId: notebook.id, publish: true } })
    }

    if (requested.has("repair") && !steps.some(item => item.tool === "repair_workspace")) steps.push({ tool: "repair_workspace", input: {} })

    if (requested.includes("restructure") && !steps.some(item => item.tool === "agentic_suggest_restructure"))
        steps.push({ tool: "agentic_suggest_restructure", input: { notebookId: notebook.id } })

    return ok({
        ...plan.value,
        goal,
        notebookId: notebook.id,
        constraints: normalizedConstraints,
        plan: steps.slice(0, clampIndex(input.maxSteps ?? steps.length, 200)),
    })
}

export const agenticPlanDryRun = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { plan: Array<{ tool: string; input: Record<string, unknown> }>; notebookId?: string; maxSteps?: number },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const impact = computeChangeImpact(workspace, userId, {
        operations: input.plan,
        maxSteps: input.maxSteps,
    })
    if (!impact.ok) return impact

    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    const targetScope = {
        notebooks: scope.notebookIds,
        pages: scope.pages.map(item => item.id),
        topics: scope.topics.map(item => item.id),
        views: scope.views.map(item => item.id),
    }

    const touched = {
        notebooks: [...new Set(impact.value.operationReports.flatMap(report => report.touched.notebooks))].filter(id => targetScope.notebooks.includes(id)),
        pages: [...new Set(impact.value.operationReports.flatMap(report => report.touched.pages))].filter(id => targetScope.pages.includes(id)),
        topics: [...new Set(impact.value.operationReports.flatMap(report => report.touched.topics))].filter(id => targetScope.topics.includes(id)),
        views: [...new Set(impact.value.operationReports.flatMap(report => report.touched.views))].filter(id => targetScope.views.includes(id)),
    }
    const blockers = impact.value.operationReports.flatMap(item => item.warnings)
    return ok({
        status: impact.value.workspacePreview.issueCount > 0 ? "risk" : "ok",
        before: countScopeState(scopedWorkspaceEntities(workspace, userId, input.notebookId)),
        after: impact.value.workspacePreview,
        touched,
        operationReports: impact.value.operationReports.map(item => ({
            tool: item.tool,
            input: item.touched ? ({ tool: item.tool, input: item.touched } as Record<string, unknown>) : item.tool === "" ? {} : { tool: item.tool, input: {} },
            issueCount: item.issueCount,
            warnings: item.warnings,
        })),
        changed: impact.value.executed,
        blockedCount: blockers.length,
        warnings: [...new Set(blockers)],
        dryRun: true,
    } as AgenticDryRunResult)
}

export const agenticPlanGuardrail = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        maxRisk?: "low" | "medium" | "high"
        notebookId?: string
        runValidation?: boolean
    },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")
    const maxRisk = input.maxRisk ?? "high"
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const risk = planRiskProfile(workspace, userId, {
        notebookId: input.notebookId,
        plan: input.plan,
    })
    if (!risk.ok) return risk

    const riskOrder = { low: 1, medium: 2, high: 3 }
    const approved: ChangePlanOperation[] = []
    const rejected: Array<{ tool: string; reason: string; risk: "low" | "medium" | "high" }> = []
    const policy = input.notebookId ? workspacePolicyEngine(workspace, userId, { action: "validate", notebookId: input.notebookId }) : undefined

    risk.value.operationRisk.forEach(item => {
        const level = item.risk
        if (riskOrder[level] > riskOrder[maxRisk]) {
            rejected.push({ tool: item.tool, risk: level, reason: item.reasons.join(", ") || "Risk exceeds configured threshold." })
            return
        }

        approved.push({ tool: item.tool, input: input.plan[item.index]?.input ?? {} })
    })

    const validation = input.runValidation ? validateAfterMutation(workspace, userId, input.notebookId ? { notebookId: input.notebookId } : {}) : undefined
    if (validation && !validation.ok) return validation

    const policyFailed = input.notebookId && policy && policy.ok && policy.value.passed === false ? policy.value.violations.length : 0
    const blockers: string[] = [...risk.value.blockerRisk]
    if (policyFailed) blockers.push(`Policy validation blocked: ${policyFailed} rule violation(s).`)

    return ok({
        status: blockers.length === 0 && approved.length > 0 ? "go" : "hold",
        overallRisk: risk.value.overallRisk,
        riskThreshold: maxRisk,
        approvedPlan: approved,
        rejectedPlan: rejected,
        blockers,
        validation: validation ? validation.value : undefined,
        policy: input.notebookId ? (policy?.ok ? policy.value : undefined) : undefined,
    })
}

export const agenticExecuteWithSla = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        notebookId?: string
        continueOnFailure?: boolean
        dryRun?: boolean
        maxSteps?: number
        rollbackOnFailure?: boolean
        slaMs?: number
        maxBlockers?: number
        maxWarnings?: number
        rollbackOnSlaFailure?: boolean
        checkpointLabel?: string
    },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const startMs = Date.now()
    const execution = executePlanOptimistic(workspace, userId, {
        ...input,
        continueOnFailure: input.continueOnFailure ?? false,
        dryRun: input.dryRun ?? false,
        rollbackOnFailure: input.rollbackOnFailure ?? false,
        checkpointLabel: input.checkpointLabel ?? `sla-${startMs}`,
    })
    if (!execution.ok) return execution

    const elapsedMs = Date.now() - startMs
    const blockers = execution.value.blockers ?? []
    const slaMs = typeof input.slaMs === "number" && input.slaMs > 0 ? input.slaMs : Number.POSITIVE_INFINITY
    const warningCount = execution.value.validation?.warnings.length ?? 0
    const statusParts = []

    if (elapsedMs > slaMs) statusParts.push(`Execution exceeded SLA ${slaMs}ms.`)
    if (input.maxBlockers !== undefined && blockers.length > input.maxBlockers) statusParts.push(`Blockers exceeded ${input.maxBlockers}.`)
    if (input.maxWarnings !== undefined && warningCount > input.maxWarnings) statusParts.push(`Warnings exceeded ${input.maxWarnings}.`)

    const slaMet = statusParts.length === 0

    let restoredFromSla = false
    let restoredFromCheckpoint = false
    if (!slaMet && (input.rollbackOnSlaFailure ?? false) && !input.dryRun && !input.rollbackOnFailure) {
        const restored = restoreRevertPoint(execution.value.workspace as VisualNoteWorkspace, userId, {})
        if (restored.ok) {
            restoredFromSla = true
            restoredFromCheckpoint = true
            return ok({
                ...execution.value,
                workspace: restored.value.restoredWorkspace,
                slaMs,
                elapsedMs,
                slaMet: false,
                slaViolations: statusParts,
                restoredFromSla,
                restoredFromCheckpoint,
            })
        }
    }

    return ok({
        ...execution.value,
        slaMs,
        elapsedMs,
        slaMet,
        slaViolations: statusParts,
        restoredFromSla,
        restoredFromCheckpoint,
    })
}

export const agenticAutoRepair = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includeDrift?: boolean; dryRun?: boolean }) => {
    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    if (scope.notebooks.length === 0) return notFound("No matching notebook found.")

    const gaps = analyzeWorkspaceGaps(workspace, userId, {
        notebookId: input.notebookId,
        includeHealthSummary: true,
    })
    const baseRepairOps = [{ tool: "repair_workspace_consistency", input: {} }]
    const plan = input.notebookId ? [...baseRepairOps, { tool: "reconcile_external_reference", input: { notebookId: input.notebookId, includeDisplayUrls: true } }] : baseRepairOps

    if (input.dryRun)
        return ok({
            dryRun: true,
            plan,
            gaps: gaps.ok ? gaps.value : { totalGaps: 0, suggestions: [] },
        })

    const repaired = repairWorkspaceConsistency(workspace, userId)
    if (!repaired.ok) return repaired
    if (!repaired.value.repairedWorkspace) return invalidInput("Unable to repair workspace consistency.")

    const nextWorkspace = repaired.value.repairedWorkspace
    const validation = input.notebookId ? validateAfterMutation(nextWorkspace, userId, { notebookId: input.notebookId }) : validateAfterMutation(nextWorkspace, userId, {})
    if (!validation.ok) return validation

    return ok({
        dryRun: false,
        plan,
        repaired: repaired.value,
        validation: validation.value,
        workspace: nextWorkspace,
        note: `Applied ${repaired.value.repaired ? repaired.value.repairedCount : 0} repair operation(s).`,
    })
}

export const agenticSuggestRestructure = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; maxSuggestions?: number }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const navigation = proposeNavigationOrder(workspace, userId, { notebookId: notebook.id, dryRun: true })
    if (!navigation.ok) return navigation
    const semantic = topicSemanticsGraph(workspace, userId, {
        notebookId: notebook.id,
        threshold: 0.2,
        maxEdgesPerTopic: 8,
    })
    if (!semantic.ok) return semantic

    const suggestions: WorkspaceOpportunity[] = []
    const scope = scopedWorkspaceEntities(workspace, userId, notebook.id)
    const currentPageOrder = byPosition(scope.pages).map(item => item.id)
    if (JSON.stringify(currentPageOrder) !== JSON.stringify(navigation.value.planned?.pageIds ?? currentPageOrder))
        suggestions.push({
            id: notebook.id,
            scope: "notebook",
            priority: "medium",
            action: "reorder_pages",
            detail: "Current page order differs from semantic/overview-first recommendation.",
            targetId: notebook.id,
            targetTitle: `Restructure ${notebook.title}`,
        })

    navigation.value.planned?.topicOrders.forEach(item => {
        const planned = item.topicIds
        const current = byPosition(scope.topics.filter(topic => topic.pageId === item.pageId)).map(topic => topic.id)
        if (JSON.stringify(current) !== JSON.stringify(planned))
            suggestions.push({
                id: item.pageId,
                scope: "page",
                priority: "low",
                action: "reorder_topics",
                detail: "Adjust topic order to prefer overview and descriptive names.",
                targetId: item.pageId,
                targetTitle: `Page ${item.pageId}`,
            })
    })

    semantic.value.edges.forEach(edge => {
        suggestions.push({
            id: edge.toTopicId,
            scope: "topic",
            priority: edge.weight >= 0.45 ? "medium" : "low",
            action: "create_semantic_link",
            detail: `Strong semantic link to ${edge.fromTopicId} with weight ${edge.weight}.`,
            targetId: edge.toTopicId,
            targetTitle: edge.toTopicId,
        })
    })

    const maxSuggestions = clampIndex(input.maxSuggestions ?? 12, 40)
    return ok({
        notebookId: notebook.id,
        suggestionCount: suggestions.length,
        suggestions: suggestions.slice(0, maxSuggestions),
        plan: [...(navigation.value.planned?.topicOrders.map(item => ({ tool: "reorder_topics", input: { pageId: item.pageId, topicIds: item.topicIds } })) ?? [])].slice(0, 20),
    })
}

export const agenticReferenceRewrite = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId?: string; includeDisplayUrls?: boolean; applyFixes?: boolean; dryRun?: boolean },
) => {
    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    if (scope.notebooks.length === 0) return notFound("No matching notebook found.")

    const reconciled = reconcileExternalReference(workspace, userId, {
        notebookId: input.notebookId,
        includeDisplayUrls: input.includeDisplayUrls ?? false,
    })
    if (!reconciled.ok) return reconciled

    const candidates = reconciled.value.candidates.filter(item => item.status === "unresolved")
    const titleToId = new Map<string, string[]>()
    scope.pages.forEach(item => titleToId.set(item.title.toLowerCase(), [...(titleToId.get(item.title.toLowerCase()) ?? []), item.id]))
    scope.topics.forEach(item => titleToId.set(item.title.toLowerCase(), [...(titleToId.get(item.title.toLowerCase()) ?? []), item.id]))
    scope.views.forEach(item => titleToId.set(item.title.toLowerCase(), [...(titleToId.get(item.title.toLowerCase()) ?? []), item.id]))

    const rewrites: Array<{ viewId: string; oldUrl: string; newUrl: string; context: string }> = []
    const byView = new Map<string, string>()
    candidates.forEach(candidate => {
        const urlKey = safeTrim(candidate.link).toLowerCase()
        if (!candidate.link || candidate.link.includes("http")) return
        const label = safeTrim(candidate.context).toLowerCase()
        const targetIds = titleToId.get(urlKey.replace(/^#/, "").trim()) ?? titleToId.get(label) ?? []
        if (targetIds.length !== 1) return
        const targetId = targetIds[0]
        if (!targetId) return
        rewrites.push({ viewId: candidate.sourceViewId, oldUrl: candidate.link, newUrl: `#${targetId}`, context: candidate.context })
        const next =
            byView.get(candidate.sourceViewId) ??
            byView.set(candidate.sourceViewId, scope.views.find(view => view.id === candidate.sourceViewId)?.content ?? "").get(candidate.sourceViewId)
        if (next) byView.set(candidate.sourceViewId, next.replace(candidate.link, `#${targetId}`))
    })

    if (!rewrites.length) return ok({ ...reconciled.value, rewrites: [], applied: false, applyRequested: input.applyFixes ?? false })
    if (!input.applyFixes || input.dryRun) return ok({ ...reconciled.value, rewrites, applied: false, applyRequested: input.applyFixes ?? false })

    let nextWorkspace = cloneWorkspace(workspace)
    Array.from(byView.entries()).forEach(([viewId, content]) => {
        const view = nextWorkspace.views.find(item => item.id === viewId)
        if (!view) return
        const rewritten = writeViewContent(nextWorkspace, viewId, content, view.displays.length)
        nextWorkspace = rewritten.workspace
    })

    return ok({
        ...reconciled.value,
        rewrites,
        applied: true,
        workspace: nextWorkspace,
        applyRequested: true,
    })
}

export const agenticComponentPipeline = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; apply?: boolean; maxSteps?: number }) => {
    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    if (scope.notebooks.length === 0) return notFound("No matching notebook found.")

    const proposal = proposeSchemaEvolution(workspace, userId, { notebookId: input.notebookId })
    if (!proposal.ok) return proposal

    const pipeline = proposal.value.proposals
        .slice(0, clampIndex(input.maxSteps ?? proposal.value.proposals.length, 120))
        .map(item => {
            if (item.action === "migrate_view_to_structured" && item.scope === "view")
                return { tool: "rewrite_view_layout_for_mode", input: { viewId: item.id, mode: "structured", addRecommendedDisplays: true } }

            if (item.action === "add_primary_display" && item.scope === "view")
                return { tool: "add_display_to_view", input: { viewId: item.id, kind: "data-card", name: "Primary data card" } }

            return undefined
        })
        .filter((next): next is ChangePlanOperation => Boolean(next))

    if (!input.apply) return ok({ scope: "notebook", notebookIds: scope.notebookIds, proposals: proposal.value.proposals, pipeline, applied: false })

    const applied = executePlanWithGuarantees(workspace, userId, {
        plan: pipeline.map(item => ({ tool: item.tool, input: item.input })),
        continueOnFailure: false,
        dryRun: false,
        rollbackOnFailure: true,
        notebookId: input.notebookId,
        maxSteps: input.maxSteps,
    })
    if (!applied.ok) return applied

    return ok({
        ...proposal.value,
        scope: "notebook",
        notebookIds: scope.notebookIds,
        pipeline,
        applied: true,
        execution: {
            blockers: applied.value.blockers,
            validation: applied.value.validation,
        },
        workspace: applied.value.workspace,
    })
}

export const agenticChangeSet = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { plan: Array<{ tool: string; input: Record<string, unknown> }>; notebookId?: string; maxSteps?: number },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const operations = input.plan.slice(0, input.maxSteps ?? input.plan.length)
    let nextWorkspace = cloneWorkspace(workspace)
    const scopeBefore = scopedWorkspaceEntities(nextWorkspace, userId, input.notebookId)
    const touched = new Set<string>()
    const stepResults: Array<{ step: number; tool: string; blocked: boolean; issueCount: number; warnings: string[] }> = []
    for (let index = 0; index < operations.length; index += 1) {
        const operation = operations[index]
        const beforeWorkspace = nextWorkspace
        const applied = applyChangePlanOperation(nextWorkspace, userId, operation)
        if (!applied.ok) return invalidInput(`Invalid operation at step ${index + 1}: ${operation.tool}. ${applied.message}`)

        nextWorkspace = applied.value.workspace
        const after = collectIssueSummary(nextWorkspace, userId)
        touched.add(`${operation.tool}:${index}`)
        const impacted = touchedFromInput(operation)
        Object.values(impacted).forEach(list => list.forEach(id => touched.add(id)))

        const warnings = after.blockers > 0 ? [`Step ${index + 1} left workspace with ${after.blockers} blocking issue(s).`] : []
        stepResults.push({
            step: index + 1,
            tool: operation.tool,
            blocked: warnings.length > 0,
            issueCount: after.blockers,
            warnings,
        })
    }

    const scopeAfter = scopedWorkspaceEntities(nextWorkspace, userId, input.notebookId)
    const beforeCount = countScopeState(scopeBefore)
    const afterCount = countScopeState(scopeAfter)
    const added = {
        notebooks: Math.max(0, afterCount.notebooks - beforeCount.notebooks),
        pages: Math.max(0, afterCount.pages - beforeCount.pages),
        topics: Math.max(0, afterCount.topics - beforeCount.topics),
        views: Math.max(0, afterCount.views - beforeCount.views),
        displays: Math.max(0, afterCount.displays - beforeCount.displays),
    }
    const removed = {
        notebooks: Math.max(0, beforeCount.notebooks - afterCount.notebooks),
        pages: Math.max(0, beforeCount.pages - afterCount.pages),
        topics: Math.max(0, beforeCount.topics - afterCount.topics),
        views: Math.max(0, beforeCount.views - afterCount.views),
        displays: Math.max(0, beforeCount.displays - afterCount.displays),
    }

    return ok({
        dryRun: true,
        before: beforeCount,
        after: afterCount,
        added,
        removed,
        touchedEntityCount: touched.size,
        stepResults,
        plan: operations,
        workspace: nextWorkspace,
    })
}

export const agenticContractEnforcer = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includePolicy?: boolean; autoFix?: boolean }) => {
    const contract = agenticContractCheck(workspace, userId, { notebookId: input.notebookId, includePolicy: input.includePolicy ?? true })
    if (!contract.ok) return contract

    const checks = contract.value.scope === "notebook" ? [contract.value] : contract.value.checks
    const passed =
        contract.value.scope === "notebook"
            ? contract.value.contract.ok && (contract.value.policy ? contract.value.policy.ok : true)
            : checks.every(item => item.contract.ok && (input.includePolicy ? (item.policy?.ok ?? true) : true))
    const invariant = assertWorkspaceInvariants(workspace, userId, { notebookId: input.notebookId })
    if (!invariant.ok) return invariant

    if (input.autoFix && !passed) {
        const repaired = agenticAutoRepair(workspace, userId, {
            notebookId: input.notebookId,
            includeDrift: true,
            dryRun: false,
        })
        if (!repaired.ok) return repaired
        const refreshed = agenticContractCheck(repaired.value.workspace, userId, { notebookId: input.notebookId, includePolicy: input.includePolicy ?? true })
        return ok({
            ...contract.value,
            passed: refreshed.ok ? (refreshed.value.scope === "notebook" ? refreshed.value.contract.ok : true) : passed,
            autoFixed: true,
            fixedWorkspace: repaired.value.workspace,
            refreshed: refreshed.ok ? refreshed.value : null,
            invariants: invariant.value,
        })
    }

    return ok({
        ...contract.value,
        passed,
        autoFixed: false,
        invariants: invariant.value,
    })
}

export const agenticToolSelector = (workspace: VisualNoteWorkspace, userId: string, input: { goal: string }) => {
    const goal = tokenize(safeTrim(input.goal)).map(word => word.toLowerCase())
    if (!goal.length) return invalidInput("goal is required.")

    const capability = listMcpToolCapabilities().value.tools.map(item => item.name)
    if (!capability.includes("list_notebooks")) return invalidInput("Tool registry unavailable.")
    const suggestions: Array<{
        tool: string
        confidence: number
        reason: string
    }> = []

    if (goal.some(token => ["publish", "release", "ship"].includes(token))) {
        suggestions.push({ tool: "agentic_contract_enforcer", confidence: 0.9, reason: "Validate publish and policy constraints." })
        suggestions.push({ tool: "publish_diagnose", confidence: 0.85, reason: "Run publish readiness diagnostics." })
    }

    if (goal.some(token => ["structure", "organize", "restructure", "layout"].includes(token)))
        suggestions.push({ tool: "agentic_suggest_restructure", confidence: 0.82, reason: "Generate page/topic/view structure recommendations." })

    if (goal.some(token => ["reference", "link", "broken", "anchor"].includes(token)))
        suggestions.push({ tool: "agentic_reference_rewrite", confidence: 0.84, reason: "Inspect unresolved links and propose safe rewrites." })

    if (goal.some(token => ["repair", "fix", "recover", "heal"].includes(token)))
        suggestions.push({ tool: "agentic_auto_repair", confidence: 0.88, reason: "Run safe deterministic repair sequence." })

    if (goal.some(token => ["observe", "status", "health", "summary"].includes(token)))
        suggestions.push({ tool: "agentic_observe_workspace", confidence: 0.95, reason: "Return concise workspace health and risk summary." })

    if (goal.some(token => ["plan", "dry-run", "simulate", "forecast"].includes(token)))
        suggestions.push({ tool: "agentic_plan_dryrun", confidence: 0.9, reason: "Simulate impact of a proposed agent plan." })

    if (goal.some(token => ["guard", "risk", "safe", "constraints"].includes(token)))
        suggestions.push({ tool: "agentic_plan_guardrail", confidence: 0.87, reason: "Screen a plan against risk and policy before execution." })

    if (goal.some(token => ["execute", "perform", "carry", "do"].includes(token)))
        suggestions.push({ tool: "agentic_execute_with_sla", confidence: 0.85, reason: "Run a guarded execution path with SLA feedback." })

    if (goal.some(token => ["pipeline", "component", "dashboard", "display"].includes(token)))
        suggestions.push({ tool: "agentic_component_pipeline", confidence: 0.8, reason: "Run schema-aware component and layout transitions." })

    if (goal.some(token => ["change", "set", "diff", "preview"].includes(token)))
        suggestions.push({ tool: "agentic_change_set", confidence: 0.86, reason: "Show projected change set before mutation." })

    if (!suggestions.length) suggestions.push({ tool: "agentic_intent_to_plan", confidence: 0.71, reason: "Default conversion from goal to executable plan." })

    return ok({
        query: safeTrim(input.goal),
        suggestions,
        fallbackTools: ["read_workspace", "analyze_workspace_gaps", "list_notebooks"].filter(tool => capability.includes(tool)),
    })
}

export const agenticObservationQuery = (workspace: VisualNoteWorkspace, userId: string, input: { status?: "ok" | "warning" | "failed"; goal?: string; maxItems?: number }) =>
    agenticObservationLog(workspace, userId, {
        action: "read",
        status: input.status,
        goal: input.goal,
        maxItems: input.maxItems,
    })

export const agenticWorkflowJob = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        goal?: string
        notebookId?: string
        plan?: Array<{ tool: string; input: Record<string, unknown> }>
        execute?: boolean
        dryRun?: boolean
        continueOnFailure?: boolean
        maxSteps?: number
        runPrechecks?: boolean
        rollbackOnFailure?: boolean
    },
) => {
    if (!safeTrim(input.goal) && (!Array.isArray(input.plan) || input.plan.length === 0)) return invalidInput("A goal or plan is required.")

    const execute = input.execute ?? false
    const dryRun = input.dryRun ?? false
    const resolvedNotebook = input.notebookId ? findOwnedNotebook(workspace, userId, input.notebookId) : workspace.notebooks.find(item => item.userId === userId)
    if (input.notebookId && !resolvedNotebook) return notFound("Notebook not found.")

    let plan = input.plan
    if ((!plan || plan.length === 0) && input.goal && resolvedNotebook) {
        const intent = agenticIntentToPlan(workspace, userId, {
            goal: input.goal,
            notebookId: resolvedNotebook.id,
            includePrechecks: input.runPrechecks ?? false,
        })
        if (!intent.ok) return intent
        plan = intent.value.plan
    }

    const selectedPlan = (plan ?? []).slice(0, Math.max(1, Math.min(input.maxSteps ?? plan?.length ?? 1, 300)))
    const initialJob = buildWorkflowJob(
        {
            goal: safeTrim(input.goal),
            notebookId: resolvedNotebook?.id,
            execute,
            dryRun,
            plan: selectedPlan,
        },
        {
            status: execute && !dryRun ? "running" : "queued",
            note: execute ? "Execution requested." : safeTrim(input.goal) ? "Plan prepared for execution request." : "Plan prepared for replay.",
        },
    )
    storeWorkflowJob(initialJob)

    if (!execute) {
        const impact = selectedPlan.length > 0 ? computeChangeImpact(workspace, userId, { operations: selectedPlan }) : undefined
        const finalJob: AgenticWorkflowJob = {
            ...initialJob,
            status: "completed",
            updatedAt: new Date().toISOString(),
            note: "Plan prepared without execution. Review before running.",
            result: {
                blockers: impact && impact.ok ? [...new Set(impact.value.operationReports.flatMap(item => item.warnings))] : [],
                warnings: [],
                validation: {
                    blockers: impact && impact.ok ? [impact.value.operationReports.filter(item => item.issueCount > 0).length.toString()] : [],
                    warnings: [],
                    blockersCount: impact && impact.ok ? impact.value.workspacePreview.blockers : 0,
                    warningCount: impact && impact.ok ? impact.value.operationReports.length : 0,
                },
            },
        }
        storeWorkflowJob(finalJob)

        return ok({
            ...finalJob,
            jobId: initialJob.jobId,
            plan: selectedPlan,
            runSummary: {
                status: "ready",
                impactWarnings: finalJob.result?.blockers.length ?? 0,
            },
        })
    }

    const executed = executePlanWithGuarantees(workspace, userId, {
        plan: selectedPlan,
        notebookId: resolvedNotebook?.id,
        continueOnFailure: input.continueOnFailure ?? false,
        dryRun,
        rollbackOnFailure: input.rollbackOnFailure ?? true,
        maxSteps: selectedPlan.length,
    })
    if (!executed.ok) {
        const failedJob = {
            ...initialJob,
            status: "failed",
            updatedAt: new Date().toISOString(),
            note: executed.message,
            blockers: [executed.message],
        } as AgenticWorkflowJob
        storeWorkflowJob(failedJob)
        return ok({
            job: failedJob,
            plan: selectedPlan,
            runSummary: {
                status: "failed",
                impactWarnings: failedJob.blockers.length,
            },
        })
    }

    const finalJob = {
        ...initialJob,
        status: executed.value.blockers.length > 0 ? "failed" : "completed",
        updatedAt: new Date().toISOString(),
        note: executed.value.validation?.blockers.length ? "Execution completed with blockers." : "Execution completed successfully.",
        blockers: executed.value.blockers,
        warnings: executed.value.validation?.warnings ?? [],
        result: {
            blockers: executed.value.blockers,
            warnings: executed.value.validation?.warnings ?? [],
            validation: {
                blockers: executed.value.validation?.blockers ?? [],
                warnings: executed.value.validation?.warnings ?? [],
                blockersCount: executed.value.validation?.blockers.length ?? 0,
                warningCount: executed.value.validation?.warnings.length ?? 0,
            },
        },
    } as AgenticWorkflowJob
    storeWorkflowJob(finalJob)

    const observation = appendAgenticObservation(executed.value.workspace, {
        goal: safeTrim(input.goal) || "agentic_workflow_job",
        status: executed.value.blockers.length > 0 ? "warning" : "ok",
        summary: `Workflow job ${initialJob.jobId} executed ${selectedPlan.length} step(s).`,
        plan: selectedPlan,
        blockers: executed.value.blockers,
    })

    return ok({
        job: finalJob,
        plan: selectedPlan,
        workspace: observation,
        execution: {
            applied: executed.value.applied,
            skipped: executed.value.skipped,
            dryRun: executed.value.dryRun,
            validation: executed.value.validation,
            workspaceChanged: observation !== workspace,
        },
    })
}

export const agenticWorkflowStatus = (workspace: VisualNoteWorkspace, userId: string, input: { jobId?: string }) => {
    if (input.jobId) {
        const job = workflowJobs.get(input.jobId)
        if (!job) return notFound("Workflow job not found.")
        return ok({ ...job })
    }

    const jobs = [...workflowJobs.values()].map(item => ({ ...item })).sort((left, right) => (left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0))

    return ok({
        total: jobs.length,
        jobs,
    })
}

export const agenticWorkflowCancel = (workspace: VisualNoteWorkspace, userId: string, input: { jobId: string }) => {
    if (!safeTrim(input.jobId)) return invalidInput("jobId is required.")
    const job = workflowJobs.get(input.jobId)
    if (!job) return notFound("Workflow job not found.")

    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled")
        return ok({
            ...job,
            status: job.status,
            cancelled: false,
            note: "Job is already terminal; no action taken.",
        })

    const cancelled = {
        ...job,
        status: "cancelled" as const,
        updatedAt: new Date().toISOString(),
        note: "Cancelled by user request.",
    }
    storeWorkflowJob(cancelled)
    return ok({ ...cancelled, cancelled: true })
}

export const agenticPreflightGate = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId?: string
        plan?: Array<{ tool: string; input: Record<string, unknown> }>
        maxRisk?: "low" | "medium" | "high"
        includePolicy?: boolean
        includePublishReadiness?: boolean
    },
) => {
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const observation = agenticObserveWorkspace(workspace, userId, {
        notebookId: input.notebookId,
        includePolicy: input.includePolicy,
    })
    if (!observation.ok) return observation

    const guardrail = input.plan?.length
        ? agenticPlanGuardrail(workspace, userId, {
              notebookId: input.notebookId,
              plan: input.plan,
              maxRisk: input.maxRisk,
          })
        : undefined
    if (guardrail && !guardrail.ok) return guardrail

    const publishReadiness = input.includePublishReadiness
        ? publishPreflightMultiNotebook(workspace, userId, {
              notebookIds: input.notebookId ? [input.notebookId] : undefined,
              includeRecoveryPlan: false,
          })
        : undefined
    if (publishReadiness && !publishReadiness.ok) return publishReadiness

    const blockers = [
        ...(observation.value.health?.blockers ? [`Health blockers: ${observation.value.health.blockers}`] : []),
        ...(guardrail && !guardrail.ok ? [guardrail.message] : []),
    ]

    if (publishReadiness && !publishReadiness.ok) blockers.push(publishReadiness.message)

    const guardrailBlockers = guardrail?.ok ? (guardrail.value.blockers ?? []) : []
    return ok({
        status: blockers.length === 0 ? "go" : "hold",
        notebookId: input.notebookId,
        blockers: [...new Set([...blockers, ...guardrailBlockers])],
        observation: {
            health: observation.value.health,
            duplicates: observation.value.duplicates,
            drift: observation.value.drift,
            policy: observation.value.policy,
        },
        guardrail: guardrail?.ok ? guardrail.value : undefined,
        publishReadiness: publishReadiness?.ok ? publishReadiness.value : undefined,
    })
}

export const agenticPlanOptimizer = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        maxSteps?: number
    },
) => {
    const maxSteps = Math.max(1, input.maxSteps ?? input.plan.length)
    const readTools = new Set([
        "read_workspace",
        "read_notebook",
        "resolve_notebook",
        "resolve_page",
        "resolve_topic",
        "resolve_view",
        "list_pages",
        "read_page",
        "read_article",
        "read_view_as_markdown",
        "read_view_as_blocks",
        "search_workspace",
        "search_semantic",
        "analyze_workspace_gaps",
        "workspace_health_check",
        "analyze_orphaned_data",
        "list_display_kinds",
        "find_duplicate_or_stale_content",
    ])

    const signature = (op: { tool: string; input: Record<string, unknown> }) => {
        const normalizedInput = Object.keys(op.input)
            .sort()
            .map(key => `${key}:${String(op.input[key])}`)
            .join(",")
        return `${op.tool}|${normalizedInput}`
    }

    const deduped: Array<{ tool: string; input: Record<string, unknown> }> = []
    const removed: Array<{ tool: string; reason: string }> = []
    const seen = new Set<string>()

    input.plan.slice(0, maxSteps).forEach(item => {
        if (readTools.has(item.tool)) {
            removed.push({ tool: item.tool, reason: "Read tool removed from mutation-focused execution." })
            return
        }

        const key = signature(item)
        if (seen.has(key)) {
            removed.push({ tool: item.tool, reason: "Duplicate operation removed." })
            return
        }

        const applied = applyChangePlanOperation(cloneWorkspace(workspace), userId, item)
        if (!applied.ok) {
            removed.push({ tool: item.tool, reason: `Unsupported op: ${applied.message}` })
            return
        }

        deduped.push(item)
        seen.add(key)
    })

    return ok({
        originalCount: input.plan.length,
        optimizedCount: deduped.length,
        plan: deduped,
        removed,
        warnings: deduped.length < input.plan.length ? ["Plan was reordered and filtered to safe, executable operations."] : [],
    })
}

export const agenticPlanReconciler = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        notebookId?: string
    },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")
    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    const notebookIds = new Set(scope.notebooks.map(item => item.id))
    const pageIds = new Set(scope.pages.map(item => item.id))
    const topicIds = new Set(scope.topics.map(item => item.id))
    const viewIds = new Set(scope.views.map(item => item.id))
    const displayIds = new Set(scope.views.flatMap(view => view.displays.map(display => display.id)))

    const findByTitle = (haystack: Array<{ id: string; title: string }>, title: string) => {
        const normalized = safeTrim(title).toLowerCase()
        if (!normalized) return undefined
        return haystack.find(item => item.title.toLowerCase() === normalized) ?? haystack.find(item => item.title.toLowerCase().includes(normalized))
    }

    const reconcile = (op: { tool: string; input: Record<string, unknown> }) => {
        const next = { ...op.input }
        const unresolved: Array<{ tool: string; reason: string }> = []

        const setId = (field: string, options: { set: Set<string>; entityType: "notebook" | "page" | "topic" | "view"; fallback?: string }) => {
            const raw = typeof next[field] === "string" ? String(next[field]) : ""
            if (!raw) {
                const label = options.fallback ? String(next[options.fallback] ?? "") : ""
                const found = label ? findByTitle(entityCandidates(entityType), label) : undefined
                if (!found) {
                    unresolved.push({
                        tool: op.tool,
                        reason: `${field} is missing and no fallback title provided.`,
                    })
                    return
                }
                next[field] = found.id
                return
            }

            if (!options.set.has(raw)) {
                unresolved.push({ tool: op.tool, reason: `${field} ${raw} no longer exists.` })
                const fallback = options.fallback ? findByTitle(entityCandidates(options.entityType), String(next[options.fallback] ?? "")) : undefined
                if (fallback) next[field] = fallback.id
            }
        }

        const entityCandidates = (type: "notebook" | "page" | "topic" | "view") => {
            if (type === "notebook") return [...workspace.notebooks.filter(item => item.userId === userId).map(item => ({ id: item.id, title: item.title }))]

            if (type === "page") return [...scope.pages.map(item => ({ id: item.id, title: item.title }))]

            if (type === "topic") return [...scope.topics.map(item => ({ id: item.id, title: item.title }))]

            return [...scope.views.map(item => ({ id: item.id, title: item.title }))]
        }

        setId("notebookId", { set: notebookIds, entityType: "notebook", fallback: "notebookTitle" })
        setId("pageId", { set: pageIds, entityType: "page", fallback: "pageTitle" })
        setId("topicId", { set: topicIds, entityType: "topic", fallback: "topicTitle" })
        setId("viewId", { set: viewIds, entityType: "view", fallback: "viewTitle" })

        const arrays = ["pageIds", "topicIds", "viewIds", "displayIds", "ids"] as const
        arrays.forEach(field => {
            const values = next[field]
            if (!Array.isArray(values)) return
            const targetSet =
                field === "pageIds" ? pageIds : field === "topicIds" ? topicIds : field === "viewIds" ? viewIds : field === "displayIds" ? displayIds : new Set<string>()
            const nextIds = values.filter(item => typeof item === "string" && targetSet.has(item))
            if (nextIds.length !== values.length)
                unresolved.push({
                    tool: op.tool,
                    reason: `${field} had stale entries and was filtered.`,
                })

            next[field] = nextIds
        })

        return { operation: { ...op, input: next }, unresolved }
    }

    const reconciled: Array<{ tool: string; input: Record<string, unknown> }> = []
    const unresolved: Array<{ tool: string; reason: string }> = []

    input.plan.forEach(op => {
        const result = reconcile(op)
        if (!result) return
        reconciled.push(result.operation)
        unresolved.push(...result.unresolved)
    })

    return ok({
        originalCount: input.plan.length,
        reconciledCount: reconciled.length,
        plan: reconciled,
        unresolved,
        changed: unresolved.length === 0 ? false : true,
    })
}

export const agenticGoalExpander = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        goal: string
        notebookId?: string
        maxSubgoals?: number
    },
) => {
    const goal = safeTrim(input.goal)
    if (!goal) return invalidInput("goal is required.")

    const notebook = input.notebookId ? findOwnedNotebook(workspace, userId, input.notebookId) : workspace.notebooks.find(item => item.userId === userId)
    if (input.notebookId && !notebook) return notFound("Notebook not found.")

    const tokens = new Set(tokenize(goal).map(item => item.toLowerCase()))
    const maxSubgoals = Math.max(1, Math.min(input.maxSubgoals ?? 6, 16))
    const expanded = [] as Array<{ id: string; goal: string; tools: string[]; rationale: string }>

    if (tokens.has("publish") || tokens.has("release"))
        expanded.push({
            id: "publish-readiness",
            goal: "Validate publish readiness and blockers for target notebook.",
            tools: ["agentic_publish_readiness_gate", "publish_diagnose", "publish_notebook"],
            rationale: "Publish requires contract and policy checks before change visibility.",
        })

    if (tokens.has("structure") || tokens.has("restructure"))
        expanded.push({
            id: "structure",
            goal: "Improve page-topic-view layout and reduce empty content.",
            tools: ["agentic_suggest_restructure", "agentic_component_pipeline", "agentic_plan_optimizer"],
            rationale: "Structure changes are lower risk if done in order by page and topic.",
        })

    if (tokens.has("reference") || tokens.has("link"))
        expanded.push({
            id: "references",
            goal: "Find and reconcile unresolved references and broken links.",
            tools: ["agentic_reference_rewrite", "reconcile_external_reference", "agentic_plan_reconciler"],
            rationale: "Reference rewrites keep content navigable without data loss.",
        })

    expanded.push({
        id: "health",
        goal: "Run health checks and produce a safe execution plan.",
        tools: ["agentic_observe_workspace", "analyze_workspace_gaps", "agentic_preflight_gate"],
        rationale: "Gate checks should precede all large automated edits.",
    })

    if (tokens.has("repair") || tokens.has("fix"))
        expanded.push({
            id: "repair",
            goal: "Repair drift, duplicates, and stale structure before final output.",
            tools: ["agentic_auto_repair", "agentic_change_set", "agentic_plan_dryrun"],
            rationale: "Repairs lower failure probability and improve publish quality.",
        })

    return ok({
        goal,
        notebookId: notebook?.id,
        notebookTitle: notebook?.title,
        maxSubgoals,
        expandedGoals: expanded.slice(0, maxSubgoals),
    })
}

export const agenticImpactScoper = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        notebookId?: string
        maxSteps?: number
    },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan is required.")

    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const impact = computeChangeImpact(workspace, userId, {
        operations: input.plan,
        maxSteps: input.maxSteps,
    })
    if (!impact.ok) return impact

    const risk = planRiskProfile(workspace, userId, {
        notebookId: input.notebookId,
        plan: input.plan,
    })
    if (!risk.ok) return risk

    const touched = {
        notebooks: [...new Set(impact.value.operationReports.flatMap(item => item.touched.notebooks))],
        pages: [...new Set(impact.value.operationReports.flatMap(item => item.touched.pages))],
        topics: [...new Set(impact.value.operationReports.flatMap(item => item.touched.topics))],
        views: [...new Set(impact.value.operationReports.flatMap(item => item.touched.views))],
    }

    return ok({
        scope: input.notebookId ? "notebook" : "workspace",
        notebookId: input.notebookId,
        touched,
        impact: {
            before: countScopeState(scopedWorkspaceEntities(workspace, userId, input.notebookId)),
            after: {
                notebooks: impact.value.workspacePreview.notebookCount,
                pages: impact.value.workspacePreview.pageCount,
                topics: impact.value.workspacePreview.topicCount,
                views: impact.value.workspacePreview.viewCount,
            },
            changed: impact.value.executed,
            blockers: impact.value.operationReports.flatMap(item => item.warnings),
        },
        risk: risk.value,
        estimatedWork: {
            operationCount: impact.value.operationReports.length,
            warningDensity: impact.value.operationReports.length ? impact.value.operationReports.filter(item => item.warnings.length > 0).length : 0,
        },
    })
}

export const agenticMultiNotebookBatch = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        batches: Array<{
            notebookId: string
            plan: Array<{ tool: string; input: Record<string, unknown> }>
            maxSteps?: number
        }>
        execute?: boolean
        continueOnFailure?: boolean
        dryRun?: boolean
        rollbackOnFailure?: boolean
    },
) => {
    if (!Array.isArray(input.batches) || input.batches.length === 0) return invalidInput("At least one batch is required.")

    const execute = input.execute ?? false
    const dryRun = input.dryRun ?? false
    const results: Array<{
        notebookId: string
        status: "ok" | "blocked" | "skipped"
        blockers: string[]
        applied: number
        workspaceChanged: boolean
    }> = []

    let nextWorkspace = cloneWorkspace(workspace)

    for (const batch of input.batches) {
        const notebook = findOwnedNotebook(nextWorkspace, userId, batch.notebookId)
        if (!notebook) {
            const failure = {
                notebookId: batch.notebookId,
                status: "skipped" as const,
                blockers: ["Notebook not found."],
                applied: 0,
                workspaceChanged: false,
            }
            results.push(failure)
            if (input.continueOnFailure) continue
            return invalidInput(`Notebook not found: ${batch.notebookId}`)
        }

        if (batch.plan.length === 0) {
            results.push({
                notebookId: notebook.id,
                status: "skipped",
                blockers: ["Batch plan empty."],
                applied: 0,
                workspaceChanged: false,
            })
            continue
        }

        if (!execute || dryRun) {
            const impact = computeChangeImpact(nextWorkspace, userId, {
                operations: batch.plan,
                maxSteps: batch.maxSteps,
            })
            if (!impact.ok) {
                results.push({
                    notebookId: notebook.id,
                    status: "blocked",
                    blockers: [impact.message],
                    applied: 0,
                    workspaceChanged: false,
                })
                if (!input.continueOnFailure) return invalidInput(impact.message)
                continue
            }

            results.push({
                notebookId: notebook.id,
                status: "ok",
                blockers: impact.value.operationReports.flatMap(item => item.warnings),
                applied: impact.value.executed,
                workspaceChanged: false,
            })
            continue
        }

        const beforeApply = cloneWorkspace(nextWorkspace)
        const applied = applyChangePlan(nextWorkspace, userId, {
            operations: batch.plan,
            continueOnFailure: input.continueOnFailure,
            dryRun,
            maxSteps: batch.maxSteps,
        })
        if (!applied.ok) {
            results.push({
                notebookId: notebook.id,
                status: "blocked",
                blockers: ["Unable to apply batch plan."],
                applied: 0,
                workspaceChanged: false,
            })
            if (!input.continueOnFailure) return applied
            continue
        }

        const failed = applied.value.blockers.length > 0 && !input.continueOnFailure
        if (failed && input.rollbackOnFailure) nextWorkspace = beforeApply
        else nextWorkspace = applied.value.workspace

        const validation = validateAfterMutation(nextWorkspace, userId, { notebookId: notebook.id })

        if (!validation.ok) {
            if (!input.continueOnFailure) return validation
            results.push({
                notebookId: notebook.id,
                status: "blocked",
                blockers: [validation.message],
                applied: applied.value.applied,
                workspaceChanged: nextWorkspace !== beforeApply,
            })
            continue
        }

        results.push({
            notebookId: notebook.id,
            status: failed ? "blocked" : "ok",
            blockers: applied.value.blockers,
            applied: applied.value.applied,
            workspaceChanged: nextWorkspace !== beforeApply,
        })
    }

    return ok({
        execute,
        dryRun,
        totalBatches: input.batches.length,
        results,
        workspace: execute ? nextWorkspace : workspace,
    })
}

export const agenticPolicySet = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        action: "list" | "validate" | "apply"
        notebookId?: string
        policyRules?: Array<
            Partial<WorkspacePolicyRule> & {
                id: string
                check: WorkspacePolicyRule["check"]
            }
        >
    },
) => {
    const normalizeRule = (rule: Partial<WorkspacePolicyRule> & { id: string; check: WorkspacePolicyRule["check"] }): WorkspacePolicyRule => ({
        id: safeTrim(rule.id),
        name: safeTrim(rule.name) || rule.id,
        severity: rule.severity === "high" || rule.severity === "low" || rule.severity === "medium" ? rule.severity : "medium",
        check: rule.check,
    })

    const resolvedRules = input.policyRules?.length ? input.policyRules.map(item => normalizeRule(item)).filter(item => item.id && item.check) : defaultWorkspacePolicyRules

    const result = workspacePolicyEngine(workspace, userId, {
        action: input.action,
        notebookId: input.notebookId,
        policyRules: resolvedRules,
    })

    if (!result.ok) return result

    if (input.action === "apply")
        return ok({
            action: "apply",
            applied: true,
            ruleCount: resolvedRules.length,
            note: "Policies are validated at runtime. No policy persistence layer yet.",
            result: result.value,
        })

    return result
}

export const agenticPublishReadinessGate = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookIds?: string[]; includeRecoveryPlan?: boolean; includePolicy?: boolean },
) => {
    const gate = publishPreflightMultiNotebook(workspace, userId, {
        notebookIds: input.notebookIds,
        includeRecoveryPlan: input.includeRecoveryPlan ?? false,
    })
    if (!gate.ok) return gate

    const targetNotebookIds = input.notebookIds?.length
        ? input.notebookIds.filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.id)

    const contractChecks: Array<{
        notebookId: string
        passed: boolean
        blockers?: string[]
        contract?: ContractCheck
        error?: string
    }> = []
    const contractErrors: string[] = []

    targetNotebookIds.forEach(notebookId => {
        const check = agenticContractCheck(workspace, userId, { notebookId, includePolicy: input.includePolicy })
        if (!check.ok) {
            contractErrors.push(check.message)
            contractChecks.push({ notebookId, passed: false, error: check.message })
            return
        }

        contractChecks.push({
            notebookId,
            passed: check.value.passed,
            contract: check.value,
            blockers: check.value.blockers,
        })
    })

    const blockers = [
        ...(!gate.value.canPublishAll ? ["Publish readiness gate reported blockers."] : []),
        ...contractChecks.filter(item => !item.passed).map(item => `Contract check failed for notebook ${item.notebookId}`),
        ...contractErrors,
    ]

    return ok({
        status: blockers.length === 0 ? "go" : "hold",
        publishReady: gate.value.canPublishAll,
        includeRecoveryPlan: gate.value.includeRecoveryPlan,
        results: gate.value,
        contractChecks,
        blockers,
    })
}

export const agenticStructuredIngestFromText = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        text: string
        notebookId?: string
        notebookTitle?: string
        pageId?: string
        pageTitle?: string
        topicMode?: ViewMode
        maxSections?: number
        maxViewsPerSection?: number
        apply?: boolean
        dryRun?: boolean
    },
) => {
    const text = safeTrim(input.text)
    if (!text) return invalidInput("text is required.")

    const apply = input.apply ?? false
    const dryRun = input.dryRun ?? false
    const targetNotebook = input.notebookId
        ? findOwnedNotebook(workspace, userId, input.notebookId)
        : input.notebookTitle
          ? findOwnedNotebookByTitle(workspace, userId, input.notebookTitle)
          : undefined

    if (!targetNotebook) return notFound("Notebook not found.")

    const normalized = {
        text,
        maxSections: Math.max(1, Math.min(input.maxSections ?? 12, 24)),
        maxViewsPerSection: Math.max(1, Math.min(input.maxViewsPerSection ?? 8, 24)),
    }
    const outline = parseOutlineSections(normalized.text)
        .slice(0, normalized.maxSections)
        .map(section => ({
            ...section,
            views: section.views.slice(0, normalized.maxViewsPerSection),
        }))

    if (outline.length === 0) return invalidInput("No outline could be parsed from text.")

    const generated = apply
        ? generateTopicFromOutline(workspace, userId, {
              notebookId: targetNotebook.id,
              pageId: input.pageId,
              pageTitle: input.pageTitle,
              outline: normalized.text,
              topicMode: input.topicMode,
          })
        : generateTopicFromOutline(cloneWorkspace(workspace), userId, {
              notebookId: targetNotebook.id,
              pageId: input.pageId,
              pageTitle: input.pageTitle,
              outline: normalized.text,
              topicMode: input.topicMode,
          })

    if (!generated.ok) return generated

    const createdCount = (generated.value.createdTopicIds?.length ?? 0) + (generated.value.createdViewIds?.length ?? 0)
    const before = countScopeState(scopedWorkspaceEntities(workspace, userId, targetNotebook.id))
    const after = countScopeState(scopedWorkspaceEntities(generated.value.workspace, userId, targetNotebook.id))

    if (!apply)
        return ok({
            mode: "preview",
            apply: false,
            dryRun,
            notebookId: targetNotebook.id,
            page: generated.value.page,
            parsed: {
                sectionCount: outline.length,
                viewCount: outline.reduce((sum, section) => sum + section.views.length, 0),
                previewCreated: createdCount,
                sections: outline.map(section => ({
                    title: section.title,
                    viewCount: section.views.length,
                })),
            },
            before,
            after,
        })

    return ok({
        mode: "applied",
        apply: true,
        dryRun,
        notebookId: targetNotebook.id,
        page: generated.value.page,
        workspace: generated.value.workspace,
        created: {
            sections: outline.length,
            topics: generated.value.createdTopicIds.length,
            views: generated.value.createdViewIds.length,
            total: createdCount,
        },
        before,
        after,
    })
}

export const agenticDataIngestValidateAndApply = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        text: string
        notebookId?: string
        notebookTitle?: string
        pageId?: string
        pageTitle?: string
        topicMode?: ViewMode
        maxSections?: number
        maxViewsPerSection?: number
        apply?: boolean
        validate?: boolean
    },
) => {
    const parsed = agenticStructuredIngestFromText(workspace, userId, {
        text: input.text,
        notebookId: input.notebookId,
        notebookTitle: input.notebookTitle,
        pageId: input.pageId,
        pageTitle: input.pageTitle,
        topicMode: input.topicMode,
        maxSections: input.maxSections,
        maxViewsPerSection: input.maxViewsPerSection,
        apply: input.apply ?? false,
        dryRun: false,
    })
    if (!parsed.ok) return parsed

    if (!parsed.value.workspace || !input.apply || !input.validate)
        return ok({
            ...parsed.value,
            validateRequested: Boolean(input.validate),
            validation: parsed.value.mode === "preview" ? undefined : parsed.value.workspace ? validateAfterMutation(parsed.value.workspace, userId, { notebookId: parsed.value.notebookId }).ok : false,
        })

    const validation = validateAfterMutation(parsed.value.workspace, userId, { notebookId: parsed.value.notebookId })
    if (!validation.ok) return validation

    return ok({
        ...parsed.value,
        validated: true,
        validation: validation.value,
    })
}

export const agenticComponentCompatibilityCheck = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        data?: unknown
        viewId?: string
        componentKind?: ComponentKind
        strict?: boolean
    },
) => {
    const providedData =
        input.data !== undefined
            ? input.data
            : input.viewId
              ? (() => {
                    const context = findOwnedView(workspace, userId, input.viewId)
                    if (!context) return undefined
                    return context.view.displays[0]?.data
                })()
              : undefined

    if (providedData === undefined) return invalidInput("Either data or viewId with display data is required.")

    const inferred = inferComponentType(workspace, userId, { data: providedData })
    if (!inferred.ok) return inferred

    const compatibility = !input.componentKind || input.componentKind === inferred.value.kind ? "compatible" : "incompatible"

    return ok({
        inferred: inferred.value,
        expectedKind: inferred.value.kind,
        requestedKind: input.componentKind,
        compatibility,
        strict: input.strict ?? false,
        recommendation: input.componentKind
            ? input.componentKind === inferred.value.kind
                ? "No conversion needed."
                : `Consider rewriting data for ${input.componentKind} compatibility.`
            : inferred.value.reasons.join(" "),
    })
}

export const agenticComponentContractAudit = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId?: string; viewId?: string },
) => {
    const scope = scopedWorkspaceEntities(workspace, userId, input.notebookId)
    if (scope.notebooks.length === 0) return notFound("No matching notebook found.")

    const targetViews = input.viewId ? scope.views.filter(view => view.id === input.viewId) : scope.views
    const checks = targetViews.flatMap(view =>
        view.displays.map(display => {
            const inferred = inferComponentType(workspace, userId, { data: display.data })
            if (!inferred.ok) return { status: "unknown" as const, viewId: view.id, viewTitle: view.title, displayId: display.id, note: inferred.message }

            return {
                status: display.kind === inferred.value.kind ? ("compatible" as const) : ("incompatible" as const),
                viewId: view.id,
                viewTitle: view.title,
                displayId: display.id,
                displayKind: display.kind,
                inferredKind: inferred.value.kind,
                reasons: inferred.value.reasons,
            }
        }),
    )

    return ok({
        scope: input.viewId ? "view" : input.notebookId ? "notebook" : "workspace",
        notebookId: input.notebookId,
        viewId: input.viewId,
        totalViews: targetViews.length,
        totalDisplays: checks.length,
        compatible: checks.filter(item => item.status === "compatible").length,
        incompatible: checks.filter(item => item.status === "incompatible").length,
        unknown: checks.filter(item => item.status === "unknown").length,
        checks,
    })
}

export const agenticDriftScheduler = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; staleAfterDays?: number; includeAutoPlan?: boolean }) => {
    const drift = contentDriftMonitor(workspace, userId, {
        notebookId: input.notebookId,
        staleAfterDays: input.staleAfterDays,
    })
    if (!drift.ok) return drift

    const duplicates = findDuplicateContent(workspace, userId, { notebookId: input.notebookId })
    if (!duplicates.ok) return duplicates

    const health = workspaceHealthCheck(workspace, userId)
    if (!health.ok) return health

    const suggestions = [
        ...drift.value.staleItems.map(item => ({
            id: `drift-${item.id}`,
            scope: item.scope,
            priority: "medium" as const,
            action: `Resolve stale ${item.scope} ${item.id}`,
            detail: item.reason,
            targetId: item.id,
            targetTitle: item.title,
        })),
        ...duplicates.value.matches.map(item => ({
            id: `duplicate-${item.ids.join("-")}`,
            scope: item.scope,
            priority: "low" as const,
            action: `Merge duplicate ${item.scope}: ${item.title}`,
            detail: `Detected ${item.ids.length} duplicates.`,
            targetId: item.ids[0] ?? "",
            targetTitle: item.title,
        })),
    ]

    const sorted = suggestions.slice(0, 20)
    const schedule = {
        cadence: "daily",
        timezone: "UTC",
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        includeAutoPlan: input.includeAutoPlan ?? false,
        suggestions: sorted,
    }

    if (input.includeAutoPlan) {
        const scheduledPlan = sorted.map(item => ({
            tool: item.scope === "page" ? "agentic_auto_repair" : item.scope === "topic" ? "agentic_suggest_restructure" : "agentic_reference_rewrite",
            input: item.scope === "topic" ? { notebookId: input.notebookId, includePrechecks: true } : { notebookId: input.notebookId },
        }))

        return ok({ ...schedule, scheduled: sorted.length > 0 ? scheduledPlan : [], draftPlan: scheduledPlan })
    }

    return ok({ ...schedule, summary: { suggestions: sorted.length, blockers: health.value.issues.length } })
}

export const agenticChangeSetRenderer = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        notebookId?: string
        maxSteps?: number
        includeNarrative?: boolean
    },
) => {
    const changeSet = agenticChangeSet(workspace, userId, input)
    if (!changeSet.ok) return changeSet

    const touched = {
        notebooks: new Set<string>(),
        pages: new Set<string>(),
        topics: new Set<string>(),
        views: new Set<string>(),
    }
    const warnings = changeSet.value.stepResults.flatMap(step => step.warnings)
    const blockedCount = changeSet.value.stepResults.filter(step => step.blocked).length

    changeSet.value.stepResults.forEach(step => {
        step.touched.notebooks.forEach(item => touched.notebooks.add(item))
        step.touched.pages.forEach(item => touched.pages.add(item))
        step.touched.topics.forEach(item => touched.topics.add(item))
        step.touched.views.forEach(item => touched.views.add(item))
    })

    const readableTouches = {
        notebooks: touched.notebooks.size,
        pages: touched.pages.size,
        topics: touched.topics.size,
        views: touched.views.size,
    }
    const narrative = [
        `Plan has ${changeSet.value.plan.length} step(s).`,
        `Touches ${readableTouches.notebooks} notebook(s), ${readableTouches.pages} page(s), ${readableTouches.topics} topic(s), ${readableTouches.views} view(s).`,
        `Estimated blockers: ${blockedCount}.`,
        `Status: ${blockedCount ? "blocked" : "ok"}.`,
        `Warnings: ${(warnings.length > 0 && warnings.join("; ")) || "none"}.`,
    ]

    return ok({
        ...changeSet.value,
        touches: readableTouches,
        touchedIds: {
            notebooks: [...touched.notebooks],
            pages: [...touched.pages],
            topics: [...touched.topics],
            views: [...touched.views],
        },
        humanReadable: input.includeNarrative === false ? undefined : narrative,
        changeSetSummary: {
            before: changeSet.value.before,
            after: changeSet.value.after,
            changed: changeSet.value.changed,
            blockedCount,
        },
    })
}

export const driftReasoningReport = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; staleAfterDays?: number }) => {
    const drift = contentDriftMonitor(workspace, userId, input)
    if (!drift.ok) return drift
    const gaps = analyzeWorkspaceGaps(workspace, userId, { notebookId: input.notebookId, includeHealthSummary: true })

    const reasons: DriftReason[] = drift.value.staleItems.map(item => {
        const recommendation = item.scope === "view" ? "Review content and add structured display blocks if content is stable." : "Review and either repurpose or remove."
        return {
            scope: item.scope,
            id: item.id,
            title: item.title,
            reason: item.reason,
            suggestion: recommendation,
        }
    })

    return ok({
        staleCount: drift.value.staleCount,
        staleThresholdDays: drift.value.staleThresholdDays,
        notebookIds: drift.value.notebookIds,
        reasonCount: reasons.length,
        reasons,
        healthSummary: gaps.ok ? gaps.value.healthSummary : null,
        recommendations:
            reasons.length > 0 ? ["Run publish_preflight_multi_notebook.", "Run propose_schema_evolution and apply safe suggestions."] : ["No significant drift detected."],
    })
}

export const agenticToolFeedback = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { goal: string; status: "ok" | "warning" | "failed"; plan: Array<{ tool: string; input: Record<string, unknown> }>; summary: string; blockers?: string[] },
) => {
    if (!safeTrim(input.goal) || !safeTrim(input.summary)) return invalidInput("goal and summary are required.")
    if (!input.plan) return invalidInput("plan is required.")

    const observed = appendAgenticObservation(workspace, {
        goal: input.goal,
        status: input.status,
        summary: input.summary,
        plan: input.plan,
        blockers: input.blockers ?? [],
    })

    return ok({
        ...observed,
        status: "recorded",
        recordCount: observed.agenticObservations?.length ?? 0,
    })
}

export const applyRepairPlan = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId?: string
        plan: Array<{ tool: string; input: Record<string, unknown> }>
        continueOnFailure?: boolean
        dryRun?: boolean
        runValidation?: boolean
    },
) => {
    const result = applyChangePlan(workspace, userId, {
        operations: input.plan.map(item => ({ tool: item.tool, input: item.input })),
        continueOnFailure: input.continueOnFailure,
        dryRun: input.dryRun,
    })
    if (!result.ok) return result

    if (input.notebookId) {
        const notebook = findOwnedNotebook(result.value.workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const validation = input.runValidation ? validateAfterMutation(result.value.workspace, userId, { notebookId: input.notebookId }) : undefined
    return ok({
        ...result.value,
        dryRun: input.dryRun ?? false,
        validation: validation && validation.ok ? validation.value : undefined,
    })
}

export const generateDatasetCard = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const primaryDisplay = context.view.displays[0]
    const source = primaryDisplay ? primaryDisplay.data : {}
    const entries = Object.entries(source ?? {})
        .slice(0, 24)
        .map(([name, value]) => ({
            name,
            type: toCardType(value),
            sample: value,
        }))

    const sampleRows = Array.isArray(source) ? source.slice(0, 5) : undefined
    const fieldNames = Object.keys(Array.isArray(sampleRows) ? ((sampleRows[0] as Record<string, unknown>) ?? {}) : source)

    return ok({
        notebookId: context.notebook.id,
        notebookTitle: context.notebook.title,
        pageId: context.page.id,
        pageTitle: context.page.title,
        topicId: context.topic.id,
        topicTitle: context.topic.title,
        viewId: context.view.id,
        viewTitle: context.view.title,
        fields: entries,
        rowCount: Array.isArray(source) ? source.length : Object.keys(source ?? {}).length,
        sampleCount: Array.isArray(source) ? (sampleRows?.length ?? 0) : Object.keys(source ?? {}).length,
        sampleRows: sampleRows ?? undefined,
        fieldNames,
        generatedAt: new Date().toISOString(),
        note: primaryDisplay ? `Generated for ${primaryDisplay.kind} display.` : "No display data found.",
    })
}

export const notebookDiffForAgent = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; snapshotId?: string }) => {
    const compare = diffNotebookState(workspace, userId, input)
    if (!compare.ok) return compare

    const changes = [
        { type: "pages_added", items: compare.value.delta.added.pages },
        { type: "topics_added", items: compare.value.delta.added.topics },
        { type: "views_added", items: compare.value.delta.added.views },
        { type: "pages_removed", items: compare.value.delta.removed.pages },
        { type: "topics_removed", items: compare.value.delta.removed.topics },
        { type: "views_removed", items: compare.value.delta.removed.views },
    ]

    const actionPlan = changes.flatMap(change => {
        if (change.items.length === 0) return []
        return [
            {
                type: change.type,
                count: change.items.length,
                recommendation: change.type.includes("added") ? "Verify references and ordering." : "Consider restore or merge.",
            },
        ]
    })

    return ok({
        notebookId: compare.value.notebookId,
        snapshotId: compare.value.snapshotId,
        current: compare.value.current,
        snapshot: compare.value.snapshot,
        changes,
        actionPlan,
        humanMessage: `${compare.value.current.views} current views vs ${compare.value.snapshot.views} snapshot views.`,
    })
}

export const snapshotRestorePlan = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; snapshotId?: string }) => {
    const target = workspace.snapshots?.find(item => item.id === input.snapshotId) ?? workspace.snapshots?.[0]
    if (!target) return notFound("Snapshot not found.")
    const compare = snapshotCompare(workspace, userId, { notebookId: input.notebookId, snapshotId: target.id })
    if (!compare.ok) return compare

    const planSteps = [
        `Restore workspace from snapshot ${target.id}.`,
        `Review changes between current and snapshot ${target.name}.`,
        `Optionally run execute_plan_with_guarantees after restore.`,
    ]

    return ok({
        notebookId: input.notebookId,
        snapshotId: target.id,
        snapshotName: target.name,
        snapshotCreatedAt: target.createdAt,
        comparison: compare.value,
        plan: planSteps,
    })
}

export const workspacePolicyEngine = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        action: "list" | "validate" | "apply"
        notebookId?: string
        policyRules?: WorkspacePolicyRule[]
    },
) => {
    const activeRules = input.policyRules?.length ? input.policyRules : defaultWorkspacePolicyRules
    if (input.action === "list")
        return ok({
            action: "list",
            rules: activeRules,
        })

    if (input.action === "apply")
        return ok({
            action: "apply",
            applied: true,
            ruleCount: activeRules.length,
            message: "Policies are evaluated at runtime and are not persisted in workspace data yet.",
        })

    if (!input.notebookId) return notFound("notebookId is required for policy validation.")
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const pages = workspace.pages.filter(item => item.notebookId === notebook.id)
    const topics = workspace.topics.filter(item => pages.some(page => page.id === item.pageId))
    const views = workspace.views.filter(item => topics.some(topic => topic.id === item.topicId))

    const violations: { ruleId: string; details: string }[] = []
    const checks = activeRules.map(rule => {
        if (rule.check === "notebook_summary" && !safeTrim(notebook.summary)) violations.push({ ruleId: rule.id, details: `Notebook ${notebook.title} summary is missing.` })
        if (rule.check === "non_empty_titles" && pages.some(item => !item.title.trim())) violations.push({ ruleId: rule.id, details: "Found topic/page/view with empty title." })
        if (rule.check === "display_or_content" && views.some(view => !view.content.trim() && view.displays.length === 0))
            violations.push({ ruleId: rule.id, details: "Some views have neither content nor display data." })
        if (rule.check === "layout_density" && views.some(view => parseArticleContent(view.content, view.displays.length).headings.length > 30))
            violations.push({ ruleId: rule.id, details: "Very dense content layout detected." })

        return {
            ruleId: rule.id,
            passed: !violations.some(item => item.ruleId === rule.id),
            severity: rule.severity,
        }
    })

    return ok({
        action: "validate",
        notebookId: notebook.id,
        passed: violations.length === 0,
        checks,
        violations,
        policyCount: activeRules.length,
    })
}

export const contentDriftMonitor = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; staleAfterDays?: number }) => {
    const notebooks = input.notebookId
        ? [findOwnedNotebook(workspace, userId, input.notebookId)].filter(Boolean)
        : workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (notebooks.length === 0) return notFound("No matching notebook found.")

    const staleItems: Array<{ scope: "page" | "topic" | "view" | "display"; id: string; title: string; reason: string }> = []
    const staleThreshold = Math.max(1, input.staleAfterDays ?? 30)

    notebooks.forEach(notebook => {
        if (!notebook) return
        const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
        const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
        const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))
        const displayCountByTopic = new Map<string, number>()
        views.forEach(view => {
            const current = displayCountByTopic.get(view.topicId) ?? 0
            displayCountByTopic.set(view.topicId, current + view.displays.length)
        })

        pages.forEach(page => {
            if (topics.some(topic => topic.pageId === page.id)) return
            staleItems.push({ scope: "page", id: page.id, title: page.title, reason: "Page has no child topics and may be stale." })
        })
        topics.forEach(topic => {
            const connectedViews = views.filter(view => view.topicId === topic.id)
            if (connectedViews.length > 0 && !topic.summary.trim() && topic.title.toLowerCase().includes("overview"))
                staleItems.push({ scope: "topic", id: topic.id, title: topic.title, reason: `Overview topic has empty summary.` })
            if (!connectedViews.length) staleItems.push({ scope: "topic", id: topic.id, title: topic.title, reason: "Topic has no child views." })
        })
        views.forEach(view => {
            if (!view.content.trim()) staleItems.push({ scope: "view", id: view.id, title: view.title, reason: "Empty view content." })
            if (view.displays.every(display => !display.data || Object.keys(display.data).length === 0))
                staleItems.push({ scope: "display", id: view.id, title: view.title, reason: "View has display placeholders without payload." })
            if (!view.content.includes("#") && !view.displays.length)
                staleItems.push({ scope: "view", id: view.id, title: view.title, reason: "View has no heading structure and no displays." })
            if (view.displays.length === 0 && view.content.trim() && view.content.length > 1200 && displayCountByTopic.get(view.topicId) === 0)
                staleItems.push({ scope: "view", id: view.id, title: view.title, reason: "Large article content may be missing structured display data." })
        })
    })

    return ok({
        notebookIds: notebooks.map(item => item?.id ?? "").filter(Boolean),
        staleItems,
        staleCount: staleItems.length,
        staleThresholdDays: staleThreshold,
    })
}

export const inferComponentType = (workspace: VisualNoteWorkspace, userId: string, input: { data: unknown }) => {
    const normalized = normalizeInputData(input.data)
    if (!normalized.data) return notFound(normalized.error ?? "No data provided.")

    const inferred = inferComponentKindFromData(normalized.data)
    const hasArrayData = Array.isArray(normalized.data)
    const sampleCount = hasArrayData ? normalized.data.length : 1

    return ok({
        kind: inferred.kind,
        confidence: inferred.confidence,
        reasons: inferred.reasons,
        sampleCount,
        normalizedType: hasArrayData ? "array" : typeof normalized.data,
        samplePreview: Array.isArray(normalized.data) ? normalized.data[0] : normalized.data,
    })
}

export const importDataBlock = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        viewId: string
        data: unknown
        kind?: ComponentKind
        includeInArticle?: boolean
        name?: string
        position?: number
    },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const normalized = normalizeInputData(input.data)
    if (!normalized.data) return notFound(normalized.error ?? "No data provided.")

    const resolvedKind = input.kind || inferComponentKindFromData(normalized.data).kind
    const display = addDisplayToView(workspace, userId, {
        viewId: context.view.id,
        kind: resolvedKind,
        name: input.name,
        data: normalized.data as Record<string, unknown>,
        position: input.position,
    })
    if (!display.ok) return display

    let nextWorkspace = display.value.workspace
    const view = nextWorkspace.views.find(item => item.id === context.view.id)
    if (!view) return notFound("View not found after adding display.")

    const includeInArticle = input.includeInArticle ?? true
    if (!includeInArticle)
        return ok({
            ...display.value,
            view,
            includeInArticle,
            inferredKind: resolvedKind,
            dataCount: Array.isArray(normalized.data) ? normalized.data.length : 1,
            added: true,
        })

    const placeholder = `\n\n{{display:${view.displays.length}}}`
    const nextContent = view.content.includes("{{display:") ? `${view.content}${placeholder}` : `${view.content}${placeholder}`
    const updated = writeViewContent(nextWorkspace, view.id, nextContent, view.displays.length)
    nextWorkspace = updated.workspace

    return ok({
        ...updated,
        view: updated.view,
        inferredKind: resolvedKind,
        dataCount: Array.isArray(normalized.data) ? normalized.data.length : 1,
        includeInArticle,
        added: true,
    })
}

export const generateTopicFromOutline = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        notebookId: string
        pageId?: string
        pageTitle?: string
        outline: string
        topicMode?: ViewMode
    },
) => {
    if (!safeTrim(input.outline)) return invalidInput("outline is required.")

    const sections = parseOutlineSections(safeTrim(input.outline))
    if (sections.length === 0) return invalidInput("outline did not contain valid topics or views.")

    const targetPage = input.pageId
        ? findOwnedPage(workspace, userId, input.pageId)
        : input.pageTitle
          ? createPage(cloneWorkspace(workspace), userId, {
                notebookId: input.notebookId,
                title: safeTrim(input.pageTitle),
            })
          : undefined

    if (!targetPage) return notFound("Target page not found.")
    let nextWorkspace = targetPage.ok ? targetPage.value.workspace : workspace
    const page = targetPage.ok ? targetPage.value.page : findOwnedPage(nextWorkspace, userId, input.pageId ?? "")?.page

    if (!page) return notFound("Target page not found.")

    const createdTopicIds: string[] = []
    const createdViewIds: string[] = []
    const mode: ViewMode = input.topicMode ?? "article"

    sections.forEach((section, sectionIndex) => {
        const topicResult = createTopic(nextWorkspace, userId, {
            pageId: page.id,
            title: section.title || `Section ${sectionIndex + 1}`,
            position: sectionIndex,
        })
        if (!topicResult.ok) return
        nextWorkspace = topicResult.value.workspace
        createdTopicIds.push(topicResult.value.topic.id)

        const topic = topicResult.value.topic
        const views = section.views.length > 0 ? section.views : ["Overview"]
        views.forEach((viewTitle, viewIndex) => {
            const viewResult = createView(nextWorkspace, userId, {
                topicId: topic.id,
                title: viewTitle,
                mode,
                position: viewIndex,
                content: `# ${viewTitle}`,
            })
            if (!viewResult.ok) return
            nextWorkspace = viewResult.value.workspace
            createdViewIds.push(viewResult.value.view.id)
        })
    })

    return ok({
        page,
        createdTopicIds,
        createdViewIds,
        created: createdTopicIds.length + createdViewIds.length,
        workspace: nextWorkspace,
    })
}

export const suggestLayoutForViewMode = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; preferredMode?: ViewMode }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    const mode = input.preferredMode ?? (context.view.displays.length > 2 || parsed.headings.length > 4 ? "structured" : context.view.mode)
    const reasons: string[] = []

    if (context.view.displays.length > 2) reasons.push("This view already has multiple structured displays.")
    if (parsed.headings.length > 4) reasons.push("Multiple headings suggest a structured outline layout.")
    if (!context.view.displays.length && parsed.blocks.length > 10 && mode !== "article") reasons.push("No displays present, so add display components first.")

    const suggestion: LayoutSuggestion = {
        mode,
        reason: reasons.join(" ") || "Current layout is sufficient for current content.",
        addedDisplays: mode === "dashboard" ? ["dashboard"] : [displayKindForMode(mode)],
        changed: mode !== context.view.mode,
    }

    return ok({
        ...suggestion,
        viewId: context.view.id,
        currentMode: context.view.mode,
        estimatedImpact: {
            additionalDisplays: suggestion.addedDisplays.length,
            blocks: parsed.blocks.length,
            headings: parsed.headings.length,
        },
    })
}

export const rewriteViewLayoutForMode = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; mode: ViewMode; addRecommendedDisplays?: boolean }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const updatedMode = changeViewMode(workspace, userId, { viewId: context.view.id, mode: input.mode, keepContent: true })
    if (!updatedMode.ok) return updatedMode

    let nextWorkspace = updatedMode.value.workspace

    if (input.addRecommendedDisplays && nextWorkspace.views.find(view => view.id === context.view.id)?.displays.length === 0) {
        const recommended = addDisplayToView(nextWorkspace, userId, {
            viewId: context.view.id,
            kind: displayKindForMode(input.mode),
            name: `${input.mode} summary`,
            data: { title: `${context.view.title} ${input.mode}` },
        })
        if (!recommended.ok) return recommended
        nextWorkspace = recommended.value.workspace
    }

    const finalView = nextWorkspace.views.find(view => view.id === context.view.id)
    if (!finalView) return notFound("View not found after rewrite.")

    return ok({
        workspace: nextWorkspace,
        view: finalView,
        suggestionApplied: true,
        changed: finalView.mode !== context.view.mode,
        addedRecommendedDisplay: input.addRecommendedDisplays ?? false,
    })
}

export const previewRenderProfile = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    const profile = {
        viewId: context.view.id,
        blockCount: parsed.blocks.length,
        headingCount: parsed.headings.length,
        displayCount: context.view.displays.length,
        visualBlockCount: parsed.blocks.filter(block => block.kind === "visual").length,
        rawLength: context.view.content.length,
    }
    const next = estimateRenderComplexity(profile)

    return ok({
        ...profile,
        estimatedComplexity: next.estimatedComplexity,
        estimatedRenderCost: next.estimatedRenderCost,
        warnings: profile.blockCount === 0 ? ["The view is empty."] : profile.visualBlockCount > 2 ? ["High visual-block density may increase parse/serialize cost."] : [],
    })
}

const applyChangePlanOperation = (workspace: VisualNoteWorkspace, userId: string, operation: ChangePlanOperation): WorkspaceOperationResult<{ workspace: VisualNoteWorkspace }> => {
    const input = operation.input
    if (!input || typeof input !== "object") return invalidInput(`Invalid input for ${operation.tool}.`)

    const inputData = input as Record<string, unknown>
    const asString = (value: unknown) => (typeof value === "string" ? value : "")
    const asBoolean = (value: unknown) => (value === true ? true : value === false ? false : undefined)
    const asKind = (value: unknown) => (value === undefined ? undefined : asString(value))
    const asNumber = (value: unknown) => {
        if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
        if (typeof value === "string") {
            const trimmed = value.trim()
            if (!trimmed) return undefined
            const parsed = Number(trimmed)
            return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined
        }
        return undefined
    }
    const asObject = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {})

    const normalizedVisualKind = asKind(inputData.visualKind)

    switch (operation.tool) {
        case "create_notebook":
            return createNotebook(workspace, userId, {
                title: asString(inputData.title),
                summary: inputData.summary ? String(inputData.summary) : undefined,
                color: inputData.color ? String(inputData.color) : undefined,
                slug: inputData.slug ? String(inputData.slug) : undefined,
            })
        case "rename_notebook":
            return renameNotebook(workspace, userId, {
                notebookId: asString(inputData.notebookId),
                title: inputData.title ? String(inputData.title) : undefined,
                summary: inputData.summary ? String(inputData.summary) : undefined,
                color: inputData.color ? String(inputData.color) : undefined,
                slug: inputData.slug ? String(inputData.slug) : undefined,
            })
        case "delete_notebook":
            return deleteNotebook(workspace, userId, asString(inputData.notebookId))
        case "duplicate_notebook":
            return duplicateNotebook(workspace, userId, {
                sourceNotebookId: asString(inputData.sourceNotebookId),
                title: inputData.title ? String(inputData.title) : undefined,
            })
        case "create_page":
            return createPage(workspace, userId, {
                notebookId: asString(inputData.notebookId),
                title: asString(inputData.title),
                position: asNumber(inputData.position),
            })
        case "rename_page":
            return renamePage(workspace, userId, {
                pageId: asString(inputData.pageId),
                title: inputData.title ? String(inputData.title) : undefined,
                position: asNumber(inputData.position),
            })
        case "reorder_pages":
            return reorderPages(workspace, userId, {
                notebookId: asString(inputData.notebookId),
                pageIds: Array.isArray(inputData.pageIds) ? (inputData.pageIds as string[]) : [],
            })
        case "move_page_to_notebook":
            return movePageToNotebook(workspace, userId, {
                pageId: asString(inputData.pageId),
                targetNotebookId: asString(inputData.targetNotebookId),
                position: asNumber(inputData.position),
            })
        case "delete_page":
            return deletePage(workspace, userId, asString(inputData.pageId))
        case "create_topic":
            return createTopic(workspace, userId, {
                pageId: asString(inputData.pageId),
                title: asString(inputData.title),
                summary: inputData.summary ? String(inputData.summary) : undefined,
                position: asNumber(inputData.position),
            })
        case "rename_topic":
            return renameTopic(workspace, userId, {
                topicId: asString(inputData.topicId),
                title: inputData.title ? String(inputData.title) : undefined,
                summary: inputData.summary ? String(inputData.summary) : undefined,
                position: asNumber(inputData.position),
            })
        case "reorder_topics":
            return reorderTopics(workspace, userId, {
                pageId: asString(inputData.pageId),
                topicIds: Array.isArray(inputData.topicIds) ? (inputData.topicIds as string[]) : [],
            })
        case "move_topic_to_page":
            return moveTopicToPage(workspace, userId, {
                topicId: asString(inputData.topicId),
                targetPageId: asString(inputData.targetPageId),
                position: asNumber(inputData.position),
            })
        case "duplicate_topic":
            return duplicateTopic(workspace, userId, {
                topicId: asString(inputData.topicId),
                targetPageId: inputData.targetPageId ? asString(inputData.targetPageId) : undefined,
                title: inputData.title ? String(inputData.title) : undefined,
                position: asNumber(inputData.position),
            })
        case "delete_topic":
            return deleteTopic(workspace, userId, asString(inputData.topicId))
        case "create_view":
            return createView(workspace, userId, {
                topicId: asString(inputData.topicId),
                title: asString(inputData.title),
                mode: (inputData.mode as ViewMode) ?? "article",
                position: asNumber(inputData.position),
                content: inputData.content ? String(inputData.content) : undefined,
            })
        case "create_view_from_template":
            return createViewFromTemplate(workspace, userId, {
                topicId: asString(inputData.topicId),
                title: asString(inputData.title),
                template: (asKind(inputData.template) as "empty" | "research" | "roadmap") ?? "empty",
                mode: (inputData.mode as ViewMode | undefined) ?? "article",
            })
        case "rename_view":
            return renameView(workspace, userId, {
                viewId: asString(inputData.viewId),
                title: inputData.title ? String(inputData.title) : undefined,
                mode: inputData.mode as ViewMode | undefined,
            })
        case "change_view_mode":
            return changeViewMode(workspace, userId, {
                viewId: asString(inputData.viewId),
                mode: inputData.mode as ViewMode,
                keepContent: asBoolean(inputData.keepContent),
            })
        case "reorder_views":
            return reorderViews(workspace, userId, {
                topicId: asString(inputData.topicId),
                viewIds: Array.isArray(inputData.viewIds) ? (inputData.viewIds as string[]) : [],
            })
        case "move_view_to_topic":
            return moveViewToTopic(workspace, userId, {
                viewId: asString(inputData.viewId),
                targetTopicId: asString(inputData.targetTopicId),
                position: asNumber(inputData.position),
            })
        case "duplicate_view":
            return duplicateView(workspace, userId, {
                viewId: asString(inputData.viewId),
                targetTopicId: inputData.targetTopicId ? asString(inputData.targetTopicId) : undefined,
                title: inputData.title ? String(inputData.title) : undefined,
                position: asNumber(inputData.position),
            })
        case "delete_view":
            return deleteView(workspace, userId, asString(inputData.viewId))
        case "replace_article_content":
            return replaceArticleContent(workspace, userId, asString(inputData.viewId), String(inputData.content ?? ""))
        case "set_notebook_metadata":
            return setNotebookMetadata(workspace, userId, {
                notebookId: asString(inputData.notebookId),
                title: inputData.title ? String(inputData.title) : undefined,
                summary: inputData.summary ? String(inputData.summary) : undefined,
                color: inputData.color ? String(inputData.color) : undefined,
                slug: inputData.slug ? String(inputData.slug) : undefined,
                editorSettings: asObject(inputData.editorSettings) as NotebookEditorSettings | undefined,
            })
        case "add_display_to_view":
            return addDisplayToView(workspace, userId, {
                viewId: asString(inputData.viewId),
                kind: asKind(inputData.kind) as ComponentKind,
                name: inputData.name ? String(inputData.name) : undefined,
                data: asObject(inputData.data),
                position: asNumber(inputData.position),
            })
        case "remove_display_from_view":
            return removeDisplayFromView(workspace, userId, {
                viewId: asString(inputData.viewId),
                displayId: asString(inputData.displayId),
            })
        case "patch_display_data":
            return patchDisplayData(workspace, userId, {
                viewId: asString(inputData.viewId),
                displayId: asString(inputData.displayId),
                path: inputData.path ? String(inputData.path) : undefined,
                data: asObject(inputData.data),
            })
        case "set_display_order":
            return setDisplayOrder(workspace, userId, {
                viewId: asString(inputData.viewId),
                displayIds: Array.isArray(inputData.displayIds) ? (inputData.displayIds as string[]) : [],
            })
        case "upsert_visual_block":
            if (!isVisualBlockKind(normalizedVisualKind ?? "")) return invalidInput("visualKind must be a valid visual block kind.")
            return upsertVisualBlock(workspace, userId, {
                viewId: asString(inputData.viewId),
                visualKind: normalizedVisualKind as VisualBlockKind,
                data: asObject(inputData.data) as VisualBlockData,
                blockIndex: asNumber(inputData.blockIndex),
            })
        case "remove_visual_block":
            return removeVisualBlock(workspace, userId, asString(inputData.viewId), asNumber(inputData.blockIndex) ?? 0)
        case "insert_article_blocks":
            return insertArticleBlocks(workspace, userId, {
                viewId: asString(inputData.viewId),
                blockIndex: asNumber(inputData.blockIndex),
                content: String(inputData.content ?? ""),
            })
        case "replace_article_block":
            return replaceArticleBlock(workspace, userId, {
                viewId: asString(inputData.viewId),
                blockIndex: asNumber(inputData.blockIndex) ?? 0,
                blockMarkdown: String(inputData.blockMarkdown ?? ""),
            })
        case "remove_article_block":
            return removeArticleBlock(workspace, userId, asString(inputData.viewId), asNumber(inputData.blockIndex) ?? 0)
        case "move_article_block":
            return moveArticleBlock(workspace, userId, {
                viewId: asString(inputData.viewId),
                fromIndex: asNumber(inputData.fromIndex) ?? 0,
                toIndex: asNumber(inputData.toIndex) ?? 0,
            })
        case "patch_article_section":
            return patchArticleSection(workspace, userId, {
                viewId: asString(inputData.viewId),
                headingId: inputData.headingId ? String(inputData.headingId) : undefined,
                headingText: inputData.headingText ? String(inputData.headingText) : undefined,
                sectionMarkdown: String(inputData.sectionMarkdown ?? ""),
            })
        case "apply_article_patch":
            return applyArticlePatch(workspace, userId, {
                viewId: asString(inputData.viewId),
                operations: Array.isArray(inputData.operations) ? (inputData.operations as Array<Record<string, unknown>>) : [],
            })
        case "publish_notebook":
            return publishNotebook(workspace, userId, {
                notebookId: asString(inputData.notebookId),
                publish: asBoolean(inputData.publish) ?? false,
            })
        case "repair_workspace": {
            const repaired = repairWorkspaceConsistency(workspace, userId)
            if (!repaired.ok) return repaired
            return ok({
                ...repaired.value,
                workspace: repaired.value.repairedWorkspace ? repaired.value.repairedWorkspace : workspace,
            })
        }
        default:
            return notFound(`Unsupported change operation: ${operation.tool}`)
    }
}

const collectIssueSummary = (workspace: VisualNoteWorkspace, userId: string) => {
    const health = workspaceHealthCheck(workspace, userId)
    return health.ok
        ? {
              totalIssues: health.value.issues.length,
              blockers: health.value.issues.filter(item => item.severity === "error").length,
          }
        : { totalIssues: 0, blockers: 0 }
}

export const computeChangeImpact = (workspace: VisualNoteWorkspace, userId: string, input: { operations: ChangePlanOperation[]; maxSteps?: number }) => {
    if (!Array.isArray(input.operations) || input.operations.length === 0) return invalidInput("operations must be a non-empty array.")
    const operations = input.operations.slice(0, input.maxSteps ?? input.operations.length)

    let nextWorkspace = cloneWorkspace(workspace)
    const operationReports: ToolImpactReport[] = []

    for (const operation of operations) {
        const applied = applyChangePlanOperation(nextWorkspace, userId, operation)
        if (!applied.ok) return invalidInput(`Unsupported operation during impact analysis: ${operation.tool}. ${applied.message}`)

        nextWorkspace = applied.value.workspace
        const stats = collectIssueSummary(nextWorkspace, userId)

        operationReports.push({
            tool: operation.tool,
            touched: touchedFromInput(operation),
            issueCount: stats.totalIssues,
            warnings: stats.blockers > 0 ? ["Simulated workspace has blockers. Consider validating after mutation before publish."] : [],
        })
    }

    const finalStats = collectIssueSummary(nextWorkspace, userId)
    return ok({
        operationReports,
        executed: true,
        workspacePreview: {
            notebookCount: nextWorkspace.notebooks.filter(notebook => notebook.userId === userId).length,
            pageCount: nextWorkspace.pages.length,
            topicCount: nextWorkspace.topics.length,
            viewCount: nextWorkspace.views.length,
            issueCount: finalStats.totalIssues,
            blockers: finalStats.blockers,
        },
    })
}

export const applyChangePlan = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { operations: ChangePlanOperation[]; continueOnFailure?: boolean; dryRun?: boolean; maxSteps?: number },
) => {
    if (!Array.isArray(input.operations) || input.operations.length === 0) return invalidInput("operations must be a non-empty array.")

    const operations = input.operations.slice(0, input.maxSteps ?? input.operations.length)
    let nextWorkspace = cloneWorkspace(workspace)
    const operationReports: ToolImpactReport[] = []
    const blockers: string[] = []

    for (const operation of operations) {
        const applied = applyChangePlanOperation(nextWorkspace, userId, operation)
        if (!applied.ok) {
            blockers.push(`Unable to apply ${operation.tool}: ${applied.message}`)
            if (!input.continueOnFailure)
                return ok({
                    workspace,
                    operationReports,
                    blockers,
                    applied: operationReports.length,
                    skipped: operations.length - operationReports.length,
                    dryRun: input.dryRun ?? false,
                })

            continue
        }

        nextWorkspace = input.dryRun ? nextWorkspace : applied.value.workspace
        operationReports.push({
            tool: operation.tool,
            touched: touchedFromInput(operation),
            issueCount: 0,
            warnings: [],
        })
    }

    return ok({
        workspace: nextWorkspace,
        operationReports,
        blockers,
        applied: operationReports.length,
        skipped: 0,
        dryRun: input.dryRun ?? false,
    })
}

const applyValidationForPlan = (workspace: VisualNoteWorkspace, userId: string, notebookId?: string) => {
    const validation = notebookId ? validateAfterMutation(workspace, userId, { notebookId }) : validateAfterMutation(workspace, userId, {})
    return validation.ok ? validation.value : { blockers: [validation.message], warnings: [], blockersCount: 1, warningCount: 0 }
}

export const batchMutateWorkspace = (workspace: VisualNoteWorkspace, userId: string, input: { operations: ChangePlanOperation[]; continueOnFailure?: boolean }) =>
    applyChangePlan(workspace, userId, input)

export const batchReadWorkspace = (workspace: VisualNoteWorkspace, userId: string, input: { operations: Array<{ tool: string; input?: Record<string, unknown> }> }) => {
    if (!Array.isArray(input.operations) || input.operations.length === 0) return invalidInput("operations must be a non-empty array.")

    const supported = input.operations.map(operation => {
        const tool = String(operation.tool)
        const options = (operation.input ?? {}) as Record<string, unknown>

        if (tool === "read_workspace") return readWorkspace(workspace, userId)
        if (tool === "list_notebooks") return ok(listNotebooks(workspace, userId))
        if (tool === "read_notebook") return readNotebookTree(workspace, userId, String(options.notebookId ?? ""))
        if (tool === "list_pages") return listPages(workspace, userId, options.notebookId as string | undefined)
        if (tool === "read_article") return readArticle(workspace, userId, String(options.viewId ?? ""))
        if (tool === "read_view_as_markdown") return readViewAsMarkdown(workspace, userId, String(options.viewId ?? ""))
        if (tool === "read_view_as_blocks") return readViewAsBlocks(workspace, userId, String(options.viewId ?? ""))
        if (tool === "search_workspace")
            return searchWorkspace(workspace, userId, {
                query: String(options.query ?? ""),
                kinds: (options.kinds as Array<"notebook" | "page" | "topic" | "view" | "display">) ?? ["notebook", "page", "topic", "view", "display"],
            })

        if (tool === "list_display_kinds") return listDisplayKinds()
        if (tool === "workspace_health_check") return workspaceHealthCheck(workspace, userId)
        if (tool === "analyze_orphaned_data") return analyzeOrphanedData(workspace, userId)

        return invalidInput(`Unsupported read tool: ${tool}`)
    })

    return ok({
        results: supported.map((result, index) => ({
            index,
            input: input.operations[index],
            ok: result.ok,
            ...(result.ok ? { value: result.value } : { error: result.error, message: result.message }),
        })),
        total: input.operations.length,
        failures: supported.filter(result => !result.ok).length,
    })
}

export const validateAfterMutation = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; viewId?: string }) => {
    const workspaceChecks: Array<{ name: string; ok: boolean; details: string }> = []
    const blockers: string[] = []
    const warnings: string[] = []

    if (input.notebookId) {
        const health = analyzeNotebookHealth(workspace, userId, { notebookId: input.notebookId })
        if (!health.ok) {
            blockers.push(health.message)
            workspaceChecks.push({ name: "notebook_health", ok: false, details: health.message })
        } else {
            workspaceChecks.push({ name: "notebook_health", ok: true, details: `Found ${health.value.issues.length} issues.` })
            if (health.value.issues.some(item => item.severity === "error")) blockers.push("Notebook has blocking integrity issues.")
        }
    }

    if (input.viewId) {
        const lint = lintArticle(workspace, userId, input.viewId)
        workspaceChecks.push({
            name: "view_round_trip",
            ok: lint.ok ? lint.value.valid : false,
            details: lint.ok ? `Lint found ${lint.value.warnings.length} warnings.` : lint.message,
        })
        if (!lint.ok || !lint.value.valid) blockers.push(`Unable to validate article ${input.viewId}.`)
        if (lint.ok) warnings.push(...lint.value.warnings)
    }

    const health = workspaceHealthCheck(workspace, userId)
    if (health.ok) {
        workspaceChecks.push({ name: "workspace_integrity", ok: health.value.issues.length === 0, details: `${health.value.issues.length} integrity warnings found.` })
        if (health.value.issues.length > 0) warnings.push(...health.value.issues.map(item => item.message))
    } else blockers.push(health.message)

    return ok({ workspaceChecks, blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] })
}

export const publishDiagnose = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
    const topics = workspace.topics.filter(topic => pages.some(page => page.id === topic.pageId))
    const views = workspace.views.filter(view => topics.some(topic => topic.id === view.topicId))

    const blockers: string[] = []
    const warnings: string[] = []
    if (!notebook.summary.trim()) warnings.push("Notebook summary is empty.")
    if (pages.length === 0) blockers.push("Notebook has no pages.")
    if (topics.length === 0) blockers.push("Notebook has no topics.")
    if (views.length === 0) blockers.push("Notebook has no views.")

    views.forEach(view => {
        if (!view.content.trim()) warnings.push(`View ${view.title} is empty.`)
        if (view.displays.length > 0) {
            const parsed = parseArticleContent(view.content, view.displays.length)
            if (parsed.blocks.some(block => block.kind === "display" && (block.displayIndex < 0 || block.displayIndex >= view.displays.length)))
                blockers.push(`View ${view.title} has invalid display references.`)
        }
    })

    const unique = [...new Set([...blockers, ...warnings])]

    return ok({
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        ready: blockers.length === 0,
        blockers,
        warnings: unique.filter(item => !blockers.includes(item)),
        viewCount: views.length,
        topicCount: topics.length,
        pageCount: pages.length,
    })
}

export const diffNotebookState = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; snapshotId?: string }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const snapshot = input.snapshotId ? workspace.snapshots?.find(item => item.id === input.snapshotId) : workspace.snapshots?.[0]
    if (!snapshot) return notFound("No snapshot data available.")

    const snapshotNotebook = snapshot.workspace.notebooks.find(item => item.id === input.notebookId)
    if (!snapshotNotebook) return notFound("Notebook not found in snapshot.")

    const currentPageIds = new Set(workspace.pages.filter(page => page.notebookId === input.notebookId).map(item => item.id))
    const snapshotPageIds = new Set(snapshot.workspace.pages.filter(page => page.notebookId === input.notebookId).map(item => item.id))
    const currentTopicIds = new Set(workspace.topics.filter(topic => currentPageIds.has(topic.pageId)).map(item => item.id))
    const snapshotTopicIds = new Set(snapshot.workspace.topics.filter(topic => snapshotPageIds.has(topic.pageId)).map(item => item.id))
    const currentViewIds = new Set(workspace.views.filter(view => currentTopicIds.has(view.topicId)).map(item => item.id))
    const snapshotViewIds = new Set(snapshot.workspace.views.filter(view => snapshotTopicIds.has(view.topicId)).map(item => item.id))

    return ok({
        notebookId: notebook.id,
        snapshotId: snapshot.id,
        delta: {
            added: {
                pages: [...currentPageIds].filter(id => !snapshotPageIds.has(id)),
                topics: [...currentTopicIds].filter(id => !snapshotTopicIds.has(id)),
                views: [...currentViewIds].filter(id => !snapshotViewIds.has(id)),
            },
            removed: {
                pages: [...snapshotPageIds].filter(id => !currentPageIds.has(id)),
                topics: [...snapshotTopicIds].filter(id => !currentTopicIds.has(id)),
                views: [...snapshotViewIds].filter(id => !currentViewIds.has(id)),
            },
        },
        current: {
            pages: currentPageIds.size,
            topics: currentTopicIds.size,
            views: currentViewIds.size,
        },
        snapshot: {
            title: snapshotNotebook.title,
            pages: snapshotPageIds.size,
            topics: snapshotTopicIds.size,
            views: snapshotViewIds.size,
        },
    })
}

export const taskSuggestAndExecute = (workspace: VisualNoteWorkspace, userId: string, input: { goal: string; notebookId?: string; execute?: boolean }) => {
    const goal = safeTrim(input.goal).toLowerCase()
    if (!goal) return invalidInput("goal is required.")

    const actions: ChangePlanOperation[] = []
    if (!input.notebookId) return notFound("notebookId is required for task suggestions.")

    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    if (goal.includes("publish")) {
        const diagnose = publishDiagnose(workspace, userId, { notebookId: notebook.id })
        if (diagnose.ok && diagnose.value.ready) actions.push({ tool: "publish_notebook", input: { notebookId: notebook.id, publish: true } })
    }

    const topics = workspace.topics.filter(topic => workspace.pages.some(page => page.notebookId === notebook.id && workspace.pages.some(page => topic.pageId === page.id)))
    if (goal.includes("structure") || goal.includes("outline") || goal.includes("gap") || goal.includes("complete"))
        if (goal.includes("create") && topics.length === 0) {
            const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
            if (pages.length === 0)
                actions.push({
                    tool: "create_page",
                    input: { notebookId: notebook.id, title: "Overview" },
                })

            if (pages[0])
                actions.push({
                    tool: "create_topic",
                    input: { pageId: pages[0].id, title: "Getting Started" },
                })
        }

    if (actions.length === 0)
        return ok({
            goal,
            plan: [],
            note: "No safe automatic plan steps were generated for this goal.",
            blockers: ["Goal did not map to supported agent actions."],
            applied: 0,
            execute: false,
            workspace,
        })

    if (!input.execute)
        return ok({
            goal,
            plan: actions,
            execute: false,
            blockers: [],
            workspace,
        })

    const applied = applyChangePlan(workspace, userId, { operations: actions })
    if (!applied.ok) return invalidInput("Plan execution failed.")

    return ok({
        goal,
        plan: actions,
        execute: true,
        blockers: applied.value.blockers,
        applied: applied.value.applied,
        workspace: applied.value.workspace,
    })
}

export const generateOutlineFromText = (workspace: VisualNoteWorkspace, userId: string, input: { text: string; maxSections?: number; maxViewsPerSection?: number }) => {
    const text = safeTrim(input.text)
    if (!text) return invalidInput("text is required.")

    const notebooks = workspace.notebooks.filter(notebook => notebook.userId === userId)
    if (notebooks.length === 0) return notFound("No notebook found for user.")

    const sections = parseOutlineSections(text)
    if (sections.length === 0) return invalidInput("Unable to parse outline. Use headings, bullets, or plain lines for sections.")

    const maxSections = Math.max(1, Math.min(input.maxSections ?? sections.length, sections.length, 12))
    const maxViewsPerSection = Math.max(1, input.maxViewsPerSection ?? 8)
    const normalized = sections.slice(0, maxSections).map(section => ({
        title: section.title,
        views: section.views.slice(0, maxViewsPerSection),
    }))

    return ok({
        mode: "outline",
        sectionCount: normalized.length,
        totalViewCount: normalized.reduce((total, section) => total + section.views.length, 0),
        outline: normalized,
    })
}

export const planAgenticWorkflow = (workspace: VisualNoteWorkspace, userId: string, input: { goal: string; notebookId: string; includePrechecks?: boolean }) => {
    const goal = safeTrim(input.goal).toLowerCase()
    if (!goal) return invalidInput("goal is required.")

    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const suggestion = taskSuggestAndExecute(workspace, userId, {
        goal,
        notebookId: notebook.id,
        execute: false,
    })
    if (!suggestion.ok) return suggestion

    const plan = [...suggestion.value.plan]
    if (input.includePrechecks) {
        const gaps = analyzeWorkspaceGaps(workspace, userId, {
            notebookId: notebook.id,
            includeHealthSummary: true,
        })

        if (gaps.ok) {
            plan.unshift({ tool: "analyze_workspace_gaps", input: { notebookId: notebook.id, includeHealthSummary: true } })
            if (gaps.value.severity.errors > 0) plan.push({ tool: "repair_workspace", input: {} })
        }
    }

    return ok({
        goal,
        notebookId: notebook.id,
        confidence: plan.length > 0 ? "high" : "low",
        prechecks: input.includePrechecks ? "enabled" : "disabled",
        plan,
        note: plan.length ? undefined : "No safe automatic plan steps were generated for this goal.",
    })
}

export const executePlanWithGuarantees = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: {
        plan: { tool: string; input?: Record<string, unknown> }[]
        continueOnFailure?: boolean
        dryRun?: boolean
        maxSteps?: number
        rollbackOnFailure?: boolean
        notebookId?: string
    },
) => {
    if (!Array.isArray(input.plan) || input.plan.length === 0) return invalidInput("plan must be a non-empty array.")

    if (input.notebookId) {
        const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
        if (!notebook) return notFound("Notebook not found.")
    }

    const operations = input.plan.slice(0, input.maxSteps ?? input.plan.length)
    const attempted = applyChangePlan(workspace, userId, {
        operations,
        continueOnFailure: input.continueOnFailure,
        dryRun: input.dryRun,
    })
    if (!attempted.ok) return attempted

    const failed = attempted.value.blockers.length > 0 && attempted.value.applied < operations.length
    const rolledBack = input.rollbackOnFailure === true && !input.dryRun && !input.continueOnFailure && failed
    const targetWorkspace = rolledBack ? workspace : attempted.value.workspace
    const validate = input.notebookId ? validateAfterMutation(targetWorkspace, userId, { notebookId: input.notebookId }) : validateAfterMutation(targetWorkspace, userId, {})
    if (!validate.ok) return validate

    return ok({
        ...attempted.value,
        workspace: targetWorkspace,
        rolledBack,
        rollbackRequested: input.rollbackOnFailure === true,
        validation: validate.value,
    })
}

export const repairWorkspace = (workspace: VisualNoteWorkspace, userId: string) => {
    const repaired = repairWorkspaceConsistency(workspace, userId)
    if (!repaired.ok) return repaired
    if (!repaired.value.repairedWorkspace) return invalidInput("Unable to rebuild workspace state.")

    return ok({
        workspace: {
            ...workspace,
            ...repaired.value.repairedWorkspace,
            snapshots: workspace.snapshots ?? [],
        },
        repairs: repaired.value,
    })
}

export const snapshotCompare = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; snapshotId?: string }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const compare = diffNotebookState(workspace, userId, input)
    if (!compare.ok) return compare

    const snapshot = input.snapshotId ? workspace.snapshots?.find(item => item.id === input.snapshotId) : workspace.snapshots?.[0]
    if (!snapshot) return notFound("No snapshot found to compare.")

    return ok({
        ...compare.value,
        snapshotMeta: {
            id: snapshot.id,
            name: snapshot.name,
            createdAt: snapshot.createdAt,
        },
    })
}

export const findDuplicateOrStaleContent = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId?: string; includeEmptyViews?: boolean }) => {
    const duplicates = findDuplicateContent(workspace, userId, { notebookId: input.notebookId })
    if (!duplicates.ok) return duplicates

    const orphaned = analyzeOrphanedData(workspace, userId)
    if (!orphaned.ok) return orphaned

    const staleViews = workspace.views
        .filter(view => {
            const topic = workspace.topics.find(item => item.id === view.topicId)
            const page = topic ? workspace.pages.find(item => item.id === topic.pageId) : undefined
            if (!topic || !page) return false
            if (!input.notebookId) return true

            const notebook = workspace.notebooks.find(item => item.id === page.notebookId)
            if (!notebook || notebook.userId !== userId || page.notebookId !== input.notebookId) return false

            return true
        })
        .filter(view => {
            if (input.includeEmptyViews === false) return false
            const content = safeTrim(view.content)
            return !content || /(^#\s*$|^\s*$)/.test(content)
        })

    return ok({
        duplicateGroups: duplicates.value.matches,
        duplicateGroupCount: duplicates.value.matches.length,
        orphanPages: orphaned.value.orphanPages,
        orphanTopics: orphaned.value.orphanTopics,
        orphanViews: orphaned.value.orphanViews,
        staleViews: staleViews.map(view => view.id),
        recommendations: [
            staleViews.length > 0 ? "Consider removing or repopulating stale views." : "No stale empty views found.",
            duplicates.value.matches.length > 0 ? "Review duplicates and consolidate to reduce confusion." : "No duplicate titles or exact content matches found.",
        ],
    })
}

export const searchSemantic = (workspace: VisualNoteWorkspace, userId: string, input: { query: string; kinds?: Array<"notebook" | "page" | "topic" | "view" | "display"> }) => {
    const query = safeTrim(input.query)
    if (!query) return invalidInput("query is required.")

    const queryTokens = tokenize(query)
    if (queryTokens.length === 0) return invalidInput("query is required.")

    const allowedKinds = new Set(input.kinds ?? ["notebook", "page", "topic", "view", "display"])
    const matches: SemanticSearchMatch[] = []

    const notebooks = workspace.notebooks.filter(notebook => notebook.userId === userId)
    for (const notebook of notebooks) {
        if (allowedKinds.has("notebook")) {
            const score = jaccardSimilarity(tokenize(`${notebook.title} ${notebook.summary}`), queryTokens)
            if (score > 0)
                matches.push({
                    kind: "notebook",
                    id: notebook.id,
                    title: notebook.title,
                    notebookId: notebook.id,
                    score: Math.round(score * 100),
                    semanticScore: score,
                })
        }

        const pages = workspace.pages.filter(page => page.notebookId === notebook.id)
        for (const page of pages) {
            if (allowedKinds.has("page")) {
                const score = jaccardSimilarity(tokenize(page.title), queryTokens)
                if (score > 0)
                    matches.push({
                        kind: "page",
                        id: page.id,
                        title: page.title,
                        notebookId: notebook.id,
                        pageId: page.id,
                        score: Math.round(score * 100),
                        semanticScore: score,
                    })
            }

            const topics = workspace.topics.filter(topic => topic.pageId === page.id)
            for (const topic of topics) {
                if (allowedKinds.has("topic")) {
                    const score = jaccardSimilarity(tokenize(`${topic.title} ${topic.summary}`), queryTokens)
                    if (score > 0)
                        matches.push({
                            kind: "topic",
                            id: topic.id,
                            title: topic.title,
                            notebookId: notebook.id,
                            pageId: page.id,
                            topicId: topic.id,
                            score: Math.round(score * 100),
                            semanticScore: score,
                        })
                }

                const views = workspace.views.filter(view => view.topicId === topic.id)
                for (const view of views) {
                    if (allowedKinds.has("view")) {
                        const score = jaccardSimilarity(tokenize(`${view.title} ${view.content}`), queryTokens)
                        if (score > 0)
                            matches.push({
                                kind: "view",
                                id: view.id,
                                title: view.title,
                                notebookId: notebook.id,
                                pageId: page.id,
                                topicId: topic.id,
                                viewId: view.id,
                                score: Math.round(score * 100),
                                semanticScore: score,
                                snippet: articleSnippet(view.content, query, view.content.toLowerCase().indexOf(query.toLowerCase())),
                            })
                    }

                    if (!allowedKinds.has("display")) continue
                    for (const display of view.displays) {
                        const score = jaccardSimilarity(tokenize(`${display.name} ${display.kind}`), queryTokens)
                        if (score <= 0) continue
                        matches.push({
                            kind: "display",
                            id: display.id,
                            title: display.name,
                            notebookId: notebook.id,
                            pageId: page.id,
                            topicId: topic.id,
                            viewId: view.id,
                            score: Math.round(score * 100),
                            semanticScore: score,
                        })
                    }
                }
            }
        }
    }

    const ranked = Array.from(
        [...matches]
            .reduce<Map<string, SemanticSearchMatch>>((accumulator, item) => {
                accumulator.set(`${item.kind}:${item.id}`, item)
                return accumulator
            }, new Map())
            .values(),
    )
        .filter((item): item is SemanticSearchMatch => item !== undefined)
        .map(item => item)
        .filter(item => item.semanticScore > 0)
        .sort((left, right) => right.score - left.score)

    return ok({
        query,
        matches: ranked,
        notes: ranked.length === 0 ? ["No semantic matches found."] : [],
    })
}

export const exportPublishBundle = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; includeHtml?: boolean; includeJson?: boolean }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const markdownExport = exportNotebook(workspace, userId, { notebookId: notebook.id, format: "markdown" })
    if (!markdownExport.ok) return markdownExport

    const webExport = input.includeHtml ? exportNotebook(workspace, userId, { notebookId: notebook.id, format: "web" }) : undefined
    const readback = readNotebookTree(workspace, userId, notebook.id)
    if (!readback.ok) return readback

    const body = {
        notebook: readback.value,
        metadata: {
            id: notebook.id,
            title: notebook.title,
            summary: notebook.summary,
            pageCount: readback.value.pages.length,
            topicCount: readback.value.pages.reduce((count, page) => count + page.topics.length, 0),
            viewCount: readback.value.pages.reduce((count, page) => count + page.topics.reduce((inner, topic) => inner + topic.views.length, 0), 0),
        },
        generatedAt: new Date().toISOString(),
    }

    return ok({
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        markdown: markdownExport.value.markdown,
        web: webExport?.ok ? webExport.value.html : undefined,
        json: input.includeJson ? JSON.stringify(body) : undefined,
        diagnostics: {
            includeHtml: input.includeHtml ?? false,
            includeJson: input.includeJson ?? false,
            manifestHash: body.notebook.id.split("-").pop() || "0",
        },
    })
}

export const workspaceHealthCheck = (workspace: VisualNoteWorkspace, userId: string): WorkspaceOperationResult<HealthCheckResult> => {
    const issues: HealthCheckIssue[] = []
    const notebooks = workspace.notebooks.filter(notebook => notebook.userId === userId)
    const notebookIds = new Set(notebooks.map(notebook => notebook.id))
    const pages = workspace.pages.filter(page => notebookIds.has(page.notebookId))
    const pageIds = byIds(pages)
    const topics = workspace.topics.filter(topic => pageIds.has(topic.pageId))
    const topicIds = byIds(topics)
    const views = workspace.views.filter(view => topicIds.has(view.topicId))

    for (const notebook of notebooks) {
        const sortedPages = byPosition(pages.filter(item => item.notebookId === notebook.id))
        if (sortedPages.some((page, index) => page.position !== index))
            issues.push({
                severity: "warning",
                scope: "notebook",
                id: notebook.id,
                message: `Notebook ${notebook.title} has non-normalized page positions.`,
            })
    }

    for (const page of pages) {
        const sortedTopics = byPosition(topics.filter(topic => topic.pageId === page.id))
        if (sortedTopics.some((topic, index) => topic.position !== index))
            issues.push({
                severity: "warning",
                scope: "page",
                id: page.id,
                message: `Page ${page.title} has non-normalized topic positions.`,
            })
    }

    for (const topic of topics) {
        const sortedViews = byPosition(views.filter(view => view.topicId === topic.id))
        if (sortedViews.some((view, index) => view.position !== index))
            issues.push({
                severity: "warning",
                scope: "topic",
                id: topic.id,
                message: `Topic ${topic.title} has non-normalized view positions.`,
            })
    }

    for (const page of workspace.pages)
        if (!notebookIds.has(page.notebookId))
            issues.push({
                severity: "error",
                scope: "page",
                id: page.id,
                message: `Page ${page.title} belongs to an unknown notebook.`,
            })

    for (const topic of workspace.topics)
        if (!pageIds.has(topic.pageId))
            issues.push({
                severity: "error",
                scope: "topic",
                id: topic.id,
                message: `Topic ${topic.title} belongs to an unknown page.`,
            })

    for (const view of workspace.views)
        if (!topicIds.has(view.topicId))
            issues.push({
                severity: "error",
                scope: "view",
                id: view.id,
                message: `View ${view.title} belongs to an unknown topic.`,
            })

    return ok({
        notebookCount: notebooks.length,
        pageCount: pages.length,
        topicCount: topics.length,
        viewCount: views.length,
        issues,
    })
}

export const analyzeOrphanedData = (workspace: VisualNoteWorkspace, userId: string): WorkspaceOperationResult<OrphanAnalysisResult> => {
    const notebookIds = byIds(workspace.notebooks.filter(notebook => notebook.userId === userId))
    const orphanPages = workspace.pages.filter(page => !notebookIds.has(page.notebookId)).map(page => page.id)
    const pageIds = byIds(workspace.pages.filter(page => notebookIds.has(page.notebookId)))
    const orphanTopics = workspace.topics.filter(topic => !pageIds.has(topic.pageId)).map(topic => topic.id)
    const topicIds = byIds(workspace.topics.filter(topic => pageIds.has(topic.pageId)))
    const orphanViews = workspace.views.filter(view => !topicIds.has(view.topicId)).map(view => view.id)

    return ok({
        orphanPages,
        orphanTopics,
        orphanViews,
        repaired: false,
    })
}

export const repairWorkspaceConsistency = (workspace: VisualNoteWorkspace, userId: string): WorkspaceOperationResult<OrphanAnalysisResult> => {
    const analyzed = analyzeOrphanedData(workspace, userId)
    if (!analyzed.ok) return analyzed

    const notebookIds = new Set(workspace.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.id))
    const pages = byPosition(workspace.pages.filter(page => notebookIds.has(page.notebookId)).map((page, index) => ({ ...page, position: index })))
    const pageIds = byIds(pages)
    const topics = byPosition(workspace.topics.filter(topic => pageIds.has(topic.pageId)).map((topic, index) => ({ ...topic, position: index })))
    const topicIds = byIds(topics)
    const views = byPosition(workspace.views.filter(view => topicIds.has(view.topicId)).map((view, index) => ({ ...view, position: index })))
    const repairedWorkspace = {
        ...workspace,
        pages,
        topics,
        views,
    }

    return ok({
        orphanPages: analyzed.value.orphanPages,
        orphanTopics: analyzed.value.orphanTopics,
        orphanViews: analyzed.value.orphanViews,
        repairedWorkspace,
        repaired: analyzed.value.orphanPages.length > 0 || analyzed.value.orphanTopics.length > 0 || analyzed.value.orphanViews.length > 0,
    })
}

export const upsertVisualBlock = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { viewId: string; visualKind: VisualBlockKind; data: VisualBlockData; blockIndex?: number },
) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    const block = createVisualArticleBlock(input.visualKind, input.data)
    const blocks = [...parsed.blocks]
    if (input.blockIndex == null) blocks.push(block)
    else if (input.blockIndex < 0 || input.blockIndex > blocks.length) return invalidInput("blockIndex is out of range.")
    else if (blocks[input.blockIndex]?.kind === "visual") blocks[input.blockIndex] = block
    else return notFound("Visual block not found at the requested block index.")

    const content = serializeArticleContent(blocks)
    const updated = writeViewContent(workspace, context.view.id, content, context.view.displays.length)
    return ok({
        ...updated,
        view: { ...context.view, content },
        blockIndex: input.blockIndex == null ? blocks.length - 1 : input.blockIndex,
    })
}

export const removeVisualBlock = (workspace: VisualNoteWorkspace, userId: string, viewId: string, blockIndex: number) => {
    const context = findOwnedView(workspace, userId, viewId)
    if (!context) return notFound("Article not found.")

    const parsed = parseArticleContent(context.view.content, context.view.displays.length)
    if (parsed.blocks[blockIndex]?.kind !== "visual") return notFound("Visual block not found at the requested block index.")

    const content = serializeArticleContent(parsed.blocks.filter((_, index) => index !== blockIndex))
    const updated = writeViewContent(workspace, context.view.id, content, context.view.displays.length)
    return ok({ ...updated, view: { ...context.view, content } })
}

export const exportNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; format?: "markdown" | "web" }) => {
    const context = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!context) return notFound("Notebook not found.")

    const document = createExportDocument({
        scope: "notebook",
        selection: {
            notebookId: context.id,
            pageId: "",
            topicId: "",
            viewId: "",
        },
        workspace,
    })
    if (!document) return invalidInput("Unable to build export document.")

    if (input.format === "web") {
        const rendered = renderWebHtml(document, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
        return ok({
            format: "web",
            notebookId: context.id,
            notebookTitle: context.title,
            html: rendered,
            warnings: [],
        })
    }

    const markdown = renderMarkdownExport(document, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
    return ok({
        format: "markdown",
        notebookId: context.id,
        notebookTitle: context.title,
        markdown,
        html: "",
        warnings: [],
    })
}

export const exportPage = (workspace: VisualNoteWorkspace, userId: string, input: { pageId: string; format?: "markdown" | "web" }) => {
    const context = findOwnedPage(workspace, userId, input.pageId)
    if (!context) return notFound("Page not found.")
    const document = createExportDocument({
        scope: "page",
        selection: { notebookId: context.notebook.id, pageId: context.page.id, topicId: "", viewId: "" },
        workspace,
    })
    if (!document) return invalidInput("Unable to build export document.")
    if (input.format === "web") {
        const rendered = renderWebHtml(document, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
        return ok({
            format: "web",
            pageId: context.page.id,
            notebookId: context.notebook.id,
            html: rendered,
            warnings: [],
        })
    }

    const markdown = renderMarkdownExport(document, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
    return ok({
        format: "markdown",
        pageId: context.page.id,
        notebookId: context.notebook.id,
        markdown,
        html: "",
        warnings: [],
    })
}

export const exportView = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; format?: "markdown" | "web" }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")
    const page = createExportDocument({
        scope: "page",
        selection: {
            notebookId: context.notebook.id,
            pageId: context.page.id,
            topicId: context.topic.id,
            viewId: context.view.id,
        },
        workspace,
    })
    if (!page) return invalidInput("Unable to build export document.")

    if (input.format === "web") {
        const html = renderWebHtml(page, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
        return ok({ format: "web", viewId: context.view.id, html, notebookId: context.notebook.id, warnings: [] })
    }

    const markdown = renderMarkdownExport(page, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
    return ok({
        format: "markdown",
        viewId: context.view.id,
        markdown,
        html: "",
        notebookId: context.notebook.id,
        warnings: [],
    })
}

export const publishNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; publish: boolean }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const next = {
        ...notebook,
        published: input.publish,
        publishedAt: input.publish ? new Date().toISOString() : undefined,
    }
    return ok({
        workspace: {
            ...workspace,
            notebooks: workspace.notebooks.map(item => (item.id === next.id ? next : item)),
        },
        notebook: next,
    })
}

export const unpublishNotebook = (workspace: VisualNoteWorkspace, userId: string, notebookId: string) => publishNotebook(workspace, userId, { notebookId, publish: false })

export const setNotebookMetadata = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId: string; title?: string; summary?: string; color?: string; slug?: string; editorSettings?: NotebookEditorSettings },
) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const next: Notebook = {
        ...notebook,
        title: safeTrim(input.title) || notebook.title,
        summary: input.summary ?? notebook.summary,
        color: safeTrim(input.color) || notebook.color,
        slug: input.slug ? ensureUniqueSlug(workspace, slugify(input.slug), userId) : notebook.slug,
        editorSettings: input.editorSettings ?? notebook.editorSettings ?? defaultEditorSettings,
    }

    if (!next.editorSettings) next.editorSettings = defaultEditorSettings
    return ok({
        workspace: {
            ...workspace,
            notebooks: workspace.notebooks.map(item => (item.id === next.id ? next : item)),
        },
        notebook: next,
    })
}

export const snapshotWorkspace = (workspace: VisualNoteWorkspace, userId: string, input: { name: string; note?: string }) => {
    const normalized = normalizeWorkspace(workspace, userId)
    const snapshots = [...(normalized.snapshots ?? []).slice(0, 29)]
    const name = safeTrim(input.name) || `Snapshot ${new Date().toISOString()}`
    const snapshot = {
        id: `snapshot-${createId()}`,
        name,
        note: safeTrim(input.note),
        createdAt: new Date().toISOString(),
        workspace: {
            ...normalized,
            snapshots: [],
        },
    }
    return ok({
        workspace: {
            ...workspace,
            snapshots: [...snapshots, snapshot],
        },
        snapshot,
    })
}

export const listWorkspaceSnapshots = (workspace: VisualNoteWorkspace, userId: string) => {
    if (!workspace.notebooks.some(notebook => notebook.userId === userId)) return notFound("No workspace for user.")
    return ok((workspace.snapshots ?? []).map(snapshot => ({ id: snapshot.id, name: snapshot.name, note: snapshot.note, createdAt: snapshot.createdAt })))
}

export const restoreWorkspaceSnapshot = (workspace: VisualNoteWorkspace, userId: string, input: { snapshotId: string }) => {
    const normalized = normalizeWorkspace(workspace, userId)
    const snapshot = normalized.snapshots?.find(item => item.id === input.snapshotId)
    if (!snapshot) return notFound("Snapshot not found.")

    return ok({
        workspace: {
            ...snapshot.workspace,
            snapshots: normalized.snapshots,
        },
        restoredWorkspace: snapshot.workspace,
    })
}

export const listMcpToolCapabilities = () =>
    ok({
        tools: [
            { name: "list_notebooks", description: "List notebooks owned by user." },
            { name: "read_notebook", description: "Read notebook with ordered page/topic/view tree." },
            { name: "read_workspace", description: "Read workspace summary with totals." },
            { name: "resolve_notebook", description: "Resolve notebook by id or title." },
            { name: "resolve_page", description: "Resolve page by id or title." },
            { name: "resolve_topic", description: "Resolve topic by id or title." },
            { name: "resolve_view", description: "Resolve view by id or title." },
            { name: "list_pages", description: "List pages with topic and view counts." },
            { name: "read_page", description: "Read page and child topics." },
            { name: "create_notebook", description: "Create notebook." },
            { name: "rename_notebook", description: "Rename or mutate notebook metadata." },
            { name: "delete_notebook", description: "Delete notebook and all descendants." },
            { name: "duplicate_notebook", description: "Duplicate a notebook and descendants." },
            { name: "create_page", description: "Create page inside notebook." },
            { name: "rename_page", description: "Rename and/or reorder a page." },
            { name: "reorder_pages", description: "Reorder pages inside notebook." },
            { name: "move_page_to_notebook", description: "Move page across notebooks." },
            { name: "delete_page", description: "Delete page and descendants." },
            { name: "create_topic", description: "Create topic in page." },
            { name: "rename_topic", description: "Rename and/or reorder a topic." },
            { name: "reorder_topics", description: "Reorder topics in page." },
            { name: "move_topic_to_page", description: "Move topic across pages." },
            { name: "duplicate_topic", description: "Duplicate topic and descendant views." },
            { name: "delete_topic", description: "Delete topic and descendant views." },
            { name: "create_view", description: "Create view in topic." },
            { name: "create_view_from_template", description: "Create view from template." },
            { name: "rename_view", description: "Rename or repurpose a view." },
            { name: "change_view_mode", description: "Change view mode." },
            { name: "reorder_views", description: "Reorder views in topic." },
            { name: "move_view_to_topic", description: "Move view across topics." },
            { name: "duplicate_view", description: "Duplicate view content to same/another topic." },
            { name: "delete_view", description: "Delete a view." },
            { name: "create_article", description: "Create/reuse notebook->page->topic->view path and set content." },
            { name: "read_article", description: "Read article with block metadata." },
            { name: "read_view_as_markdown", description: "Read a single view rendered as markdown." },
            { name: "read_view_as_blocks", description: "Read article as parsed blocks." },
            { name: "replace_article_content", description: "Replace article markdown." },
            { name: "insert_article_blocks", description: "Insert parsed blocks into article." },
            { name: "replace_article_block", description: "Replace one block in an article." },
            { name: "remove_article_block", description: "Remove one block in an article." },
            { name: "move_article_block", description: "Move article block." },
            { name: "patch_article_section", description: "Replace section under heading." },
            { name: "apply_article_patch", description: "Apply a small set of article block operations." },
            { name: "lint_article", description: "Validate article parser round-trip and references." },
            { name: "upsert_visual_block", description: "Insert or replace a visual article block." },
            { name: "remove_visual_block", description: "Remove visual article block." },
            { name: "list_display_kinds", description: "List component kinds and defaults." },
            { name: "add_display_to_view", description: "Add display to a view." },
            { name: "remove_display_from_view", description: "Remove display from a view." },
            { name: "patch_display_data", description: "Patch a display's data payload." },
            { name: "set_display_order", description: "Reorder displays by id." },
            { name: "analyze_workspace_gaps", description: "Find structure and content gaps." },
            { name: "generate_outline_from_text", description: "Generate outline preview from text." },
            { name: "generate_topic_from_outline", description: "Create topic/view structure from an outline." },
            { name: "infer_component_type", description: "Infer recommended component kind from payload." },
            { name: "import_data_block", description: "Import a data payload and add a component display." },
            { name: "suggest_layout_for_view_mode", description: "Suggest layout mode and supporting displays." },
            { name: "rewrite_view_layout_for_mode", description: "Rewrite a view for a target layout mode." },
            { name: "preview_render_profile", description: "Preview render complexity for a view." },
            { name: "search_semantic", description: "Search with token-based semantic score." },
            { name: "search_workspace", description: "Search notebooks and nested content." },
            { name: "workspace_health_check", description: "Return consistency and integrity issues." },
            { name: "analyze_orphaned_data", description: "List orphan pages, topics, and views." },
            { name: "publish_diagnose", description: "Analyze publish readiness and blockers." },
            { name: "batch_read_workspace", description: "Execute multiple read tools in one call." },
            { name: "batch_mutate_workspace", description: "Execute multiple mutation operations in one call." },
            { name: "validate_after_mutation", description: "Run validation after mutation." },
            { name: "plan_agentic_workflow", description: "Generate an agent workflow with optional prechecks." },
            { name: "task_suggest_and_execute", description: "Suggest and optionally execute task steps." },
            { name: "execute_plan_with_guarantees", description: "Execute a plan with guardrails and validation." },
            { name: "snapshot_compare", description: "Compare notebook state to snapshot-derived state." },
            { name: "diff_notebook_state", description: "Compare notebook structure with snapshot ids." },
            { name: "find_duplicate_or_stale_content", description: "Find duplicate content and stale records." },
            { name: "repair_workspace", description: "Repair workspace consistency and normalize ordering." },
            { name: "repair_workspace_consistency", description: "Remove orphan records and normalize order." },
            { name: "export_notebook", description: "Export notebook as markdown or web HTML." },
            { name: "export_page", description: "Export page as markdown or web HTML." },
            { name: "export_view", description: "Export single view as markdown or web HTML." },
            { name: "export_publish_bundle", description: "Build notebook export bundle for publishing." },
            { name: "snapshot_workspace", description: "Create workspace snapshot for undo/rollback." },
            { name: "list_workspace_snapshots", description: "List workspace snapshots." },
            { name: "restore_workspace_snapshot", description: "Restore workspace from snapshot." },
            { name: "publish_notebook", description: "Set notebook published flag." },
            { name: "unpublish_notebook", description: "Unset notebook published flag." },
            { name: "set_notebook_metadata", description: "Set notebook metadata including editor settings." },
            { name: "agentic_observe_workspace", description: "Get workspace state, health, duplicates, drift, and policy summary for safe agent decisions." },
            { name: "agentic_intent_to_plan", description: "Convert a natural-language goal into a proposed agentic plan." },
            { name: "agentic_plan_dryrun", description: "Simulate a planned sequence and summarize impacted entities." },
            { name: "agentic_plan_guardrail", description: "Validate plan risk and filter unsafe operations." },
            { name: "agentic_execute_with_sla", description: "Execute plan with guardrails and optional SLA enforcement." },
            { name: "agentic_auto_repair", description: "Run a safe repair sequence for structural inconsistencies." },
            { name: "agentic_suggest_restructure", description: "Propose structure changes from semantic and order heuristics." },
            { name: "agentic_reference_rewrite", description: "Analyze unresolved references and propose or apply safe rewrites." },
            { name: "agentic_component_pipeline", description: "Run component/layout evolution steps on a candidate notebook." },
            { name: "agentic_change_set", description: "Preview entity-level delta for a change plan before mutation." },
            { name: "agentic_contract_enforcer", description: "Evaluate contract/policy invariants and return pass/fail posture." },
            { name: "agentic_observation_query", description: "Read filtered agentic observations for planning and debugging." },
            { name: "agentic_workflow_job", description: "Create, reconcile, or execute an agentic workflow job." },
            { name: "agentic_workflow_status", description: "Read status for the latest or a specific workflow job." },
            { name: "agentic_workflow_cancel", description: "Cancel an in-flight workflow job." },
            { name: "agentic_preflight_gate", description: "Run preflight health, guardrail, and optional publish checks." },
            { name: "agentic_plan_optimizer", description: "Optimize and filter a candidate plan before execution." },
            { name: "agentic_plan_reconciler", description: "Reconcile stale ids in a plan against current workspace state." },
            { name: "agentic_goal_expander", description: "Expand a goal into likely sub-goals and suggested tool chains." },
            { name: "agentic_impact_scoper", description: "Estimate scope and risk impact for each planned change." },
            { name: "agentic_multi_notebook_batch", description: "Run multiple notebook batches in one preview or execution call." },
            { name: "agentic_policy_set", description: "List, validate, or run policy checks across workspace scope." },
            { name: "agentic_publish_readiness_gate", description: "Evaluate publish readiness and contract checks across notebooks." },
            { name: "agentic_structured_ingest_from_text", description: "Convert text to structured outline topics and apply when requested." },
            { name: "agentic_component_compatibility_check", description: "Check data payload compatibility against component kinds." },
            { name: "agentic_drift_scheduler", description: "Generate drift and duplicate remediation schedule signals." },
            { name: "agentic_change_set_renderer", description: "Render readable plan summaries from change-set operations." },
            { name: "agentic_tool_feedback", description: "Record feedback from workflow/plan execution for future guidance." },
            { name: "agentic_tool_selector", description: "Suggest best-matching agentic tools for a user goal." },
            { name: "list_mcp_tool_capabilities", description: "List all MCP tools this workspace exposes." },
            { name: "describe_mcp_tool", description: "Describe a specific MCP tool." },
        ] as const,
    })

export const describeMcpTool = (toolName: string): WorkspaceOperationResult<{ name: string; description: string }> => {
    const match = listMcpToolCapabilities().value.tools.find(tool => tool.name === toolName)
    if (!match) return notFound("Tool not found.")
    return ok(match)
}

const createVisualArticleBlock = (visualKind: VisualBlockKind, data: VisualBlockData): Extract<ArticleBlock, { kind: "visual" }> => {
    const mergedData = { ...defaultVisualBlockData(visualKind), ...data }
    return {
        kind: "visual",
        visualKind,
        data: mergedData,
        raw: serializeVisualBlockBody(mergedData),
    }
}
