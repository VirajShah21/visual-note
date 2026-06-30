import { createId, DatasetCardField, normalizeTitle, safeTrim } from "./result"
import { ComponentKind, RenderProfile, ViewMode } from "./types"

export const cloneWithNewIds = <T>(value: T): T => {
    if (!value) return value
    if (typeof value !== "object") return value

    if (Array.isArray(value)) return value.map(cloneWithNewIds) as T

    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (key === "id" && typeof item === "string") return [key, `clone-${createId()}`]
            return [key, cloneWithNewIds(item)]
        }),
    ) as T
}

export const parseCsvRecords = (text: string) => {
    const rows = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line =>
            line
                .split(",")
                .map(item => item.trim().replace(/^"|"$/g, ""))
                .map(item => (item === "" ? null : item)),
        )
    if (rows.length === 0 || rows[0]!.length === 0) return []

    const headers = rows[0]!.map(column => String(column).toLowerCase())
    return rows.slice(1).map(row => {
        const item: Record<string, unknown> = {}
        headers.forEach((header, index) => {
            const next = row[index]
            item[header] = next
        })
        return item
    })
}

export const inferComponentKindFromData = (data: unknown) => {
    if (Array.isArray(data) && data.every(item => item && typeof item === "object")) {
        const reasons: string[] = []

        if (data.every(item => Object.prototype.hasOwnProperty.call(item, "done") || Object.prototype.hasOwnProperty.call(item, "purchased"))) {
            reasons.push("Array entries include task or completion markers.")
            return { kind: "checklist" as ComponentKind, confidence: 0.9, reasons }
        }

        if (data.length > 0 && Object.prototype.hasOwnProperty.call(data[0] as object, "label") && Object.prototype.hasOwnProperty.call(data[0] as object, "date")) {
            reasons.push("Array entries look like time-ordered events.")
            return { kind: "timeline" as ComponentKind, confidence: 0.82, reasons }
        }

        if (data.every(item => item && typeof item === "object" && ("workHours" in (item as object) || "title" in (item as object)))) {
            reasons.push("Array includes log-like fields.")
            return { kind: "work-logs" as ComponentKind, confidence: 0.7, reasons }
        }

        reasons.push("Generic table-like array.")
        return { kind: "data-card" as ComponentKind, confidence: 0.6, reasons }
    }

    if (data && typeof data === "object" && !Array.isArray(data)) {
        const item = data as Record<string, unknown>
        if ("events" in item && Array.isArray(item.events)) return { kind: "timeline" as ComponentKind, confidence: 0.9, reasons: ["Object has event list."] }
        if ("items" in item && Array.isArray(item.items)) return { kind: "shopping-list" as ComponentKind, confidence: 0.82, reasons: ["Object has item list."] }
        if ("bugs" in item && Array.isArray(item.bugs)) return { kind: "bugs-list" as ComponentKind, confidence: 0.85, reasons: ["Object has bug list."] }
        if ("prUrl" in item || "prNumber" in item || "pullRequestUrl" in item) return { kind: "pull-request" as ComponentKind, confidence: 0.9, reasons: ["Object has PR fields."] }
        if ("code" in item || "language" in item) return { kind: "code-block" as ComponentKind, confidence: 0.88, reasons: ["Object has code fields."] }
        if ("workLogs" in item && Array.isArray(item.workLogs)) return { kind: "work-logs" as ComponentKind, confidence: 0.9, reasons: ["Object has work log list."] }
        if ("metrics" in item || "value" in item) return { kind: "dashboard" as ComponentKind, confidence: 0.67, reasons: ["Object has metric-like fields."] }

        return { kind: "data-card" as ComponentKind, confidence: 0.6, reasons: ["Fallback to generic card when structure is ambiguous."] }
    }

    return { kind: "data-card" as ComponentKind, confidence: 0.4, reasons: ["Fallback for non-object payloads."] }
}

export const normalizeInputData = (input: unknown) => {
    if (typeof input === "string") {
        const trimmed = input.trim()
        if (!trimmed) return { data: null, error: "No data provided." }
        if (trimmed.startsWith("[") || trimmed.startsWith("{"))
            try {
                return { data: JSON.parse(trimmed) }
            } catch {
                return { error: "Unable to parse JSON payload." }
            }

        return { data: parseCsvRecords(trimmed) }
    }

    if (typeof input === "object") return { data: input }
    return { error: "Unsupported input format." }
}

export const tokenize = (value: string) => {
    const tokens = safeTrim(value)
        .toLowerCase()
        .replace(/[\W_]+/g, " ")
        .split(" ")
        .filter(Boolean)

    return [...new Set(tokens)]
}

export const jaccardSimilarity = (left: string[], right: string[]) => {
    if (left.length === 0 || right.length === 0) return 0

    const leftSet = new Set(left)
    const rightSet = new Set(right)
    const intersection = [...leftSet].filter(item => rightSet.has(item)).length
    const union = new Set([...leftSet, ...rightSet]).size
    return union === 0 ? 0 : intersection / union
}

export type OutlineSection = {
    title: string
    views: string[]
}

export const parseOutlineSections = (outline: string): OutlineSection[] => {
    const sections: OutlineSection[] = []
    let current: OutlineSection | null = null

    outline
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(line => {
            if (/^#{1,4}\s+/.test(line)) {
                const title = line.replace(/^#{1,4}\s+/, "").trim()
                if (!title) return
                current = { title, views: [] }
                sections.push(current)
                return
            }

            if (/^[-*]\s+/.test(line)) {
                const viewName = line.replace(/^[-*]\s+/, "").trim()
                if (!viewName) return

                if (!current) {
                    current = { title: "Section", views: [] }
                    sections.push(current)
                }

                current.views.push(viewName)
                return
            }

            if (!current) {
                const section = { title: line, views: ["Overview"] }
                sections.push(section)
                current = section
                return
            }

            if (!current.views.length) current.views.push(line)
        })

    return sections
}

export const toCardType = (value: unknown): DatasetCardField["type"] => {
    if (value === null) return "null"
    if (Array.isArray(value)) return "array"
    if (typeof value === "string") return "string"
    if (typeof value === "number") return "number"
    if (typeof value === "boolean") return "boolean"
    if (typeof value === "object") return "object"
    return "unknown"
}

export const canonicalizeTitle = (value: string) => {
    const trimmed = safeTrim(value)
    return trimmed || "Untitled"
}

export const canonicalSiblingName = (value: string) => normalizeTitle(canonicalizeTitle(value))

export const ensureUniqueByScope = (items: string[]) => {
    const used = new Set<string>()
    return items.map(raw => {
        const normalized = canonicalSiblingName(raw)
        if (!used.has(normalized)) {
            used.add(normalized)
            return raw
        }

        let index = 1
        let next = `${raw} (${index})`
        while (used.has(canonicalSiblingName(next))) {
            index += 1
            next = `${raw} (${index})`
        }
        used.add(canonicalSiblingName(next))
        return next
    })
}

export const displayKindForMode = (mode: ViewMode) => (mode === "dashboard" ? "dashboard" : mode === "structured" ? "data-card" : "data-card")

export const estimateRenderComplexity = (profile: Omit<RenderProfile, "estimatedComplexity" | "estimatedRenderCost">) => {
    const score = profile.blockCount * 0.7 + profile.headingCount * 1.5 + profile.visualBlockCount * 4 + profile.displayCount * 2 + profile.rawLength / 60
    const estimatedComplexity = score >= 80 ? "high" : score >= 35 ? "medium" : "low"
    return {
        estimatedComplexity,
        estimatedRenderCost: Math.max(1, Math.round(score)),
    }
}

export const observationId = () => `obs-${createId()}`
