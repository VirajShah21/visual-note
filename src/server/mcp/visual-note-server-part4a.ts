import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { componentKindSchema, withWorkspaceMutation, withWorkspaceReadResult, workspaceOps, viewKindSchema } from "./visual-note-server-core"

export const registerVisualNoteMcpToolsPart4a = (server: McpServer) => {
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
}
