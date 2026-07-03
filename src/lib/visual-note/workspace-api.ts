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
    revision?: string
}

export type VisualNoteWorkspaceState = {
    workspace: VisualNoteWorkspace | null
    revision: string | null
}

const asVisualNoteWorkspace = (payload: ApiWorkspaceEnvelope | null): VisualNoteWorkspace | null => {
    const workspace = payload?.workspace ?? payload
    if (!workspace) return null

    const { notebooks, pages, topics, views } = workspace
    if (!Array.isArray(notebooks) || !Array.isArray(pages) || !Array.isArray(topics) || !Array.isArray(views)) return null

    return normalizeWorkspace({ notebooks, pages, topics, views })
}

export const loadVisualNoteWorkspace = async (): Promise<VisualNoteWorkspace | null> => {
    const response = await fetch("/api/workspace")
    if (response.status === 401) return null
    if (!response.ok) throw new Error(await parseError(response, "Unable to load workspace."))

    const body = (await response.json()) as ApiWorkspaceEnvelope
    return asVisualNoteWorkspace(body)
}

export const loadVisualNoteWorkspaceState = async (): Promise<VisualNoteWorkspaceState> => {
    const response = await fetch("/api/workspace")
    if (response.status === 401) return { workspace: null, revision: null }
    if (!response.ok) throw new Error(await parseError(response, "Unable to load workspace."))

    const body = (await response.json()) as ApiWorkspaceEnvelope | null
    return {
        workspace: asVisualNoteWorkspace(body),
        revision: typeof body?.revision === "string" ? body.revision : null,
    }
}

type SaveVisualNoteWorkspaceOptions = {
    baseWorkspace?: VisualNoteWorkspace | null
    signal?: AbortSignal
    revision?: string | null
}

export type SaveVisualNoteWorkspaceError = Error & {
    status?: number
}

export type SaveVisualNoteWorkspaceResult = {
    revision: string
    warnings: string[]
}

export const saveVisualNoteWorkspace = async (workspace: VisualNoteWorkspace, options: SaveVisualNoteWorkspaceOptions = {}): Promise<SaveVisualNoteWorkspaceResult> => {
    if (typeof options.revision !== "string" || !options.revision.trim()) {
        throw new Error("Workspace revision is required before saving.")
    }

    const headers: HeadersInit = {
        "Content-Type": "application/json",
        "If-Match": `"${options.revision.trim()}"`,
    }

    const response = await fetch("/api/workspace", {
        method: "PUT",
        headers,
        signal: options.signal,
        body: JSON.stringify({
            baseWorkspace: options.baseWorkspace ?? null,
            workspace,
            revision: options.revision ?? null,
        }),
    })

    if (!response.ok) {
        const error = new Error(await parseError(response, "Unable to save workspace.")) as SaveVisualNoteWorkspaceError
        error.status = response.status
        throw error
    }

    const body = (await response.json()) as { revision?: string }
    const revision = typeof body.revision === "string" && body.revision.length > 0 ? body.revision : null
    if (!revision) throw new Error("Workspace save did not return a revision token.")

    const warnings = Array.isArray((body as { warnings?: unknown }).warnings)
        ? (body as { warnings?: string[] }).warnings ?? []
        : []

    return { revision, warnings }
}
