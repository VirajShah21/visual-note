"use client"

import { Button as BaseButton } from "@base-ui/react/button"
import { Popover } from "@base-ui/react/popover"
import { BookOpenText, Home } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import styles from "./notebook-switcher.module.css"

export type NotebookEditorRecentNotebook = {
    id: string
    title: string
    summary: string
    color: string
    updatedLabel: string
    createdAt?: string
}

export type NotebookSwitcherProps = {
    currentNotebookId?: string
    notebookTitle?: string
    onHomeSelect: () => void
    onNotebookSelect: (notebookId: string) => void
    recentNotebooks?: NotebookEditorRecentNotebook[]
}

export function NotebookSwitcher({ currentNotebookId = "", notebookTitle = "Visual Note", onHomeSelect, onNotebookSelect, recentNotebooks = [] }: NotebookSwitcherProps) {
    const [isNotebookSwitcherOpen, setIsNotebookSwitcherOpen] = useState(false)
    const switcherNotebooks = useMemo(
        () =>
            [...recentNotebooks]
                .filter(notebook => notebook.id !== currentNotebookId)
                .sort((first, second) => Date.parse(second.createdAt ?? "") - Date.parse(first.createdAt ?? ""))
                .slice(0, 3),
        [currentNotebookId, recentNotebooks],
    )
    const selectHome = useCallback(() => {
        setIsNotebookSwitcherOpen(false)
        onHomeSelect()
    }, [onHomeSelect])
    const selectNotebook = useCallback(
        (notebookId: string) => {
            setIsNotebookSwitcherOpen(false)
            onNotebookSelect(notebookId)
        },
        [onNotebookSelect],
    )

    return (
        <Popover.Root open={isNotebookSwitcherOpen} onOpenChange={setIsNotebookSwitcherOpen}>
            <Popover.Trigger className={styles.brandButton} aria-label="Switch notebook">
                <span className={styles.brandMark}>
                    <BookOpenText size={17} />
                </span>
                <span className={styles.brandText}>
                    <span className={styles.brandName}>Visual Note</span>
                    <span className={styles.notebookTitle}>{notebookTitle}</span>
                </span>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Positioner className={styles.switcherPositioner} side="bottom" align="start" sideOffset={8} collisionPadding={12}>
                    <Popover.Popup className={styles.switcherPopup}>
                        <Popover.Title className={styles.switcherTitle}>Switch notebook</Popover.Title>
                        <BaseButton className={styles.switcherItem} onClick={selectHome}>
                            <span className={styles.switcherIcon}>
                                <Home size={15} />
                            </span>
                            <span className={styles.switcherText}>
                                <span className={styles.switcherName}>Home</span>
                                <span className={styles.switcherMeta}>All notebooks</span>
                            </span>
                        </BaseButton>
                        {switcherNotebooks.map(notebook => (
                            <NotebookSwitcherItem key={notebook.id} notebook={notebook} onSelectNotebook={selectNotebook} />
                        ))}
                    </Popover.Popup>
                </Popover.Positioner>
            </Popover.Portal>
        </Popover.Root>
    )
}

function NotebookSwitcherItem({ notebook, onSelectNotebook }: { notebook: NotebookEditorRecentNotebook; onSelectNotebook: (notebookId: string) => void }) {
    const handleSelect = useCallback(() => onSelectNotebook(notebook.id), [notebook.id, onSelectNotebook])

    return (
        <BaseButton className={styles.switcherItem} onClick={handleSelect}>
            <span className={styles.notebookSwatch} style={{ backgroundColor: notebook.color }} />
            <span className={styles.switcherText}>
                <span className={styles.switcherName}>{notebook.title}</span>
                <span className={styles.switcherMeta}>{notebook.updatedLabel}</span>
            </span>
        </BaseButton>
    )
}
