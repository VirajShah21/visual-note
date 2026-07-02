import styles from "../../notebook-home.module.css"
import type { NotebookStatProps } from "@ui/notebook-home/types/notebook-home.types"

export function NotebookStat({ label, value }: NotebookStatProps) {
    return (
        <span className={styles.stat}>
            {value} {label}
        </span>
    )
}
