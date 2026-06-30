import { analyzeOrphanedData, repairWorkspaceConsistency } from "./health"
import { diffNotebookState } from "./planning"
import { findDuplicateContent } from "./analysis"
import { articleSnippet, findOwnedNotebook } from "./selectors"
import { jaccardSimilarity, tokenize } from "./utils"
import { invalidInput, notFound, ok, safeTrim } from "./result"
import { SemanticSearchMatch, VisualNoteWorkspace } from "./types"

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
