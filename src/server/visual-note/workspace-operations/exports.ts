import { ensureUniqueSlug, findOwnedView, normalizeWorkspace } from "./read-model"
import { findOwnedNotebook, findOwnedPage } from "./selectors"
import { createId, defaultEditorSettings, invalidInput, notFound, ok, safeTrim, slugify } from "./result"
import { createExportDocument, Notebook, NotebookEditorSettings, renderMarkdownExport, renderWebHtml, VisualNoteWorkspace } from "./types"
import { sanitizeSnapshotWorkspace } from "@/server/visual-note/workspace-snapshot-store"

export const exportNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; format?: "markdown" | "web" }) => {
    const context = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!context) return notFound("Notebook not found.")

    const document = createExportDocument({
        scope: "notebook",
        selection: {
            notebookId: context.id,
            pageId: "",
            topicId: "",
            viewId: "",
        },
        workspace,
    })
    if (!document) return invalidInput("Unable to build export document.")

    if (input.format === "web") {
        const rendered = renderWebHtml(document, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
        return ok({
            format: "web",
            notebookId: context.id,
            notebookTitle: context.title,
            html: rendered,
            warnings: [],
        })
    }

    const markdown = renderMarkdownExport(document, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
    return ok({
        format: "markdown",
        notebookId: context.id,
        notebookTitle: context.title,
        markdown,
        html: "",
        warnings: [],
    })
}

export const exportPage = (workspace: VisualNoteWorkspace, userId: string, input: { pageId: string; format?: "markdown" | "web" }) => {
    const context = findOwnedPage(workspace, userId, input.pageId)
    if (!context) return notFound("Page not found.")
    const document = createExportDocument({
        scope: "page",
        selection: { notebookId: context.notebook.id, pageId: context.page.id, topicId: "", viewId: "" },
        workspace,
    })
    if (!document) return invalidInput("Unable to build export document.")
    if (input.format === "web") {
        const rendered = renderWebHtml(document, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
        return ok({
            format: "web",
            pageId: context.page.id,
            notebookId: context.notebook.id,
            html: rendered,
            warnings: [],
        })
    }

    const markdown = renderMarkdownExport(document, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
    return ok({
        format: "markdown",
        pageId: context.page.id,
        notebookId: context.notebook.id,
        markdown,
        html: "",
        warnings: [],
    })
}

export const exportView = (workspace: VisualNoteWorkspace, userId: string, input: { viewId: string; format?: "markdown" | "web" }) => {
    const context = findOwnedView(workspace, userId, input.viewId)
    if (!context) return notFound("View not found.")
    const page = createExportDocument({
        scope: "page",
        selection: {
            notebookId: context.notebook.id,
            pageId: context.page.id,
            topicId: context.topic.id,
            viewId: context.view.id,
        },
        workspace,
    })
    if (!page) return invalidInput("Unable to build export document.")

    if (input.format === "web") {
        const html = renderWebHtml(page, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
        return ok({ format: "web", viewId: context.view.id, html, notebookId: context.notebook.id, warnings: [] })
    }

    const markdown = renderMarkdownExport(page, { assetMode: "ignore", assetResolution: { assets: [], assetBySource: new Map(), warnings: [] } })
    return ok({
        format: "markdown",
        viewId: context.view.id,
        markdown,
        html: "",
        notebookId: context.notebook.id,
        warnings: [],
    })
}

export const publishNotebook = (workspace: VisualNoteWorkspace, userId: string, input: { notebookId: string; publish: boolean }) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const next = {
        ...notebook,
        published: input.publish,
        publishedAt: input.publish ? new Date().toISOString() : undefined,
    }
    return ok({
        workspace: {
            ...workspace,
            notebooks: workspace.notebooks.map(item => (item.id === next.id ? next : item)),
        },
        notebook: next,
    })
}

export const unpublishNotebook = (workspace: VisualNoteWorkspace, userId: string, notebookId: string) => publishNotebook(workspace, userId, { notebookId, publish: false })

export const setNotebookMetadata = (
    workspace: VisualNoteWorkspace,
    userId: string,
    input: { notebookId: string; title?: string; summary?: string; color?: string; slug?: string; editorSettings?: NotebookEditorSettings },
) => {
    const notebook = findOwnedNotebook(workspace, userId, input.notebookId)
    if (!notebook) return notFound("Notebook not found.")

    const next: Notebook = {
        ...notebook,
        title: safeTrim(input.title) || notebook.title,
        summary: input.summary ?? notebook.summary,
        color: safeTrim(input.color) || notebook.color,
        slug: input.slug ? ensureUniqueSlug(workspace, slugify(input.slug), userId) : notebook.slug,
        editorSettings: input.editorSettings ?? notebook.editorSettings ?? defaultEditorSettings,
    }

    if (!next.editorSettings) next.editorSettings = defaultEditorSettings
    return ok({
        workspace: {
            ...workspace,
            notebooks: workspace.notebooks.map(item => (item.id === next.id ? next : item)),
        },
        notebook: next,
    })
}

export const snapshotWorkspace = (workspace: VisualNoteWorkspace, userId: string, input: { name: string; note?: string }) => {
    const normalized = normalizeWorkspace(workspace, userId)
    const snapshots = [...(normalized.snapshots ?? []).slice(-29)]
    const name = safeTrim(input.name) || `Snapshot ${new Date().toISOString()}`
    const snapshot = {
        id: `snapshot-${createId()}`,
        name,
        note: safeTrim(input.note),
        createdAt: new Date().toISOString(),
        workspace: sanitizeSnapshotWorkspace(normalized),
    }
    return ok({
        workspace: {
            ...workspace,
            snapshots: [...snapshots, snapshot],
        },
        snapshot,
    })
}

export const listWorkspaceSnapshots = (workspace: VisualNoteWorkspace, userId: string) => {
    if (!workspace.notebooks.some(notebook => notebook.userId === userId)) return notFound("No workspace for user.")
    return ok((workspace.snapshots ?? []).map(snapshot => ({ id: snapshot.id, name: snapshot.name, note: snapshot.note, createdAt: snapshot.createdAt })))
}

const restoreSnapshotWithCurrentContent = (snapshotWorkspace: VisualNoteWorkspace, currentWorkspace: VisualNoteWorkspace): VisualNoteWorkspace => {
    const currentPageContentById = new Map(currentWorkspace.pages.flatMap(page => (typeof page.content === "string" ? [[page.id, page.content] as const] : [])))
    const currentViewContentById = new Map(currentWorkspace.views.map(view => [view.id, view.content]))

    return {
        ...snapshotWorkspace,
        pages: snapshotWorkspace.pages.map(page => {
            const content = currentPageContentById.get(page.id)
            return typeof content === "string" ? { ...page, content } : page
        }),
        views: snapshotWorkspace.views.map(view => ({ ...view, content: currentViewContentById.get(view.id) ?? view.content })),
    }
}

export const restoreWorkspaceSnapshot = (workspace: VisualNoteWorkspace, userId: string, input: { snapshotId: string }) => {
    const normalized = normalizeWorkspace(workspace, userId)
    const snapshot = normalized.snapshots?.find(item => item.id === input.snapshotId)
    if (!snapshot) return notFound("Snapshot not found.")
    const restoredWorkspace = restoreSnapshotWithCurrentContent(snapshot.workspace, normalized)

    return ok({
        workspace: {
            ...restoredWorkspace,
            snapshots: normalized.snapshots,
        },
        restoredWorkspace,
    })
}
