"use client"

import { Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { Stack } from "../primitives"
import { Button } from "../button"
import { ModalDialog } from "../overlays"
import { NotebookGallery, NotebookHomeContent, NotebookHomeShell, NotebookNavigationRail, NotebookTitleField, NotebookTopBar } from "./components"
import type { NotebookHomeProps } from "./types/notebook-home.types"

export function NotebookHome({ userLabel, storageLabel, notebooks, onCreateNotebook, onSignOut }: NotebookHomeProps) {
    const [query, setQuery] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [title, setTitle] = useState("New web notebook")

    const filteredNotebooks = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        if (!normalizedQuery) return notebooks

        return notebooks.filter(notebook =>
            [notebook.title, notebook.summary, ...notebook.pageTitles, ...notebook.topicTitles].some(value => value.toLowerCase().includes(normalizedQuery)),
        )
    }, [notebooks, query])

    const createNotebook = () => {
        if (!onCreateNotebook(title)) return

        setTitle("New web notebook")
        setIsCreateOpen(false)
    }

    return (
        <NotebookHomeShell>
            <NotebookNavigationRail userLabel={userLabel} storageLabel={storageLabel} onSignOut={onSignOut} />
            <NotebookHomeContent>
                <NotebookTopBar query={query} onQueryChange={setQuery} onCreate={() => setIsCreateOpen(true)} />
                <NotebookGallery notebooks={filteredNotebooks} />
            </NotebookHomeContent>
            <ModalDialog open={isCreateOpen} title="Create notebook" description="Start a structured notebook website." onOpenChange={setIsCreateOpen}>
                <Stack gap="md">
                    <NotebookTitleField value={title} onChange={setTitle} />
                    <Button icon={<Plus size={15} />} variant="primary" onClick={createNotebook} fullWidth>
                        Create notebook
                    </Button>
                </Stack>
            </ModalDialog>
        </NotebookHomeShell>
    )
}
