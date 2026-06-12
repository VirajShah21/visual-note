import type { KeyboardEvent } from "react"
import type { ArticleBlock } from "@/lib/visual-note/article-content"

type SubtitleShortcutOptions = {
    block: ArticleBlock
    blockIndex: number
    blocks: ArticleBlock[]
    event: KeyboardEvent<HTMLTextAreaElement>
    setSplitFocus: (blockIndex: number, listIndex: number | null, selection: number) => void
    writeBlocks: (blocks: ArticleBlock[]) => void
}

export const handleSubtitleShortcut = ({ block, blockIndex, blocks, event, setSplitFocus, writeBlocks }: SubtitleShortcutOptions) => {
    if (!event.shiftKey || block.kind !== "heading" || block.level !== 1 || blockIndex !== 0) return false

    event.preventDefault()
    if (blocks[1]?.kind === "subtitle") {
        focusBlockTextarea(event.currentTarget.ownerDocument, 1)
        return true
    }

    const nextBlocks = [...blocks]
    nextBlocks.splice(1, 0, { kind: "subtitle", text: "" })
    setSplitFocus(1, null, 0)
    writeBlocks(nextBlocks)
    return true
}

const focusBlockTextarea = (ownerDocument: Document, blockIndex: number) => {
    const target = ownerDocument.querySelector<HTMLTextAreaElement>(`textarea[data-block-index="${blockIndex}"]`)
    if (!target) return

    target.focus()
    target.setSelectionRange(0, 0)
}
