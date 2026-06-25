import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js"
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { normalizeWorkspace } from "@/lib/visual-note/factories"
import { visualBlockKinds } from "@/lib/visual-note/visual-blocks"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { loadWorkspaceForUser, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import * as workspaceOps from "@/server/visual-note/workspace-operations"
import type { WorkspaceOperationResult } from "@/server/visual-note/workspace-operations"

export type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>

export type RequestContext = {
    tokenId?: string
    userId: string
}

export const emptyWorkspace: VisualNoteWorkspace = {
    notebooks: [],
    pages: [],
    topics: [],
    views: [],
    components: [],
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

    return { tokenId: typeof authInfo.extra?.tokenId === "string" ? authInfo.extra.tokenId : undefined, userId }
}

export const loadWorkspace = async (context: RequestContext) => {
    const supabase = getSupabaseServiceRoleClient()
    if (!supabase) throw new Error("Server database access is required for MCP routes.")

    const workspace = await loadWorkspaceForUser(supabase, context.userId)
    return { supabase, workspace: normalizeWorkspace(workspace ?? emptyWorkspace) }
}

export const withWorkspace = async <T>(extra: ToolExtra, action: (workspace: VisualNoteWorkspace, context: RequestContext) => Promise<T> | T) => {
    const context = requestContextFrom(extra.authInfo)
    if (!context) return jsonResult({ ok: false, error: "auth_required", message: "Authentication required." })

    const { workspace } = await loadWorkspace(context)
    return action(workspace, context)
}

export const withWorkspaceMutation = async (
    extra: ToolExtra,
    action: (
        workspace: VisualNoteWorkspace,
        context: RequestContext,
    ) => Promise<WorkspaceOperationResult<object & { workspace?: VisualNoteWorkspace }>> | WorkspaceOperationResult<object & { workspace?: VisualNoteWorkspace }>,
) =>
    (async () => {
        const context = requestContextFrom(extra.authInfo)
        if (!context) return jsonResult({ ok: false, error: "auth_required", message: "Authentication required." })

        const loaded = await loadWorkspace(context)
        const result = await action(loaded.workspace, context)
        if (!result.ok) return jsonResult(result)

        const value = result.value
        if (!value.workspace) return jsonResult({ ok: false, error: "invalid_input", message: "Mutation did not return a workspace." })

        const publicValue = { ...value }
        delete publicValue.workspace
        await saveWorkspaceForUser(loaded.supabase, context.userId, value.workspace)
        return jsonResult({ ok: true, ...publicValue })
    })()

export const withWorkspaceReadResult = async (extra: ToolExtra, action: (workspace: VisualNoteWorkspace, context: RequestContext) => WorkspaceOperationResult<unknown>) =>
    withWorkspace(extra, (workspace, context) => operationResult(action(workspace, context)))

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

export { workspaceOps }
export { z }
