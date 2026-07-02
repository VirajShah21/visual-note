import type { SupabaseClient } from "@supabase/supabase-js"
import type { NotebookPage, NotebookView, Topic, VisualNoteWorkspace } from "@/lib/visual-note/types"

export type PageRow = {
    id: string
    user_id: string
    notebook_id: string
    title: string
    position: number
    content_object_key: string
    topics: Topic[]
    views: NotebookView[]
    created_at: string
}

export type PageSummary = {
    id: string
    notebookId: string
    title: string
    position: number
    contentObjectKey: string
}

export const makePageObjectKey = (notebookId: string, pageId: string) => `notebooks/${notebookId}/pages/${pageId}.md`

const toWorkspacePage = (row: PageRow): NotebookPage => ({
    id: row.id,
    notebookId: row.notebook_id,
    title: row.title,
    position: row.position,
})

const normalizeArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const toPageRows = (rows: Array<Record<string, unknown>> | null): PageRow[] =>
    (rows ?? []).map(row => ({
        id: row.id as string,
        user_id: row.user_id as string,
        notebook_id: row.notebook_id as string,
        title: row.title as string,
        position: row.position as number,
        content_object_key: row.content_object_key as string,
        topics: normalizeArray<Topic>(row.topics),
        views: normalizeArray<NotebookView>(row.views),
        created_at: (row.created_at as string) ?? "",
    }))

export const listPagesForUser = async (supabase: SupabaseClient, userId: string): Promise<PageRow[]> => {
    const { data, error } = await supabase
        .from("visual_note_pages")
        .select("id,user_id,notebook_id,title,position,content_object_key,topics,views,created_at")
        .eq("user_id", userId)
        .order("position")
    if (error) throw error

    return toPageRows(data as Array<Record<string, unknown>> | null)
}

export const listPagesForUserByNotebooks = async (supabase: SupabaseClient, userId: string): Promise<PageRow[]> => {
    const { data, error } = await supabase
        .from("visual_note_pages")
        .select("id,user_id,notebook_id,title,position,content_object_key,topics,views,created_at")
        .eq("user_id", userId)
        .order("notebook_id")
        .order("position")
    if (error) throw error

    return toPageRows(data as Array<Record<string, unknown>> | null)
}

export const listPagesByNotebook = async (supabase: SupabaseClient, userId: string, notebookId: string): Promise<PageRow[]> => {
    const { data, error } = await supabase
        .from("visual_note_pages")
        .select("id,user_id,notebook_id,title,position,content_object_key,topics,views,created_at")
        .eq("user_id", userId)
        .eq("notebook_id", notebookId)
        .order("position")
    if (error) throw error

    return toPageRows(data as Array<Record<string, unknown>> | null)
}

export const loadPageById = async (supabase: SupabaseClient, userId: string, pageId: string): Promise<PageRow | null> => {
    const { data, error } = await supabase
        .from("visual_note_pages")
        .select("id,user_id,notebook_id,title,position,content_object_key,topics,views,created_at")
        .eq("user_id", userId)
        .eq("id", pageId)
        .maybeSingle()
    if (error) throw error
    if (!data) return null

    return toPageRows([data as Record<string, unknown>])[0] ?? null
}

export const listPageIdsForUser = async (supabase: SupabaseClient, userId: string): Promise<string[]> => {
    const { data, error } = await supabase.from("visual_note_pages").select("id").eq("user_id", userId)
    if (error) throw error

    return (data ?? []).map(item => item.id as string)
}

type UpsertInput = {
    page: NotebookPage
    notebookId: string
    topics: Topic[]
    views: NotebookView[]
    contentObjectKey: string
}

export const upsertPages = async (supabase: SupabaseClient, userId: string, rows: UpsertInput[]) => {
    if (rows.length === 0) return

    const payload = rows.map(({ page, notebookId, topics, views, contentObjectKey }) => ({
        id: page.id,
        user_id: userId,
        notebook_id: notebookId,
        title: page.title,
        position: page.position,
        content_object_key: contentObjectKey,
        topics,
        views,
        updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from("visual_note_pages").upsert(payload, { onConflict: "id" })
    if (error) throw error
}

export const upsertPageFromWorkspace = (supabase: SupabaseClient, userId: string, workspace: VisualNoteWorkspace, pageId: string, contentObjectKey: string) => {
    const page = workspace.pages.find(item => item.id === pageId)
    if (!page) return Promise.resolve()

    const topics = workspace.topics.filter(topic => topic.pageId === page.id)
    const viewIds = new Set(topics.map(topic => topic.id))
    const views = workspace.views.filter(view => viewIds.has(view.topicId))

    return upsertPages(supabase, userId, [
        {
            page,
            notebookId: page.notebookId,
            topics,
            views,
            contentObjectKey,
        },
    ])
}

export const deletePagesNotIn = async (
    supabase: SupabaseClient,
    userId: string,
    allowedPageIds: Set<string>,
    deleteUpdatedBefore?: string,
) => {
    const ids = [...allowedPageIds]
    const staleBefore = deleteUpdatedBefore
    if (ids.length === 0) {
        let query = supabase.from("visual_note_pages").delete().eq("user_id", userId)
        if (staleBefore) query = query.lte("updated_at", staleBefore)
        const { error: clearError } = await query
        if (clearError) throw clearError
        return
    }

    let query = supabase
        .from("visual_note_pages")
        .delete()
        .eq("user_id", userId)
        .not("id", "in", `(${ids.map(id => `'${id}'`).join(",")})`)

    if (staleBefore) query = query.lte("updated_at", staleBefore)

    const { error } = await query
    if (error) throw error
}

export const toPageSummaries = (rows: PageRow[]): PageSummary[] =>
    rows.map(row => ({ id: row.id, notebookId: row.notebook_id, title: row.title, position: row.position, contentObjectKey: row.content_object_key }))

export const hydrateWorkspaceFromPageRows = (rows: PageRow[]) => {
    const pages = rows.map(toWorkspacePage)
    const topics = rows.flatMap(row => row.topics)
    const viewById = new Map<string, NotebookView>()

    rows.flatMap(row => row.views).forEach(view => {
        if (!viewById.has(view.id)) viewById.set(view.id, view)
    })

    return {
        pages,
        topics,
        views: [...viewById.values()],
    }
}
