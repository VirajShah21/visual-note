import { authenticateSupabaseRequest, userOwnsNotebook } from "@/lib/supabase/server"
import { loadPageById, makePageObjectKey } from "@/server/visual-note/page-store"
import { readPageMarkdown, savePageMarkdown } from "@/server/visual-note/page-content-store"

const parseContentBody = async (request: Request) => {
    const body = (await request.json().catch(() => null)) as { markdown?: string } | null
    if (!body || typeof body.markdown !== "string") return null

    return body.markdown
}

export const runtime = "nodejs"

export async function GET(request: Request, context: RouteContext<"/api/pages/[pageId]/content">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    const page = await loadPageById(auth.supabase, auth.userId, pageId)
    if (!page) return Response.json({ error: "Page not found." }, { status: 404 })
    if (!(await userOwnsNotebook(auth, page.notebook_id))) return Response.json({ error: "Page not found." }, { status: 404 })

    const markdown = await readPageMarkdown({ supabase: auth.supabase, userId: auth.userId }, pageId)
    if (markdown === null) return Response.json({ error: "Page content not found." }, { status: 404 })

    return Response.json({ pageId, markdown })
}

export async function PUT(request: Request, context: RouteContext<"/api/pages/[pageId]/content">) {
    const auth = await authenticateSupabaseRequest(request)
    if (auth instanceof Response) return auth

    const { pageId } = await context.params
    const page = await loadPageById(auth.supabase, auth.userId, pageId)
    if (!page) return Response.json({ error: "Page not found." }, { status: 404 })
    if (!(await userOwnsNotebook(auth, page.notebook_id))) return Response.json({ error: "Page not found." }, { status: 404 })

    const markdown = await parseContentBody(request)
    if (markdown === null) return Response.json({ error: "Invalid content payload." }, { status: 400 })

    const objectKey = makePageObjectKey(page.notebook_id, page.id)
    await savePageMarkdown({ supabase: auth.supabase, userId: auth.userId }, { notebookId: page.notebook_id, id: page.id }, markdown, objectKey)

    return Response.json({ pageId, contentObjectKey: objectKey })
}
