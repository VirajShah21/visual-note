"use client"

import { arc as d3Arc, area as d3Area, line as d3Line, max, pie as d3Pie, scaleBand, scaleLinear } from "d3"
import type { PieArcDatum } from "d3"
import type { ReactNode } from "react"
import { Stack, Text } from "./primitives"
import styles from "./simple-chart.module.css"

export type SimpleChartType = "bar" | "line" | "area" | "scatter" | "pie"

export type SimpleChartSeries = {
    name: string
    values: number[]
}

export type SimpleChartDataset = {
    labels: string[]
    series: SimpleChartSeries[]
}

type SimpleChartPoint = {
    label: string
    value: number
}

type SimpleChartProps = {
    title?: ReactNode
    type?: SimpleChartType
    dataset: SimpleChartDataset
    xLabel?: string
    yLabel?: string
}

const width = 680
const height = 280
const margin = { top: 18, right: 22, bottom: 48, left: 48 }
const pieMargin = { top: 24, right: 22, bottom: 28, left: 22 }
const chartColors = ["#2f7d5c", "#315f8c", "#9b5c36", "#7b5aa6", "#b14759", "#4d7680"]

export function SimpleChart({ title, type = "bar", dataset, xLabel, yLabel }: SimpleChartProps) {
    const labels = dataset.labels.length ? dataset.labels : ["No data"]
    const series = dataset.series.length ? dataset.series : [{ name: "Value", values: [0] }]
    const plottedSeries = series.map((item, index) => ({ ...item, key: `${index}-${item.name}` }))
    const points = labels.flatMap((label, labelIndex) => plottedSeries.map(item => ({ label, name: item.name, value: item.values[labelIndex] ?? 0 })))
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const pieInnerWidth = width - pieMargin.left - pieMargin.right
    const pieInnerHeight = height - pieMargin.top - pieMargin.bottom
    const pieSlotWidth = pieInnerWidth / plottedSeries.length
    const pieRadius = Math.max(30, Math.min(72, pieSlotWidth * 0.32, pieInnerHeight * 0.36))
    const maxValue = max(points, point => point.value) ?? 0
    const xLabelScale = scaleBand().domain(labels).range([0, innerWidth]).padding(0.28)
    const xSeriesScale = scaleBand()
        .domain(plottedSeries.map(item => item.key))
        .range([0, xLabelScale.bandwidth()])
        .padding(0.16)
    const y = scaleLinear()
        .domain([0, Math.max(1, maxValue)])
        .nice()
        .range([innerHeight, 0])
    const yTicks = y.ticks(4)
    const lineForSeries = (item: SimpleChartSeries) => {
        const linePoints: SimpleChartPoint[] = labels.map((label, index) => ({ label, value: item.values[index] ?? 0 }))

        return (
            d3Line<SimpleChartPoint>()
                .x(point => (xLabelScale(point.label) ?? 0) + xLabelScale.bandwidth() / 2)
                .y(point => y(point.value))(linePoints) ?? ""
        )
    }
    const areaForSeries = (item: SimpleChartSeries) => {
        const areaPoints: SimpleChartPoint[] = labels.map((label, index) => ({ label, value: item.values[index] ?? 0 }))

        return (
            d3Area<SimpleChartPoint>()
                .x(point => (xLabelScale(point.label) ?? 0) + xLabelScale.bandwidth() / 2)
                .y0(innerHeight)
                .y1(point => y(point.value))(areaPoints) ?? ""
        )
    }
    const pieArc = d3Arc<PieArcDatum<number>>().innerRadius(0).outerRadius(pieRadius)
    const pieSlicesForSeries = (item: SimpleChartSeries) => d3Pie<number>().sort(null)(labels.map((_, index) => Math.max(0, item.values[index] ?? 0)))
    const pieLegendLabels = labels.map((label, index) => ({ label, color: chartColors[index % chartColors.length] }))
    const showsSeriesLegend = type !== "pie" && plottedSeries.length > 1
    const showsPieLegend = type === "pie" && labels.length > 1

    return (
        <Stack className={styles.chart} gap="sm">
            {title ? <Text tone="strong">{title}</Text> : null}
            <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={typeof title === "string" ? title : "Chart"}>
                {type === "pie" ? (
                    <g transform={`translate(${pieMargin.left},${pieMargin.top})`}>
                        {plottedSeries.map((item, seriesIndex) => {
                            const centerX = pieSlotWidth * seriesIndex + pieSlotWidth / 2
                            const centerY = pieInnerHeight / 2 + 10
                            const slices = pieSlicesForSeries(item)
                            const sliceTotal = slices.reduce((total, slice) => total + slice.value, 0)

                            return (
                                <g key={item.key} transform={`translate(${centerX},${centerY})`}>
                                    <text className={styles.pieTitle} x={0} y={-pieRadius - 20} textAnchor="middle">
                                        {item.name}
                                    </text>
                                    {sliceTotal > 0 ? (
                                        slices.map((slice, labelIndex) => (
                                            <path
                                                key={`${item.key}-${labels[labelIndex]}`}
                                                className={styles.pieSlice}
                                                d={pieArc(slice) ?? ""}
                                                fill={chartColors[labelIndex % chartColors.length]}
                                            />
                                        ))
                                    ) : (
                                        <circle className={styles.emptyPie} r={pieRadius} />
                                    )}
                                </g>
                            )
                        })}
                    </g>
                ) : (
                    <g transform={`translate(${margin.left},${margin.top})`}>
                        {yTicks.map(tick => (
                            <g key={tick} className={styles.axis} transform={`translate(0,${y(tick)})`}>
                                <line className={styles.gridLine} x1={0} x2={innerWidth} />
                                <text x={-10} y={4} textAnchor="end">
                                    {tick}
                                </text>
                            </g>
                        ))}
                        {type === "line" || type === "area" || type === "scatter" ? (
                            <>
                                {type === "area"
                                    ? plottedSeries.map((item, seriesIndex) => (
                                          <path key={`${item.key}-area`} className={styles.area} d={areaForSeries(item)} fill={chartColors[seriesIndex % chartColors.length]} />
                                      ))
                                    : null}
                                {type === "line" || type === "area"
                                    ? plottedSeries.map((item, seriesIndex) => (
                                          <path key={`${item.key}-line`} className={styles.line} d={lineForSeries(item)} stroke={chartColors[seriesIndex % chartColors.length]} />
                                      ))
                                    : null}
                                {plottedSeries.map((item, seriesIndex) =>
                                    labels.map((label, labelIndex) => (
                                        <circle
                                            key={`${item.key}-${label}`}
                                            className={styles.point}
                                            cx={(xLabelScale(label) ?? 0) + xLabelScale.bandwidth() / 2}
                                            cy={y(item.values[labelIndex] ?? 0)}
                                            r={type === "scatter" ? 5 : 4}
                                            fill={type === "scatter" ? chartColors[seriesIndex % chartColors.length] : undefined}
                                            stroke={chartColors[seriesIndex % chartColors.length]}
                                        />
                                    )),
                                )}
                            </>
                        ) : (
                            labels.flatMap((label, labelIndex) =>
                                plottedSeries.map((item, seriesIndex) => {
                                    const value = item.values[labelIndex] ?? 0

                                    return (
                                        <rect
                                            key={`${label}-${item.key}`}
                                            className={styles.bar}
                                            x={(xLabelScale(label) ?? 0) + (xSeriesScale(item.key) ?? 0)}
                                            y={y(value)}
                                            width={xSeriesScale.bandwidth()}
                                            height={innerHeight - y(value)}
                                            rx={4}
                                            fill={chartColors[seriesIndex % chartColors.length]}
                                        />
                                    )
                                }),
                            )
                        )}
                        {labels.map(label => (
                            <text
                                key={`${label}-label`}
                                className={styles.axis}
                                x={(xLabelScale(label) ?? 0) + xLabelScale.bandwidth() / 2}
                                y={innerHeight + 20}
                                textAnchor="middle"
                            >
                                {label}
                            </text>
                        ))}
                        {xLabel ? (
                            <text className={styles.axis} x={innerWidth / 2} y={innerHeight + 42} textAnchor="middle">
                                {xLabel}
                            </text>
                        ) : null}
                        {yLabel ? (
                            <text className={styles.axis} transform="rotate(-90)" x={-innerHeight / 2} y={-36} textAnchor="middle">
                                {yLabel}
                            </text>
                        ) : null}
                    </g>
                )}
            </svg>
            {showsSeriesLegend ? (
                <span className={styles.legend}>
                    {plottedSeries.map((item, index) => (
                        <span key={item.key} className={styles.legendItem}>
                            <span className={styles.legendSwatch} style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                            {item.name}
                        </span>
                    ))}
                </span>
            ) : null}
            {showsPieLegend ? (
                <span className={styles.legend}>
                    {pieLegendLabels.map(item => (
                        <span key={item.label} className={styles.legendItem}>
                            <span className={styles.legendSwatch} style={{ backgroundColor: item.color }} />
                            {item.label}
                        </span>
                    ))}
                </span>
            ) : null}
        </Stack>
    )
}
