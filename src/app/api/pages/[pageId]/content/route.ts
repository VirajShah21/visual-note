import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { loadPageById, makePageObjectKey } from "@/server/visual-note/page-store"
import { readPageMarkdown, savePageMarkdownIfConfigured } from "@/server/visual-note/page-content-store"
import { cleanupWorkspaceAssetOrphans } from "@/server/visual-note/workspace-store"
import { STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT } from "@/lib/visual-note/storage-messages"

export type Authenticated = { supabase: Parameters<typeof readPageMarkdown>[0]["supabase"]; userId: string }

const storageConfigurationError = STORAGE_CONTENT_WARNING

export type PageContentRouteDependencies = {
    loadPageById: typeof loadPageById
    userOwnsNotebook: typeof userOwnsNotebook
    readPageMarkdown: typeof readPageMarkdown
    savePageMarkdownIfConfigured: typeof savePageMarkdownIfConfigured
    makePageObjectKey: typeof makePageObjectKey
    cleanupWorkspaceAssetOrphans: typeof cleanupWorkspaceAssetOrphans
}

const defaultPageContentRouteDependencies: PageContentRouteDependencies = {
    loadPageById,
    userOwnsNotebook,
    readPageMarkdown,
    savePageMarkdownIfConfigured,
    makePageObjectKey,
    cleanupWorkspaceAssetOrphans,
}

const parseContentBody = async (request: Request) => {
    const body = (await request.json().catch(() => null)) as { markdown?: string } | null
    if (!body || typeof body.markdown !== "string") return null

    return body.markdown
}

export const runtime = "nodejs"

export const runContentGet = async (auth: Authenticated, pageId: string, dependencies = defaultPageContentRouteDependencies) => {
    const page = await dependencies.loadPageById(auth.supabase, auth.userId, pageId)
    if (!page) return Response.json({ error: "Page not found." }, { status: 404 })
    if (!(await dependencies.userOwnsNotebook(auth, page.notebook_id))) return Response.json({ error: "Page not found." }, { status: 404 })

    const markdown = await dependencies.readPageMarkdown({ supabase: auth.supabase, userId: auth.userId }, pageId)
    if (markdown === null) return Response.json({ error: "Page content not found." }, { status: 404 })

    return Response.json({ pageId, markdown })
}

export const runContentPut = async (auth: Authenticated, request: Request, pageId: string, dependencies = defaultPageContentRouteDependencies) => {
    const page = await dependencies.loadPageById(auth.supabase, auth.userId, pageId)
    if (!page) return Response.json({ error: "Page not found." }, { status: 404 })
    if (!(await dependencies.userOwnsNotebook(auth, page.notebook_id))) return Response.json({ error: "Page not found." }, { status: 404 })

    const markdown = await parseContentBody(request)
    if (markdown === null) return Response.json({ error: "Invalid content payload." }, { status: 400 })

    const objectKey = dependencies.makePageObjectKey(page.notebook_id, page.id)
    const cleanupUpdatedBefore = new Date().toISOString()
    const warnings: string[] = []

    try {
        const uploadResult = await dependencies.savePageMarkdownIfConfigured(
            { supabase: auth.supabase, userId: auth.userId },
            { notebookId: page.notebook_id, id: page.id },
            markdown,
            objectKey,
        )
        if (!uploadResult.saved) warnings.push(storageConfigurationError)
        if (warnings.length > 0) warnings.push(STORAGE_SETUP_HINT)
        await dependencies.cleanupWorkspaceAssetOrphans(auth.supabase, auth.userId, undefined, cleanupUpdatedBefore)

        const response = {
            pageId,
            contentObjectKey: objectKey,
            ...(warnings.length > 0 ? { warnings } : {}),
        }

        return Response.json(response)
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to save page content." }, { status: 500 })
    }
}

export async function GET(request: Request, context: RouteContext<"/api/pages/[pageId]/content">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    return runContentGet(auth, pageId)
}

export async function PUT(request: Request, context: RouteContext<"/api/pages/[pageId]/content">) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    return runContentPut(auth, request, pageId)
}
