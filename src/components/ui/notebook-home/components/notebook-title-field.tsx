import { Input } from "@base-ui/react/input"
import { motion } from "motion/react"
import { type ChangeEvent, useCallback } from "react"
import styles from "../../notebook-home.module.css"
import type { NotebookTitleFieldProps } from "@ui/notebook-home/types/notebook-home.types"

export function NotebookTitleField({ value, onChange }: NotebookTitleFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value), [onChange])

    return (
        <motion.label className={styles.titleField}>
            <span className={styles.fieldLabel}>Notebook title</span>
            <Input className={styles.titleInput} value={value} onChange={handleChange} />
        </motion.label>
    )
}
