import type { NotebookStorageSettings, NotebookStorageSettingsInput, UploadedNotebookAsset } from "./storage-settings"
import type { Notebook } from "./types"

const parseError = async (response: Response, fallback: string) => {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return body?.error ?? fallback
}

export const authorizedStorageFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    return fetch(input, {
        ...init,
        headers: {
            ...init.headers,
        },
    })
}

export const loadNotebookStorageSettings = async (notebookId: string): Promise<NotebookStorageSettings | null> => {
    const response = await authorizedStorageFetch(`/api/notebooks/${encodeURIComponent(notebookId)}/storage-settings`)
    if (!response.ok) throw new Error(await parseError(response, "Unable to load storage settings."))

    const body = (await response.json()) as { settings: NotebookStorageSettings | null }
    return body.settings
}

export const saveNotebookStorageSettings = async (notebookId: string, settings: NotebookStorageSettingsInput): Promise<NotebookStorageSettings | null> => {
    const response = await authorizedStorageFetch(`/api/notebooks/${encodeURIComponent(notebookId)}/storage-settings`, {
        method: "PUT",
        body: JSON.stringify(settings),
        headers: {
            "Content-Type": "application/json",
        },
    })
    if (!response.ok) throw new Error(await parseError(response, "Unable to save storage settings."))

    const body = (await response.json()) as { settings: NotebookStorageSettings | null }
    return body.settings
}

export const fetchSignedAssetUrl = async (assetId: string, ttlSeconds?: number) => {
    const query = new URLSearchParams()
    if (ttlSeconds != null) query.set("ttlSeconds", String(ttlSeconds))

    const suffix = query.toString() ? `?${query.toString()}` : ""
    const response = await authorizedStorageFetch(`/api/assets/${encodeURIComponent(assetId)}/sign${suffix}`)
    if (!response.ok) throw new Error(await parseError(response, "Unable to create signed asset URL."))

    const body = (await response.json().catch(() => null)) as {
        url?: string
        ttlSeconds?: number
        expiresAt?: string
        error?: string
    } | null
    if (!body?.url) throw new Error(body?.error ?? "Unable to create signed asset URL.")

    return body.url
}

export type PublishAction = "preview" | "publish" | "unpublish"

export type PublishRequestInput = {
    action: PublishAction
    revision?: string
    includeHtml?: boolean
    includeJson?: boolean
}

export type PublishPreviewPayload = {
    notebookId: string
    notebookTitle: string
    markdown: string
    web?: string
    json?: string
    diagnostics?: {
        includeHtml: boolean
        includeJson: boolean
        manifestHash: string
    }
}

export type PublishPreviewResponse = {
    preview: PublishPreviewPayload
}

export type PublishApplyResponse = {
    notebook: Notebook
    revision: string
}

export type PublishResponse = PublishPreviewResponse | PublishApplyResponse

const parsePublishError = async (response: Response) => {
    const body = (await response.json().catch(() => null)) as { error?: string; preview?: PublishPreviewPayload; notebook?: Notebook; revision?: string } | null
    return {
        error: body?.error ?? "Unable to update publish state.",
        preview: body?.preview,
        notebook: body?.notebook,
        revision: body?.revision,
    }
}

export const publishNotebook = async (notebookId: string, input: PublishRequestInput): Promise<PublishResponse> => {
    const response = await authorizedStorageFetch(`/api/notebooks/${encodeURIComponent(notebookId)}/publish`, {
        method: "POST",
        body: JSON.stringify(input),
        headers: {
            "Content-Type": "application/json",
        },
    })
    if (!response.ok) {
        const parsed = await parsePublishError(response)
        throw new Error(parsed.error)
    }

    const body = (await response.json()) as PublishResponse
    return body
}

export const uploadNotebookImage = async (notebookId: string, file: File): Promise<UploadedNotebookAsset> => {
    const formData = new FormData()
    formData.set("file", file)
    const response = await authorizedStorageFetch(`/api/notebooks/${encodeURIComponent(notebookId)}/assets`, {
        method: "POST",
        body: formData,
    })
    if (!response.ok) throw new Error(await parseError(response, "Unable to upload image."))

    const body = (await response.json()) as { asset: UploadedNotebookAsset }
    return body.asset
}

export const fetchPrivateAssetUrl = async (url: string, signal?: AbortSignal) => {
    const response = await authorizedStorageFetch(url, { signal })
    if (!response.ok) throw new Error(await parseError(response, "Unable to load image asset."))

    return URL.createObjectURL(await response.blob())
}
