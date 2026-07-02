import { motion } from "motion/react"
import { Heading, Text } from "@ui/primitives"
import { NotebookGalleryCard } from "./notebook-gallery-card"
import { NotebookGalleryProps } from "@ui/notebook-home/types/notebook-home.types"
import styles from "../../notebook-home.module.css"

export function NotebookGallery({ notebooks }: NotebookGalleryProps) {
    if (notebooks.length === 0)
        return (
            <motion.div className={styles.emptyGallery}>
                <Heading size="md">No notebooks found</Heading>
                <Text>Try a different search or create a new notebook.</Text>
            </motion.div>
        )

    return (
        <motion.div className={styles.gallery}>
            {notebooks.map((notebook, index) => (
                <NotebookGalleryCard key={notebook.id} notebook={notebook} index={index} />
            ))}
        </motion.div>
    )
}
