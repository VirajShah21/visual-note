import type { SupabaseClient } from "@supabase/supabase-js"
import { createExportDocument } from "@/lib/visual-note/export/document"
import { renderMarkdownExport } from "@/lib/visual-note/export/markdown"
import { resolveExportAssets } from "@/lib/visual-note/export/assets"
import { normalizeWorkspace } from "@/lib/visual-note/factories"
import type { NotebookPage, VisualNoteWorkspace } from "@/lib/visual-note/types"
import { deleteNotebooksNotIn, listNotebooksForUser, upsertNotebooks } from "@/server/visual-note/notebook-store"
import { deletePagesNotIn, hydrateWorkspaceFromPageRows, listPagesForUser, listPagesForUserByNotebooks, makePageObjectKey, upsertPages } from "@/server/visual-note/page-store"
import { deletePageMarkdown, readPageMarkdown, savePageMarkdown, savePageMarkdownIfConfigured } from "@/server/visual-note/page-content-store"
import { deleteAssetsNotInNotebooks, deleteAssetsNotReferencedByWorkspace } from "@/server/storage/notebook-asset-cleanup"
import { deleteS3Object } from "@/server/storage/s3"

type SupabaseRecord = {
    id: string
    user_id: string
}

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

const throwOwnershipConflict = (resourceName: string, ids: string[]) => {
    const error = new Error(`${resourceName} IDs belong to a different user: ${ids.join(", ")}`) as Error & { code: string }
    error.code = "ownership_conflict"
    throw error
}

const throwWorkspaceConflict = () => {
    const error = new Error("Workspace was modified while editing. Reload before saving.") as Error & { code: string }
    error.code = "workspace_conflict"
    throw error
}

const normalizeRevisionTimestamp = (value: string | null | undefined) => value ?? "0"

type DeletedAsset = Awaited<ReturnType<typeof deleteAssetsNotInNotebooks>>[number]

const deleteAssetObjects = (assets: DeletedAsset[]) =>
    Promise.allSettled(
        assets.map(asset =>
            asset.connection
                ? deleteS3Object({
                      bucketName: asset.bucketName,
                      connection: asset.connection,
                      objectKey: asset.objectKey,
                  }).catch(() => {})
                : Promise.resolve(),
        ),
    )

const latestUpdatedAt = async (supabase: SupabaseClient, userId: string, table: "visual_note_notebooks" | "visual_note_pages") => {
    const { data, error } = await supabase.from(table).select("updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle()
    if (error) throw error

    return normalizeRevisionTimestamp((data as { updated_at?: string } | null)?.updated_at)
}

const rowCount = async (supabase: SupabaseClient, userId: string, table: "visual_note_notebooks" | "visual_note_pages") => {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId)
    if (error) throw error

    return count ?? 0
}

export const resolveWorkspaceRevision = async (supabase: SupabaseClient, userId: string) => {
    const [notebookUpdatedAt, pageUpdatedAt, notebookCount, pageCount] = await Promise.all([
        latestUpdatedAt(supabase, userId, "visual_note_notebooks"),
        latestUpdatedAt(supabase, userId, "visual_note_pages"),
        rowCount(supabase, userId, "visual_note_notebooks"),
        rowCount(supabase, userId, "visual_note_pages"),
    ])

    return `v1|notebooks:${notebookCount}:${notebookUpdatedAt}|pages:${pageCount}:${pageUpdatedAt}`
}

export const loadWorkspaceForUserWithRevision = async (supabase: SupabaseClient, userId: string) => {
    const [workspace, revision] = await Promise.all([loadWorkspaceForUser(supabase, userId), resolveWorkspaceRevision(supabase, userId)])

    return { workspace, revision }
}

const assertNoForeignOwnedRecords = async (supabase: SupabaseClient, userId: string, ids: string[], table: "visual_note_notebooks" | "visual_note_pages") => {
    if (ids.length === 0) return

    const { data, error } = await supabase.from(table).select("id,user_id").in("id", ids)
    if (error) throw error

    const foreignIds = (data ?? []).filter((record: SupabaseRecord) => record.user_id !== userId).map(record => record.id)
    if (foreignIds.length > 0) throwOwnershipConflict(table, foreignIds)
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

export const saveWorkspaceForUser = async (supabase: SupabaseClient, userId: string, workspace: VisualNoteWorkspace, expectedRevision?: string) => {
    const saveStartedAt = new Date().toISOString()
    const normalizedWorkspace = normalizeWorkspace(workspace)
    const existingPages = await listPagesForUser(supabase, userId)
    const existingPageById = new Map(existingPages.map(page => [page.id, page]))
    if (expectedRevision) {
        const currentRevision = await resolveWorkspaceRevision(supabase, userId)
        if (currentRevision !== expectedRevision) throwWorkspaceConflict()
    }

    const notebookIds = new Set<string>(normalizedWorkspace.notebooks.filter(item => item.userId === userId).map(item => item.id))
    const pageIds = new Set<string>(normalizedWorkspace.pages.filter(page => notebookIds.has(page.notebookId)).map(page => page.id))

    await assertNoForeignOwnedRecords(supabase, userId, [...notebookIds], "visual_note_notebooks")
    await assertNoForeignOwnedRecords(supabase, userId, [...pageIds], "visual_note_pages")

    await upsertNotebooks(supabase, userId, normalizedWorkspace.notebooks)

    for (const page of normalizedWorkspace.pages.filter((entry: NotebookPage) => notebookIds.has(entry.notebookId))) {
        const contentObjectKey = makePageObjectKey(page.notebookId, page.id)
        const topics = normalizedWorkspace.topics.filter(topic => topic.pageId === page.id)
        const topicIds = new Set<string>(topics.map(topic => topic.id))
        const views = normalizedWorkspace.views.filter(view => topicIds.has(view.topicId))
        const markdown = await pageMarkdownFromWorkspace(normalizedWorkspace, page.id)
        const existingPage = existingPageById.get(page.id)
        const existingNotebookId = existingPage?.notebook_id ?? page.notebookId
        const previousContent = existingPage ? await readPageMarkdown({ supabase, userId }, page.id) : null
        let savedContent = false

        try {
            savedContent = (await savePageMarkdownIfConfigured({ supabase, userId }, { notebookId: page.notebookId, id: page.id }, markdown, contentObjectKey)).saved
            await upsertPages(supabase, userId, [
                {
                    page,
                    notebookId: page.notebookId,
                    topics,
                    views,
                    contentObjectKey,
                },
            ])
        } catch (error) {
            if (savedContent && existingPage) {
                if (previousContent === null) await deletePageMarkdown({ supabase, userId }, { notebookId: page.notebookId, id: page.id }, contentObjectKey).catch(() => {})
                else await savePageMarkdown({ supabase, userId }, { notebookId: existingNotebookId, id: page.id }, previousContent, existingPage.content_object_key).catch(() => {})

                if (existingPage.content_object_key !== contentObjectKey)
                    await deletePageMarkdown({ supabase, userId }, { notebookId: page.notebookId, id: page.id }, contentObjectKey).catch(() => {})
            } else if (savedContent) await deletePageMarkdown({ supabase, userId }, { notebookId: page.notebookId, id: page.id }, contentObjectKey).catch(() => {})

            throw error
        }

        if (existingPage?.content_object_key && existingPage?.content_object_key !== contentObjectKey)
            await deletePageMarkdown({ supabase, userId }, { notebookId: existingNotebookId, id: page.id }, existingPage.content_object_key).catch(() => {})
    }

    const deletedPages = await deletePagesNotIn(supabase, userId, pageIds, saveStartedAt)
    await Promise.allSettled(
        deletedPages.map(page => deletePageMarkdown({ supabase, userId }, { notebookId: page.notebook_id, id: page.id }, page.content_object_key).catch(() => {})),
    )
    const deletedUnreferencedAssets = await deleteAssetsNotReferencedByWorkspace(supabase, userId, normalizedWorkspace, saveStartedAt)
    await deleteAssetObjects(deletedUnreferencedAssets)

    const deletedAssets = await deleteAssetsNotInNotebooks(supabase, userId, notebookIds, saveStartedAt)
    await deleteAssetObjects(deletedAssets)
    await deleteNotebooksNotIn(supabase, userId, notebookIds, saveStartedAt)

    return normalizedWorkspace
}

export const loadPageMarkdownForUser = async (supabase: SupabaseClient, userId: string, pageId: string): Promise<string | null> => {
    return await readPageMarkdown({ supabase, userId }, pageId)
}
