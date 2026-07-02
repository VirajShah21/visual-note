import { z } from "zod"
import { createNotebook, createPage, createTopic, createView } from "@/lib/visual-note/factories"
import { createExportDocument } from "@/lib/visual-note/export/document"
import { renderMarkdownExport } from "@/lib/visual-note/export/markdown"
import { resolveExportAssets } from "@/lib/visual-note/export/assets"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { authenticateSupabaseRequest } from "@/lib/supabase/server"
import { upsertNotebooks } from "@/server/visual-note/notebook-store"
import { makePageObjectKey, upsertPages } from "@/server/visual-note/page-store"
import { loadWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { savePageMarkdownIfConfigured } from "@/server/visual-note/page-content-store"

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

const serializePageMarkdown = async (workspace: VisualNoteWorkspace, pageId: string) => {
    const page = workspace.pages.find(item => item.id === pageId)
    if (!page) return ""

    const document = createExportDocument({
        scope: "page",
        selection: pageSelection(page.notebookId, page.id),
        workspace,
    })
    if (!document) return ""

    const context = await resolveExportAssets(document, "ignore")
    return renderMarkdownExport(document, { assetMode: "ignore", assetResolution: context })
}

export const runtime = "nodejs"

export async function GET(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    try {
        const workspace = await loadWorkspaceForUser(auth.supabase, auth.userId)
        return Response.json({ workspace: workspace ?? { notebooks: [], pages: [], topics: [], views: [] } })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load workspace." }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    try {
        const body = (await request.json()) as z.infer<typeof notebookInputSchema>
        const parse = notebookInputSchema.safeParse(body)
        if (!parse.success) return Response.json({ error: "Invalid notebook request." }, { status: 400 })

        const notebook = createNotebook(auth.userId, parse.data.title)
        const now = new Date().toISOString()
        const createdNotebook = {
            ...notebook,
            summary: parse.data.summary?.trim() || notebook.summary,
            color: parse.data.color?.trim() || notebook.color,
            createdAt: now,
        }

        await upsertNotebooks(auth.supabase, auth.userId, [createdNotebook])

        if (parse.data.createHomePage !== false) {
            const page = createPage(createdNotebook.id, "Home", 0)
            const topic = createTopic(page.id, "Start", 0)
            const view = createView(topic.id, "Welcome")
            const pages = [page]
            const topics = [topic]
            const views = [view]
            const objectKey = makePageObjectKey(createdNotebook.id, page.id)

            await upsertPages(auth.supabase, auth.userId, [
                {
                    page,
                    notebookId: createdNotebook.id,
                    topics,
                    views,
                    contentObjectKey: objectKey,
                },
            ])

            const markdown = await serializePageMarkdown(
                {
                    notebooks: [createdNotebook],
                    pages,
                    topics,
                    views,
                },
                page.id,
            )

            await savePageMarkdownIfConfigured({ supabase: auth.supabase, userId: auth.userId }, { notebookId: createdNotebook.id, id: page.id }, markdown, objectKey)
        }

        const detail = await loadWorkspaceForUser(auth.supabase, auth.userId)
        const created = detail?.notebooks.find(item => item.id === createdNotebook.id) ?? createdNotebook
        return Response.json({ notebook: created, workspace: detail })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to create notebook." }, { status: 500 })
    }
}
