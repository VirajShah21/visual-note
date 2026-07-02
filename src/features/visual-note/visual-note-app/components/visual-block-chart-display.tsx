"use client"

import { useCallback } from "react"
import { ChartDataSheet, DataSelectField, DataTextField, EditableVisualBlock, Grid, Heading, SimpleChart, Stack } from "@/components/ui"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import { chartDataLayoutFrom, chartDatasetFromSheet, chartSheetFromData, chartTypeFrom } from "@features/visual-note/visual-note-app/utils/chart-data"
import { stringFrom } from "@features/visual-note/visual-note-app/utils/visual-note-app.utils"
import styles from "../../visual-note-app.module.css"

type VisualBlockChartDisplayProps = {
    data: VisualBlockData
    isReadOnly: boolean
    onDataChange: (data: VisualBlockData) => void
}

export function VisualBlockChartDisplay({ data, isReadOnly, onDataChange }: VisualBlockChartDisplayProps) {
    const chartLayout = chartDataLayoutFrom(data.dataLayout)
    const chartSheet = chartSheetFromData(data)
    const chartDataset = chartDatasetFromSheet(chartSheet, chartLayout)
    const chartType = chartTypeFrom(data.type)
    const updateField = useCallback((field: string, value: unknown) => onDataChange({ ...data, [field]: value }), [data, onDataChange])
    const chartDataWithoutLegacyFields = useCallback(() => {
        const nextData = { ...data }
        delete nextData.data
        delete nextData.sheet

        return nextData
    }, [data])
    const updateChartSheet = useCallback(
        (sheet: string[][]) => onDataChange({ ...chartDataWithoutLegacyFields(), dataLayout: chartLayout, dataSheet: sheet }),
        [chartDataWithoutLegacyFields, chartLayout, onDataChange],
    )
    const updateChartLayout = useCallback(
        (dataLayout: string) => onDataChange({ ...chartDataWithoutLegacyFields(), dataLayout: chartDataLayoutFrom(dataLayout), dataSheet: chartSheet }),
        [chartDataWithoutLegacyFields, chartSheet, onDataChange],
    )
    const updateChartLayoutField = useCallback((_: string, value: unknown) => updateChartLayout(String(value)), [updateChartLayout])

    return (
        <EditableVisualBlock
            readOnly={isReadOnly}
            preview={
                <>
                    <SimpleChart
                        title={stringFrom(data.title, "Chart")}
                        type={chartType}
                        dataset={chartDataset}
                        xLabel={stringFrom(data.xLabel)}
                        yLabel={stringFrom(data.yLabel)}
                    />
                </>
            }
        >
            <Stack className={styles.chartMetadataRow} direction="horizontal" gap="sm">
                <DataSelectField
                    className={styles.chartTypeSelect}
                    label="Type"
                    field="type"
                    value={chartType}
                    options={[
                        { label: "Bar", value: "bar" },
                        { label: "Line", value: "line" },
                        { label: "Area", value: "area" },
                        { label: "Scatter", value: "scatter" },
                        { label: "Pie", value: "pie" },
                    ]}
                    onUpdateField={updateField}
                />
                <DataTextField label="Title" field="title" value={stringFrom(data.title)} onUpdateField={updateField} />
            </Stack>
            <Grid columns="three" gap="sm">
                <DataSelectField
                    label="Axes"
                    field="dataLayout"
                    value={chartLayout}
                    options={[
                        { label: "X↓ Y→", value: "columns" },
                        { label: "X→ Y↓", value: "rows" },
                    ]}
                    onUpdateField={updateChartLayoutField}
                />
                <DataTextField label="X label" field="xLabel" value={stringFrom(data.xLabel)} onUpdateField={updateField} />
                <DataTextField label="Y label" field="yLabel" value={stringFrom(data.yLabel)} onUpdateField={updateField} />
            </Grid>
            <Stack gap="sm">
                <Heading size="sm">Data</Heading>
                <ChartDataSheet sheet={chartSheet} onSheetChange={updateChartSheet} />
            </Stack>
        </EditableVisualBlock>
    )
}
