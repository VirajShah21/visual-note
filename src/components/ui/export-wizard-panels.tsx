"use client"

import { useCallback } from "react"
import type { PdfMargin, PdfOrientation, PdfPageBreaks, PdfPageSize, WebExportMode } from "@/lib/visual-note/export"
import { RadioField, SelectField } from "./form-controls"
import { Text } from "./primitives"
import styles from "./export-wizard.module.css"

type WebExportOption = {
    label: string
    value: WebExportMode
    description: string
}

type WebExportPanelProps = {
    mode: WebExportMode
    isStaticOnly: boolean
    options: WebExportOption[]
    onModeChange: (mode: WebExportMode) => void
}

type PdfExportPanelProps = {
    margin: PdfMargin
    orientation: PdfOrientation
    pageBreaks: PdfPageBreaks
    pageSize: PdfPageSize
    onMarginChange: (value: string) => void
    onOrientationChange: (value: string) => void
    onPageBreaksChange: (value: string) => void
    onPageSizeChange: (value: string) => void
}

const pageSizeOptions = [
    { label: "Letter", value: "letter" },
    { label: "A4", value: "a4" },
]

const orientationOptions = [
    { label: "Portrait", value: "portrait" },
    { label: "Landscape", value: "landscape" },
]

const marginOptions = [
    { label: "Narrow", value: "narrow" },
    { label: "Normal", value: "normal" },
    { label: "Wide", value: "wide" },
]

const pageBreakOptions = [
    { label: "No forced breaks", value: "none" },
    { label: "Break by page", value: "page" },
    { label: "Break by topic", value: "topic" },
]

export function WebExportPanel({ mode, onModeChange, isStaticOnly, options }: WebExportPanelProps) {
    const handleModeChange = useCallback((value: string) => onModeChange(value as WebExportMode), [onModeChange])
    const normalizedOptions = isStaticOnly ? options.map(option => ({ ...option, disabled: option.value === "server" })) : options

    return <RadioField label="Web mode" name="webMode" value={mode} options={normalizedOptions} onValueChange={handleModeChange} />
}

export function PdfExportPanel({ margin, orientation, pageBreaks, pageSize, onMarginChange, onOrientationChange, onPageBreaksChange, onPageSizeChange }: PdfExportPanelProps) {
    return (
        <div className={styles.panel}>
            <Text as="span" tone="strong">
                PDF layout
            </Text>
            <div className={styles.controlGrid}>
                <SelectField label="Page size" value={pageSize} options={pageSizeOptions} onValueChange={onPageSizeChange} />
                <SelectField label="Orientation" value={orientation} options={orientationOptions} onValueChange={onOrientationChange} />
                <SelectField label="Margins" value={margin} options={marginOptions} onValueChange={onMarginChange} />
                <SelectField label="Page breaks" value={pageBreaks} options={pageBreakOptions} onValueChange={onPageBreaksChange} />
            </div>
        </div>
    )
}

export function ExportStatus({ status, warnings }: { status: string; warnings: string[] }) {
    if (!status && warnings.length === 0) return null

    return (
        <div className={styles.status}>
            {status ? <Text tone="strong">{status}</Text> : null}
            {warnings.map(warning => (
                <Text key={warning} size="small">
                    {warning}
                </Text>
            ))}
        </div>
    )
}
