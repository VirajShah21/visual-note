import { z } from "zod"
import { normalizeNotebookEditorSettings } from "@/lib/visual-note/factories"
import type { ComponentKind, Notebook } from "@/lib/visual-note/types"

const topicSchema = z.object({
    id: z.string(),
    pageId: z.string(),
    title: z.string(),
    summary: z.string(),
    position: z.number().int().nonnegative(),
})

const displaySchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    kind: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
})

const viewModeSchema = z.enum(["article", "structured", "dashboard"])

const editorSettingsSchema = z
    .object({
        blockInfo: z.enum(["show", "type-only", "metadata-only"]).optional(),
        contents: z.enum(["show", "hide-title", "hide"]).optional(),
        mode: z.enum(["editing", "source", "reader"]).optional(),
    })
    .partial()
    .optional()

const viewSchema = z.object({
    id: z.string(),
    topicId: z.string(),
    title: z.string(),
    mode: viewModeSchema,
    content: z.string(),
    displays: z.array(displaySchema),
})

type ParsedPageUpdate = z.infer<typeof pageUpdateSchema>

const isComponentKind = (value: string | undefined): value is ComponentKind =>
    value === "data-card" ||
    value === "checklist" ||
    value === "timeline" ||
    value === "dashboard" ||
    value === "work-logs" ||
    value === "bugs-list" ||
    value === "shopping-list" ||
    value === "pull-request" ||
    value === "url" ||
    value === "code-block"

const normalizeDisplay = (display: z.infer<typeof displaySchema>) => ({
    id: display.id ?? `display-${crypto.randomUUID()}`,
    name: display.name?.trim() || "Display",
    kind: isComponentKind(display.kind) ? display.kind : "data-card",
    data: display.data ?? {},
})

const parseDisplayInputs = (views: ParsedPageUpdate["views"]) =>
    views.map(view => ({
        ...view,
        displays: view.displays.map(display => normalizeDisplay(display)),
    }))

const notebookSchema = z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    color: z.string(),
    createdAt: z.string(),
    editorSettings: editorSettingsSchema,
})

const pageSchema = z.object({
    id: z.string(),
    notebookId: z.string(),
    title: z.string(),
    position: z.number().int().nonnegative(),
})

const pageUpdateSchema = z.object({
    notebook: notebookSchema.optional(),
    page: pageSchema,
    topics: z.array(topicSchema),
    views: z.array(viewSchema),
    markdown: z.string().optional(),
})

export type PageUpdateParseResult =
    | {
          ok: true
          notebook: Notebook | null
          page: ParsedPageUpdate["page"]
          topics: ParsedPageUpdate["topics"]
          views: ReturnType<typeof parseDisplayInputs>
          markdown?: string
      }
    | { ok: false; error: string; status: 400 }

export const parsePageUpdateRequest = async (request: Request, pageId: string): Promise<PageUpdateParseResult> => {
    const body = (await request.json().catch(() => null)) as ParsedPageUpdate | null
    const parsed = pageUpdateSchema.safeParse(body)
    if (!parsed.success) return { ok: false, error: "Invalid page update payload.", status: 400 }
    if (parsed.data.page.id !== pageId) return { ok: false, error: "Page identifier mismatch.", status: 400 }

    return {
        ok: true,
        notebook: parsed.data.notebook
            ? {
                  ...parsed.data.notebook,
                  editorSettings: parsed.data.notebook.editorSettings ? normalizeNotebookEditorSettings(parsed.data.notebook.editorSettings) : undefined,
              }
            : null,
        page: parsed.data.page,
        topics: parsed.data.topics,
        views: parseDisplayInputs(parsed.data.views),
        markdown: parsed.data.markdown,
    }
}
