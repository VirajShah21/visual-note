"use client"

import { Bug, CheckCircle2, Clock, Code2, ChevronDown, ChevronUp, ExternalLink as ExternalLinkIcon, GitPullRequest, Layers3, LinkIcon, PanelLeft, Pencil, Plus, ShoppingCart, Sparkles, Trash2 } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
    Button,
    ArticleEditor,
    Card,
    ContextActions,
    DateField,
    Divider,
    ExternalLink,
    Grid,
    Heading,
    InfoPopover,
    MediaImage,
    ModalDialog,
    NotebookHome,
    type NotebookGalleryItem,
    Pill,
    ScrollArea,
    SelectField,
    SideDrawer,
    Stack,
    Text,
    TextAreaField,
    TextField,
    TimeField,
    ToastShelf,
} from "@/components/ui"
import { createDisplayInstance, createLocalUser, createNotebook, createPage, createSeedWorkspace, createTopic, createView, normalizeWorkspace } from "@/lib/visual-note/factories"
import { clearStoredUser, loadStoredUser, loadStoredWorkspace, storeUser, storeWorkspace } from "@/lib/visual-note/storage"
import type { ComponentKind, DisplayInstance, NotebookSection, NotebookView, SelectionState, VisualNoteWorkspace, VisualUser } from "@/lib/visual-note/types"
import type { ToastMessage, ToastTone } from "@/components/ui"
import { getSupabaseBrowserClient, getSupabaseStatus } from "@/lib/supabase/client"
import { loadSupabaseWorkspace, saveSupabaseWorkspace } from "@/lib/supabase/workspace"
import styles from "./visual-note-app.module.css"

const blankSelection: SelectionState = {
    notebookId: "",
    pageId: "",
    topicId: "",
    viewId: "",
}

const componentKindOptions: Array<{ label: string; value: ComponentKind }> = [
    { label: "Data card", value: "data-card" },
    { label: "Checklist", value: "checklist" },
    { label: "Timeline", value: "timeline" },
    { label: "Dashboard", value: "dashboard" },
    { label: "Work logs", value: "work-logs" },
    { label: "Bugs list", value: "bugs-list" },
    { label: "Shopping list", value: "shopping-list" },
    { label: "Pull request", value: "pull-request" },
    { label: "URL", value: "url" },
    { label: "Code block", value: "code-block" },
]

const readableKind = (kind: ComponentKind) => componentKindOptions.find(option => option.value === kind)?.label ?? kind
const timelineItemRevealTransition = (index: number) => ({
    type: "spring" as const,
    stiffness: 140,
    damping: 18,
    mass: 1.1,
    delay: index * 0.25,
    duration: 1,
})
const MotionCard = motion(Card)
const MotionStack = motion(Stack)
const firstByPosition = <T extends { position: number }>(items: T[]) => [...items].sort((a, b) => a.position - b.position)[0]

type VisualNoteAppProps = {
    mode?: "home" | "notebook"
    initialNotebookId?: string
}

const ensureSelectionHasArticleView = (workspace: VisualNoteWorkspace, selection: SelectionState) => {
    const nextSelection = deriveSelection(workspace, selection)
    const topic = workspace.topics.find(item => item.id === nextSelection.topicId)

    if (!topic) return { selection: nextSelection, workspace, createdView: false }

    const existingView = workspace.views.find(item => item.topicId === topic.id)
    if (existingView) return { selection: { ...nextSelection, viewId: existingView.id }, workspace, createdView: false }

    const view = createView(topic.id, "Article")

    return {
        selection: { ...nextSelection, viewId: view.id },
        workspace: { ...workspace, views: [...workspace.views, view] },
        createdView: true,
    }
}

const coerceSingleArticleViewPerTopic = (workspace: VisualNoteWorkspace) => {
    const viewsByTopic = new Map<string, NotebookView[]>()

    workspace.views.forEach(view => {
        const existing = viewsByTopic.get(view.topicId) ?? []
        viewsByTopic.set(view.topicId, [...existing, view])
    })

    const views: NotebookView[] = []

    for (const topic of workspace.topics) {
        const topicViews = viewsByTopic.get(topic.id) ?? []

        if (topicViews.length === 0) {
            views.push(createView(topic.id, "Article"))
            continue
        }

        const articleView = topicViews.find(item => item.mode === "article") ?? topicViews[0]
        views.push({ ...articleView, mode: "article" })
    }

    return {
        ...workspace,
        views,
    }
}

const deriveSelection = (workspace: VisualNoteWorkspace | null, selection: SelectionState): SelectionState => {
    if (!workspace) return blankSelection

    const notebook = workspace.notebooks.find(item => item.id === selection.notebookId) ?? workspace.notebooks[0]
    const sections = workspace.pages.filter(item => item.notebookId === notebook?.id)
    const section = sections.find(item => item.id === selection.pageId) ?? firstByPosition(sections)
    const topics = workspace.topics.filter(item => item.pageId === section?.id)
    const topic = topics.find(item => item.id === selection.topicId) ?? firstByPosition(topics)
    const views = workspace.views.filter(item => item.topicId === topic?.id)
    const view = views.find(item => item.id === selection.viewId) ?? views[0]

    return {
        notebookId: notebook?.id ?? "",
        pageId: section?.id ?? "",
        topicId: topic?.id ?? "",
        viewId: view?.id ?? "",
    }
}

const createNotebookGalleryItems = (workspace: VisualNoteWorkspace, notebooks: VisualNoteWorkspace["notebooks"]): NotebookGalleryItem[] =>
    notebooks.map(notebook => {
        const pages = workspace.pages.filter(page => page.notebookId === notebook.id).sort((a, b) => a.position - b.position)
        const pageIds = pages.map(page => page.id)
        const topics = workspace.topics.filter(topic => pageIds.includes(topic.pageId)).sort((a, b) => a.position - b.position)
        const topicIds = topics.map(topic => topic.id)
        const views = workspace.views.filter(view => topicIds.includes(view.topicId))
        const displayCount = views.reduce((total, view) => total + view.displays.length, 0)
        const createdDate = new Date(notebook.createdAt)
        const updatedLabel = Number.isNaN(createdDate.getTime()) ? "Recently edited" : `Created ${createdDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`

        return {
            id: notebook.id,
            title: notebook.title,
            summary: notebook.summary,
            color: notebook.color,
            href: `/notebook?id=${encodeURIComponent(notebook.id)}`,
            updatedLabel,
            pageCount: pages.length,
            topicCount: topics.length,
            viewCount: views.length,
            displayCount,
            pageTitles: pages.map(page => page.title),
            topicTitles: topics.map(topic => topic.title),
        }
    })

export function VisualNoteApp({ mode = "home", initialNotebookId = "" }: VisualNoteAppProps) {
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

    const dismissToast = useCallback((id: string) => {
        setToastMessages(current => current.filter(message => message.id !== id))
    }, [])

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
        setNotice(supabaseStatus === "configured" ? "Supabase is configured. Workspace changes are mirrored to the configured project." : "Demo mode is active because Supabase env vars are not configured.")
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

    const updateWorkspace = (updater: (current: VisualNoteWorkspace) => VisualNoteWorkspace) => {
        setWorkspace(current => (current ? updater(current) : current))
    }

    if (isLoading)
        return (
            <Stack className={styles.app} gap="lg">
                <Card>
                    <Text>Loading Visual Note...</Text>
                </Card>
            </Stack>
        )

    if (!user || !workspace)
        return (
            <>
                <AuthPanel notice={notice} supabaseStatus={supabaseStatus} onSignIn={signIn} onRegister={register} />
                <ToastShelf messages={toastMessages} onDismiss={dismissToast} />
            </>
        )

    const notebooks = workspace.notebooks.filter(item => item.userId === user.id)

    const addNotebook = (title: string) => {
        const trimmedTitle = title.trim()
        if (!trimmedTitle) {
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

            setSelection({
                notebookId: notebook.id,
                pageId: page.id,
                topicId: topic.id,
                viewId: view.id,
            })

            return {
                ...current,
                notebooks: [...current.notebooks, notebook],
                pages: [...current.pages, page],
                topics: [...current.topics, topic],
                views: [...current.views, view],
            }
        })
        pushToast("Notebook created", `${trimmedTitle} is ready with a starter section, topic, and view.`)
        return createdNotebookId
    }

    const openNotebookEditor = (notebookId: string) => {
        router.push(`/notebook?id=${encodeURIComponent(notebookId)}`)
    }

    const createNotebookAndOpen = (title: string) => {
        const notebookId = addNotebook(title)
        if (!notebookId) return false

        openNotebookEditor(notebookId)
        return true
    }

    const galleryItems = createNotebookGalleryItems(workspace, notebooks)

    if (mode === "home")
        return (
            <Stack className={styles.app}>
                <NotebookHome userLabel={user.email} storageLabel={supabaseStatus === "configured" ? "Supabase connected" : "Demo storage"} notebooks={galleryItems} onCreateNotebook={createNotebookAndOpen} onSignOut={signOut} />
                <ToastShelf messages={toastMessages} onDismiss={dismissToast} />
            </Stack>
        )

    const sections = workspace.pages.filter(item => item.notebookId === selected.currentSelection.notebookId).sort((a, b) => a.position - b.position)
    const topics = workspace.topics.filter(item => item.pageId === selected.currentSelection.pageId).sort((a, b) => a.position - b.position)

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

            return {
                ...current,
                pages: [...current.pages, page],
                topics: [...current.topics, topic],
                views: [...current.views, view],
            }
        })
        pushToast("Section created", `${trimmedTitle} is now available in this notebook.`)
        return true
    }

    const renameSection = (sectionId: string, title: string) => {
        const trimmedTitle = title.trim()
        const section = sections.find(item => item.id === sectionId)
        if (!section || !trimmedTitle) {
            pushToast("Section title required", "Choose a section and enter a title before renaming.", "error")
            return false
        }

        updateWorkspace(current => ({
            ...current,
            pages: current.pages.map(item => (item.id === sectionId ? { ...item, title: trimmedTitle } : item)),
        }))
        pushToast("Section renamed", `${section.title} is now ${trimmedTitle}.`)
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
            const otherPages = remainingPages.filter(item => item.notebookId !== section.notebookId)
            const nextWorkspace = {
                ...current,
                pages: [...otherPages, ...normalizedNotebookPages],
                topics: current.topics.filter(topic => topic.pageId !== sectionId),
                views: current.views.filter(view => !deletedTopicIds.includes(view.topicId)),
            }

            setSelection(currentSelection => deriveSelection(nextWorkspace, currentSelection.pageId === sectionId ? { ...currentSelection, pageId: "", topicId: "", viewId: "" } : currentSelection))

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

            return {
                ...current,
                topics: [...current.topics, topic],
                views: [...current.views, view],
            }
        })
        pushToast("Item created", `${trimmedTitle} is now available in the ${section.title} section.`)
        return true
    }

    const selectSection = (sectionId: string) => {
        if (!workspace) return

        const next = ensureSelectionHasArticleView(workspace, {
            ...selected.currentSelection,
            pageId: sectionId,
            topicId: "",
            viewId: "",
        })

        setSelection(next.selection)

        if (next.createdView) {
            setWorkspace(next.workspace)
            pushToast("Article created", "An article was added for this section item.", "info")
        }
    }

    const selectTopic = (topicId: string) => {
        if (!workspace) return

        const topic = workspace.topics.find(item => item.id === topicId)
        if (!topic) return

        const next = ensureSelectionHasArticleView(workspace, {
            ...selected.currentSelection,
            pageId: topic.pageId,
            topicId,
            viewId: "",
        })

        setSelection(next.selection)

        if (next.createdView) {
            setWorkspace(next.workspace)
            pushToast("Article created", "An article view was added for this item.", "info")
        }
    }

    const renameTopic = (topicId: string, title: string) => {
        const trimmedTitle = title.trim()
        const topic = topics.find(item => item.id === topicId)
        if (!topic || !trimmedTitle) {
            pushToast("Topic title required", "Choose a topic and enter a title before renaming.", "error")
            return false
        }

        updateWorkspace(current => ({
            ...current,
            topics: current.topics.map(item => (item.id === topicId ? { ...item, title: trimmedTitle } : item)),
        }))
        pushToast("Topic renamed", `${topic.title} is now ${trimmedTitle}.`)
        return true
    }

    const deleteTopic = (topicId: string) => {
        const topic = workspace.topics.find(item => item.id === topicId)
        if (!topic) {
            pushToast("Item not found", "Choose an existing item before deleting.", "error")
            return false
        }

        const nextWorkspace = {
            ...workspace,
            topics: workspace.topics.filter(item => item.id !== topicId),
            views: workspace.views.filter(view => view.topicId !== topicId),
        }
        const nextSelection = deriveSelection(nextWorkspace, selected.currentSelection.topicId === topicId ? { ...selected.currentSelection, topicId: "", viewId: "" } : selected.currentSelection)

        setWorkspace(nextWorkspace)
        setSelection(nextSelection)
        pushToast("Item deleted", `${topic.title} and its article were removed.`, "info")
        return true
    }

    const addDisplay = (kind: ComponentKind) => {
        if (!selected.view) {
            pushToast("View required", "Choose a view before adding a display.", "error")
            return false
        }

        const display = createDisplayInstance(kind)
        updateView({ ...selected.view, displays: [...selected.view.displays, display] })
        pushToast("Display added", `${readableKind(kind)} is ready for this view.`)
        return true
    }

    const updateDisplay = (display: DisplayInstance) => {
        if (!selected.view) return

        updateView({
            ...selected.view,
            displays: selected.view.displays.map(item => (item.id === display.id ? display : item)),
        })
    }

    const moveDisplay = (displayId: string, direction: "up" | "down") => {
        if (!selected.view) return

        const currentIndex = selected.view.displays.findIndex(item => item.id === displayId)
        const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= selected.view.displays.length) return

        const displays = [...selected.view.displays]
        const [display] = displays.splice(currentIndex, 1)
        displays.splice(nextIndex, 0, display)
        updateView({ ...selected.view, displays })
    }

    const removeDisplay = (displayId: string) => {
        if (!selected.view) return

        const display = selected.view.displays.find(item => item.id === displayId)
        updateView({ ...selected.view, displays: selected.view.displays.filter(item => item.id !== displayId) })
        pushToast("Display removed", `${display?.name ?? "Display"} was removed from this view.`, "info")
    }

    const appendDisplayToArticle = (displayIndex: number) => {
        if (!selected.view || displayIndex < 0) return

        const display = selected.view.displays[displayIndex]
        if (!display) return

        const marker = `{{display:${displayIndex + 1}}}`
        const currentContent = stringFrom(selected.view.content, "")
        const separator = currentContent.trim() ? "\n\n" : ""
        const nextContent = `${currentContent}${separator}${marker}\n`
        updateView({ ...selected.view, content: nextContent })
        pushToast("Display added", `Added ${display.name ?? "Display"} to article content.`, "info")
    }

    const updateView = (view: NotebookView) => {
        updateWorkspace(current => ({
            ...current,
            views: current.views.map(item => (item.id === view.id ? view : item)),
        }))
    }

    return (
        <Stack className={styles.app}>
            <Grid className={styles.workspace}>
                <Grid className={styles.contentGrid}>
                    <SectionSidebar
                        sections={sections}
                        topics={workspace.topics}
                        activeSectionId={selected.currentSelection.pageId}
                        activeTopicId={selected.currentSelection.topicId}
                        onCreateSection={addSection}
                        onRenameSection={renameSection}
                        onDeleteSection={deleteSection}
                        onCreateTopic={addTopic}
                        onRenameTopic={renameTopic}
                        onDeleteTopic={deleteTopic}
                        onSelectSection={selectSection}
                        onSelectTopic={selectTopic}
                    />
                    <ScrollArea className={styles.content}>
                        <ViewWorkspace view={selected.view} onUpdateView={updateView} onAddDisplay={addDisplay} onUpdateDisplay={updateDisplay} onMoveDisplay={moveDisplay} onRemoveDisplay={removeDisplay} onAppendDisplayToArticle={appendDisplayToArticle} />
                    </ScrollArea>
                </Grid>
            </Grid>
            <ToastShelf messages={toastMessages} onDismiss={dismissToast} />
        </Stack>
    )
}

type AuthPanelProps = {
    notice: string
    supabaseStatus: "configured" | "demo"
    onSignIn: (email: string, password: string, name?: string) => Promise<void>
    onRegister: (email: string, password: string, name: string) => Promise<void>
}

function AuthPanel({ notice, supabaseStatus, onSignIn, onRegister }: AuthPanelProps) {
    const [mode, setMode] = useState<"login" | "register">("register")
    const [email, setEmail] = useState("viraj@example.com")
    const [name, setName] = useState("Viraj")
    const [password, setPassword] = useState("visual-note-demo")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const submit = async () => {
        setIsSubmitting(true)
        if (mode === "register") await onRegister(email, password, name)
        else await onSignIn(email, password, name)
        setIsSubmitting(false)
    }

    return (
        <Grid className={`${styles.app} ${styles.authShell}`}>
            <Stack className={styles.authStory} gap="xl">
                <Pill>
                    <Sparkles size={14} />
                    Web-native notebooks
                    <InfoPopover title="Visual Note model" label="Visual Note model details">
                        Visual Note organizes knowledge as notebooks, sections, topics, article views, displays, and data so each notebook behaves like a structured website.
                    </InfoPopover>
                </Pill>
                <Stack gap="lg">
                    <Heading as="h1" size="hero">
                        Visual Note
                    </Heading>
                </Stack>
                <Grid columns="auto">
                    <Card>
                        <Stack direction="horizontal" gap="sm">
                            <Pill>Notebook</Pill>
                            <InfoPopover title="Notebook" label="Notebook details">
                                Each notebook owns its own web-shaped information architecture.
                            </InfoPopover>
                        </Stack>
                    </Card>
                    <Card>
                        <Stack direction="horizontal" gap="sm">
                            <Pill>Article</Pill>
                            <InfoPopover title="Article" label="Article details">
                                Each topic has one article view. Add displays to the article as embedded items.
                            </InfoPopover>
                        </Stack>
                    </Card>
                </Grid>
            </Stack>
            <Stack className={styles.authPanel} gap="lg">
                <Stack direction="horizontal" gap="sm">
                    <Heading size="lg">{mode === "register" ? "Create your account" : "Log in"}</Heading>
                    <InfoPopover title="Authentication mode" label="Authentication mode details">
                        {supabaseStatus === "configured" ? "Supabase auth is enabled for this build." : "Supabase env vars are missing, so this runs in local demo mode."}
                    </InfoPopover>
                </Stack>
                <Card>
                    <Stack gap="md">
                        {mode === "register" ? <TextField label="Name" value={name} onChange={event => setName(event.target.value)} /> : null}
                        <TextField label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} />
                        <TextField label="Password" type="password" value={password} onChange={event => setPassword(event.target.value)} />
                        <Button variant="primary" onClick={submit} disabled={isSubmitting} fullWidth>
                            {mode === "register" ? "Register and open workspace" : "Log in"}
                        </Button>
                        <Button variant="ghost" onClick={() => setMode(current => (current === "register" ? "login" : "register"))} fullWidth>
                            {mode === "register" ? "Use login instead" : "Create an account instead"}
                        </Button>
                    </Stack>
                </Card>
                {notice ? (
                    <Card className={styles.error} padding="compact">
                        <Text>{notice}</Text>
                    </Card>
                ) : null}
            </Stack>
        </Grid>
    )
}

type SectionSidebarProps = {
    sections: NotebookSection[]
    topics: VisualNoteWorkspace["topics"]
    activeSectionId: string
    activeTopicId: string
    onCreateSection: (title: string) => boolean
    onRenameSection: (sectionId: string, title: string) => boolean
    onDeleteSection: (sectionId: string) => boolean
    onCreateTopic: (sectionId: string, title: string) => boolean
    onRenameTopic: (topicId: string, title: string) => boolean
    onDeleteTopic: (topicId: string) => boolean
    onSelectTopic: (topicId: string) => void
    onSelectSection: (sectionId: string) => void
}

function SectionSidebar({ sections, topics, activeSectionId, activeTopicId, onCreateSection, onRenameSection, onDeleteSection, onCreateTopic, onRenameTopic, onDeleteTopic, onSelectTopic, onSelectSection }: SectionSidebarProps) {
    const [title, setTitle] = useState("New section")
    const [itemTitle, setItemTitle] = useState("New item")
    const [editTitle, setEditTitle] = useState("")
    const [editingTopicId, setEditingTopicId] = useState("")
    const [editingSectionId, setEditingSectionId] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false)
    const [activeSectionIdForTopic, setActiveSectionIdForTopic] = useState("")

    const create = () => {
        if (!onCreateSection(title)) return

        setTitle("New section")
        setIsCreateOpen(false)
    }

    const createTopic = () => {
        if (!activeSectionIdForTopic) return
        if (!onCreateTopic(activeSectionIdForTopic, itemTitle)) return

        setItemTitle("New item")
        setIsCreateTopicOpen(false)
    }

    const openEditTopic = (topicId: string) => {
        const topic = topics.find(item => item.id === topicId)
        if (!topic) return

        setEditingTopicId(topic.id)
        setEditTitle(topic.title)
    }
    const openEditSection = (sectionId: string) => {
        const section = sections.find(item => item.id === sectionId)
        if (!section) return

        setEditingSectionId(section.id)
        setEditTitle(section.title)
    }
    const renameSection = () => {
        if (!onRenameSection(editingSectionId, editTitle)) return

        setEditingSectionId("")
        setEditTitle("")
    }
    const rename = () => {
        if (!onRenameTopic(editingTopicId, editTitle)) return

        setEditingTopicId("")
        setEditTitle("")
    }
    const openTopicCreator = (sectionId: string) => {
        setActiveSectionIdForTopic(sectionId)
        setItemTitle("New item")
        setIsCreateTopicOpen(true)
    }

    return (
        <ScrollArea className={styles.sidebar}>
            <Stack gap="lg">
                <Stack gap="xs">
                    <Pill>
                        <PanelLeft size={14} />
                        Sections
                        <InfoPopover title="Sections" label="Section details">
                            Topics are section-specific items in the notebook sidebar.
                        </InfoPopover>
                    </Pill>
                </Stack>
                <Stack gap="sm">
                    {sections.map(section => {
                        const sectionTopics = topics.filter(topic => topic.pageId === section.id).sort((a, b) => a.position - b.position)

                        return (
                            <Stack key={section.id} className={styles.sectionGroup} gap="sm">
                                <ContextActions
                                    className={styles.sectionHeaderTrigger}
                                    items={[
                                        { label: "Rename section", icon: <Pencil size={14} />, onSelect: () => openEditSection(section.id) },
                                        { label: "Delete section", icon: <Trash2 size={14} />, onSelect: () => onDeleteSection(section.id) },
                                    ]}
                                >
                                    <Heading
                                        className={`${styles.sectionTitle} ${section.id === activeSectionId ? styles.activeSectionTitle : ""}`}
                                        size="sm"
                                        onClick={() => onSelectSection(section.id)}
                                    >
                                        {section.title}
                                    </Heading>
                                </ContextActions>
                                <Stack className={styles.sectionPageList} gap="xs">
                                    {sectionTopics.map(topic => (
                                        <ContextActions
                                            key={topic.id}
                                            className={styles.topicContextTrigger}
                                            items={[
                                                { label: "Rename item", icon: <Pencil size={14} />, onSelect: () => openEditTopic(topic.id) },
                                                { label: "Delete item", icon: <Trash2 size={14} />, onSelect: () => onDeleteTopic(topic.id) },
                                            ]}
                                        >
                                            <Button className={`${styles.navButton} ${styles.topicSelectButton} ${topic.id === activeTopicId ? styles.activeNavButton : ""}`} onClick={() => onSelectTopic(topic.id)} fullWidth>
                                                {topic.title}
                                            </Button>
                                        </ContextActions>
                                    ))}
                                    <Button icon={<Plus size={15} />} onClick={() => openTopicCreator(section.id)} fullWidth>
                                        New item
                                    </Button>
                                </Stack>
                            </Stack>
                        )
                    })}
                </Stack>
                <Button icon={<Plus size={15} />} onClick={() => setIsCreateOpen(true)} fullWidth>
                    New section
                </Button>
            </Stack>
            <ModalDialog open={isCreateOpen} title="Create section" description="Sections are sidebar groups for this notebook." onOpenChange={setIsCreateOpen}>
                <Stack gap="md">
                    <TextField label="Section title" value={title} onChange={event => setTitle(event.target.value)} />
                    <Button icon={<Plus size={15} />} variant="primary" onClick={create} fullWidth>
                        Create section
                    </Button>
                </Stack>
            </ModalDialog>
            <ModalDialog open={isCreateTopicOpen} title="Create item" description="Add a sidebar item to this section." onOpenChange={setIsCreateTopicOpen}>
                <Stack gap="md">
                    <TextField label="Item title" value={itemTitle} onChange={event => setItemTitle(event.target.value)} />
                    <Button icon={<Plus size={15} />} variant="primary" onClick={createTopic} fullWidth>
                        Create item
                    </Button>
                </Stack>
            </ModalDialog>
            <ModalDialog open={Boolean(editingTopicId)} title="Rename topic" description="Update this sidebar topic title." onOpenChange={open => !open && setEditingTopicId("")}>
                <Stack gap="md">
                    <TextField label="Topic title" value={editTitle} onChange={event => setEditTitle(event.target.value)} />
                    <Button icon={<Pencil size={15} />} variant="primary" onClick={rename} fullWidth>
                        Rename topic
                    </Button>
                </Stack>
            </ModalDialog>
            <ModalDialog open={Boolean(editingSectionId)} title="Rename section" description="Update this sidebar section title." onOpenChange={open => !open && setEditingSectionId("")}>
                <Stack gap="md">
                    <TextField label="Section title" value={editTitle} onChange={event => setEditTitle(event.target.value)} />
                    <Button icon={<Pencil size={15} />} variant="primary" onClick={renameSection} fullWidth>
                        Rename section
                    </Button>
                </Stack>
            </ModalDialog>
        </ScrollArea>
    )
}

type ViewWorkspaceProps = {
    view: NotebookView | null
    onUpdateView: (view: NotebookView) => void
    onAddDisplay: (kind: ComponentKind) => boolean
    onUpdateDisplay: (display: DisplayInstance) => void
    onMoveDisplay: (displayId: string, direction: "up" | "down") => void
    onRemoveDisplay: (displayId: string) => void
    onAppendDisplayToArticle: (displayIndex: number) => void
}

function ViewWorkspace({ view, onUpdateView, onAddDisplay, onUpdateDisplay, onMoveDisplay, onRemoveDisplay, onAppendDisplayToArticle }: ViewWorkspaceProps) {
    const [displayKind, setDisplayKind] = useState<ComponentKind>("data-card")
    const [selectedDisplayForArticle, setSelectedDisplayForArticle] = useState("1")
    const [isDisplaysOpen, setIsDisplaysOpen] = useState(false)

    const addDisplayToView = () => {
        if (!onAddDisplay(displayKind)) return

        setDisplayKind("data-card")
    }

    if (!view)
        return (
            <>
                <Card className={styles.emptyCanvas}>
                    <Stack gap="md">
                        <Heading>No article found</Heading>
                        <Text>This topic does not yet have an article view. Use actions to continue.</Text>
                    </Stack>
                </Card>
            </>
        )

    return (
        <Stack gap="lg">
            <Stack className={styles.viewHeader} direction="horizontal" gap="md">
                <Stack className={styles.viewActions} direction="horizontal" gap="sm">
                    <Button icon={<Layers3 size={15} />} onClick={() => setIsDisplaysOpen(true)}>
                        Displays
                    </Button>
                </Stack>
            </Stack>
            <Stack className={styles.preview} gap="lg">
                <ArticleWorkspace view={view} onUpdateView={onUpdateView} onUpdateDisplay={onUpdateDisplay} selectedDisplayForArticle={selectedDisplayForArticle} onChangeSelectedDisplay={setSelectedDisplayForArticle} />
            </Stack>
            <SideDrawer open={isDisplaysOpen} title="Manage displays" description="Add display types to this view, review the display order, reorder displays, or remove displays from the view." onOpenChange={setIsDisplaysOpen}>
                <Stack gap="lg">
                    <Stack gap="md">
                        <Heading size="sm">Add a display</Heading>
                        <SelectField label="Display type" value={displayKind} options={componentKindOptions} onValueChange={value => setDisplayKind(value as ComponentKind)} />
                        <Button icon={<Plus size={15} />} variant="primary" onClick={addDisplayToView} fullWidth>
                            Add display
                        </Button>
                    </Stack>
                    <Divider />
                    <Stack gap="md">
                        <Heading size="sm">Display order</Heading>
                        <Stack gap="md">
                            {view.displays.map((display, index) => (
                                <Card key={display.id} padding="compact">
                                    <Stack gap="md">
                                        <Stack className={styles.toolbar} direction="horizontal" gap="sm">
                                            <Stack gap="xs">
                                                <Heading size="sm">{display.name}</Heading>
                                                <Pill>{readableKind(display.kind)}</Pill>
                                            </Stack>
                                            <Pill>#{index + 1}</Pill>
                                        </Stack>
                                        <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                                            <Button icon={<ChevronUp size={15} />} variant="ghost" onClick={() => onMoveDisplay(display.id, "up")} disabled={index === 0}>
                                                Move up
                                            </Button>
                                            <Button icon={<ChevronDown size={15} />} variant="ghost" onClick={() => onMoveDisplay(display.id, "down")} disabled={index === view.displays.length - 1}>
                                                Move down
                                            </Button>
                                            <Button icon={<Sparkles size={15} />} variant="secondary" onClick={() => onAppendDisplayToArticle(index)}>
                                                Add into article
                                            </Button>
                                            <Button icon={<Trash2 size={15} />} variant="danger" onClick={() => onRemoveDisplay(display.id)}>
                                                Remove
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Card>
                            ))}
                        </Stack>
                        {view.displays.length === 0 ? <Text>Add a display type to start composing this view.</Text> : null}
                    </Stack>
                </Stack>
            </SideDrawer>
        </Stack>
    )
}

type ArticleWorkspaceProps = {
    view: NotebookView
    onUpdateView: (view: NotebookView) => void
    onUpdateDisplay: (display: DisplayInstance) => void
    selectedDisplayForArticle: string
    onChangeSelectedDisplay: (value: string) => void
}

function ArticleWorkspace({ view, onUpdateView, onUpdateDisplay, selectedDisplayForArticle, onChangeSelectedDisplay }: ArticleWorkspaceProps) {
    return (
        <ArticleEditor
            value={stringFrom(view.content)}
            displays={view.displays}
            selectedDisplayForArticle={selectedDisplayForArticle}
            onChangeSelectedDisplay={onChangeSelectedDisplay}
            onChange={content => onUpdateView({ ...view, content })}
            renderDisplay={display => <RenderedDisplay display={display} onUpdate={onUpdateDisplay} isReadOnly={false} />}
        />
    )
}

type DisplayDataEditorProps = {
    display: DisplayInstance
    onDataChange: (data: Record<string, unknown>) => void
}

function DisplayDataEditor({ display, onDataChange }: DisplayDataEditorProps) {
    const data = display.data
    const updateField = (field: string, value: string) => onDataChange({ ...data, [field]: value })
    const updateListItem = (field: string, index: number, value: string) => onDataChange({ ...data, [field]: replaceStringAt(arrayFrom(data[field]), index, value) })
    const addListItem = (field: string, value: string) => onDataChange({ ...data, [field]: [...arrayFrom(data[field]), value] })
    const removeListItem = (field: string, index: number) => onDataChange({ ...data, [field]: arrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index) })
    const updateObjectItem = (field: string, index: number, key: string, value: string) => {
        onDataChange({ ...data, [field]: replaceObjectAt(objectArrayFrom(data[field]), index, { [key]: value }) })
    }
    const addObjectItem = (field: string, item: Record<string, unknown>) => onDataChange({ ...data, [field]: [...objectArrayFrom(data[field]), item] })
    const removeObjectItem = (field: string, index: number) => onDataChange({ ...data, [field]: objectArrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index) })

    if (display.kind === "data-card")
        return (
            <Stack gap="md">
                <TextField label="Label" value={stringFrom(data.label)} onChange={event => updateField("label", event.target.value)} />
                <TextField label="Value" value={stringFrom(data.value)} onChange={event => updateField("value", event.target.value)} />
            </Stack>
        )

    if (display.kind === "checklist")
        return <StringListEditor title="Checklist items" items={arrayFrom(data.items)} label="Item" onAdd={() => addListItem("items", "New checklist item")} onChange={(index, value) => updateListItem("items", index, value)} onRemove={index => removeListItem("items", index)} />

    if (display.kind === "timeline")
        return (
            <Stack gap="md">
                <Heading size="sm">Events</Heading>
                <AnimatePresence mode="popLayout">
                    {timelineEventsFromData(data.events).map((eventItem, index) => (
                        <MotionCard
                            key={`${index}-${eventItem.label}-${eventItem.date}`}
                            padding="compact"
                            initial={{ opacity: 0, y: 24, scale: 0.965, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -10, scale: 0.97, filter: "blur(2px)" }}
                            transition={timelineItemRevealTransition(index)}
                        >
                            <Stack gap="md">
                                <Grid columns="two">
                                    <TextField label="Label" value={stringFrom(eventItem.label)} onChange={event => updateObjectItem("events", index, "label", event.target.value)} />
                                    <DateField label="Date" value={dateInputValue(eventItem.date)} onChange={event => updateObjectItem("events", index, "date", event.target.value)} />
                                    <TimeField label="Time" value={timeInputValue(eventItem.time)} onChange={event => updateObjectItem("events", index, "time", event.target.value)} />
                                </Grid>
                                <Button variant="ghost" onClick={() => removeObjectItem("events", index)} fullWidth>
                                    Delete Event
                                </Button>
                            </Stack>
                        </MotionCard>
                    ))}
                </AnimatePresence>
                <Button icon={<Plus size={15} />} onClick={() => addObjectItem("events", { label: "New event", date: "", time: "" })} fullWidth>
                    Add Event
                </Button>
            </Stack>
        )

    if (display.kind === "dashboard")
        return (
            <Stack gap="md">
                <Heading size="sm">Metrics</Heading>
                {objectArrayFrom(data.metrics).map((metric, index) => (
                    <Card key={`${index}-${metric.label}`} padding="compact">
                        <Stack gap="md">
                            <Grid columns="two">
                                <TextField label="Label" value={stringFrom(metric.label)} onChange={event => updateObjectItem("metrics", index, "label", event.target.value)} />
                                <TextField label="Value" value={stringFrom(metric.value)} onChange={event => updateObjectItem("metrics", index, "value", event.target.value)} />
                            </Grid>
                            <Button variant="ghost" onClick={() => removeObjectItem("metrics", index)} fullWidth>
                                Delete Metric
                            </Button>
                        </Stack>
                    </Card>
                ))}
                <Button icon={<Plus size={15} />} onClick={() => addObjectItem("metrics", { label: "New metric", value: "0" })} fullWidth>
                    Add Metric
                </Button>
            </Stack>
        )

    if (display.kind === "work-logs")
        return (
            <Stack gap="md">
                <Heading size="sm">Work logs</Heading>
                {objectArrayFrom(data.workLogs).map((log, index) => (
                    <Card key={`${index}-${log.title}`} padding="compact">
                        <Stack gap="md">
                            <Grid columns="two">
                                <TextField label="Timestamp" value={stringFrom(log.timestamp)} onChange={event => updateObjectItem("workLogs", index, "timestamp", event.target.value)} />
                                <TextField label="Time worked" value={stringFrom(log.timeWorked)} onChange={event => updateObjectItem("workLogs", index, "timeWorked", event.target.value)} />
                            </Grid>
                            <TextField label="Title" value={stringFrom(log.title)} onChange={event => updateObjectItem("workLogs", index, "title", event.target.value)} />
                            <TextAreaField label="Description" value={stringFrom(log.description)} onChange={event => updateObjectItem("workLogs", index, "description", event.target.value)} />
                            <TextField label="Pull request URL" value={stringFrom(log.pullRequestUrl)} onChange={event => updateObjectItem("workLogs", index, "pullRequestUrl", event.target.value)} />
                            <Button variant="ghost" onClick={() => removeObjectItem("workLogs", index)} fullWidth>
                                Delete Work Log
                            </Button>
                        </Stack>
                    </Card>
                ))}
                <Button icon={<Plus size={15} />} onClick={() => addObjectItem("workLogs", defaultListItems.workLog)} fullWidth>
                    Add Work Log
                </Button>
            </Stack>
        )

    if (display.kind === "bugs-list")
        return (
            <Stack gap="md">
                <Heading size="sm">Bugs</Heading>
                {objectArrayFrom(data.bugs).map((bug, index) => (
                    <Card key={`${index}-${bug.title}`} padding="compact">
                        <Stack gap="md">
                            <Grid columns="two">
                                <TextField label="Title" value={stringFrom(bug.title)} onChange={event => updateObjectItem("bugs", index, "title", event.target.value)} />
                                <TextField label="Severity" value={stringFrom(bug.severity)} onChange={event => updateObjectItem("bugs", index, "severity", event.target.value)} />
                            </Grid>
                            <TextAreaField label="Description" value={stringFrom(bug.description)} onChange={event => updateObjectItem("bugs", index, "description", event.target.value)} />
                            <TextField label="GitHub issue or Jira ticket URL" value={stringFrom(bug.ticketUrl)} onChange={event => updateObjectItem("bugs", index, "ticketUrl", event.target.value)} />
                            <Button variant="ghost" onClick={() => removeObjectItem("bugs", index)} fullWidth>
                                Delete Bug
                            </Button>
                        </Stack>
                    </Card>
                ))}
                <Button icon={<Plus size={15} />} onClick={() => addObjectItem("bugs", defaultListItems.bug)} fullWidth>
                    Add Bug
                </Button>
            </Stack>
        )

    if (display.kind === "shopping-list")
        return (
            <Stack gap="md">
                <Heading size="sm">Shopping items</Heading>
                {objectArrayFrom(data.shoppingItems).map((item, index) => (
                    <Card key={`${index}-${item.product}`} padding="compact">
                        <Stack gap="md">
                            <Grid columns="two">
                                <TextField label="Brand" value={stringFrom(item.brand)} onChange={event => updateObjectItem("shoppingItems", index, "brand", event.target.value)} />
                                <TextField label="Product" value={stringFrom(item.product)} onChange={event => updateObjectItem("shoppingItems", index, "product", event.target.value)} />
                                <TextField label="Model or variant" value={stringFrom(item.modelVariant)} onChange={event => updateObjectItem("shoppingItems", index, "modelVariant", event.target.value)} />
                                <TextField label="Store" value={stringFrom(item.store)} onChange={event => updateObjectItem("shoppingItems", index, "store", event.target.value)} />
                                <TextField label="Store location" value={stringFrom(item.storeLocation)} onChange={event => updateObjectItem("shoppingItems", index, "storeLocation", event.target.value)} />
                                <TextField label="Store URL" value={stringFrom(item.storeUrl)} onChange={event => updateObjectItem("shoppingItems", index, "storeUrl", event.target.value)} />
                            </Grid>
                            <Button variant="ghost" onClick={() => removeObjectItem("shoppingItems", index)} fullWidth>
                                Delete Item
                            </Button>
                        </Stack>
                    </Card>
                ))}
                <Button icon={<Plus size={15} />} onClick={() => addObjectItem("shoppingItems", defaultListItems.shoppingItem)} fullWidth>
                    Add Shopping Item
                </Button>
            </Stack>
        )

    if (display.kind === "pull-request")
        return (
            <Stack gap="md">
                <TextField label="PR URL" value={stringFrom(data.prUrl)} onChange={event => updateField("prUrl", event.target.value)} />
                <Grid columns="two">
                    <TextField label="PR number or ID" value={stringFrom(data.prNumber)} onChange={event => updateField("prNumber", event.target.value)} />
                    <TextField label="Author" value={stringFrom(data.author)} onChange={event => updateField("author", event.target.value)} />
                    <TextField label="Reviewer" value={stringFrom(data.reviewer)} onChange={event => updateField("reviewer", event.target.value)} />
                </Grid>
                <TextField label="PR title" value={stringFrom(data.title)} onChange={event => updateField("title", event.target.value)} />
                <TextAreaField label="PR description" value={stringFrom(data.description)} onChange={event => updateField("description", event.target.value)} />
                <StringListEditor title="Comments" items={arrayFrom(data.comments)} label="Comment" onAdd={() => addListItem("comments", "New comment")} onChange={(index, value) => updateListItem("comments", index, value)} onRemove={index => removeListItem("comments", index)} />
            </Stack>
        )

    if (display.kind === "url")
        return (
            <Stack gap="md">
                <TextField label="URL" value={stringFrom(data.url)} onChange={event => updateField("url", event.target.value)} />
                <TextField label="Page title" value={stringFrom(data.pageTitle)} onChange={event => updateField("pageTitle", event.target.value)} />
                <TextAreaField label="Page description" value={stringFrom(data.pageDescription)} onChange={event => updateField("pageDescription", event.target.value)} />
                <TextField label="Banner image" value={stringFrom(data.bannerImage)} onChange={event => updateField("bannerImage", event.target.value)} />
                <TextField label="Social preview image" value={stringFrom(data.socialPreviewImage)} onChange={event => updateField("socialPreviewImage", event.target.value)} />
                <TextField label="Favicon" value={stringFrom(data.favicon)} onChange={event => updateField("favicon", event.target.value)} />
                <StringListEditor title="Keywords" items={arrayFrom(data.keywords)} label="Keyword" onAdd={() => addListItem("keywords", "New keyword")} onChange={(index, value) => updateListItem("keywords", index, value)} onRemove={index => removeListItem("keywords", index)} />
            </Stack>
        )

    return (
        <Stack gap="md">
            <TextAreaField label="Code" value={stringFrom(data.code)} onChange={event => updateField("code", event.target.value)} />
            <Grid columns="two">
                <TextField label="Language" value={stringFrom(data.language)} onChange={event => updateField("language", event.target.value)} />
                <TextField label="GitHub or external URL" value={stringFrom(data.sourceUrl)} onChange={event => updateField("sourceUrl", event.target.value)} />
            </Grid>
        </Stack>
    )
}

type StringListEditorProps = {
    title: string
    items: string[]
    label: string
    onAdd: () => void
    onChange: (index: number, value: string) => void
    onRemove: (index: number) => void
}

function StringListEditor({ title, items, label, onAdd, onChange, onRemove }: StringListEditorProps) {
    return (
        <Stack gap="md">
            <Heading size="sm">{title}</Heading>
            {items.map((item, index) => (
                <Card key={`${index}-${item}`} padding="compact">
                    <Stack gap="md">
                        <TextField label={`${label} ${index + 1}`} value={item} onChange={event => onChange(index, event.target.value)} />
                        <Button variant="ghost" onClick={() => onRemove(index)} fullWidth>
                            Remove {label.toLowerCase()}
                        </Button>
                    </Stack>
                </Card>
            ))}
            <Button icon={<Plus size={15} />} onClick={onAdd} fullWidth>
                Add {label.toLowerCase()}
            </Button>
        </Stack>
    )
}

type RenderedDisplayProps = {
    display: DisplayInstance
    onUpdate: (display: DisplayInstance) => void
    isReadOnly?: boolean
}

function RenderedDisplay({ display, onUpdate, isReadOnly = false }: RenderedDisplayProps) {
    const data = display.data
    const [editingTimelineEventIndex, setEditingTimelineEventIndex] = useState<number | null>(null)
    const [editingDataCard, setEditingDataCard] = useState(false)
    const [editingWorkLogIndex, setEditingWorkLogIndex] = useState<number | null>(null)
    const updateData = (nextData: Record<string, unknown>) => onUpdate({ ...display, data: nextData })
    const editor = isReadOnly ? null : (
        <Stack className={styles.inlineDisplayEditor} gap="md">
            <DisplayDataEditor display={display} onDataChange={updateData} />
        </Stack>
    )
    const timelineEvents = timelineEventsFromData(data.events)
    const addTimelineEvent = () => {
        const nextEvents = [...timelineEvents, { label: "New event", date: "", time: "" }]
        updateData({ ...data, events: nextEvents })
        setEditingTimelineEventIndex(nextEvents.length - 1)
    }
    const updateTimelineEvent = (index: number, key: string, value: string) => updateData({ ...data, events: replaceObjectAt(timelineEvents, index, { [key]: value }) })
    const removeTimelineEvent = (index: number) => {
        updateData({ ...data, events: timelineEvents.filter((_, itemIndex) => itemIndex !== index) })
        setEditingTimelineEventIndex(current => {
            if (current === null) return null
            if (current === index) return null
            if (current > index) return current - 1

            return current
        })
    }
    const workLogs = objectArrayFrom(data.workLogs)
    const addWorkLog = () => {
        const nextWorkLogs = [...workLogs, defaultListItems.workLog]
        updateData({ ...data, workLogs: nextWorkLogs })
        setEditingWorkLogIndex(nextWorkLogs.length - 1)
    }
    const updateWorkLog = (index: number, key: string, value: string) => {
        updateData({ ...data, workLogs: replaceObjectAt(workLogs, index, { [key]: value }) })
    }
    const removeWorkLog = (index: number) => {
        updateData({ ...data, workLogs: workLogs.filter((_, itemIndex) => itemIndex !== index) })
        setEditingWorkLogIndex(current => {
            if (current === null) return null
            if (current === index) return null
            if (current > index) return current - 1

            return current
        })
    }
    const displayHeader = (icon: ReactNode, action?: ReactNode) => (
        <Stack className={styles.displayHeader} direction="horizontal" gap="sm">
            <Stack className={styles.displayTitleGroup} gap="xs">
                <Pill className={styles.displayKind}>
                    {icon}
                    {readableKind(display.kind)}
                </Pill>
                <Heading size="sm">{display.name}</Heading>
            </Stack>
            {action ? <Stack className={styles.displayHeaderAction}>{action}</Stack> : null}
        </Stack>
    )

    if (display.kind === "data-card") {
        if (isReadOnly)
            return (
                <Stack className={styles.heroPanel} gap="md">
                    <Text tone="strong">{stringFrom(data.label, "Label")}</Text>
                    <Heading size="md">{stringFrom(data.value, "Value")}</Heading>
                </Stack>
            )

        return (
            <Stack gap="md">
                {editingDataCard ? (
                    <Stack gap="md">
                        <DisplayDataEditor display={display} onDataChange={updateData} />
                        <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                            <Button variant="ghost" onClick={() => setEditingDataCard(false)}>
                                Done
                            </Button>
                        </Stack>
                    </Stack>
                ) : (
                    <Stack className={styles.heroPanel} gap="md">
                        <Text tone="strong">{stringFrom(data.label, "Label")}</Text>
                        <Heading size="md">{stringFrom(data.value, "Value")}</Heading>
                        <Button icon={<Pencil size={14} />} variant="ghost" onClick={() => setEditingDataCard(true)}>
                            Edit
                        </Button>
                    </Stack>
                )}
            </Stack>
        )
    }

    if (display.kind === "work-logs")
        return (
            <Stack gap="md">
                {isReadOnly ? null : (
                    <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                        <Button icon={<Plus size={15} />} variant="secondary" onClick={addWorkLog}>
                            Add Work Log
                        </Button>
                    </Stack>
                )}
                <Stack className={styles.refinedList} gap="sm">
                    <AnimatePresence mode="popLayout">
                        {workLogs.map((log, index) => {
                            const pullRequestUrl = stringFrom(log.pullRequestUrl)

                            return (
                                <MotionStack
                                    key={`${log.timestamp}-${log.title}`}
                                    className={styles.refinedItem}
                                    gap="sm"
                                    initial={{ opacity: 0, y: 30, scale: 0.965, filter: "blur(4px)" }}
                                    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, y: -10, scale: 0.97, filter: "blur(2px)" }}
                                    transition={timelineItemRevealTransition(index)}
                                    layout
                                >
                                    {editingWorkLogIndex === index ? (
                                        <Stack gap="md">
                                            <Grid columns="two">
                                                <TextField label="Timestamp" value={stringFrom(log.timestamp)} onChange={event => updateWorkLog(index, "timestamp", event.target.value)} />
                                                <TextField label="Time worked" value={stringFrom(log.timeWorked)} onChange={event => updateWorkLog(index, "timeWorked", event.target.value)} />
                                            </Grid>
                                            <TextField label="Title" value={stringFrom(log.title)} onChange={event => updateWorkLog(index, "title", event.target.value)} />
                                            <TextAreaField label="Description" value={stringFrom(log.description)} onChange={event => updateWorkLog(index, "description", event.target.value)} />
                                            <TextField label="Pull request URL" value={stringFrom(log.pullRequestUrl)} onChange={event => updateWorkLog(index, "pullRequestUrl", event.target.value)} />
                                            <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                                                <Button variant="ghost" onClick={() => setEditingWorkLogIndex(null)}>
                                                    Done
                                                </Button>
                                                <Button variant="danger" onClick={() => removeWorkLog(index)}>
                                                    Delete Work Log
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    ) : isReadOnly ? (
                                        <Stack className={styles.itemHeader} direction="horizontal" gap="sm">
                                            <Stack gap="xs">
                                                <Heading size="sm">{stringFrom(log.title, "Work log")}</Heading>
                                                <Text size="small">{stringFrom(log.timestamp, "No timestamp")}</Text>
                                            </Stack>
                                            <Stack gap="xs" className={styles.wrapRow}>
                                                <Pill>
                                                    <Clock size={13} />
                                                    {stringFrom(log.timeWorked, "Time worked")}
                                                </Pill>
                                            </Stack>
                                        </Stack>
                                    ) : (
                                        <Stack className={styles.itemHeader} direction="horizontal" gap="sm">
                                            <Stack gap="xs">
                                                <Heading size="sm">{stringFrom(log.title, "Work log")}</Heading>
                                                <Text size="small">{stringFrom(log.timestamp, "No timestamp")}</Text>
                                            </Stack>
                                            <Stack gap="xs" className={styles.wrapRow}>
                                                <Pill>
                                                    <Clock size={13} />
                                                    {stringFrom(log.timeWorked, "Time worked")}
                                                </Pill>
                                                <Button icon={<Pencil size={14} />} variant="ghost" onClick={() => setEditingWorkLogIndex(index)}>
                                                    Edit
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    )}
                                    {editingWorkLogIndex === index ? null : <Text>{stringFrom(log.description, "No description provided.")}</Text>}
                                    {editingWorkLogIndex === index ? null : (
                                        <Stack className={styles.itemFooter} direction="horizontal" gap="sm">
                                            {pullRequestUrl ? (
                                                <ExternalLink href={pullRequestUrl}>
                                                    <ExternalLinkIcon size={14} />
                                                    Pull request
                                                </ExternalLink>
                                            ) : null}
                                        </Stack>
                                    )}
                                </MotionStack>
                            )
                        })}
                    </AnimatePresence>
                </Stack>
            </Stack>
        )

    if (display.kind === "bugs-list")
        return (
            <Stack className={styles.displayFrame} gap="md">
                {displayHeader(<Bug size={13} />)}
                <Stack className={styles.refinedList} gap="sm">
                    {objectArrayFrom(data.bugs).map(bug => {
                        const ticketUrl = stringFrom(bug.ticketUrl)

                        return (
                            <Stack key={`${bug.title}-${bug.severity}`} className={styles.refinedItem} gap="sm">
                                <Stack className={styles.itemHeader} direction="horizontal" gap="sm">
                                    <Stack gap="xs">
                                        <Heading size="sm">{stringFrom(bug.title, "Bug")}</Heading>
                                        <Text size="small">Issue record</Text>
                                    </Stack>
                                    <Pill className={styles.statusPill}>
                                        <Bug size={13} />
                                        {stringFrom(bug.severity, "Untriaged")}
                                    </Pill>
                                </Stack>
                                <Text>{stringFrom(bug.description, "No description provided.")}</Text>
                                <Stack className={styles.itemFooter} direction="horizontal" gap="sm">
                                    {ticketUrl ? (
                                        <ExternalLink href={ticketUrl}>
                                            <ExternalLinkIcon size={14} />
                                            Issue or ticket
                                        </ExternalLink>
                                    ) : null}
                                </Stack>
                            </Stack>
                        )
                    })}
                </Stack>
                {editor}
            </Stack>
        )

    if (display.kind === "shopping-list")
        return (
            <Stack className={styles.displayFrame} gap="md">
                {displayHeader(<ShoppingCart size={13} />)}
                <Stack className={styles.refinedList} gap="sm">
                    {objectArrayFrom(data.shoppingItems).map(item => {
                        const storeUrl = stringFrom(item.storeUrl)

                        return (
                            <Stack key={`${item.brand}-${item.product}-${item.modelVariant}`} className={styles.refinedItem} gap="sm">
                                <Stack className={styles.itemHeader} direction="horizontal" gap="sm">
                                    <Stack gap="xs">
                                        <Heading size="sm">{stringFrom(item.product, "Product")}</Heading>
                                        <Text tone="strong">{stringFrom(item.brand, "Brand")}</Text>
                                    </Stack>
                                    <Pill>
                                        <ShoppingCart size={13} />
                                        {stringFrom(item.store, "Store")}
                                    </Pill>
                                </Stack>
                                <Grid columns="two" gap="sm">
                                    <Stack className={styles.detailCell} gap="xs">
                                        <Text size="small">Variant</Text>
                                        <Text tone="strong">{stringFrom(item.modelVariant, "Model or variant")}</Text>
                                    </Stack>
                                    <Stack className={styles.detailCell} gap="xs">
                                        <Text size="small">Location</Text>
                                        <Text tone="strong">{stringFrom(item.storeLocation, "Store location")}</Text>
                                    </Stack>
                                </Grid>
                                <Stack className={styles.itemFooter} direction="horizontal" gap="sm">
                                    {storeUrl ? (
                                        <ExternalLink href={storeUrl}>
                                            <ExternalLinkIcon size={14} />
                                            Store page
                                        </ExternalLink>
                                    ) : null}
                                </Stack>
                            </Stack>
                        )
                    })}
                </Stack>
                {editor}
            </Stack>
        )

    if (display.kind === "pull-request")
        return (
            <Stack className={styles.displayFrame} gap="md">
                {displayHeader(
                    <GitPullRequest size={13} />,
                    stringFrom(data.prUrl) ? (
                        <ExternalLink href={stringFrom(data.prUrl)}>
                            <ExternalLinkIcon size={14} />
                            Open pull request
                        </ExternalLink>
                    ) : null,
                )}
                <Stack className={styles.heroPanel} gap="sm">
                    <Pill>{stringFrom(data.prNumber, "PR")}</Pill>
                    <Heading size="md">{stringFrom(data.title, "Pull request title")}</Heading>
                    <Text>{stringFrom(data.description, "No pull request description provided.")}</Text>
                </Stack>
                <Grid columns="two" gap="sm">
                    <Stack className={styles.detailCell} gap="xs">
                        <Text size="small">Author</Text>
                        <Text tone="strong">{stringFrom(data.author, "Unknown")}</Text>
                    </Stack>
                    <Stack className={styles.detailCell} gap="xs">
                        <Text size="small">Reviewer</Text>
                        <Text tone="strong">{stringFrom(data.reviewer, "Unassigned")}</Text>
                    </Stack>
                </Grid>
                <Stack gap="sm">
                    <Text size="small">Review notes</Text>
                    <Stack direction="horizontal" gap="xs" className={styles.wrapRow}>
                        {arrayFrom(data.comments).map(comment => (
                            <Pill key={comment}>{comment}</Pill>
                        ))}
                    </Stack>
                </Stack>
                {editor}
            </Stack>
        )

    if (display.kind === "url") {
        const bannerImage = stringFrom(data.bannerImage) || stringFrom(data.socialPreviewImage)
        const favicon = stringFrom(data.favicon)

        return (
            <Stack className={styles.displayFrame} gap="md">
                {displayHeader(<LinkIcon size={13} />)}
                <Stack className={styles.urlPreview} gap="sm">
                    {bannerImage ? <MediaImage className={styles.bannerImage} src={bannerImage} alt={stringFrom(data.pageTitle, "URL preview")} /> : null}
                    <Stack className={styles.urlTitleRow} direction="horizontal" gap="sm">
                        {favicon ? <MediaImage className={styles.favicon} src={favicon} alt="" /> : <LinkIcon size={18} />}
                        <Heading size="md">{stringFrom(data.pageTitle, "Untitled page")}</Heading>
                    </Stack>
                    <Text>{stringFrom(data.pageDescription, "No page description provided.")}</Text>
                </Stack>
                <Stack gap="sm">
                    <Stack direction="horizontal" gap="xs" className={styles.wrapRow}>
                        {arrayFrom(data.keywords).map(keyword => (
                            <Pill key={keyword}>{keyword}</Pill>
                        ))}
                    </Stack>
                    {stringFrom(data.url) ? (
                        <ExternalLink href={stringFrom(data.url)}>
                            <ExternalLinkIcon size={14} />
                            Open URL
                        </ExternalLink>
                    ) : null}
                </Stack>
                {editor}
            </Stack>
        )
    }

    if (display.kind === "code-block")
        return (
            <Stack className={styles.displayFrame} gap="md">
                {displayHeader(<Code2 size={13} />)}
                <Stack className={styles.codeSurface} gap="none">
                    <Stack className={styles.codeToolbar} direction="horizontal" gap="sm">
                        <Pill>{stringFrom(data.language, "code")}</Pill>
                        {stringFrom(data.sourceUrl) ? (
                            <ExternalLink href={stringFrom(data.sourceUrl)}>
                                <ExternalLinkIcon size={14} />
                                Source
                            </ExternalLink>
                        ) : null}
                    </Stack>
                    <Text as="code" tone="code" className={styles.codeBlock}>
                        {stringFrom(data.code, "// Add code here")}
                    </Text>
                </Stack>
                {editor}
            </Stack>
        )

    if (display.kind === "checklist")
        return (
            <Stack className={styles.displayFrame} gap="md">
                {displayHeader(<CheckCircle2 size={13} />)}
                <Stack className={styles.checklistItems} gap="xs">
                    {arrayFrom(data.items).map(item => (
                        <Stack key={item} className={styles.checklistItem} direction="horizontal" gap="sm">
                            <CheckCircle2 size={16} />
                            <Text tone="strong">{item}</Text>
                        </Stack>
                    ))}
                </Stack>
                {editor}
            </Stack>
        )

    if (display.kind === "timeline")
        return (
            <Stack className={styles.timelineDisplay} gap="md">
                <Stack className={styles.toolbar} direction="horizontal" gap="sm">
                    <Heading size="sm">{display.name}</Heading>
                    {isReadOnly ? null : (
                        <Button icon={<Plus size={15} />} variant="secondary" onClick={addTimelineEvent}>
                            Add Event
                        </Button>
                    )}
                </Stack>
                <Stack className={styles.timelineTrack} gap="none">
                    <AnimatePresence mode="popLayout">
                        {timelineEvents.map((eventItem, index) => (
                            <MotionStack
                                key={`${index}-${eventItem.label}-${eventItem.date}-${eventItem.time}`}
                                className={styles.timelineItem}
                                gap="sm"
                                initial={{ opacity: 0, y: 30, scale: 0.965, filter: "blur(4px)" }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                                exit={{ opacity: 0, y: -10, scale: 0.97, filter: "blur(2px)" }}
                                transition={timelineItemRevealTransition(index)}
                                layout
                            >
                                {editingTimelineEventIndex === index ? (
                                    <Stack gap="md">
                                        <Grid columns="two">
                                            <TextField label="Label" value={stringFrom(eventItem.label)} onChange={event => updateTimelineEvent(index, "label", event.target.value)} />
                                            <DateField label="Date" value={dateInputValue(eventItem.date)} onChange={event => updateTimelineEvent(index, "date", event.target.value)} />
                                            <TimeField label="Time" value={timeInputValue(eventItem.time)} onChange={event => updateTimelineEvent(index, "time", event.target.value)} />
                                        </Grid>
                                        <Stack className={styles.wrapRow} direction="horizontal" gap="sm">
                                            <Button variant="ghost" onClick={() => setEditingTimelineEventIndex(null)}>
                                                Done
                                            </Button>
                                            <Button variant="danger" onClick={() => removeTimelineEvent(index)}>
                                                Delete Event
                                            </Button>
                                        </Stack>
                                    </Stack>
                                ) : isReadOnly ? (
                                    <Stack className={styles.toolbar} direction="horizontal" gap="sm">
                                        <Stack gap="xs">
                                            <Text tone="strong">{String(eventItem.label ?? "Event")}</Text>
                                            <Text size="small">{timelineScheduleText(eventItem)}</Text>
                                        </Stack>
                                    </Stack>
                                ) : (
                                    <Stack className={styles.toolbar} direction="horizontal" gap="sm">
                                        <Stack gap="xs">
                                            <Text tone="strong">{String(eventItem.label ?? "Event")}</Text>
                                            <Text size="small">{timelineScheduleText(eventItem)}</Text>
                                        </Stack>
                                        <Button icon={<Pencil size={14} />} variant="ghost" onClick={() => setEditingTimelineEventIndex(index)}>
                                            Edit
                                        </Button>
                                    </Stack>
                                )}
                            </MotionStack>
                        ))}
                    </AnimatePresence>
                </Stack>
            </Stack>
        )

    if (display.kind === "dashboard")
        return (
            <Stack className={styles.displayFrame} gap="md">
                {displayHeader(<Layers3 size={13} />)}
                <Stack className={styles.dashboardSurface} gap="md">
                    <Grid columns="auto" gap="sm">
                        {objectArrayFrom(data.metrics).map(metric => (
                            <Stack key={`${metric.label}-${metric.value}`} className={styles.metric} gap="xs">
                                <Text size="small">{String(metric.label ?? "Metric")}</Text>
                                <Heading size="md">{String(metric.value ?? "0")}</Heading>
                            </Stack>
                        ))}
                    </Grid>
                </Stack>
                {editor}
            </Stack>
        )

    return (
        <Stack className={styles.displayFrame} gap="md">
            {displayHeader(<Sparkles size={13} />)}
            <Stack className={styles.heroPanel} gap="sm">
                <Text tone="strong">{String(data.label ?? "Label")}</Text>
                <Heading size="md">{String(data.value ?? "Value")}</Heading>
            </Stack>
            <Stack className={styles.codeSurface} gap="none">
                <Stack className={styles.codeToolbar} direction="horizontal" gap="sm">
                    <Pill>JSON</Pill>
                </Stack>
                <Text as="code" tone="code" className={styles.dataPreview}>
                    {JSON.stringify(data, null, 2)}
                </Text>
            </Stack>
            {editor}
        </Stack>
    )
}

const arrayFrom = (value: unknown) => {
    if (Array.isArray(value)) return value.map(item => String(item))

    if (typeof value === "string" && value.trim()) return value.split(",").map(item => item.trim())

    return []
}

const objectArrayFrom = (value: unknown) => {
    if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))

    return []
}

const timelineEventsFromData = (value: unknown) => {
    const asArray = objectArrayFrom(value)
    if (asArray.length > 0) return asArray

    if (value && typeof value === "object" && !Array.isArray(value)) {
        const eventRecord = value as Record<string, unknown>
        const candidates = Object.values(eventRecord).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
        if (candidates.length > 0) return candidates

        if ("label" in eventRecord || "date" in eventRecord || "time" in eventRecord) return [eventRecord]
    }

    return []
}

const stringFrom = (value: unknown, fallback = "") => {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)

    return fallback
}

const dateInputValue = (value: unknown) => {
    const date = stringFrom(value)

    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ""
}

const timeInputValue = (value: unknown) => {
    const time = stringFrom(value)

    return /^\d{2}:\d{2}$/.test(time) ? time : ""
}

const timelineScheduleText = (eventItem: Record<string, unknown>) => {
    const date = dateInputValue(eventItem.date)
    const time = timeInputValue(eventItem.time)
    if (date && time) return `${date} at ${time}`
    if (date) return date
    if (time) return time

    return "Unscheduled"
}

const replaceStringAt = (items: string[], index: number, value: string) => items.map((item, itemIndex) => (itemIndex === index ? value : item))

const replaceObjectAt = (items: Array<Record<string, unknown>>, index: number, patch: Record<string, unknown>) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))

const defaultListItems = {
    workLog: {
        timestamp: new Date().toISOString(),
        timeWorked: "1h",
        title: "New work log",
        description: "Describe the work completed.",
        pullRequestUrl: "",
    },
    bug: {
        title: "New bug",
        description: "Describe the issue.",
        ticketUrl: "",
        severity: "Medium",
    },
    shoppingItem: {
        brand: "",
        product: "New product",
        modelVariant: "",
        store: "",
        storeLocation: "",
        storeUrl: "",
    },
}
