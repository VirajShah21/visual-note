import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { normalizeNotebookEditorSettings } from "@/lib/visual-note/factories"
import type { Notebook } from "@/lib/visual-note/types"
import { deletePageMarkdown, readPageMarkdown, savePageMarkdown, savePageMarkdownIfConfigured } from "@/server/visual-note/page-content-store"
import { listNotebooksForUser, upsertNotebooks } from "@/server/visual-note/notebook-store"
import { deletePage, loadPageById, makePageObjectKey, upsertPages } from "@/server/visual-note/page-store"
import { cleanupWorkspaceAssetOrphans } from "@/server/visual-note/workspace-store"
import { parsePageUpdateRequest } from "./route-contract"

export const runtime = "nodejs"

export async function GET(request: Request, context: RouteContext<"/api/pages/[pageId]">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    const page = await loadPageById(auth.supabase, auth.userId, pageId)
    if (!page) return Response.json({ error: "Page not found." }, { status: 404 })
    if (!(await userOwnsNotebook(auth, page.notebook_id))) return Response.json({ error: "Page not found." }, { status: 404 })

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

export async function DELETE(request: Request, context: RouteContext<"/api/pages/[pageId]">) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    const page = await loadPageById(auth.supabase, auth.userId, pageId)
    if (!page) return Response.json({ error: "Page not found." }, { status: 404 })
    if (!(await userOwnsNotebook(auth, page.notebook_id))) return Response.json({ error: "Page not found." }, { status: 404 })

    try {
        await deletePage(auth.supabase, auth.userId, page.id, page.notebook_id)
        await deletePageMarkdown({ supabase: auth.supabase, userId: auth.userId }, { notebookId: page.notebook_id, id: page.id }, page.content_object_key).catch(() => {})
        await cleanupWorkspaceAssetOrphans(auth.supabase, auth.userId).catch(() => {})
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to delete page." }, { status: 500 })
    }

    return Response.json({ ok: true, pageId })
}

export async function PUT(request: Request, context: RouteContext<"/api/pages/[pageId]">) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    const parsed = await parsePageUpdateRequest(request, pageId)
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })

    const { notebook, page, topics, views, markdown } = parsed

    const existing = await loadPageById(auth.supabase, auth.userId, pageId)
    const isCreate = !existing

    let notebookPayload: Notebook | null = notebook
        ? {
              ...notebook,
              editorSettings: notebook.editorSettings ? normalizeNotebookEditorSettings(notebook.editorSettings) : undefined,
          }
        : null

    if (isCreate) {
        if (notebookPayload) {
            if (notebookPayload.id !== page.notebookId) return Response.json({ error: "Notebook mismatch." }, { status: 400 })
            if (notebookPayload.userId !== auth.userId) return Response.json({ error: "Notebook mismatch." }, { status: 400 })
        } else {
            const notebooks = await listNotebooksForUser(auth.supabase, auth.userId)
            notebookPayload = notebooks.find(item => item.id === page.notebookId) ?? null
            if (!notebookPayload) return Response.json({ error: "Page not found." }, { status: 404 })
        }

        await upsertNotebooks(auth.supabase, auth.userId, [
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
        if (!(await userOwnsNotebook(auth, existing.notebook_id))) return Response.json({ error: "Page not found." }, { status: 404 })
    }

    const objectKey = makePageObjectKey(page.notebookId, page.id)
    const cleanupUpdatedBefore = new Date().toISOString()
    const previousContent = typeof markdown === "string" ? await readPageMarkdown({ supabase: auth.supabase, userId: auth.userId }, pageId) : null
    let savedContent = false

    try {
        if (typeof markdown === "string")
            savedContent = (await savePageMarkdownIfConfigured({ supabase: auth.supabase, userId: auth.userId }, { notebookId: page.notebookId, id: page.id }, markdown, objectKey))
                .saved

        await upsertPages(auth.supabase, auth.userId, [
            {
                page,
                notebookId: page.notebookId,
                topics,
                views: parseDisplayInputs(views),
                contentObjectKey: objectKey,
            },
        ])
    } catch (error) {
        if (savedContent)
            if (previousContent === null)
                await deletePageMarkdown({ supabase: auth.supabase, userId: auth.userId }, { notebookId: page.notebookId, id: page.id }, objectKey).catch(() => {})
            else await savePageMarkdown({ supabase: auth.supabase, userId: auth.userId }, { notebookId: page.notebookId, id: page.id }, previousContent, objectKey).catch(() => {})

        return Response.json({ error: error instanceof Error ? error.message : "Unable to save page." }, { status: 500 })
    }
    await cleanupWorkspaceAssetOrphans(auth.supabase, auth.userId, undefined, cleanupUpdatedBefore).catch(() => {})

    return Response.json({
        page: {
            id: page.id,
            notebookId: page.notebookId,
            title: page.title,
            position: page.position,
            contentObjectKey: objectKey,
        },
    })
}
