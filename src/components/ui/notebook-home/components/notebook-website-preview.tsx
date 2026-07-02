import { motion } from "motion/react"
import type { CSSProperties } from "react"
import { NotebookWebsitePreviewProps } from "@ui/notebook-home/types/notebook-home.types"
import styles from "../../notebook-home.module.css"

export function NotebookWebsitePreview({ notebook }: NotebookWebsitePreviewProps) {
    const pageTitles = notebook.pageTitles.length > 0 ? notebook.pageTitles.slice(0, 3) : ["Home"]
    const topicTitles = notebook.topicTitles.length > 0 ? notebook.topicTitles.slice(0, 3) : ["Start"]

    return (
        <motion.div className={styles.preview} style={{ "--notebook-color": notebook.color } as CSSProperties}>
            <motion.div className={styles.browserBar}>
                <span />
                <span />
                <span />
            </motion.div>
            <motion.div className={styles.previewTopNav}>
                {pageTitles.map(page => (
                    <span key={page}>{page}</span>
                ))}
            </motion.div>
            <motion.div className={styles.previewSite}>
                <motion.div className={styles.previewSidebar}>
                    {topicTitles.map(topic => (
                        <span key={topic}>{topic}</span>
                    ))}
                </motion.div>
                <motion.div className={styles.previewCanvas}>
                    <span className={styles.previewHero} />
                    <span className={styles.previewLine} />
                    <span className={styles.previewLineShort} />
                    <motion.div className={styles.previewWidgets}>
                        <span />
                        <span />
                        <span />
                    </motion.div>
                </motion.div>
            </motion.div>
        </motion.div>
    )
}
