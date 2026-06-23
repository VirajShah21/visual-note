import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

const parseError = async (response: Response, fallback: string) => {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return body?.error ?? fallback
}

export const loadVisualNoteWorkspace = async (): Promise<VisualNoteWorkspace | null> => {
    const response = await fetch("/api/workspace")
    if (response.status === 401) return null
    if (!response.ok) throw new Error(await parseError(response, "Unable to load workspace."))

    const body = (await response.json()) as { workspace: VisualNoteWorkspace | null }
    return body.workspace
}

export const saveVisualNoteWorkspace = async (workspace: VisualNoteWorkspace) => {
    const response = await fetch("/api/workspace", {
        method: "PUT",
        body: JSON.stringify({ workspace }),
        headers: {
            "Content-Type": "application/json",
        },
    })
    if (!response.ok) throw new Error(await parseError(response, "Unable to save workspace."))
}
