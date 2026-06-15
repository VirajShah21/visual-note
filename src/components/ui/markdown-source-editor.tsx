"use client"

import dynamic from "next/dynamic"
import type { OnChange, OnMount } from "@monaco-editor/react"
import { useCallback } from "react"
import { Text } from "./primitives"
import styles from "./markdown-source-editor.module.css"

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then(module => module.default), {
    ssr: false,
    loading: () => <Text size="small">Loading markdown editor...</Text>,
})

type MarkdownSourceEditorProps = {
    value: string
    readOnly?: boolean
    onChange: (value: string) => void
}

export function MarkdownSourceEditor({ value, readOnly = false, onChange }: MarkdownSourceEditorProps) {
    const handleChange: OnChange = useCallback(nextValue => onChange(nextValue ?? ""), [onChange])
    const handleMount: OnMount = useCallback(editor => editor.focus(), [])

    return (
        <div className={styles.sourceEditor}>
            <MonacoEditor
                height="100%"
                language="markdown"
                theme="vs"
                value={value}
                options={{
                    minimap: { enabled: false },
                    readOnly,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    wrappingIndent: "same",
                    lineNumbers: "on",
                    fontSize: 14,
                    fontFamily: '"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
                onChange={handleChange}
                onMount={handleMount}
            />
        </div>
    )
}
