import { Search } from "lucide-react"
import { Input } from "@base-ui/react/input"
import { motion } from "motion/react"
import styles from "../../notebook-home.module.css"
import type { NotebookSearchFieldProps } from "../types/notebook-home.types"

export function NotebookSearchField({ value, onChange }: NotebookSearchFieldProps) {
    return (
        <motion.label className={styles.searchField}>
            <span className={styles.visuallyHidden}>Search notebooks</span>
            <Search size={16} />
            <Input className={styles.searchInput} placeholder="Search notebooks" value={value} onChange={event => onChange(event.target.value)} />
        </motion.label>
    )
}
