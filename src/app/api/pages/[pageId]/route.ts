import { z } from "zod"
import { authenticateSupabaseRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { savePageMarkdown } from "@/server/visual-note/page-content-store"
import { listNotebooksForUser, upsertNotebooks } from "@/server/visual-note/notebook-store"
import { loadPageById, makePageObjectKey, upsertPages } from "@/server/visual-note/page-store"

const topicSchema = z.object({
    id: z.string(),
    pageId: z.string(),
    title: z.string(),
    summary: z.string(),
    position: z.number().int().nonnegative(),
})

const displaySchema = z.record(z.unknown())

const viewSchema = z.object({
    id: z.string(),
    topicId: z.string(),
    title: z.string(),
    mode: z.string(),
    content: z.string(),
    displays: z.array(displaySchema),
    componentIds: z.array(z.string()).optional(),
})

const notebookSchema = z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    color: z.string(),
    createdAt: z.string(),
    editorSettings: z.record(z.unknown()).optional(),
})

const pageSchema = z.object({
    id: z.string(),
    notebookId: z.string(),
    title: z.string(),
    position: z.number().int().nonnegative(),
})

const pageUpdateSchema = z.object({
    notebook: notebookSchema.optional(),
    page: pageSchema,
    topics: z.array(topicSchema),
    views: z.array(viewSchema),
    markdown: z.string().optional(),
})

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

export async function PUT(request: Request, context: RouteContext<"/api/pages/[pageId]">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    const parsed = pageUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ error: "Invalid page update payload." }, { status: 400 })

    const { notebook, page, topics, views, markdown } = parsed.data
    if (page.id !== pageId) return Response.json({ error: "Page identifier mismatch." }, { status: 400 })

    const existing = await loadPageById(auth.supabase, auth.userId, pageId)
    const isCreate = !existing

    let notebookPayload = notebook

    if (isCreate) {
        if (notebookPayload) {
            if (notebookPayload.id !== page.notebookId) return Response.json({ error: "Notebook mismatch." }, { status: 400 })
            if (notebookPayload.userId !== auth.userId) return Response.json({ error: "Notebook mismatch." }, { status: 400 })
        } else {
            const notebooks = await listNotebooksForUser(auth.supabase, auth.userId)
            notebookPayload = notebooks.find(item => item.id === page.notebookId)
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
    await upsertPages(auth.supabase, auth.userId, [
        {
            page,
            notebookId: page.notebookId,
            topics,
            views,
            contentObjectKey: objectKey,
        },
    ])

    if (typeof markdown === "string") {
        await savePageMarkdown({ supabase: auth.supabase, userId: auth.userId }, { notebookId: page.notebookId, id: page.id }, markdown, objectKey)
    }

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
