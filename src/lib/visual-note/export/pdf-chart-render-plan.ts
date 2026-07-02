import { arc as d3Arc, area as d3Area, line as d3Line, max, pie as d3Pie, scaleBand, scaleLinear } from "d3"
import type { PieArcDatum } from "d3"
import { chartColors, chartMargin, chartPieMargin, chartSize, type ChartDataset, type ChartSeries, type VisualChartType } from "@lib/visual-note/chart-data"

type PlotPoint = {
    label: string
    value: number
}

export type PdfChartPlotSeries = ChartSeries & {
    key: string
}

export type PdfChartLegendItem = {
    key: string
    label: string
    color: string
}

export type PdfChartAxisLabel = {
    key: string
    label: string
    x: number
    y: number
}

export type PdfChartTick = {
    key: string
    label: string
    x1: number
    x2: number
    y: number
}

export type PdfChartBarMark = {
    key: string
    color: string
    height: number
    width: number
    x: number
    y: number
}

export type PdfChartPathMark = {
    key: string
    color: string
    path: string
}

export type PdfChartPointMark = {
    key: string
    color: string
    fill: string
    r: number
    x: number
    y: number
}

export type PdfChartPieSlice = {
    key: string
    color: string
    path: string
}

export type PdfChartPieMark = {
    key: string
    empty: boolean
    slices: PdfChartPieSlice[]
    title: string
    x: number
    y: number
}

export type PdfChartRenderPlan = {
    areas: PdfChartPathMark[]
    bars: PdfChartBarMark[]
    height: number
    innerHeight: number
    innerWidth: number
    labels: string[]
    lines: PdfChartPathMark[]
    pieLegendItems: PdfChartLegendItem[]
    pieRadius: number
    pies: PdfChartPieMark[]
    points: PdfChartPointMark[]
    series: PdfChartPlotSeries[]
    seriesLegendItems: PdfChartLegendItem[]
    type: VisualChartType
    width: number
    xAxisLabels: PdfChartAxisLabel[]
    xLabel: string
    yAxisTicks: PdfChartTick[]
    yLabel: string
}

const safeValue = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0)

const plotPointsFor = (labels: string[], series: ChartSeries): PlotPoint[] => labels.map((label, index) => ({ label, value: safeValue(series.values[index]) }))

const colorFor = (index: number) => chartColors[index % chartColors.length]

export const createPdfChartRenderPlan = ({
    chartType,
    dataset,
    xLabel = "",
    yLabel = "",
}: {
    chartType: VisualChartType
    dataset: ChartDataset
    xLabel?: string
    yLabel?: string
}): PdfChartRenderPlan => {
    const labels = dataset.labels.length ? dataset.labels : ["No data"]
    const series = (dataset.series.length ? dataset.series : [{ name: "Value", values: [0] }]).map((item, index) => ({ ...item, key: `${index}-${item.name}` }))
    const points = labels.flatMap((label, labelIndex) => series.map(item => ({ label, name: item.name, value: safeValue(item.values[labelIndex]) })))
    const { width, height } = chartSize
    const innerWidth = width - chartMargin.left - chartMargin.right
    const innerHeight = height - chartMargin.top - chartMargin.bottom
    const pieInnerWidth = width - chartPieMargin.left - chartPieMargin.right
    const pieInnerHeight = height - chartPieMargin.top - chartPieMargin.bottom
    const pieSlotWidth = pieInnerWidth / series.length
    const pieRadius = Math.max(30, Math.min(72, pieSlotWidth * 0.32, pieInnerHeight * 0.36))
    const maxValue = max(points, point => point.value) ?? 0
    const xLabelScale = scaleBand().domain(labels).range([0, innerWidth]).padding(0.28)
    const xSeriesScale = scaleBand()
        .domain(series.map(item => item.key))
        .range([0, xLabelScale.bandwidth()])
        .padding(0.16)
    const y = scaleLinear()
        .domain([0, Math.max(1, maxValue)])
        .nice()
        .range([innerHeight, 0])
    const lineForSeries = (item: ChartSeries) =>
        d3Line<PlotPoint>()
            .x(point => (xLabelScale(point.label) ?? 0) + xLabelScale.bandwidth() / 2)
            .y(point => y(point.value))(plotPointsFor(labels, item)) ?? ""
    const areaForSeries = (item: ChartSeries) =>
        d3Area<PlotPoint>()
            .x(point => (xLabelScale(point.label) ?? 0) + xLabelScale.bandwidth() / 2)
            .y0(innerHeight)
            .y1(point => y(point.value))(plotPointsFor(labels, item)) ?? ""
    const pieArc = d3Arc<PieArcDatum<number>>().innerRadius(0).outerRadius(pieRadius)
    const bars =
        chartType === "bar"
            ? labels.flatMap((label, labelIndex) =>
                  series.map((item, seriesIndex) => {
                      const value = safeValue(item.values[labelIndex])
                      const yPosition = y(value)

                      return {
                          key: `${label}-${item.key}`,
                          color: colorFor(seriesIndex),
                          height: Math.max(0, innerHeight - yPosition),
                          width: xSeriesScale.bandwidth(),
                          x: (xLabelScale(label) ?? 0) + (xSeriesScale(item.key) ?? 0),
                          y: yPosition,
                      }
                  }),
              )
            : []
    const areas = chartType === "area" ? series.map((item, index) => ({ key: `${item.key}-area`, color: colorFor(index), path: areaForSeries(item) })) : []
    const lines = chartType === "line" || chartType === "area" ? series.map((item, index) => ({ key: `${item.key}-line`, color: colorFor(index), path: lineForSeries(item) })) : []
    const pointTypes: VisualChartType[] = ["line", "area", "scatter"]
    const pointMarks = pointTypes.includes(chartType)
        ? series.flatMap((item, seriesIndex) =>
              labels.map((label, labelIndex) => ({
                  key: `${item.key}-${label}`,
                  color: colorFor(seriesIndex),
                  fill: chartType === "scatter" ? colorFor(seriesIndex) : "#ffffff",
                  r: chartType === "scatter" ? 5 : 4,
                  x: (xLabelScale(label) ?? 0) + xLabelScale.bandwidth() / 2,
                  y: y(safeValue(item.values[labelIndex])),
              })),
          )
        : []
    const pies =
        chartType === "pie"
            ? series.map((item, seriesIndex) => {
                  const centerX = pieSlotWidth * seriesIndex + pieSlotWidth / 2
                  const centerY = pieInnerHeight / 2 + 10
                  const slices = d3Pie<number>().sort(null)(labels.map((_, index) => safeValue(item.values[index])))
                  const sliceTotal = slices.reduce((total, slice) => total + slice.value, 0)

                  return {
                      key: item.key,
                      empty: sliceTotal <= 0,
                      slices: sliceTotal > 0 ? slices.map((slice, index) => ({ key: `${item.key}-${labels[index]}`, color: colorFor(index), path: pieArc(slice) ?? "" })) : [],
                      title: item.name,
                      x: centerX,
                      y: centerY,
                  }
              })
            : []

    return {
        areas,
        bars,
        height,
        innerHeight,
        innerWidth,
        labels,
        lines,
        pieLegendItems: chartType === "pie" && labels.length > 1 ? labels.map((label, index) => ({ key: label, label, color: colorFor(index) })) : [],
        pieRadius,
        pies,
        points: pointMarks,
        series,
        seriesLegendItems: chartType !== "pie" && series.length > 1 ? series.map((item, index) => ({ key: item.key, label: item.name, color: colorFor(index) })) : [],
        type: chartType,
        width,
        xAxisLabels: labels.map(label => ({ key: label, label, x: (xLabelScale(label) ?? 0) + xLabelScale.bandwidth() / 2, y: innerHeight + 20 })),
        xLabel,
        yAxisTicks: y.ticks(4).map(tick => ({ key: String(tick), label: String(tick), x1: 0, x2: innerWidth, y: y(tick) })),
        yLabel,
    }
}
