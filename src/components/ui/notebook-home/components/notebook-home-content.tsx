import { motion } from "motion/react"
import type { ReactNode } from "react"
import styles from "../../notebook-home.module.css"

type NotebookHomeContentProps = {
    children: ReactNode
}

export function NotebookHomeContent({ children }: NotebookHomeContentProps) {
    return <motion.main className={styles.content}>{children}</motion.main>
}
