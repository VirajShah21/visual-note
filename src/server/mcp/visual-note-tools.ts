import { operationResult, visualBlockKindSchema, withWorkspace, withWorkspaceMutation, withWorkspaceReadResult, z, type ToolScopeRequirement } from "./visual-note-server-core"
import type { ToolExtra } from "./visual-note-server-core"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { mcpScopeRead, mcpScopeWrite } from "./token-store"
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

export type VisualNoteToolName =
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
    requiredScopes: ToolScopeRequirement
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

const toolRequirements = {
    list_notebooks: { toolName: "list_notebooks", requiredScopes: [mcpScopeRead] },
    read_notebook: { toolName: "read_notebook", requiredScopes: [mcpScopeRead] },
    read_article: { toolName: "read_article", requiredScopes: [mcpScopeRead] },
    create_notebook: { toolName: "create_notebook", requiredScopes: [mcpScopeWrite] },
    create_article: { toolName: "create_article", requiredScopes: [mcpScopeRead, mcpScopeWrite] },
    replace_article_content: { toolName: "replace_article_content", requiredScopes: [mcpScopeRead, mcpScopeWrite] },
    upsert_visual_block: { toolName: "upsert_visual_block", requiredScopes: [mcpScopeRead, mcpScopeWrite] },
    remove_visual_block: { toolName: "remove_visual_block", requiredScopes: [mcpScopeRead, mcpScopeWrite] },
} as const

export const visualNoteToolDefinitions: VisualNoteToolDefinition[] = [
    {
        name: "list_notebooks",
        title: "List notebooks",
        description: "List notebooks owned by the authenticated user.",
        requiredScopes: toolRequirements.list_notebooks,
        inputSchema: z.object({}),
        handler: async (_input, extra) =>
            withWorkspace(
                extra,
                (workspace, context) =>
                    operationResult({
                        ok: true,
                        value: { notebooks: listNotebooks(workspace, context.userId) },
                    }),
                toolRequirements.list_notebooks,
            ),
    },
    {
        name: "read_notebook",
        title: "Read notebook",
        description: "Read a notebook with its ordered page, topic, and view tree.",
        requiredScopes: toolRequirements.read_notebook,
        inputSchema: z.object({ notebookId: z.string().min(1) }),
        handler: async (input, extra) =>
            withWorkspaceReadResult(extra, (workspace, context) => readNotebookTree(workspace, context.userId, String(input.notebookId)), toolRequirements.read_notebook),
    },
    {
        name: "create_notebook",
        title: "Create notebook",
        description: "Create a new notebook for the authenticated user.",
        requiredScopes: toolRequirements.create_notebook,
        inputSchema: z.object({
            title: z.string().min(1),
            summary: z.string().optional(),
            color: z.string().optional(),
            slug: z.string().optional(),
        }),
        handler: async (input, extra) =>
            withWorkspaceMutation(
                extra,
                (workspace, context) =>
                    createNotebook(workspace, context.userId, {
                        title: String(input.title),
                        summary: typeof input.summary === "string" ? input.summary : undefined,
                        color: typeof input.color === "string" ? input.color : undefined,
                        slug: typeof input.slug === "string" ? input.slug : undefined,
                    }),
                toolRequirements.create_notebook,
            ),
    },
    {
        name: "create_article",
        title: "Create article",
        description: "Create or reuse a notebook page-topic path and set article content.",
        requiredScopes: toolRequirements.create_article,
        inputSchema: z.object({
            notebookId: z.string().min(1),
            pageTitle: z.string().min(1),
            topicTitle: z.string().min(1),
            articleTitle: z.string().optional(),
            content: z.string().optional(),
            mode: z.enum(["article", "structured", "dashboard"]).optional(),
        }),
        handler: async (input, extra) =>
            withWorkspaceMutation(
                extra,
                (workspace, context) =>
                    createArticle(workspace, context.userId, {
                        notebookId: String(input.notebookId),
                        pageTitle: String(input.pageTitle),
                        topicTitle: String(input.topicTitle),
                        articleTitle: typeof input.articleTitle === "string" ? input.articleTitle : undefined,
                        content: typeof input.content === "string" ? input.content : undefined,
                        mode: input.mode === "structured" || input.mode === "dashboard" ? input.mode : "article",
                    }),
                toolRequirements.create_article,
            ),
    },
    {
        name: "read_article",
        title: "Read article",
        description: "Read an article view with parsed block metadata.",
        requiredScopes: toolRequirements.read_article,
        inputSchema: z.object({ viewId: z.string().min(1) }),
        handler: async (input, extra) =>
            withWorkspaceReadResult(extra, (workspace, context) => readArticle(workspace, context.userId, String(input.viewId)), toolRequirements.read_article),
    },
    {
        name: "replace_article_content",
        title: "Replace article content",
        description: "Replace full article content with parser-safe serialization.",
        requiredScopes: toolRequirements.replace_article_content,
        inputSchema: z.object({ viewId: z.string().min(1), content: z.string() }),
        handler: async (input, extra) =>
            withWorkspaceMutation(
                extra,
                (workspace, context) => replaceArticleContent(workspace, context.userId, String(input.viewId), String(input.content)),
                toolRequirements.replace_article_content,
            ),
    },
    {
        name: "upsert_visual_block",
        title: "Upsert visual block",
        description: "Insert or replace a visual article block.",
        requiredScopes: toolRequirements.upsert_visual_block,
        inputSchema: z.object({
            viewId: z.string().min(1),
            blockIndex: z.number().int().min(0).optional(),
            visualKind: visualBlockKindSchema,
            data: z.record(z.string(), z.unknown()),
        }),
        handler: async (input, extra) =>
            withWorkspaceMutation(
                extra,
                (workspace, context) =>
                    upsertVisualBlock(workspace, context.userId, {
                        viewId: String(input.viewId),
                        blockIndex: typeof input.blockIndex === "number" ? input.blockIndex : undefined,
                        visualKind: input.visualKind as Parameters<typeof upsertVisualBlock>[2]["visualKind"],
                        data: input.data as Parameters<typeof upsertVisualBlock>[2]["data"],
                    }),
                toolRequirements.upsert_visual_block,
            ),
    },
    {
        name: "remove_visual_block",
        title: "Remove visual block",
        description: "Remove a visual article block by index.",
        requiredScopes: toolRequirements.remove_visual_block,
        inputSchema: z.object({ viewId: z.string().min(1), blockIndex: z.number().int().min(0) }),
        handler: async (input, extra) =>
            withWorkspaceMutation(
                extra,
                (workspace, context) => removeVisualBlock(workspace, context.userId, String(input.viewId), Number(input.blockIndex)),
                toolRequirements.remove_visual_block,
            ),
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
