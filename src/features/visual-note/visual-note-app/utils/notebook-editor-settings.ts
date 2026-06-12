import { normalizeNotebookEditorSettings } from "@/lib/visual-note/factories"
import type { NotebookEditorSettings, VisualNoteWorkspace } from "@/lib/visual-note/types"

export const updateWorkspaceNotebookEditorSettings = (workspace: VisualNoteWorkspace, notebookId: string, settings: Partial<NotebookEditorSettings>): VisualNoteWorkspace => ({
    ...workspace,
    notebooks: workspace.notebooks.map(notebook =>
        notebook.id === notebookId
            ? {
                  ...notebook,
                  editorSettings: normalizeNotebookEditorSettings({ ...notebook.editorSettings, ...settings }),
              }
            : notebook,
    ),
})
