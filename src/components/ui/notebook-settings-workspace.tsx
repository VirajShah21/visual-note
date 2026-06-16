"use client"

import { ArrowLeft, Save, Server } from "lucide-react"
import { useCallback, useEffect, useState, type ChangeEvent } from "react"
import { Button } from "./button"
import { Card, Grid, Heading, Stack, Text } from "./primitives"
import { CheckboxField, TextField } from "./form-controls"
import { emptyNotebookStorageSettings, type NotebookStorageSettingsInput } from "@/lib/visual-note/storage-settings"
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
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const settings = storageEnabled && settingsState.notebookId === notebookId ? settingsState.settings : emptyNotebookStorageSettings

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
                            S3 Image Storage
                        </Heading>
                    </Stack>
                    {!storageEnabled ? (
                        <Text>S3 storage requires Supabase authentication and server encryption configuration.</Text>
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
