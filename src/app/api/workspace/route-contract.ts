import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

type WorkspaceSaveBody = {
    baseWorkspace?: VisualNoteWorkspace
    workspace?: VisualNoteWorkspace
    revision?: string | null
}

type WorkspaceSaveParseResult =
    | {
          ok: true
          baseWorkspace?: VisualNoteWorkspace
          workspace: VisualNoteWorkspace
          revision?: string
      }
    | {
          ok: false
          error: string
          status: 400
      }

export const parseWorkspaceSaveRequest = async (request: Request): Promise<WorkspaceSaveParseResult> => {
    const body = (await request.json().catch(() => null)) as WorkspaceSaveBody | null
    if (!body?.workspace) return { ok: false, error: "Workspace is required.", status: 400 }
    if (body.revision != null && typeof body.revision !== "string") return { ok: false, error: "Revision must be a string.", status: 400 }

    const ifMatch = parseIfMatchRevision(request.headers.get("if-match"))
    if (request.headers.get("if-match") && ifMatch === null) return { ok: false, error: "Invalid If-Match revision header.", status: 400 }

    const revisionBody = body.revision == null ? null : body.revision.trim()
    if (!revisionBody && !ifMatch) return { ok: false, error: "Revision is required for workspace save.", status: 400 }

    if (ifMatch && revisionBody && revisionBody !== ifMatch) return { ok: false, error: "Revision in payload must match If-Match header.", status: 400 }

    return {
        ok: true,
        baseWorkspace: body.baseWorkspace,
        workspace: body.workspace,
        revision: (ifMatch || revisionBody) ?? undefined,
    }
}

export const isWorkspaceConflictError = (error: unknown): error is Error => error instanceof Error && (error as { code?: string }).code === "workspace_conflict"

export const parseIfMatchRevision = (headerValue: string | null) => {
    if (!headerValue) return null

    const value = headerValue.trim()
    if (!value) return null

    const trimmed = value.startsWith("W/") ? value.slice(2).trim() : value
    if (!trimmed) return null

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        const unquoted = trimmed.slice(1, -1)
        return unquoted ? unquoted : null
    }

    return trimmed
}
