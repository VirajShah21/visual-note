import type { PdfChartDataset, PdfChartType } from "./types"

const stringFrom = (value: unknown, fallback = "") => {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)

    return fallback
}

const numberFrom = (value: unknown, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }

    return fallback
}

const objectArrayFrom = (value: unknown) => {
    if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))

    return []
}

const chartCellFrom = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    if (typeof value === "string") return value
    if (typeof value === "boolean") return String(value)

    return ""
}

const chartSheetFromRows = (value: unknown) => {
    if (!Array.isArray(value)) return []

    return value.filter((row): row is unknown[] => Array.isArray(row)).map(row => row.map(chartCellFrom))
}

const legacyChartSheetFromData = (value: unknown) => {
    const legacyRows = objectArrayFrom(value)
    if (legacyRows.length === 0) return []

    return [["", "Value"], ...legacyRows.map((item, index) => [stringFrom(item.label, `Item ${index + 1}`), String(numberFrom(item.value, 0))])]
}

const chartSheetFromData = (data: Record<string, unknown>) => {
    const sheet = chartSheetFromRows(data.dataSheet)
    if (sheet.length > 0) return sheet

    const alternateSheet = chartSheetFromRows(data.sheet)
    if (alternateSheet.length > 0) return alternateSheet

    const legacySheet = legacyChartSheetFromData(data.data)
    if (legacySheet.length > 0) return legacySheet

    return [
        ["", "Value", "Target"],
        ["Mon", "4", "6"],
        ["Tue", "7", "8"],
        ["Wed", "5", "6"],
    ]
}

const hasChartCellValue = (value: string | undefined) => Boolean(value?.trim())

const chartDatasetFromColumns = (sheet: string[][]): PdfChartDataset => {
    const dataRows = sheet.slice(1).filter((row, index) => index === 0 || hasChartCellValue(row[0]) || row.slice(1).some(hasChartCellValue))
    const labels = dataRows.map((row, index) => stringFrom(row[0], `Item ${index + 1}`))
    const columnIndexes = (sheet[0] ?? [])
        .map((_, index) => index)
        .slice(1)
        .filter(index => index === 1 || hasChartCellValue(sheet[0]?.[index]) || dataRows.some(row => hasChartCellValue(row[index])))
    const series = columnIndexes.map((columnIndex, index) => ({
        name: stringFrom(sheet[0]?.[columnIndex], `Series ${index + 1}`),
        values: dataRows.map(row => numberFrom(row[columnIndex], 0)),
    }))

    return { labels, series }
}

const chartDatasetFromRows = (sheet: string[][]): PdfChartDataset => {
    const seriesRows = sheet.slice(1).filter((row, index) => index === 0 || hasChartCellValue(row[0]) || row.slice(1).some(hasChartCellValue))
    const labelIndexes = (sheet[0] ?? [])
        .map((_, index) => index)
        .slice(1)
        .filter(index => index === 1 || hasChartCellValue(sheet[0]?.[index]) || seriesRows.some(row => hasChartCellValue(row[index])))
    const labels = labelIndexes.map((columnIndex, index) => stringFrom(sheet[0]?.[columnIndex], `Item ${index + 1}`))
    const series = seriesRows.map((row, index) => ({
        name: stringFrom(row[0], `Series ${index + 1}`),
        values: labelIndexes.map(columnIndex => numberFrom(row[columnIndex], 0)),
    }))

    return { labels, series }
}

export const pdfChartTypeFrom = (value: unknown): PdfChartType => {
    if (value === "line" || value === "area" || value === "scatter" || value === "pie") return value

    return "bar"
}

export const pdfChartDatasetFromData = (data: Record<string, unknown>) => {
    const sheet = chartSheetFromData(data)

    return data.dataLayout === "rows" ? chartDatasetFromRows(sheet) : chartDatasetFromColumns(sheet)
}
