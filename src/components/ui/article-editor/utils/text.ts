import { isListBlock, type ArticleBlock } from "@/lib/visual-note/article-content"

export const EMPTY_PARAGRAPH_TEXT = "\u200b"

export const getLineStart = (text: string, cursor: number) => {
    const index = text.lastIndexOf("\n", cursor - 1)
    return index === -1 ? 0 : index + 1
}

export const getLineEnd = (text: string, cursor: number) => {
    const index = text.indexOf("\n", cursor)
    return index === -1 ? text.length : index
}

export const normalizeParagraphText = (text: string) => (text === "" ? EMPTY_PARAGRAPH_TEXT : text)

export const denormalizeParagraphText = (text: string) => (text === EMPTY_PARAGRAPH_TEXT ? "" : text)

export const getBlockTextLength = (block: ArticleBlock): number => {
    if (block.kind === "heading") return block.text.length
    if (block.kind === "paragraph") return block.text.length
    if (block.kind === "subtitle") return block.text.length
    if (block.kind === "quote") return block.lines.join("\n").length
    if (block.kind === "callout") return block.text.length
    if (block.kind === "code") return block.code.length
    if (isListBlock(block)) return block.items[0]?.length ?? 0
    return 0
}

export const isBlockEmpty = (block: ArticleBlock, textValue: string): boolean => {
    if (block.kind === "paragraph" || block.kind === "heading" || block.kind === "subtitle" || block.kind === "callout" || block.kind === "quote" || block.kind === "code")
        return textValue.trim() === ""
    if (block.kind === "image") return block.alt.trim() === "" && block.url.trim() === ""
    if (isListBlock(block)) return block.items.every(item => item.trim() === "")
    return false
}

export const headingLevelClassName = (level: 1 | 2 | 3 | 4) => `heading-${level}`
