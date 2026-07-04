import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { normalizeNotebookEditorSettings } from "@/lib/visual-note/factories"
import type { Notebook } from "@/lib/visual-note/types"
import { deletePageMarkdown, readPageMarkdown, savePageMarkdown, savePageMarkdownIfConfigured } from "@/server/visual-note/page-content-store"
import { deleteAssetRecord } from "@/server/storage/notebook-storage"
import { collectPrivateAssetIdsFromValue } from "@/server/storage/notebook-asset-cleanup"
import { listNotebooksForUser, upsertNotebooks } from "@/server/visual-note/notebook-store"
import { deletePage, loadPageById, makePageObjectKey, upsertPages } from "@/server/visual-note/page-store"
import { cleanupWorkspaceAssetOrphans, loadWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT } from "@/lib/visual-note/storage-messages"
import { parsePageUpdateRequest, type PageUpdateParseResult } from "@app/api/pages/route-contract"

export const runtime = "nodejs"

type Authenticated = { supabase: Parameters<typeof loadPageById>[0]; userId: string }
type PageRouteContext = { params: Promise<{ pageId: string }> }

export type PageRouteDependencies = {
    loadPageById: typeof loadPageById
    userOwnsNotebook: typeof userOwnsNotebook
    listNotebooksForUser: typeof listNotebooksForUser
    upsertNotebooks: typeof upsertNotebooks
    normalizeNotebookEditorSettings: typeof normalizeNotebookEditorSettings
    makePageObjectKey: typeof makePageObjectKey
    readPageMarkdown: typeof readPageMarkdown
    savePageMarkdownIfConfigured: typeof savePageMarkdownIfConfigured
    upsertPages: typeof upsertPages
    savePageMarkdown: typeof savePageMarkdown
    deletePageMarkdown: typeof deletePageMarkdown
    deletePage: typeof deletePage
    loadWorkspaceForUser?: typeof loadWorkspaceForUser
    deleteAssetRecord?: typeof deleteAssetRecord
    cleanupWorkspaceAssetOrphans: typeof cleanupWorkspaceAssetOrphans
}

const defaultPageRouteDependencies: PageRouteDependencies = {
    loadPageById,
    userOwnsNotebook,
    listNotebooksForUser,
    upsertNotebooks,
    normalizeNotebookEditorSettings,
    makePageObjectKey,
    readPageMarkdown,
    savePageMarkdownIfConfigured,
    upsertPages,
    savePageMarkdown,
    deletePageMarkdown,
    deletePage,
    loadWorkspaceForUser,
    deleteAssetRecord,
    cleanupWorkspaceAssetOrphans,
}

export const runPageGet = async (auth: Authenticated, pageId: string, dependencies = defaultPageRouteDependencies) => {
    const page = await dependencies.loadPageById(auth.supabase, auth.userId, pageId)
    if (!page) return Response.json({ error: "Page not found." }, { status: 404 })
    if (!(await dependencies.userOwnsNotebook(auth, page.notebook_id))) return Response.json({ error: "Page not found." }, { status: 404 })

    return Response.json({
        page: {
            id: page.id,
            notebookId: page.notebook_id,
            title: page.title,
            position: page.position,
            contentObjectKey: page.content_object_key,
        },
        topics: page.topics,
        views: page.views,
    })
}

export const runPageDelete = async (auth: Authenticated, pageId: string, dependencies = defaultPageRouteDependencies) => {
    const page = await dependencies.loadPageById(auth.supabase, auth.userId, pageId)
    if (!page) return Response.json({ error: "Page not found." }, { status: 404 })
    if (!(await dependencies.userOwnsNotebook(auth, page.notebook_id))) return Response.json({ error: "Page not found." }, { status: 404 })

    try {
        const candidateAssetIds = collectPrivateAssetIdsFromValue(page)
        const previousMarkdown = await dependencies.readPageMarkdown({ supabase: auth.supabase, userId: auth.userId }, page.id)
        if (previousMarkdown) collectPrivateAssetIdsFromValue(previousMarkdown).forEach(id => candidateAssetIds.add(id))

        const cleanupUpdatedBefore = new Date().toISOString()
        await dependencies.deletePage(auth.supabase, auth.userId, page.id, page.notebook_id)
        await dependencies
            .deletePageMarkdown({ supabase: auth.supabase, userId: auth.userId }, { notebookId: page.notebook_id, id: page.id }, page.content_object_key)
            .catch(() => {})
        await dependencies.cleanupWorkspaceAssetOrphans(auth.supabase, auth.userId, undefined, cleanupUpdatedBefore)

        const workspace = await (dependencies.loadWorkspaceForUser ?? loadWorkspaceForUser)(auth.supabase, auth.userId)
        const currentAssetIds = workspace ? collectPrivateAssetIdsFromValue(workspace) : new Set<string>()
        for (const assetId of candidateAssetIds) {
            if (currentAssetIds.has(assetId)) continue
            await (dependencies.deleteAssetRecord ?? deleteAssetRecord)(auth.supabase, auth.userId, assetId).catch(() => {})
        }
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to delete page." }, { status: 500 })
    }

    return Response.json({ ok: true, pageId })
}

export const runPageSave = async (auth: Authenticated, parsed: PageUpdateParseResult, dependencies = defaultPageRouteDependencies) => {
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })

    const { notebook, page, topics, views, markdown } = parsed

    try {
        const existing = await dependencies.loadPageById(auth.supabase, auth.userId, page.id)
        const isCreate = !existing

        let notebookPayload: Notebook | null = notebook
            ? {
                  ...notebook,
                  editorSettings: notebook.editorSettings ? dependencies.normalizeNotebookEditorSettings(notebook.editorSettings) : undefined,
              }
            : null

        if (isCreate) {
            if (notebookPayload) {
                if (notebookPayload.id !== page.notebookId) return Response.json({ error: "Notebook mismatch." }, { status: 400 })
                if (notebookPayload.userId !== auth.userId) return Response.json({ error: "Notebook mismatch." }, { status: 400 })
            } else {
                const notebooks = await dependencies.listNotebooksForUser(auth.supabase, auth.userId)
                notebookPayload = notebooks.find(item => item.id === page.notebookId) ?? null
                if (!notebookPayload) return Response.json({ error: "Page not found." }, { status: 404 })
            }

            await dependencies.upsertNotebooks(auth.supabase, auth.userId, [
                {
                    ...notebookPayload,
                    createdAt: notebookPayload.createdAt,
                },
            ])
        } else {
            if (existing.notebook_id !== page.notebookId) return Response.json({ error: "Notebook mismatch." }, { status: 400 })
            if (notebookPayload) {
                if (notebookPayload.id !== existing.notebook_id) return Response.json({ error: "Notebook mismatch." }, { status: 400 })
                if (notebookPayload.userId !== auth.userId) return Response.json({ error: "Notebook mismatch." }, { status: 400 })
            }
            if (!(await dependencies.userOwnsNotebook(auth, existing.notebook_id))) return Response.json({ error: "Page not found." }, { status: 404 })
        }

        const objectKey = dependencies.makePageObjectKey(page.notebookId, page.id)
        const cleanupUpdatedBefore = new Date().toISOString()
        const previousContent = typeof markdown === "string" ? await dependencies.readPageMarkdown({ supabase: auth.supabase, userId: auth.userId }, page.id) : null
        let savedContent = false

        try {
            if (typeof markdown === "string") {
                const uploadResult = await dependencies.savePageMarkdownIfConfigured(
                    { supabase: auth.supabase, userId: auth.userId },
                    { notebookId: page.notebookId, id: page.id },
                    markdown,
                    objectKey,
                )
                savedContent = uploadResult.saved
            }

            await dependencies.upsertPages(auth.supabase, auth.userId, [
                {
                    page,
                    notebookId: page.notebookId,
                    topics,
                    views,
                    contentObjectKey: objectKey,
                },
            ])
        } catch (error) {
            if (savedContent)
                if (previousContent === null)
                    await dependencies.deletePageMarkdown({ supabase: auth.supabase, userId: auth.userId }, { notebookId: page.notebookId, id: page.id }, objectKey).catch(() => {})
                else
                    await dependencies
                        .savePageMarkdown({ supabase: auth.supabase, userId: auth.userId }, { notebookId: page.notebookId, id: page.id }, previousContent, objectKey)
                        .catch(() => {})

            return Response.json({ error: error instanceof Error ? error.message : "Unable to save page." }, { status: 500 })
        }
        await dependencies.cleanupWorkspaceAssetOrphans(auth.supabase, auth.userId, undefined, cleanupUpdatedBefore)

        const response: { page: { id: string; notebookId: string; title: string; position: number; contentObjectKey: string }; warnings?: string[] } = {
            page: {
                id: page.id,
                notebookId: page.notebookId,
                title: page.title,
                position: page.position,
                contentObjectKey: objectKey,
            },
        }

        if (typeof markdown === "string" && !savedContent) response.warnings = [STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT]

        return Response.json(response)
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to save page." }, { status: 500 })
    }
}

export async function GET(request: Request, context: PageRouteContext) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    return runPageGet(auth, pageId)
}

export async function DELETE(request: Request, context: PageRouteContext) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    return runPageDelete(auth, pageId)
}

export async function PUT(request: Request, context: PageRouteContext) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    const parsed = await parsePageUpdateRequest(request, pageId)
    return runPageSave(auth, parsed)
}
