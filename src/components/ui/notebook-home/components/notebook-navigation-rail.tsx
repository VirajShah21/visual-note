import { BookOpen, Home, LayoutTemplate, LogOut, Share2, Sparkles, TerminalSquare } from "lucide-react"
import { motion } from "motion/react"
import { useCallback } from "react"
import { Stack } from "../../primitives"
import { Button } from "../../button"
import { cx } from "../../class-name"
import { NotebookNavItem } from "./notebook-nav-item"
import styles from "../../notebook-home.module.css"
import type { NotebookNavigationRailProps } from "../types/notebook-home.types"

export function NotebookNavigationRail({ activeView, userLabel, storageLabel, onViewChange, onSignOut }: NotebookNavigationRailProps) {
    const selectNotebooks = useCallback(() => onViewChange("notebooks"), [onViewChange])
    const selectMcp = useCallback(() => onViewChange("mcp"), [onViewChange])

    return (
        <motion.aside className={styles.rail}>
            <Stack gap="lg">
                <Stack gap="sm">
                    <PillContainer label={userLabel} />
                    <span className={styles.navLabel}>{userLabel}</span>
                </Stack>
                <Stack gap="sm">
                    <NotebookNavItem active={activeView === "notebooks"} icon={<Home size={15} />} label="Notebooks" onSelect={selectNotebooks} />
                    <NotebookNavItem active={activeView === "mcp"} icon={<TerminalSquare size={15} />} label="MCP Setup" onSelect={selectMcp} />
                    <NotebookNavItem icon={<BookOpen size={15} />} label="Recent" />
                    <NotebookNavItem icon={<LayoutTemplate size={15} />} label="Templates" />
                    <NotebookNavItem icon={<Share2 size={15} />} label="Shared" />
                </Stack>
            </Stack>
            <Stack gap="sm">
                <span>{storageLabel}</span>
                <Button icon={<LogOut size={15} />} variant="ghost" onClick={onSignOut}>
                    Sign out
                </Button>
            </Stack>
        </motion.aside>
    )
}

function PillContainer({ label }: { label: string }) {
    return (
        <span className={cx(styles.brandPill)}>
            <Sparkles size={14} />
            {label}
        </span>
    )
}
