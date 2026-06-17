import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer"
import { createElement } from "react"
import type { PdfRenderBlock, PdfRenderModel } from "./types"

const marginByDensity = {
    narrow: 28,
    normal: 44,
    wide: 64,
}

const styles = StyleSheet.create({
    page: {
        backgroundColor: "#ffffff",
        color: "#17212b",
        fontFamily: "Helvetica",
        fontSize: 11,
        lineHeight: 1.45,
    },
    heading1: {
        fontSize: 24,
        fontWeight: 700,
        marginBottom: 12,
    },
    heading2: {
        fontSize: 18,
        fontWeight: 700,
        marginBottom: 9,
        marginTop: 12,
    },
    heading3: {
        fontSize: 14,
        fontWeight: 700,
        marginBottom: 7,
        marginTop: 9,
    },
    text: {
        marginBottom: 8,
    },
    quote: {
        borderLeftColor: "#2f7d5c",
        borderLeftWidth: 2,
        color: "#344657",
        marginBottom: 10,
        paddingLeft: 10,
    },
    code: {
        backgroundColor: "#101820",
        borderRadius: 4,
        color: "#d8e2ec",
        fontFamily: "Courier",
        fontSize: 9,
        marginBottom: 10,
        padding: 8,
    },
    divider: {
        borderTopColor: "#d7e0e7",
        borderTopWidth: 1,
        marginBottom: 12,
        marginTop: 8,
    },
    image: {
        marginBottom: 12,
        maxHeight: 420,
        objectFit: "contain",
        width: "100%",
    },
    data: {
        borderColor: "#d7e0e7",
        borderRadius: 4,
        borderWidth: 1,
        marginBottom: 10,
        padding: 8,
    },
    dataTitle: {
        fontSize: 11,
        fontWeight: 700,
        marginBottom: 5,
    },
})

const headingStyle = (depth: number) => {
    if (depth <= 1) return styles.heading1
    if (depth === 2) return styles.heading2

    return styles.heading3
}

function PdfBlock({ block }: { block: PdfRenderBlock }) {
    if (block.kind === "heading")
        return (
            <Text break={block.breakBefore} style={headingStyle(block.depth)}>
                {block.text}
            </Text>
        )
    if (block.kind === "paragraph")
        return (
            <Text break={block.breakBefore} style={styles.text}>
                {block.text}
            </Text>
        )
    if (block.kind === "list")
        return (
            <View break={block.breakBefore} style={styles.text}>
                {block.items.map((item, index) => (
                    <Text key={`${item}-${index}`}>
                        {block.ordered ? `${index + 1}. ` : "- "}
                        {item}
                    </Text>
                ))}
            </View>
        )
    if (block.kind === "quote")
        return (
            <View break={block.breakBefore} style={styles.quote}>
                {block.lines.map((line, index) => (
                    <Text key={`${line}-${index}`}>{line}</Text>
                ))}
            </View>
        )
    if (block.kind === "code")
        return (
            <Text break={block.breakBefore} style={styles.code}>
                {block.code}
            </Text>
        )
    if (block.kind === "divider") return <View break={block.breakBefore} style={styles.divider} />
    if (block.kind === "image") return createElement(Image, { break: block.breakBefore, src: block.url, style: styles.image })

    return (
        <View break={block.breakBefore} style={styles.data}>
            <Text style={styles.dataTitle}>{block.title}</Text>
            <Text>{block.body}</Text>
        </View>
    )
}

function PdfDocument({ model }: { model: PdfRenderModel }) {
    const size = model.options.pageSize === "letter" ? "LETTER" : "A4"
    const pageStyle = { ...styles.page, padding: marginByDensity[model.options.margin] }

    return (
        <Document title={model.title}>
            <Page size={size} orientation={model.options.orientation} style={pageStyle}>
                {model.blocks.map((block, index) => (
                    <PdfBlock key={`${block.kind}-${index}`} block={block} />
                ))}
            </Page>
        </Document>
    )
}

export const createPdfBlob = (model: PdfRenderModel) => pdf(<PdfDocument model={model} />).toBlob()
