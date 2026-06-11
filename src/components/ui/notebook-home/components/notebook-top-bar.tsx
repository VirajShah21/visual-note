import { Grid2X2, Plus } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "../../button"
import { Heading, Pill, Stack } from "../../primitives"
import { NotebookSearchField } from "./notebook-search-field"
import styles from "../../notebook-home.module.css"
import type { NotebookTopBarProps } from "../types/notebook-home.types"

export function NotebookTopBar({ query, onQueryChange, onCreate }: NotebookTopBarProps) {
    return (
        <motion.header className={styles.topBar}>
            <Stack gap="xs">
                <Heading as="h1" size="hero">
                    Notebooks
                </Heading>
                <Stack className={styles.statRow} direction="horizontal" gap="sm">
                    <Pill>
                        <Grid2X2 size={13} />
                        Gallery
                    </Pill>
                </Stack>
            </Stack>
            <Stack className={styles.topActions} direction="horizontal" gap="sm">
                <NotebookSearchField value={query} onChange={onQueryChange} />
                <Button icon={<Plus size={15} />} variant="primary" onClick={onCreate}>
                    New notebook
                </Button>
            </Stack>
        </motion.header>
    )
}
