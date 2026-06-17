import { parseArticleContent, serializeArticleContent, type ArticleBlock } from "../article-content"
import type { ExportDocument, ExportRenderContext } from "./types"
import { assetUrlFor } from "./assets"

const stringFrom = (value: unknown, fallback = "") => {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)

    return fallback
}

const heading = (depth: number, text: string) => `${"#".repeat(depth)} ${text}`

const renderViewMarkdown = (content: string, displayCount: number, context: ExportRenderContext) => {
    const blocks = parseArticleContent(content, displayCount).blocks.flatMap((block): ArticleBlock[] => {
        if (block.kind === "image") {
            if (context.assetMode === "ignore") return []

            return [{ ...block, url: assetUrlFor(block.url, context.assetMode, context.assetResolution) }]
        }

        if (block.kind === "visual" && block.visualKind === "image") {
            if (context.assetMode === "ignore") return []

            const url = stringFrom(block.data.url)
            return [
                {
                    ...block,
                    data: {
                        ...block.data,
                        url: assetUrlFor(url, context.assetMode, context.assetResolution),
                    },
                },
            ]
        }

        return [block]
    })

    return serializeArticleContent(blocks)
}

export const renderMarkdownExport = (document: ExportDocument, context: ExportRenderContext) => {
    const chunks: string[] = []
    if (document.scope === "notebook") chunks.push(heading(1, document.notebookTitle))

    document.pages.forEach(page => {
        chunks.push(heading(document.scope === "notebook" ? 2 : 1, page.title))
        page.topics.forEach(topic => {
            chunks.push(heading(document.scope === "notebook" ? 3 : 2, topic.title))
            if (topic.view) chunks.push(renderViewMarkdown(topic.view.content, topic.view.displays.length, context))
        })
    })

    return chunks.filter(chunk => chunk.trim()).join("\n\n")
}
