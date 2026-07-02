import { z } from "zod"
import { authenticateSupabaseRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { normalizeNotebookEditorSettings } from "@/lib/visual-note/factories"
import { deletePageMarkdown, readPageMarkdown, savePageMarkdown, savePageMarkdownIfConfigured } from "@/server/visual-note/page-content-store"
import { listNotebooksForUser, upsertNotebooks } from "@/server/visual-note/notebook-store"
import { loadPageById, makePageObjectKey, upsertPages } from "@/server/visual-note/page-store"
import type { ComponentKind, Notebook } from "@/lib/visual-note/types"

const topicSchema = z.object({
    id: z.string(),
    pageId: z.string(),
    title: z.string(),
    summary: z.string(),
    position: z.number().int().nonnegative(),
})

const displaySchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    kind: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
})

const viewModeSchema = z.enum(["article", "structured", "dashboard"])

const editorSettingsSchema = z
    .object({
        blockInfo: z.enum(["show", "type-only", "metadata-only"]).optional(),
        contents: z.enum(["show", "hide-title", "hide"]).optional(),
        mode: z.enum(["editing", "source", "reader"]).optional(),
    })
    .partial()
    .optional()

const viewSchema = z.object({
    id: z.string(),
    topicId: z.string(),
    title: z.string(),
    mode: viewModeSchema,
    content: z.string(),
    displays: z.array(displaySchema),
})

type ParsedPageUpdate = z.infer<typeof pageUpdateSchema>

const isComponentKind = (value: string | undefined): value is ComponentKind =>
    value === "data-card" ||
    value === "checklist" ||
    value === "timeline" ||
    value === "dashboard" ||
    value === "work-logs" ||
    value === "bugs-list" ||
    value === "shopping-list" ||
    value === "pull-request" ||
    value === "url" ||
    value === "code-block"

const normalizeDisplay = (display: z.infer<typeof displaySchema>) => ({
    id: display.id ?? `display-${crypto.randomUUID()}`,
    name: display.name?.trim() || "Display",
    kind: isComponentKind(display.kind) ? display.kind : "data-card",
    data: display.data ?? {},
})

const parseDisplayInputs = (views: ParsedPageUpdate["views"]) =>
    views.map(view => ({
        ...view,
        displays: view.displays.map(display => normalizeDisplay(display)),
    }))

const notebookSchema = z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    color: z.string(),
    createdAt: z.string(),
    editorSettings: editorSettingsSchema,
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
