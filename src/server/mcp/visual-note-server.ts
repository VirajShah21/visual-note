import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js"
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { normalizeWorkspace } from "@/lib/visual-note/factories"
import { visualBlockKinds } from "@/lib/visual-note/visual-blocks"
import { loadWorkspaceForUser, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import {
    createArticle,
    listNotebooks,
    readArticle,
    readNotebookTree,
    removeVisualBlock,
    replaceArticleContent,
    upsertVisualBlock,
    type WorkspaceOperationResult,
} from "@/server/visual-note/workspace-operations"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

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

const withWorkspaceMutation = async <T>(
    extra: ToolExtra,
    action: (workspace: VisualNoteWorkspace, context: RequestContext) => Promise<WorkspaceOperationResult<T>> | WorkspaceOperationResult<T>,
) =>
    (async () => {
        const context = requestContextFrom(extra.authInfo)
        if (!context) return jsonResult({ ok: false, error: "auth_required", message: "Authentication required." })

        const loaded = await loadWorkspace(context)
        const result = await action(loaded.workspace, context)
        if (!result.ok) return jsonResult(result)

        const value = result.value as T & { workspace?: VisualNoteWorkspace }
        if (!value.workspace) return jsonResult({ ok: false, error: "invalid_input", message: "Mutation did not return a workspace." })

        const publicValue = { ...value }
        delete publicValue.workspace
        await saveWorkspaceForUser(loaded.supabase, context.userId, value.workspace)
        return jsonResult({ ok: true, ...publicValue })
    })()

export const registerVisualNoteMcpTools = (server: McpServer) => {
    server.registerTool("list_notebooks", { title: "List notebooks", description: "List Visual Note notebooks owned by the authenticated user." }, async extra =>
        withWorkspace(extra, workspace => jsonResult({ ok: true, notebooks: listNotebooks(workspace, requestContextFrom(extra.authInfo)?.userId ?? "") })),
    )

    server.registerTool(
        "read_notebook",
        {
            title: "Read notebook",
            description: "Read one notebook as an ordered page, topic, and view tree.",
            inputSchema: { notebookId: z.string().min(1) },
        },
        async ({ notebookId }, extra) => withWorkspace(extra, (workspace, context) => operationResult(readNotebookTree(workspace, context.userId, notebookId))),
    )

    server.registerTool(
        "read_article",
        {
            title: "Read article",
            description: "Read one article view with parsed article blocks and visual block summaries.",
            inputSchema: { viewId: z.string().min(1) },
        },
        async ({ viewId }, extra) => withWorkspace(extra, (workspace, context) => operationResult(readArticle(workspace, context.userId, viewId))),
    )

    server.registerTool(
        "replace_article_content",
        {
            title: "Replace article content",
            description: "Replace article markdown content after parsing and serializing it through the structured article model.",
            inputSchema: { viewId: z.string().min(1), content: z.string() },
        },
        async ({ viewId, content }, extra) => withWorkspaceMutation(extra, (workspace, context) => replaceArticleContent(workspace, context.userId, viewId, content)),
    )

    server.registerTool(
        "create_article",
        {
            title: "Create article",
            description: "Create or reuse a page and topic path, then create or reuse an article view.",
            inputSchema: {
                notebookId: z.string().min(1),
                pageTitle: z.string().min(1),
                topicTitle: z.string().min(1),
                articleTitle: z.string().optional(),
                content: z.string().optional(),
            },
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => createArticle(workspace, context.userId, input)),
    )

    server.registerTool(
        "upsert_visual_block",
        {
            title: "Upsert visual block",
            description: "Insert or replace a fenced visual article block.",
            inputSchema: {
                viewId: z.string().min(1),
                blockIndex: z.number().int().min(0).optional(),
                visualKind: visualBlockKindSchema,
                data: z.record(z.string(), z.unknown()).default({}),
            },
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => upsertVisualBlock(workspace, context.userId, input)),
    )

    server.registerTool(
        "remove_visual_block",
        {
            title: "Remove visual block",
            description: "Remove a visual article block at a parsed article block index.",
            inputSchema: { viewId: z.string().min(1), blockIndex: z.number().int().min(0) },
        },
        async ({ viewId, blockIndex }, extra) => withWorkspaceMutation(extra, (workspace, context) => removeVisualBlock(workspace, context.userId, viewId, blockIndex)),
    )
}
