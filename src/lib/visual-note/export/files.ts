import JSZip from "jszip"
import { resolveExportAssets } from "./assets"
import { createPdfRenderModel } from "./pdf-model"
import { createPdfBlob } from "./pdf-renderer"
import { renderMarkdownExport } from "./markdown"
import { createServerPackageFiles, renderWebHtml } from "./web"
import type { ExportAssetResolution, ExportDocument, ExportFileResult, ExportRenderContext, MarkdownExportOptions, PdfExportOptions, WebExportOptions } from "./types"

const textBlob = (content: string, type: string) => new Blob([content], { type })

const zipBlob = async (zip: JSZip) => zip.generateAsync({ type: "blob" })

const addAssets = (zip: JSZip, resolution: ExportAssetResolution) => {
    resolution.assets.forEach(asset => {
        if (asset.blob) zip.file(asset.path, asset.blob)
    })
}

const contextFor = async (document: ExportDocument, assetMode: MarkdownExportOptions["assetMode"]) => {
    const assetResolution = await resolveExportAssets(document, assetMode)
    return { assetMode, assetResolution }
}

export const createMarkdownExportFile = async (document: ExportDocument, options: MarkdownExportOptions): Promise<ExportFileResult> => {
    const context = await contextFor(document, options.assetMode)
    const markdown = renderMarkdownExport(document, context)
    if (options.assetMode !== "include")
        return {
            blob: textBlob(markdown, "text/markdown;charset=utf-8"),
            fileName: `${document.slug}.md`,
            warnings: context.assetResolution.warnings,
        }

    const zip = new JSZip()
    zip.file(`${document.slug}.md`, markdown)
    addAssets(zip, context.assetResolution)
    return {
        blob: await zipBlob(zip),
        fileName: `${document.slug}-markdown.zip`,
        warnings: context.assetResolution.warnings,
    }
}

export const createWebExportFile = async (document: ExportDocument, options: WebExportOptions): Promise<ExportFileResult> => {
    const context = await contextFor(document, options.assetMode)
    const html = renderWebHtml(document, context)
    if (options.assetMode !== "include" && options.mode === "static")
        return {
            blob: textBlob(html, "text/html;charset=utf-8"),
            fileName: `${document.slug}.html`,
            warnings: context.assetResolution.warnings,
        }

    const zip = new JSZip()
    const files = options.mode === "server" ? createServerPackageFiles(html) : { "index.html": html }
    Object.entries(files).forEach(([fileName, content]) => zip.file(fileName, content))
    addAssets(zip, context.assetResolution)
    return {
        blob: await zipBlob(zip),
        fileName: `${document.slug}-web.zip`,
        warnings: context.assetResolution.warnings,
    }
}

export const createPdfExportFile = async (document: ExportDocument, options: PdfExportOptions): Promise<ExportFileResult> => {
    const assetResolution = await resolveExportAssets(document, options.assetMode === "ignore" ? "ignore" : "include")
    const context: ExportRenderContext = { assetMode: options.assetMode === "ignore" ? "ignore" : "base64", assetResolution }
    const model = createPdfRenderModel(document, options, context)
    const blob = await createPdfBlob(model)
    if (options.assetMode !== "include")
        return {
            blob,
            fileName: `${document.slug}.pdf`,
            warnings: context.assetResolution.warnings,
        }

    const zip = new JSZip()
    zip.file(`${document.slug}.pdf`, blob)
    addAssets(zip, assetResolution)
    return {
        blob: await zipBlob(zip),
        fileName: `${document.slug}-pdf.zip`,
        warnings: assetResolution.warnings,
    }
}
