import type { SupabaseClient } from "@supabase/supabase-js"
import { parseArticleContent, serializeArticleContent } from "@/lib/visual-note/article-content"
import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { deleteNotebooksNotIn, upsertNotebooks } from "@/server/visual-note/notebook-store"
import { deletePagesNotIn, makePageObjectKey, pageTopicMarker, pageViewMarker, upsertPages } from "@/server/visual-note/page-store"
import { savePageMarkdownIfConfigured } from "@/server/visual-note/page-content-store"
import { upsertWorkspaceSnapshotsForUser } from "@/server/visual-note/workspace-snapshot-store"

export const pageMarkdownFromWorkspace = async (workspace: VisualNoteWorkspace, pageId: string) => {
    const page = workspace.pages.find(item => item.id === pageId)
    if (!page) return ""

    const chunks = [`# ${page.title}`]
    const topics = workspace.topics.filter(topic => topic.pageId === page.id).sort((first, second) => first.position - second.position)

    topics.forEach(topic => {
        chunks.push(pageTopicMarker(topic.id), `## ${topic.title}`)
        const topicViews = workspace.views.filter(view => view.topicId === topic.id)

        topicViews.forEach(view => {
            const content = view.content.trim() ? serializeArticleContent(parseArticleContent(view.content, 0).blocks) : ""
            chunks.push(pageViewMarker(view.id), `### ${view.title}`)
            if (content.trim()) chunks.push(content)
        })
    })

    return chunks.filter(chunk => chunk.trim()).join("\n\n")
}

export const throwOwnershipConflict = (resourceName: string, ids: string[]): never => {
    const error = new Error(`${resourceName} IDs belong to a different user: ${ids.join(", ")}`) as Error & { code: string }
    error.code = "ownership_conflict"
    throw error
}

export const throwWorkspaceConflict = (): never => {
    const error = new Error("Workspace was modified while editing. Reload before saving.") as Error & { code: string }
    error.code = "workspace_conflict"
    throw error
}

export const throwWorkspaceMergeConflict = (conflicts: string[]): never => {
    const error = new Error(`Workspace was modified in another session and could not be merged automatically. Conflicts: ${conflicts.join(", ")}`) as Error & { code: string }
    error.code = "workspace_conflict"
    throw error
}

export const throwWorkspaceIntegrityError = (issues: string[]): void => {
    if (issues.length === 0) return

    const error = new Error(`Workspace payload is malformed: ${issues.join(", ")}`) as Error & { code: string; issues: string[] }
    error.code = "workspace_integrity"
    error.issues = issues
    throw error
}

export const restorePreviousWorkspace = async (supabase: SupabaseClient, userId: string, saveStartedAt: string, snapshot: VisualNoteWorkspace | null) => {
    if (!snapshot) return

    const userNotebooks = snapshot.notebooks.filter(item => item.userId === userId)
    const snapshotNotebookIds = new Set(userNotebooks.map(notebook => notebook.id))
    const snapshotPages = snapshot.pages.filter(page => snapshotNotebookIds.has(page.notebookId))
    const snapshotPageIds = new Set(snapshotPages.map(page => page.id))
    const restoredMarkdownPageIds = new Set<string>()

    await upsertNotebooks(supabase, userId, userNotebooks)

    await Promise.allSettled(
        snapshotPages.map(async page => {
            if (typeof page.content !== "string") return

            const objectKey = makePageObjectKey(page.notebookId, page.id)
            const result = await savePageMarkdownIfConfigured({ supabase, userId }, { notebookId: page.notebookId, id: page.id }, page.content, objectKey)
            if (result.saved) restoredMarkdownPageIds.add(page.id)
        }),
    )

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
                persistViewContent: !restoredMarkdownPageIds.has(page.id),
            }
        }),
    )

    await deletePagesNotIn(supabase, userId, snapshotPageIds, saveStartedAt)
    await deleteNotebooksNotIn(supabase, userId, snapshotNotebookIds, saveStartedAt)
    await upsertWorkspaceSnapshotsForUser(supabase, userId, snapshot.snapshots)
}
