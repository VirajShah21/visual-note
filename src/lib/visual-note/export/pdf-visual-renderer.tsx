import { StyleSheet, Text, View } from "@react-pdf/renderer"
import type { PdfChartDataset, PdfPollOption, PdfRenderBlock } from "./types"

type PdfVisualRenderBlock = Extract<PdfRenderBlock, { kind: "visual-card" | "chart" | "poll" }>

const chartColors = ["#2f7d5c", "#315f8c", "#9b5c36", "#7b5aa6", "#b14759", "#4d7680"]

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
    title: {
        color: "#101820",
        fontSize: 14,
        fontWeight: 700,
        marginBottom: 4,
    },
    subtitle: {
        color: "#344657",
        marginBottom: 8,
    },
    detailGrid: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 8,
    },
    detail: {
        backgroundColor: "#f5f7f8",
        borderRadius: 4,
        padding: 5,
        width: "48%",
    },
    detailLabel: {
        color: "#586879",
        fontSize: 8,
        marginBottom: 2,
    },
    badgeRow: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        marginBottom: 8,
    },
    badge: {
        backgroundColor: "#edf4f0",
        borderRadius: 999,
        color: "#2f7d5c",
        fontSize: 8,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    section: {
        marginTop: 7,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 700,
        marginBottom: 3,
    },
    line: {
        marginBottom: 2,
    },
    barRow: {
        marginTop: 6,
    },
    barLabel: {
        color: "#344657",
        fontSize: 9,
        marginBottom: 3,
    },
    barTrack: {
        backgroundColor: "#edf1f4",
        borderRadius: 999,
        height: 7,
        marginBottom: 3,
        overflow: "hidden",
    },
    barFill: {
        borderRadius: 999,
        height: 7,
    },
    barValue: {
        color: "#586879",
        fontSize: 8,
    },
})

const percentWidth = (value: number, maxValue: number) => {
    if (value <= 0) return "0%"

    return `${Math.max(4, Math.round((value / maxValue) * 100))}%`
}

const chartMaxValue = (dataset: PdfChartDataset) => Math.max(1, ...dataset.series.flatMap(series => series.values.map(value => Math.max(0, value))))

function Bar({ color, percent }: { color: string; percent: string }) {
    return (
        <View style={styles.barTrack}>
            <View style={[styles.barFill, { backgroundColor: color, width: percent }]} />
        </View>
    )
}

function DetailGrid({ details }: { details: NonNullable<Extract<PdfRenderBlock, { kind: "visual-card" }>["details"]> }) {
    if (!details.length) return null

    return (
        <View style={styles.detailGrid}>
            {details.map(detail => (
                <View key={`${detail.label}-${detail.value}`} style={styles.detail}>
                    <Text style={styles.detailLabel}>{detail.label}</Text>
                    <Text>{detail.value}</Text>
                </View>
            ))}
        </View>
    )
}

function PdfVisualCard({ block }: { block: Extract<PdfRenderBlock, { kind: "visual-card" }> }) {
    return (
        <View break={block.breakBefore} wrap={false} style={styles.card}>
            <Text style={styles.kicker}>{block.label}</Text>
            <Text style={styles.title}>{block.title}</Text>
            {block.subtitle ? <Text style={styles.subtitle}>{block.subtitle}</Text> : null}
            <DetailGrid details={block.details ?? []} />
            {block.badges?.length ? (
                <View style={styles.badgeRow}>
                    {block.badges.map(badge => (
                        <Text key={badge} style={styles.badge}>
                            {badge}
                        </Text>
                    ))}
                </View>
            ) : null}
            {block.sections?.map(section => (
                <View key={section.title} style={styles.section}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    {section.lines.map((line, index) => (
                        <Text key={`${section.title}-${index}-${line}`} style={styles.line}>
                            {line}
                        </Text>
                    ))}
                </View>
            ))}
        </View>
    )
}

function PollBar({ option }: { option: PdfPollOption }) {
    return (
        <View style={styles.barRow}>
            <Text style={styles.barLabel}>{option.label}</Text>
            <Bar color="#2f7d5c" percent={`${option.percent}%`} />
            <Text style={styles.barValue}>{`${option.votes} votes - ${option.percent}%`}</Text>
        </View>
    )
}

function PdfPollBlock({ block }: { block: Extract<PdfRenderBlock, { kind: "poll" }> }) {
    return (
        <View break={block.breakBefore} wrap={false} style={styles.card}>
            <Text style={styles.kicker}>Poll</Text>
            <Text style={styles.title}>{block.question}</Text>
            <Text style={styles.subtitle}>{`${block.totalVotes} total votes`}</Text>
            {block.options.map(option => (
                <PollBar key={option.label} option={option} />
            ))}
        </View>
    )
}

function PdfChartBlock({ block }: { block: Extract<PdfRenderBlock, { kind: "chart" }> }) {
    const maxValue = chartMaxValue(block.dataset)

    return (
        <View break={block.breakBefore} wrap={false} style={styles.card}>
            <Text style={styles.kicker}>{`${block.chartType} chart`}</Text>
            <Text style={styles.title}>{block.title}</Text>
            {block.xLabel || block.yLabel ? <Text style={styles.subtitle}>{[block.xLabel, block.yLabel].filter(Boolean).join(" / ")}</Text> : null}
            {block.dataset.labels.map((label, labelIndex) => (
                <View key={`${label}-${labelIndex}`} style={styles.barRow}>
                    <Text style={styles.barLabel}>{label}</Text>
                    {block.dataset.series.map((series, seriesIndex) => {
                        const value = series.values[labelIndex] ?? 0
                        const color = chartColors[seriesIndex % chartColors.length]

                        return (
                            <View key={`${label}-${series.name}`} style={styles.line}>
                                <Bar color={color} percent={percentWidth(value, maxValue)} />
                                <Text style={styles.barValue}>{`${series.name}: ${value}`}</Text>
                            </View>
                        )
                    })}
                </View>
            ))}
        </View>
    )
}

export function PdfVisualBlock({ block }: { block: PdfVisualRenderBlock }) {
    if (block.kind === "visual-card") return <PdfVisualCard block={block} />
    if (block.kind === "poll") return <PdfPollBlock block={block} />

    return <PdfChartBlock block={block} />
}
