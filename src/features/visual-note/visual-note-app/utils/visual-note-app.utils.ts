import type { NotebookGalleryItem, SimpleChartRow } from "@/components/ui"
import { createView } from "@/lib/visual-note/factories"
import type { ComponentKind, NotebookView, SelectionState, VisualNoteWorkspace } from "@/lib/visual-note/types"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"

export const blankSelection: SelectionState = {
    notebookId: "",
    pageId: "",
    topicId: "",
    viewId: "",
}

export const componentKindOptions: Array<{ label: string; value: ComponentKind }> = [
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

export const readableKind = (kind: ComponentKind) => componentKindOptions.find(option => option.value === kind)?.label ?? kind

export const timelineItemRevealTransition = (index: number) => ({
    type: "spring" as const,
    stiffness: 140,
    damping: 18,
    mass: 1.1,
    delay: index * 0.25,
    duration: 1,
})

export const firstByPosition = <T extends { position: number }>(items: T[]) => [...items].sort((a, b) => a.position - b.position)[0]

export const ensureSelectionHasArticleView = (workspace: VisualNoteWorkspace, selection: SelectionState) => {
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

export const coerceSingleArticleViewPerTopic = (workspace: VisualNoteWorkspace) => {
    const viewsByTopic = new Map<string, NotebookView[]>()
    workspace.views.forEach(view => viewsByTopic.set(view.topicId, [...(viewsByTopic.get(view.topicId) ?? []), view]))

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

    return { ...workspace, views }
}

export const deriveSelection = (workspace: VisualNoteWorkspace | null, selection: SelectionState): SelectionState => {
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

export const deleteTopicFromWorkspace = (workspace: VisualNoteWorkspace, topicId: string) => {
    const topic = workspace.topics.find(item => item.id === topicId)
    if (!topic) return null

    return {
        topic,
        workspace: {
            ...workspace,
            topics: workspace.topics.filter(item => item.id !== topicId),
            views: workspace.views.filter(view => view.topicId !== topicId),
        },
    }
}

export const deleteSectionFromWorkspace = (workspace: VisualNoteWorkspace, sectionId: string) => {
    const section = workspace.pages.find(item => item.id === sectionId)
    if (!section) return null

    const deletedTopicIds = workspace.topics.filter(topic => topic.pageId === sectionId).map(topic => topic.id)
    const remainingPages = workspace.pages.filter(item => item.id !== sectionId)
    const normalizedNotebookPages = remainingPages
        .filter(item => item.notebookId === section.notebookId)
        .sort((a, b) => a.position - b.position)
        .map((item, index) => ({ ...item, position: index }))

    return {
        section,
        workspace: {
            ...workspace,
            pages: [...remainingPages.filter(item => item.notebookId !== section.notebookId), ...normalizedNotebookPages],
            topics: workspace.topics.filter(topic => topic.pageId !== sectionId),
            views: workspace.views.filter(view => !deletedTopicIds.includes(view.topicId)),
        },
    }
}

export const createNotebookGalleryItems = (workspace: VisualNoteWorkspace, notebooks: VisualNoteWorkspace["notebooks"]): NotebookGalleryItem[] =>
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
            createdAt: notebook.createdAt,
            updatedLabel,
            pageCount: pages.length,
            topicCount: topics.length,
            viewCount: views.length,
            displayCount,
            pageTitles: pages.map(page => page.title),
            topicTitles: topics.map(topic => topic.title),
        }
    })

export const arrayFrom = (value: unknown) => {
    if (Array.isArray(value)) return value.map(item => String(item))
    if (typeof value === "string" && value.trim()) return value.split(",").map(item => item.trim())
    return []
}

export const objectArrayFrom = (value: unknown) => {
    if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    return []
}

export const timelineEventsFromData = (value: unknown) => {
    const asArray = objectArrayFrom(value)
    if (asArray.length > 0) return asArray
    if (!value || typeof value !== "object" || Array.isArray(value)) return []

    const eventRecord = value as Record<string, unknown>
    const candidates = Object.values(eventRecord).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    if (candidates.length > 0) return candidates
    return "label" in eventRecord || "date" in eventRecord || "time" in eventRecord ? [eventRecord] : []
}

export const stringFrom = (value: unknown, fallback = "") => {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    return fallback
}

export const numberFrom = (value: unknown, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return fallback
}

export const chartRowsFromData = (value: unknown): SimpleChartRow[] =>
    objectArrayFrom(value).map((item, index) => ({ label: stringFrom(item.label, `Item ${index + 1}`), value: numberFrom(item.value, 0) }))

export const dateInputValue = (value: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(stringFrom(value)) ? stringFrom(value) : "")

export const timeInputValue = (value: unknown) => (/^\d{2}:\d{2}$/.test(stringFrom(value)) ? stringFrom(value) : "")

export const timelineScheduleText = (eventItem: Record<string, unknown>) => {
    const date = dateInputValue(eventItem.date)
    const time = timeInputValue(eventItem.time)
    if (date && time) return `${date} at ${time}`
    return date || time || "Unscheduled"
}

export const calendarEventSchedule = (data: VisualBlockData) => {
    const date = dateInputValue(data.date)
    const start = timeInputValue(data.startTime)
    const end = timeInputValue(data.endTime)
    const time = start && end ? `${start}-${end}` : start || end
    if (date && time) return `${date} at ${time}`
    return date || time || "Unscheduled"
}

export const replaceStringAt = (items: string[], index: number, value: string) => items.map((item, itemIndex) => (itemIndex === index ? value : item))

export const replaceObjectAt = (items: Array<Record<string, unknown>>, index: number, patch: Record<string, unknown>) =>
    items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))

export const defaultListItems = {
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
