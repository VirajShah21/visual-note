import { Search } from "lucide-react"
import { Input } from "@base-ui/react/input"
import { motion } from "motion/react"
import { type ChangeEvent, useCallback } from "react"
import styles from "../../notebook-home.module.css"
import type { NotebookSearchFieldProps } from "../types/notebook-home.types"

export function NotebookSearchField({ value, onChange }: NotebookSearchFieldProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value), [onChange])

    return (
        <motion.label className={styles.searchField}>
            <span className={styles.visuallyHidden}>Search notebooks</span>
            <Search size={16} />
            <Input className={styles.searchInput} placeholder="Search notebooks" value={value} onChange={handleChange} />
        </motion.label>
    )
}
