import { operationResult, visualBlockKindSchema, withWorkspace, withWorkspaceMutation, withWorkspaceReadResult, z } from "./visual-note-server-core"
import type { ToolExtra } from "./visual-note-server-core"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import {
    createArticle,
    createNotebook,
    listNotebooks,
    readArticle,
    readNotebookTree,
    removeVisualBlock,
    replaceArticleContent,
    upsertVisualBlock,
} from "@/server/visual-note/workspace-operations"

type VisualNoteToolName =
    | "list_notebooks"
    | "read_notebook"
    | "create_notebook"
    | "create_article"
    | "read_article"
    | "replace_article_content"
    | "upsert_visual_block"
    | "remove_visual_block"

type VisualNoteToolDefinition = {
    name: VisualNoteToolName
    title: string
    description: string
    inputSchema: z.ZodObject
    handler: (input: Record<string, unknown>, extra: ToolExtra) => Promise<CallToolResult>
}

export const visualNoteCoreToolNames = [
    "list_notebooks",
    "read_notebook",
    "create_notebook",
    "create_article",
    "read_article",
    "replace_article_content",
    "upsert_visual_block",
    "remove_visual_block",
] as const satisfies readonly VisualNoteToolName[]

export const visualNoteToolDefinitions: VisualNoteToolDefinition[] = [
    {
        name: "list_notebooks",
        title: "List notebooks",
        description: "List notebooks owned by the authenticated user.",
        inputSchema: z.object({}),
        handler: async (_input, extra) =>
            withWorkspace(extra, (workspace, context) =>
                operationResult({
                    ok: true,
                    value: { notebooks: listNotebooks(workspace, context.userId) },
                }),
            ),
    },
    {
        name: "read_notebook",
        title: "Read notebook",
        description: "Read a notebook with its ordered page, topic, and view tree.",
        inputSchema: z.object({ notebookId: z.string().min(1) }),
        handler: async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => readNotebookTree(workspace, context.userId, String(input.notebookId))),
    },
    {
        name: "create_article",
        title: "Create article",
        description: "Create or reuse a notebook page-topic path and set article content.",
        inputSchema: z.object({
            notebookId: z.string().min(1),
            pageTitle: z.string().min(1),
            topicTitle: z.string().min(1),
            articleTitle: z.string().optional(),
            content: z.string().optional(),
            mode: z.enum(["article", "structured", "dashboard"]).optional(),
        }),
        handler: async (input, extra) =>
            withWorkspaceMutation(extra, (workspace, context) =>
                createArticle(workspace, context.userId, {
                    notebookId: String(input.notebookId),
                    pageTitle: String(input.pageTitle),
                    topicTitle: String(input.topicTitle),
                    articleTitle: typeof input.articleTitle === "string" ? input.articleTitle : undefined,
                    content: typeof input.content === "string" ? input.content : undefined,
                    mode: input.mode === "structured" || input.mode === "dashboard" ? input.mode : "article",
                }),
            ),
    },
    {
        name: "create_notebook",
        title: "Create notebook",
        description: "Create a new notebook for the authenticated user.",
        inputSchema: z.object({
            title: z.string().min(1),
            summary: z.string().optional(),
            color: z.string().optional(),
            slug: z.string().optional(),
        }),
        handler: async (input, extra) =>
            withWorkspaceMutation(extra, (workspace, context) =>
                createNotebook(workspace, context.userId, {
                    title: String(input.title),
                    summary: typeof input.summary === "string" ? input.summary : undefined,
                    color: typeof input.color === "string" ? input.color : undefined,
                    slug: typeof input.slug === "string" ? input.slug : undefined,
                }),
            ),
    },
    {
        name: "read_article",
        title: "Read article",
        description: "Read an article view with parsed block metadata.",
        inputSchema: z.object({ viewId: z.string().min(1) }),
        handler: async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => readArticle(workspace, context.userId, String(input.viewId))),
    },
    {
        name: "replace_article_content",
        title: "Replace article content",
        description: "Replace full article content with parser-safe serialization.",
        inputSchema: z.object({ viewId: z.string().min(1), content: z.string() }),
        handler: async (input, extra) =>
            withWorkspaceMutation(extra, (workspace, context) => replaceArticleContent(workspace, context.userId, String(input.viewId), String(input.content))),
    },
    {
        name: "upsert_visual_block",
        title: "Upsert visual block",
        description: "Insert or replace a visual article block.",
        inputSchema: z.object({
            viewId: z.string().min(1),
            blockIndex: z.number().int().min(0).optional(),
            visualKind: visualBlockKindSchema,
            data: z.record(z.string(), z.unknown()),
        }),
        handler: async (input, extra) =>
            withWorkspaceMutation(extra, (workspace, context) =>
                upsertVisualBlock(workspace, context.userId, {
                    viewId: String(input.viewId),
                    blockIndex: typeof input.blockIndex === "number" ? input.blockIndex : undefined,
                    visualKind: input.visualKind as Parameters<typeof upsertVisualBlock>[2]["visualKind"],
                    data: input.data as Parameters<typeof upsertVisualBlock>[2]["data"],
                }),
            ),
    },
    {
        name: "remove_visual_block",
        title: "Remove visual block",
        description: "Remove a visual article block by index.",
        inputSchema: z.object({ viewId: z.string().min(1), blockIndex: z.number().int().min(0) }),
        handler: async (input, extra) =>
            withWorkspaceMutation(extra, (workspace, context) => removeVisualBlock(workspace, context.userId, String(input.viewId), Number(input.blockIndex))),
    },
]

export const registerVisualNoteCoreTools = (server: McpServer) => {
    for (const tool of visualNoteToolDefinitions)
        server.registerTool(
            tool.name,
            {
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema,
            },
            tool.handler,
        )
}
