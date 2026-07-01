import type { SupabaseClient } from "@supabase/supabase-js"
import { createExportDocument } from "@/lib/visual-note/export/document"
import { renderMarkdownExport } from "@/lib/visual-note/export/markdown"
import { resolveExportAssets } from "@/lib/visual-note/export/assets"
import { normalizeWorkspace } from "@/lib/visual-note/factories"
import type { NotebookPage, VisualNoteWorkspace } from "@/lib/visual-note/types"
import { deleteNotebooksNotIn, listNotebooksForUser, upsertNotebooks } from "@/server/visual-note/notebook-store"
import { deletePagesNotIn, hydrateWorkspaceFromPageRows, listPagesForUserByNotebooks, makePageObjectKey, upsertPages } from "@/server/visual-note/page-store"
import { readPageMarkdown, savePageMarkdown } from "@/server/visual-note/page-content-store"

const pageSelection = (notebookId: string, pageId: string) => ({
    notebookId,
    pageId,
    topicId: "",
    viewId: "",
})

const pageMarkdownFromWorkspace = async (workspace: VisualNoteWorkspace, pageId: string) => {
    const page = workspace.pages.find(item => item.id === pageId)
    if (!page) return ""

    const document = createExportDocument({ scope: "page", selection: pageSelection(page.notebookId, page.id), workspace })
    if (!document) return ""

    const context = await resolveExportAssets(document, "ignore")
    return renderMarkdownExport(document, { assetMode: "ignore", assetResolution: context })
}

export const loadWorkspaceForUser = async (supabase: SupabaseClient, userId: string): Promise<VisualNoteWorkspace | null> => {
    const notebooks = await listNotebooksForUser(supabase, userId)
    if (notebooks.length === 0) return null

    const pageRows = await listPagesForUserByNotebooks(supabase, userId)

    const { pages, topics, views } = hydrateWorkspaceFromPageRows(pageRows)
    const orderedPages = [...pages].sort((first, second) => {
        if (first.notebookId === second.notebookId) return first.position - second.position
        return first.notebookId.localeCompare(second.notebookId)
    })

    const pagesWithContent = await Promise.all(
        orderedPages.map(async page => ({
            ...page,
            content: (await readPageMarkdown({ supabase, userId }, page.id)) ?? undefined,
        })),
    )

    return {
        notebooks,
        pages: pagesWithContent,
        topics,
        views,
    }
}

export const saveWorkspaceForUser = async (supabase: SupabaseClient, userId: string, workspace: VisualNoteWorkspace) => {
    const normalizedWorkspace = normalizeWorkspace(workspace)
    const notebookIds = new Set<string>(normalizedWorkspace.notebooks.filter(item => item.userId === userId).map(item => item.id))

    await upsertNotebooks(supabase, userId, normalizedWorkspace.notebooks)
    await deleteNotebooksNotIn(supabase, userId, notebookIds)

    await Promise.all(
        normalizedWorkspace.pages
            .filter((page: NotebookPage) => notebookIds.has(page.notebookId))
            .map(async page => {
                const contentObjectKey = makePageObjectKey(page.notebookId, page.id)
                const topics = normalizedWorkspace.topics.filter(topic => topic.pageId === page.id)
                const topicIds = new Set<string>(topics.map(topic => topic.id))
                const views = normalizedWorkspace.views.filter(view => topicIds.has(view.topicId))

                await upsertPages(supabase, userId, [
                    {
                        page,
                        notebookId: page.notebookId,
                        topics,
                        views,
                        contentObjectKey,
                    },
                ])

                const markdown = await pageMarkdownFromWorkspace(normalizedWorkspace, page.id)
                await savePageMarkdown({ supabase, userId }, { notebookId: page.notebookId, id: page.id }, markdown, contentObjectKey)
            }),
    )

    const pageIds = new Set<string>(normalizedWorkspace.pages.filter(page => notebookIds.has(page.notebookId)).map(page => page.id))
    await deletePagesNotIn(supabase, userId, pageIds)

    return normalizedWorkspace
}

export const loadPageMarkdownForUser = async (supabase: SupabaseClient, userId: string, pageId: string): Promise<string | null> => {
    const content = await readPageMarkdown({ supabase, userId }, pageId)
    return content
}
