"use client"

import { line as d3Line, max, scaleBand, scaleLinear } from "d3"
import type { ReactNode } from "react"
import { Stack, Text } from "./primitives"
import styles from "./simple-chart.module.css"

export type SimpleChartRow = {
    label: string
    value: number
}

type SimpleChartProps = {
    title?: ReactNode
    type?: "bar" | "line"
    rows: SimpleChartRow[]
    xLabel?: string
    yLabel?: string
}

const width = 680
const height = 280
const margin = { top: 18, right: 22, bottom: 48, left: 48 }

export function SimpleChart({ title, type = "bar", rows, xLabel, yLabel }: SimpleChartProps) {
    const data = rows.length ? rows : [{ label: "No data", value: 0 }]
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const maxValue = max(data, row => row.value) ?? 0
    const x = scaleBand()
        .domain(data.map(row => row.label))
        .range([0, innerWidth])
        .padding(0.28)
    const y = scaleLinear()
        .domain([0, Math.max(1, maxValue)])
        .nice()
        .range([innerHeight, 0])
    const linePath =
        d3Line<SimpleChartRow>()
            .x(row => (x(row.label) ?? 0) + x.bandwidth() / 2)
            .y(row => y(row.value))(data) ?? ""
    const yTicks = y.ticks(4)

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
                            <path className={styles.line} d={linePath} />
                            {data.map(row => (
                                <circle key={row.label} className={styles.point} cx={(x(row.label) ?? 0) + x.bandwidth() / 2} cy={y(row.value)} r={4} />
                            ))}
                        </>
                    ) : (
                        data.map(row => (
                            <rect key={row.label} className={styles.bar} x={x(row.label) ?? 0} y={y(row.value)} width={x.bandwidth()} height={innerHeight - y(row.value)} rx={5} />
                        ))
                    )}
                    {data.map(row => (
                        <text key={`${row.label}-label`} className={styles.axis} x={(x(row.label) ?? 0) + x.bandwidth() / 2} y={innerHeight + 20} textAnchor="middle">
                            {row.label}
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
        </Stack>
    )
}
