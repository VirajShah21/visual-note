import type { ChangeEvent, KeyboardEvent, ReactNode } from "react"
import type { ArticleBlock } from "@/lib/visual-note/article-content"
import type { ArticleBlockInfoMode, ArticleContentsMode, ArticleEditorMode, DisplayInstance } from "@/lib/visual-note/types"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"

export type EditorField = "paragraph" | "heading" | "subtitle" | "quote" | "callout" | "code" | "list-item"

export type ArticleEditorCommand = {
    id: string
    label: string
    description: string
    aliases: string[]
    mode: "inline" | "line"
    applyLine: (selectedDisplayIndex: number) => ArticleBlock
    inlineInsert?: string
}

export type ArticleEditorProps = {
    value: string
    displays: DisplayInstance[]
    onChange: (next: string) => void
    blockInfoMode?: ArticleBlockInfoMode
    contentsMode?: ArticleContentsMode
    editorMode?: ArticleEditorMode
    readOnly?: boolean
    renderDisplay?: (display: DisplayInstance, displayIndex: number) => ReactNode
    renderVisualBlock?: (block: Extract<ArticleBlock, { kind: "visual" }>, onDataChange: (data: VisualBlockData) => void) => ReactNode
    onUploadImage?: (file: File) => Promise<{ url: string; alt?: string }>
}

export type CommandState = {
    blockIndex: number
    field: EditorField
    listIndex?: number
    triggerIndex: number
    selectionEnd: number
}

export type CommandReducerState = {
    commandState: CommandState | null
    commandQuery: string
    selectedCommandIndex: number
}

export type CommandAction =
    | { type: "open"; state: CommandState }
    | { type: "update"; patch: Pick<CommandState, "selectionEnd">; query: string }
    | { type: "close" }
    | { type: "selectDelta"; delta: 1 | -1; max: number }

export type ArticleBlockHandlers = {
    onInputChange: (blockIndex: number, field: EditorField, listIndex: number | undefined, event: ChangeEvent<HTMLTextAreaElement>) => void
    onInputKeyDown: (blockIndex: number, field: EditorField, listIndex: number | undefined, event: KeyboardEvent<HTMLTextAreaElement>) => void
    updateCalloutTone: (blockIndex: number, tone: "note" | "tip" | "warning") => void
    updateImageField: (blockIndex: number, patch: Partial<Extract<ArticleBlock, { kind: "image" }>>) => void
    updateVisualBlockData: (blockIndex: number, data: VisualBlockData) => void
}
