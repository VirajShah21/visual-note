"use client"

import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useState, type ChangeEvent } from "react"
import { Button } from "./button"
import { Heading, Stack, Text } from "./primitives"
import type { PublishAction, PublishResponse, PublishPreviewPayload } from "@/lib/visual-note/storage-api"
import { emptyNotebookStorageSettings, type NotebookStorageSettingsInput } from "@/lib/visual-note/storage-settings"
import { repairWorkspaceConsistency, runWorkspaceHealthCheck, type WorkspaceHealthCheckPayload } from "@/lib/visual-note/workspace-health-api"
import { loadNotebookStorageSettings, saveNotebookStorageSettings } from "@/lib/visual-note/storage-api"
import { PublishWorkflowSection, StorageSettingsSection, WorkspaceHealthSection } from "./notebook-settings-workspace-sections"
import styles from "./notebook-settings-workspace.module.css"

export type NotebookSettingsWorkspaceProps = {
    notebookId: string
    notebookTitle: string
    notebookPublished: boolean
    notebookPublishedAt?: string
    notebookRevision: string | null
    storageEnabled: boolean
    onPublish: (request: { action: PublishAction; revision?: string; includeHtml?: boolean; includeJson?: boolean }) => Promise<PublishResponse>
    onDone: () => void
}

export function NotebookSettingsWorkspace({
    notebookId,
    notebookTitle,
    notebookPublished,
    notebookPublishedAt,
    notebookRevision,
    storageEnabled,
    onPublish,
    onDone,
}: NotebookSettingsWorkspaceProps) {
    const [settingsState, setSettingsState] = useState<{ notebookId: string; settings: NotebookStorageSettingsInput }>({
        notebookId: "",
        settings: emptyNotebookStorageSettings,
    })
    const [includeHtmlPreview, setIncludeHtmlPreview] = useState(false)
    const [includeJsonPreview, setIncludeJsonPreview] = useState(true)
    const [previewPayload, setPreviewPayload] = useState<PublishPreviewPayload | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [healthCheck, setHealthCheck] = useState<WorkspaceHealthCheckPayload | null>(null)
    const [isHealthLoading, setIsHealthLoading] = useState(false)
    const [isRepairing, setIsRepairing] = useState(false)
    const [healthMessage, setHealthMessage] = useState("")
    const [healthError, setHealthError] = useState("")
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const [publishMessage, setPublishMessage] = useState("")
    const [publishError, setPublishError] = useState("")
    const settings = storageEnabled && settingsState.notebookId === notebookId ? settingsState.settings : emptyNotebookStorageSettings
    const publishStatus = notebookPublished ? `Published${notebookPublishedAt ? ` on ${notebookPublishedAt}` : ""}` : "Draft"

    const refreshHealthCheck = useCallback(
        async (clearMessages = false) => {
            if (!storageEnabled || !notebookId) return
            setIsHealthLoading(true)
            if (clearMessages) {
                setHealthMessage("")
                setHealthError("")
            }

            try {
                const nextHealthCheck = await runWorkspaceHealthCheck()
                setHealthCheck(nextHealthCheck)
            } catch (nextError) {
                setHealthCheck(null)
                setHealthError(nextError instanceof Error ? nextError.message : "Unable to run workspace health check.")
            } finally {
                setIsHealthLoading(false)
            }
        },
        [notebookId, storageEnabled],
    )

    const runRepair = useCallback(async () => {
        if (!storageEnabled || !notebookId || isRepairing) return
        setIsRepairing(true)
        setHealthMessage("")
        setHealthError("")

        try {
            const result = await repairWorkspaceConsistency()
            if (result.repaired) {
                const repairedItems = result.orphanPages.length + result.orphanTopics.length + result.orphanViews.length
                setHealthMessage(`Repaired ${repairedItems} orphaned relation ${repairedItems === 1 ? "item" : "items"}.`)
            } else setHealthMessage("No repair actions were required.")

            await refreshHealthCheck()
        } catch (nextError) {
            setHealthError(nextError instanceof Error ? nextError.message : "Unable to repair workspace consistency.")
        } finally {
            setIsRepairing(false)
        }
    }, [isRepairing, refreshHealthCheck, storageEnabled, notebookId])

    useEffect(() => {
        if (!storageEnabled || !notebookId) return

        let isMounted = true
        void Promise.resolve()
            .then(() => {
                if (!isMounted) return null

                setIsLoading(true)
                setMessage("")
                setError("")
                return loadNotebookStorageSettings(notebookId)
            })
            .then(loaded => {
                if (!isMounted) return
                if (!loaded) {
                    setSettingsState({ notebookId, settings: emptyNotebookStorageSettings })
                    return
                }

                setSettingsState({
                    notebookId,
                    settings: {
                        connectionId: loaded.connectionId,
                        connectionName: loaded.connectionName,
                        endpointUrl: loaded.endpointUrl,
                        region: loaded.region,
                        forcePathStyle: loaded.forcePathStyle,
                        accessKeyId: loaded.accessKeyId,
                        secretAccessKey: "",
                        bucketName: loaded.bucketName,
                    },
                })
            })
            .catch(nextError => {
                if (isMounted) setError(nextError instanceof Error ? nextError.message : "Unable to load settings.")
            })
            .finally(() => {
                if (isMounted) setIsLoading(false)
            })

        return () => {
            isMounted = false
        }
    }, [notebookId, storageEnabled])

    useEffect(() => {
        const timeout = window.setTimeout(() => void refreshHealthCheck(true), 0)

        return () => window.clearTimeout(timeout)
    }, [refreshHealthCheck])

    const updateText = useCallback(
        (field: keyof NotebookStorageSettingsInput) => (event: ChangeEvent<HTMLInputElement>) => {
            setSettingsState(current => ({
                notebookId,
                settings: {
                    ...(current.notebookId === notebookId ? current.settings : emptyNotebookStorageSettings),
                    [field]: event.target.value,
                },
            }))
            setMessage("")
            setError("")
        },
        [notebookId],
    )
    const updateForcePathStyle = useCallback(
        (checked: boolean) =>
            setSettingsState(current => ({
                notebookId,
                settings: {
                    ...(current.notebookId === notebookId ? current.settings : emptyNotebookStorageSettings),
                    forcePathStyle: checked,
                },
            })),
        [notebookId],
    )
    const saveSettings = useCallback(async () => {
        setIsSaving(true)
        setMessage("")
        setError("")
        try {
            const saved = await saveNotebookStorageSettings(notebookId, settings)
            setSettingsState(current => ({
                notebookId,
                settings: {
                    ...(current.notebookId === notebookId ? current.settings : settings),
                    connectionId: saved?.connectionId ?? settings.connectionId,
                    secretAccessKey: "",
                },
            }))
            setMessage("Storage settings saved.")
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : "Unable to save settings.")
        } finally {
            setIsSaving(false)
        }
    }, [notebookId, settings])

    const runPublishAction = useCallback(
        async (action: PublishAction, includeHtml = false, includeJson = false) => {
            if (isPublishing) return
            if (action !== "preview" && !notebookRevision) {
                setPublishError("Revision is required to save publish changes. Reload the workspace and try again.")
                return
            }
            setIsPublishing(true)
            setPublishMessage("")
            setPublishError("")

            try {
                const response = await onPublish({
                    action,
                    revision: action === "preview" ? undefined : (notebookRevision ?? undefined),
                    includeHtml,
                    includeJson,
                })
                if ("preview" in response) {
                    setPreviewPayload(response.preview)
                    setPublishMessage("Publish preview ready for review.")
                    return
                }

                setPreviewPayload(null)
                setPublishMessage(response.notebook.published ? "Publish state updated to public." : "Publish state updated to private.")
            } catch (nextError) {
                setPublishError(nextError instanceof Error ? nextError.message : "Unable to update publish state.")
            } finally {
                setIsPublishing(false)
            }
        },
        [isPublishing, notebookRevision, onPublish],
    )

    const publishActionLabel = notebookPublished ? "Unpublish notebook" : "Publish notebook"
    const publishAction = notebookPublished ? "unpublish" : "publish"

    const previewNotebook = useCallback(() => void runPublishAction("preview", includeHtmlPreview, includeJsonPreview), [includeHtmlPreview, includeJsonPreview, runPublishAction])
    const refreshHealth = useCallback(() => void refreshHealthCheck(), [refreshHealthCheck])
    const applyPublishAction = useCallback(() => {
        if (isPublishing) return
        return void runPublishAction(publishAction)
    }, [isPublishing, publishAction, runPublishAction])

    return (
        <Stack className={styles.workspace} gap="lg">
            <Stack className={styles.header} direction="horizontal" gap="md">
                <Button icon={<ArrowLeft size={15} />} variant="ghost" onClick={onDone}>
                    Back
                </Button>
                <Stack gap="xs">
                    <Heading size="md">Notebook Settings</Heading>
                    <Text size="small">{notebookTitle}</Text>
                </Stack>
            </Stack>
            <WorkspaceHealthSection
                healthCheck={healthCheck}
                healthError={healthError}
                healthMessage={healthMessage}
                isHealthLoading={isHealthLoading}
                isRepairing={isRepairing}
                isSaving={isSaving}
                onRefreshHealth={refreshHealth}
                onRepair={runRepair}
            />
            <PublishWorkflowSection
                includeHtmlPreview={includeHtmlPreview}
                includeJsonPreview={includeJsonPreview}
                isPublishing={isPublishing}
                notebookRevision={notebookRevision}
                previewPayload={previewPayload}
                publishActionLabel={publishActionLabel}
                publishError={publishError}
                publishMessage={publishMessage}
                publishStatus={publishStatus}
                onApplyPublishAction={applyPublishAction}
                onIncludeHtmlPreviewChange={setIncludeHtmlPreview}
                onIncludeJsonPreviewChange={setIncludeJsonPreview}
                onPreviewNotebook={previewNotebook}
            />
            <StorageSettingsSection
                error={error}
                isLoading={isLoading}
                isSaving={isSaving}
                message={message}
                settings={settings}
                storageEnabled={storageEnabled}
                onForcePathStyleChange={updateForcePathStyle}
                onSaveSettings={saveSettings}
                onTextChange={updateText}
            />
        </Stack>
    )
}
