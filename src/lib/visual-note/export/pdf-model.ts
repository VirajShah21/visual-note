import { parseArticleContent, type ArticleBlock } from "../article-content"
import { visualBlockLabel } from "../visual-blocks"
import { assetUrlFor } from "./assets"
import type { ExportDocument, ExportRenderContext, PdfExportOptions, PdfRenderBlock, PdfRenderModel } from "./types"

const stringFrom = (value: unknown, fallback = "") => {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)

    return fallback
}

const isPrivateAssetUrl = (source: string) => /^\/api\/assets\/[^/?#]+/i.test(source.trim())

const dataBlock = (title: string, data: unknown, breakBefore = false): PdfRenderBlock => ({
    kind: "data",
    title,
    body: JSON.stringify(data, null, 2),
    breakBefore,
})

const imageBlock = (source: string, alt: string, context: ExportRenderContext, breakBefore = false): PdfRenderBlock[] => {
    if (context.assetMode === "ignore") return []

    const url = assetUrlFor(source, context.assetMode, context.assetResolution)
    if (!url || isPrivateAssetUrl(url)) return [dataBlock(alt || "Image", "Image asset could not be embedded.", breakBefore)]

    return [{ kind: "image", alt, url, breakBefore }]
}

const visualBlock = (block: Extract<ArticleBlock, { kind: "visual" }>, context: ExportRenderContext, breakBefore = false): PdfRenderBlock[] => {
    if (block.visualKind === "image") return imageBlock(stringFrom(block.data.url), stringFrom(block.data.alt, "Image"), context, breakBefore)

    return [dataBlock(visualBlockLabel(block.visualKind), block.parseError ? block.raw : block.data, breakBefore)]
}

const renderArticleBlock = (block: ArticleBlock, context: ExportRenderContext, breakBefore = false): PdfRenderBlock[] => {
    if (block.kind === "heading") return [{ kind: "heading", depth: block.level, text: block.text, breakBefore }]
    if (block.kind === "subtitle" || block.kind === "paragraph") return [{ kind: "paragraph", text: block.text, breakBefore }]
    if (block.kind === "bulletList") return [{ kind: "list", ordered: false, items: block.items, breakBefore }]
    if (block.kind === "orderedList") return [{ kind: "list", ordered: true, items: block.items, breakBefore }]
    if (block.kind === "quote") return [{ kind: "quote", lines: block.lines, breakBefore }]
    if (block.kind === "code") return [{ kind: "code", language: block.language, code: block.code, breakBefore }]
    if (block.kind === "divider") return [{ kind: "divider", breakBefore }]
    if (block.kind === "callout") return [dataBlock(block.tone, block.text, breakBefore)]
    if (block.kind === "image") return imageBlock(block.url, block.alt, context, breakBefore)
    if (block.kind === "display") return [dataBlock(`Display ${block.displayIndex + 1}`, { displayIndex: block.displayIndex + 1 }, breakBefore)]
    if (block.kind === "visual") return visualBlock(block, context, breakBefore)

    return []
}

const pageBreak = (options: PdfExportOptions, level: "page" | "topic") => options.pageBreaks === level || (level === "page" && options.pageBreaks === "topic")

export const createPdfRenderModel = (document: ExportDocument, options: PdfExportOptions, context: ExportRenderContext): PdfRenderModel => {
    const blocks: PdfRenderBlock[] = []
    if (document.scope === "notebook") blocks.push({ kind: "heading", depth: 1, text: document.notebookTitle })

    document.pages.forEach((page, pageIndex) => {
        blocks.push({
            kind: "heading",
            depth: document.scope === "notebook" ? 2 : 1,
            text: page.title,
            breakBefore: pageIndex > 0 && pageBreak(options, "page"),
        })
        page.topics.forEach((topic, topicIndex) => {
            blocks.push({
                kind: "heading",
                depth: document.scope === "notebook" ? 3 : 2,
                text: topic.title,
                breakBefore: topicIndex > 0 && pageBreak(options, "topic"),
            })
            if (!topic.view) return

            const articleBlocks = parseArticleContent(topic.view.content, topic.view.displays.length).blocks
            articleBlocks.forEach(block => blocks.push(...renderArticleBlock(block, context)))
        })
    })

    return {
        title: document.notebookTitle,
        blocks,
        options: {
            margin: options.margin,
            orientation: options.orientation,
            pageBreaks: options.pageBreaks,
            pageSize: options.pageSize,
        },
    }
}
