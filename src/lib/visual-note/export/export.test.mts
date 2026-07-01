import assert from "node:assert/strict"
import test from "node:test"
import type { VisualChartType } from "../chart-data"
import { createExportDocument } from "./document"
import { renderMarkdownExport } from "./markdown"
import { createPdfChartRenderPlan } from "./pdf-chart-render-plan"
import { createPdfRenderModel } from "./pdf-model"
import { createServerPackageFiles, renderWebHtml } from "./web"
import { defaultVisualBlockData, serializeVisualBlockBody, visualBlockKinds } from "../visual-blocks"
import type { VisualNoteWorkspace } from "../types"
import type { ExportAssetMode, ExportAssetResolution, PdfRenderBlock } from "./types"

type PdfChartRenderBlock = Extract<PdfRenderBlock, { kind: "chart" }>

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

const chartTypes: VisualChartType[] = ["bar", "line", "area", "scatter", "pie"]

const chartFence = (type: VisualChartType) =>
    [
        "```visual:chart",
        serializeVisualBlockBody({
            ...defaultVisualBlockData("chart"),
            title: `${type} chart`,
            type,
        }),
        "```",
    ].join("\n")

const chartBlocksFrom = (blocks: PdfRenderBlock[]) => blocks.filter((block): block is PdfChartRenderBlock => block.kind === "chart")

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

test("maps each chart type into PDF chart render blocks", () => {
    const chartWorkspace: VisualNoteWorkspace = {
        ...workspace,
        views: [
            {
                ...workspace.views[0],
                content: chartTypes.map(chartFence).join("\n\n"),
            },
        ],
    }
    const document = createExportDocument({ scope: "page", selection, workspace: chartWorkspace })
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
    const chartBlocks = chartBlocksFrom(model.blocks)

    assert.deepEqual(
        chartBlocks.map(block => block.chartType),
        chartTypes,
    )
    assert.deepEqual(
        chartBlocks.map(block => block.dataset.labels),
        chartTypes.map(() => ["Mon", "Tue", "Wed"]),
    )
})

test("builds vector render plans for cartesian PDF chart types", () => {
    const dataset = {
        labels: ["Mon", "Tue"],
        series: [
            { name: "Actual", values: [4, 7] },
            { name: "Target", values: [6, 8] },
        ],
    }
    const barPlan = createPdfChartRenderPlan({ chartType: "bar", dataset })
    const linePlan = createPdfChartRenderPlan({ chartType: "line", dataset })
    const areaPlan = createPdfChartRenderPlan({ chartType: "area", dataset })
    const scatterPlan = createPdfChartRenderPlan({ chartType: "scatter", dataset })

    assert.equal(barPlan.bars.length, 4)
    assert.equal(barPlan.seriesLegendItems.length, 2)
    assert.equal(linePlan.lines.length, 2)
    assert.equal(linePlan.points.length, 4)
    assert.match(linePlan.lines[0]?.path ?? "", /^M/)
    assert.equal(areaPlan.areas.length, 2)
    assert.match(areaPlan.areas[0]?.path ?? "", /^M/)
    assert.equal(scatterPlan.points.length, 4)
    assert.equal(scatterPlan.points[0]?.fill, scatterPlan.points[0]?.color)
})

test("builds pie and fallback PDF chart render plans", () => {
    const piePlan = createPdfChartRenderPlan({
        chartType: "pie",
        dataset: {
            labels: ["Mon", "Tue"],
            series: [
                { name: "Actual", values: [4, 7] },
                { name: "Target", values: [6, 8] },
            ],
        },
    })
    const emptyPiePlan = createPdfChartRenderPlan({
        chartType: "pie",
        dataset: {
            labels: ["Empty"],
            series: [{ name: "Zero", values: [0] }],
        },
    })
    const fallbackPlan = createPdfChartRenderPlan({ chartType: "bar", dataset: { labels: [], series: [] } })

    assert.equal(piePlan.pies.length, 2)
    assert.equal(piePlan.pies[0]?.slices.length, 2)
    assert.equal(piePlan.pieLegendItems.length, 2)
    assert.equal(emptyPiePlan.pies[0]?.empty, true)
    assert.deepEqual(fallbackPlan.labels, ["No data"])
    assert.equal(fallbackPlan.bars.length, 1)
})
