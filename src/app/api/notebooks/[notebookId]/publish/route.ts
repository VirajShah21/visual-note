import { authenticateSupabaseMutationRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { loadWorkspaceForUser, resolveWorkspaceRevision, saveWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { exportPublishBundle, publishNotebook } from "@/server/visual-note/workspace-operations"
import { parsePublishRequest } from "./route-contract"

export const runtime = "nodejs"

type Authenticated = { supabase: Parameters<typeof loadWorkspaceForUser>[0]; userId: string }

export type PublishRouteDependencies = {
    exportPublishBundle: typeof exportPublishBundle
    loadWorkspaceForUser: typeof loadWorkspaceForUser
    parsePublishRequest: typeof parsePublishRequest
    publishNotebook: typeof publishNotebook
    resolveWorkspaceRevision: typeof resolveWorkspaceRevision
    saveWorkspaceForUser: typeof saveWorkspaceForUser
    userOwnsNotebook: typeof userOwnsNotebook
}

type PublishRouteContext = { params: Promise<{ notebookId: string }> }

const defaultPublishRouteDependencies: PublishRouteDependencies = {
    exportPublishBundle,
    loadWorkspaceForUser,
    parsePublishRequest,
    publishNotebook,
    resolveWorkspaceRevision,
    saveWorkspaceForUser,
    userOwnsNotebook,
}

export const runPublishPost = async (auth: Authenticated, request: Request, notebookId: string, dependencies = defaultPublishRouteDependencies) => {
    if (!(await dependencies.userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })

    const parsed = await dependencies.parsePublishRequest(request)
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })

    const workspace = await dependencies.loadWorkspaceForUser(auth.supabase, auth.userId)
    if (!workspace) return Response.json({ error: "Workspace not found." }, { status: 404 })

    if (parsed.input.action === "preview") {
        const preview = dependencies.exportPublishBundle(workspace, auth.userId, {
            notebookId,
            includeHtml: parsed.input.includeHtml,
            includeJson: parsed.input.includeJson,
        })

        if (!preview.ok) return Response.json({ error: preview.message }, { status: preview.error === "not_found" ? 404 : 400 })

        return Response.json({ preview: preview.value })
    }

    const targetPublished = parsed.input.action === "publish"
    const publishResult = dependencies.publishNotebook(workspace, auth.userId, {
        notebookId,
        publish: targetPublished,
    })
    if (!publishResult.ok) return Response.json({ error: publishResult.message }, { status: publishResult.error === "not_found" ? 404 : 400 })

    try {
        await dependencies.saveWorkspaceForUser(auth.supabase, auth.userId, publishResult.value.workspace, parsed.input.revision, undefined)
        const revision = await dependencies.resolveWorkspaceRevision(auth.supabase, auth.userId)
        return Response.json({ notebook: publishResult.value.notebook, revision })
    } catch (error) {
        const status = error instanceof Error && (error as { code?: string }).code === "workspace_conflict" ? 409 : 500
        return Response.json({ error: error instanceof Error ? error.message : "Unable to update notebook publish state." }, { status })
    }
}

export async function POST(request: Request, context: PublishRouteContext) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    return runPublishPost(auth, request, notebookId)
}
