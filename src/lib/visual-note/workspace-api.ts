import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { normalizeWorkspace } from "@/lib/visual-note/factories"
import { createExportDocument } from "@/lib/visual-note/export/document"
import { renderMarkdownExport } from "@/lib/visual-note/export/markdown"
import { resolveExportAssets } from "@/lib/visual-note/export/assets"

const parseError = async (response: Response, fallback: string) => {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return body?.error ?? fallback
}

type ApiWorkspaceEnvelope = {
    workspace?: VisualNoteWorkspace
    notebooks?: VisualNoteWorkspace["notebooks"]
    pages?: VisualNoteWorkspace["pages"]
    topics?: VisualNoteWorkspace["topics"]
    views?: VisualNoteWorkspace["views"]
}

const asVisualNoteWorkspace = (payload: ApiWorkspaceEnvelope | null): VisualNoteWorkspace | null => {
    const workspace = payload?.workspace ?? payload
    if (!workspace) return null

    const { notebooks, pages, topics, views } = workspace
    if (!Array.isArray(notebooks) || !Array.isArray(pages) || !Array.isArray(topics) || !Array.isArray(views)) return null

    return normalizeWorkspace({ notebooks, pages, topics, views, components: [] })
}

const pageSelection = (notebookId: string, pageId: string) => ({
    notebookId,
    pageId,
    topicId: "",
    viewId: "",
})

const serializePageMarkdown = async (workspace: VisualNoteWorkspace, pageId: string) => {
    const page = workspace.pages.find(item => item.id === pageId)
    if (!page) return ""

    const document = createExportDocument({
        scope: "page",
        selection: pageSelection(page.notebookId, page.id),
        workspace,
    })
    if (!document) return ""

    const context = await resolveExportAssets(document, "ignore")
    return renderMarkdownExport(document, {
        assetMode: "ignore",
        assetResolution: context,
    })
}

export const loadVisualNoteWorkspace = async (): Promise<VisualNoteWorkspace | null> => {
    const response = await fetch("/api/notebooks")
    if (response.status === 401) return null
    if (!response.ok) throw new Error(await parseError(response, "Unable to load workspace."))

    const body = (await response.json()) as ApiWorkspaceEnvelope
    return asVisualNoteWorkspace(body)
}

export const saveVisualNoteWorkspace = async (workspace: VisualNoteWorkspace) => {
    const requests = workspace.pages.map(async page => {
        const pageTopics = workspace.topics.filter(topic => topic.pageId === page.id)
        const topicIds = new Set(pageTopics.map(topic => topic.id))
        const views = workspace.views.filter(view => topicIds.has(view.topicId))
        const notebook = workspace.notebooks.find(item => item.id === page.notebookId)

        const markdown = await serializePageMarkdown(workspace, page.id)

        const response = await fetch(`/api/pages/${encodeURIComponent(page.id)}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                notebook,
                page,
                topics: pageTopics,
                views,
            }),
        })

        if (!response.ok) throw new Error(await parseError(response, `Unable to save page ${page.id}.`))

        const contentResponse = await fetch(`/api/pages/${encodeURIComponent(page.id)}/content`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ markdown }),
        })

        if (!contentResponse.ok) {
            throw new Error(await parseError(contentResponse, `Unable to save content for page ${page.id}.`))
        }
    })

    await Promise.all(requests)
}
