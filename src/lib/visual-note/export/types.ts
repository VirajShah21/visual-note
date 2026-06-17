import type { ArticleBlock } from "../article-content"
import type { DisplayInstance, SelectionState, VisualNoteWorkspace } from "../types"

export type ExportScope = "page" | "notebook"
export type ExportAssetMode = "ignore" | "include" | "base64"
export type ExportFormat = "markdown" | "web" | "pdf"
export type WebExportMode = "static" | "server"
export type PdfPageSize = "letter" | "a4"
export type PdfOrientation = "portrait" | "landscape"
export type PdfMargin = "narrow" | "normal" | "wide"
export type PdfPageBreaks = "none" | "page" | "topic"

export type ExportDocumentInput = {
    scope: ExportScope
    selection: SelectionState
    workspace: VisualNoteWorkspace
}

export type ExportView = {
    id: string
    title: string
    content: string
    displays: DisplayInstance[]
}

export type ExportTopic = {
    id: string
    title: string
    position: number
    view: ExportView | null
}

export type ExportPage = {
    id: string
    title: string
    position: number
    topics: ExportTopic[]
}

export type ExportDocument = {
    notebookId: string
    notebookTitle: string
    slug: string
    scope: ExportScope
    pages: ExportPage[]
}

export type ExportAssetReference = {
    source: string
    alt: string
    preferredName: string
}

export type ExportResolvedAsset = {
    source: string
    fileName: string
    path: string
    contentType: string
    blob?: Blob
    dataUrl?: string
}

export type ExportAssetResolution = {
    assets: ExportResolvedAsset[]
    assetBySource: Map<string, ExportResolvedAsset>
    warnings: string[]
}

export type ExportRenderContext = {
    assetMode: ExportAssetMode
    assetResolution: ExportAssetResolution
}

export type ExportFileResult = {
    blob: Blob
    fileName: string
    warnings: string[]
}

export type MarkdownExportOptions = {
    assetMode: ExportAssetMode
}

export type WebExportOptions = {
    assetMode: ExportAssetMode
    mode: WebExportMode
}

export type PdfExportOptions = {
    assetMode: ExportAssetMode
    margin: PdfMargin
    orientation: PdfOrientation
    pageBreaks: PdfPageBreaks
    pageSize: PdfPageSize
}

export type PdfVisualDetail = {
    label: string
    value: string
}

export type PdfVisualSection = {
    title: string
    lines: string[]
}

export type PdfChartType = "bar" | "line" | "area" | "scatter" | "pie"

export type PdfChartSeries = {
    name: string
    values: number[]
}

export type PdfChartDataset = {
    labels: string[]
    series: PdfChartSeries[]
}

export type PdfPollOption = {
    label: string
    votes: number
    percent: number
}

export type PdfImageSize = "full" | "wide" | "medium" | "small"

export type PdfRenderBlock =
    | { kind: "heading"; depth: number; text: string; breakBefore?: boolean }
    | { kind: "paragraph"; text: string; breakBefore?: boolean }
    | { kind: "list"; ordered: boolean; items: string[]; breakBefore?: boolean }
    | { kind: "quote"; lines: string[]; breakBefore?: boolean }
    | { kind: "code"; language: string; code: string; breakBefore?: boolean }
    | { kind: "divider"; breakBefore?: boolean }
    | {
          kind: "image"
          alt: string
          url: string
          title?: string
          caption?: string
          overlayText?: string
          size?: PdfImageSize
          borderRadius?: number
          borderWidth?: number
          breakBefore?: boolean
      }
    | { kind: "data"; title: string; body: string; breakBefore?: boolean }
    | {
          kind: "visual-card"
          label: string
          title: string
          subtitle?: string
          details?: PdfVisualDetail[]
          badges?: string[]
          sections?: PdfVisualSection[]
          breakBefore?: boolean
      }
    | { kind: "chart"; title: string; chartType: PdfChartType; xLabel: string; yLabel: string; dataset: PdfChartDataset; breakBefore?: boolean }
    | { kind: "poll"; question: string; options: PdfPollOption[]; totalVotes: number; breakBefore?: boolean }

export type PdfRenderModel = {
    title: string
    blocks: PdfRenderBlock[]
    options: Omit<PdfExportOptions, "assetMode">
}

export type ParsedExportView = ExportView & {
    blocks: ArticleBlock[]
}
