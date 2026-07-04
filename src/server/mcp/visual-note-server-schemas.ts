import { z } from "zod"
import { visualBlockKinds } from "@/lib/visual-note/visual-blocks"

export const visualBlockKindSchema = z.enum(visualBlockKinds)
export const componentKindSchema = z.enum([
    "data-card",
    "checklist",
    "timeline",
    "dashboard",
    "work-logs",
    "bugs-list",
    "shopping-list",
    "pull-request",
    "url",
    "code-block",
] as const)
export const viewModeSchema = z.enum(["article", "structured", "dashboard"])
export const viewKindSchema = z.enum(["notebook", "page", "topic", "view", "display"])
export const blockInfoSchema = z.enum(["show", "type-only", "metadata-only"])
export const contentModeSchema = z.enum(["show", "hide-title", "hide"])
export const editorModeSchema = z.enum(["editing", "source", "reader"])
export const policyCheckSchema = z.enum(["notebook_summary", "non_empty_titles", "display_or_content", "layout_density"])
export const riskLevelSchema = z.enum(["low", "medium", "high"])

export const requireAtLeastOne = (schema: Record<string, unknown>, fields: string[]) =>
    z
        .object(schema)
        .partial()
        .refine(value => fields.some(field => Boolean((value as Record<string, string | undefined>)[field])), {
            message: `${fields.join(" or ")} is required.`,
        })

export const resolveNotebookInput = requireAtLeastOne({ notebookId: z.string().min(1), title: z.string().min(1) }, ["notebookId", "title"])
export const resolvePageInput = requireAtLeastOne(
    {
        pageId: z.string().min(1),
        title: z.string().min(1),
        notebookId: z.string().min(1),
    },
    ["pageId", "title"],
)
export const resolveTopicInput = requireAtLeastOne(
    {
        topicId: z.string().min(1),
        title: z.string().min(1),
        pageId: z.string().min(1),
    },
    ["topicId", "title"],
)
export const resolveViewInput = requireAtLeastOne(
    {
        viewId: z.string().min(1),
        title: z.string().min(1),
        topicId: z.string().min(1),
    },
    ["viewId", "title"],
)

export { z }
