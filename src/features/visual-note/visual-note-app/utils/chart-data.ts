import {
    chartDataLayoutFrom,
    chartDatasetFromSheet,
    chartTypeFrom,
    compactChartSheetFromData,
    withMinimumChartSheetSize,
    type ChartDataLayout,
    type ChartDataset,
    type VisualChartType,
} from "@/lib/visual-note/chart-data"

export type { ChartDataLayout, ChartDataset, VisualChartType }
export { chartDataLayoutFrom, chartDatasetFromSheet, chartTypeFrom }

export const chartSheetFromData = (data: Record<string, unknown>) => withMinimumChartSheetSize(compactChartSheetFromData(data))
