import { z } from "zod"
import { createNotebook, createPage, createTopic, createView } from "@/lib/visual-note/factories"
import { createExportDocument } from "@/lib/visual-note/export/document"
import { renderMarkdownExport } from "@/lib/visual-note/export/markdown"
import { resolveExportAssets } from "@/lib/visual-note/export/assets"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest } from "@/lib/supabase/server"
import { upsertNotebooks } from "@/server/visual-note/notebook-store"
import { makePageObjectKey, upsertPages } from "@/server/visual-note/page-store"
import { loadWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { savePageMarkdownIfConfigured } from "@/server/visual-note/page-content-store"
import { STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT } from "@/lib/visual-note/storage-messages"

const notebookInputSchema = z.object({
    title: z.string().min(1),
    summary: z.string().optional(),
    color: z.string().optional(),
    createHomePage: z.boolean().optional(),
})

const pageSelection = (notebookId: string, pageId: string) => ({
    notebookId,
    pageId,
    topicId: "",
    viewId: "",
})

export const runtime = "nodejs"

type Authenticated = { supabase: Parameters<typeof loadWorkspaceForUser>[0]; userId: string }

export type NotebooksRouteDependencies = {
    createExportDocument: typeof createExportDocument
    createNotebook: typeof createNotebook
    createPage: typeof createPage
    createTopic: typeof createTopic
    createView: typeof createView
    authenticateSupabaseMutationRequest: typeof authenticateSupabaseMutationRequest
    authenticateSupabaseRequest: typeof authenticateSupabaseRequest
    loadWorkspaceForUser: typeof loadWorkspaceForUser
    makePageObjectKey: typeof makePageObjectKey
    renderMarkdownExport: typeof renderMarkdownExport
    resolveExportAssets: typeof resolveExportAssets
    savePageMarkdownIfConfigured: typeof savePageMarkdownIfConfigured
    upsertNotebooks: typeof upsertNotebooks
    upsertPages: typeof upsertPages
}

const defaultNotebooksRouteDependencies: NotebooksRouteDependencies = {
    createExportDocument,
    createNotebook,
    createPage,
    createTopic,
    createView,
    authenticateSupabaseMutationRequest,
    authenticateSupabaseRequest,
    loadWorkspaceForUser,
    makePageObjectKey,
    renderMarkdownExport,
    resolveExportAssets,
    savePageMarkdownIfConfigured,
    upsertNotebooks,
    upsertPages,
}

export const runNotebooksGet = async (auth: Authenticated, dependencies = defaultNotebooksRouteDependencies) => {
    try {
        const workspace = await dependencies.loadWorkspaceForUser(auth.supabase, auth.userId)
        return Response.json({ workspace: workspace ?? { notebooks: [], pages: [], topics: [], views: [] } })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load workspace." }, { status: 500 })
    }
}

const serializePageMarkdown = async (dependencies: NotebooksRouteDependencies, workspace: VisualNoteWorkspace, pageId: string) => {
    const page = workspace.pages.find(item => item.id === pageId)
    if (!page) return ""

    const document = dependencies.createExportDocument({
        scope: "page",
        selection: pageSelection(page.notebookId, page.id),
        workspace,
    })
    if (!document) return ""

    const context = await dependencies.resolveExportAssets(document, "ignore")
    return dependencies.renderMarkdownExport(document, { assetMode: "ignore", assetResolution: context })
}

export const runNotebooksPost = async (auth: Authenticated, request: Request, dependencies = defaultNotebooksRouteDependencies) => {
    try {
        let body: unknown
        try {
            body = await request.json()
        } catch {
            return Response.json({ error: "Invalid notebook request." }, { status: 400 })
        }

        const parse = notebookInputSchema.safeParse(body)
        if (!parse.success) return Response.json({ error: "Invalid notebook request." }, { status: 400 })

        const notebook = dependencies.createNotebook(auth.userId, parse.data.title)
        const now = new Date().toISOString()
        const warnings: string[] = []
        const createdNotebook = {
            ...notebook,
            summary: parse.data.summary?.trim() || notebook.summary,
            color: parse.data.color?.trim() || notebook.color,
            createdAt: now,
        }

        await dependencies.upsertNotebooks(auth.supabase, auth.userId, [createdNotebook])

        if (parse.data.createHomePage !== false) {
            const page = dependencies.createPage(createdNotebook.id, "Home", 0)
            const topic = dependencies.createTopic(page.id, "Start", 0)
            const view = dependencies.createView(topic.id, "Welcome")

            await dependencies.upsertPages(auth.supabase, auth.userId, [
                {
                    page,
                    notebookId: createdNotebook.id,
                    topics: [topic],
                    views: [view],
                    contentObjectKey: dependencies.makePageObjectKey(createdNotebook.id, page.id),
                },
            ])

            const markdown = await serializePageMarkdown(
                dependencies,
                {
                    notebooks: [createdNotebook],
                    pages: [page],
                    topics: [topic],
                    views: [view],
                },
                page.id,
            )

            const uploadResult = await dependencies.savePageMarkdownIfConfigured(
                { supabase: auth.supabase, userId: auth.userId },
                { notebookId: createdNotebook.id, id: page.id },
                markdown,
                dependencies.makePageObjectKey(createdNotebook.id, page.id),
            )
            if (!uploadResult.saved) {
                warnings.push(STORAGE_CONTENT_WARNING)
                warnings.push(STORAGE_SETUP_HINT)
            }
        }

        const detail = await dependencies.loadWorkspaceForUser(auth.supabase, auth.userId)
        const created = detail?.notebooks.find(item => item.id === createdNotebook.id) ?? createdNotebook
        const response = { notebook: created, workspace: detail, ...(warnings.length > 0 ? { warnings } : {}) }
        return Response.json(response)
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to create notebook." }, { status: 500 })
    }
}

export async function GET(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    return runNotebooksGet(auth)
}

export async function POST(request: Request) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth
    return runNotebooksPost(auth, request)
}
