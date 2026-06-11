"use client"

import type { ArticleHeadingIndex } from "@/lib/visual-note/article-content"
import { articleHeadingTargetId } from "../utils/heading-target"
import styles from "./article-table-of-contents.module.css"

type ArticleTableOfContentsProps = {
    headings: ArticleHeadingIndex[]
}

const focusHeading = (id: string) => {
    const target = document.getElementById(articleHeadingTargetId(id))
    if (!target) return

    target.scrollIntoView({ behavior: "smooth", block: "start" })
    const editable = target.querySelector<HTMLTextAreaElement>("textarea")
    editable?.focus({ preventScroll: true })
}

export function ArticleTableOfContents({ headings }: ArticleTableOfContentsProps) {
    if (headings.length === 0) return null

    return (
        <aside className={styles.toc} aria-label="Article table of contents">
            <p className={styles.title}>Contents</p>
            <div className={styles.list}>
                {headings.map(heading => (
                    <button key={heading.id} type="button" className={`${styles.item} ${styles[`level${heading.level}`]}`} onClick={() => focusHeading(heading.id)}>
                        {heading.title || "Untitled section"}
                    </button>
                ))}
            </div>
        </aside>
    )
}
