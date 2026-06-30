import { analyzeNotebookHealth } from "./search"
import { findOwnedView, writeViewContent } from "./read-model"
import { findOwnedNotebook } from "./selectors"
import { HealthCheckIssue, normalizeTitle, notFound, ok } from "./result"
import { DuplicateContentMatch, DuplicateContentReport, parseArticleContent, serializeArticleContent, VisualNoteWorkspace } from "./types"

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
                kind: "title" as const,
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
