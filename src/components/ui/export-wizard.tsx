"use client"

import { ClipboardCopy, Download, FileText, FileType2, Globe2 } from "lucide-react"
import { useCallback, useMemo, useState, type ReactElement } from "react"
import type { SelectionState, VisualNoteWorkspace } from "@/lib/visual-note/types"
import {
    createExportDocument,
    createMarkdownExportFile,
    createPdfExportFile,
    createWebExportFile,
    renderMarkdownExport,
    resolveExportAssets,
    type ExportAssetMode,
    type ExportFileResult,
    type ExportFormat,
    type ExportScope,
    type PdfMargin,
    type PdfOrientation,
    type PdfPageBreaks,
    type PdfPageSize,
    type WebExportMode,
} from "@/lib/visual-note/export"
import { Button } from "./button"
import { RadioField } from "./form-controls"
import { ModalDialog } from "./overlays"
import { SegmentedControl } from "./segmented-control"
import { Stack, Text } from "./primitives"
import { ExportStatus, PdfExportPanel, WebExportPanel } from "./export-wizard-panels"
import styles from "./export-wizard.module.css"

export type ExportWizardProps = {
    open: boolean
    selection: SelectionState
    workspace: VisualNoteWorkspace
    onOpenChange: (open: boolean) => void
}

const formatOptions = [
    { label: "Markdown", value: "markdown", icon: <FileText size={14} /> },
    { label: "Web", value: "web", icon: <Globe2 size={14} /> },
    { label: "PDF", value: "pdf", icon: <FileType2 size={14} /> },
] satisfies Array<{ label: string; value: ExportFormat; icon: ReactElement }>

const scopeOptions = [
    {
        label: "Current page",
        value: "page",
        description: "Export only the topics and views under the selected page.",
    },
    {
        label: "Entire notebook",
        value: "notebook",
        description: "Export all pages, topics, and views in the notebook.",
    },
]

const assetModeOptions = [
    {
        label: "Exclude assets",
        value: "ignore",
        description: "Drop image and media blocks while keeping all text and structure.",
    },
    {
        label: "Include as files",
        value: "include",
        description: "Export referenced assets as files in an `assets` folder and update links.",
    },
    {
        label: "Encode as base64",
        value: "base64",
        description: "Embed supported assets directly in exported content as base64 strings.",
    },
]

const webModeOptions = [
    { label: "Static", value: "static", description: "Generate a standalone HTML output." },
    { label: "Server", value: "server", description: "Generate a runnable static server package." },
] as const

const downloadBlob = (result: ExportFileResult) => {
    const url = URL.createObjectURL(result.blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = result.fileName
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
}

export function ExportWizard({ open, selection, workspace, onOpenChange }: ExportWizardProps) {
    const [format, setFormat] = useState<ExportFormat>("markdown")
    const [scope, setScope] = useState<ExportScope>("page")
    const [assetMode, setAssetMode] = useState<ExportAssetMode>("include")
    const [webMode, setWebMode] = useState<WebExportMode>("static")
    const [pdfPageSize, setPdfPageSize] = useState<PdfPageSize>("letter")
    const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>("portrait")
    const [pdfMargin, setPdfMargin] = useState<PdfMargin>("normal")
    const [pdfPageBreaks, setPdfPageBreaks] = useState<PdfPageBreaks>("page")
    const [isWorking, setIsWorking] = useState(false)
    const [status, setStatus] = useState("")
    const [warnings, setWarnings] = useState<string[]>([])
    const exportDocument = useMemo(() => createExportDocument({ scope, selection, workspace }), [scope, selection, workspace])
    const resolvedWebMode = useMemo(() => (scope === "page" ? "static" : webMode), [scope, webMode])
    const fileLabel = useMemo(() => {
        if (format === "markdown") return assetMode === "include" ? "ZIP with Markdown and assets" : "Markdown file"
        if (format === "web") return assetMode === "include" || resolvedWebMode === "server" ? "Web ZIP package" : "HTML file"
        if (assetMode === "include") return "ZIP with PDF and assets"

        return "PDF file"
    }, [assetMode, format, resolvedWebMode])
    const handleScopeChange = useCallback((value: string) => setScope(value === "notebook" ? "notebook" : "page"), [])
    const handleAssetModeChange = useCallback((value: string) => {
        if (value === "ignore" || value === "include" || value === "base64") setAssetMode(value)
    }, [])
    const handleWebModeChange = useCallback(
        (value: string) => {
            if (scope === "page") return
            if (value === "static" || value === "server") setWebMode(value)
        },
        [scope],
    )
    const handlePdfPageSize = useCallback((value: string) => setPdfPageSize(value === "a4" ? "a4" : "letter"), [])
    const handlePdfOrientation = useCallback((value: string) => setPdfOrientation(value === "landscape" ? "landscape" : "portrait"), [])
    const handlePdfMargin = useCallback((value: string) => {
        if (value === "narrow" || value === "wide" || value === "normal") setPdfMargin(value)
    }, [])
    const handlePdfPageBreaks = useCallback((value: string) => {
        if (value === "none" || value === "page" || value === "topic") setPdfPageBreaks(value)
    }, [])
    const copyMarkdown = useCallback(async () => {
        if (!exportDocument) return

        setStatus("")
        setWarnings([])
        setIsWorking(true)
        try {
            const assetResolution = await resolveExportAssets(exportDocument, assetMode)
            const markdown = renderMarkdownExport(exportDocument, { assetMode, assetResolution })
            await navigator.clipboard.writeText(markdown)
            setWarnings(assetResolution.warnings)
            setStatus("Markdown copied.")
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Unable to copy Markdown.")
        } finally {
            setIsWorking(false)
        }
    }, [assetMode, exportDocument])
    const exportFile = useCallback(async () => {
        if (!exportDocument) return

        setStatus("")
        setWarnings([])
        setIsWorking(true)
        try {
            let result: ExportFileResult

            if (format === "markdown") result = await createMarkdownExportFile(exportDocument, { assetMode })
            else if (format === "web") result = await createWebExportFile(exportDocument, { assetMode, mode: resolvedWebMode })
            else
                result = await createPdfExportFile(exportDocument, {
                    assetMode,
                    margin: pdfMargin,
                    orientation: pdfOrientation,
                    pageBreaks: pdfPageBreaks,
                    pageSize: pdfPageSize,
                })
            downloadBlob(result)
            setWarnings(result.warnings)
            setStatus(`${result.fileName} downloaded.`)
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Unable to export file.")
        } finally {
            setIsWorking(false)
        }
    }, [assetMode, exportDocument, format, pdfMargin, pdfOrientation, pdfPageBreaks, pdfPageSize, resolvedWebMode])

    return (
        <ModalDialog open={open} title="Export" description="Export the selected page or the full notebook." size="wide" align="start" onOpenChange={onOpenChange}>
            <Stack gap="lg">
                <SegmentedControl label="Export format" options={formatOptions} value={format} onValueChange={setFormat} />
                <div className={styles.controlGridFullWidth}>
                    <RadioField label="Scope" name="scope" value={scope} layout="horizontal" options={scopeOptions} onValueChange={handleScopeChange} />
                    <RadioField label="Asset mode" name="assetMode" value={assetMode} layout="horizontal" options={assetModeOptions} onValueChange={handleAssetModeChange} />
                </div>
                {format === "web" ? (
                    <WebExportPanel mode={resolvedWebMode} isStaticOnly={scope === "page"} options={[...webModeOptions]} onModeChange={handleWebModeChange} />
                ) : null}
                {format === "pdf" ? (
                    <PdfExportPanel
                        margin={pdfMargin}
                        orientation={pdfOrientation}
                        pageBreaks={pdfPageBreaks}
                        pageSize={pdfPageSize}
                        onMarginChange={handlePdfMargin}
                        onOrientationChange={handlePdfOrientation}
                        onPageBreaksChange={handlePdfPageBreaks}
                        onPageSizeChange={handlePdfPageSize}
                    />
                ) : null}
                <div className={styles.footer}>
                    <div>
                        <Text as="span" tone="strong">
                            {fileLabel}
                        </Text>
                        {exportDocument ? <Text size="small">{exportDocument.pages.length} page export ready</Text> : <Text size="small">No exportable notebook selection</Text>}
                    </div>
                    <div className={styles.actions}>
                        {format === "markdown" ? (
                            <Button icon={<ClipboardCopy size={15} />} variant="secondary" disabled={!exportDocument || isWorking} onClick={copyMarkdown}>
                                Copy
                            </Button>
                        ) : null}
                        <Button icon={<Download size={15} />} variant="primary" disabled={!exportDocument || isWorking} onClick={exportFile}>
                            {isWorking ? "Working" : "Export"}
                        </Button>
                    </div>
                </div>
                <ExportStatus status={status} warnings={warnings} />
            </Stack>
        </ModalDialog>
    )
}
