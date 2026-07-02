import { articleBlockCanReceiveTextFocus, isListBlock, type ArticleBlock } from "@/lib/visual-note/article-content"
import type { ArticleEditorCommand } from "@ui/article-editor/types"
import { EMPTY_PARAGRAPH_TEXT, getBlockTextLength, getLineEnd, getLineStart } from "./text"

export const createCommandReplacement = (command: ArticleEditorCommand, selectedDisplayIndex: number, contextText: string, triggerIndex: number, selectionEnd: number) => {
    const lineStart = getLineStart(contextText, triggerIndex)
    const lineEnd = getLineEnd(contextText, selectionEnd)
    const lineSegment = contextText.slice(lineStart, lineEnd)
    const payload = `${lineSegment.slice(0, Math.max(0, triggerIndex - lineStart))}${lineSegment.slice(selectionEnd - lineStart)}`.trim()
    const transformed = command.applyLine(selectedDisplayIndex)

    if (transformed.kind === "heading") return { ...transformed, text: payload || transformed.text }
    if (transformed.kind === "quote") return { ...transformed, lines: [payload || transformed.lines[0] || "Quoted text"] }
    if (isListBlock(transformed)) return { ...transformed, items: [payload || transformed.items[0] || "Item"] }
    if (transformed.kind === "code") return { ...transformed, language: payload || transformed.language, code: transformed.code || "// Add code" }
    if (transformed.kind === "callout") return { ...transformed, text: payload || transformed.text }
    return transformed
}

export const replaceTextCommandBlock = (
    nextBlocks: ArticleBlock[],
    blockIndex: number,
    contextText: string,
    triggerIndex: number,
    selectionEnd: number,
    replacementBlock: ArticleBlock,
    setSplitFocus: (blockIndex: number, listIndex: number | null, selection: number) => void,
) => {
    const before = contextText.slice(0, getLineStart(contextText, triggerIndex)).trim()
    const after = contextText.slice(getLineEnd(contextText, selectionEnd)).trim()
    const replacement: ArticleBlock[] = []
    if (before) replacement.push({ kind: "paragraph", text: before })
    replacement.push(replacementBlock)
    if (!after && !articleBlockCanReceiveTextFocus(replacementBlock)) replacement.push({ kind: "paragraph", text: EMPTY_PARAGRAPH_TEXT })
    if (after) replacement.push({ kind: "paragraph", text: after })
    nextBlocks.splice(blockIndex, 1, ...replacement)
    setFocusAfterReplacement(blockIndex + (before ? 1 : 0), replacementBlock, setSplitFocus)
}

export const replaceListCommandBlock = (
    nextBlocks: ArticleBlock[],
    blockIndex: number,
    listIndex: number,
    replacementBlock: ArticleBlock,
    setSplitFocus: (blockIndex: number, listIndex: number | null, selection: number) => void,
) => {
    const block = nextBlocks[blockIndex]
    if (!block || !isListBlock(block)) return
    const beforeItems = block.items.slice(0, listIndex).filter(item => item.trim())
    const afterItems = block.items.slice(listIndex + 1).filter(item => item.trim())
    const listReplacement: ArticleBlock[] = []
    if (beforeItems.length) listReplacement.push({ ...block, items: beforeItems })
    listReplacement.push(replacementBlock)
    if (!afterItems.length && !articleBlockCanReceiveTextFocus(replacementBlock)) listReplacement.push({ kind: "paragraph", text: EMPTY_PARAGRAPH_TEXT })
    if (afterItems.length) listReplacement.push({ ...block, items: afterItems })
    nextBlocks.splice(blockIndex, 1, ...listReplacement)
    setFocusAfterReplacement(blockIndex + (beforeItems.length ? 1 : 0), replacementBlock, setSplitFocus)
}

export const updateBlock = <K extends ArticleBlock["kind"]>(
    blocks: ArticleBlock[],
    blockIndex: number,
    writeBlocks: (blocks: ArticleBlock[]) => void,
    kind: K,
    patch: Partial<Extract<ArticleBlock, { kind: K }>>,
) => {
    const nextBlocks = [...blocks]
    const current = nextBlocks[blockIndex]
    if (!current || current.kind !== kind) return

    nextBlocks[blockIndex] = { ...current, ...patch } as ArticleBlock
    writeBlocks(nextBlocks)
}

const setFocusAfterReplacement = (baseIndex: number, replacementBlock: ArticleBlock, setSplitFocus: (blockIndex: number, listIndex: number | null, selection: number) => void) => {
    const focusOffset = articleBlockCanReceiveTextFocus(replacementBlock) ? 0 : 1
    setSplitFocus(baseIndex + focusOffset, isListBlock(replacementBlock) ? 0 : null, getBlockTextLength(replacementBlock))
}
