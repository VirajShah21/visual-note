"use client"

import { useReducer, type ReactNode } from "react"
import { cx } from "../../class-name"
import styles from "../../article-editor.module.css"
import { BlockTextarea, type BlockTextareaProps } from "./block-textarea"

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

export function InlineLinkTextarea({ value, className, ...props }: BlockTextareaProps) {
    const [isEditing, setIsEditing] = useReducer((_: boolean, next: boolean) => next, false)
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
