import { withWorkspaceMutation } from "./visual-note-server-core"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
    jsonResult,
    resolveNotebookInput,
    resolvePageInput,
    resolveTopicInput,
    resolveViewInput,
    withWorkspace,
    withWorkspaceReadResult,
    workspaceOps,
} from "./visual-note-server-core"

export const registerVisualNoteMcpToolsPart1 = (server: McpServer) => {
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
}
