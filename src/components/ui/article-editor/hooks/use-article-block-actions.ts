import { useEffect } from "react"
import { serializeArticleContent, type ArticleBlock } from "@/lib/visual-note/article-content"
import type { BlockSelectionRange } from "./use-article-block-selection"

type ArticleBlockActionOptions = {
    blocks: ArticleBlock[]
    selectedBlockRange: BlockSelectionRange | null
    clearSelection: () => void
    writeBlocks: (blocks: ArticleBlock[]) => void
}

export const useArticleBlockActions = ({ blocks, selectedBlockRange, clearSelection, writeBlocks }: ArticleBlockActionOptions) => {
    useEffect(() => {
        if (!selectedBlockRange) return

        const copySelectedBlocks = (event: ClipboardEvent) => {
            const selectedBlocks = blocks.slice(selectedBlockRange.start, selectedBlockRange.end + 1)
            const markdown = serializeArticleContent(selectedBlocks)

            event.preventDefault()
            event.clipboardData?.setData("text/plain", markdown)
            event.clipboardData?.setData("text/markdown", markdown)
        }

        document.addEventListener("copy", copySelectedBlocks)
        return () => document.removeEventListener("copy", copySelectedBlocks)
    }, [blocks, selectedBlockRange])

    useEffect(() => {
        if (!selectedBlockRange) return

        const deleteSelectedBlocks = (event: KeyboardEvent) => {
            if (event.defaultPrevented || (event.key !== "Delete" && event.key !== "Backspace")) return

            event.preventDefault()
            const nextBlocks = blocks.filter((_, blockIndex) => blockIndex < selectedBlockRange.start || blockIndex > selectedBlockRange.end)
            writeBlocks(nextBlocks)
            clearSelection()
        }

        document.addEventListener("keydown", deleteSelectedBlocks)
        return () => document.removeEventListener("keydown", deleteSelectedBlocks)
    }, [blocks, clearSelection, selectedBlockRange, writeBlocks])
}
