import { clampIndex, Positioned } from "./result"
import { VisualNoteWorkspace } from "./types"

export const moveById = <T extends Positioned>(items: T[], id: string, to: number) => {
    const index = items.findIndex(item => item.id === id)
    if (index < 0) return null

    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(clampIndex(to, next.length), 0, moved)

    return next.map((item, position) => ({ ...item, position }))
}

export const byIds = (items: { id: string }[]) => new Set(items.map(item => item.id))

export const findOwnedNotebook = (workspace: VisualNoteWorkspace, userId: string, notebookId: string) => {
    const notebook = workspace.notebooks.find(item => item.id === notebookId)
    if (!notebook || notebook.userId !== userId) return null
    return notebook
}

export const findOwnedPage = (workspace: VisualNoteWorkspace, userId: string, pageId: string) => {
    const page = workspace.pages.find(item => item.id === pageId)
    if (!page) return null

    const notebook = findOwnedNotebook(workspace, userId, page.notebookId)
    if (!notebook) return null

    return { notebook, page }
}
