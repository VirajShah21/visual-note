import { parseArticleContent, type ArticleBlock } from "../article-content"
import { createPdfImageBlocks, createPdfVisualBlocks } from "./pdf-visual-blocks"
import type { ExportDocument, ExportRenderContext, PdfExportOptions, PdfRenderBlock, PdfRenderModel } from "./types"

const dataBlock = (title: string, data: unknown, breakBefore = false): PdfRenderBlock => ({
    kind: "data",
    title,
    body: JSON.stringify(data, null, 2),
    breakBefore,
})

const renderArticleBlock = (block: ArticleBlock, context: ExportRenderContext, breakBefore = false): PdfRenderBlock[] => {
    if (block.kind === "heading") return [{ kind: "heading", depth: block.level, text: block.text, breakBefore }]
    if (block.kind === "subtitle" || block.kind === "paragraph") return [{ kind: "paragraph", text: block.text, breakBefore }]
    if (block.kind === "bulletList") return [{ kind: "list", ordered: false, items: block.items, breakBefore }]
    if (block.kind === "orderedList") return [{ kind: "list", ordered: true, items: block.items, breakBefore }]
    if (block.kind === "quote") return [{ kind: "quote", lines: block.lines, breakBefore }]
    if (block.kind === "code") return [{ kind: "code", language: block.language, code: block.code, breakBefore }]
    if (block.kind === "divider") return [{ kind: "divider", breakBefore }]
    if (block.kind === "callout") return [dataBlock(block.tone, block.text, breakBefore)]
    if (block.kind === "image") return createPdfImageBlocks({ source: block.url, alt: block.alt, context, breakBefore })
    if (block.kind === "display") return [dataBlock(`Display ${block.displayIndex + 1}`, { displayIndex: block.displayIndex + 1 }, breakBefore)]
    if (block.kind === "visual") return createPdfVisualBlocks(block, context, breakBefore)

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
