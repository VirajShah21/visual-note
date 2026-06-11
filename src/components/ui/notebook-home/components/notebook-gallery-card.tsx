import Link from "next/link"
import { motion } from "motion/react"
import { MoreHorizontal } from "lucide-react"
import { Heading, Stack, Text } from "../../primitives"
import { NotebookStat } from "./notebook-stat"
import { NotebookWebsitePreview } from "./notebook-website-preview"
import { NotebookGalleryCardProps } from "../types/notebook-home.types"
import styles from "../../notebook-home.module.css"

export function NotebookGalleryCard({ notebook, index }: NotebookGalleryCardProps) {
    return (
        <motion.article
            className={styles.card}
            initial={{ opacity: 0, y: 18, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 170, damping: 22, delay: index * 0.04 }}
        >
            <Link className={styles.cardLink} href={notebook.href} aria-label={`Open ${notebook.title}`}>
                <NotebookWebsitePreview notebook={notebook} />
                <Stack className={styles.cardBody} gap="sm">
                    <Stack className={styles.cardTitleRow} direction="horizontal" gap="sm">
                        <Stack gap="xs">
                            <Heading size="md">{notebook.title}</Heading>
                            <Text size="small">{notebook.updatedLabel}</Text>
                        </Stack>
                        <MoreHorizontal size={18} />
                    </Stack>
                    <Text>{notebook.summary}</Text>
                    <Stack className={styles.statRow} direction="horizontal" gap="xs">
                        <NotebookStat label="Pages" value={notebook.pageCount} />
                        <NotebookStat label="Topics" value={notebook.topicCount} />
                        <NotebookStat label="Views" value={notebook.viewCount} />
                        <NotebookStat label="Data" value={notebook.displayCount} />
                    </Stack>
                </Stack>
            </Link>
        </motion.article>
    )
}
