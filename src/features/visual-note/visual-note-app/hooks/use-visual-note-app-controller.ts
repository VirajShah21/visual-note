"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ToastMessage, ToastTone } from "@/components/ui"
import { getSupabaseBrowserClient, getSupabaseStatus } from "@/lib/supabase/client"
import { loadSupabaseWorkspace, saveSupabaseWorkspace } from "@/lib/supabase/workspace"
import { createLocalUser, createNotebook, createPage, createSeedWorkspace, createTopic, createView, normalizeWorkspace } from "@/lib/visual-note/factories"
import { clearStoredUser, loadStoredUser, loadStoredWorkspace, storeUser, storeWorkspace } from "@/lib/visual-note/storage"
import type { DisplayInstance, NotebookView, SelectionState, VisualNoteWorkspace, VisualUser } from "@/lib/visual-note/types"
import { blankSelection, coerceSingleArticleViewPerTopic, createNotebookGalleryItems, deriveSelection, ensureSelectionHasArticleView } from "../utils/visual-note-app.utils"

export const useVisualNoteAppController = (initialNotebookId: string) => {
    const router = useRouter()
    const [user, setUser] = useState<VisualUser | null>(null)
    const [workspace, setWorkspace] = useState<VisualNoteWorkspace | null>(null)
    const [selection, setSelection] = useState<SelectionState>(blankSelection)
    const [isLoading, setIsLoading] = useState(true)
    const [notice, setNotice] = useState("")
    const [toastMessages, setToastMessages] = useState<ToastMessage[]>([])
    const supabaseStatus = getSupabaseStatus()

    const pushToast = useCallback((title: string, description?: string, tone: ToastTone = "success") => {
        const id = globalThis.crypto?.randomUUID() ?? `${Date.now()}-${Math.random()}`
        setToastMessages(current => [...current.slice(-2), { id, title, description, tone }])
    }, [])
    const dismissToast = useCallback((id: string) => setToastMessages(current => current.filter(message => message.id !== id)), [])

    useEffect(() => {
        const restore = async () => {
            const storedUser = loadStoredUser()
            if (!storedUser) {
                setIsLoading(false)
                return
            }

            setUser(storedUser)
            const remoteWorkspace = await loadSupabaseWorkspace(storedUser.id)
            const nextWorkspace = coerceSingleArticleViewPerTopic(normalizeWorkspace(remoteWorkspace ?? loadStoredWorkspace(storedUser.id) ?? createSeedWorkspace(storedUser)))
            const resolved = ensureSelectionHasArticleView(nextWorkspace, { ...blankSelection, notebookId: initialNotebookId })
            setWorkspace(resolved.workspace)
            setSelection(resolved.selection)
            setIsLoading(false)
        }

        void restore()
    }, [initialNotebookId])

    useEffect(() => {
        if (!user || !workspace) return
        storeWorkspace(user.id, workspace)
        void saveSupabaseWorkspace(user.id, workspace)
    }, [user, workspace])

    const selected = useMemo(() => {
        const currentSelection = deriveSelection(workspace, selection)
        const notebook = workspace?.notebooks.find(item => item.id === currentSelection.notebookId) ?? null
        const page = workspace?.pages.find(item => item.id === currentSelection.pageId) ?? null
        const topic = workspace?.topics.find(item => item.id === currentSelection.topicId) ?? null
        const view = workspace?.views.find(item => item.id === currentSelection.viewId) ?? null
        return { currentSelection, notebook, page, topic, view }
    }, [selection, workspace])

    const openWorkspaceForUser = async (nextUser: VisualUser) => {
        storeUser(nextUser)
        setUser(nextUser)
        const remoteWorkspace = await loadSupabaseWorkspace(nextUser.id)
        const nextWorkspace = coerceSingleArticleViewPerTopic(normalizeWorkspace(remoteWorkspace ?? loadStoredWorkspace(nextUser.id) ?? createSeedWorkspace(nextUser)))
        const resolved = ensureSelectionHasArticleView(nextWorkspace, { ...blankSelection, notebookId: initialNotebookId })
        setWorkspace(resolved.workspace)
        setSelection(resolved.selection)
        setNotice(
            supabaseStatus === "configured"
                ? "Supabase is configured. Workspace changes are mirrored to the configured project."
                : "Demo mode is active because Supabase env vars are not configured.",
        )
        pushToast("Workspace opened", supabaseStatus === "configured" ? "Changes will sync to Supabase." : "Changes will be saved locally in demo mode.", "info")
    }

    const signIn = async (email: string, password: string, name?: string) => {
        const supabase = getSupabaseBrowserClient()
        if (supabase) {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password })
            if (!error && data.user) {
                await openWorkspaceForUser({ id: data.user.id, email: data.user.email ?? email, name: data.user.user_metadata.name ?? name ?? email })
                return
            }

            const message = error?.message ?? "Falling back to local demo auth."
            setNotice(message)
            pushToast("Using demo auth", message, "info")
        }

        await openWorkspaceForUser(createLocalUser(email, name))
    }

    const register = async (email: string, password: string, name: string) => {
        const supabase = getSupabaseBrowserClient()
        if (supabase) {
            const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
            if (!error && data.user) {
                await openWorkspaceForUser({ id: data.user.id, email: data.user.email ?? email, name })
                return
            }

            const message = error?.message ?? "Falling back to local demo registration."
            setNotice(message)
            pushToast("Using demo registration", message, "info")
        }

        await openWorkspaceForUser(createLocalUser(email, name))
    }

    const signOut = async () => {
        const supabase = getSupabaseBrowserClient()
        if (supabase) await supabase.auth.signOut()
        clearStoredUser()
        setUser(null)
        setWorkspace(null)
        setSelection(blankSelection)
        setNotice("")
    }

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
        const section = sections.find(item => item.id === sectionId)
        if (!section) {
            pushToast("Section not found", "Choose an existing section before deleting.", "error")
            return false
        }

        updateWorkspace(current => {
            const deletedTopicIds = current.topics.filter(topic => topic.pageId === sectionId).map(topic => topic.id)
            const remainingPages = current.pages.filter(item => item.id !== sectionId)
            const normalizedNotebookPages = remainingPages
                .filter(item => item.notebookId === section.notebookId)
                .sort((a, b) => a.position - b.position)
                .map((item, index) => ({ ...item, position: index }))
            const nextWorkspace = {
                ...current,
                pages: [...remainingPages.filter(item => item.notebookId !== section.notebookId), ...normalizedNotebookPages],
                topics: current.topics.filter(topic => topic.pageId !== sectionId),
                views: current.views.filter(view => !deletedTopicIds.includes(view.topicId)),
            }
            setSelection(currentSelection =>
                deriveSelection(nextWorkspace, currentSelection.pageId === sectionId ? { ...currentSelection, pageId: "", topicId: "", viewId: "" } : currentSelection),
            )
            return nextWorkspace
        })
        pushToast("Section deleted", `${section.title} and its topics and views were removed.`, "info")
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
        const topic = workspace.topics.find(item => item.id === topicId)
        if (!topic) {
            pushToast("Item not found", "Choose an existing item before deleting.", "error")
            return false
        }

        const nextWorkspace = { ...workspace, topics: workspace.topics.filter(item => item.id !== topicId), views: workspace.views.filter(view => view.topicId !== topicId) }
        setWorkspace(nextWorkspace)
        setSelection(
            deriveSelection(nextWorkspace, selected.currentSelection.topicId === topicId ? { ...selected.currentSelection, topicId: "", viewId: "" } : selected.currentSelection),
        )
        pushToast("Item deleted", `${topic.title} and its article were removed.`, "info")
        return true
    }
    const updateView = (view: NotebookView) => updateWorkspace(current => ({ ...current, views: current.views.map(item => (item.id === view.id ? view : item)) }))
    const updateDisplay = (display: DisplayInstance) => {
        if (!selected.view) return
        updateView({ ...selected.view, displays: selected.view.displays.map(item => (item.id === display.id ? display : item)) })
    }

    return {
        galleryItems,
        isLoading,
        notice,
        sections,
        selected,
        supabaseStatus,
        toastMessages,
        user,
        workspace,
        actions: {
            addSection,
            addTopic,
            createNotebookAndOpen,
            deleteSection,
            deleteTopic,
            dismissToast,
            register,
            renameSection,
            renameTopic,
            selectSection,
            selectTopic,
            signIn,
            signOut,
            updateDisplay,
            updateView,
        },
    }
}
