import { componentKindSchema, jsonResult, viewKindSchema, visualBlockKindSchema, withWorkspace } from "./visual-note-server-core"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { withWorkspaceMutation, withWorkspaceReadResult, workspaceOps } from "./visual-note-server-core"

export const registerVisualNoteMcpToolsPart3 = (server: McpServer) => {
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
}
