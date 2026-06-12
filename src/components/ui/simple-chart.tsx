"use client"

import { line as d3Line, max, scaleBand, scaleLinear } from "d3"
import type { ReactNode } from "react"
import { Stack, Text } from "./primitives"
import styles from "./simple-chart.module.css"

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
    type?: "bar" | "line"
    dataset: SimpleChartDataset
    xLabel?: string
    yLabel?: string
}

const width = 680
const height = 280
const margin = { top: 18, right: 22, bottom: 48, left: 48 }
const chartColors = ["#2f7d5c", "#315f8c", "#9b5c36", "#7b5aa6", "#b14759", "#4d7680"]

export function SimpleChart({ title, type = "bar", dataset, xLabel, yLabel }: SimpleChartProps) {
    const labels = dataset.labels.length ? dataset.labels : ["No data"]
    const series = dataset.series.length ? dataset.series : [{ name: "Value", values: [0] }]
    const plottedSeries = series.map((item, index) => ({ ...item, key: `${index}-${item.name}` }))
    const points = labels.flatMap((label, labelIndex) => plottedSeries.map(item => ({ label, name: item.name, value: item.values[labelIndex] ?? 0 })))
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
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

    return (
        <Stack className={styles.chart} gap="sm">
            {title ? <Text tone="strong">{title}</Text> : null}
            <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={typeof title === "string" ? title : "Chart"}>
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {yTicks.map(tick => (
                        <g key={tick} className={styles.axis} transform={`translate(0,${y(tick)})`}>
                            <line className={styles.gridLine} x1={0} x2={innerWidth} />
                            <text x={-10} y={4} textAnchor="end">
                                {tick}
                            </text>
                        </g>
                    ))}
                    {type === "line" ? (
                        <>
                            {plottedSeries.map((item, seriesIndex) => (
                                <g key={item.key}>
                                    <path className={styles.line} d={lineForSeries(item)} stroke={chartColors[seriesIndex % chartColors.length]} />
                                    {labels.map((label, labelIndex) => (
                                        <circle
                                            key={`${item.key}-${label}`}
                                            className={styles.point}
                                            cx={(xLabelScale(label) ?? 0) + xLabelScale.bandwidth() / 2}
                                            cy={y(item.values[labelIndex] ?? 0)}
                                            r={4}
                                            stroke={chartColors[seriesIndex % chartColors.length]}
                                        />
                                    ))}
                                </g>
                            ))}
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
                        <text key={`${label}-label`} className={styles.axis} x={(xLabelScale(label) ?? 0) + xLabelScale.bandwidth() / 2} y={innerHeight + 20} textAnchor="middle">
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
            </svg>
            {plottedSeries.length > 1 ? (
                <span className={styles.legend}>
                    {plottedSeries.map((item, index) => (
                        <span key={item.key} className={styles.legendItem}>
                            <span className={styles.legendSwatch} style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                            {item.name}
                        </span>
                    ))}
                </span>
            ) : null}
        </Stack>
    )
}
