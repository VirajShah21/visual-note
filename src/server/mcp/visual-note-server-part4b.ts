import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { blockInfoSchema, contentModeSchema, editorModeSchema, withWorkspaceMutation, withWorkspaceReadResult, workspaceOps } from "./visual-note-server-core"

export const registerVisualNoteMcpToolsPart4b = (server: McpServer) => {
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
}
