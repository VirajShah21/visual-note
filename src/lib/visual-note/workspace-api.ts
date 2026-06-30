import type { VisualNoteWorkspace } from "@/lib/visual-note/types"
import { normalizeWorkspace } from "@/lib/visual-note/factories"

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

export const loadVisualNoteWorkspace = async (): Promise<VisualNoteWorkspace | null> => {
    const response = await fetch("/api/workspace")
    if (response.status === 401) return null
    if (!response.ok) throw new Error(await parseError(response, "Unable to load workspace."))

    const body = (await response.json()) as ApiWorkspaceEnvelope
    return asVisualNoteWorkspace(body)
}

export const saveVisualNoteWorkspace = async (workspace: VisualNoteWorkspace) => {
    const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspace }),
    })

    if (!response.ok) throw new Error(await parseError(response, "Unable to save workspace."))
}
