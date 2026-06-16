import type { KeyboardEvent } from "react"
import { articleBlockCanReceiveTextFocus, isListBlock, type ArticleBlock } from "@/lib/visual-note/article-content"
import { EMPTY_PARAGRAPH_TEXT } from "./text"

type SetSplitFocus = (blockIndex: number, listIndex: number | null, selection: number) => void
type WriteBlocks = (blocks: ArticleBlock[]) => void

type ListKeyboardOptions = {
    block: Extract<ArticleBlock, { kind: "bulletList" | "orderedList" }>
    blockIndex: number
    blocks: ArticleBlock[]
    listIndex: number
    setSplitFocus: SetSplitFocus
    writeBlocks: WriteBlocks
}

type FocusTarget = {
    blockIndex: number
    listIndex: number | null
}

export const removeEmptyListItemBeforeCursor = ({ block, blockIndex, blocks, listIndex, setSplitFocus, writeBlocks }: ListKeyboardOptions) => {
    const currentItem = block.items[listIndex] ?? ""
    if (currentItem.trim() !== "") return false

    const nextBlocks = [...blocks]
    const remainingItems = block.items.filter((_, itemIndex) => itemIndex !== listIndex)

    if (listIndex > 0) {
        nextBlocks[blockIndex] = { ...block, items: remainingItems }
        setSplitFocus(blockIndex, listIndex - 1, Number.MAX_SAFE_INTEGER)
        writeBlocks(nextBlocks)
        return true
    }

    const previousTarget = previousEditableTarget(nextBlocks, blockIndex)
    if (previousTarget && remainingItems.length) nextBlocks[blockIndex] = { ...block, items: remainingItems }
    else if (previousTarget) nextBlocks.splice(blockIndex, 1)
    else if (remainingItems.length) nextBlocks.splice(blockIndex, 1, { kind: "paragraph", text: EMPTY_PARAGRAPH_TEXT }, { ...block, items: remainingItems })
    else nextBlocks.splice(blockIndex, 1, { kind: "paragraph", text: EMPTY_PARAGRAPH_TEXT })

    if (previousTarget) setSplitFocus(previousTarget.blockIndex, previousTarget.listIndex, Number.MAX_SAFE_INTEGER)
    else setSplitFocus(blockIndex, null, 0)

    writeBlocks(nextBlocks)
    return true
}

export const splitListItem = ({ block, blockIndex, blocks, event, listIndex, setSplitFocus, writeBlocks }: ListKeyboardOptions & { event: KeyboardEvent<HTMLTextAreaElement> }) => {
    const selectionStart = event.currentTarget.selectionStart ?? 0
    const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart
    const currentItem = block.items[listIndex] ?? ""
    const beforeText = currentItem.slice(0, selectionStart)
    const afterText = currentItem.slice(selectionEnd)
    const nextBlocks = [...blocks]

    if (currentItem.trim() === "") {
        exitEmptyListItem({ block, blockIndex, blocks: nextBlocks, listIndex, setSplitFocus, writeBlocks })
        return
    }

    const items = [...block.items]
    items.splice(listIndex, 1, beforeText, afterText)
    nextBlocks[blockIndex] = { ...block, items }
    setSplitFocus(blockIndex, listIndex + 1, 0)
    writeBlocks(nextBlocks)
}

const exitEmptyListItem = ({ block, blockIndex, blocks, listIndex, setSplitFocus, writeBlocks }: ListKeyboardOptions) => {
    const remainingItems = block.items.filter((_, itemIndex) => itemIndex !== listIndex)
    const isFinalItem = listIndex === block.items.length - 1

    if (!remainingItems.length) {
        blocks.splice(blockIndex, 1, { kind: "paragraph", text: EMPTY_PARAGRAPH_TEXT })
        setSplitFocus(blockIndex, null, 0)
    } else if (isFinalItem) {
        blocks.splice(blockIndex, 1, { ...block, items: remainingItems }, { kind: "paragraph", text: EMPTY_PARAGRAPH_TEXT })
        setSplitFocus(blockIndex + 1, null, 0)
    } else {
        blocks[blockIndex] = { ...block, items: remainingItems }
        setSplitFocus(blockIndex, listIndex, 0)
    }

    writeBlocks(blocks)
}

const previousEditableTarget = (blocks: ArticleBlock[], beforeIndex: number): FocusTarget | null => {
    for (let blockIndex = beforeIndex - 1; blockIndex >= 0; blockIndex--) {
        const block = blocks[blockIndex]
        if (!block || !articleBlockCanReceiveTextFocus(block)) continue
        if (isListBlock(block)) return { blockIndex, listIndex: Math.max(0, block.items.length - 1) }

        return { blockIndex, listIndex: null }
    }

    return null
}
