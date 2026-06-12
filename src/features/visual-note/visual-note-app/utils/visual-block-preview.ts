import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import { arrayFrom, calendarEventSchedule, numberFrom, objectArrayFrom, stringFrom, timelineEventsFromData, timelineScheduleText } from "./visual-note-app.utils"

export const countLabel = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`

export const joinedPreviewText = (parts: string[], fallback: string) => {
    const text = parts.filter(Boolean).join(" · ")
    return text || fallback
}

export const listCompletionText = (items: Record<string, unknown>[], completeKey: string, itemLabel = "item") => {
    const completed = items.filter(item => Boolean(item[completeKey])).length
    return `${completed}/${items.length} ${items.length === 1 ? itemLabel : `${itemLabel}s`} complete`
}

export const packingListSummary = (data: VisualBlockData) => {
    const sections = objectArrayFrom(data.sections)
    const items = sections.flatMap(section => objectArrayFrom(section.items))
    const packed = items.filter(item => Boolean(item.packed)).length

    return joinedPreviewText([countLabel(sections.length, "section"), `${packed}/${items.length} packed`], "No packing items")
}

export const calendarPreviewText = (data: VisualBlockData) =>
    joinedPreviewText([calendarEventSchedule(data), stringFrom(data.location), countLabel(arrayFrom(data.attendees).length, "attendee")], "Unscheduled event")

export const timelinePreviewText = (data: VisualBlockData) => {
    const events = timelineEventsFromData(data.events)
    const firstEvent = events[0]
    if (!firstEvent) return "No timeline events"

    return joinedPreviewText([countLabel(events.length, "event"), `${stringFrom(firstEvent.label, "First event")} · ${timelineScheduleText(firstEvent)}`], "No timeline events")
}

export const pollPreviewText = (data: VisualBlockData) => {
    const options = objectArrayFrom(data.options)
    const votes = options.reduce((total, option) => total + numberFrom(option.votes, 0), 0)

    return joinedPreviewText([countLabel(options.length, "option"), countLabel(votes, "vote")], "No poll options")
}
