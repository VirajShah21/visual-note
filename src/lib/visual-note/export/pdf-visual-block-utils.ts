import type { PdfRenderBlock, PdfVisualDetail, PdfVisualSection } from "./types"

export const stringFrom = (value: unknown, fallback = "") => {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)

    return fallback
}

export const numberFrom = (value: unknown, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }

    return fallback
}

export const arrayFrom = (value: unknown) => {
    if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean)
    if (typeof value === "string" && value.trim()) return value.split(",").map(item => item.trim())

    return []
}

export const objectArrayFrom = (value: unknown) => {
    if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))

    return []
}

const compactDetails = (details: PdfVisualDetail[]) => details.filter(detail => detail.value)

const compactSections = (sections: PdfVisualSection[]) =>
    sections.map(section => ({ ...section, lines: section.lines.filter(Boolean) })).filter(section => section.lines.length > 0)

export const joinParts = (parts: string[]) => parts.filter(Boolean).join(" - ")

export const dataBlock = (title: string, data: unknown, breakBefore = false): PdfRenderBlock => ({
    kind: "data",
    title,
    body: JSON.stringify(data, null, 2),
    breakBefore,
})

export const visualCard = ({
    label,
    title,
    subtitle,
    details = [],
    badges = [],
    sections = [],
    breakBefore = false,
}: {
    label: string
    title: string
    subtitle?: string
    details?: PdfVisualDetail[]
    badges?: string[]
    sections?: PdfVisualSection[]
    breakBefore?: boolean
}): PdfRenderBlock => ({
    kind: "visual-card",
    label,
    title,
    subtitle,
    details: compactDetails(details),
    badges: badges.filter(Boolean),
    sections: compactSections(sections),
    breakBefore,
})

export const dateValue = (value: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(stringFrom(value)) ? stringFrom(value) : "")

export const timeValue = (value: unknown) => (/^\d{2}:\d{2}$/.test(stringFrom(value)) ? stringFrom(value) : "")

export const timelineEventsFromData = (value: unknown) => {
    const asArray = objectArrayFrom(value)
    if (asArray.length > 0) return asArray
    if (!value || typeof value !== "object" || Array.isArray(value)) return []

    const eventRecord = value as Record<string, unknown>
    const candidates = Object.values(eventRecord).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    if (candidates.length > 0) return candidates

    return "label" in eventRecord || "date" in eventRecord || "time" in eventRecord ? [eventRecord] : []
}

export const timelineSchedule = (eventItem: Record<string, unknown>) => {
    const date = dateValue(eventItem.date)
    const time = timeValue(eventItem.time)
    if (date && time) return `${date} at ${time}`

    return date || time || "Unscheduled"
}

export const checkedLine = (isChecked: boolean, label: string, detail = "") => joinParts([`${isChecked ? "[x]" : "[ ]"} ${label}`, detail])

export const countLabel = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`
