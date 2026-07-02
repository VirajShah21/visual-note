"use client"

import hljs from "highlight.js/lib/common"
import { cx } from "@ui/class-name"
import { Stack, Text } from "@ui/primitives"
import styles from "../../article-editor.module.css"

type HighlightedCodeBlockProps = {
    code: string
    language: string
}

const normalizeLanguage = (language: string) => {
    const normalized = language.trim().toLowerCase()
    if (!normalized || normalized === "text" || normalized === "plain") return ""

    return normalized
}

const highlightCode = (code: string, language: string) => {
    const normalizedLanguage = normalizeLanguage(language)
    if (!normalizedLanguage) return { html: hljs.highlightAuto(code).value, languageLabel: "text" }

    if (!hljs.getLanguage(normalizedLanguage)) return { html: hljs.highlightAuto(code).value, languageLabel: normalizedLanguage }

    return {
        html: hljs.highlight(code, { language: normalizedLanguage, ignoreIllegals: true }).value,
        languageLabel: normalizedLanguage,
    }
}

export function HighlightedCodeBlock({ code, language }: HighlightedCodeBlockProps) {
    const highlighted = highlightCode(code, language)

    return (
        <Stack gap="xs" className={cx(styles.articleBlock, styles.codeBlock)}>
            <Text tone="muted" size="small">{`Code block (${highlighted.languageLabel})`}</Text>
            <pre className={styles.readerCodeFrame}>
                <code className={cx(styles.readerCode, "hljs")} dangerouslySetInnerHTML={{ __html: highlighted.html }} />
            </pre>
        </Stack>
    )
}
