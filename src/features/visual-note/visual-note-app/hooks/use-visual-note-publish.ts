"use client"

import type { Dispatch, SetStateAction } from "react"
import type { PublishAction, PublishResponse } from "@/lib/visual-note/storage-api"
import { publishNotebook as publishNotebookStorage } from "@/lib/visual-note/storage-api"
import type { SelectionState, VisualNoteWorkspace } from "@/lib/visual-note/types"

type PublishRequest = {
    action: PublishAction
    revision?: string
    includeHtml?: boolean
    includeJson?: boolean
}

type PublishRequestInput = {
    action: PublishAction
    revision?: string
    includeHtml?: boolean
    includeJson?: boolean
}

type VisualNotePublishConfig = {
    selected: {
        currentSelection: SelectionState
    }
    setWorkspace: Dispatch<SetStateAction<VisualNoteWorkspace | null>>
    setWorkspaceRevision: Dispatch<SetStateAction<string | null>>
    workspace: VisualNoteWorkspace | null
    workspaceRevision: string | null
}

export const useVisualNotePublish = ({ selected, setWorkspace, setWorkspaceRevision, workspace, workspaceRevision }: VisualNotePublishConfig) => {
    const publishNotebook = async (input: PublishRequest) => {
        const notebookId = selected.currentSelection.notebookId
        if (!workspace || !notebookId) throw new Error("Choose a notebook before changing publish state.")

        const revision = input.action === "preview" ? undefined : (input.revision ?? workspaceRevision ?? undefined)
        const payload: PublishRequestInput = {
            action: input.action,
            revision,
            includeHtml: input.includeHtml,
            includeJson: input.includeJson,
        }

        const response = (await publishNotebookStorage(notebookId, payload)) as PublishResponse
        if ("notebook" in response) {
            const nextRevision = response.revision
            setWorkspace(current => {
                if (!current) return current
                return { ...current, notebooks: current.notebooks.map(item => (item.id === response.notebook.id ? response.notebook : item)) }
            })
            if (nextRevision) setWorkspaceRevision(nextRevision)
        }

        return response
    }

    return publishNotebook
}
