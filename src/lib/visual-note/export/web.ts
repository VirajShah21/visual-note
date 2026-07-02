import { parseArticleContent, type ArticleBlock } from "@lib/visual-note/article-content"
import type { DisplayInstance } from "@lib/visual-note/types"
import { visualBlockLabel } from "@lib/visual-note/visual-blocks"
import { assetUrlFor } from "./assets"
import type { ExportDocument, ExportRenderContext } from "./types"

const stringFrom = (value: unknown, fallback = "") => {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)

    return fallback
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const renderText = (value: string) => escapeHtml(value).replace(/\n/g, "<br />")

const renderDataBlock = (title: string, data: unknown) => `
<article class="data-block">
    <h4>${escapeHtml(title)}</h4>
    <pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>
</article>`

const renderImage = (source: string, alt: string, caption: string, context: ExportRenderContext) => {
    if (context.assetMode === "ignore") return ""

    const url = assetUrlFor(source, context.assetMode, context.assetResolution)
    return `
<figure class="image-block">
    <img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />
    ${caption ? `<figcaption>${renderText(caption)}</figcaption>` : ""}
</figure>`
}

const renderList = (block: Extract<ArticleBlock, { kind: "bulletList" | "orderedList" }>) => {
    const tag = block.kind === "orderedList" ? "ol" : "ul"
    const items = block.items.map(item => `<li>${renderText(item)}</li>`).join("")
    return `<${tag}>${items}</${tag}>`
}

const renderVisualBlock = (block: Extract<ArticleBlock, { kind: "visual" }>, context: ExportRenderContext) => {
    if (block.visualKind === "image") return renderImage(stringFrom(block.data.url), stringFrom(block.data.alt, "Image"), stringFrom(block.data.caption), context)

    return renderDataBlock(visualBlockLabel(block.visualKind), block.parseError ? block.raw : block.data)
}

const renderArticleBlock = (block: ArticleBlock, displays: DisplayInstance[], context: ExportRenderContext) => {
    if (block.kind === "heading") return `<h${block.level}>${renderText(block.text)}</h${block.level}>`
    if (block.kind === "subtitle") return `<p class="subtitle">${renderText(block.text)}</p>`
    if (block.kind === "paragraph") return `<p>${renderText(block.text)}</p>`
    if (block.kind === "bulletList" || block.kind === "orderedList") return renderList(block)
    if (block.kind === "quote") return `<blockquote>${block.lines.map(line => `<p>${renderText(line)}</p>`).join("")}</blockquote>`
    if (block.kind === "code") return `<pre class="code-block"><code>${escapeHtml(block.code)}</code></pre>`
    if (block.kind === "divider") return "<hr />"
    if (block.kind === "callout") return `<aside class="callout ${block.tone}">${renderText(block.text)}</aside>`
    if (block.kind === "image") return renderImage(block.url, block.alt, "", context)
    if (block.kind === "display") return renderDataBlock(displays?.[block.displayIndex]?.name ?? "Display", displays?.[block.displayIndex]?.data ?? {})
    if (block.kind === "visual") return renderVisualBlock(block, context)

    return ""
}

const renderView = (content: string, displays: DisplayInstance[], context: ExportRenderContext) =>
    parseArticleContent(content, displays.length)
        .blocks.map(block => renderArticleBlock(block, displays, context))
        .filter(Boolean)
        .join("\n")

const exportStyles = `
:root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body { margin: 0; background: #f5f7f8; color: #17212b; }
.notebook { width: min(920px, calc(100vw - 32px)); margin: 0 auto; padding: 48px 0 72px; }
.page { margin-top: 42px; padding-top: 28px; border-top: 1px solid #d7e0e7; }
.topic { margin-top: 28px; }
h1, h2, h3, h4 { margin: 0 0 12px; color: #101820; line-height: 1.16; }
p, li, blockquote, aside { font-size: 16px; line-height: 1.65; }
.subtitle { color: #586879; font-size: 18px; }
.image-block { margin: 24px 0; }
.image-block img { display: block; max-width: 100%; border-radius: 8px; }
figcaption { margin-top: 8px; color: #586879; font-size: 13px; }
.data-block, .callout { margin: 18px 0; border: 1px solid #d7e0e7; border-radius: 8px; background: #ffffff; padding: 16px; }
.data-block pre, .code-block { overflow: auto; border-radius: 8px; background: #101820; color: #d8e2ec; padding: 14px; }
blockquote { margin: 18px 0; border-left: 3px solid #2f7d5c; padding-left: 16px; color: #344657; }
hr { height: 1px; border: 0; background: #d7e0e7; }
`

export const renderWebHtml = (document: ExportDocument, context: ExportRenderContext) => {
    const title = document.scope === "notebook" ? document.notebookTitle : (document.pages[0]?.title ?? document.notebookTitle)
    const pages = document.pages
        .map(page => {
            const topics = page.topics
                .map(topic => {
                    const body = topic.view ? renderView(topic.view.content, topic.view.displays, context) : ""
                    return `<section class="topic"><h3>${renderText(topic.title)}</h3>${body}</section>`
                })
                .join("\n")

            return `<section class="page"><h2>${renderText(page.title)}</h2>${topics}</section>`
        })
        .join("\n")

    return [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8" />',
        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
        `<title>${escapeHtml(document.notebookTitle)}</title>`,
        `<style>${exportStyles}</style>`,
        "</head>",
        "<body>",
        `<main class="notebook"><h1>${renderText(title)}</h1>${pages}</main>`,
        "</body>",
        "</html>",
    ].join("\n")
}

export const createServerPackageFiles = (html: string) => ({
    "index.html": html,
    "package.json": JSON.stringify({ private: true, scripts: { start: "node server.mjs" }, type: "module" }, null, 2),
    "server.mjs": [
        'import { createServer } from "node:http"',
        'import { readFile } from "node:fs/promises"',
        'import { extname, join, normalize } from "node:path"',
        "",
        "const port = Number(process.env.PORT || 4173)",
        "const root = process.cwd()",
        'const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" }',
        "createServer(async (request, response) => {",
        '    const pathname = new URL(request.url || "/", "http://localhost").pathname',
        '    const filePath = normalize(join(root, pathname === "/" ? "index.html" : pathname))',
        "    if (!filePath.startsWith(root)) { response.writeHead(403).end(); return }",
        "    try {",
        "        const body = await readFile(filePath)",
        '        response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" }).end(body)',
        "    } catch {",
        '        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found")',
        "    }",
        `}).listen(port, () => console.log(\`Visual Note export running at http://localhost:\${port}\`))`,
    ].join("\n"),
})
