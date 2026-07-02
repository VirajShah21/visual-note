"use client"

import { Plus } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Stack } from "@ui/primitives"
import { Button } from "@ui/button"
import { ModalDialog } from "@ui/overlays"
import { NotebookGallery, NotebookHomeContent, NotebookHomeShell, NotebookMcpSetup, NotebookNavigationRail, NotebookTitleField, NotebookTopBar } from "./components"
import type { NotebookHomeProps, NotebookHomeView } from "./types/notebook-home.types"

export function NotebookHome({ mcpTokensEnabled, userLabel, storageLabel, notebooks, onCreateNotebook, onSignOut }: NotebookHomeProps) {
    const [query, setQuery] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [title, setTitle] = useState("New web notebook")
    const [activeView, setActiveView] = useState<NotebookHomeView>("notebooks")

    const filteredNotebooks = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        if (!normalizedQuery) return notebooks

        return notebooks.filter(notebook =>
            [notebook.title, notebook.summary, ...notebook.pageTitles, ...notebook.topicTitles].some(value => value.toLowerCase().includes(normalizedQuery)),
        )
    }, [notebooks, query])

    const createNotebook = useCallback(() => {
        if (!onCreateNotebook(title)) return

        setTitle("New web notebook")
        setIsCreateOpen(false)
    }, [onCreateNotebook, title])
    const openCreateDialog = useCallback(() => setIsCreateOpen(true), [])

    return (
        <NotebookHomeShell>
            <NotebookNavigationRail activeView={activeView} userLabel={userLabel} storageLabel={storageLabel} onViewChange={setActiveView} onSignOut={onSignOut} />
            <NotebookHomeContent>
                {activeView === "mcp" ? (
                    <NotebookMcpSetup tokensEnabled={mcpTokensEnabled} />
                ) : (
                    <>
                        <NotebookTopBar query={query} onQueryChange={setQuery} onCreate={openCreateDialog} />
                        <NotebookGallery notebooks={filteredNotebooks} />
                    </>
                )}
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
