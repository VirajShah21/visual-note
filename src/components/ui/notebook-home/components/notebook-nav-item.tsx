import { Button } from "../../button"
import { cx } from "../../class-name"
import type { NotebookNavItemProps } from "../types/notebook-home.types"
import styles from "../../notebook-home.module.css"

export function NotebookNavItem({ active = false, icon, label, onSelect }: NotebookNavItemProps) {
    return (
        <Button className={cx(styles.navItem, active && styles.activeNavItem)} variant="ghost" fullWidth onClick={onSelect} aria-pressed={active}>
            {icon}
            {label}
        </Button>
    )
}
