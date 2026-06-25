import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { withWorkspaceMutation, withWorkspaceReadResult, workspaceOps } from "./visual-note-server-core"

export const registerVisualNoteMcpToolsPart5 = (server: McpServer) => {
    server.registerTool(
        "diff_notebook_state",
        {
            title: "Diff notebook state",
            description: "Compare notebook counts and ids against an optional snapshot.",
            inputSchema: z.object({ notebookId: z.string().min(1), snapshotId: z.string().min(1).optional() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.diffNotebookState(workspace, context.userId, input)),
    )

    server.registerTool(
        "snapshot_compare",
        {
            title: "Snapshot compare",
            description: "Compare current notebook state against snapshot metadata.",
            inputSchema: z.object({ notebookId: z.string().min(1), snapshotId: z.string().min(1).optional() }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.snapshotCompare(workspace, context.userId, input)),
    )

    server.registerTool(
        "find_duplicate_or_stale_content",
        {
            title: "Find duplicate or stale content",
            description: "Report duplicate titles/content and stale or orphaned views.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includeEmptyViews: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.findDuplicateOrStaleContent(workspace, context.userId, input)),
    )

    server.registerTool(
        "repair_workspace",
        {
            title: "Repair workspace",
            description: "Repair workspace consistency and return repaired structure.",
            inputSchema: z.object({}),
        },
        async (_input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.repairWorkspace(workspace, context.userId)),
    )

    server.registerTool(
        "export_publish_bundle",
        {
            title: "Export publish bundle",
            description: "Build markdown/web/json bundle useful for publishing or publishing preview.",
            inputSchema: z.object({
                notebookId: z.string().min(1),
                includeHtml: z.boolean().optional(),
                includeJson: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.exportPublishBundle(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_observe_workspace",
        {
            title: "Agentic observe workspace",
            description: "Gather workspace health, drift, orphan, and policy signals for decisioning.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includePolicy: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticObserveWorkspace(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_intent_to_plan",
        {
            title: "Agentic intent to plan",
            description: "Translate goal intent into an initial execution plan.",
            inputSchema: z.object({
                goal: z.string().min(1),
                notebookId: z.string().min(1).optional(),
                includePrechecks: z.boolean().optional(),
                maxSteps: z.number().int().min(1).optional(),
                constraints: z.array(z.string().min(1)).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticIntentToPlan(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_plan_dryrun",
        {
            title: "Agentic plan dry-run",
            description: "Run a change simulation with change-set summary.",
            inputSchema: z.object({
                plan: z.array(z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()) })),
                notebookId: z.string().min(1).optional(),
                maxSteps: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticPlanDryRun(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_plan_guardrail",
        {
            title: "Agentic plan guardrail",
            description: "Evaluate risk of a plan and return approved/rejected steps.",
            inputSchema: z.object({
                plan: z.array(z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()) })),
                maxRisk: z.enum(["low", "medium", "high"]).optional(),
                notebookId: z.string().min(1).optional(),
                runValidation: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticPlanGuardrail(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_execute_with_sla",
        {
            title: "Agentic execute with SLA",
            description: "Execute a plan with optional SLA limits and rollback behavior.",
            inputSchema: z.object({
                plan: z.array(z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()) })),
                notebookId: z.string().min(1).optional(),
                continueOnFailure: z.boolean().optional(),
                dryRun: z.boolean().optional(),
                maxSteps: z.number().int().min(1).optional(),
                rollbackOnFailure: z.boolean().optional(),
                slaMs: z.number().int().min(1).optional(),
                maxBlockers: z.number().int().min(0).optional(),
                maxWarnings: z.number().int().min(0).optional(),
                rollbackOnSlaFailure: z.boolean().optional(),
                checkpointLabel: z.string().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticExecuteWithSla(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_auto_repair",
        {
            title: "Agentic auto repair",
            description: "Run a safe repair sequence for a targeted workspace.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includeDrift: z.boolean().optional(),
                dryRun: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticAutoRepair(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_suggest_restructure",
        {
            title: "Agentic suggest restructure",
            description: "Generate structure optimization suggestions for a notebook.",
            inputSchema: z.object({
                notebookId: z.string().min(1),
                maxSuggestions: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticSuggestRestructure(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_reference_rewrite",
        {
            title: "Agentic reference rewrite",
            description: "Review unresolved references and apply suggested rewrites.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includeDisplayUrls: z.boolean().optional(),
                applyFixes: z.boolean().optional(),
                dryRun: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticReferenceRewrite(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_component_pipeline",
        {
            title: "Agentic component pipeline",
            description: "Propose and optionally apply component/layout migration steps.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                apply: z.boolean().optional(),
                maxSteps: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticComponentPipeline(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_change_set",
        {
            title: "Agentic change set",
            description: "Preview entity deltas before applying a change plan.",
            inputSchema: z.object({
                plan: z.array(z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()) })),
                notebookId: z.string().min(1).optional(),
                maxSteps: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticChangeSet(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_contract_enforcer",
        {
            title: "Agentic contract enforcer",
            description: "Evaluate contract constraints and optionally fix recoverable issues.",
            inputSchema: z.object({
                notebookId: z.string().min(1).optional(),
                includePolicy: z.boolean().optional(),
                autoFix: z.boolean().optional(),
            }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticContractEnforcer(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_tool_selector",
        {
            title: "Agentic tool selector",
            description: "Recommend best tools for a goal or prompt.",
            inputSchema: z.object({
                goal: z.string().min(1),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticToolSelector(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_observation_query",
        {
            title: "Agentic observation query",
            description: "Read selected agentic observations by status, goal text, or count.",
            inputSchema: z.object({
                status: z.enum(["ok", "warning", "failed"]).optional(),
                goal: z.string().optional(),
                maxItems: z.number().int().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticObservationQuery(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_workflow_job",
        {
            title: "Agentic workflow job",
            description: "Create or execute a prepared agentic workflow job.",
            inputSchema: z
                .object({
                    goal: z.string().optional(),
                    notebookId: z.string().min(1).optional(),
                    plan: z
                        .array(
                            z.object({
                                tool: z.string().min(1),
                                input: z.record(z.string(), z.unknown()),
                            }),
                        )
                        .optional(),
                    execute: z.boolean().optional(),
                    dryRun: z.boolean().optional(),
                    continueOnFailure: z.boolean().optional(),
                    maxSteps: z.number().int().min(1).optional(),
                    runPrechecks: z.boolean().optional(),
                    rollbackOnFailure: z.boolean().optional(),
                })
                .refine(input => Boolean(input.goal) || Boolean(input.plan?.length), { message: "A goal or plan is required." }),
        },
        async (input, extra) => withWorkspaceMutation(extra, (workspace, context) => workspaceOps.agenticWorkflowJob(workspace, context.userId, input)),
    )

    server.registerTool(
        "agentic_workflow_status",
        {
            title: "Agentic workflow status",
            description: "Inspect workflow job progress and latest status.",
            inputSchema: z.object({
                jobId: z.string().min(1).optional(),
            }),
        },
        async (input, extra) => withWorkspaceReadResult(extra, (workspace, context) => workspaceOps.agenticWorkflowStatus(workspace, context.userId, input)),
    )
}
