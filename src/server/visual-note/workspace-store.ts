import type { SupabaseClient } from "@supabase/supabase-js"
import { createExportDocument } from "@/lib/visual-note/export/document"
import { renderMarkdownExport } from "@/lib/visual-note/export/markdown"
import { resolveExportAssets } from "@/lib/visual-note/export/assets"
import { normalizeWorkspace } from "@/lib/visual-note/factories"
import type { NotebookPage, NotebookView, Topic, VisualNoteWorkspace } from "@/lib/visual-note/types"
import { STORAGE_CONTENT_WARNING, STORAGE_SETUP_HINT } from "@/lib/visual-note/storage-messages"
import { deleteNotebooksNotIn, listNotebooksForUser, upsertNotebooks } from "@/server/visual-note/notebook-store"
import {
    deletePagesNotIn,
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
import { deleteAssetObjects, deleteAssetsNotInNotebooks, deleteAssetsNotReferencedByWorkspace } from "@/server/storage/notebook-asset-cleanup"

type SupabaseRecord = {
    id: string
    user_id: string
}

type WorkspaceAssetCleanupResult = {
    deletedReferencedAssets: number
    deletedMissingNotebookAssets: number
    deletedAssetRecords: number
}

type WorkspaceAssetReconciliationResult = {
    usersScanned: number
    deletedReferencedAssets: number
    deletedMissingNotebookAssets: number
    deletedAssetRecords: number
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

const throwOwnershipConflict = (resourceName: string, ids: string[]): never => {
    const error = new Error(`${resourceName} IDs belong to a different user: ${ids.join(", ")}`) as Error & { code: string }
    error.code = "ownership_conflict"
    throw error
}

const throwWorkspaceConflict = (): never => {
    const error = new Error("Workspace was modified while editing. Reload before saving.") as Error & { code: string }
    error.code = "workspace_conflict"
    throw error
}

const throwWorkspaceMergeConflict = (conflicts: string[]): never => {
    const error = new Error(`Workspace was modified in another session and could not be merged automatically. Conflicts: ${conflicts.join(", ")}`) as Error & { code: string }
    error.code = "workspace_conflict"
    throw error
}

const throwWorkspaceIntegrityError = (issues: string[]): void => {
    if (issues.length === 0) return

    const error = new Error(`Workspace payload is malformed: ${issues.join(", ")}`) as Error & { code: string; issues: string[] }
    error.code = "workspace_integrity"
    error.issues = issues
    throw error
}

export type WorkspaceSaveResult = {
    workspace: VisualNoteWorkspace
    warnings: string[]
}

const restorePreviousWorkspace = async (supabase: SupabaseClient, userId: string, saveStartedAt: string, snapshot: VisualNoteWorkspace | null) => {
    if (!snapshot) return

    const userNotebooks = snapshot.notebooks.filter(item => item.userId === userId)
    const snapshotNotebookIds = new Set(userNotebooks.map(notebook => notebook.id))
    const snapshotPages = snapshot.pages.filter(page => snapshotNotebookIds.has(page.notebookId))
    const snapshotPageIds = new Set(snapshotPages.map(page => page.id))

    await upsertNotebooks(supabase, userId, userNotebooks)
    await upsertPages(
        supabase,
        userId,
        snapshotPages.map(page => {
            const topics = snapshot.topics.filter(topic => topic.pageId === page.id)
            const topicIds = new Set(topics.map(topic => topic.id))
            const views = snapshot.views.filter(view => topicIds.has(view.topicId))

            return {
                page,
                notebookId: page.notebookId,
                topics,
                views,
                contentObjectKey: makePageObjectKey(page.notebookId, page.id),
            }
        }),
    )

    await Promise.allSettled(
        snapshotPages.map(async page => {
            if (typeof page.content !== "string") return

            const objectKey = makePageObjectKey(page.notebookId, page.id)
            const result = await savePageMarkdownIfConfigured({ supabase, userId }, { notebookId: page.notebookId, id: page.id }, page.content, objectKey)
            if (!result.saved) return
        }),
    )

    await deletePagesNotIn(supabase, userId, snapshotPageIds, saveStartedAt)
    await deleteNotebooksNotIn(supabase, userId, snapshotNotebookIds, saveStartedAt)
    await upsertWorkspaceSnapshotsForUser(supabase, userId, snapshot.snapshots)
}

const normalizeRevisionTimestamp = (value: string | null | undefined) => value ?? "0"

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

export const cleanupWorkspaceAssetOrphans = async (
    supabase: SupabaseClient,
    userId: string,
    workspace?: VisualNoteWorkspace,
    deleteUpdatedBefore?: string,
): Promise<WorkspaceAssetCleanupResult> => {
    const current = workspace ?? (await loadWorkspaceForUser(supabase, userId))
    if (!current)
        return {
            deletedReferencedAssets: 0,
            deletedMissingNotebookAssets: 0,
            deletedAssetRecords: 0,
        }

    const notebookIds = new Set<string>(current.notebooks.filter(notebook => notebook.userId === userId).map(notebook => notebook.id))
    if (notebookIds.size === 0)
        return {
            deletedReferencedAssets: 0,
            deletedMissingNotebookAssets: 0,
            deletedAssetRecords: 0,
        }

    const deletedUnreferencedAssets = await deleteAssetsNotReferencedByWorkspace(supabase, userId, current, deleteUpdatedBefore)
    await deleteAssetObjects(deletedUnreferencedAssets)

    const deletedAssets = await deleteAssetsNotInNotebooks(supabase, userId, notebookIds, deleteUpdatedBefore)
    await deleteAssetObjects(deletedAssets)

    return {
        deletedReferencedAssets: deletedUnreferencedAssets.length,
        deletedMissingNotebookAssets: deletedAssets.length,
        deletedAssetRecords: deletedUnreferencedAssets.length + deletedAssets.length,
    }
}

const listUserIdsWithAssetRecords = async (supabase: SupabaseClient) => {
    const userIds = new Set<string>()
    const pageSize = 500
    let page = 0

    while (true) {
        const start = page * pageSize
        const end = start + pageSize - 1
        const { data, error } = await supabase.from("visual_note_assets").select("user_id").range(start, end)
        if (error) throw error

        if (!data || data.length === 0) return [...userIds]

        data.forEach(row => {
            if (typeof (row as { user_id?: string }).user_id === "string") userIds.add((row as { user_id: string }).user_id)
        })

        if (data.length < pageSize) break
        page += 1
    }

    return [...userIds]
}

export const cleanupWorkspaceAssetOrphansForAllUsers = async (supabase: SupabaseClient, deleteUpdatedBefore?: string): Promise<WorkspaceAssetReconciliationResult> => {
    const userIds = await listUserIdsWithAssetRecords(supabase)
    let deletedReferencedAssets = 0
    let deletedMissingNotebookAssets = 0

    for (const userId of userIds) {
        const summary = await cleanupWorkspaceAssetOrphans(supabase, userId, undefined, deleteUpdatedBefore)
        deletedReferencedAssets += summary.deletedReferencedAssets
        deletedMissingNotebookAssets += summary.deletedMissingNotebookAssets
    }

    return {
        usersScanned: userIds.length,
        deletedReferencedAssets,
        deletedMissingNotebookAssets,
        deletedAssetRecords: deletedReferencedAssets + deletedMissingNotebookAssets,
    }
}

export const resolveWorkspaceRevision = async (supabase: SupabaseClient, userId: string) => {
    await assertWorkspaceStoreReady(supabase)

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
    await assertWorkspaceStoreReady(supabase)

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

    for (const prepared of preparedPages) {
        if (prepared.existingPage?.content_object_key && prepared.existingPage.content_object_key !== prepared.contentObjectKey)
            await deletePageMarkdown({ supabase, userId }, { notebookId: prepared.existingPage.notebook_id, id: prepared.page.id }, prepared.existingPage.content_object_key).catch(() => {})
    }

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
