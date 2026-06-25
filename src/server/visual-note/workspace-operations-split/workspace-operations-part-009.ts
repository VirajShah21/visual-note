import { findOwnedTopic, findOwnedView, writeViewContent } from "./workspace-operations-part-005"
import { moveById } from "./workspace-operations-part-004"
import { byPosition, clampIndex, invalidInput, notFound, ok, safeTrim } from "./workspace-operations-part-002"
import {
    ArticleBlock,
    createExportDocument,
    createViewRecord,
    NotebookView,
    parseArticleContent,
    renderMarkdownExport,
    serializeArticleContent,
    ViewMode,
    VisualNoteWorkspace,
} from "./workspace-operations-part-001"
export * from "./workspace-operations-part-008"

export const moveViewToTopic = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; targetTopicId: string; position?: number }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")

    const targetTopic = findOwnedTopic(workspace, userId, input.targetTopicId)
    if (!targetTopic) return notFound("Target topic not found.")

    if (context.topic.id === targetTopic.topic.id) {
        const siblings = byPosition(workspace.views.filter(item => item.topicId === context.topic.id))
        const position = input.position === undefined ? (context.view.position ?? 0) : clampIndex(input.position, siblings.length - 1)
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
