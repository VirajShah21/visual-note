import { authenticateSupabaseRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { searchNotebookForUser } from "@/server/visual-note/notebook-search-store"

export const runtime = "nodejs"

const numericParam = (value: string | null) => {
    if (!value) return undefined

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(request: Request, context: RouteContext<"/api/notebooks/[notebookId]/search">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { notebookId } = await context.params
    if (!(await userOwnsNotebook(auth, notebookId))) return Response.json({ error: "Notebook not found." }, { status: 404 })

    const url = new URL(request.url)
    const query = url.searchParams.get("q") ?? ""
    const currentPageId = url.searchParams.get("currentPageId") ?? undefined

    try {
        const response = await searchNotebookForUser(auth.supabase, auth.userId, notebookId, {
            currentPageId,
            limit: numericParam(url.searchParams.get("limit")),
            offset: numericParam(url.searchParams.get("offset")),
            query,
        })

        return Response.json(response)
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to search notebook." }, { status: 500 })
    }
}
