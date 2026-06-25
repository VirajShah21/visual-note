import type { NotebookStorageSettings, NotebookStorageSettingsInput, UploadedNotebookAsset } from "./storage-settings"

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
