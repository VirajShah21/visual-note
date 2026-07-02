import type { KeyboardEvent } from "react"
import { cryptoId, isListBlock, type ArticleBlock } from "@/lib/visual-note/article-content"
import type { ArticleEditorCommand, CommandState, EditorField } from "@ui/article-editor/types"
import { removeEmptyListItemBeforeCursor, splitListItem } from "./keyboard-list"
import { handleSubtitleShortcut } from "./keyboard-subtitle"
import { getLineEnd, getLineStart, isBlockEmpty, normalizeParagraphText } from "./text"

type KeyboardHandlerOptions = {
    blocks: ArticleBlock[]
    commandState: CommandState | null
    commandItems: ArticleEditorCommand[]
    boundedSelectedCommandIndex: number
    applyCommand: (blockIndex: number, field: EditorField, listIndex: number | undefined, command: ArticleEditorCommand) => void
    closeCommand: () => void
    selectCommandDelta: (delta: 1 | -1, max: number) => void
    openCommand: (blockIndex: number, field: EditorField, listIndex: number | undefined, cursor: number, textarea: HTMLTextAreaElement) => void
    setSplitFocus: (blockIndex: number, listIndex: number | null, selection: number) => void
    writeBlocks: (blocks: ArticleBlock[]) => void
}

export const createInputKeyDownHandler =
    ({
        blocks,
        commandState,
        commandItems,
        boundedSelectedCommandIndex,
        applyCommand,
        closeCommand,
        selectCommandDelta,
        openCommand,
        setSplitFocus,
        writeBlocks,
    }: KeyboardHandlerOptions) =>
    (blockIndex: number, field: EditorField, listIndex: number | undefined, event: KeyboardEvent<HTMLTextAreaElement>) => {
        const block = blocks[blockIndex]
        const value = event.currentTarget.value
        const selection = event.currentTarget.selectionStart ?? 0

        if (commandState?.blockIndex === blockIndex && commandState.field === field && commandState.listIndex === listIndex) {
            if (event.key === "Escape") {
                event.preventDefault()
                closeCommand()
                return
            }

            if (commandItems.length > 0 && (event.key === "Enter" || event.key === "NumpadEnter" || event.key === "Tab")) {
                event.preventDefault()
                applyCommand(blockIndex, field, listIndex, commandItems[boundedSelectedCommandIndex])
                return
            }

            if (commandItems.length === 0 && (event.key === "Enter" || event.key === "NumpadEnter")) {
                closeCommand()
                return
            }

            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault()
                selectCommandDelta(event.key === "ArrowDown" ? 1 : -1, commandItems.length - 1)
                return
            }
        }

        if (event.key === "/") {
            openCommand(blockIndex, field, listIndex, selection, event.currentTarget)
            return
        }

        if (event.key === "Delete" && handleEmptyListItemDelete({ block, blockIndex, blocks, listIndex, setSplitFocus, value, writeBlocks })) {
            event.preventDefault()
            return
        }

        if (event.key === "Backspace" && handleBackspace({ block, blockIndex, blocks, listIndex, setSplitFocus, value, writeBlocks })) {
            event.preventDefault()
            return
        }

        const isEnter = event.key === "Enter" || event.key === "NumpadEnter"
        if (isEnter && handleEnter({ block, blockIndex, blocks, event, field, listIndex, setSplitFocus, writeBlocks })) return
        if (event.key === " ") handleMarkdownShortcut({ block, blockIndex, blocks, event, field, selection, value, setSplitFocus, writeBlocks })
    }

const handleEmptyListItemDelete = ({
    block,
    blockIndex,
    blocks,
    listIndex,
    setSplitFocus,
    value,
    writeBlocks,
}: {
    block: ArticleBlock | undefined
    blockIndex: number
    blocks: ArticleBlock[]
    listIndex: number | undefined
    setSplitFocus: KeyboardHandlerOptions["setSplitFocus"]
    value: string
    writeBlocks: KeyboardHandlerOptions["writeBlocks"]
}) => {
    if (listIndex !== undefined && block && isListBlock(block) && value.trim() === "")
        return removeEmptyListItemBeforeCursor({ block, blockIndex, blocks, listIndex, setSplitFocus, writeBlocks })

    return false
}

const handleBackspace = ({
    block,
    blockIndex,
    blocks,
    listIndex,
    setSplitFocus,
    value,
    writeBlocks,
}: {
    block: ArticleBlock | undefined
    blockIndex: number
    blocks: ArticleBlock[]
    listIndex: number | undefined
    setSplitFocus: KeyboardHandlerOptions["setSplitFocus"]
    value: string
    writeBlocks: KeyboardHandlerOptions["writeBlocks"]
}) => {
    if (listIndex !== undefined && block && isListBlock(block) && value.trim() === "")
        return removeEmptyListItemBeforeCursor({ block, blockIndex, blocks, listIndex, setSplitFocus, writeBlocks })

    if (listIndex == null && block && isBlockEmpty(block, value) && blockIndex > 0) {
        const nextBlocks = [...blocks]
        nextBlocks.splice(blockIndex, 1)

        let focusIndex = block.kind === "subtitle" && blockIndex === 1 ? 0 : blockIndex - 1
        while (focusIndex >= 0 && isNonTextBlock(nextBlocks[focusIndex])) focusIndex -= 1
        if (focusIndex >= 0) setSplitFocus(focusIndex, null, Number.MAX_SAFE_INTEGER)

        writeBlocks(nextBlocks)
        return true
    }

    return false
}

const handleEnter = ({
    block,
    blockIndex,
    blocks,
    event,
    field,
    listIndex,
    setSplitFocus,
    writeBlocks,
}: {
    block: ArticleBlock | undefined
    blockIndex: number
    blocks: ArticleBlock[]
    event: KeyboardEvent<HTMLTextAreaElement>
    field: EditorField
    listIndex: number | undefined
    setSplitFocus: KeyboardHandlerOptions["setSplitFocus"]
    writeBlocks: KeyboardHandlerOptions["writeBlocks"]
}) => {
    if (field === "heading" && block?.kind === "heading") {
        if (handleSubtitleShortcut({ block, blockIndex, blocks, event, setSplitFocus, writeBlocks })) return true

        event.preventDefault()
        const { beforeText, afterText } = splitTextareaValue(event)
        const nextBlocks = [...blocks]
        nextBlocks.splice(blockIndex, 1, { ...block, text: beforeText || block.text }, { kind: "paragraph", text: normalizeParagraphText(afterText) })
        setSplitFocus(blockIndex + 1, null, 0)
        writeBlocks(nextBlocks)
        return true
    }

    if (field === "subtitle" && block?.kind === "subtitle") {
        event.preventDefault()
        const { beforeText, afterText } = splitTextareaValue(event)
        const nextBlocks = [...blocks]
        nextBlocks.splice(blockIndex, 1, { ...block, text: beforeText }, { kind: "paragraph", text: normalizeParagraphText(afterText) })
        setSplitFocus(blockIndex + 1, null, 0)
        writeBlocks(nextBlocks)
        return true
    }

    if (field === "paragraph" && block?.kind === "paragraph") {
        event.preventDefault()
        const { beforeText, afterText } = splitTextareaValue(event)
        const nextBlocks = [...blocks]
        nextBlocks.splice(blockIndex, 1, { ...block, text: normalizeParagraphText(beforeText) }, { kind: "paragraph", text: normalizeParagraphText(afterText) })
        setSplitFocus(blockIndex + 1, null, 0)
        writeBlocks(nextBlocks)
        return true
    }

    if (field === "list-item" && listIndex !== undefined && block && isListBlock(block)) {
        event.preventDefault()
        splitListItem({ block, blockIndex, blocks, event, listIndex, setSplitFocus, writeBlocks })
        return true
    }

    return false
}

const handleMarkdownShortcut = ({
    block,
    blockIndex,
    blocks,
    event,
    field,
    selection,
    value,
    setSplitFocus,
    writeBlocks,
}: {
    block: ArticleBlock | undefined
    blockIndex: number
    blocks: ArticleBlock[]
    event: KeyboardEvent<HTMLTextAreaElement>
    field: EditorField
    selection: number
    value: string
    setSplitFocus: KeyboardHandlerOptions["setSplitFocus"]
    writeBlocks: KeyboardHandlerOptions["writeBlocks"]
}) => {
    if (field !== "paragraph" || block?.kind !== "paragraph") return

    const start = getLineStart(value, selection)
    const end = getLineEnd(value, selection)
    const lineText = value.slice(start, selection).trim()
    const replacementBlock = shortcutReplacement(lineText, value.slice(selection).trim())
    if (!replacementBlock) return

    event.preventDefault()
    const beforeText = value.slice(0, start).trim()
    const afterText = value.slice(end).trim()
    const replacement: ArticleBlock[] = []
    if (beforeText) replacement.push({ kind: "paragraph", text: beforeText })
    replacement.push(replacementBlock)
    if (afterText) replacement.push({ kind: "paragraph", text: afterText })

    const nextBlocks = [...blocks]
    nextBlocks.splice(blockIndex, 1, ...replacement)
    setSplitFocus(blockIndex, null, value.slice(selection).trim().length)
    writeBlocks(nextBlocks)
}

const shortcutReplacement = (lineText: string, payload: string): ArticleBlock | null => {
    const headingMatch = lineText.match(/^(#{1,4})$/)
    if (headingMatch) return { kind: "heading", id: cryptoId(), level: Math.min(4, headingMatch[1].length) as 1 | 2 | 3 | 4, text: payload }
    if (lineText === ">") return { kind: "quote", lines: [payload || "Quoted text"] }
    if (lineText === "-") return { kind: "bulletList", items: [payload || "Item"] }
    if (lineText === "1.") return { kind: "orderedList", items: [payload || "Item"] }
    if (lineText === "---") return { kind: "divider" }
    if (lineText === "```") return { kind: "code", language: payload || "typescript", code: "// Add code" }
    return null
}

const splitTextareaValue = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const selectionStart = event.currentTarget.selectionStart ?? 0
    const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart

    return {
        beforeText: event.currentTarget.value.slice(0, selectionStart),
        afterText: event.currentTarget.value.slice(selectionEnd),
    }
}

const isNonTextBlock = (block: ArticleBlock | undefined) => block?.kind === "divider" || block?.kind === "display" || block?.kind === "visual"
