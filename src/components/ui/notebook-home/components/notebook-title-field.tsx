import { Input } from "@base-ui/react/input"
import { motion } from "motion/react"
import styles from "../../notebook-home.module.css"
import type { NotebookTitleFieldProps } from "../types/notebook-home.types"

export function NotebookTitleField({ value, onChange }: NotebookTitleFieldProps) {
    return (
        <motion.label className={styles.titleField}>
            <span className={styles.fieldLabel}>Notebook title</span>
            <Input className={styles.titleInput} value={value} onChange={event => onChange(event.target.value)} />
        </motion.label>
    )
}
