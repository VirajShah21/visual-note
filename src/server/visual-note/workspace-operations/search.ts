import { workspaceHealthCheck } from "./health"
import { findOwnedTopic } from "./read-model"
import { articleSnippet, findOwnedNotebook, findOwnedPage } from "./selectors"
import { byPosition, HealthCheckIssue, invalidInput, normalizeTitle, notFound, ok, safeTrim } from "./result"
import { NextStepSuggestion, parseArticleContent, SearchMatch, VisualNoteWorkspace } from "./types"

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

    const notebookId = input.notebookId
    if (!notebookId) return notFound("Notebook not found.")
    const notebook = findOwnedNotebook(workspace, userId, notebookId)
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
