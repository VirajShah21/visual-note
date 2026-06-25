/* eslint-disable max-lines */
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js"
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { normalizeWorkspace } from "@/lib/visual-note/factories"
import { visualBlockKinds } from "@/lib/visual-note/visual-blocks"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { loadWorkspaceForUser, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import * as workspaceOps from "@/server/visual-note/workspace-operations"
import type { WorkspaceOperationResult } from "@/server/visual-note/workspace-operations"

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>

type RequestContext = {
    tokenId?: string
    userId: string
}

const emptyWorkspace: VisualNoteWorkspace = {
    notebooks: [],
    pages: [],
    topics: [],
    views: [],
    components: [],
}

const visualBlockKindSchema = z.enum(visualBlockKinds)
const componentKindSchema = z.enum(["data-card", "checklist", "timeline", "dashboard", "work-logs", "bugs-list", "shopping-list", "pull-request", "url", "code-block"] as const)
const viewModeSchema = z.enum(["article", "structured", "dashboard"])
const viewKindSchema = z.enum(["notebook", "page", "topic", "view", "display"])
const blockInfoSchema = z.enum(["show", "type-only", "metadata-only"])
const contentModeSchema = z.enum(["show", "hide-title", "hide"])
const editorModeSchema = z.enum(["editing", "source", "reader"])
const policyCheckSchema = z.enum(["notebook_summary", "non_empty_titles", "display_or_content", "layout_density"])
const riskLevelSchema = z.enum(["low", "medium", "high"])

const jsonResult = (payload: unknown) => ({
    content: [
        {
            type: "text" as const,
            text: JSON.stringify(payload, null, 2),
        },
    ],
})

const operationResult = <T>(result: WorkspaceOperationResult<T>) => jsonResult(result.ok ? { ok: true, ...result.value } : result)

const requestContextFrom = (authInfo?: AuthInfo): RequestContext | null => {
    const userId = authInfo?.extra?.userId
    if (!authInfo?.token || typeof userId !== "string") return null

    return { tokenId: typeof authInfo.extra?.tokenId === "string" ? authInfo.extra.tokenId : undefined, userId }
}

const loadWorkspace = async (context: RequestContext) => {
    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) throw new Error("Server database access is required for MCP routes.")

    const workspace = await loadWorkspaceForUser(supabase, context.userId)
    return { supabase, workspace: normalizeWorkspace(workspace ?? emptyWorkspace) }
}

const withWorkspace = async <T>(extra: ToolExtra, action: (workspace: VisualNoteWorkspace, context: RequestContext) => Promise<T> | T) => {
    const context = requestContextFrom(extra.authInfo)
    if (!context) return jsonResult({ ok: false, error: "auth_required", message: "Authentication required." })

    const { workspace } = await loadWorkspace(context)
    return action(workspace, context)
}

const withWorkspaceMutation = async (
    extra: ToolExtra,
    action: (
        workspace: VisualNoteWorkspace,
        context: RequestContext,
    ) => Promise<WorkspaceOperationResult<object & { workspace?: VisualNoteWorkspace }>> | WorkspaceOperationResult<object & { workspace?: VisualNoteWorkspace }>,
) =>
    (async () => {
        const context = requestContextFrom(extra.authInfo)
        if (!context) return jsonResult({ ok: false, error: "auth_required", message: "Authentication required." })

        const loaded = await loadWorkspace(context)
        const result = await action(loaded.workspace, context)
        if (!result.ok) return jsonResult(result)

        const value = result.value
        if (!value.workspace) return jsonResult({ ok: false, error: "invalid_input", message: "Mutation did not return a workspace." })

        const publicValue = { ...value }
        delete publicValue.workspace
        await saveWorkspaceForUser(loaded.supabase, context.userId, value.workspace)
        return jsonResult({ ok: true, ...publicValue })
    })()

const withWorkspaceReadResult = async (extra: ToolExtra, action: (workspace: VisualNoteWorkspace, context: RequestContext) => WorkspaceOperationResult<unknown>) =>
    withWorkspace(extra, (workspace, context) => operationResult(action(workspace, context)))

const requireAtLeastOne = (schema: Record<string, unknown>, fields: string[]) =>
    z
        .object(schema)
        .partial()
        .refine(value => fields.some(field => Boolean((value as Record<string, string | undefined>)[field])), {
            message: `${fields.join(" or ")} is required.`,
        })

const resolveNotebookInput = requireAtLeastOne({ notebookId: z.string().min(1), title: z.string().min(1) }, ["notebookId", "title"])
const resolvePageInput = requireAtLeastOne(
    {
        pageId: z.string().min(1),
        title: z.string().min(1),
        notebookId: z.string().min(1),
    },
    ["pageId", "title"],
)
const resolveTopicInput = requireAtLeastOne(
    {
        topicId: z.string().min(1),
        title: z.string().min(1),
        pageId: z.string().min(1),
    },
    ["topicId", "title"],
)
const resolveViewInput = requireAtLeastOne(
    {
        viewId: z.string().min(1),
        title: z.string().min(1),
        topicId: z.string().min(1),
    },
    ["viewId", "title"],
)

export const registerVisualNoteMcpTools = (server: McpServer) => {
    server.registerTool("list_notebooks", { title: "List notebooks", description: "List notebooks owned by the authenticated user." }, async extra =>
        withWorkspace(extra, (workspace, context) => jsonResult({ ok: true, notebooks: workspaceOps.listNotebooks(workspace, context.userId) })),
    )

    server.registerTool(
        "read_workspace",
        {
            title: "Read workspace",
            description: "Read workspace summary with totals.",
            inputSchema: z.object({}),
        },
        async (_input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.readWorkspace(workspace, context.userId)),
    )

    server.registerTool(
        "read_notebook",
        {
            title: "Read notebook",
            description: "Read one notebook as an ordered page/topic/view tree.",
            inputSchema: z.object({ notebookId: z.string().min(1) }),
        },
        async ({ notebookId }, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.readNotebookTree(workspace, context.userId, notebookId)),
    )

    server.registerTool(
        "resolve_notebook",
        {
            title: "Resolve notebook",
            description: "Resolve a notebook by id or title.",
            inputSchema: resolveNotebookInput,
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.resolveNotebook(workspace, context.userId, input)),
    )

    server.registerTool(
        "resolve_page",
        {
            title: "Resolve page",
            description: "Resolve a page by id or title.",
            inputSchema: resolvePageInput,
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.resolvePage(workspace, context.userId, input)),
    )

    server.registerTool(
        "resolve_topic",
        {
            title: "Resolve topic",
            description: "Resolve a topic by id or title.",
            inputSchema: resolveTopicInput,
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.resolveTopic(workspace, context.userId, input)),
    )

    server.registerTool(
        "resolve_view",
        {
            title: "Resolve view",
            description: "Resolve a view by id or title.",
            inputSchema: resolveViewInput,
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.resolveView(workspace, context.userId, input)),
    )

    server.registerTool(
        "list_pages",
        {
            title: "List pages",
            description: "List pages for user notebooks and optional notebook filter.",
            inputSchema: z.object({ notebookId: z.string().min(1).optional() }),
        },
        async ({ notebookId }, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.listPages(workspace, context.userId, notebookId)),
    )

    server.registerTool(
        "read_page",
        {
            title: "Read page",
            description: "Read one page and its child topics in order.",
            inputSchema: z.object({ pageId: z.string().min(1) }),
        },
        async ({ pageId }, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.readPage(workspace, context.userId, pageId)),
    )

    server.registerTool(
        "create_notebook",
        {
            title: "Create notebook",
            description: "Create a new notebook for the authenticated user.",
            inputSchema: z.object({
                title: z.string().min(1),
                summary: z.string().optional(),
                color: z.string().optional(),
                slug: z.string().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.createNotebook(workspace, context.userId, input)),
    )

    server.registerTool(
        "rename_notebook",
        {
            title: "Rename notebook",
            description: "Rename a notebook or update notebook metadata.",
            inputSchema: z.object({
                notebookId: z.string().min(1),
                title: z.string().optional(),
                summary: z.string().optional(),
                color: z.string().optional(),
                slug: z.string().optional(),
                published: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.renameNotebook(workspace, context.userId, input)),
    )

    server.registerTool(
        "delete_notebook",
        {
            title: "Delete notebook",
            description: "Delete a notebook and all nested content.",
            inputSchema: z.object({ notebookId: z.string().min(1) }),
        },
        async ({ notebookId }, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.deleteNotebook(workspace, context.userId, notebookId)),
    )

    server.registerTool(
        "duplicate_notebook",
        {
            title: "Duplicate notebook",
            description: "Duplicate a notebook and all descendants.",
            inputSchema: z.object({ sourceNotebookId: z.string().min(1), title: z.string().optional() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.duplicateNotebook(workspace, context.userId, input)),
    )

    server.registerTool(
        "create_page",
        {
            title: "Create page",
            description: "Create page inside notebook.",
            inputSchema: z.object({ notebookId: z.string().min(1), title: z.string().min(1), position: z.number().int().min(0).optional() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.createPage(workspace, context.userId, input)),
    )

    server.registerTool(
        "rename_page",
        {
            title: "Rename page",
            description: "Rename and optionally reorder a page.",
            inputSchema: z.object({ pageId: z.string().min(1), title: z.string().optional(), position: z.number().int().min(0).optional() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.renamePage(workspace, context.userId, input)),
    )

    server.registerTool(
        "reorder_pages",
        {
            title: "Reorder pages",
            description: "Reorder pages within a notebook by id.",
            inputSchema: z.object({ notebookId: z.string().min(1), pageIds: z.array(z.string().min(1)) }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.reorderPages(workspace, context.userId, input)),
    )

    server.registerTool(
        "move_page_to_notebook",
        {
            title: "Move page",
            description: "Move a page to a target notebook.",
            inputSchema: z.object({ pageId: z.string().min(1), targetNotebookId: z.string().min(1), position: z.number().int().min(0).optional() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.movePageToNotebook(workspace, context.userId, input)),
    )

    server.registerTool(
        "delete_page",
        {
            title: "Delete page",
            description: "Delete page and descendants.",
            inputSchema: z.object({ pageId: z.string().min(1) }),
        },
        async ({ pageId }, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.deletePage(workspace, context.userId, pageId)),
    )

    server.registerTool(
        "create_topic",
        {
            title: "Create topic",
            description: "Create a topic under a page.",
            inputSchema: z.object({
                pageId: z.string().min(1),
                title: z.string().min(1),
                summary: z.string().optional(),
                position: z.number().int().min(0).optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.createTopic(workspace, context.userId, input)),
    )

    server.registerTool(
        "rename_topic",
        {
            title: "Rename topic",
            description: "Rename and optionally reorder a topic.",
            inputSchema: z.object({ topicId: z.string().min(1), title: z.string().optional(), summary: z.string().optional(), position: z.number().int().min(0).optional() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.renameTopic(workspace, context.userId, input)),
    )

    server.registerTool(
        "reorder_topics",
        {
            title: "Reorder topics",
            description: "Reorder all topics in a page by id.",
            inputSchema: z.object({ pageId: z.string().min(1), topicIds: z.array(z.string().min(1)) }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.reorderTopics(workspace, context.userId, input)),
    )

    server.registerTool(
        "move_topic_to_page",
        {
            title: "Move topic",
            description: "Move topic to another page.",
            inputSchema: z.object({ topicId: z.string().min(1), targetPageId: z.string().min(1), position: z.number().int().min(0).optional() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.moveTopicToPage(workspace, context.userId, input)),
    )

    server.registerTool(
        "duplicate_topic",
        {
            title: "Duplicate topic",
            description: "Duplicate a topic and descendants to the same or target page.",
            inputSchema: z.object({
                topicId: z.string().min(1),
                targetPageId: z.string().min(1).optional(),
                title: z.string().optional(),
                position: z.number().int().min(0).optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.duplicateTopic(workspace, context.userId, input)),
    )

    server.registerTool(
        "delete_topic",
        {
            title: "Delete topic",
            description: "Delete topic and descendant views.",
            inputSchema: z.object({ topicId: z.string().min(1) }),
        },
        async ({ topicId }, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.deleteTopic(workspace, context.userId, topicId)),
    )

    server.registerTool(
        "create_view",
        {
            title: "Create view",
            description: "Create a view under a topic.",
            inputSchema: z.object({
                topicId: z.string().min(1),
                title: z.string().min(1),
                mode: viewModeSchema.optional(),
                position: z.number().int().min(0).optional(),
                content: z.string().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.createView(workspace, context.userId, input)),
    )

    server.registerTool(
        "create_view_from_template",
        {
            title: "Create view from template",
            description: "Create a view from a built-in template.",
            inputSchema: z.object({
                topicId: z.string().min(1),
                title: z.string().min(1),
                template: z.enum(["empty", "research", "roadmap"]),
                mode: viewModeSchema.optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.createViewFromTemplate(workspace, context.userId, input)),
    )

    server.registerTool(
        "rename_view",
        {
            title: "Rename view",
            description: "Rename a view and optionally change mode.",
            inputSchema: z.object({ viewId: z.string().min(1), title: z.string().optional(), mode: viewModeSchema.optional() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.renameView(workspace, context.userId, input)),
    )

    server.registerTool(
        "change_view_mode",
        {
            title: "Change view mode",
            description: "Change a view mode while preserving or resetting content.",
            inputSchema: z.object({ viewId: z.string().min(1), mode: viewModeSchema, keepContent: z.boolean().optional() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.changeViewMode(workspace, context.userId, input)),
    )

    server.registerTool(
        "reorder_views",
        {
            title: "Reorder views",
            description: "Reorder all views in a topic by id.",
            inputSchema: z.object({ topicId: z.string().min(1), viewIds: z.array(z.string().min(1)) }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.reorderViews(workspace, context.userId, input)),
    )

    server.registerTool(
        "move_view_to_topic",
        {
            title: "Move view",
            description: "Move a view to another topic.",
            inputSchema: z.object({ viewId: z.string().min(1), targetTopicId: z.string().min(1), position: z.number().int().min(0).optional() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.moveViewToTopic(workspace, context.userId, input)),
    )

    server.registerTool(
        "duplicate_view",
        {
            title: "Duplicate view",
            description: "Duplicate a view and descendants to same/another topic.",
            inputSchema: z.object({
                viewId: z.string().min(1),
                targetTopicId: z.string().min(1).optional(),
                title: z.string().optional(),
                position: z.number().int().min(0).optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.duplicateView(workspace, context.userId, input)),
    )

    server.registerTool(
        "delete_view",
        {
            title: "Delete view",
            description: "Delete a view from its topic.",
            inputSchema: z.object({ viewId: z.string().min(1) }),
        },
        async ({ viewId }, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.deleteView(workspace, context.userId, viewId)),
    )

    server.registerTool(
        "create_article",
        {
            title: "Create article",
            description: "Create or reuse notebook/page/topic and return an article view.",
            inputSchema: z.object({
                notebookId: z.string().min(1),
                pageTitle: z.string().min(1),
                topicTitle: z.string().min(1),
                articleTitle: z.string().optional(),
                content: z.string().optional(),
                mode: viewModeSchema.optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.createArticle(workspace, context.userId, input)),
    )

    server.registerTool(
        "generate_outline_from_text",
        {
            title: "Generate outline from text",
            description: "Convert plain text into a structured outline preview.",
            inputSchema: z.object({
                text: z.string().min(1),
                maxSections: z.number().int().min(1).max(12).optional(),
                maxViewsPerSection: z.number().int().min(1).max(20).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.generateOutlineFromText(workspace, context.userId, input)),
    )

    server.registerTool(
        "generate_topic_from_outline",
        {
            title: "Generate topic from outline",
            description: "Create topics and views from an outline block.",
            inputSchema: z.object({
                notebookId: z.string().min(1),
                pageId: z.string().min(1).optional(),
                pageTitle: z.string().min(1).optional(),
                outline: z.string().min(1),
                topicMode: viewModeSchema.optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.generateTopicFromOutline(workspace, context.userId, input)),
    )

    server.registerTool(
        "read_article",
        {
            title: "Read article",
            description: "Read one article with parsed blocks and display mapping.",
            inputSchema: z.object({ viewId: z.string().min(1) }),
        },
        async ({ viewId }, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.readArticle(workspace, context.userId, viewId)),
    )

    server.registerTool(
        "read_view_as_markdown",
        {
            title: "Read view markdown",
            description: "Read a view rendered as markdown.",
            inputSchema: z.object({ viewId: z.string().min(1) }),
        },
        async ({ viewId }, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.readViewAsMarkdown(workspace, context.userId, viewId)),
    )

    server.registerTool(
        "read_view_as_blocks",
        {
            title: "Read view blocks",
            description: "Read an article as parsed blocks.",
            inputSchema: z.object({ viewId: z.string().min(1) }),
        },
        async ({ viewId }, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.readViewAsBlocks(workspace, context.userId, viewId)),
    )

    server.registerTool(
        "suggest_layout_for_view_mode",
        {
            title: "Suggest layout mode",
            description: "Suggest a compatible view mode and supporting displays for a view.",
            inputSchema: z.object({ viewId: z.string().min(1), preferredMode: viewModeSchema.optional() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.suggestLayoutForViewMode(workspace, context.userId, input)),
    )

    server.registerTool(
        "rewrite_view_layout_for_mode",
        {
            title: "Rewrite view layout",
            description: "Switch view mode and optionally add recommended displays.",
            inputSchema: z.object({
                viewId: z.string().min(1),
                mode: viewModeSchema,
                addRecommendedDisplays: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.rewriteViewLayoutForMode(workspace, context.userId, input)),
    )

    server.registerTool(
        "preview_render_profile",
        {
            title: "Preview render profile",
            description: "Estimate render complexity for a single view.",
            inputSchema: z.object({ viewId: z.string().min(1) }),
        },
        async ({ viewId }, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.previewRenderProfile(workspace, context.userId, { viewId })),
    )

    server.registerTool(
        "replace_article_content",
        {
            title: "Replace article content",
            description: "Replace full article content with parser-safe serialization.",
            inputSchema: z.object({ viewId: z.string().min(1), content: z.string() }),
        },
        async ({ viewId, content }, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.replaceArticleContent(workspace, context.userId, viewId, content)),
    )

    server.registerTool(
        "insert_article_blocks",
        {
            title: "Insert article blocks",
            description: "Insert parsed markdown blocks into an article.",
            inputSchema: z.object({
                viewId: z.string().min(1),
                blockIndex: z.number().int().min(0).optional(),
                content: z.string(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.insertArticleBlocks(workspace, context.userId, input)),
    )

    server.registerTool(
        "replace_article_block",
        {
            title: "Replace article block",
            description: "Replace one article block by index.",
            inputSchema: z.object({ viewId: z.string().min(1), blockIndex: z.number().int().min(0), blockMarkdown: z.string() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.replaceArticleBlock(workspace, context.userId, input)),
    )

    server.registerTool(
        "remove_article_block",
        {
            title: "Remove article block",
            description: "Remove one article block.",
            inputSchema: z.object({ viewId: z.string().min(1), blockIndex: z.number().int().min(0) }),
        },
        async ({ viewId, blockIndex }, extra) =>
            withWorkspaceMutation(extra, (workspace, context) => workspaceOps.removeArticleBlock(workspace, context.userId, viewId, blockIndex)),
    )

    server.registerTool(
        "move_article_block",
        {
            title: "Move article block",
            description: "Move one article block to another index.",
            inputSchema: z.object({
                viewId: z.string().min(1),
                fromIndex: z.number().int().min(0),
                toIndex: z.number().int().min(0),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.moveArticleBlock(workspace, context.userId, input)),
    )

    server.registerTool(
        "patch_article_section",
        {
            title: "Patch article section",
            description: "Replace content under a heading.",
            inputSchema: z.object({
                viewId: z.string().min(1),
                headingId: z.string().optional(),
                headingText: z.string().optional(),
                sectionMarkdown: z.string(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.patchArticleSection(workspace, context.userId, input)),
    )

    server.registerTool(
        "apply_article_patch",
        {
            title: "Apply article patch",
            description: "Apply a sequence of article block edits.",
            inputSchema: z.object({
                viewId: z.string().min(1),
                operations: z.array(
                    z.discriminatedUnion("op", [
                        z.object({ op: z.literal("insert"), index: z.number().int().min(0).optional(), markdown: z.string() }),
                        z.object({ op: z.literal("replace"), index: z.number().int().min(0), markdown: z.string() }),
                        z.object({ op: z.literal("remove"), index: z.number().int().min(0) }),
                        z.object({ op: z.literal("move"), from: z.number().int().min(0), to: z.number().int().min(0) }),
                    ]),
                ),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.applyArticlePatch(workspace, context.userId, input)),
    )

    server.registerTool(
        "lint_article",
        {
            title: "Lint article",
            description: "Validate article parser/serializer and references.",
            inputSchema: z.object({ viewId: z.string().min(1) }),
        },
        async ({ viewId }, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.lintArticle(workspace, context.userId, viewId)),
    )

    server.registerTool(
        "validate_article_blocks",
        {
            title: "Validate article blocks",
            description: "Alias for lint_article.",
            inputSchema: z.object({ viewId: z.string().min(1) }),
        },
        async ({ viewId }, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.validateArticleBlocks(workspace, context.userId, viewId)),
    )

    server.registerTool(
        "upsert_visual_block",
        {
            title: "Upsert visual block",
            description: "Insert or replace a visual article block.",
            inputSchema: z.object({
                viewId: z.string().min(1),
                blockIndex: z.number().int().min(0).optional(),
                visualKind: visualBlockKindSchema,
                data: z.record(z.string(), z.unknown()),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.upsertVisualBlock(workspace, context.userId, input)),
    )

    server.registerTool(
        "remove_visual_block",
        {
            title: "Remove visual block",
            description: "Remove a visual article block by index.",
            inputSchema: z.object({ viewId: z.string().min(1), blockIndex: z.number().int().min(0) }),
        },
        async ({ viewId, blockIndex }, extra) =>
            withWorkspaceMutation(extra, (workspace, context) => workspaceOps.removeVisualBlock(workspace, context.userId, viewId, blockIndex)),
    )

    server.registerTool(
        "list_display_kinds",
        {
            title: "List display kinds",
            description: "List supported display component kinds and default payloads.",
            inputSchema: z.object({}),
        },
        async (_input, extra) => withWorkspace(extra, () => jsonResult(workspaceOps.listDisplayKinds())),
    )

    server.registerTool(
        "add_display_to_view",
        {
            title: "Add display to view",
            description: "Add a display component to a view.",
            inputSchema: z.object({
                viewId: z.string().min(1),
                kind: componentKindSchema,
                name: z.string().optional(),
                data: z.record(z.string(), z.unknown()).optional(),
                position: z.number().int().min(0).optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.addDisplayToView(workspace, context.userId, input)),
    )

    server.registerTool(
        "remove_display_from_view",
        {
            title: "Remove display from view",
            description: "Remove one display from a view.",
            inputSchema: z.object({ viewId: z.string().min(1), displayId: z.string().min(1) }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.removeDisplayFromView(workspace, context.userId, input)),
    )

    server.registerTool(
        "patch_display_data",
        {
            title: "Patch display data",
            description: "Patch a display record by replacing or updating a path.",
            inputSchema: z.object({
                viewId: z.string().min(1),
                displayId: z.string().min(1),
                path: z.string().optional(),
                data: z.record(z.string(), z.unknown()),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.patchDisplayData(workspace, context.userId, input)),
    )

    server.registerTool(
        "set_display_order",
        {
            title: "Set display order",
            description: "Reorder displays within a view by id.",
            inputSchema: z.object({ viewId: z.string().min(1), displayIds: z.array(z.string().min(1)) }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.setDisplayOrder(workspace, context.userId, input)),
    )

    server.registerTool(
        "search_workspace",
        {
            title: "Search workspace",
            description: "Search notebooks, pages, topics, views, and displays.",
            inputSchema: z.object({ query: z.string().min(1), kinds: z.array(viewKindSchema).optional() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.searchWorkspace(workspace, context.userId, input)),
    )

    server.registerTool(
        "analyze_workspace_gaps",
        {
            title: "Analyze workspace gaps",
            description: "Find content and structure gaps before agentic tasks.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includeHealthSummary: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.analyzeWorkspaceGaps(workspace, context.userId, input)),
    )

    server.registerTool(
        "search_semantic",
        {
            title: "Semantic search",
            description: "Find matches by token overlap and score across notebooks, pages, topics, views, and displays.",
            inputSchema: z.object({
                query: z.string().min(1),
                kinds: z.array(viewKindSchema).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.searchSemantic(workspace, context.userId, input)),
    )

    server.registerTool(
        "infer_component_type",
        {
            title: "Infer component type",
            description: "Infer likely visual component kind from provided data payload.",
            inputSchema: z.object({ data: z.unknown() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.inferComponentType(workspace, context.userId, input)),
    )

    server.registerTool(
        "import_data_block",
        {
            title: "Import data block",
            description: "Infer and insert a data component into a view.",
            inputSchema: z.object({
                viewId: z.string().min(1),
                data: z.unknown(),
                kind: componentKindSchema.optional(),
                includeInArticle: z.boolean().optional(),
                name: z.string().optional(),
                position: z.number().int().min(0).optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.importDataBlock(workspace, context.userId, input)),
    )

    server.registerTool(
        "workspace_health_check",
        {
            title: "Workspace health check",
            description: "Return consistency and integrity issues.",
            inputSchema: z.object({}),
        },
        async (_input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.workspaceHealthCheck(workspace, context.userId)),
    )

    server.registerTool(
        "publish_diagnose",
        {
            title: "Publish diagnose",
            description: "Evaluate publish-readiness blockers and warnings for one notebook.",
            inputSchema: z.object({ notebookId: z.string().min(1) }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.publishDiagnose(workspace, context.userId, input)),
    )

    server.registerTool(
        "validate_after_mutation",
        {
            title: "Validate after mutation",
            description: "Run post-mutation validation for notebook or view scope.",
            inputSchema: z.object({ notebookId: z.string().min(1).optional(), viewId: z.string().min(1).optional() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.validateAfterMutation(workspace, context.userId, input)),
    )

    server.registerTool(
        "batch_read_workspace",
        {
            title: "Batch read workspace",
            description: "Execute multiple safe read tool calls in one request.",
            inputSchema: z.object({
                operations: z.array(
                    z.object({
                        tool: z.string().min(1),
                        input: z.record(z.string(), z.unknown()).optional(),
                    }),
                ),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.batchReadWorkspace(workspace, context.userId, input)),
    )

    server.registerTool(
        "batch_mutate_workspace",
        {
            title: "Batch mutate workspace",
            description: "Execute multiple mutation operations in one request.",
            inputSchema: z.object({
                operations: z.array(
                    z.object({
                        tool: z.string().min(1),
                        input: z.record(z.string(), z.unknown()),
                    }),
                ),
                continueOnFailure: z.boolean().optional(),
                dryRun: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.batchMutateWorkspace(workspace, context.userId, input)),
    )

    server.registerTool(
        "analyze_orphaned_data",
        {
            title: "Analyze orphaned data",
            description: "List orphan pages, topics, and views.",
            inputSchema: z.object({}),
        },
        async (_input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.analyzeOrphanedData(workspace, context.userId)),
    )

    server.registerTool(
        "repair_workspace_consistency",
        {
            title: "Repair workspace consistency",
            description: "Normalize order and drop orphaned nested records.",
            inputSchema: z.object({}),
        },
        async (_input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.repairWorkspaceConsistency(workspace, context.userId)),
    )

    server.registerTool(
        "export_notebook",
        {
            title: "Export notebook",
            description: "Export notebook content as markdown or web HTML.",
            inputSchema: z.object({ notebookId: z.string().min(1), format: z.enum(["markdown", "web"]).optional() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.exportNotebook(workspace, context.userId, input)),
    )

    server.registerTool(
        "export_page",
        {
            title: "Export page",
            description: "Export page content as markdown or web HTML.",
            inputSchema: z.object({ pageId: z.string().min(1), format: z.enum(["markdown", "web"]).optional() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.exportPage(workspace, context.userId, input)),
    )

    server.registerTool(
        "export_view",
        {
            title: "Export view",
            description: "Export a single view as markdown or web HTML.",
            inputSchema: z.object({ viewId: z.string().min(1), format: z.enum(["markdown", "web"]).optional() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.exportView(workspace, context.userId, input)),
    )

    server.registerTool(
        "snapshot_workspace",
        {
            title: "Snapshot workspace",
            description: "Create a snapshot for rollback.",
            inputSchema: z.object({ name: z.string().min(1), note: z.string().optional() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.snapshotWorkspace(workspace, context.userId, input)),
    )

    server.registerTool(
        "list_workspace_snapshots",
        {
            title: "List workspace snapshots",
            description: "List available workspace snapshots.",
            inputSchema: z.object({}),
        },
        async (_input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.listWorkspaceSnapshots(workspace, context.userId)),
    )

    server.registerTool(
        "restore_workspace_snapshot",
        {
            title: "Restore workspace snapshot",
            description: "Restore a workspace snapshot by id.",
            inputSchema: z.object({ snapshotId: z.string().min(1) }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.restoreWorkspaceSnapshot(workspace, context.userId, input)),
    )

    server.registerTool(
        "publish_notebook",
        {
            title: "Publish notebook",
            description: "Publish a notebook.",
            inputSchema: z.object({ notebookId: z.string().min(1), publish: z.boolean() }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.publishNotebook(workspace, context.userId, input)),
    )

    server.registerTool(
        "unpublish_notebook",
        {
            title: "Unpublish notebook",
            description: "Unpublish a notebook.",
            inputSchema: z.object({ notebookId: z.string().min(1) }),
        },
        async ({ notebookId }, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.unpublishNotebook(workspace, context.userId, notebookId)),
    )

    server.registerTool(
        "set_notebook_metadata",
        {
            title: "Set notebook metadata",
            description: "Set notebook metadata and editor settings.",
            inputSchema: z.object({
                notebookId: z.string().min(1),
                title: z.string().optional(),
                summary: z.string().optional(),
                color: z.string().optional(),
                slug: z.string().optional(),
                editorSettings: z
                    .object({
                        blockInfo: blockInfoSchema.optional(),
                        contents: contentModeSchema.optional(),
                        mode: editorModeSchema.optional(),
                    })
                    .optional(),
            }),
        },
        async (input, extra) =>
            withWorkspaceMutation(extra, (workspace, context) => {
                const editorSettings = input.editorSettings
                    ? {
                          blockInfo: input.editorSettings.blockInfo ?? "show",
                          contents: input.editorSettings.contents ?? "show",
                          mode: input.editorSettings.mode ?? "editing",
                      }
                    : undefined

                return workspaceOps.setNotebookMetadata(workspace, context.userId, { ...input, editorSettings })
            }),
    )

    server.registerTool(
        "plan_agentic_workflow",
        {
            title: "Plan agentic workflow",
            description: "Generate a structured, optional precheck workflow for a notebook goal.",
            inputSchema: z.object({
                goal: z.string().min(1),
                notebookId: z.string().min(1),
                includePrechecks: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.planAgenticWorkflow(workspace, context.userId, input)),
    )

    server.registerTool(
        "execute_plan_with_guarantees",
        {
            title: "Execute plan with guarantees",
            description: "Execute a work plan with optional dry-run and rollback controls.",
            inputSchema: z.object({
                plan: z.array(
                    z.object({
                        tool: z.string().min(1),
                        input: z.record(z.string(), z.unknown()).optional(),
                    }),
                ),
                continueOnFailure: z.boolean().optional(),
                dryRun: z.boolean().optional(),
                maxSteps: z.number().int().min(1).optional(),
                rollbackOnFailure: z.boolean().optional(),
                notebookId: z.string().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.executePlanWithGuarantees(workspace, context.userId, input)),
    )

    server.registerTool(
        "task_suggest_and_execute",
        {
            title: "Task suggest and execute",
            description: "Suggest quick workspace tasks and optionally execute them.",
            inputSchema: z.object({
                goal: z.string().min(1),
                notebookId: z.string().min(1).optional(),
                execute: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.taskSuggestAndExecute(workspace, context.userId, input)),
    )

    server.registerTool(
        "diff_notebook_state",
        {
            title: "Diff notebook state",
            description: "Compare notebook counts and ids against an optional snapshot.",
            inputSchema: z.object({ notebookId: z.string().min(1), snapshotId: z.string().min(1).optional() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.diffNotebookState(workspace, context.userId, input)),
    )

    server.registerTool(
        "snapshot_compare",
        {
            title: "Snapshot compare",
            description: "Compare current notebook state against snapshot metadata.",
            inputSchema: z.object({ notebookId: z.string().min(1), snapshotId: z.string().min(1).optional() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.snapshotCompare(workspace, context.userId, input)),
    )

    server.registerTool(
        "find_duplicate_or_stale_content",
        {
            title: "Find duplicate or stale content",
            description: "Report duplicate titles/content and stale or orphaned views.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includeEmptyViews: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.findDuplicateOrStaleContent(workspace, context.userId, input)),
    )

    server.registerTool(
        "repair_workspace",
        {
            title: "Repair workspace",
            description: "Repair workspace consistency and return repaired structure.",
            inputSchema: z.object({}),
        },
        async (_input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.repairWorkspace(workspace, context.userId)),
    )

    server.registerTool(
        "export_publish_bundle",
        {
            title: "Export publish bundle",
            description: "Build markdown/web/json bundle useful for publishing or publishing preview.",
            inputSchema: z.object({
                notebookId: z.string().min(1),
                includeHtml: z.boolean().optional(),
                includeJson: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.exportPublishBundle(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_observe_workspace",
        {
            title: "Agentic observe workspace",
            description: "Gather workspace health, drift, orphan, and policy signals for decisioning.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includePolicy: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticObserveWorkspace(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_intent_to_plan",
        {
            title: "Agentic intent to plan",
            description: "Translate goal intent into an initial execution plan.",
            inputSchema: z.object({
                goal: z.string().min(1),
                notebookId: z.string().min(1).optional(),
                includePrechecks: z.boolean().optional(),
                maxSteps: z.number().int().min(1).optional(),
                constraints: z.array(z.string().min(1)).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticIntentToPlan(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_plan_dryrun",
        {
            title: "Agentic plan dry-run",
            description: "Run a change simulation with change-set summary.",
            inputSchema: z.object({
                plan: z.array(z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()) })),
                notebookId: z.string().min(1).optional(),
                maxSteps: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticPlanDryRun(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_plan_guardrail",
        {
            title: "Agentic plan guardrail",
            description: "Evaluate risk of a plan and return approved/rejected steps.",
            inputSchema: z.object({
                plan: z.array(z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()) })),
                maxRisk: z.enum(["low", "medium", "high"]).optional(),
                notebookId: z.string().min(1).optional(),
                runValidation: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticPlanGuardrail(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_execute_with_sla",
        {
            title: "Agentic execute with SLA",
            description: "Execute a plan with optional SLA limits and rollback behavior.",
            inputSchema: z.object({
                plan: z.array(z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()) })),
                notebookId: z.string().min(1).optional(),
                continueOnFailure: z.boolean().optional(),
                dryRun: z.boolean().optional(),
                maxSteps: z.number().int().min(1).optional(),
                rollbackOnFailure: z.boolean().optional(),
                slaMs: z.number().int().min(1).optional(),
                maxBlockers: z.number().int().min(0).optional(),
                maxWarnings: z.number().int().min(0).optional(),
                rollbackOnSlaFailure: z.boolean().optional(),
                checkpointLabel: z.string().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticExecuteWithSla(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_auto_repair",
        {
            title: "Agentic auto repair",
            description: "Run a safe repair sequence for a targeted workspace.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includeDrift: z.boolean().optional(),
                dryRun: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticAutoRepair(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_suggest_restructure",
        {
            title: "Agentic suggest restructure",
            description: "Generate structure optimization suggestions for a notebook.",
            inputSchema: z.object({
                notebookId: z.string().min(1),
                maxSuggestions: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticSuggestRestructure(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_reference_rewrite",
        {
            title: "Agentic reference rewrite",
            description: "Review unresolved references and apply suggested rewrites.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includeDisplayUrls: z.boolean().optional(),
                applyFixes: z.boolean().optional(),
                dryRun: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticReferenceRewrite(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_component_pipeline",
        {
            title: "Agentic component pipeline",
            description: "Propose and optionally apply component/layout migration steps.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                apply: z.boolean().optional(),
                maxSteps: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticComponentPipeline(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_change_set",
        {
            title: "Agentic change set",
            description: "Preview entity deltas before applying a change plan.",
            inputSchema: z.object({
                plan: z.array(z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()) })),
                notebookId: z.string().min(1).optional(),
                maxSteps: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticChangeSet(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_contract_enforcer",
        {
            title: "Agentic contract enforcer",
            description: "Evaluate contract constraints and optionally fix recoverable issues.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includePolicy: z.boolean().optional(),
                autoFix: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticContractEnforcer(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_tool_selector",
        {
            title: "Agentic tool selector",
            description: "Recommend best tools for a goal or prompt.",
            inputSchema: z.object({
                goal: z.string().min(1),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticToolSelector(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_observation_query",
        {
            title: "Agentic observation query",
            description: "Read selected agentic observations by status, goal text, or count.",
            inputSchema: z.object({
                status: z.enum(["ok", "warning", "failed"]).optional(),
                goal: z.string().optional(),
                maxItems: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticObservationQuery(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_workflow_job",
        {
            title: "Agentic workflow job",
            description: "Create or execute a prepared agentic workflow job.",
            inputSchema: z
                .object({
                    goal: z.string().optional(),
                    notebookId: z.string().min(1).optional(),
                    plan: z
                        .array(
                            z.object({
                                tool: z.string().min(1),
                                input: z.record(z.string(), z.unknown()),
                            }),
                        )
                        .optional(),
                    execute: z.boolean().optional(),
                    dryRun: z.boolean().optional(),
                    continueOnFailure: z.boolean().optional(),
                    maxSteps: z.number().int().min(1).optional(),
                    runPrechecks: z.boolean().optional(),
                    rollbackOnFailure: z.boolean().optional(),
                })
                .refine(input => Boolean(input.goal) || Boolean(input.plan?.length), { message: "A goal or plan is required." }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticWorkflowJob(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_workflow_status",
        {
            title: "Agentic workflow status",
            description: "Inspect workflow job progress and latest status.",
            inputSchema: z.object({
                jobId: z.string().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticWorkflowStatus(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_workflow_cancel",
        {
            title: "Agentic workflow cancel",
            description: "Cancel a running agentic workflow job.",
            inputSchema: z.object({
                jobId: z.string().min(1),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticWorkflowCancel(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_preflight_gate",
        {
            title: "Agentic preflight gate",
            description: "Run workspace and plan guardrail checks before mutation.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                plan: z.array(
                    z.object({
                        tool: z.string().min(1),
                        input: z.record(z.string(), z.unknown()),
                    }),
                ),
                maxRisk: riskLevelSchema.optional(),
                includePolicy: z.boolean().optional(),
                includePublishReadiness: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticPreflightGate(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_plan_optimizer",
        {
            title: "Agentic plan optimizer",
            description: "Remove redundant or unsupported plan operations and return an optimized plan.",
            inputSchema: z.object({
                plan: z.array(
                    z.object({
                        tool: z.string().min(1),
                        input: z.record(z.string(), z.unknown()),
                    }),
                ),
                maxSteps: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticPlanOptimizer(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_plan_reconciler",
        {
            title: "Agentic plan reconciler",
            description: "Reconcile stale ids in a prepared plan to current workspace ids.",
            inputSchema: z.object({
                plan: z.array(
                    z.object({
                        tool: z.string().min(1),
                        input: z.record(z.string(), z.unknown()),
                    }),
                ),
                notebookId: z.string().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticPlanReconciler(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_goal_expander",
        {
            title: "Agentic goal expander",
            description: "Expand a goal into likely sub-goals and required agent tools.",
            inputSchema: z.object({
                goal: z.string().min(1),
                notebookId: z.string().min(1).optional(),
                maxSubgoals: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticGoalExpander(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_impact_scoper",
        {
            title: "Agentic impact scoper",
            description: "Estimate scope and risk for each planned mutation.",
            inputSchema: z.object({
                plan: z.array(
                    z.object({
                        tool: z.string().min(1),
                        input: z.record(z.string(), z.unknown()),
                    }),
                ),
                notebookId: z.string().min(1).optional(),
                maxSteps: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticImpactScoper(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_multi_notebook_batch",
        {
            title: "Agentic multi notebook batch",
            description: "Execute or preview plans across many notebooks in one request.",
            inputSchema: z.object({
                batches: z.array(
                    z.object({
                        notebookId: z.string().min(1),
                        plan: z.array(
                            z.object({
                                tool: z.string().min(1),
                                input: z.record(z.string(), z.unknown()),
                            }),
                        ),
                        maxSteps: z.number().int().min(1).optional(),
                    }),
                ),
                execute: z.boolean().optional(),
                continueOnFailure: z.boolean().optional(),
                dryRun: z.boolean().optional(),
                rollbackOnFailure: z.boolean().optional(),
            }),
        },
        async (input, extra) => {
            if (input.execute || input.dryRun) return withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticMultiNotebookBatch(workspace, context.userId, input))

            return withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticMultiNotebookBatch(workspace, context.userId, input))
        },
    )

    server.registerTool(
        "agentic_policy_set",
        {
            title: "Agentic policy set",
            description: "List, validate, or run policy checks against workspace rules.",
            inputSchema: z.object({
                action: z.enum(["list", "validate", "apply"]),
                notebookId: z.string().min(1).optional(),
                policyRules: z
                    .array(
                        z.object({
                            id: z.string().min(1),
                            name: z.string().optional(),
                            severity: z.enum(["low", "medium", "high"]),
                            check: policyCheckSchema,
                        }),
                    )
                    .optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticPolicySet(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_publish_readiness_gate",
        {
            title: "Agentic publish readiness gate",
            description: "Run publish readiness + contract checks and return blockers.",
            inputSchema: z.object({
                notebookIds: z.array(z.string().min(1)).optional(),
                includeRecoveryPlan: z.boolean().optional(),
                includePolicy: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticPublishReadinessGate(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_structured_ingest_from_text",
        {
            title: "Agentic structured ingest from text",
            description: "Parse text into section/topic/view structure and optionally apply changes.",
            inputSchema: z.object({
                text: z.string().min(1),
                notebookId: z.string().min(1).optional(),
                notebookTitle: z.string().min(1).optional(),
                pageId: z.string().min(1).optional(),
                pageTitle: z.string().min(1).optional(),
                topicMode: viewModeSchema.optional(),
                maxSections: z.number().int().min(1).optional(),
                maxViewsPerSection: z.number().int().min(1).optional(),
                apply: z.boolean().optional(),
                dryRun: z.boolean().optional(),
            }),
        },
        async (input, extra) => {
            const apply = input.apply ?? false
            if (apply) return withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticStructuredIngestFromText(workspace, context.userId, input))

            return withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticStructuredIngestFromText(workspace, context.userId, input))
        },
    )

    server.registerTool(
        "agentic_component_compatibility_check",
        {
            title: "Agentic component compatibility check",
            description: "Validate data payload compatibility against target component types.",
            inputSchema: z.object({
                data: z.unknown().optional(),
                viewId: z.string().min(1).optional(),
                componentKind: componentKindSchema.optional(),
                strict: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticComponentCompatibilityCheck(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_drift_scheduler",
        {
            title: "Agentic drift scheduler",
            description: "Build a drift and duplicate-repair schedule suggestion.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                staleAfterDays: z.number().int().min(1).optional(),
                includeAutoPlan: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticDriftScheduler(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_change_set_renderer",
        {
            title: "Agentic change set renderer",
            description: "Render a readable summary for a planned change set.",
            inputSchema: z.object({
                plan: z.array(
                    z.object({
                        tool: z.string().min(1),
                        input: z.record(z.string(), z.unknown()),
                    }),
                ),
                notebookId: z.string().min(1).optional(),
                maxSteps: z.number().int().min(1).optional(),
                includeNarrative: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticChangeSetRenderer(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_tool_feedback",
        {
            title: "Agentic tool feedback",
            description: "Record workflow execution outcome and blockers for future tooling context.",
            inputSchema: z.object({
                goal: z.string().min(1),
                status: z.enum(["ok", "warning", "failed"]),
                plan: z.array(
                    z.object({
                        tool: z.string().min(1),
                        input: z.record(z.string(), z.unknown()),
                    }),
                ),
                summary: z.string().min(1),
                blockers: z.array(z.string().min(1)).optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticToolFeedback(workspace, context.userId, input)),
    )

    server.registerTool(
        "list_mcp_tool_capabilities",
        {
            title: "List MCP tool capabilities",
            description: "List tools exposed by Visual Note MCP server.",
            inputSchema: z.object({}),
        },
        async (_input, extra) => withWorkspace(extra, () => jsonResult(workspaceOps.listMcpToolCapabilities())),
    )

    server.registerTool(
        "describe_mcp_tool",
        {
            title: "Describe MCP tool",
            description: "Describe a single MCP tool by name.",
            inputSchema: z.object({ toolName: z.string().min(1) }),
        },
        async ({ toolName }, extra) => withWorkspace(extra, () => operationResult(workspaceOps.describeMcpTool(toolName))),
    )
}
