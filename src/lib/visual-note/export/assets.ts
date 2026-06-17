import { parseArticleContent } from "../article-content"
import { authorizedStorageFetch } from "../storage-api"
import type { ExportAssetMode, ExportAssetReference, ExportAssetResolution, ExportDocument, ExportResolvedAsset } from "./types"

type AssetFetcher = (source: string) => Promise<Blob>

const imageExtensionByType: Record<string, string> = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp",
}

const stringFrom = (value: unknown, fallback = "") => {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)

    return fallback
}

const isPrivateAssetUrl = (source: string) => /^\/api\/assets\/[^/?#]+/i.test(source.trim())

const extensionFor = (source: string, contentType: string) => {
    const typeExtension = imageExtensionByType[contentType.toLowerCase()]
    if (typeExtension) return typeExtension

    const pathname = new URL(source, "https://visual-note.local").pathname
    const match = pathname.match(/\.([a-z0-9]{2,8})$/i)
    return match?.[1]?.toLowerCase() ?? "bin"
}

const safeFileName = (value: string, fallback: string) => {
    const cleaned = value
        .trim()
        .replace(/\.[a-z0-9]{2,8}$/i, "")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/(^-|-$)/g, "")
        .toLowerCase()

    return cleaned || fallback
}

const sourceFileName = (source: string, fallback: string) => {
    const pathname = new URL(source, "https://visual-note.local").pathname
    const lastSegment = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "")
    return safeFileName(lastSegment || fallback, fallback)
}

const uniqueAssetPath = (reference: ExportAssetReference, source: string, contentType: string, used: Set<string>) => {
    const extension = extensionFor(source, contentType)
    const baseName = safeFileName(reference.preferredName, sourceFileName(source, "asset"))
    let fileName = `${baseName}.${extension}`
    let index = 2

    while (used.has(fileName)) {
        fileName = `${baseName}-${index}.${extension}`
        index++
    }

    used.add(fileName)
    return { fileName, path: `assets/${fileName}` }
}

const blobToDataUrl = async (blob: Blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ""
    const chunkSize = 8192
    for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.slice(index, index + chunkSize))

    return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`
}

const defaultAssetFetcher: AssetFetcher = async source => {
    if (isPrivateAssetUrl(source)) {
        const response = await authorizedStorageFetch(source)
        if (!response.ok) throw new Error("Unable to fetch private asset.")

        return response.blob()
    }

    const response = await fetch(source)
    if (!response.ok) throw new Error("Unable to fetch asset.")

    return response.blob()
}

const addReference = (references: Map<string, ExportAssetReference>, source: string, alt: string, preferredName: string) => {
    const trimmedSource = source.trim()
    if (!trimmedSource) return
    if (references.has(trimmedSource)) return

    references.set(trimmedSource, {
        source: trimmedSource,
        alt,
        preferredName,
    })
}

export const collectExportAssetReferences = (document: ExportDocument) => {
    const references = new Map<string, ExportAssetReference>()

    document.pages.forEach(page => {
        page.topics.forEach(topic => {
            if (!topic.view) return

            parseArticleContent(topic.view.content, topic.view.displays.length).blocks.forEach(block => {
                if (block.kind === "image") addReference(references, block.url, block.alt, block.alt || "image")
                if (block.kind === "visual" && block.visualKind === "image")
                    addReference(references, stringFrom(block.data.url), stringFrom(block.data.alt, "Image"), stringFrom(block.data.title, stringFrom(block.data.alt, "image")))
            })
        })
    })

    return [...references.values()]
}

export const resolveExportAssets = async (document: ExportDocument, mode: ExportAssetMode, fetcher: AssetFetcher = defaultAssetFetcher): Promise<ExportAssetResolution> => {
    const warnings: string[] = []
    const assets: ExportResolvedAsset[] = []
    const assetBySource = new Map<string, ExportResolvedAsset>()
    if (mode === "ignore") return { assets, assetBySource, warnings }

    const usedNames = new Set<string>()
    const references = collectExportAssetReferences(document)
    for (const reference of references)
        try {
            const blob = await fetcher(reference.source)
            const dataUrl = await blobToDataUrl(blob)
            const contentType = blob.type || dataUrl.match(/^data:([^;]+)/)?.[1] || "application/octet-stream"
            const file = uniqueAssetPath(reference, reference.source, contentType, usedNames)
            const asset = { ...file, source: reference.source, contentType, blob, dataUrl }
            assets.push(asset)
            assetBySource.set(reference.source, asset)
        } catch {
            warnings.push(`Could not resolve ${reference.alt || reference.source}; keeping the original URL.`)
        }

    return { assets, assetBySource, warnings }
}

export const assetUrlFor = (source: string, mode: ExportAssetMode, resolution: ExportAssetResolution) => {
    if (mode === "ignore") return ""

    const asset = resolution.assetBySource.get(source.trim())
    if (mode === "base64") return asset?.dataUrl ?? source

    return asset?.path ?? source
}
