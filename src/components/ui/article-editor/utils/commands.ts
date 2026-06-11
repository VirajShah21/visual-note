import { cryptoId, type ArticleBlock } from "@/lib/visual-note/article-content"
import type { DisplayInstance } from "@/lib/visual-note/types"
import { defaultVisualBlockData, visualBlockKinds, visualBlockLabel, type VisualBlockKind } from "@/lib/visual-note/visual-blocks"
import type { ArticleEditorCommand, CommandAction, CommandReducerState } from "../types"

export const CLOSED_COMMAND_STATE: CommandReducerState = {
    commandState: null,
    commandQuery: "",
    selectedCommandIndex: 0,
}

export const commandReducer = (state: CommandReducerState, action: CommandAction): CommandReducerState => {
    switch (action.type) {
        case "open":
            return { commandState: action.state, commandQuery: "", selectedCommandIndex: 0 }
        case "update":
            if (!state.commandState) return state
            return {
                ...state,
                commandState: { ...state.commandState, ...action.patch },
                commandQuery: action.query,
                selectedCommandIndex: 0,
            }
        case "close":
            return CLOSED_COMMAND_STATE
        case "selectDelta":
            return {
                ...state,
                selectedCommandIndex: Math.max(0, Math.min(state.selectedCommandIndex + action.delta, action.max)),
            }
    }
}

export const commandMatch = (command: ArticleEditorCommand, query: string) => {
    const normalized = query.toLowerCase().trim()
    if (!normalized) return true
    if (command.label.toLowerCase().includes(normalized)) return true
    return command.aliases.some(alias => alias.toLowerCase().includes(normalized))
}

const HEADING_LEVELS = [1, 2, 3, 4] as const

const VISUAL_BLOCK_ALIASES: Record<VisualBlockKind, string[]> = {
    "pull-request": ["github", "pr", "pull request", "github pull request"],
    "calendar-event": ["calendar", "event", "meeting"],
    "packing-list": ["packing", "trip", "travel"],
    "contact-card": ["contact", "person", "people"],
    "address-card": ["address", "location", "map"],
    chart: ["chart", "graph", "visualization"],
    recipe: ["recipe", "ingredients", "cooking"],
    "task-list": ["task", "tasks", "todo", "to-do"],
    "shopping-list": ["shopping", "shop", "grocery"],
    timeline: ["timeline", "events", "schedule"],
    poll: ["poll", "vote", "survey"],
}

export const createCommandList = (selectedDisplayIndex: number, displays: DisplayInstance[]) => {
    const selectedDisplay = Math.max(0, Math.min(selectedDisplayIndex, Math.max(displays.length - 1, 0)))
    const commands: ArticleEditorCommand[] = [...createBlockCommands(selectedDisplay), ...createVisualBlockCommands(), ...createInlineCommands()]

    displays.forEach((display, index) => {
        if (index === selectedDisplay) return

        commands.push({
            id: `display-${index + 1}`,
            label: display.name || `Display ${index + 1}`,
            description: `Insert {{display:${index + 1}}}`,
            aliases: [`display ${index + 1}`, `{{display:${index + 1}}}`],
            mode: "line",
            applyLine: () => ({ kind: "display", displayIndex: index }),
        })
    })

    return commands
}

const createBlockCommands = (selectedDisplay: number): ArticleEditorCommand[] => [
    ...HEADING_LEVELS.map(level => ({
        id: `heading-${level}`,
        label: `Heading ${level}`,
        description: `Create a level ${level} heading`,
        aliases: [`h${level}`, "#".repeat(level), `heading ${level}`],
        mode: "line" as const,
        applyLine: (): ArticleBlock => ({ kind: "heading", id: cryptoId(), level, text: "Heading" }),
    })),
    {
        id: "paragraph",
        label: "Paragraph",
        description: "Create a paragraph",
        aliases: ["p", "paragraph", "text"],
        mode: "line",
        applyLine: () => ({ kind: "paragraph", text: "Paragraph" }),
    },
    {
        id: "quote",
        label: "Quote",
        description: "Create a quote block",
        aliases: ["quote", ">", "blockquote"],
        mode: "line",
        applyLine: () => ({ kind: "quote", lines: ["Quoted text"] }),
    },
    {
        id: "bullet-list",
        label: "Bullet list",
        description: "Create a bullet list",
        aliases: ["bullet", "bullets", "list", "-"],
        mode: "line",
        applyLine: () => ({ kind: "bulletList", items: ["Item"] }),
    },
    {
        id: "ordered-list",
        label: "Ordered list",
        description: "Create an ordered list",
        aliases: ["ordered", "numbered", "1.", "list"],
        mode: "line",
        applyLine: () => ({ kind: "orderedList", items: ["Item"] }),
    },
    {
        id: "divider",
        label: "Divider",
        description: "Create a divider",
        aliases: ["divider", "---"],
        mode: "line",
        applyLine: () => ({ kind: "divider" }),
    },
    {
        id: "code-block",
        label: "Code block",
        description: "Create a code block",
        aliases: ["code", "code block", "```"],
        mode: "line",
        applyLine: () => ({ kind: "code", language: "typescript", code: "// Add code" }),
    },
    {
        id: "tip",
        label: "Tip",
        description: "Insert a tip callout",
        aliases: ["tip", "callout", "important"],
        mode: "line",
        applyLine: () => ({ kind: "callout", tone: "tip", text: "Tip content" }),
    },
    {
        id: "warning",
        label: "Warning",
        description: "Insert a warning callout",
        aliases: ["warning", "caution", "alert"],
        mode: "line",
        applyLine: () => ({ kind: "callout", tone: "warning", text: "Warning content" }),
    },
    {
        id: "note",
        label: "Note",
        description: "Insert a note callout",
        aliases: ["note", "info"],
        mode: "line",
        applyLine: () => ({ kind: "callout", tone: "note", text: "Note content" }),
    },
    {
        id: "image",
        label: "Image",
        description: "Insert an image block",
        aliases: ["image", "img", "photo", "media"],
        mode: "line",
        applyLine: () => ({ kind: "image", alt: "Image", url: "" }),
    },
    {
        id: "display",
        label: `Display ${selectedDisplay + 1}`,
        description: `Insert {{display:${selectedDisplay + 1}}}`,
        aliases: ["display", `{{display:${selectedDisplay + 1}}}`],
        mode: "line",
        applyLine: () => ({ kind: "display", displayIndex: selectedDisplay }),
    },
]

const createVisualBlockCommands = (): ArticleEditorCommand[] =>
    visualBlockKinds.map(kind => ({
        id: `visual-${kind}`,
        label: visualBlockLabel(kind),
        description: `Insert a visual ${kind} block`,
        aliases: VISUAL_BLOCK_ALIASES[kind],
        mode: "line",
        applyLine: () => ({
            kind: "visual",
            visualKind: kind,
            data: defaultVisualBlockData(kind),
            raw: "",
        }),
    }))

const createInlineCommands = (): ArticleEditorCommand[] => [
    {
        id: "inline-bold",
        label: "Bold",
        description: "Insert bold markdown",
        aliases: ["bold", "strong", "**"],
        mode: "inline",
        applyLine: () => ({ kind: "paragraph", text: "" }),
        inlineInsert: "**text**",
    },
    {
        id: "inline-italic",
        label: "Italic",
        description: "Insert italic markdown",
        aliases: ["italic", "emphasis", "*"],
        mode: "inline",
        applyLine: () => ({ kind: "paragraph", text: "" }),
        inlineInsert: "*text*",
    },
    {
        id: "inline-code",
        label: "Code",
        description: "Insert inline code",
        aliases: ["code", "inline", "`"],
        mode: "inline",
        applyLine: () => ({ kind: "paragraph", text: "" }),
        inlineInsert: "`code`",
    },
    {
        id: "inline-link",
        label: "Link",
        description: "Insert link markdown",
        aliases: ["link", "url", "hyperlink"],
        mode: "inline",
        applyLine: () => ({ kind: "paragraph", text: "" }),
        inlineInsert: "[text](url)",
    },
]
