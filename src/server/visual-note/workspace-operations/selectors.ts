import { jaccardSimilarity, observationId, tokenize } from "./utils"
import { ChangePlanOperation, clampIndex, normalizeTitle, Positioned, safeTrim, WorkspacePolicyRule } from "./result"
import { VisualNoteWorkspace } from "./types"

export const appendAgenticObservation = (
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

export const parseMarkdownLinks = (content: string) => {
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

export const collectDisplayUrls = (value: unknown, prefix: string, output: { key: string; url: string; path: string }[] = []) => {
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

export const riskFromOperation = (operation: ChangePlanOperation, before: { issues: number; blockers: number }, after: { issues: number; blockers: number }) => {
    if (after.blockers > before.blockers) return { risk: "high" as const, reasons: [`Operation ${operation.tool} can increase blocking issues.`] }
    if (after.blockers > 0 && after.issues > before.issues) return { risk: "medium" as const, reasons: [`Operation ${operation.tool} changed issue balance.`] }
    return { risk: "low" as const, reasons: [] as string[] }
}

export const defaultWorkspacePolicyRules: WorkspacePolicyRule[] = [
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

export const topicSimilarityScore = (left: { title: string; summary?: string }, right: { title: string; summary?: string }) => {
    const leftTokens = tokenize(`${left.title} ${left.summary ?? ""}`)
    const rightTokens = tokenize(`${right.title} ${right.summary ?? ""}`)
    return jaccardSimilarity(leftTokens, rightTokens)
}

export const touchedFromInput = (input: ChangePlanOperation) => {
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

export const scopedWorkspaceEntities = (workspace: VisualNoteWorkspace, userId: string, notebookId?: string) => {
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

export const countScopeState = (scope: ReturnType<typeof scopedWorkspaceEntities>) => ({
    notebooks: scope.notebooks.length,
    pages: scope.pages.length,
    topics: scope.topics.length,
    views: scope.views.length,
    displays: scope.displays.length,
})

export const moveById = <T extends Positioned>(items: T[], id: string, to: number) => {
    const index = items.findIndex(item => item.id === id)
    if (index < 0) return null

    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(clampIndex(to, next.length), 0, moved)

    return next.map((item, position) => ({ ...item, position }))
}

export const reorderByIds = <T extends Positioned>(items: T[], ids: string[]) => {
    if (ids.length !== items.length) return null

    const byId = new Map(items.map(item => [item.id, item]))
    const found = ids.every(id => byId.has(id))
    if (!found) return null

    return ids.map((id, position) => ({ ...(byId.get(id) as T), position }))
}

export const byIds = (items: { id: string }[]) => new Set(items.map(item => item.id))

export const articleSnippet = (content: string, query: string, matchAt: number) => {
    const marker = normalizeTitle(query)
    const lower = content.toLowerCase()
    const found = lower.indexOf(marker, Math.max(0, matchAt - 80))
    if (found < 0) return content.slice(0, 160)

    const start = Math.max(0, found - 64)
    const end = Math.min(content.length, found + marker.length + 64)
    return `${start > 0 ? "..." : ""}${content.slice(start, end)}${end < content.length ? "..." : ""}`
}

export const findOwnedNotebook = (workspace: VisualNoteWorkspace, userId: string, notebookId: string) => {
    const notebook = workspace.notebooks.find(item => item.id === notebookId)
    if (!notebook || notebook.userId !== userId) return null
    return notebook
}

export const findOwnedNotebookByTitle = (workspace: VisualNoteWorkspace, userId: string, notebookTitle: string) => {
    const candidateTitle = normalizeTitle(safeTrim(notebookTitle))
    if (!candidateTitle) return null

    const match = workspace.notebooks.find(item => item.userId === userId && normalizeTitle(item.title) === candidateTitle)
    if (match) return match
    return workspace.notebooks.find(item => item.userId === userId && normalizeTitle(item.slug) === candidateTitle) ?? null
}

export const findOwnedPage = (workspace: VisualNoteWorkspace, userId: string, pageId: string) => {
    const page = workspace.pages.find(item => item.id === pageId)
    if (!page) return null

    const notebook = findOwnedNotebook(workspace, userId, page.notebookId)
    if (!notebook) return null

    return { notebook, page }
}
