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

    return {
        ok: true,
        baseWorkspace: body.baseWorkspace,
        workspace: body.workspace,
        revision: body.revision?.trim() || undefined,
    }
}

export const isWorkspaceConflictError = (error: unknown): error is Error => error instanceof Error && (error as { code?: string }).code === "workspace_conflict"
