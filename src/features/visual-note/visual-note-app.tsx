"use client"

import {
  BookOpen,
  Bug,
  CheckCircle2,
  Clock,
  Code2,
  ChevronDown,
  ChevronUp,
  ExternalLink as ExternalLinkIcon,
  GitPullRequest,
  Layers3,
  LinkIcon,
  LogOut,
  PanelLeft,
  Pencil,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
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

export function VisualNoteApp() {
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
      const nextWorkspace = normalizeWorkspace(remoteWorkspace ?? loadStoredWorkspace(storedUser.id) ?? createSeedWorkspace(storedUser))
      setWorkspace(nextWorkspace)
      setSelection(current => deriveSelection(nextWorkspace, current))
      setIsLoading(false)
    }

    void restore()
  }, [])

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
    const nextWorkspace = normalizeWorkspace(remoteWorkspace ?? loadStoredWorkspace(nextUser.id) ?? createSeedWorkspace(nextUser))
    setWorkspace(nextWorkspace)
    setSelection(deriveSelection(nextWorkspace, blankSelection))
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
  const sections = workspace.pages.filter(item => item.notebookId === selected.currentSelection.notebookId).sort((a, b) => a.position - b.position)
  const topics = workspace.topics.filter(item => item.pageId === selected.currentSelection.pageId).sort((a, b) => a.position - b.position)
  const views = workspace.views.filter(item => item.topicId === selected.currentSelection.topicId)

  const addNotebook = (title: string) => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      pushToast("Notebook title required", "Add a title before creating a notebook.", "error")
      return false
    }

    updateWorkspace(current => {
      const notebook = createNotebook(user.id, trimmedTitle)
      const page = createPage(notebook.id, "Home", 0)
      const topic = createTopic(page.id, "Start", 0)
      const view = createView(topic.id, "Welcome")

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

      return {
        ...current,
        topics: [...current.topics, topic],
        views: [...current.views, view],
      }
    })
    pushToast("Item created", `${trimmedTitle} is now available in the ${section.title} section.`)
    return true
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
        <NotebookRail
          user={user}
          notebooks={notebooks}
          activeNotebookId={selected.currentSelection.notebookId}
          status={supabaseStatus}
          notice={notice}
          onSelect={notebookId => setSelection(current => deriveSelection(workspace, { ...current, notebookId }))}
          onCreate={addNotebook}
          onSignOut={signOut}
        />
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
            onSelectSection={sectionId => setSelection(current => deriveSelection(workspace, { ...current, pageId: sectionId, topicId: "", viewId: "" }))}
            onSelectTopic={topicId => {
              const topic = workspace.topics.find(item => item.id === topicId)
              setSelection(currentSelection =>
                deriveSelection(workspace, {
                  ...currentSelection,
                  pageId: topic?.pageId ?? currentSelection.pageId,
                  topicId,
                  viewId: "",
                }),
              )
            }}
          />
          <ScrollArea className={styles.content}>
          <ViewWorkspace
            view={selected.view}
            onUpdateView={updateView}
            onAddDisplay={addDisplay}
            onUpdateDisplay={updateDisplay}
            onMoveDisplay={moveDisplay}
            onRemoveDisplay={removeDisplay}
            onAppendDisplayToArticle={appendDisplayToArticle}
          />
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
            Visual Note organizes knowledge as notebooks, sections, topics, views, displays, and data so each notebook behaves like a structured website.
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
              <Pill>View</Pill>
              <InfoPopover title="View" label="View details">
                Views combine prose, structured displays, and dashboard data.
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

type NotebookRailProps = {
  user: VisualUser
  notebooks: VisualNoteWorkspace["notebooks"]
  activeNotebookId: string
  status: "configured" | "demo"
  notice: string
  onSelect: (notebookId: string) => void
  onCreate: (title: string) => boolean
  onSignOut: () => Promise<void>
}

function NotebookRail({ user, notebooks, activeNotebookId, status, notice, onSelect, onCreate, onSignOut }: NotebookRailProps) {
  const [title, setTitle] = useState("New web notebook")
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const create = () => {
    if (!onCreate(title)) return

    setTitle("New web notebook")
    setIsCreateOpen(false)
  }

  return (
    <ScrollArea className={styles.rail}>
      <Stack gap="lg">
        <Stack gap="sm">
          <Pill>
            <BookOpen size={14} />
            Visual Note
          </Pill>
          <Heading size="md">Notebooks</Heading>
          <Text size="small">{user.email}</Text>
        </Stack>
        <Stack gap="sm">
          {notebooks.map(notebook => (
            <Button
              key={notebook.id}
              className={`${styles.navButton} ${notebook.id === activeNotebookId ? styles.activeNavButton : ""}`}
              onClick={() => onSelect(notebook.id)}
              fullWidth
            >
              <BookOpen size={15} />
              {notebook.title}
            </Button>
          ))}
        </Stack>
        <Button icon={<Plus size={15} />} onClick={() => setIsCreateOpen(true)} fullWidth>
          New notebook
        </Button>
        <Stack direction="horizontal" gap="sm">
          <Pill>{status === "configured" ? "Supabase connected" : "Demo storage"}</Pill>
          <InfoPopover title="Storage status" label="Storage status details">
            {notice || (status === "configured" ? "Workspace changes are mirrored to the configured Supabase project." : "Workspace changes are saved locally in demo mode.")}
          </InfoPopover>
        </Stack>
        <Button icon={<LogOut size={15} />} variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </Stack>
      <ModalDialog open={isCreateOpen} title="Create notebook" description="Start a new notebook with a default section, topic, and view." onOpenChange={setIsCreateOpen}>
        <Stack gap="md">
          <TextField label="Notebook title" value={title} onChange={event => setTitle(event.target.value)} />
          <Button icon={<Plus size={15} />} variant="primary" onClick={create} fullWidth>
            Create notebook
          </Button>
        </Stack>
      </ModalDialog>
    </ScrollArea>
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
  onSelectTopic: (topicId: string) => void
  onSelectSection: (sectionId: string) => void
}

function SectionSidebar({
  sections,
  topics,
  activeSectionId,
  activeTopicId,
  onCreateSection,
  onRenameSection,
  onDeleteSection,
  onCreateTopic,
  onRenameTopic,
  onSelectTopic,
  onSelectSection,
}: SectionSidebarProps) {
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
          {sections.map(section => (
            <Card key={section.id} padding="compact">
              <Stack gap="sm">
                <ContextActions
                  items={[
                    { label: "Rename section", icon: <Pencil size={14} />, onSelect: () => openEditSection(section.id) },
                    { label: "Delete section", icon: <Trash2 size={14} />, onSelect: () => onDeleteSection(section.id) },
                  ]}
                >
                  <Button className={`${styles.navButton} ${section.id === activeSectionId ? styles.activeNavButton : ""}`} onClick={() => onSelectSection(section.id)} fullWidth>
                    {section.title}
                  </Button>
                </ContextActions>
                <Stack gap="xs">
                  {topics
                    .filter(topic => topic.pageId === section.id)
                    .sort((a, b) => a.position - b.position)
                    .map(topic => (
                      <ContextActions
                        key={topic.id}
                        className={styles.topicContextTrigger}
                        items={[{ label: "Rename item", icon: <Pencil size={14} />, onSelect: () => openEditTopic(topic.id) }]}
                      >
                        <Button
                          className={`${styles.navButton} ${styles.topicSelectButton} ${topic.id === activeTopicId ? styles.activeNavButton : ""}`}
                          onClick={() => onSelectTopic(topic.id)}
                          fullWidth
                        >
                          {topic.title}
                        </Button>
                      </ContextActions>
                    ))}
                  <Button icon={<Plus size={15} />} onClick={() => openTopicCreator(section.id)} fullWidth>
                    New item
                  </Button>
                </Stack>
              </Stack>
            </Card>
          ))}
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
  views: NotebookView[]
  onSelectView: (viewId: string) => void
  onCreateView: (title: string, mode: ViewMode) => boolean
  onDeleteView: (viewId: string) => boolean
  onUpdateView: (view: NotebookView) => void
  onAddDisplay: (kind: ComponentKind) => boolean
  onUpdateDisplay: (display: DisplayInstance) => void
  onMoveDisplay: (displayId: string, direction: "up" | "down") => void
  onRemoveDisplay: (displayId: string) => void
}

function ViewWorkspace({ view, views, onSelectView, onCreateView, onDeleteView, onUpdateView, onAddDisplay, onUpdateDisplay, onMoveDisplay, onRemoveDisplay }: ViewWorkspaceProps) {
  const [title, setTitle] = useState("New view")
  const [mode, setMode] = useState<ViewMode>("structured")
  const [displayKind, setDisplayKind] = useState<ComponentKind>("data-card")
  const [selectedDisplayForArticle, setSelectedDisplayForArticle] = useState("1")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingViewId, setEditingViewId] = useState("")
  const [editingViewTitle, setEditingViewTitle] = useState("")
  const [changingModeViewId, setChangingModeViewId] = useState("")
  const [changingModeValue, setChangingModeValue] = useState<ViewMode>("structured")
  const [isDisplaysOpen, setIsDisplaysOpen] = useState(false)

  const create = () => {
    if (!onCreateView(title, mode)) return

    setTitle("New view")
    setIsCreateOpen(false)
  }

  const addDisplayToView = () => {
    if (!onAddDisplay(displayKind)) return

    setDisplayKind("data-card")
  }
  const openRenameView = (viewId: string) => {
    const targetView = views.find(item => item.id === viewId)
    if (!targetView) return

    setEditingViewId(targetView.id)
    setEditingViewTitle(targetView.title)
  }
  const renameView = () => {
    const targetView = views.find(item => item.id === editingViewId)
    const trimmedTitle = editingViewTitle.trim()
    if (!targetView || !trimmedTitle) return

    onUpdateView({ ...targetView, title: trimmedTitle })
    setEditingViewId("")
    setEditingViewTitle("")
  }
  const openChangeMode = (viewId: string) => {
    const targetView = views.find(item => item.id === viewId)
    if (!targetView) return

    setChangingModeViewId(targetView.id)
    setChangingModeValue(targetView.mode)
  }
  const changeMode = () => {
    const targetView = views.find(item => item.id === changingModeViewId)
    if (!targetView) return

    onUpdateView({ ...targetView, mode: changingModeValue })
    setChangingModeViewId("")
  }
  const closeChangeMode = () => {
    setChangingModeViewId("")
  }
  const createViewDialog = (
    <ModalDialog open={isCreateOpen} title="Create view" description="Add another view to this topic and choose how it should present content." onOpenChange={setIsCreateOpen}>
      <Stack gap="md">
        <TextField label="Title" value={title} onChange={event => setTitle(event.target.value)} />
        <SelectField label="Mode" value={mode} options={viewModeOptions} onValueChange={value => setMode(value as ViewMode)} />
        <Button icon={<Plus size={15} />} variant="primary" onClick={create} fullWidth>
          Create view
        </Button>
      </Stack>
    </ModalDialog>
  )

  if (!view)
    return (
      <>
        <Card className={styles.emptyCanvas}>
          <Stack gap="md">
            <Heading>No view selected</Heading>
            <Text>Create a view to start composing structured notebook content for this topic.</Text>
            <Button icon={<Plus size={15} />} variant="primary" onClick={() => setIsCreateOpen(true)}>
              New view
            </Button>
          </Stack>
        </Card>
        {createViewDialog}
      </>
    )

  return (
    <Stack gap="lg">
      <Stack className={styles.viewHeader} direction="horizontal" gap="md">
        <Stack direction="horizontal" role="tablist" aria-label="Views" className={styles.viewTabs} gap="none">
          {views.map(viewOption => (
            <ContextActions
              key={viewOption.id}
              items={[
                { label: "Rename", icon: <Pencil size={14} />, onSelect: () => openRenameView(viewOption.id) },
                { label: "Change mode", icon: <Layers3 size={14} />, onSelect: () => openChangeMode(viewOption.id) },
                { label: "Delete", icon: <Trash2 size={14} />, onSelect: () => onDeleteView(viewOption.id) },
              ]}
            >
              <Button
                key={viewOption.id}
                variant="ghost"
                className={viewOption.id === view.id ? styles.viewTabActive : styles.viewTab}
                role="tab"
                aria-selected={viewOption.id === view.id}
                onClick={() => onSelectView(viewOption.id)}
                fullWidth={false}
              >
                {viewOption.title}
              </Button>
            </ContextActions>
          ))}
        </Stack>
        <Stack className={styles.viewActions} direction="horizontal" gap="sm">
          <Button icon={<Plus size={15} />} onClick={() => setIsCreateOpen(true)}>
            New view
          </Button>
          <Button icon={<Layers3 size={15} />} onClick={() => setIsDisplaysOpen(true)}>
            Displays
          </Button>
        </Stack>
      </Stack>
      <Stack className={styles.preview} gap="lg">
        {view.mode === "article" ? (
          <ArticleWorkspace
            view={view}
            onUpdateView={onUpdateView}
            onUpdateDisplay={onUpdateDisplay}
            selectedDisplayForArticle={selectedDisplayForArticle}
            onChangeSelectedDisplay={setSelectedDisplayForArticle}
          />
        ) : (
          <>
            <Stack className={styles.displayStack} gap="lg">
              {view.displays.map(display => (
                <RenderedDisplay key={display.id} display={display} onUpdate={onUpdateDisplay} />
              ))}
            </Stack>
            {view.displays.length === 0 ? (
              <Card className={styles.emptyCanvas}>
                <Stack gap="md">
                  <Text>No displays have been added to this view yet.</Text>
                  <Button icon={<Layers3 size={15} />} onClick={() => setIsDisplaysOpen(true)}>
                    Add a display
                  </Button>
                </Stack>
              </Card>
            ) : null}
          </>
        )}
      </Stack>
      {createViewDialog}
      <ModalDialog open={Boolean(editingViewId)} title="Rename view" description="Update the selected view title." onOpenChange={open => !open && setEditingViewId("")}>
        <Stack gap="md">
          <TextField label="View title" value={editingViewTitle} onChange={event => setEditingViewTitle(event.target.value)} />
          <Button icon={<Pencil size={15} />} variant="primary" onClick={renameView} fullWidth>
            Rename view
          </Button>
        </Stack>
      </ModalDialog>
      <ModalDialog open={Boolean(changingModeViewId)} title="Change view mode" description="Choose how this view should render its content." onOpenChange={closeChangeMode}>
        <Stack gap="md">
          <SelectField label="Mode" value={changingModeValue} options={viewModeOptions} onValueChange={value => setChangingModeValue(value as ViewMode)} />
          <Button icon={<Layers3 size={15} />} variant="primary" onClick={changeMode} fullWidth>
            Save mode
          </Button>
        </Stack>
      </ModalDialog>
      <SideDrawer
        open={isDisplaysOpen}
        title="Manage displays"
        description="Add display types to this view, review the display order, reorder displays, or remove displays from the view."
        onOpenChange={setIsDisplaysOpen}
      >
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
    return (
      <StringListEditor
        title="Checklist items"
        items={arrayFrom(data.items)}
        label="Item"
        onAdd={() => addListItem("items", "New checklist item")}
        onChange={(index, value) => updateListItem("items", index, value)}
        onRemove={index => removeListItem("items", index)}
      />
    )

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
              <TextField
                label="Pull request URL"
                value={stringFrom(log.pullRequestUrl)}
                onChange={event => updateObjectItem("workLogs", index, "pullRequestUrl", event.target.value)}
              />
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
              <TextField
                label="GitHub issue or Jira ticket URL"
                value={stringFrom(bug.ticketUrl)}
                onChange={event => updateObjectItem("bugs", index, "ticketUrl", event.target.value)}
              />
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
                <TextField
                  label="Model or variant"
                  value={stringFrom(item.modelVariant)}
                  onChange={event => updateObjectItem("shoppingItems", index, "modelVariant", event.target.value)}
                />
                <TextField label="Store" value={stringFrom(item.store)} onChange={event => updateObjectItem("shoppingItems", index, "store", event.target.value)} />
                <TextField
                  label="Store location"
                  value={stringFrom(item.storeLocation)}
                  onChange={event => updateObjectItem("shoppingItems", index, "storeLocation", event.target.value)}
                />
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
        <StringListEditor
          title="Comments"
          items={arrayFrom(data.comments)}
          label="Comment"
          onAdd={() => addListItem("comments", "New comment")}
          onChange={(index, value) => updateListItem("comments", index, value)}
          onRemove={index => removeListItem("comments", index)}
        />
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
        <StringListEditor
          title="Keywords"
          items={arrayFrom(data.keywords)}
          label="Keyword"
          onAdd={() => addListItem("keywords", "New keyword")}
          onChange={(index, value) => updateListItem("keywords", index, value)}
          onRemove={index => removeListItem("keywords", index)}
        />
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

const replaceObjectAt = (items: Array<Record<string, unknown>>, index: number, patch: Record<string, unknown>) =>
  items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))

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
