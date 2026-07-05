import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeWorkspace } from "@/lib/visual-note/factories"
import type { NotebookPage, NotebookView, Topic, VisualNoteWorkspace } from "@/lib/visual-note/types"
import { STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT } from "@/lib/visual-note/storage-messages"
import { deleteNotebooksNotIn, listNotebooksForUser, upsertNotebooks } from "@/server/visual-note/notebook-store"
import {
    deletePagesNotIn,
    hydratePageRowsWithMarkdown,
    hydrateWorkspaceFromPageRows,
    listPagesForUser,
    listPagesForUserByNotebooks,
    makePageObjectKey,
    upsertPages,
    type PageRow,
} from "@/server/visual-note/page-store"
import { deletePageMarkdown, readPageMarkdown, savePageMarkdown, savePageMarkdownIfConfigured } from "@/server/visual-note/page-content-store"
import { assertWorkspaceStoreReady } from "@/server/visual-note/workspace-readiness"
import { mergeWorkspaceFromBase } from "@/server/visual-note/workspace-merge"
import { listWorkspaceSnapshotsForUser, upsertWorkspaceSnapshotsForUser } from "@/server/visual-note/workspace-snapshot-store"
import { resolveWorkspaceRevision } from "@/server/visual-note/workspace-revision-store"
import {
    cleanupWorkspaceAssetOrphansForEveryUser,
    cleanupWorkspaceAssetOrphansForUser,
    type WorkspaceAssetCleanupResult,
    type WorkspaceAssetReconciliationResult,
} from "@/server/visual-note/workspace-asset-reconciliation-store"
import {
    pageMarkdownFromWorkspace,
    restorePreviousWorkspace,
    throwOwnershipConflict,
    throwWorkspaceConflict,
    throwWorkspaceIntegrityError,
    throwWorkspaceMergeConflict,
} from "@/server/visual-note/workspace-store-save-helpers"

type SupabaseRecord = {
    id: string
    user_id: string
}

export type WorkspaceSaveResult = {
    workspace: VisualNoteWorkspace
    warnings: string[]
}

export const cleanupWorkspaceAssetOrphans = async (
    supabase: SupabaseClient,
    userId: string,
    workspace?: VisualNoteWorkspace,
    deleteUpdatedBefore?: string,
): Promise<WorkspaceAssetCleanupResult> => cleanupWorkspaceAssetOrphansForUser(supabase, userId, loadWorkspaceForUser, workspace, deleteUpdatedBefore)

export const cleanupWorkspaceAssetOrphansForAllUsers = async (supabase: SupabaseClient, deleteUpdatedBefore?: string): Promise<WorkspaceAssetReconciliationResult> =>
    cleanupWorkspaceAssetOrphansForEveryUser(supabase, cleanupWorkspaceAssetOrphans, deleteUpdatedBefore)

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
    await assertWorkspaceStoreReady(supabase)

    const notebooks = await listNotebooksForUser(supabase, userId)
    if (notebooks.length === 0) return null

    const pageRows = await listPagesForUserByNotebooks(supabase, userId)

    const pageMarkdownEntries = await Promise.all(pageRows.map(async page => [page.id, await readPageMarkdown({ supabase, userId }, page.id)] as const))
    const hydratedPageRows = hydratePageRowsWithMarkdown(pageRows, new Map(pageMarkdownEntries))
    const { pages, topics, views } = hydrateWorkspaceFromPageRows(hydratedPageRows)
    const orderedPages = [...pages].sort((first, second) => {
        if (first.notebookId === second.notebookId) return first.position - second.position
        return first.notebookId.localeCompare(second.notebookId)
    })

    const pageMarkdownById = new Map(pageMarkdownEntries)
    const pagesWithContent = orderedPages.map(page => ({
        ...page,
        content: pageMarkdownById.get(page.id) ?? undefined,
    }))

    return {
        notebooks,
        pages: pagesWithContent,
        topics,
        views,
        snapshots: await listWorkspaceSnapshotsForUser(supabase, userId),
    }
}

export const saveWorkspaceForUser = async (
    supabase: SupabaseClient,
    userId: string,
    workspace: VisualNoteWorkspace,
    expectedRevision?: string,
    baseWorkspace?: VisualNoteWorkspace,
): Promise<WorkspaceSaveResult> => {
    await assertWorkspaceStoreReady(supabase)

    const saveStartedAt = new Date().toISOString()
    const previousWorkspace = await loadWorkspaceForUser(supabase, userId)
    let normalizedWorkspace = normalizeWorkspace(workspace)
    const existingPages = await listPagesForUser(supabase, userId)
    const existingPageById = new Map(existingPages.map(page => [page.id, page]))
    if (expectedRevision) {
        const currentRevision = await resolveWorkspaceRevision(supabase, userId)
        if (currentRevision !== expectedRevision) {
            if (!baseWorkspace) throwWorkspaceConflict()
            const base = baseWorkspace as VisualNoteWorkspace
            const currentWorkspace = await loadWorkspaceForUser(supabase, userId)
            const merged = mergeWorkspaceFromBase(
                normalizeWorkspace(base),
                normalizeWorkspace(currentWorkspace ?? { notebooks: [], pages: [], topics: [], views: [] }),
                normalizedWorkspace,
            )
            if (merged.ok) normalizedWorkspace = normalizeWorkspace(merged.workspace)
            else throwWorkspaceMergeConflict(merged.conflicts)
        }
    }

    const invalidNotebookIds = normalizedWorkspace.notebooks.filter(item => item.userId !== userId).map(item => item.id)
    throwWorkspaceIntegrityError(invalidNotebookIds.map(notebookId => `notebook:${notebookId} belongs to a different user`))

    const notebookIds = new Set<string>(normalizedWorkspace.notebooks.filter(item => item.userId === userId).map(item => item.id))
    const orphanedPageIds = normalizedWorkspace.pages.filter(page => !notebookIds.has(page.notebookId)).map(page => page.id)
    throwWorkspaceIntegrityError(orphanedPageIds.map(pageId => `page:${pageId} references unauthorized or unknown notebook`))

    const pageIds = new Set<string>(normalizedWorkspace.pages.filter(page => notebookIds.has(page.notebookId)).map(page => page.id))
    const orphanedTopicIds = normalizedWorkspace.topics.filter(topic => !pageIds.has(topic.pageId)).map(topic => topic.id)
    throwWorkspaceIntegrityError(orphanedTopicIds.map(topicId => `topic:${topicId} references unauthorized or unknown page`))

    const topicIds = new Set<string>(normalizedWorkspace.topics.filter(topic => pageIds.has(topic.pageId)).map(topic => topic.id))
    const orphanedViewIds = normalizedWorkspace.views.filter(view => !topicIds.has(view.topicId)).map(view => view.id)
    throwWorkspaceIntegrityError(orphanedViewIds.map(viewId => `view:${viewId} references unauthorized or unknown topic`))

    await assertNoForeignOwnedRecords(supabase, userId, [...notebookIds], "visual_note_notebooks")
    await assertNoForeignOwnedRecords(supabase, userId, [...pageIds], "visual_note_pages")

    const relevantPages = normalizedWorkspace.pages.filter((entry: NotebookPage) => notebookIds.has(entry.notebookId))
    const storageWarningPages = new Set<string>()
    const preparedPages: Array<{
        page: NotebookPage
        notebookId: string
        topics: Topic[]
        views: NotebookView[]
        contentObjectKey: string
        existingPage?: PageRow
        savedContent: boolean
        previousContent: string | null
    }> = []

    for (const page of relevantPages) {
        const contentObjectKey = makePageObjectKey(page.notebookId, page.id)
        const topics = normalizedWorkspace.topics.filter(topic => topic.pageId === page.id)
        const topicIds = new Set<string>(topics.map(topic => topic.id))
        const views = normalizedWorkspace.views.filter(view => topicIds.has(view.topicId))
        const markdown = await pageMarkdownFromWorkspace(normalizedWorkspace, page.id)
        const existingPage = existingPageById.get(page.id)
        const previousContent = existingPage ? await readPageMarkdown({ supabase, userId }, page.id) : null
        let savedContent = false

        try {
            savedContent = (await savePageMarkdownIfConfigured({ supabase, userId }, { notebookId: page.notebookId, id: page.id }, markdown, contentObjectKey)).saved
            if (!savedContent) storageWarningPages.add(page.id)
        } catch (error) {
            if (savedContent)
                if (previousContent === null) await deletePageMarkdown({ supabase, userId }, { notebookId: page.notebookId, id: page.id }, contentObjectKey).catch(() => {})
                else
                    await savePageMarkdown(
                        { supabase, userId },
                        { notebookId: existingPage?.notebook_id ?? page.notebookId, id: page.id },
                        previousContent,
                        existingPage?.content_object_key ?? contentObjectKey,
                    ).catch(() => {})

            for (const prepared of preparedPages) {
                if (!prepared.savedContent) continue

                const originalNotebookId = prepared.existingPage?.notebook_id ?? prepared.notebookId
                if (prepared.previousContent === null)
                    await deletePageMarkdown({ supabase, userId }, { notebookId: prepared.notebookId, id: prepared.page.id }, prepared.contentObjectKey).catch(() => {})
                else
                    await savePageMarkdown(
                        { supabase, userId },
                        { notebookId: originalNotebookId, id: prepared.page.id },
                        prepared.previousContent,
                        prepared.existingPage?.content_object_key ?? prepared.contentObjectKey,
                    ).catch(() => {})
            }

            await restorePreviousWorkspace(supabase, userId, saveStartedAt, previousWorkspace).catch(() => {})
            throw error
        }

        preparedPages.push({ page, notebookId: page.notebookId, topics, views, contentObjectKey, existingPage, savedContent, previousContent })
    }

    try {
        await upsertNotebooks(supabase, userId, normalizedWorkspace.notebooks)
        await upsertPages(
            supabase,
            userId,
            preparedPages.map(page => ({
                page: page.page,
                notebookId: page.notebookId,
                topics: page.topics,
                views: page.views,
                contentObjectKey: page.contentObjectKey,
                persistViewContent: !page.savedContent,
            })),
        )
    } catch (error) {
        for (const prepared of preparedPages) {
            if (!prepared.savedContent) continue

            if (prepared.previousContent === null)
                await deletePageMarkdown({ supabase, userId }, { notebookId: prepared.notebookId, id: prepared.page.id }, prepared.contentObjectKey).catch(() => {})
            else
                await savePageMarkdown(
                    { supabase, userId },
                    { notebookId: prepared.existingPage?.notebook_id ?? prepared.notebookId, id: prepared.page.id },
                    prepared.previousContent,
                    prepared.existingPage?.content_object_key ?? prepared.contentObjectKey,
                ).catch(() => {})
        }

        await restorePreviousWorkspace(supabase, userId, saveStartedAt, previousWorkspace).catch(() => {})
        throw error
    }

    for (const prepared of preparedPages)
        if (prepared.existingPage?.content_object_key && prepared.existingPage.content_object_key !== prepared.contentObjectKey)
            await deletePageMarkdown({ supabase, userId }, { notebookId: prepared.existingPage.notebook_id, id: prepared.page.id }, prepared.existingPage.content_object_key).catch(
                () => {},
            )

    try {
        const deletedPages = await deletePagesNotIn(supabase, userId, pageIds, saveStartedAt)
        await Promise.allSettled(
            deletedPages.map(page => deletePageMarkdown({ supabase, userId }, { notebookId: page.notebook_id, id: page.id }, page.content_object_key).catch(() => {})),
        )
        await cleanupWorkspaceAssetOrphans(supabase, userId, normalizedWorkspace, saveStartedAt)
        await deleteNotebooksNotIn(supabase, userId, notebookIds, saveStartedAt)
        await upsertWorkspaceSnapshotsForUser(supabase, userId, normalizedWorkspace.snapshots)
    } catch (error) {
        await restorePreviousWorkspace(supabase, userId, saveStartedAt, previousWorkspace).catch(() => {})
        throw error
    }

    const warnings =
        storageWarningPages.size > 0
            ? [
                  `${storageWarningPages.size} page${storageWarningPages.size === 1 ? "" : "s"} did not persist markdown content because notebook storage is not configured.`,
                  STORAGE_CONTENT_WARNING,
                  STORAGE_SETUP_HINT,
              ]
            : []

    return { workspace: normalizedWorkspace, warnings }
}

export const loadPageMarkdownForUser = async (supabase: SupabaseClient, userId: string, pageId: string): Promise<string | null> => {
    return await readPageMarkdown({ supabase, userId }, pageId)
}
