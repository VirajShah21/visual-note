import { publishNotebook, setNotebookMetadata } from "./exports"
import { removeVisualBlock, repairWorkspaceConsistency, upsertVisualBlock } from "./health"
import { addDisplayToView, applyArticlePatch, moveArticleBlock, patchArticleSection, patchDisplayData, removeDisplayFromView, setDisplayOrder } from "./displays"
import {
    changeViewMode,
    createViewFromTemplate,
    deleteView,
    insertArticleBlocks,
    moveViewToTopic,
    removeArticleBlock,
    replaceArticleBlock,
    replaceArticleContent,
} from "./articles"
import { createView, deleteTopic, duplicateTopic, duplicateView, moveTopicToPage, renameTopic, renameView, reorderTopics, reorderViews } from "./topics-views"
import { createPage, createTopic, deletePage, duplicateNotebook, movePageToNotebook, renamePage, reorderPages } from "./pages"
import { createNotebook, deleteNotebook, renameNotebook } from "./notebooks"
import { ArticlePatchOperation, ChangePlanOperation, invalidInput, notFound, ok, WorkspaceMutationResultValue } from "./result"
import { ComponentKind, isVisualBlockKind, NotebookEditorSettings, ViewMode, VisualBlockData, VisualBlockKind, VisualNoteWorkspace, WorkspaceOperationResult } from "./types"

export const applyChangePlanOperation = (
    workspace: VisualNoteWorkspace,
    userId: string,
    operation: ChangePlanOperation,
): WorkspaceOperationResult<WorkspaceMutationResultValue> => {
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
                operations: Array.isArray(inputData.operations) ? (inputData.operations as ArticlePatchOperation[]) : [],
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
