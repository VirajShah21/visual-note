"use client"

import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentProps, type KeyboardEvent, type ReactNode } from "react"
import { Button } from "./button"
import { SelectField } from "./form-controls"
import { Card, Divider, Pill, Stack, Text } from "./primitives"
import { cx } from "./class-name"
import { parseArticleContent, serializeArticleContent, type ArticleBlock } from "@/lib/visual-note/article-content"
import type { DisplayInstance } from "@/lib/visual-note/types"
import styles from "./article-editor.module.css"

type EditorField = "paragraph" | "heading" | "quote" | "callout" | "code" | "list-item"
const EMPTY_PARAGRAPH_TEXT = "\u200b"

type ArticleEditorCommand = {
  id: string
  label: string
  description: string
  aliases: string[]
  mode: "inline" | "line"
  applyLine: (selectedDisplayIndex: number) => ArticleBlock
  inlineInsert?: string
}

type ArticleEditorProps = {
  value: string
  displays: DisplayInstance[]
  selectedDisplayForArticle: string
  onChangeSelectedDisplay: (value: string) => void
  onChange: (next: string) => void
  renderDisplay?: (display: DisplayInstance, displayIndex: number) => ReactNode
}

type CommandState = {
  blockIndex: number
  field: EditorField
  listIndex?: number
  triggerIndex: number
  selectionEnd: number
}

const commandMatch = (command: ArticleEditorCommand, query: string) => {
  const normalized = query.toLowerCase().trim()
  if (!normalized) return true

  if (command.label.toLowerCase().includes(normalized)) return true

  return command.aliases.some(alias => alias.toLowerCase().includes(normalized))
}

const createCommandList = (selectedDisplayIndex: number, displays: DisplayInstance[]) => {
  const selectedDisplay = Math.max(0, Math.min(selectedDisplayIndex, Math.max(displays.length - 1, 0)))

  const commands: ArticleEditorCommand[] = [
    {
      id: "heading-1",
      label: "Heading 1",
      description: "Create a level 1 heading",
      aliases: ["h1", "#", "heading 1"],
      mode: "line",
      applyLine: () => ({ kind: "heading", id: cryptoId(), level: 1, text: "Heading" }),
    },
    {
      id: "heading-2",
      label: "Heading 2",
      description: "Create a level 2 heading",
      aliases: ["h2", "##", "heading 2"],
      mode: "line",
      applyLine: () => ({ kind: "heading", id: cryptoId(), level: 2, text: "Heading" }),
    },
    {
      id: "heading-3",
      label: "Heading 3",
      description: "Create a level 3 heading",
      aliases: ["h3", "###", "heading 3"],
      mode: "line",
      applyLine: () => ({ kind: "heading", id: cryptoId(), level: 3, text: "Heading" }),
    },
    {
      id: "heading-4",
      label: "Heading 4",
      description: "Create a level 4 heading",
      aliases: ["h4", "####", "heading 4"],
      mode: "line",
      applyLine: () => ({ kind: "heading", id: cryptoId(), level: 4, text: "Heading" }),
    },
    {
      id: "paragraph",
      label: "Paragraph",
      description: "Create a paragraph",
      aliases: ["p", "paragraph", "text"],
      mode: "line",
      applyLine: () => ({ kind: "paragraph", text: "Paragraph" }),
    },
    {
      id: "quote",
      label: "Quote",
      description: "Create a quote block",
      aliases: ["quote", ">", "blockquote"],
      mode: "line",
      applyLine: () => ({ kind: "quote", lines: ["Quoted text"] }),
    },
    {
      id: "bullet-list",
      label: "Bullet list",
      description: "Create a bullet list",
      aliases: ["bullet", "bullets", "list", "-"],
      mode: "line",
      applyLine: () => ({ kind: "bulletList", items: ["Item"] }),
    },
    {
      id: "ordered-list",
      label: "Ordered list",
      description: "Create an ordered list",
      aliases: ["ordered", "numbered", "1.", "list"],
      mode: "line",
      applyLine: () => ({ kind: "orderedList", items: ["Item"] }),
    },
    {
      id: "divider",
      label: "Divider",
      description: "Create a divider",
      aliases: ["divider", "---"],
      mode: "line",
      applyLine: () => ({ kind: "divider" }),
    },
    {
      id: "code-block",
      label: "Code block",
      description: "Create a code block",
      aliases: ["code", "code block", "```"],
      mode: "line",
      applyLine: () => ({ kind: "code", language: "typescript", code: "// Add code" }),
    },
    {
      id: "tip",
      label: "Tip",
      description: "Insert a tip callout",
      aliases: ["tip", "callout", "important"],
      mode: "line",
      applyLine: () => ({ kind: "callout", tone: "tip", text: "Tip content" }),
    },
    {
      id: "warning",
      label: "Warning",
      description: "Insert a warning callout",
      aliases: ["warning", "caution", "alert"],
      mode: "line",
      applyLine: () => ({ kind: "callout", tone: "warning", text: "Warning content" }),
    },
    {
      id: "note",
      label: "Note",
      description: "Insert a note callout",
      aliases: ["note", "info"],
      mode: "line",
      applyLine: () => ({ kind: "callout", tone: "note", text: "Note content" }),
    },
    {
      id: "image",
      label: "Image",
      description: "Insert an image block",
      aliases: ["image", "img", "photo", "media"],
      mode: "line",
      applyLine: () => ({ kind: "image", alt: "Image", url: "" }),
    },
    {
      id: "toc",
      label: "Table of contents",
      description: "Insert table-of-contents token",
      aliases: ["toc", "table of contents", "{{toc}}"],
      mode: "line",
      applyLine: () => ({ kind: "toc" }),
    },
    {
      id: "display",
      label: `Display ${selectedDisplay + 1}`,
      description: `Insert {{display:${selectedDisplay + 1}}}`,
      aliases: ["display", `{{display:${selectedDisplay + 1}}}`],
      mode: "line",
      applyLine: () => ({ kind: "display", displayIndex: selectedDisplay }),
    },
    {
      id: "inline-bold",
      label: "Bold",
      description: "Insert bold markdown",
      aliases: ["bold", "strong", "**"],
      mode: "inline",
      applyLine: () => ({ kind: "paragraph", text: "" }),
      inlineInsert: "**text**",
    },
    {
      id: "inline-italic",
      label: "Italic",
      description: "Insert italic markdown",
      aliases: ["italic", "emphasis", "*"],
      mode: "inline",
      applyLine: () => ({ kind: "paragraph", text: "" }),
      inlineInsert: "*text*",
    },
    {
      id: "inline-code",
      label: "Code",
      description: "Insert inline code",
      aliases: ["code", "inline", "`"],
      mode: "inline",
      applyLine: () => ({ kind: "paragraph", text: "" }),
      inlineInsert: "`code`",
    },
    {
      id: "inline-link",
      label: "Link",
      description: "Insert link markdown",
      aliases: ["link", "url", "hyperlink"],
      mode: "inline",
      applyLine: () => ({ kind: "paragraph", text: "" }),
      inlineInsert: "[text](url)",
    },
  ]

  displays.forEach((display, index) => {
    if (index === selectedDisplay) return

    commands.push({
      id: `display-${index + 1}`,
      label: display.name || `Display ${index + 1}`,
      description: `Insert {{display:${index + 1}}}`,
      aliases: [`display ${index + 1}`, `{{display:${index + 1}}}`],
      mode: "line",
      applyLine: () => ({ kind: "display", displayIndex: index }),
    })
  })

  return commands
}

const selectedDisplayIndexFromState = (value: string, displayCount: number) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0 || displayCount === 0) return 0

  return Math.min(parsed - 1, displayCount - 1)
}

const cryptoId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const getLineStart = (text: string, cursor: number) => {
  const index = text.lastIndexOf("\n", cursor - 1)
  return index === -1 ? 0 : index + 1
}

const getLineEnd = (text: string, cursor: number) => {
  const index = text.indexOf("\n", cursor)
  return index === -1 ? text.length : index
}

const markdownLinkPattern = /(^|[^!])\[([^\]\n]+)\]\(([^)\s]+)\)/g

const hasMarkdownLink = (text: string) => {
  markdownLinkPattern.lastIndex = 0
  return markdownLinkPattern.test(text)
}

const safeLinkHref = (href: string) => {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href

  return `https://${href}`
}

const renderInlineLinks = (text: string) => {
  const parts: ReactNode[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  markdownLinkPattern.lastIndex = 0

  while ((match = markdownLinkPattern.exec(text)) !== null) {
    const prefix = match[1]
    const matchStart = match.index + prefix.length
    const matchEnd = markdownLinkPattern.lastIndex
    if (matchStart > cursor) parts.push(text.slice(cursor, matchStart))

    const label = match[2]
    const href = safeLinkHref(match[3])
    parts.push(
      <a key={`${matchStart}-${href}`} className={styles.inlineLink} href={href} target="_blank" rel="noreferrer">
        {label}
      </a>,
    )
    cursor = matchEnd
  }

  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

const normalizeParagraphText = (text: string) => {
  return text === "" ? EMPTY_PARAGRAPH_TEXT : text
}

const denormalizeParagraphText = (text: string) => {
  return text === EMPTY_PARAGRAPH_TEXT ? "" : text
}

const articleBlockCanReceiveTextFocus = (block: ArticleBlock) => {
  return (
    block.kind === "paragraph" ||
    block.kind === "heading" ||
    block.kind === "quote" ||
    block.kind === "callout" ||
    block.kind === "code" ||
    block.kind === "bulletList" ||
    block.kind === "orderedList"
  )
}

type BlockTextareaProps = ComponentProps<typeof motion.textarea> & {
  value: string
}

function BlockTextarea({ value, className, ...props }: BlockTextareaProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return

    input.style.height = "auto"
    input.style.height = `${input.scrollHeight}px`
  }, [value])

  return (
    <motion.textarea
      ref={inputRef}
      className={className}
      value={value}
      rows={1}
      initial={{ opacity: 0.98 }}
      animate={{ opacity: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 24 }}
      {...props}
    />
  )
}

function InlineLinkTextarea({ value, className, ...props }: BlockTextareaProps) {
  const [isEditing, setIsEditing] = useState(false)
  const shouldDisplayLinks = !isEditing && hasMarkdownLink(value)

  if (shouldDisplayLinks)
    return (
      <div
        className={cx(className, styles.blockDisplay)}
        role="textbox"
        tabIndex={0}
        aria-label={props["aria-label"]}
        onClick={event => {
          const target = event.target as HTMLElement
          if (target.closest("a")) return

          setIsEditing(true)
        }}
        onKeyDown={event => {
          if (event.key !== "Enter" && event.key !== " ") return

          event.preventDefault()
          setIsEditing(true)
        }}
      >
        {renderInlineLinks(value)}
      </div>
    )

  return (
    <BlockTextarea
      {...props}
      value={value}
      className={className}
      autoFocus={isEditing}
      onFocus={event => {
        props.onFocus?.(event)
        if (isEditing) {
          const selection = event.currentTarget.value.length
          event.currentTarget.setSelectionRange(selection, selection)
        }
        setIsEditing(true)
      }}
      onBlur={event => {
        props.onBlur?.(event)
        setIsEditing(false)
      }}
    />
  )
}

export function ArticleEditor({ value, displays, selectedDisplayForArticle, onChangeSelectedDisplay, onChange, renderDisplay }: ArticleEditorProps) {
  const parsed = useMemo(() => parseArticleContent(value, displays.length), [value, displays.length])
  const editorRef = useRef<HTMLDivElement | null>(null)
  const commandRef = useRef<HTMLDivElement | null>(null)
  const splitFocusBlockIndexRef = useRef<number | null>(null)
  const splitFocusListIndexRef = useRef<number | null>(null)
  const splitFocusSelectionRef = useRef<number>(0)

  const [commandState, setCommandState] = useState<CommandState | null>(null)
  const [commandQuery, setCommandQuery] = useState("")
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

  const selectedDisplayIndex = useMemo(() => selectedDisplayIndexFromState(selectedDisplayForArticle, displays.length), [selectedDisplayForArticle, displays.length])

  const commands = useMemo(() => createCommandList(selectedDisplayIndex, displays), [displays, selectedDisplayIndex])
  const commandItems = useMemo(() => commands.filter(command => commandMatch(command, commandQuery)), [commandQuery, commands])
  const boundedSelectedCommandIndex = Math.min(selectedCommandIndex, Math.max(commandItems.length - 1, 0))

  const displayOptions = useMemo(
    () =>
      displays.length === 0
        ? [{ label: "1", value: "1" }]
        : displays.map((display, index) => ({
            label: `${index + 1}. ${display.name}`,
            value: `${index + 1}`,
          })),
    [displays],
  )

  useEffect(() => {
    if (!commandState) return

    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (editorRef.current?.contains(target) || commandRef.current?.contains(target)) return

      setCommandState(null)
      setCommandQuery("")
      setSelectedCommandIndex(0)
    }

    document.addEventListener("pointerdown", closeOutside)
    return () => document.removeEventListener("pointerdown", closeOutside)
  }, [commandState])

  useEffect(() => {
    const targetIndex = splitFocusBlockIndexRef.current
    if (targetIndex == null) return

    const targetListIndex = splitFocusListIndexRef.current
    const selector = targetListIndex == null ? `textarea[data-block-index="${targetIndex}"]` : `textarea[data-block-index="${targetIndex}"][data-list-index="${targetListIndex}"]`
    const target = editorRef.current?.querySelector<HTMLTextAreaElement>(selector)
    if (!target) return

    target.focus()
    const maxSelection = target.value.length
    const selection = Math.min(splitFocusSelectionRef.current, maxSelection)
    target.setSelectionRange(selection, selection)

    splitFocusBlockIndexRef.current = null
    splitFocusListIndexRef.current = null
    splitFocusSelectionRef.current = 0
  }, [parsed.blocks])

  const closeCommand = useCallback(() => {
    setCommandState(null)
    setCommandQuery("")
    setSelectedCommandIndex(0)
  }, [])

  const writeBlocks = useCallback(
    (blocks: ArticleBlock[], options: { closeCommand?: boolean } = {}) => {
      onChange(serializeArticleContent(blocks))
      if (options.closeCommand ?? true) closeCommand()
    },
    [closeCommand, onChange],
  )

  const getContextText = useCallback(
    (blockIndex: number, field: EditorField, listIndex?: number) => {
      const block = parsed.blocks[blockIndex]
      if (!block) return null

      if (listIndex !== undefined) {
        if (listIndex >= 0 && (block.kind === "bulletList" || block.kind === "orderedList")) return block.items[listIndex] ?? ""
        return null
      }

      if (field === "paragraph" && block.kind === "paragraph") return block.text
      if (field === "heading" && block.kind === "heading") return block.text
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
        if (block.kind !== "bulletList" && block.kind !== "orderedList") return

        const items = [...block.items]
        items[listIndex] = next
        nextBlocks[blockIndex] = { ...block, items }
        writeBlocks(nextBlocks, { closeCommand: false })
        return
      }

      if (block.kind === "paragraph") nextBlocks[blockIndex] = { ...block, text: normalizeParagraphText(next) }
      else if (block.kind === "heading") nextBlocks[blockIndex] = { ...block, text: next }
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

      if (selection < commandState.triggerIndex + 1) {
        closeCommand()
        return
      }

      if (text[commandState.triggerIndex] !== "/") {
        closeCommand()
        return
      }

      const between = text.slice(commandState.triggerIndex + 1, selection)
      if (between.includes("\n")) {
        closeCommand()
        return
      }

      setCommandState({ ...commandState, selectionEnd: selection })
      setCommandQuery(between)
      setSelectedCommandIndex(0)
    },
    [closeCommand, commandState],
  )

  const computeMenuPosition = useCallback((target: HTMLTextAreaElement, cursor: number) => {
    const rect = target.getBoundingClientRect()
    const before = target.value.slice(0, cursor)
    const lineStart = before.lastIndexOf("\n")
    const lineIndex = before.split("\n").length - 1
    const lineHeight = Number.parseFloat(getComputedStyle(target).lineHeight || "22") || 22
    const lineOffset = before.length - (lineStart === -1 ? 0 : lineStart + 1)
    const offsetX = Math.max(0, Math.min(lineOffset * 8, Math.max(rect.width - 250, 20)))

    setMenuPosition({
      top: Math.round(rect.top + lineIndex * lineHeight + lineHeight + 4),
      left: Math.round(rect.left + offsetX),
    })
  }, [])

  const openCommand = useCallback(
    (blockIndex: number, field: EditorField, listIndex: number | undefined, cursor: number, textarea: HTMLTextAreaElement) => {
      setCommandState({
        blockIndex,
        field,
        listIndex,
        triggerIndex: cursor,
        selectionEnd: cursor,
      })
      setCommandQuery("")
      setSelectedCommandIndex(0)
      computeMenuPosition(textarea, cursor)
    },
    [computeMenuPosition],
  )

  const applyCommand = useCallback(
    (blockIndex: number, field: EditorField, listIndex: number | undefined, command: ArticleEditorCommand) => {
      if (!commandState) {
        closeCommand()
        return
      }

      const contextText = getContextText(blockIndex, field, listIndex)
      if (contextText == null) {
        closeCommand()
        return
      }

      if (command.mode === "inline") {
        const inlineText = `${contextText.slice(0, commandState.triggerIndex)}${command.inlineInsert ?? ""}${contextText.slice(commandState.selectionEnd)}`
        writeContextText(blockIndex, listIndex, inlineText)
        closeCommand()
        return
      }

      const lineStart = getLineStart(contextText, commandState.triggerIndex)
      const lineEnd = getLineEnd(contextText, commandState.selectionEnd)
      const lineSegment = contextText.slice(lineStart, lineEnd)
      const payload = `${lineSegment.slice(0, Math.max(0, commandState.triggerIndex - lineStart))}${lineSegment.slice(commandState.selectionEnd - lineStart)}`.trim()

      const transformed = command.applyLine(selectedDisplayIndex)
      const replacementBlock: ArticleBlock = (() => {
        if (transformed.kind === "heading") return { ...transformed, text: payload || transformed.text }

        if (transformed.kind === "quote") return { ...transformed, lines: [payload || transformed.lines[0] || "Quoted text"] }

        if (transformed.kind === "bulletList" || transformed.kind === "orderedList") return { ...transformed, items: [payload || transformed.items[0] || "Item"] }

        if (transformed.kind === "code") return { ...transformed, language: payload || transformed.language, code: transformed.code || "// Add code" }

        if (transformed.kind === "callout") return { ...transformed, text: payload || transformed.text }

        return transformed
      })()

      const nextBlocks = [...parsed.blocks]
      const before = contextText.slice(0, lineStart).trim()
      const after = contextText.slice(lineEnd).trim()
      const replacement: ArticleBlock[] = []

      if (before) replacement.push({ kind: "paragraph", text: before })
      replacement.push(replacementBlock)
      if (!after && !articleBlockCanReceiveTextFocus(replacementBlock)) replacement.push({ kind: "paragraph", text: EMPTY_PARAGRAPH_TEXT })
      if (after) replacement.push({ kind: "paragraph", text: after })

      if (listIndex !== undefined) {
        const block = nextBlocks[blockIndex]
        if (block?.kind !== "bulletList" && block?.kind !== "orderedList") {
          closeCommand()
          return
        }

        const beforeItems = block.items.slice(0, listIndex).filter(item => item.trim())
        const afterItems = block.items.slice(listIndex + 1).filter(item => item.trim())
        const listReplacement: ArticleBlock[] = []
        if (beforeItems.length) listReplacement.push({ ...block, items: beforeItems })
        listReplacement.push(replacementBlock)
        if (!afterItems.length && !articleBlockCanReceiveTextFocus(replacementBlock)) listReplacement.push({ kind: "paragraph", text: EMPTY_PARAGRAPH_TEXT })
        if (afterItems.length) listReplacement.push({ ...block, items: afterItems })
        nextBlocks.splice(blockIndex, 1, ...listReplacement)
        splitFocusBlockIndexRef.current = blockIndex + (beforeItems.length ? 1 : 0) + (articleBlockCanReceiveTextFocus(replacementBlock) ? 0 : 1)
        splitFocusListIndexRef.current = replacementBlock.kind === "bulletList" || replacementBlock.kind === "orderedList" ? 0 : null
      } else {
        nextBlocks.splice(blockIndex, 1, ...replacement)
        splitFocusBlockIndexRef.current = blockIndex + (before ? 1 : 0) + (articleBlockCanReceiveTextFocus(replacementBlock) ? 0 : 1)
        splitFocusListIndexRef.current = replacementBlock.kind === "bulletList" || replacementBlock.kind === "orderedList" ? 0 : null
      }

      splitFocusSelectionRef.current =
        replacementBlock.kind === "heading"
          ? replacementBlock.text.length
          : replacementBlock.kind === "paragraph"
            ? replacementBlock.text.length
            : replacementBlock.kind === "quote"
              ? replacementBlock.lines.join("\n").length
              : replacementBlock.kind === "callout"
                ? replacementBlock.text.length
                : replacementBlock.kind === "code"
                  ? replacementBlock.code.length
                  : replacementBlock.kind === "bulletList" || replacementBlock.kind === "orderedList"
                    ? (replacementBlock.items[0]?.length ?? 0)
                    : 0
      writeBlocks(nextBlocks)
    },
    [closeCommand, commandState, getContextText, parsed.blocks, selectedDisplayIndex, writeBlocks, writeContextText],
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
      const block = parsed.blocks[blockIndex]
      const value = event.currentTarget.value
      const selection = event.currentTarget.selectionStart ?? 0
      const isBackspace = event.key === "Backspace"

      if (commandState && commandState.blockIndex === blockIndex && commandState.field === field && commandState.listIndex === listIndex) {
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

        if (event.key === "ArrowDown") {
          event.preventDefault()
          setSelectedCommandIndex(current => Math.min(current + 1, commandItems.length - 1))
          return
        }

        if (event.key === "ArrowUp") {
          event.preventDefault()
          setSelectedCommandIndex(current => Math.max(current - 1, 0))
          return
        }
      }

      if (event.key === "/") {
        openCommand(blockIndex, field, listIndex, selection, event.currentTarget)
        return
      }

      if (isBackspace) {
        if (listIndex !== undefined && (block?.kind === "bulletList" || block?.kind === "orderedList") && value.trim() === "") {
          event.preventDefault()

          const nextBlocks = [...parsed.blocks]
          const remainingItems = block.items.filter((_, itemIndex) => itemIndex !== listIndex)

          if (remainingItems.length) {
            nextBlocks[blockIndex] = { ...block, items: remainingItems }
            splitFocusBlockIndexRef.current = blockIndex
            splitFocusListIndexRef.current = Math.max(0, listIndex - 1)
            splitFocusSelectionRef.current = Number.MAX_SAFE_INTEGER
          } else {
            nextBlocks.splice(blockIndex, 1, { kind: "paragraph", text: EMPTY_PARAGRAPH_TEXT })
            splitFocusBlockIndexRef.current = blockIndex
            splitFocusListIndexRef.current = null
            splitFocusSelectionRef.current = 0
          }

          writeBlocks(nextBlocks)
          return
        }

        const isEmptyParagraph = block?.kind === "paragraph" && value.trim() === ""
        const isEmptyHeading = block?.kind === "heading" && value.trim() === ""
        const isEmptyQuote = block?.kind === "quote" && value.trim() === ""
        const isEmptyCallout = block?.kind === "callout" && value.trim() === ""
        const isEmptyCode = block?.kind === "code" && value.trim() === ""
        const isEmptyImage = block?.kind === "image" && block.alt.trim() === "" && block.url.trim() === ""
        const isEmptyList = (block?.kind === "bulletList" || block?.kind === "orderedList") && block.items.every(item => item.trim() === "")
        const isEmpty = listIndex == null && (isEmptyParagraph || isEmptyHeading || isEmptyQuote || isEmptyCallout || isEmptyCode || isEmptyImage || isEmptyList)

        if (isEmpty && blockIndex > 0) {
          event.preventDefault()

          const nextBlocks = [...parsed.blocks]
          nextBlocks.splice(blockIndex, 1)

          let focusIndex = blockIndex - 1
          while (focusIndex >= 0 && (nextBlocks[focusIndex]?.kind === "divider" || nextBlocks[focusIndex]?.kind === "toc" || nextBlocks[focusIndex]?.kind === "display"))
            focusIndex -= 1

          if (focusIndex >= 0) {
            splitFocusBlockIndexRef.current = focusIndex
            splitFocusListIndexRef.current = null
            splitFocusSelectionRef.current = Number.MAX_SAFE_INTEGER
          }

          writeBlocks(nextBlocks)
          return
        }
      }

      const isEnter = event.key === "Enter" || event.key === "NumpadEnter"
      if (isEnter && field === "heading" && block?.kind === "heading") {
        event.preventDefault()

        const selectionStart = event.currentTarget.selectionStart ?? 0
        const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart
        const beforeText = event.currentTarget.value.slice(0, selectionStart)
        const afterText = normalizeParagraphText(event.currentTarget.value.slice(selectionEnd))
        const nextBlocks = [...parsed.blocks]

        nextBlocks.splice(blockIndex, 1, { ...block, text: beforeText || block.text }, { kind: "paragraph", text: afterText })

        splitFocusBlockIndexRef.current = blockIndex + 1
        splitFocusListIndexRef.current = null
        splitFocusSelectionRef.current = 0
        writeBlocks(nextBlocks)
        return
      }

      if (isEnter && field === "paragraph" && block?.kind === "paragraph") {
        event.preventDefault()

        const selectionStart = event.currentTarget.selectionStart ?? 0
        const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart
        const beforeText = normalizeParagraphText(event.currentTarget.value.slice(0, selectionStart))
        const afterText = normalizeParagraphText(event.currentTarget.value.slice(selectionEnd))

        const nextBlocks = [...parsed.blocks]
        nextBlocks.splice(blockIndex, 1, { ...block, text: beforeText }, { kind: "paragraph", text: afterText })

        splitFocusBlockIndexRef.current = blockIndex + 1
        splitFocusListIndexRef.current = null
        splitFocusSelectionRef.current = 0
        writeBlocks(nextBlocks)
        return
      }

      if (isEnter && field === "list-item" && listIndex !== undefined && (block?.kind === "bulletList" || block?.kind === "orderedList")) {
        event.preventDefault()

        const selectionStart = event.currentTarget.selectionStart ?? 0
        const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart
        const currentItem = block.items[listIndex] ?? ""
        const beforeText = currentItem.slice(0, selectionStart)
        const afterText = currentItem.slice(selectionEnd)
        const nextBlocks = [...parsed.blocks]

        if (currentItem.trim() === "") {
          const remainingItems = block.items.filter((_, itemIndex) => itemIndex !== listIndex)
          const replacement: ArticleBlock[] = []
          if (remainingItems.length) replacement.push({ ...block, items: remainingItems })
          replacement.push({ kind: "paragraph", text: EMPTY_PARAGRAPH_TEXT })
          nextBlocks.splice(blockIndex, 1, ...replacement)

          splitFocusBlockIndexRef.current = blockIndex + (remainingItems.length ? 1 : 0)
          splitFocusListIndexRef.current = null
          splitFocusSelectionRef.current = 0
          writeBlocks(nextBlocks)
          return
        }

        const items = [...block.items]
        items.splice(listIndex, 1, beforeText, afterText)
        nextBlocks[blockIndex] = { ...block, items }
        splitFocusBlockIndexRef.current = blockIndex
        splitFocusListIndexRef.current = listIndex + 1
        splitFocusSelectionRef.current = 0
        writeBlocks(nextBlocks)
        return
      }

      if (event.key === " ") {
        if (field !== "paragraph" || block?.kind !== "paragraph") return

        const start = getLineStart(value, selection)
        const end = getLineEnd(value, selection)
        const lineText = value.slice(start, selection).trim()
        const headingMatch = lineText.match(/^(#{1,4})$/)
        const isQuote = lineText === ">"
        const isBullet = lineText === "-"
        const isOrdered = lineText === "1."
        const isDivider = lineText === "---"
        const isCode = lineText === "```"

        if (!headingMatch && !isQuote && !isBullet && !isOrdered && !isDivider && !isCode) return

        event.preventDefault()

        const payload = value.slice(selection).trim()
        const beforeText = value.slice(0, start).trim()
        const afterText = value.slice(end).trim()
        const replacement: ArticleBlock[] = []
        if (beforeText) replacement.push({ kind: "paragraph", text: beforeText })

        if (headingMatch)
          replacement.push({
            kind: "heading",
            id: cryptoId(),
            level: Math.min(4, headingMatch[1].length) as 1 | 2 | 3 | 4,
            text: payload,
          })
        else if (isQuote) replacement.push({ kind: "quote", lines: [payload || "Quoted text"] })
        else if (isBullet) replacement.push({ kind: "bulletList", items: [payload || "Item"] })
        else if (isOrdered) replacement.push({ kind: "orderedList", items: [payload || "Item"] })
        else if (isDivider) replacement.push({ kind: "divider" })
        else replacement.push({ kind: "code", language: payload || "typescript", code: "// Add code" })

        if (afterText) replacement.push({ kind: "paragraph", text: afterText })

        const nextBlocks = [...parsed.blocks]
        nextBlocks.splice(blockIndex, 1, ...replacement)

        splitFocusBlockIndexRef.current = blockIndex
        splitFocusSelectionRef.current = payload.length
        writeBlocks(nextBlocks)
      }
    },
    [applyCommand, boundedSelectedCommandIndex, closeCommand, commandItems, commandState, openCommand, parsed.blocks, writeBlocks],
  )

  const updateImageField = useCallback(
    (blockIndex: number, patch: Partial<Extract<ArticleBlock, { kind: "image" }>>) => {
      const nextBlocks = [...parsed.blocks]
      const current = nextBlocks[blockIndex]
      if (!current || current.kind !== "image") return

      nextBlocks[blockIndex] = { ...current, ...patch }
      writeBlocks(nextBlocks)
    },
    [parsed.blocks, writeBlocks],
  )

  const updateCalloutTone = useCallback(
    (blockIndex: number, tone: "note" | "tip" | "warning") => {
      const nextBlocks = [...parsed.blocks]
      const current = nextBlocks[blockIndex]
      if (!current || current.kind !== "callout") return

      nextBlocks[blockIndex] = { ...current, tone }
      writeBlocks(nextBlocks)
    },
    [parsed.blocks, writeBlocks],
  )

  const addListItem = useCallback(
    (blockIndex: number) => {
      const nextBlocks = [...parsed.blocks]
      const block = nextBlocks[blockIndex]
      if (!block || (block.kind !== "bulletList" && block.kind !== "orderedList")) return

      nextBlocks[blockIndex] = { ...block, items: [...block.items, "Item"] }
      writeBlocks(nextBlocks)
    },
    [parsed.blocks, writeBlocks],
  )

  const removeListItem = useCallback(
    (blockIndex: number, listIndex: number) => {
      const nextBlocks = [...parsed.blocks]
      const block = nextBlocks[blockIndex]
      if (!block || (block.kind !== "bulletList" && block.kind !== "orderedList")) return

      const items = block.items.filter((_, index) => index !== listIndex)
      nextBlocks[blockIndex] = {
        ...block,
        items: items.length === 0 ? ["Item"] : items,
      }
      writeBlocks(nextBlocks)
    },
    [parsed.blocks, writeBlocks],
  )

  const selectedDisplayValue = `${selectedDisplayIndex + 1}`

  const renderBlock = (block: ArticleBlock, blockIndex: number) => {
    if (block.kind === "paragraph")
      return (
        <Stack key={blockIndex} gap="xs" className={styles.articleBlock}>
          <InlineLinkTextarea
            className={cx(styles.blockInput, styles.blockInputParagraph)}
            value={denormalizeParagraphText(block.text)}
            data-block-index={blockIndex}
            data-editor-field="paragraph"
            placeholder="Start typing"
            onChange={event => onInputChange(blockIndex, "paragraph", undefined, event)}
            onKeyDown={event => onInputKeyDown(blockIndex, "paragraph", undefined, event)}
          />
        </Stack>
      )

    if (block.kind === "heading") {
      const headingClass = block.level === 1 ? styles["heading-1"] : block.level === 2 ? styles["heading-2"] : block.level === 3 ? styles["heading-3"] : styles["heading-4"]
      return (
        <Stack key={blockIndex} gap="xs" className={styles.articleBlock}>
          <InlineLinkTextarea
            className={cx(styles.blockInput, styles.blockInputHeading, headingClass)}
            data-block-index={blockIndex}
            value={block.text}
            aria-label={`Heading ${block.level}`}
            onChange={event => onInputChange(blockIndex, "heading", undefined, event)}
            onKeyDown={event => onInputKeyDown(blockIndex, "heading", undefined, event)}
          />
        </Stack>
      )
    }

    if (block.kind === "quote")
      return (
        <Stack key={blockIndex} gap="xs" className={styles.articleBlock}>
          <InlineLinkTextarea
            className={cx(styles.blockInput, styles.blockInputQuote)}
            data-block-index={blockIndex}
            value={block.lines.join("\n")}
            placeholder="Quote text"
            onChange={event => onInputChange(blockIndex, "quote", undefined, event)}
            onKeyDown={event => onInputKeyDown(blockIndex, "quote", undefined, event)}
          />
        </Stack>
      )

    if (block.kind === "callout")
      return (
        <Stack key={blockIndex} gap="xs" className={cx(styles.articleBlock, styles.calloutBlock)}>
          <Stack className={styles.blockLabelRow} direction="horizontal" gap="sm">
            <Pill>{block.tone}</Pill>
            <Button variant="ghost" onClick={() => updateCalloutTone(blockIndex, "note")}>
              Note
            </Button>
            <Button variant="ghost" onClick={() => updateCalloutTone(blockIndex, "tip")}>
              Tip
            </Button>
            <Button variant="ghost" onClick={() => updateCalloutTone(blockIndex, "warning")}>
              Warning
            </Button>
          </Stack>
          <InlineLinkTextarea
            className={cx(styles.blockInput, styles.blockInputCallout)}
            data-block-index={blockIndex}
            value={block.text}
            onChange={event => onInputChange(blockIndex, "callout", undefined, event)}
            onKeyDown={event => onInputKeyDown(blockIndex, "callout", undefined, event)}
          />
        </Stack>
      )

    if (block.kind === "code")
      return (
        <Stack key={blockIndex} gap="xs" className={cx(styles.articleBlock, styles.codeBlock)}>
          <Text tone="muted" size="small">{`Code block (${block.language})`}</Text>
          <BlockTextarea
            className={cx(styles.blockInput, styles.blockInputCode)}
            data-block-index={blockIndex}
            value={block.code}
            placeholder="Enter code"
            onChange={event => onInputChange(blockIndex, "code", undefined, event)}
            onKeyDown={event => onInputKeyDown(blockIndex, "code", undefined, event)}
          />
        </Stack>
      )

    if (block.kind === "bulletList" || block.kind === "orderedList")
      return (
        <Stack key={blockIndex} gap="xs" className={styles.articleBlock}>
          <Stack gap="xs">
            {block.items.map((item, itemIndex) => (
              <Stack key={`${blockIndex}-${itemIndex}`} className={styles.listRow} direction="horizontal" gap="sm">
                <Text size="small">{block.kind === "bulletList" ? "•" : `${itemIndex + 1}.`}</Text>
                <InlineLinkTextarea
                  className={cx(styles.blockInput, block.kind === "orderedList" ? styles.blockInputOrderedList : styles.blockInputBulletList)}
                  data-block-index={blockIndex}
                  data-list-index={itemIndex}
                  value={item}
                  onChange={event => onInputChange(blockIndex, "list-item", itemIndex, event)}
                  onKeyDown={event => onInputKeyDown(blockIndex, "list-item", itemIndex, event)}
                />
                <Button variant="ghost" onClick={() => removeListItem(blockIndex, itemIndex)}>
                  Remove
                </Button>
              </Stack>
            ))}
          </Stack>
          <Stack className={styles.blockActions} direction="horizontal" gap="sm">
            <Button variant="ghost" onClick={() => addListItem(blockIndex)}>
              Add item
            </Button>
          </Stack>
        </Stack>
      )

    if (block.kind === "divider")
      return (
        <Stack key={blockIndex} className={styles.articleBlock}>
          <Divider />
        </Stack>
      )

    if (block.kind === "image")
      return (
        <Stack key={blockIndex} gap="xs" className={styles.articleBlock}>
          <Text tone="muted" size="small">
            Image block
          </Text>
          <BlockTextarea
            className={cx(styles.blockInput, styles.blockInputImage)}
            data-block-index={blockIndex}
            value={block.alt}
            placeholder="Image alt"
            onChange={event => updateImageField(blockIndex, { alt: event.target.value })}
            onKeyDown={event => onInputKeyDown(blockIndex, "paragraph", undefined, event)}
          />
          <BlockTextarea
            className={cx(styles.blockInput, styles.blockInputImage)}
            data-block-index={blockIndex}
            value={block.url}
            placeholder="Image url"
            onChange={event => updateImageField(blockIndex, { url: event.target.value })}
            onKeyDown={event => onInputKeyDown(blockIndex, "paragraph", undefined, event)}
          />
        </Stack>
      )

    if (block.kind === "toc")
      return (
        <Stack key={blockIndex} className={styles.articleBlock}>
          <Text className={styles.tocPlaceholder}>{"{{toc}}"}</Text>
        </Stack>
      )

    if (block.kind === "display") {
      const display = displays[block.displayIndex]
      return (
        <Stack key={blockIndex} gap="xs" className={styles.articleBlock}>
          {display ? (
            <Stack className={styles.displayBlock} gap="sm">
              {renderDisplay?.(display, block.displayIndex)}
            </Stack>
          ) : (
            <Text size="small">{"{{display:" + String(block.displayIndex + 1) + "}"}</Text>
          )}
        </Stack>
      )
    }

    return null
  }

  return (
    <Stack className={styles.articleEditor} gap="sm" ref={editorRef}>
      <Stack className={styles.articleHeader} direction="horizontal" gap="sm">
        <SelectField label="Display" value={selectedDisplayValue} options={displayOptions} disabled={displays.length === 0} onValueChange={onChangeSelectedDisplay} />
      </Stack>

      <Stack className={styles.blockList} gap="xs">
        <AnimatePresence mode="popLayout">
          {parsed.blocks.map((block, blockIndex) => (
            <motion.div
              key={blockIndex}
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 210, damping: 24 }}
              layout
            >
              <Stack gap="sm">{renderBlock(block, blockIndex)}</Stack>
            </motion.div>
          ))}
        </AnimatePresence>
      </Stack>

      {commandState ? (
        <Card className={styles.commandMenu} ref={commandRef} style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}>
          <Stack gap="sm">
            <Text tone="strong" size="small">
              Insert command
            </Text>
            <Stack className={styles.commandList} gap="xs">
              {commandItems.length === 0 ? (
                <Text size="small">No matching command</Text>
              ) : (
                commandItems.map((command, index) => {
                  const isActive = index === boundedSelectedCommandIndex
                  return (
                    <Button
                      key={command.id}
                      variant="ghost"
                      className={cx(styles.commandButton, isActive && styles.commandButtonActive)}
                      onMouseDown={event => {
                        event.preventDefault()
                        applyCommand(commandState.blockIndex, commandState.field, commandState.listIndex, command)
                      }}
                    >
                      <Text tone={isActive ? "strong" : "muted"}>{command.label}</Text>
                      <Text size="small">{command.description}</Text>
                    </Button>
                  )
                })
              )}
            </Stack>
            <Button variant="ghost" onClick={closeCommand}>
              Dismiss
            </Button>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  )
}
