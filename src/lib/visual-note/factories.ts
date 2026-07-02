import {
    defaultNotebookEditorSettings,
    type ComponentKind,
    type DisplayInstance,
    type Notebook,
    type NotebookEditorSettings,
    type NotebookPage,
    type NotebookView,
    type Topic,
    type ViewMode,
    type VisualNoteWorkspace,
} from "./types"

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const now = () => new Date().toISOString()

const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")

export const createNotebook = (userId: string, title: string): Notebook => ({
    id: createId("notebook"),
    userId,
    title,
    slug: slugify(title) || "untitled-notebook",
    summary: "A structured web notebook with sections, topics, views, components, and data.",
    color: "#2f7d5c",
    createdAt: now(),
    editorSettings: defaultNotebookEditorSettings,
})

export const createPage = (notebookId: string, title: string, position: number): NotebookPage => ({
    id: createId("page"),
    notebookId,
    title,
    position,
})

export const createTopic = (pageId: string, title: string, position: number): Topic => ({
    id: createId("topic"),
    pageId,
    title,
    summary: "A focused subdivision inside this section.",
    position,
})

export const createView = (topicId: string, title: string, mode: ViewMode = "article"): NotebookView => ({
    id: createId("view"),
    topicId,
    title,
    mode,
    position: 0,
    content:
        mode === "article"
            ? [
                  "# Article",
                  "## Why this view exists",
                  "Use this mode to write long-form documentation with embedded displays.",
                  "## Section title",
                  "Start writing the next section.",
              ].join("\n\n")
            : mode === "dashboard"
              ? "Capture dashboard context, metrics, and operational narratives here."
              : "Capture context, decisions, links, and structured observations here.",
    displays: [],
})

export const createDisplayInstance = (kind: ComponentKind, name: string = defaultDisplayName(kind)): DisplayInstance => ({
    id: createId("display"),
    name,
    kind,
    position: 0,
    data: defaultComponentData(kind),
})

export const defaultComponentData = (kind: ComponentKind): Record<string, unknown> => {
    if (kind === "work-logs")
        return {
            workLogs: [
                {
                    timestamp: "2026-06-01T09:00:00-04:00",
                    timeWorked: "2h 15m",
                    title: "Prototype display rendering",
                    description: "Added structured display support and verified the workspace UI.",
                    pullRequestUrl: "https://github.com/example/visual-note/pull/12",
                },
            ],
        }

    if (kind === "bugs-list")
        return {
            bugs: [
                {
                    title: "Display drawer loses scroll position",
                    description: "Opening a nested editor should not reset the display drawer position.",
                    ticketUrl: "https://github.com/example/visual-note/issues/42",
                    severity: "Medium",
                },
            ],
        }

    if (kind === "shopping-list")
        return {
            shoppingItems: [
                {
                    brand: "Muji",
                    product: "Notebook",
                    modelVariant: "A5 dotted",
                    store: "Muji",
                    storeLocation: "New York, NY",
                    storeUrl: "https://www.muji.us/",
                },
            ],
        }

    if (kind === "pull-request")
        return {
            prUrl: "https://github.com/example/visual-note/pull/12",
            prNumber: "#12",
            title: "Add structured display renderers",
            description: "Introduces reusable renderers for operational notebook data.",
            author: "viraj",
            reviewer: "reviewer",
            comments: ["Looks good overall.", "Please verify the empty state."],
        }

    if (kind === "url")
        return {
            bannerImage: "",
            socialPreviewImage: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80",
            pageTitle: "Visual Note",
            pageDescription: "A structured notebook where sections, topics, views, and data compose into a small website.",
            keywords: ["notebook", "structured data", "workspace"],
            url: "https://example.com/visual-note",
            favicon: "https://www.google.com/s2/favicons?domain=example.com&sz=64",
        }

    if (kind === "code-block")
        return {
            code: 'export const note = "Structured notebooks can render data."',
            sourceUrl: "https://github.com/example/visual-note",
            language: "typescript",
        }

    if (kind === "checklist")
        return {
            items: ["Define notebook shape", "Attach structured data", "Review page experience"],
        }

    if (kind === "timeline")
        return {
            events: [
                { label: "Research", date: "2026-06-01", time: "09:00" },
                { label: "Synthesis", date: "2026-06-02", time: "" },
            ],
        }

    if (kind === "dashboard")
        return {
            metrics: [
                { label: "Pages", value: 3 },
                { label: "Topics", value: 8 },
            ],
        }

    return {
        label: "Primary insight",
        value: "Structured notes can behave like websites.",
    }
}

export const defaultDisplayName = (kind: ComponentKind) => {
    if (kind === "data-card") return "Data card"
    if (kind === "bugs-list") return "Bugs list"
    if (kind === "shopping-list") return "Shopping list"
    if (kind === "pull-request") return "Pull request"
    if (kind === "code-block") return "Code block"
    if (kind === "work-logs") return "Work logs"

    return kind.charAt(0).toUpperCase() + kind.slice(1)
}

export const normalizeNotebookEditorSettings = (settings?: Partial<NotebookEditorSettings>): NotebookEditorSettings => ({
    blockInfo:
        settings?.blockInfo === "type-only" || settings?.blockInfo === "metadata-only" || settings?.blockInfo === "show"
            ? settings.blockInfo
            : defaultNotebookEditorSettings.blockInfo,
    contents: settings?.contents === "hide-title" || settings?.contents === "hide" || settings?.contents === "show" ? settings.contents : defaultNotebookEditorSettings.contents,
    mode: settings?.mode === "source" || settings?.mode === "reader" || settings?.mode === "editing" ? settings.mode : defaultNotebookEditorSettings.mode,
})

export const normalizeWorkspace = (workspace: VisualNoteWorkspace): VisualNoteWorkspace => {
    return {
        ...workspace,
        notebooks: workspace.notebooks.map(notebook => ({ ...notebook, editorSettings: normalizeNotebookEditorSettings(notebook.editorSettings) })),
        views: workspace.views.map(view => ({
            ...view,
            displays: view.displays.map(display => ({ ...display, data: display.data ?? defaultComponentData(display.kind) })),
        })),
    }
}

export const createEmptyWorkspace = (): VisualNoteWorkspace => ({
    notebooks: [],
    pages: [],
    topics: [],
    views: [],
})
