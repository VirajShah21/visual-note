import assert from "node:assert/strict"
import test from "node:test"
import { createExportDocument } from "./document.ts"
import { renderMarkdownExport } from "./markdown.ts"
import { createPdfRenderModel } from "./pdf-model.ts"
import { createServerPackageFiles, renderWebHtml } from "./web.ts"
import { defaultVisualBlockData, serializeVisualBlockBody, visualBlockKinds } from "../visual-blocks.ts"
import type { VisualNoteWorkspace } from "../types.ts"
import type { ExportAssetMode, ExportAssetResolution } from "./types.ts"

const workspace: VisualNoteWorkspace = {
    notebooks: [
        {
            id: "notebook-1",
            userId: "user-1",
            title: "Export Book",
            slug: "export-book",
            summary: "",
            color: "#2f7d5c",
            createdAt: "2026-06-17T00:00:00.000Z",
        },
    ],
    pages: [
        { id: "page-2", notebookId: "notebook-1", title: "Research", position: 1 },
        { id: "page-1", notebookId: "notebook-1", title: "Home", position: 0 },
    ],
    topics: [
        { id: "topic-2", pageId: "page-1", title: "Second", summary: "", position: 1 },
        { id: "topic-1", pageId: "page-1", title: "Intro", summary: "", position: 0 },
        { id: "topic-3", pageId: "page-2", title: "Deep", summary: "", position: 0 },
    ],
    views: [
        {
            id: "view-1",
            topicId: "topic-1",
            title: "Intro view",
            mode: "article",
            content: ["# View", "Intro text.", "![Photo](/api/assets/asset-1)", "```visual:image", 'url: "/api/assets/asset-1",', 'alt: "Visual photo"', "```"].join("\n\n"),
            displays: [],
        },
        {
            id: "view-2",
            topicId: "topic-2",
            title: "Second view",
            mode: "article",
            content: "Second text.",
            displays: [],
        },
        {
            id: "view-3",
            topicId: "topic-3",
            title: "Deep view",
            mode: "article",
            content: "Deep text.",
            displays: [],
        },
    ],
    components: [],
}

const selection = {
    notebookId: "notebook-1",
    pageId: "page-1",
    topicId: "topic-1",
    viewId: "view-1",
}

const assetResolution: ExportAssetResolution = {
    assets: [
        {
            source: "/api/assets/asset-1",
            fileName: "photo.png",
            path: "assets/photo.png",
            contentType: "image/png",
            dataUrl: "data:image/png;base64,AAAA",
        },
    ],
    assetBySource: new Map([
        [
            "/api/assets/asset-1",
            {
                source: "/api/assets/asset-1",
                fileName: "photo.png",
                path: "assets/photo.png",
                contentType: "image/png",
                dataUrl: "data:image/png;base64,AAAA",
            },
        ],
    ]),
    warnings: [],
}

const renderContext = (assetMode: ExportAssetMode) => ({ assetMode, assetResolution })

const visualFence = (kind: (typeof visualBlockKinds)[number]) => {
    const data =
        kind === "image"
            ? {
                  ...defaultVisualBlockData(kind),
                  url: "/api/assets/asset-1",
                  alt: "Visual photo",
                  title: "Embedded visual image",
                  caption: "Image caption",
                  overlayText: "Image overlay",
                  size: "medium",
                  borderRadius: 8,
                  borderWidth: 2,
              }
            : defaultVisualBlockData(kind)

    return [`\`\`\`visual:${kind}`, serializeVisualBlockBody(data), "```"].join("\n")
}

test("builds current-page and full-notebook export documents in position order", () => {
    const currentPage = createExportDocument({ scope: "page", selection, workspace })
    const notebook = createExportDocument({ scope: "notebook", selection, workspace })

    assert.deepEqual(
        currentPage?.pages.map(page => page.title),
        ["Home"],
    )
    assert.deepEqual(
        currentPage?.pages[0]?.topics.map(topic => topic.title),
        ["Intro", "Second"],
    )
    assert.deepEqual(
        notebook?.pages.map(page => page.title),
        ["Home", "Research"],
    )
})

test("renders Markdown with include, base64, and ignore asset modes", () => {
    const document = createExportDocument({ scope: "page", selection, workspace })
    assert.ok(document)

    const included = renderMarkdownExport(document, renderContext("include"))
    assert.match(included, /!\[Photo\]\(assets\/photo\.png\)/)
    assert.match(included, /assets\/photo\.png/)
    assert.doesNotMatch(included, /\/api\/assets\/asset-1/)

    const base64 = renderMarkdownExport(document, renderContext("base64"))
    assert.match(base64, /data:image\/png;base64,AAAA/)

    const ignored = renderMarkdownExport(document, renderContext("ignore"))
    assert.doesNotMatch(ignored, /!\[Photo\]/)
    assert.doesNotMatch(ignored, /visual:image/)
})

test("renders static HTML and server package files", () => {
    const document = createExportDocument({ scope: "notebook", selection, workspace })
    assert.ok(document)

    const html = renderWebHtml(document, renderContext("include"))
    assert.match(html, /<title>Export Book<\/title>/)
    assert.match(html, /assets\/photo\.png/)

    const files = createServerPackageFiles(html)
    assert.equal(files["index.html"], html)
    assert.match(files["server.mjs"], /createServer/)
    assert.match(files["package.json"], /"start": "node server.mjs"/)
})

test("maps PDF export options and page-break choices into a render model", () => {
    const document = createExportDocument({ scope: "page", selection, workspace })
    assert.ok(document)

    const model = createPdfRenderModel(
        document,
        {
            assetMode: "base64",
            margin: "wide",
            orientation: "landscape",
            pageBreaks: "topic",
            pageSize: "a4",
        },
        renderContext("base64"),
    )

    assert.deepEqual(model.options, {
        margin: "wide",
        orientation: "landscape",
        pageBreaks: "topic",
        pageSize: "a4",
    })
    assert.equal(
        model.blocks.some(block => block.kind === "image" && block.url === "data:image/png;base64,AAAA"),
        true,
    )
    assert.equal(
        model.blocks.some(block => block.kind === "heading" && block.text === "Second" && block.breakBefore),
        true,
    )
})

test("maps every supported visual block into structured PDF render blocks", () => {
    const allVisualWorkspace: VisualNoteWorkspace = {
        ...workspace,
        views: [
            {
                ...workspace.views[0],
                content: visualBlockKinds.map(visualFence).join("\n\n"),
            },
        ],
    }
    const document = createExportDocument({ scope: "page", selection, workspace: allVisualWorkspace })
    assert.ok(document)

    const model = createPdfRenderModel(
        document,
        {
            assetMode: "base64",
            margin: "normal",
            orientation: "portrait",
            pageBreaks: "none",
            pageSize: "letter",
        },
        renderContext("base64"),
    )
    const visualCards = model.blocks.filter(block => block.kind === "visual-card")

    assert.equal(
        model.blocks.some(
            block => block.kind === "image" && block.title === "Embedded visual image" && block.caption === "Image caption" && block.size === "medium" && block.borderWidth === 2,
        ),
        true,
    )
    assert.equal(
        model.blocks.some(block => block.kind === "chart" && block.title === "Notebook activity" && block.dataset.series.length === 2),
        true,
    )
    assert.equal(
        model.blocks.some(block => block.kind === "poll" && block.question === "Which block should we polish first?" && block.options.length === 2),
        true,
    )
    assert.deepEqual(
        visualCards.map(block => block.label).sort(),
        ["Address Card", "Calendar Event", "Contact Card", "Packing List", "Pull Request", "Recipe", "Shopping List", "Task List", "Timeline"].sort(),
    )
    assert.equal(
        model.blocks.some(block => block.kind === "data" && /Pull Request|Calendar Event|Task List/.test(block.title)),
        false,
    )
})
