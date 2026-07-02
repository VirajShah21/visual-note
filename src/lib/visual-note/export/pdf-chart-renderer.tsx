import { Circle, G, Line, Path, Rect, Svg, StyleSheet, Text, View } from "@react-pdf/renderer"
import { chartMargin, chartPieMargin } from "@lib/visual-note/chart-data"
import { createPdfChartRenderPlan, type PdfChartLegendItem, type PdfChartPieMark, type PdfChartRenderPlan } from "./pdf-chart-render-plan"
import type { PdfRenderBlock } from "./types"

const styles = StyleSheet.create({
    card: {
        borderColor: "#d7e0e7",
        borderRadius: 6,
        borderWidth: 1,
        marginBottom: 12,
        padding: 10,
    },
    kicker: {
        color: "#2f7d5c",
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: 0.8,
        marginBottom: 5,
        textTransform: "uppercase",
    },
    legend: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 6,
    },
    legendItem: {
        alignItems: "center",
        display: "flex",
        flexDirection: "row",
        gap: 4,
    },
    legendLabel: {
        color: "#586879",
        fontSize: 8,
    },
    legendSwatch: {
        borderRadius: 999,
        height: 7,
        width: 7,
    },
    subtitle: {
        color: "#344657",
        marginBottom: 8,
    },
    svg: {
        marginTop: 2,
    },
    title: {
        color: "#101820",
        fontSize: 14,
        fontWeight: 700,
        marginBottom: 4,
    },
})

function ChartLegend({ items }: { items: PdfChartLegendItem[] }) {
    if (!items.length) return null

    return (
        <View style={styles.legend}>
            {items.map(item => (
                <View key={item.key} style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
                    <Text style={styles.legendLabel}>{item.label}</Text>
                </View>
            ))}
        </View>
    )
}

function CartesianChartSvg({ plan }: { plan: PdfChartRenderPlan }) {
    return (
        <G transform={`translate(${chartMargin.left},${chartMargin.top})`}>
            {plan.yAxisTicks.map(tick => (
                <G key={tick.key} transform={`translate(0,${tick.y})`}>
                    <Line x1={tick.x1} x2={tick.x2} y1={0} y2={0} stroke="#d7e0e7" strokeWidth={0.75} />
                    <Text x={-10} y={4} fill="#586879" textAnchor="end">
                        {tick.label}
                    </Text>
                </G>
            ))}
            {plan.areas.map(mark => (
                <Path key={mark.key} d={mark.path} fill={mark.color} opacity={0.16} />
            ))}
            {plan.lines.map(mark => (
                <Path key={mark.key} d={mark.path} fill="none" stroke={mark.color} strokeWidth={2.5} />
            ))}
            {plan.bars.map(mark => (
                <Rect key={mark.key} x={mark.x} y={mark.y} width={mark.width} height={mark.height} rx={4} fill={mark.color} />
            ))}
            {plan.points.map(mark => (
                <Circle key={mark.key} cx={mark.x} cy={mark.y} r={mark.r} fill={mark.fill} stroke={mark.color} strokeWidth={2} />
            ))}
            {plan.xAxisLabels.map(label => (
                <Text key={label.key} x={label.x} y={label.y} fill="#586879" textAnchor="middle">
                    {label.label}
                </Text>
            ))}
            {plan.xLabel ? (
                <Text x={plan.innerWidth / 2} y={plan.innerHeight + 42} fill="#586879" textAnchor="middle">
                    {plan.xLabel}
                </Text>
            ) : null}
            {plan.yLabel ? (
                <Text x={-plan.innerHeight / 2} y={-36} fill="#586879" textAnchor="middle" transform="rotate(-90)">
                    {plan.yLabel}
                </Text>
            ) : null}
        </G>
    )
}

function PieMark({ pie, radius }: { pie: PdfChartPieMark; radius: number }) {
    return (
        <G transform={`translate(${pie.x},${pie.y})`}>
            <Text x={0} y={-radius - 20} fill="#101820" textAnchor="middle">
                {pie.title}
            </Text>
            {pie.empty ? (
                <Circle r={radius} fill="#f5f7f8" stroke="#d7e0e7" strokeWidth={1.5} />
            ) : (
                pie.slices.map(slice => <Path key={slice.key} d={slice.path} fill={slice.color} stroke="#ffffff" strokeWidth={2} />)
            )}
        </G>
    )
}

function PieChartSvg({ plan }: { plan: PdfChartRenderPlan }) {
    return (
        <G transform={`translate(${chartPieMargin.left},${chartPieMargin.top})`}>
            {plan.pies.map(pie => (
                <PieMark key={pie.key} pie={pie} radius={plan.pieRadius} />
            ))}
        </G>
    )
}

export function PdfChartBlock({ block }: { block: Extract<PdfRenderBlock, { kind: "chart" }> }) {
    const plan = createPdfChartRenderPlan({
        chartType: block.chartType,
        dataset: block.dataset,
        xLabel: block.xLabel,
        yLabel: block.yLabel,
    })
    const legendItems = plan.type === "pie" ? plan.pieLegendItems : plan.seriesLegendItems

    return (
        <View break={block.breakBefore} wrap={false} style={styles.card}>
            <Text style={styles.kicker}>{`${block.chartType} chart`}</Text>
            <Text style={styles.title}>{block.title}</Text>
            {block.xLabel || block.yLabel ? <Text style={styles.subtitle}>{[block.xLabel, block.yLabel].filter(Boolean).join(" / ")}</Text> : null}
            <Svg width="100%" height={plan.height} viewBox={`0 0 ${plan.width} ${plan.height}`} style={styles.svg}>
                {plan.type === "pie" ? <PieChartSvg plan={plan} /> : <CartesianChartSvg plan={plan} />}
            </Svg>
            <ChartLegend items={legendItems} />
        </View>
    )
}
