"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ToastMessage, ToastTone } from "@/components/ui"
import { createNotebook, createPage, createTopic, createView } from "@/lib/visual-note/factories"
import type { DisplayInstance, NotebookEditorSettings, NotebookView, SelectionState, VisualNoteWorkspace, VisualUser } from "@/lib/visual-note/types"
import type { NotebookSearchResult } from "@/lib/visual-note/search"
import { updateWorkspaceNotebookEditorSettings } from "@features/visual-note/visual-note-app/utils/notebook-editor-settings"
import {
    blankSelection,
    createNotebookGalleryItems,
    deleteSectionFromWorkspace,
    deleteTopicFromWorkspace,
    deriveSelection,
    ensureSelectionHasArticleView,
} from "@features/visual-note/visual-note-app/utils/visual-note-app.utils"
import { restoreVisualNoteSession } from "./restore-visual-note-session"
import { registerVisualNoteAccount, signInVisualNoteUser } from "./visual-note-auth-actions"
import { uploadImageForNotebook } from "./workspace-image-actions"
import { retryWorkspaceRecovery as retryWorkspaceRecoveryAction } from "./workspace-recovery-actions"
import { openWorkspaceForUser as openWorkspaceForUserAction, signOutOfWorkspace } from "./workspace-session-actions"
import { useVisualNoteWorkspaceAutosave, type WorkspaceRecoveryState } from "./use-visual-note-workspace-autosave"
import { publishNotebook as publishNotebookStorage } from "@/lib/visual-note/storage-api"
import type { PublishAction, PublishResponse } from "@/lib/visual-note/storage-api"

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
export const useVisualNoteAppController = (initialNotebookId: string) => {
    const router = useRouter()
    const [user, setUser] = useState<VisualUser | null>(null)
    const [workspace, setWorkspace] = useState<VisualNoteWorkspace | null>(null)
    const [selection, setSelection] = useState<SelectionState>(blankSelection)
    const [isLoading, setIsLoading] = useState(true)
    const [notice, setNotice] = useState("")
    const [workspaceRevision, setWorkspaceRevision] = useState<string | null>(null)
    const [workspaceRecovery, setWorkspaceRecovery] = useState<WorkspaceRecoveryState>({ message: "", status: "synced" })
    const [toastMessages, setToastMessages] = useState<ToastMessage[]>([])
    const [authStatus, setAuthStatus] = useState<"ready" | "unconfigured">("ready")
    const syncedWorkspaceRef = useRef("")
    const hasActiveSaveErrorRef = useRef(false)
    const pushToast = useCallback((title: string, description?: string, tone: ToastTone = "success") => {
        const id = globalThis.crypto?.randomUUID() ?? `${Date.now()}-${Math.random()}`
        setToastMessages(current => [...current.slice(-2), { id, title, description, tone }])
    }, [])
    const dismissToast = useCallback((id: string) => setToastMessages(current => current.filter(message => message.id !== id)), [])
    useEffect(() => {
        const restore = async () => {
            try {
                const restored = await restoreVisualNoteSession(initialNotebookId)
                if (!restored.user || !restored.workspace || !restored.selection) {
                    setAuthStatus(restored.authStatus)
                    setNotice(restored.authStatus === "unconfigured" ? "Visual Note server database authentication is not configured." : "")
                    setWorkspaceRevision(null)
                    setWorkspaceRecovery({ message: "", status: "synced" })
                    setIsLoading(false)
                    return
                }
                setUser(restored.user)
                syncedWorkspaceRef.current = JSON.stringify(restored.workspace)
                setWorkspace(restored.workspace)
                setSelection(restored.selection)
                setWorkspaceRevision(restored.workspaceRevision ?? null)
                setWorkspaceRecovery({ message: "", status: "synced" })
                setAuthStatus(restored.authStatus)
                setNotice("")
                setIsLoading(false)
                return
            } catch (error) {
                setAuthStatus("ready")
                setWorkspaceRevision(null)
                setUser(null)
                setWorkspace(null)
                setSelection(blankSelection)
                setWorkspaceRecovery({ message: error instanceof Error ? error.message : "Unable to restore the workspace session.", status: "error" })
                setNotice(error instanceof Error ? error.message : "Unable to restore the workspace session.")
                setIsLoading(false)
            }
        }
        void restore()
    }, [initialNotebookId])
    const selected = useMemo(() => {
        const currentSelection = deriveSelection(workspace, selection)
        const notebook = workspace?.notebooks.find(item => item.id === currentSelection.notebookId) ?? null
        const page = workspace?.pages.find(item => item.id === currentSelection.pageId) ?? null
        const topic = workspace?.topics.find(item => item.id === currentSelection.topicId) ?? null
        const view = workspace?.views.find(item => item.id === currentSelection.viewId) ?? null
        return { currentSelection, notebook, page, topic, view }
    }, [selection, workspace])
    const openWorkspaceForUser = (nextUser: VisualUser) =>
        openWorkspaceForUserAction({
            hasActiveSaveErrorRef,
            initialNotebookId,
            pushToast,
            setAuthStatus,
            setNotice,
            setSelection,
            setUser,
            setWorkspace,
            setWorkspaceRecovery,
            setWorkspaceRevision,
            syncedWorkspaceRef,
            user: nextUser,
        })
    const authContext = { openWorkspaceForUser, pushToast, setNotice }
    const signIn = (email: string, password: string) => signInVisualNoteUser(authContext, email, password)
    const register = (email: string, password: string, name: string) => registerVisualNoteAccount(authContext, email, password, name)
    const signOut = () => signOutOfWorkspace({ setAuthStatus, setNotice, setSelection, setUser, setWorkspace, setWorkspaceRecovery })
    const retryWorkspaceRecovery = () =>
        retryWorkspaceRecoveryAction({
            hasActiveSaveErrorRef,
            openWorkspaceForUser,
            pushToast,
            setNotice,
            setWorkspaceRecovery,
            setWorkspaceRevision,
            syncedWorkspaceRef,
            user,
            workspace,
            workspaceRecovery,
            workspaceRevision,
        })
    useVisualNoteWorkspaceAutosave({
        user,
        workspace,
        setNotice,
        pushToast,
        hasActiveSaveErrorRef,
        workspaceRevision,
        setWorkspaceRecovery,
        setWorkspaceRevision,
        syncedWorkspaceRef,
        workspaceRecovery,
        retryWorkspaceRecovery,
    })
    const updateWorkspace = (updater: (current: VisualNoteWorkspace) => VisualNoteWorkspace) => setWorkspace(current => (current ? updater(current) : current))
    const notebooks = workspace && user ? workspace.notebooks.filter(item => item.userId === user.id) : []
    const sections = workspace ? workspace.pages.filter(item => item.notebookId === selected.currentSelection.notebookId).sort((a, b) => a.position - b.position) : []
    const galleryItems = workspace ? createNotebookGalleryItems(workspace, notebooks) : []
    const addNotebook = (title: string) => {
        const trimmedTitle = title.trim()
        if (!user || !trimmedTitle) {
            pushToast("Notebook title required", "Add a title before creating a notebook.", "error")
            return null
        }
        let createdNotebookId = ""
        updateWorkspace(current => {
            const notebook = createNotebook(user.id, trimmedTitle)
            const page = createPage(notebook.id, "Home", 0)
            const topic = createTopic(page.id, "Start", 0)
            const view = createView(topic.id, "Welcome")
            createdNotebookId = notebook.id
            setSelection({ notebookId: notebook.id, pageId: page.id, topicId: topic.id, viewId: view.id })
            return { ...current, notebooks: [...current.notebooks, notebook], pages: [...current.pages, page], topics: [...current.topics, topic], views: [...current.views, view] }
        })
        pushToast("Notebook created", `${trimmedTitle} is ready with a starter section, topic, and view.`)
        return createdNotebookId
    }
    const createNotebookAndOpen = (title: string) => {
        const notebookId = addNotebook(title)
        if (!notebookId) return false
        router.push(`/notebook?id=${encodeURIComponent(notebookId)}`)
        return true
    }
    const addSection = (title: string) => {
        const trimmedTitle = title.trim()
        if (!selected.notebook || !trimmedTitle) {
            pushToast("Section title required", "Choose a notebook and enter a section title.", "error")
            return false
        }
        updateWorkspace(current => {
            const page = createPage(selected.notebook?.id ?? "", trimmedTitle, sections.length)
            const topic = createTopic(page.id, "Overview", 0)
            const view = createView(topic.id, "Primary view")
            setSelection(currentSelection => ({ ...currentSelection, pageId: page.id, topicId: topic.id, viewId: view.id }))
            return { ...current, pages: [...current.pages, page], topics: [...current.topics, topic], views: [...current.views, view] }
        })
        pushToast("Section created", `${trimmedTitle} is now available in this notebook.`)
        return true
    }
    const renameSection = (sectionId: string, title: string) => renameWorkspaceItem("pages", sectionId, title, "Section", sections.find(item => item.id === sectionId)?.title)
    const renameTopic = (topicId: string, title: string) => renameWorkspaceItem("topics", topicId, title, "Topic", workspace?.topics.find(item => item.id === topicId)?.title)
    const renameWorkspaceItem = (collection: "pages" | "topics", id: string, title: string, label: string, currentTitle?: string) => {
        const trimmedTitle = title.trim()
        if (!currentTitle || !trimmedTitle) {
            pushToast(`${label} title required`, `Choose a ${label.toLowerCase()} and enter a title before renaming.`, "error")
            return false
        }
        updateWorkspace(current => ({ ...current, [collection]: current[collection].map(item => (item.id === id ? { ...item, title: trimmedTitle } : item)) }))
        pushToast(`${label} renamed`, `${currentTitle} is now ${trimmedTitle}.`)
        return true
    }

    const deleteSection = (sectionId: string) => {
        if (!workspace) return false
        const deleted = deleteSectionFromWorkspace(workspace, sectionId)
        if (!deleted) {
            pushToast("Section not found", "Choose an existing section before deleting.", "error")
            return false
        }

        setWorkspace(deleted.workspace)
        setSelection(currentSelection =>
            deriveSelection(deleted.workspace, currentSelection.pageId === sectionId ? { ...currentSelection, pageId: "", topicId: "", viewId: "" } : currentSelection),
        )
        pushToast("Section deleted", `${deleted.section.title} and its topics and views were removed.`, "info")
        return true
    }
    const addTopic = (sectionId: string, title: string) => {
        const trimmedTitle = title.trim()
        const section = sections.find(item => item.id === sectionId)
        if (!section || !trimmedTitle) {
            pushToast("Item title required", "Choose a section and enter an item title.", "error")
            return false
        }
        updateWorkspace(current => {
            const sectionTopics = current.topics.filter(topic => topic.pageId === sectionId).sort((a, b) => a.position - b.position)
            const topic = createTopic(section.id, trimmedTitle, sectionTopics.length)
            const view = createView(topic.id, "Primary view")
            setSelection(currentSelection => ({ ...currentSelection, topicId: topic.id, viewId: view.id }))
            return { ...current, topics: [...current.topics, topic], views: [...current.views, view] }
        })
        pushToast("Item created", `${trimmedTitle} is now available in the ${section.title} section.`)
        return true
    }
    const selectSection = (sectionId: string) =>
        applySelection({ ...selected.currentSelection, pageId: sectionId, topicId: "", viewId: "" }, "An article was added for this section item.")
    const selectTopic = (topicId: string) => {
        const topic = workspace?.topics.find(item => item.id === topicId)
        if (topic) applySelection({ ...selected.currentSelection, pageId: topic.pageId, topicId, viewId: "" }, "An article view was added for this item.")
    }
    const selectSearchResult = (result: NotebookSearchResult) => {
        applySelection({ ...selected.currentSelection, pageId: result.pageId, topicId: result.topicId, viewId: result.viewId }, "An article view was added for this search result.")
    }
    const selectNotebook = (notebookId: string) => {
        applySelection({ ...blankSelection, notebookId }, "An article view was added for this notebook.")
        router.push(`/notebook?id=${encodeURIComponent(notebookId)}`)
    }
    const openHome = () => router.push("/")
    const applySelection = (nextSelection: SelectionState, createdMessage: string) => {
        if (!workspace) return
        const next = ensureSelectionHasArticleView(workspace, nextSelection)
        setSelection(next.selection)
        if (next.createdView) {
            setWorkspace(next.workspace)
            pushToast("Article created", createdMessage, "info")
        }
    }
    const deleteTopic = (topicId: string) => {
        if (!workspace) return false
        const deleted = deleteTopicFromWorkspace(workspace, topicId)
        if (!deleted) {
            pushToast("Item not found", "Choose an existing item before deleting.", "error")
            return false
        }
        setWorkspace(deleted.workspace)
        setSelection(
            deriveSelection(
                deleted.workspace,
                selected.currentSelection.topicId === topicId ? { ...selected.currentSelection, topicId: "", viewId: "" } : selected.currentSelection,
            ),
        )
        pushToast("Item deleted", `${deleted.topic.title} and its article were removed.`, "info")
        return true
    }
    const updateView = (view: NotebookView) => updateWorkspace(current => ({ ...current, views: current.views.map(item => (item.id === view.id ? view : item)) }))
    const updateNotebookEditorSettings = (settings: Partial<NotebookEditorSettings>) => {
        const notebookId = selected.currentSelection.notebookId
        if (!notebookId) return
        updateWorkspace(current => updateWorkspaceNotebookEditorSettings(current, notebookId, settings))
    }
    const updateDisplay = (display: DisplayInstance) => {
        if (!selected.view) return
        updateView({ ...selected.view, displays: selected.view.displays.map(item => (item.id === display.id ? display : item)) })
    }
    const uploadImage = (file: File) => uploadImageForNotebook(selected.currentSelection.notebookId, file, pushToast)
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
    const actions = {
        addSection,
        addTopic,
        createNotebookAndOpen,
        deleteSection,
        deleteTopic,
        dismissToast,
        register,
        renameSection,
        renameTopic,
        retryWorkspaceRecovery,
        openHome,
        selectSection,
        selectSearchResult,
        selectNotebook,
        selectTopic,
        signIn,
        signOut,
        publishNotebook,
        updateDisplay,
        updateNotebookEditorSettings,
        updateView,
        uploadImage,
    }

    return { galleryItems, isLoading, notice, sections, selected, authStatus, toastMessages, user, workspace, workspaceRecovery, workspaceRevision, actions }
}
