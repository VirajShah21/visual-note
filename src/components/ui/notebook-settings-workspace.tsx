"use client"

import { ArrowLeft, Save, Server } from "lucide-react"
import { useCallback, useEffect, useState, type ChangeEvent } from "react"
import { Button } from "./button"
import { Card, Grid, Heading, Stack, Text } from "./primitives"
import { CheckboxField, TextField } from "./form-controls"
import { emptyNotebookStorageSettings, type NotebookStorageSettingsInput } from "@/lib/visual-note/storage-settings"
import { repairWorkspaceConsistency, runWorkspaceHealthCheck, type WorkspaceHealthCheckPayload } from "@/lib/visual-note/workspace-health-api"
import { loadNotebookStorageSettings, saveNotebookStorageSettings } from "@/lib/visual-note/storage-api"
import styles from "./notebook-settings-workspace.module.css"

export type NotebookSettingsWorkspaceProps = {
    notebookId: string
    notebookTitle: string
    storageEnabled: boolean
    onDone: () => void
}

export function NotebookSettingsWorkspace({ notebookId, notebookTitle, storageEnabled, onDone }: NotebookSettingsWorkspaceProps) {
    const [settingsState, setSettingsState] = useState<{ notebookId: string; settings: NotebookStorageSettingsInput }>({
        notebookId: "",
        settings: emptyNotebookStorageSettings,
    })
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [healthCheck, setHealthCheck] = useState<WorkspaceHealthCheckPayload | null>(null)
    const [isHealthLoading, setIsHealthLoading] = useState(false)
    const [isRepairing, setIsRepairing] = useState(false)
    const [healthMessage, setHealthMessage] = useState("")
    const [healthError, setHealthError] = useState("")
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const settings = storageEnabled && settingsState.notebookId === notebookId ? settingsState.settings : emptyNotebookStorageSettings

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
            } else {
                setHealthMessage("No repair actions were required.")
            }
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
        void refreshHealthCheck(true)
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
            <Card className={styles.panel}>
                <Stack gap="md">
                    <Stack className={styles.sectionTitle} direction="horizontal" gap="sm">
                        <Server size={17} />
                        <Heading as="h3" size="sm">
                            Workspace consistency
                        </Heading>
                    </Stack>
                    <Stack gap="xs">
                        {isHealthLoading ? <Text size="small">Checking workspace consistency…</Text> : null}
                        {healthError ? (
                            <Text as="span" size="small" className={styles.error}>
                                {healthError}
                            </Text>
                        ) : null}
                        {!isHealthLoading && !healthError && healthCheck ? (
                            <>
                                <Text size="small">
                                    Loaded {healthCheck.notebookCount} notebooks, {healthCheck.pageCount} pages, {healthCheck.topicCount} topics, and {healthCheck.viewCount} views.
                                </Text>
                                <Text size="small">{healthCheck.issues.length ? `${healthCheck.issues.length} consistency issue(s) found.` : "No consistency issues found."}</Text>
                                {healthCheck.issues.length > 0 ? (
                                    <Stack gap="xs">
                                        {healthCheck.issues.map((issue: WorkspaceHealthCheckPayload["issues"][number]) => (
                                            <Text as="span" size="small" key={`${issue.scope}-${issue.id}`}>
                                                {`${issue.scope} ${issue.id}: ${issue.message}`}
                                            </Text>
                                        ))}
                                    </Stack>
                                ) : null}
                            </>
                        ) : null}
                        <Stack className={styles.actions} direction="horizontal" gap="sm">
                            <Button
                                variant="secondary"
                                disabled={isHealthLoading || isSaving || isRepairing}
                                onClick={() => void refreshHealthCheck()}
                            >
                                {isHealthLoading ? "Checking" : "Refresh check"}
                            </Button>
                            {healthCheck?.issues?.length ? (
                                <Button variant="primary" disabled={isHealthLoading || isSaving || isRepairing} onClick={runRepair}>
                                    {isRepairing ? "Repairing" : "Repair consistency"}
                                </Button>
                            ) : null}
                        </Stack>
                        {healthMessage ? (
                            <Text as="span" size="small">
                                {healthMessage}
                            </Text>
                        ) : null}
                    </Stack>
                </Stack>
            </Card>
            <Card className={styles.panel}>
                <Stack gap="md">
                    <Stack className={styles.sectionTitle} direction="horizontal" gap="sm">
                        <Server size={17} />
                        <Heading as="h3" size="sm">
                            S3 Image Storage
                        </Heading>
                    </Stack>
                    {!storageEnabled ? (
                        <Text>
                            S3 image storage is not configured yet. Open the storage form and add valid credentials to persist markdown and image assets for this notebook.
                        </Text>
                    ) : (
                        <>
                            <Grid columns="two" gap="sm">
                                <TextField label="Connection name" value={settings.connectionName} onChange={updateText("connectionName")} disabled={isLoading || isSaving} />
                                <TextField label="Bucket name" value={settings.bucketName} onChange={updateText("bucketName")} disabled={isLoading || isSaving} />
                                <TextField label="Endpoint URL" value={settings.endpointUrl} onChange={updateText("endpointUrl")} disabled={isLoading || isSaving} />
                                <TextField label="Region" value={settings.region} onChange={updateText("region")} disabled={isLoading || isSaving} />
                                <TextField label="Access key ID" value={settings.accessKeyId} onChange={updateText("accessKeyId")} disabled={isLoading || isSaving} />
                                <TextField
                                    label="Secret access key"
                                    value={settings.secretAccessKey ?? ""}
                                    type="password"
                                    placeholder={settings.connectionId ? "Leave blank to keep existing secret" : ""}
                                    onChange={updateText("secretAccessKey")}
                                    disabled={isLoading || isSaving}
                                />
                                <CheckboxField label="Force path style" checked={settings.forcePathStyle} onCheckedChange={updateForcePathStyle} disabled={isLoading || isSaving} />
                            </Grid>
                            <Stack className={styles.actions} direction="horizontal" gap="sm">
                                <Button icon={<Save size={15} />} variant="primary" disabled={isLoading || isSaving} onClick={saveSettings}>
                                    {isSaving ? "Saving" : "Save"}
                                </Button>
                                {message ? (
                                    <Text as="span" size="small" tone="strong">
                                        {message}
                                    </Text>
                                ) : null}
                                {error ? (
                                    <Text as="span" size="small" className={styles.error}>
                                        {error}
                                    </Text>
                                ) : null}
                            </Stack>
                        </>
                    )}
                </Stack>
            </Card>
        </Stack>
    )
}
