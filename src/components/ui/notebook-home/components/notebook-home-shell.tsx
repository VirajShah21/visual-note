import { motion } from "motion/react"
import type { ReactNode } from "react"
import styles from "../../notebook-home.module.css"

type NotebookHomeShellProps = {
    children: ReactNode
}

export function NotebookHomeShell({ children }: NotebookHomeShellProps) {
    return <motion.div className={styles.shell}>{children}</motion.div>
}
