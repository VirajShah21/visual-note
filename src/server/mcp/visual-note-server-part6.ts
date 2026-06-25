import { componentKindSchema, jsonResult, operationResult, policyCheckSchema, viewModeSchema, withWorkspace } from "./visual-note-server-core"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { riskLevelSchema, withWorkspaceMutation, withWorkspaceReadResult, workspaceOps } from "./visual-note-server-core"

export const registerVisualNoteMcpToolsPart6 = (server: McpServer) => {
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
