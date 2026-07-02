"use client"

import { type FocusEvent, type KeyboardEvent, type MouseEvent, useCallback, useReducer, type ReactNode } from "react"
import Image from "next/image"
import { cx } from "@ui/class-name"
import styles from "../../article-editor.module.css"
import { BlockTextarea, type BlockTextareaProps } from "./block-textarea"

const markdownInlineMediaPattern = /(!?)\[([^\]\n]*)]\(([^)\s]+)\)/g

const hasMarkdownInlineMedia = (text: string) => {
    markdownInlineMediaPattern.lastIndex = 0
    return markdownInlineMediaPattern.test(text)
}

const safeInlineUrl = (href: string) => {
    if (/^(https?:|mailto:|tel:|data:image\/|blob:)/i.test(href) || href.startsWith("/")) return href

    return `https://${href}`
}

const renderInlineMedia = (text: string) => {
    const parts: ReactNode[] = []
    let cursor = 0
    let match: RegExpExecArray | null
    markdownInlineMediaPattern.lastIndex = 0

    while ((match = markdownInlineMediaPattern.exec(text)) !== null) {
        const matchStart = match.index
        const matchEnd = markdownInlineMediaPattern.lastIndex
        if (matchStart > cursor) parts.push(text.slice(cursor, matchStart))

        const isImage = match[1] === "!"
        const label = match[2]
        const href = safeInlineUrl(match[3])
        if (isImage) parts.push(<Image key={`${matchStart}-${href}`} className={styles.inlineImage} src={href} alt={label} width={800} height={450} sizes="100vw" unoptimized />)
        else
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

export function ReadableInlineContent({ text }: { text: string }) {
    return <>{renderInlineMedia(text)}</>
}

export function InlineLinkTextarea({ value, className, ...props }: BlockTextareaProps) {
    const [isEditing, setIsEditing] = useReducer((_: boolean, next: boolean) => next, false)
    const shouldDisplayLinks = !isEditing && hasMarkdownInlineMedia(value)
    const startEditing = useCallback(() => setIsEditing(true), [])
    const stopEditing = useCallback(() => setIsEditing(false), [])
    const handleDisplayClick = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            const target = event.target as HTMLElement
            if (target.closest("a")) return

            startEditing()
        },
        [startEditing],
    )
    const handleDisplayKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== "Enter" && event.key !== " ") return

            event.preventDefault()
            startEditing()
        },
        [startEditing],
    )
    const handleFocus = useCallback(
        (event: FocusEvent<HTMLTextAreaElement>) => {
            props.onFocus?.(event)
            if (isEditing) {
                const selection = event.currentTarget.value.length
                event.currentTarget.setSelectionRange(selection, selection)
            }
            startEditing()
        },
        [isEditing, props, startEditing],
    )
    const handleBlur = useCallback(
        (event: FocusEvent<HTMLTextAreaElement>) => {
            props.onBlur?.(event)
            stopEditing()
        },
        [props, stopEditing],
    )

    if (shouldDisplayLinks)
        return (
            <div
                className={cx(className, styles.blockDisplay)}
                role="textbox"
                tabIndex={0}
                aria-label={props["aria-label"]}
                onClick={handleDisplayClick}
                onKeyDown={handleDisplayKeyDown}
            >
                {renderInlineMedia(value)}
            </div>
        )

    return <BlockTextarea {...props} value={value} className={className} autoFocus={isEditing} onFocus={handleFocus} onBlur={handleBlur} />
}
