import { findOwnedView, writeViewContent } from "./read-model"
import { moveById, reorderByIds } from "./selectors"
import { ArticlePatchOperation, byPosition, clampIndex, createId, invalidInput, notFound, ok, safeTrim, setByPath } from "./result"
import {
    ArticleBlock,
    ComponentKind,
    createDisplayInstance,
    defaultComponentData,
    defaultDisplayName,
    parseArticleContent,
    serializeArticleContent,
    VisualNoteWorkspace,
} from "./types"

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
        operations: ArticlePatchOperation[]
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
        position,
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
        kinds: (["data-card", "checklist", "timeline", "dashboard", "work-logs", "bugs-list", "shopping-list", "pull-request", "url", "code-block"] satisfies ComponentKind[]).map(
            kind => ({
                kind,
                label: defaultDisplayName(kind),
                defaultData: defaultComponentData(kind),
            }),
        ),
    })
