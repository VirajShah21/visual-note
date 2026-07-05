import { z } from "zod"
import { authenticateSupabaseMutationRequest, authenticateSupabaseRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { loadWorkspaceForUser } from "@/server/visual-note/workspace-store"
import { upsertNotebooks } from "@/server/visual-note/notebook-store"
import { normalizeNotebookEditorSettings } from "@/lib/visual-note/factories"

const editorSettingsSchema = z
    .object({
        blockInfo: z.enum(["show", "type-only", "metadata-only"]).optional(),
        contents: z.enum(["show", "hide-title", "hide"]).optional(),
        mode: z.enum(["editing", "source", "reader"]).optional(),
    })
    .partial()
    .optional()

const notebookUpdateSchema = z.object({
    title: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    summary: z.string().optional(),
    color: z.string().optional(),
    editorSettings: editorSettingsSchema,
})

export const runtime = "nodejs"

type Authenticated = { supabase: Parameters<typeof loadWorkspaceForUser>[0]; userId: string }
type NotebookRouteContext = { params: Promise<{ notebookId: string }> }

export type NotebookRouteDependencies = {
    authenticateSupabaseMutationRequest: typeof authenticateSupabaseMutationRequest
    authenticateSupabaseRequest: typeof authenticateSupabaseRequest
    loadWorkspaceForUser: typeof loadWorkspaceForUser
    normalizeNotebookEditorSettings: typeof normalizeNotebookEditorSettings
    userOwnsNotebook: typeof userOwnsNotebook
    upsertNotebooks: typeof upsertNotebooks
}

const defaultNotebookRouteDependencies: NotebookRouteDependencies = {
    authenticateSupabaseMutationRequest,
    authenticateSupabaseRequest,
    loadWorkspaceForUser,
    normalizeNotebookEditorSettings,
    userOwnsNotebook,
    upsertNotebooks,
}

const sortByPosition = <T extends { position?: number }>(rows: T[]) => [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

export const runNotebookGet = async (auth: Authenticated, notebookId: string, dependencies = defaultNotebookRouteDependencies) => {
    try {
        if (!(await dependencies.userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })

        const workspace = await dependencies.loadWorkspaceForUser(auth.supabase, auth.userId)
        if (!workspace) return Response.json({ error: "Notebook not found." }, { status: 404 })

        const notebook = workspace.notebooks.find(item => item.id === notebookId && item.userId === auth.userId)
        if (!notebook) return Response.json({ error: "Notebook not found." }, { status: 404 })

        const pages = sortByPosition(
            workspace.pages
                .filter(page => page.notebookId === notebookId)
                .map(page => {
                    const topics = sortByPosition(workspace.topics.filter(topic => topic.pageId === page.id))
                    const topicIds = new Set(topics.map(topic => topic.id))
                    const views = sortByPosition(workspace.views.filter(view => topicIds.has(view.topicId)))
                    return { ...page, topics, views }
                }),
        )

        return Response.json({ notebook, pages })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to load notebook." }, { status: 500 })
    }
}

export const runNotebookPut = async (auth: Authenticated, request: Request, notebookId: string, dependencies = defaultNotebookRouteDependencies) => {
    try {
        if (!(await dependencies.userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })

        const workspace = await dependencies.loadWorkspaceForUser(auth.supabase, auth.userId)
        const notebook = workspace?.notebooks.find(item => item.id === notebookId && item.userId === auth.userId)
        if (!notebook) return Response.json({ error: "Notebook not found." }, { status: 404 })

        let payload: unknown
        try {
            payload = await request.json()
        } catch {
            return Response.json({ error: "Invalid notebook payload." }, { status: 400 })
        }

        const parse = notebookUpdateSchema.safeParse(payload)
        if (!parse.success) return Response.json({ error: "Invalid notebook payload." }, { status: 400 })

        const editorSettings = parse.data.editorSettings ? dependencies.normalizeNotebookEditorSettings(parse.data.editorSettings) : notebook.editorSettings

        const next = {
            ...notebook,
            ...parse.data,
            id: notebook.id,
            userId: auth.userId,
            editorSettings,
        }

        await dependencies.upsertNotebooks(auth.supabase, auth.userId, [next])

        const refreshed = await dependencies.loadWorkspaceForUser(auth.supabase, auth.userId)
        if (!refreshed) return Response.json({ error: "Notebook not found." }, { status: 404 })

        const updated = refreshed.notebooks.find(item => item.id === notebookId)
        if (!updated) return Response.json({ error: "Notebook not found." }, { status: 404 })

        return Response.json({ notebook: updated })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to update notebook." }, { status: 500 })
    }
}

export async function GET(request: Request, context: NotebookRouteContext) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    return runNotebookGet(auth, notebookId)
}

export async function PUT(request: Request, context: NotebookRouteContext) {
    const auth = await authenticateSupabaseMutationRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    return runNotebookPut(auth, request, notebookId)
}
