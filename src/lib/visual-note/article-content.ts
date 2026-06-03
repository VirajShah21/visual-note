export type ArticleBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; id: string; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bulletList"; items: string[] }
  | { kind: "orderedList"; items: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "code"; language: string; code: string }
  | { kind: "divider" }
  | { kind: "callout"; tone: "note" | "tip" | "warning"; text: string }
  | { kind: "image"; alt: string; url: string }
  | { kind: "display"; displayIndex: number }
  | { kind: "toc" }

export const cryptoId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const isListBlock = (
  block: ArticleBlock,
): block is Extract<ArticleBlock, { kind: "bulletList" | "orderedList" }> =>
  block.kind === "bulletList" || block.kind === "orderedList"

export const articleBlockCanReceiveTextFocus = (block: ArticleBlock) =>
  block.kind === "paragraph" ||
  block.kind === "heading" ||
  block.kind === "quote" ||
  block.kind === "callout" ||
  block.kind === "code" ||
  isListBlock(block)

export type ArticleHeadingIndex = {
  id: string
  title: string
  level: 1 | 2 | 3 | 4
}

export type ParsedArticleContent = {
  blocks: ArticleBlock[]
  headings: ArticleHeadingIndex[]
}

const articleSlug = (value: string, fallbackIndex: number, used: Set<string>) => {
  const base =
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "") || `section-${fallbackIndex + 1}`

  let slug = base
  let suffix = 2
  while (used.has(slug)) {
    slug = `${base}-${suffix}`
    suffix++
  }

  used.add(slug)
  return slug
}

const articleIsBlockStart = (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/^#{1,4}\s+/.test(trimmed)) return true
  if (trimmed === "---") return true
  if (/^\{\{toc\}\}$/i.test(trimmed)) return true
  if (/^\{\{display:\s*\d+\s*\}\}$/i.test(trimmed)) return true
  if (/^```/.test(trimmed)) return true
  if (/^:::/.test(trimmed)) return true
  if (/^!\[.*\]\(.*\)$/.test(trimmed)) return true
  if (/^\s*[-*](?:\s+|$)/.test(line)) return true
  if (/^\s*\d+\.(?:\s+|$)/.test(line)) return true
  if (/^>\s*/.test(trimmed)) return true

  return false
}

export const parseArticleContent = (source: string, displayCount: number): ParsedArticleContent => {
  const text = source.replace(/\r\n/g, "\n")
  const lines = text.split("\n")
  const blocks: ArticleBlock[] = []
  const headings: ArticleHeadingIndex[] = []
  const usedIds = new Set<string>()
  let index = 0

  while (index < lines.length) {
    const rawLine = lines[index]
    const trimmedLine = rawLine.trim()

    if (!trimmedLine) {
      index++
      continue
    }

    const headingMatch = rawLine.match(/^\s*(#{1,4})\s+(.*)$/)
    if (headingMatch) {
      const level = Math.min(4, headingMatch[1].length) as 1 | 2 | 3 | 4
      const text = headingMatch[2]
      const title = text.trim()
      const id = articleSlug(title, headings.length, usedIds)
      blocks.push({ kind: "heading", level, id, text })
      headings.push({ id, title, level })
      index++
      continue
    }

    if (/^\{\{toc\}\}$/i.test(trimmedLine)) {
      blocks.push({ kind: "toc" })
      index++
      continue
    }

    const displayMatch = trimmedLine.match(/^\{\{display:\s*(\d+)\s*\}\}$/i)
    if (displayMatch) {
      blocks.push({ kind: "display", displayIndex: Number.parseInt(displayMatch[1], 10) - 1 })
      index++
      continue
    }

    if (/^```/.test(trimmedLine)) {
      const language = trimmedLine.slice(3).trim() || "text"
      const code: string[] = []
      index++
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        code.push(lines[index])
        index++
      }
      if (index < lines.length && /^```/.test(lines[index].trim())) index++
      blocks.push({ kind: "code", language, code: code.join("\n") })
      continue
    }

    const calloutMatch = trimmedLine.match(/^:::(note|tip|warning)$/i)
    if (calloutMatch) {
      const tone = calloutMatch[1].toLowerCase() as "note" | "tip" | "warning"
      const linesInCallout: string[] = []
      index++
      while (index < lines.length && lines[index].trim() !== ":::") {
        linesInCallout.push(lines[index])
        index++
      }
      if (index < lines.length && lines[index].trim() === ":::") index++
      blocks.push({
        kind: "callout",
        tone,
        text: linesInCallout.join("\n").trim() || `${tone} note content`,
      })
      continue
    }

    if (trimmedLine === "---") {
      blocks.push({ kind: "divider" })
      index++
      continue
    }

    const imageMatch = trimmedLine.match(/^!\[(.*?)\]\((.*?)\)$/)
    if (imageMatch) {
      blocks.push({ kind: "image", alt: imageMatch[1] || "Article image", url: imageMatch[2] || "" })
      index++
      continue
    }

    if (/^\s*[-*](?:\s+|$)/.test(rawLine)) {
      const items: string[] = []
      while (index < lines.length && /^\s*[-*](?:\s+|$)/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*](?:\s+|$)/, ""))
        index++
      }
      blocks.push({ kind: "bulletList", items })
      continue
    }

    if (/^\s*\d+\.(?:\s+|$)/.test(rawLine)) {
      const items: string[] = []
      while (index < lines.length && /^\s*\d+\.(?:\s+|$)/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.(?:\s+|$)/, ""))
        index++
      }
      blocks.push({ kind: "orderedList", items })
      continue
    }

    if (/^>\s*/.test(trimmedLine)) {
      const linesInQuote: string[] = []
      while (index < lines.length && /^>\s*/.test(lines[index].trim())) {
        linesInQuote.push(lines[index].replace(/^>\s*/, ""))
        index++
      }
      blocks.push({ kind: "quote", lines: linesInQuote })
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length && lines[index].trim() && !articleIsBlockStart(lines[index])) {
      paragraphLines.push(lines[index])
      index++
    }
    blocks.push({ kind: "paragraph", text: paragraphLines.join("\n") })
  }

  if (blocks.length === 0) blocks.push({ kind: "paragraph", text: "Start by adding content in this article." })
  if (displayCount > 0 && blocks.every(block => block.kind !== "display"))
    blocks.push({ kind: "paragraph", text: "Use {{display:1}}, {{display:2}}, and so on to embed configured displays inline." })

  return { blocks, headings }
}

export const serializeArticleContent = (blocks: ArticleBlock[]) => {
  const chunks: string[] = []

  blocks.forEach(block => {
    if (block.kind === "heading") {
      chunks.push(`${"#".repeat(block.level)} ${block.text}`)
      return
    }

    if (block.kind === "paragraph") {
      chunks.push(block.text)
      return
    }

    if (block.kind === "quote") {
      chunks.push(block.lines.map(line => `> ${line}`).join("\n"))
      return
    }

    if (block.kind === "bulletList") {
      if (block.items.length === 0) return
      chunks.push(block.items.map(item => `- ${item}`).join("\n"))
      return
    }

    if (block.kind === "orderedList") {
      if (block.items.length === 0) return
      chunks.push(block.items.map((item, itemIndex) => `${itemIndex + 1}. ${item}`).join("\n"))
      return
    }

    if (block.kind === "code") {
      chunks.push(["```" + block.language, block.code, "```"].join("\n"))
      return
    }

    if (block.kind === "divider") {
      chunks.push("---")
      return
    }

    if (block.kind === "callout") {
      chunks.push(block.text ? [`:::${block.tone}`, block.text, ":::"].join("\n") : [`:::${block.tone}`, ":::"].join("\n"))
      return
    }

    if (block.kind === "image") {
      chunks.push(`![${block.alt}](${block.url})`)
      return
    }

    if (block.kind === "display") {
      chunks.push(`{{display:${block.displayIndex + 1}}}`)
      return
    }

    if (block.kind === "toc") {
      chunks.push("{{toc}}")
      return
    }
  })

  return chunks.join("\n\n").replace(/\n\n+$/g, "")
}

export const articleHeadingId = articleSlug
