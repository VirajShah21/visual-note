import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { viewModeSchema, withWorkspaceMutation, withWorkspaceReadResult, workspaceOps } from "./visual-note-server-core"

export const registerVisualNoteMcpToolsPart2 = (server: McpServer) => {
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
}
