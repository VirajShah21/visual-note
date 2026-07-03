import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js"
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { normalizeWorkspace } from "@/lib/visual-note/factories"
import { visualBlockKinds } from "@/lib/visual-note/visual-blocks"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { recordVisualNoteEvent } from "@/server/observability/visual-note-events"
import { loadWorkspaceForUser, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { logMcpToolAudit, type McpTokenScope, normalizeScopeSet } from "./token-store"
import type { WorkspaceOperationResult } from "@/server/visual-note/workspace-operations"

export type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>

export type ToolScopeRequirement = {
    toolName: string
    requiredScopes: readonly McpTokenScope[]
}

type ScopeEval = {
    allowed: boolean
    missingScopes: McpTokenScope[]
}

export type RequestContext = {
    tokenId?: string
    userId: string
    scopes: McpTokenScope[]
}

export const emptyWorkspace: VisualNoteWorkspace = {
    notebooks: [],
    pages: [],
    topics: [],
    views: [],
}

export const visualBlockKindSchema = z.enum(visualBlockKinds)
export const componentKindSchema = z.enum([
    "data-card",
    "checklist",
    "timeline",
    "dashboard",
    "work-logs",
    "bugs-list",
    "shopping-list",
    "pull-request",
    "url",
    "code-block",
] as const)
export const viewModeSchema = z.enum(["article", "structured", "dashboard"])
export const viewKindSchema = z.enum(["notebook", "page", "topic", "view", "display"])
export const blockInfoSchema = z.enum(["show", "type-only", "metadata-only"])
export const contentModeSchema = z.enum(["show", "hide-title", "hide"])
export const editorModeSchema = z.enum(["editing", "source", "reader"])
export const policyCheckSchema = z.enum(["notebook_summary", "non_empty_titles", "display_or_content", "layout_density"])
export const riskLevelSchema = z.enum(["low", "medium", "high"])

export const jsonResult = (payload: unknown) => ({
    content: [
        {
            type: "text" as const,
            text: JSON.stringify(payload, null, 2),
        },
    ],
})

export const operationResult = <T>(result: WorkspaceOperationResult<T>) => jsonResult(result.ok ? { ok: true, ...result.value } : result)

export const requestContextFrom = (authInfo?: AuthInfo): RequestContext | null => {
    const userId = authInfo?.extra?.userId
    if (!authInfo?.token || typeof userId !== "string") return null

    return {
        tokenId: typeof authInfo.extra?.tokenId === "string" ? authInfo.extra.tokenId : undefined,
        userId,
        scopes: normalizeScopeSet(authInfo.extra?.scopes ?? authInfo.scopes, []),
    }
}

export const scopeDeniedPayload = (toolName: string, required: readonly McpTokenScope[], missing: readonly McpTokenScope[], satisfied: readonly McpTokenScope[]) =>
    jsonResult({
        ok: false,
        error: "forbidden",
        message: "MCP token does not include required scope(s) for this tool.",
        tool: toolName,
        requiredScopes: required,
        missingScopes: missing,
        scopeSatisfied: satisfied,
    })

const evaluateScope = (context: RequestContext, required: readonly McpTokenScope[]): ScopeEval => {
    const missingScopes = required.filter(scope => !context.scopes.includes(scope))

    return {
        allowed: missingScopes.length === 0,
        missingScopes,
    }
}

const recordMcpToolEvent = (
    event: string,
    context: RequestContext,
    toolScope: ToolScopeRequirement,
    severity: "info" | "warn" | "error" = "warn",
    reason?: string,
    missingScopes: readonly McpTokenScope[] = [],
) => {
    recordVisualNoteEvent({
        event,
        severity,
        userId: context.userId,
        metadata: {
            toolName: toolScope.toolName,
            requiredScopes: [...toolScope.requiredScopes],
            scopeSatisfied: [...context.scopes],
            missingScopes: [...missingScopes],
            reason,
        },
    })
}

const maybeRecordAudit = async (
    supabase: Awaited<ReturnType<typeof getSupabaseServiceRoleClient>>,
    context: RequestContext,
    toolScope: ToolScopeRequirement,
    success: boolean,
    reason?: string,
) => {
    if (!supabase) return
    if (!context.tokenId) return

    await logMcpToolAudit(supabase, {
        tokenId: context.tokenId,
        userId: context.userId,
        toolName: toolScope.toolName,
        scopeRequired: toolScope.requiredScopes,
        scopeSatisfied: context.scopes,
        success,
        denialReason: reason,
    }).catch(() => {})
}

export const loadWorkspace = async (context: RequestContext) => {
    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) throw new Error("Server database access is required for MCP routes.")

    const workspace = await loadWorkspaceForUser(supabase, context.userId)
    return { supabase, workspace: normalizeWorkspace(workspace ?? emptyWorkspace) }
}

export const withWorkspace = async <T>(extra: ToolExtra, action: (workspace: VisualNoteWorkspace, context: RequestContext) => Promise<T> | T, toolScope: ToolScopeRequirement) => {
    const context = requestContextFrom(extra.authInfo)
    if (!context) {
        recordVisualNoteEvent({ event: "mcp.auth_required", severity: "warn", metadata: { toolName: toolScope.toolName } })
        return jsonResult({ ok: false, error: "auth_required", message: "Authentication required." })
    }

    const scopeEval = evaluateScope(context, toolScope.requiredScopes)
    if (!scopeEval.allowed) {
        recordMcpToolEvent("mcp.scope_denied", context, toolScope, "warn", `missing_scope:${scopeEval.missingScopes.join(",")}`, scopeEval.missingScopes)
        await maybeRecordAudit(getSupabaseServiceRoleClient(), context, toolScope, false, `missing_scope:${scopeEval.missingScopes.join(",")}`)
        return scopeDeniedPayload(toolScope.toolName, toolScope.requiredScopes, scopeEval.missingScopes, context.scopes)
    }

    try {
        const loaded = await loadWorkspace(context)
        const value = await action(loaded.workspace, context)
        await maybeRecordAudit(loaded.supabase, context, toolScope, true)
        return value
    } catch (error) {
        const supabase = getSupabaseServiceRoleClient()
        await maybeRecordAudit(supabase, context, toolScope, false, error instanceof Error ? error.message : "unexpected_tool_error")
        recordMcpToolEvent("mcp.tool_error", context, toolScope, "error", error instanceof Error ? error.message : "unexpected_tool_error")
        return jsonResult({
            ok: false,
            error: "tool_error",
            message: "The MCP tool failed to execute.",
            cause: error instanceof Error ? error.message : "unexpected_tool_error",
        })
    }
}

export const withWorkspaceMutation = async (
    extra: ToolExtra,
    action: (
        workspace: VisualNoteWorkspace,
        context: RequestContext,
    ) => Promise<WorkspaceOperationResult<object & { workspace?: VisualNoteWorkspace }>> | WorkspaceOperationResult<object & { workspace?: VisualNoteWorkspace }>,
    toolScope: ToolScopeRequirement,
) =>
    (async () => {
        const context = requestContextFrom(extra.authInfo)
        if (!context) {
            recordVisualNoteEvent({ event: "mcp.auth_required", severity: "warn", metadata: { toolName: toolScope.toolName } })
            return jsonResult({ ok: false, error: "auth_required", message: "Authentication required." })
        }

        const scopeEval = evaluateScope(context, toolScope.requiredScopes)
        if (!scopeEval.allowed) {
            recordMcpToolEvent("mcp.scope_denied", context, toolScope, "warn", `missing_scope:${scopeEval.missingScopes.join(",")}`, scopeEval.missingScopes)
            await maybeRecordAudit(getSupabaseServiceRoleClient(), context, toolScope, false, `missing_scope:${scopeEval.missingScopes.join(",")}`)
            return scopeDeniedPayload(toolScope.toolName, toolScope.requiredScopes, scopeEval.missingScopes, context.scopes)
        }

        try {
            const loaded = await loadWorkspace(context)
            const result = await action(loaded.workspace, context)
            if (!result.ok) {
                recordMcpToolEvent("mcp.workspace_error", context, toolScope, "warn", `workspace_error:${result.error}`)
                await maybeRecordAudit(loaded.supabase, context, toolScope, false, `workspace_error:${result.error}`)
                return jsonResult(result)
            }

            const value = result.value
            if (!value.workspace) {
                recordMcpToolEvent("mcp.workspace_error", context, toolScope, "warn", "workspace_missing")
                await maybeRecordAudit(loaded.supabase, context, toolScope, false, "workspace_missing")
                return jsonResult({ ok: false, error: "invalid_input", message: "Mutation did not return a workspace." })
            }

            const publicValue = { ...value }
            delete publicValue.workspace
            await saveWorkspaceForUser(loaded.supabase, context.userId, value.workspace)
            await maybeRecordAudit(loaded.supabase, context, toolScope, true)
            return jsonResult({ ok: true, ...publicValue })
        } catch (error) {
            const supabase = getSupabaseServiceRoleClient()
            await maybeRecordAudit(supabase, context, toolScope, false, error instanceof Error ? error.message : "unexpected_tool_error")
            recordMcpToolEvent("mcp.tool_error", context, toolScope, "error", error instanceof Error ? error.message : "unexpected_tool_error")
            return jsonResult({
                ok: false,
                error: "tool_error",
                message: "The MCP tool failed to execute.",
                cause: error instanceof Error ? error.message : "unexpected_tool_error",
            })
        }
    })()

export const withWorkspaceReadResult = async (
    extra: ToolExtra,
    action: (workspace: VisualNoteWorkspace, context: RequestContext) => WorkspaceOperationResult<unknown>,
    toolScope: ToolScopeRequirement,
) => {
    const context = requestContextFrom(extra.authInfo)
    if (!context) {
        recordVisualNoteEvent({ event: "mcp.auth_required", severity: "warn", metadata: { toolName: toolScope.toolName } })
        return jsonResult({ ok: false, error: "auth_required", message: "Authentication required." })
    }

    const scopeEval = evaluateScope(context, toolScope.requiredScopes)
    if (!scopeEval.allowed) {
        recordMcpToolEvent("mcp.scope_denied", context, toolScope, "warn", `missing_scope:${scopeEval.missingScopes.join(",")}`, scopeEval.missingScopes)
        await maybeRecordAudit(getSupabaseServiceRoleClient(), context, toolScope, false, `missing_scope:${scopeEval.missingScopes.join(",")}`)
        return scopeDeniedPayload(toolScope.toolName, toolScope.requiredScopes, scopeEval.missingScopes, context.scopes)
    }

    try {
        const loaded = await loadWorkspace(context)
        const result = await action(loaded.workspace, context)
        if (!result.ok) {
            recordMcpToolEvent("mcp.workspace_error", context, toolScope, "warn", `workspace_error:${result.error}`)
            await maybeRecordAudit(loaded.supabase, context, toolScope, false, `workspace_error:${result.error}`)
            return operationResult(result)
        }

        await maybeRecordAudit(loaded.supabase, context, toolScope, true)
        return operationResult(result)
    } catch (error) {
        const supabase = getSupabaseServiceRoleClient()
        await maybeRecordAudit(supabase, context, toolScope, false, error instanceof Error ? error.message : "unexpected_tool_error")
        recordMcpToolEvent("mcp.tool_error", context, toolScope, "error", error instanceof Error ? error.message : "unexpected_tool_error")
        return jsonResult({
            ok: false,
            error: "tool_error",
            message: "The MCP tool failed to execute.",
            cause: error instanceof Error ? error.message : "unexpected_tool_error",
        })
    }
}

export const requireAtLeastOne = (schema: Record<string, unknown>, fields: string[]) =>
    z
        .object(schema)
        .partial()
        .refine(value => fields.some(field => Boolean((value as Record<string, string | undefined>)[field])), {
            message: `${fields.join(" or ")} is required.`,
        })

export const resolveNotebookInput = requireAtLeastOne({ notebookId: z.string().min(1), title: z.string().min(1) }, ["notebookId", "title"])
export const resolvePageInput = requireAtLeastOne(
    {
        pageId: z.string().min(1),
        title: z.string().min(1),
        notebookId: z.string().min(1),
    },
    ["pageId", "title"],
)
export const resolveTopicInput = requireAtLeastOne(
    {
        topicId: z.string().min(1),
        title: z.string().min(1),
        pageId: z.string().min(1),
    },
    ["topicId", "title"],
)
export const resolveViewInput = requireAtLeastOne(
    {
        viewId: z.string().min(1),
        title: z.string().min(1),
        topicId: z.string().min(1),
    },
    ["viewId", "title"],
)

export { z }
