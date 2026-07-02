"use client"

import { Button as BaseButton } from "@base-ui/react/button"
import { useCallback } from "react"
import type { ArticleHeadingIndex } from "@/lib/visual-note/article-content"
import { articleHeadingTargetId } from "@ui/article-editor/utils/heading-target"
import styles from "./article-table-of-contents.module.css"

type ArticleTableOfContentsProps = {
    headings: ArticleHeadingIndex[]
    hideTitle?: boolean
}

const focusHeading = (id: string) => {
    const target = document.getElementById(articleHeadingTargetId(id))
    if (!target) return

    target.scrollIntoView({ behavior: "smooth", block: "start" })
    const editable = target.querySelector<HTMLTextAreaElement>("textarea")
    editable?.focus({ preventScroll: true })
}

export function ArticleTableOfContents({ headings, hideTitle = false }: ArticleTableOfContentsProps) {
    if (headings.length === 0) return null

    return (
        <aside className={styles.toc} aria-label="Article table of contents">
            {hideTitle ? null : <p className={styles.title}>Contents</p>}
            <div className={styles.list}>
                {headings.map(heading => (
                    <TableOfContentsItem key={heading.id} heading={heading} />
                ))}
            </div>
        </aside>
    )
}

function TableOfContentsItem({ heading }: { heading: ArticleHeadingIndex }) {
    const handleClick = useCallback(() => focusHeading(heading.id), [heading.id])

    return (
        <BaseButton className={`${styles.item} ${styles[`level${heading.level}`]}`} onClick={handleClick}>
            {heading.title || "Untitled section"}
        </BaseButton>
    )
}
