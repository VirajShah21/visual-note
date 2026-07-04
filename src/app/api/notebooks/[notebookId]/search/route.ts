import { authenticateSupabaseRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { searchNotebookForUser } from "@/server/visual-note/notebook-search-store"
import { parseSearchRequest } from "./route-contract"

export const runtime = "nodejs"

type Authenticated = { supabase: Parameters<typeof searchNotebookForUser>[0]; userId: string }

export type NotebookSearchRouteDependencies = {
    authenticateSupabaseRequest: typeof authenticateSupabaseRequest
    parseSearchRequest: typeof parseSearchRequest
    searchNotebookForUser: typeof searchNotebookForUser
    userOwnsNotebook: typeof userOwnsNotebook
}

const defaultNotebookSearchRouteDependencies: NotebookSearchRouteDependencies = {
    authenticateSupabaseRequest,
    parseSearchRequest,
    searchNotebookForUser,
    userOwnsNotebook,
}

export const runSearchGet = async (auth: Authenticated, request: Request, notebookId: string, dependencies = defaultNotebookSearchRouteDependencies) => {
    if (!(await dependencies.userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })

    try {
        const parsed = dependencies.parseSearchRequest(request)
        if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })

        const response = await dependencies.searchNotebookForUser(auth.supabase, auth.userId, notebookId, {
            currentPageId: parsed.input.currentPageId,
            limit: parsed.input.limit,
            offset: parsed.input.offset,
            query: parsed.input.query,
        })

        return Response.json(response)
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to search notebook." }, { status: 500 })
    }
}

export async function GET(request: Request, context: RouteContext<"/api/notebooks/[notebookId]/search">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    return runSearchGet(auth, request, notebookId)
}
