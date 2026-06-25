import { reorderTopics, reorderViews } from "./workspace-operations-part-008"
import { reorderPages } from "./workspace-operations-part-007"
import { findOwnedTopic, writeViewContent } from "./workspace-operations-part-005"
import { findOwnedNotebook, topicSimilarityScore } from "./workspace-operations-part-004"
import { canonicalizeTitle, ensureUniqueByScope } from "./workspace-operations-part-003"
import { byPosition, cloneWorkspace, notFound, ok, ViewTitleCanonicalization } from "./workspace-operations-part-002"
import { parseArticleContent, VisualNoteWorkspace } from "./workspace-operations-part-001"
export * from "./workspace-operations-part-013"

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
