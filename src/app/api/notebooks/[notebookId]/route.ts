import { z } from "zod"
import { authenticateSupabaseRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { loadWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { upsertNotebooks } from "@/server/visual-note/notebook-store"

const notebookUpdateSchema = z.object({
    title: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    summary: z.string().optional(),
    color: z.string().optional(),
    editorSettings: z.record(z.unknown()).optional(),
})

export const runtime = "nodejs"

export async function GET(request: Request, context: RouteContext<"/api/notebooks/[notebookId]">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    if (!(await userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })

    const workspace = await loadWorkspaceForUser(auth.supabase, auth.userId)
    if (!workspace) return Response.json({ error: "Notebook not found." }, { status: 404 })

    const notebook = workspace.notebooks.find(item => item.id === notebookId && item.userId === auth.userId)
    if (!notebook) return Response.json({ error: "Notebook not found." }, { status: 404 })

    const pages = workspace.pages
        .filter(page => page.notebookId === notebookId)
        .sort((a, b) => a.position - b.position)
        .map(page => {
            const topics = workspace.topics.filter(topic => topic.pageId === page.id)
            const topicIds = new Set(topics.map(topic => topic.id))
            const views = workspace.views.filter(view => topicIds.has(view.topicId))
            return { ...page, topics, views }
        })

    return Response.json({ notebook, pages })
}

export async function PUT(request: Request, context: RouteContext<"/api/notebooks/[notebookId]">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    if (!(await userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })

    const workspace = await loadWorkspaceForUser(auth.supabase, auth.userId)
    const notebook = workspace?.notebooks.find(item => item.id === notebookId && item.userId === auth.userId)
    if (!notebook) return Response.json({ error: "Notebook not found." }, { status: 404 })

    const payload = (await request.json()) as z.infer<typeof notebookUpdateSchema>
    const parse = notebookUpdateSchema.safeParse(payload)
    if (!parse.success) return Response.json({ error: "Invalid notebook payload." }, { status: 400 })

    const next = {
        ...notebook,
        ...parse.data,
        id: notebook.id,
        userId: auth.userId,
    }

    await upsertNotebooks(auth.supabase, auth.userId, [next])

    const refreshed = await loadWorkspaceForUser(auth.supabase, auth.userId)
    if (!refreshed) return Response.json({ error: "Notebook not found." }, { status: 404 })

    const updated = refreshed.notebooks.find(item => item.id === notebookId)
    if (!updated) return Response.json({ error: "Notebook not found." }, { status: 404 })

    return Response.json({ notebook: updated })
}
