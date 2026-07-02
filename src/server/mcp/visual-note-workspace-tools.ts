import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { ToolExtra, ToolScopeRequirement } from "./visual-note-server-core"
import { withWorkspaceMutation, withWorkspaceReadResult, z } from "./visual-note-server-core"
import { mcpScopeRead, mcpScopeWrite } from "./token-store"
import {
    exportPublishBundle,
    listWorkspaceSnapshots,
    publishNotebook,
    repairWorkspaceConsistency,
    restoreWorkspaceSnapshot,
    snapshotWorkspace,
    unpublishNotebook,
    workspaceHealthCheck,
} from "@/server/visual-note/workspace-operations"

export type VisualNoteWorkspaceToolName =
    | "workspace_health_check"
    | "repair_workspace_consistency"
    | "publish_notebook"
    | "unpublish_notebook"
    | "export_publish_bundle"
    | "create_workspace_snapshot"
    | "list_workspace_snapshots"
    | "restore_workspace_snapshot"

export type VisualNoteWorkspaceToolDefinition = {
    name: VisualNoteWorkspaceToolName
    title: string
    description: string
    requiredScopes: ToolScopeRequirement
    inputSchema: z.ZodObject
    handler: (input: Record<string, unknown>, extra: ToolExtra) => Promise<CallToolResult>
}

export const visualNoteWorkspaceToolNames = [
    "workspace_health_check",
    "repair_workspace_consistency",
    "publish_notebook",
    "unpublish_notebook",
    "export_publish_bundle",
    "create_workspace_snapshot",
    "list_workspace_snapshots",
    "restore_workspace_snapshot",
] as const satisfies readonly VisualNoteWorkspaceToolName[]

const toolRequirements = {
    workspace_health_check: { toolName: "workspace_health_check", requiredScopes: [mcpScopeRead] },
    repair_workspace_consistency: { toolName: "repair_workspace_consistency", requiredScopes: [mcpScopeRead, mcpScopeWrite] },
    publish_notebook: { toolName: "publish_notebook", requiredScopes: [mcpScopeRead, mcpScopeWrite] },
    unpublish_notebook: { toolName: "unpublish_notebook", requiredScopes: [mcpScopeRead, mcpScopeWrite] },
    export_publish_bundle: { toolName: "export_publish_bundle", requiredScopes: [mcpScopeRead] },
    create_workspace_snapshot: { toolName: "create_workspace_snapshot", requiredScopes: [mcpScopeRead, mcpScopeWrite] },
    list_workspace_snapshots: { toolName: "list_workspace_snapshots", requiredScopes: [mcpScopeRead] },
    restore_workspace_snapshot: { toolName: "restore_workspace_snapshot", requiredScopes: [mcpScopeRead, mcpScopeWrite] },
} as const

export const visualNoteWorkspaceToolDefinitions: VisualNoteWorkspaceToolDefinition[] = [
    {
        name: "workspace_health_check",
        title: "Workspace health check",
        description: "Analyze workspace structure for orphaned or non-normalized notebook data.",
        requiredScopes: toolRequirements.workspace_health_check,
        inputSchema: z.object({}),
        handler: async (_input, extra) =>
            withWorkspaceReadResult(extra, (workspace, context) => workspaceHealthCheck(workspace, context.userId), toolRequirements.workspace_health_check),
    },
    {
        name: "repair_workspace_consistency",
        title: "Repair workspace consistency",
        description: "Remove orphaned pages, topics, and views and normalize item positions.",
        requiredScopes: toolRequirements.repair_workspace_consistency,
        inputSchema: z.object({}),
        handler: async (_input, extra) =>
            withWorkspaceMutation(
                extra,
                (workspace, context) => {
                    const result = repairWorkspaceConsistency(workspace, context.userId)
                    if (!result.ok) return result

                    return {
                        ok: true,
                        value: {
                            ...result.value,
                            workspace: result.value.repairedWorkspace ?? workspace,
                        },
                    }
                },
                toolRequirements.repair_workspace_consistency,
            ),
    },
    {
        name: "publish_notebook",
        title: "Publish notebook",
        description: "Mark a notebook as published with a fresh publish timestamp.",
        requiredScopes: toolRequirements.publish_notebook,
        inputSchema: z.object({ notebookId: z.string().min(1) }),
        handler: async (input, extra) =>
            withWorkspaceMutation(
                extra,
                (workspace, context) => publishNotebook(workspace, context.userId, { notebookId: String(input.notebookId), publish: true }),
                toolRequirements.publish_notebook,
            ),
    },
    {
        name: "unpublish_notebook",
        title: "Unpublish notebook",
        description: "Remove the published state from a notebook.",
        requiredScopes: toolRequirements.unpublish_notebook,
        inputSchema: z.object({ notebookId: z.string().min(1) }),
        handler: async (input, extra) =>
            withWorkspaceMutation(extra, (workspace, context) => unpublishNotebook(workspace, context.userId, String(input.notebookId)), toolRequirements.unpublish_notebook),
    },
    {
        name: "export_publish_bundle",
        title: "Export publish bundle",
        description: "Create a publish-ready markdown, optional HTML, and optional JSON bundle for a notebook.",
        requiredScopes: toolRequirements.export_publish_bundle,
        inputSchema: z.object({
            notebookId: z.string().min(1),
            includeHtml: z.boolean().optional(),
            includeJson: z.boolean().optional(),
        }),
        handler: async (input, extra) =>
            withWorkspaceReadResult(
                extra,
                (workspace, context) =>
                    exportPublishBundle(workspace, context.userId, {
                        notebookId: String(input.notebookId),
                        includeHtml: input.includeHtml === true,
                        includeJson: input.includeJson === true,
                    }),
                toolRequirements.export_publish_bundle,
            ),
    },
    {
        name: "create_workspace_snapshot",
        title: "Create workspace snapshot",
        description: "Capture a named workspace snapshot before publish or repair workflows.",
        requiredScopes: toolRequirements.create_workspace_snapshot,
        inputSchema: z.object({
            name: z.string().min(1),
            note: z.string().optional(),
        }),
        handler: async (input, extra) =>
            withWorkspaceMutation(
                extra,
                (workspace, context) =>
                    snapshotWorkspace(workspace, context.userId, {
                        name: String(input.name),
                        note: typeof input.note === "string" ? input.note : undefined,
                    }),
                toolRequirements.create_workspace_snapshot,
            ),
    },
    {
        name: "list_workspace_snapshots",
        title: "List workspace snapshots",
        description: "List saved workspace snapshots available for recovery.",
        requiredScopes: toolRequirements.list_workspace_snapshots,
        inputSchema: z.object({}),
        handler: async (_input, extra) =>
            withWorkspaceReadResult(extra, (workspace, context) => listWorkspaceSnapshots(workspace, context.userId), toolRequirements.list_workspace_snapshots),
    },
    {
        name: "restore_workspace_snapshot",
        title: "Restore workspace snapshot",
        description: "Restore workspace content from a saved snapshot.",
        requiredScopes: toolRequirements.restore_workspace_snapshot,
        inputSchema: z.object({ snapshotId: z.string().min(1) }),
        handler: async (input, extra) =>
            withWorkspaceMutation(
                extra,
                (workspace, context) => restoreWorkspaceSnapshot(workspace, context.userId, { snapshotId: String(input.snapshotId) }),
                toolRequirements.restore_workspace_snapshot,
            ),
    },
]
