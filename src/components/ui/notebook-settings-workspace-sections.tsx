"use client"

import { Save, Server } from "lucide-react"
import type { ChangeEventHandler } from "react"
import { Button } from "./button"
import { Card, Grid, Heading, Stack, Text } from "./primitives"
import { CheckboxField, TextField } from "./form-controls"
import type { PublishPreviewPayload } from "@/lib/visual-note/storage-api"
import type { NotebookStorageSettingsInput } from "@/lib/visual-note/storage-settings"
import type { WorkspaceHealthCheckPayload } from "@/lib/visual-note/workspace-health-api"
import styles from "./notebook-settings-workspace.module.css"

type HealthSectionProps = {
    healthCheck: WorkspaceHealthCheckPayload | null
    healthError: string
    healthMessage: string
    isHealthLoading: boolean
    isRepairing: boolean
    isSaving: boolean
    onRefreshHealth: () => void
    onRepair: () => void
}

type PublishSectionProps = {
    includeHtmlPreview: boolean
    includeJsonPreview: boolean
    isPublishing: boolean
    notebookRevision: string | null
    previewPayload: PublishPreviewPayload | null
    publishActionLabel: string
    publishError: string
    publishMessage: string
    publishStatus: string
    onApplyPublishAction: () => void
    onIncludeHtmlPreviewChange: (checked: boolean) => void
    onIncludeJsonPreviewChange: (checked: boolean) => void
    onPreviewNotebook: () => void
}

type StorageSectionProps = {
    error: string
    isLoading: boolean
    isSaving: boolean
    message: string
    settings: NotebookStorageSettingsInput
    storageEnabled: boolean
    onForcePathStyleChange: (checked: boolean) => void
    onSaveSettings: () => void
    onTextChange: (field: keyof NotebookStorageSettingsInput) => ChangeEventHandler<HTMLInputElement>
}

const hasJsonPreview = (preview?: PublishPreviewPayload | null) => Boolean(preview?.json)
const hasHtmlPreview = (preview?: PublishPreviewPayload | null) => Boolean(preview?.web)

export function WorkspaceHealthSection({ healthCheck, healthError, healthMessage, isHealthLoading, isRepairing, isSaving, onRefreshHealth, onRepair }: HealthSectionProps) {
    return (
        <Card className={styles.panel}>
            <Stack gap="md">
                <Stack className={styles.sectionTitle} direction="horizontal" gap="sm">
                    <Server size={17} />
                    <Heading as="h3" size="sm">
                        Workspace consistency
                    </Heading>
                </Stack>
                <Stack gap="xs">
                    {isHealthLoading ? <Text size="small">Checking workspace consistency...</Text> : null}
                    {healthError ? (
                        <Text as="span" size="small" className={styles.error}>
                            {healthError}
                        </Text>
                    ) : null}
                    {!isHealthLoading && !healthError && healthCheck ? <WorkspaceHealthSummary healthCheck={healthCheck} /> : null}
                    <Stack className={styles.actions} direction="horizontal" gap="sm">
                        <Button variant="secondary" disabled={isHealthLoading || isSaving || isRepairing} onClick={onRefreshHealth}>
                            {isHealthLoading ? "Checking" : "Refresh check"}
                        </Button>
                        {healthCheck?.issues?.length ? (
                            <Button variant="primary" disabled={isHealthLoading || isSaving || isRepairing} onClick={onRepair}>
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
    )
}

function WorkspaceHealthSummary({ healthCheck }: { healthCheck: WorkspaceHealthCheckPayload }) {
    return (
        <>
            <Text size="small">
                Loaded {healthCheck.notebookCount} notebooks, {healthCheck.pageCount} pages, {healthCheck.topicCount} topics, and {healthCheck.viewCount} views.
            </Text>
            <Text size="small">{healthCheck.issues.length ? `${healthCheck.issues.length} consistency issue(s) found.` : "No consistency issues found."}</Text>
            {healthCheck.issues.length > 0 ? (
                <Stack gap="xs">
                    {healthCheck.issues.map(issue => (
                        <Text as="span" size="small" key={`${issue.scope}-${issue.id}`}>
                            {`${issue.scope} ${issue.id}: ${issue.message}`}
                        </Text>
                    ))}
                </Stack>
            ) : null}
        </>
    )
}

export function PublishWorkflowSection({
    includeHtmlPreview,
    includeJsonPreview,
    isPublishing,
    notebookRevision,
    previewPayload,
    publishActionLabel,
    publishError,
    publishMessage,
    publishStatus,
    onApplyPublishAction,
    onIncludeHtmlPreviewChange,
    onIncludeJsonPreviewChange,
    onPreviewNotebook,
}: PublishSectionProps) {
    return (
        <Card className={styles.panel}>
            <Stack gap="md">
                <Stack className={styles.sectionTitle} direction="horizontal" gap="sm">
                    <Server size={17} />
                    <Heading as="h3" size="sm">
                        Publish workflow
                    </Heading>
                </Stack>
                <Text size="small">Current state: {publishStatus}</Text>
                <Stack gap="xs">
                    <CheckboxField label="Include rendered HTML in preview" checked={includeHtmlPreview} onCheckedChange={onIncludeHtmlPreviewChange} disabled={isPublishing} />
                    <CheckboxField label="Include JSON in preview" checked={includeJsonPreview} onCheckedChange={onIncludeJsonPreviewChange} disabled={isPublishing} />
                </Stack>
                <Stack className={styles.actions} direction="horizontal" gap="sm">
                    <Button variant="secondary" disabled={isPublishing} onClick={onPreviewNotebook}>
                        {isPublishing ? "Preparing preview" : "Preview publish bundle"}
                    </Button>
                    <Button variant="primary" disabled={isPublishing || !notebookRevision} onClick={onApplyPublishAction}>
                        {isPublishing ? "Saving publish state" : publishActionLabel}
                    </Button>
                </Stack>
                <StatusText message={publishMessage} />
                {publishError ? (
                    <Text as="span" size="small" className={styles.error}>
                        {publishError}
                    </Text>
                ) : null}
                {previewPayload ? <PublishPreviewDiagnostics previewPayload={previewPayload} /> : null}
            </Stack>
        </Card>
    )
}

function StatusText({ message }: { message: string }) {
    if (!message) return null

    return (
        <Text as="span" size="small" tone="strong">
            {message}
        </Text>
    )
}

function PublishPreviewDiagnostics({ previewPayload }: { previewPayload: PublishPreviewPayload }) {
    return (
        <Stack gap="xs">
            <Text size="small" tone="strong">
                Preview diagnostics
            </Text>
            <Text size="small">{`Markdown length: ${previewPayload.markdown.length}`}</Text>
            <Text size="small">{`Include HTML: ${hasHtmlPreview(previewPayload) ? "yes" : "no"}`}</Text>
            <Text size="small">{`Include JSON: ${hasJsonPreview(previewPayload) ? "yes" : "no"}`}</Text>
        </Stack>
    )
}

export function StorageSettingsSection({
    error,
    isLoading,
    isSaving,
    message,
    settings,
    storageEnabled,
    onForcePathStyleChange,
    onSaveSettings,
    onTextChange,
}: StorageSectionProps) {
    return (
        <Card className={styles.panel}>
            <Stack gap="md">
                <Stack className={styles.sectionTitle} direction="horizontal" gap="sm">
                    <Server size={17} />
                    <Heading as="h3" size="sm">
                        S3 Image Storage
                    </Heading>
                </Stack>
                {!storageEnabled ? (
                    <Text>S3 image storage is not configured yet. Open the storage form and add valid credentials to persist markdown and image assets for this notebook.</Text>
                ) : (
                    <>
                        <Grid columns="two" gap="sm">
                            <TextField label="Connection name" value={settings.connectionName} onChange={onTextChange("connectionName")} disabled={isLoading || isSaving} />
                            <TextField label="Bucket name" value={settings.bucketName} onChange={onTextChange("bucketName")} disabled={isLoading || isSaving} />
                            <TextField label="Endpoint URL" value={settings.endpointUrl} onChange={onTextChange("endpointUrl")} disabled={isLoading || isSaving} />
                            <TextField label="Region" value={settings.region} onChange={onTextChange("region")} disabled={isLoading || isSaving} />
                            <TextField label="Access key ID" value={settings.accessKeyId} onChange={onTextChange("accessKeyId")} disabled={isLoading || isSaving} />
                            <TextField
                                label="Secret access key"
                                value={settings.secretAccessKey ?? ""}
                                type="password"
                                placeholder={settings.connectionId ? "Leave blank to keep existing secret" : ""}
                                onChange={onTextChange("secretAccessKey")}
                                disabled={isLoading || isSaving}
                            />
                            <CheckboxField label="Force path style" checked={settings.forcePathStyle} onCheckedChange={onForcePathStyleChange} disabled={isLoading || isSaving} />
                        </Grid>
                        <Stack className={styles.actions} direction="horizontal" gap="sm">
                            <Button icon={<Save size={15} />} variant="primary" disabled={isLoading || isSaving} onClick={onSaveSettings}>
                                {isSaving ? "Saving" : "Save"}
                            </Button>
                            <StatusText message={message} />
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
    )
}
