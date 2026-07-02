import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { isListBlock, parseArticleContent, serializeArticleContent, type ArticleBlock } from "@/lib/visual-note/article-content"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import { createCommandReplacement, replaceListCommandBlock, replaceTextCommandBlock, updateBlock } from "@ui/article-editor/utils/command-application"
import { CLOSED_COMMAND_STATE, commandMatch, commandReducer, createCommandList } from "@ui/article-editor/utils/commands"
import { createInputKeyDownHandler } from "@ui/article-editor/utils/keyboard"
import { normalizeParagraphText } from "@ui/article-editor/utils/text"
import type { ArticleEditorCommand, ArticleEditorProps, EditorField } from "@ui/article-editor/types"
import { useArticleBlockActions } from "./use-article-block-actions"
import { useArticleBlockSelection } from "./use-article-block-selection"

export const useArticleEditorController = ({ value, displays, onChange }: ArticleEditorProps) => {
    const parsed = useMemo(() => parseArticleContent(value, displays.length), [value, displays.length])
    const editorRef = useRef<HTMLDivElement | null>(null)
    const commandRef = useRef<HTMLDivElement | null>(null)
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
    const splitFocusBlockIndexRef = useRef<number | null>(null)
    const splitFocusListIndexRef = useRef<number | null>(null)
    const splitFocusSelectionRef = useRef(0)
    const [{ commandState, commandQuery, selectedCommandIndex }, dispatchCommand] = useReducer(commandReducer, CLOSED_COMMAND_STATE)
    const selectedDisplayIndex = 0
    const commands = useMemo(() => createCommandList(selectedDisplayIndex, displays), [displays])
    const commandItems = useMemo(() => commands.filter(command => commandMatch(command, commandQuery)), [commandQuery, commands])
    const boundedSelectedCommandIndex = Math.min(selectedCommandIndex, Math.max(commandItems.length - 1, 0))
    const { selectedBlockRange, selectionHandlers, selectionRect, clearSelection } = useArticleBlockSelection(editorRef, value)

    useEffect(() => {
        if (!commandState) return

        const closeOutside = (event: PointerEvent) => {
            const target = event.target as Node
            if (editorRef.current?.contains(target) || commandRef.current?.contains(target)) return

            dispatchCommand({ type: "close" })
        }

        document.addEventListener("pointerdown", closeOutside)
        return () => document.removeEventListener("pointerdown", closeOutside)
    }, [commandState])

    useEffect(() => {
        const targetIndex = splitFocusBlockIndexRef.current
        if (targetIndex == null) return

        const targetListIndex = splitFocusListIndexRef.current
        const selector =
            targetListIndex == null ? `textarea[data-block-index="${targetIndex}"]` : `textarea[data-block-index="${targetIndex}"][data-list-index="${targetListIndex}"]`
        const target = editorRef.current?.querySelector<HTMLTextAreaElement>(selector)
        if (!target) return

        target.focus()
        const selection = Math.min(splitFocusSelectionRef.current, target.value.length)
        target.setSelectionRange(selection, selection)
        splitFocusBlockIndexRef.current = null
        splitFocusListIndexRef.current = null
        splitFocusSelectionRef.current = 0
    }, [parsed.blocks])

    const setSplitFocus = useCallback((blockIndex: number, listIndex: number | null, selection: number) => {
        splitFocusBlockIndexRef.current = blockIndex
        splitFocusListIndexRef.current = listIndex
        splitFocusSelectionRef.current = selection
    }, [])

    const writeBlocks = useCallback(
        (blocks: ArticleBlock[], options: { closeCommand?: boolean } = {}) => {
            onChange(serializeArticleContent(blocks))
            if (options.closeCommand ?? true) dispatchCommand({ type: "close" })
        },
        [onChange],
    )

    useArticleBlockActions({ blocks: parsed.blocks, selectedBlockRange, clearSelection, writeBlocks })

    const getContextText = useCallback(
        (blockIndex: number, field: EditorField, listIndex?: number) => {
            const block = parsed.blocks[blockIndex]
            if (!block) return null
            if (listIndex !== undefined) return listIndex >= 0 && isListBlock(block) ? (block.items[listIndex] ?? "") : null
            if (field === "paragraph" && block.kind === "paragraph") return block.text
            if (field === "heading" && block.kind === "heading") return block.text
            if (field === "subtitle" && block.kind === "subtitle") return block.text
            if (field === "quote" && block.kind === "quote") return block.lines.join("\n")
            if (field === "callout" && block.kind === "callout") return block.text
            if (field === "code" && block.kind === "code") return block.code
            return null
        },
        [parsed.blocks],
    )

    const writeContextText = useCallback(
        (blockIndex: number, listIndex: number | undefined, next: string) => {
            const nextBlocks = [...parsed.blocks]
            const block = nextBlocks[blockIndex]
            if (!block) return

            if (listIndex !== undefined) {
                if (!isListBlock(block)) return
                const items = [...block.items]
                items[listIndex] = next
                nextBlocks[blockIndex] = { ...block, items }
                writeBlocks(nextBlocks, { closeCommand: false })
                return
            }

            if (block.kind === "paragraph") nextBlocks[blockIndex] = { ...block, text: normalizeParagraphText(next) }
            else if (block.kind === "heading") nextBlocks[blockIndex] = { ...block, text: next }
            else if (block.kind === "subtitle") nextBlocks[blockIndex] = { ...block, text: next }
            else if (block.kind === "quote") nextBlocks[blockIndex] = { ...block, lines: next.split("\n") }
            else if (block.kind === "callout") nextBlocks[blockIndex] = { ...block, text: next }
            else if (block.kind === "code") nextBlocks[blockIndex] = { ...block, code: next }
            else return

            writeBlocks(nextBlocks, { closeCommand: false })
        },
        [parsed.blocks, writeBlocks],
    )

    const updateCommandTracking = useCallback(
        (blockIndex: number, field: EditorField, listIndex: number | undefined, text: string, selection: number) => {
            if (!commandState || commandState.blockIndex !== blockIndex || commandState.field !== field || commandState.listIndex !== listIndex) return
            if (selection < commandState.triggerIndex + 1 || text[commandState.triggerIndex] !== "/") {
                dispatchCommand({ type: "close" })
                return
            }

            const between = text.slice(commandState.triggerIndex + 1, selection)
            if (between.includes("\n")) {
                dispatchCommand({ type: "close" })
                return
            }

            dispatchCommand({ type: "update", patch: { selectionEnd: selection }, query: between })
        },
        [commandState],
    )

    const computeMenuPosition = useCallback((target: HTMLTextAreaElement, cursor: number) => {
        const rect = target.getBoundingClientRect()
        const before = target.value.slice(0, cursor)
        const lineStart = before.lastIndexOf("\n")
        const lineIndex = before.split("\n").length - 1
        const lineHeight = Number.parseFloat(getComputedStyle(target).lineHeight || "22") || 22
        const lineOffset = before.length - (lineStart === -1 ? 0 : lineStart + 1)
        const offsetX = Math.max(0, Math.min(lineOffset * 8, Math.max(rect.width - 250, 20)))
        setMenuPosition({ top: Math.round(rect.top + lineIndex * lineHeight + lineHeight + 4), left: Math.round(rect.left + offsetX) })
    }, [])

    const openCommand = useCallback(
        (blockIndex: number, field: EditorField, listIndex: number | undefined, cursor: number, textarea: HTMLTextAreaElement) => {
            computeMenuPosition(textarea, cursor)
            dispatchCommand({ type: "open", state: { blockIndex, field, listIndex, triggerIndex: cursor, selectionEnd: cursor } })
        },
        [computeMenuPosition],
    )

    const applyCommand = useCallback(
        (blockIndex: number, field: EditorField, listIndex: number | undefined, command: ArticleEditorCommand) => {
            if (!commandState) {
                dispatchCommand({ type: "close" })
                return
            }

            const contextText = getContextText(blockIndex, field, listIndex)
            if (contextText == null) {
                dispatchCommand({ type: "close" })
                return
            }

            if (command.mode === "inline") {
                const inlineText = `${contextText.slice(0, commandState.triggerIndex)}${command.inlineInsert ?? ""}${contextText.slice(commandState.selectionEnd)}`
                writeContextText(blockIndex, listIndex, inlineText)
                dispatchCommand({ type: "close" })
                return
            }

            const replacementBlock = createCommandReplacement(command, selectedDisplayIndex, contextText, commandState.triggerIndex, commandState.selectionEnd)
            const nextBlocks = [...parsed.blocks]

            if (listIndex !== undefined) replaceListCommandBlock(nextBlocks, blockIndex, listIndex, replacementBlock, setSplitFocus)
            else replaceTextCommandBlock(nextBlocks, blockIndex, contextText, commandState.triggerIndex, commandState.selectionEnd, replacementBlock, setSplitFocus)

            writeBlocks(nextBlocks)
        },
        [commandState, getContextText, parsed.blocks, selectedDisplayIndex, setSplitFocus, writeBlocks, writeContextText],
    )

    const onInputChange = useCallback(
        (blockIndex: number, field: EditorField, listIndex: number | undefined, event: ChangeEvent<HTMLTextAreaElement>) => {
            const nextText = event.target.value
            const selection = event.target.selectionStart ?? 0
            writeContextText(blockIndex, listIndex, nextText)
            updateCommandTracking(blockIndex, field, listIndex, nextText, selection)
        },
        [updateCommandTracking, writeContextText],
    )

    const onInputKeyDown = useCallback(
        (blockIndex: number, field: EditorField, listIndex: number | undefined, event: KeyboardEvent<HTMLTextAreaElement>) => {
            createInputKeyDownHandler({
                blocks: parsed.blocks,
                commandState,
                commandItems,
                boundedSelectedCommandIndex,
                applyCommand,
                closeCommand: () => dispatchCommand({ type: "close" }),
                selectCommandDelta: (delta, max) => dispatchCommand({ type: "selectDelta", delta, max }),
                openCommand,
                setSplitFocus,
                writeBlocks,
            })(blockIndex, field, listIndex, event)
        },
        [applyCommand, boundedSelectedCommandIndex, commandItems, commandState, openCommand, parsed.blocks, setSplitFocus, writeBlocks],
    )

    const updateImageField = useCallback(
        (blockIndex: number, patch: Partial<Extract<ArticleBlock, { kind: "image" }>>) => updateBlock(parsed.blocks, blockIndex, writeBlocks, "image", patch),
        [parsed.blocks, writeBlocks],
    )
    const updateCalloutTone = useCallback(
        (blockIndex: number, tone: "note" | "tip" | "warning") => updateBlock(parsed.blocks, blockIndex, writeBlocks, "callout", { tone }),
        [parsed.blocks, writeBlocks],
    )
    const updateVisualBlockData = useCallback(
        (blockIndex: number, data: VisualBlockData) => updateBlock(parsed.blocks, blockIndex, writeBlocks, "visual", { data, raw: "", parseError: undefined }),
        [parsed.blocks, writeBlocks],
    )
    return {
        boundedSelectedCommandIndex,
        commandItems,
        commandRef,
        commandState,
        editorRef,
        menuPosition,
        parsed,
        selectedBlockRange,
        selectionRect,
        applyCommand,
        dismissCommand: () => dispatchCommand({ type: "close" }),
        selectionHandlers,
        handlers: { onInputChange, onInputKeyDown, updateCalloutTone, updateImageField, updateVisualBlockData },
    }
}
