import type { NotebookView, Topic } from "@/lib/visual-note/types"

const TOPIC_MARKER_PREFIX = "<!-- visual-note:topic "
const VIEW_MARKER_PREFIX = "<!-- visual-note:view "
const MARKER_SUFFIX = " -->"

export const pageTopicMarker = (topicId: string) => `${TOPIC_MARKER_PREFIX}${topicId}${MARKER_SUFFIX}`
export const pageViewMarker = (viewId: string) => `${VIEW_MARKER_PREFIX}${viewId}${MARKER_SUFFIX}`

const stripViewContent = (view: NotebookView): NotebookView => ({ ...view, content: "" })
const normalizedHeading = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase()
const topicHeadingMatches = (line: string, topic: Topic) => normalizedHeading(line) === normalizedHeading(`## ${topic.title}`)
const viewHeadingMatches = (line: string, view: NotebookView) => normalizedHeading(line) === normalizedHeading(`### ${view.title}`)

const markerValue = (line: string, prefix: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith(prefix) || !trimmed.endsWith(MARKER_SUFFIX)) return null

    return trimmed.slice(prefix.length, -MARKER_SUFFIX.length).trim() || null
}

const trimSectionLines = (lines: string[]) => {
    let start = 0
    let end = lines.length
    while (start < end && lines[start].trim() === "") start += 1
    while (end > start && lines[end - 1].trim() === "") end -= 1

    return lines.slice(start, end).join("\n")
}

const findTopicHeadingIndex = (lines: string[], topic: Topic, startIndex: number) => {
    for (let index = startIndex; index < lines.length; index += 1) if (topicHeadingMatches(lines[index], topic)) return index

    return -1
}

const removeHeading = (lines: string[], matchesHeading: (line: string) => boolean) => {
    const next = [...lines]
    while (next.length > 0 && next[0].trim() === "") next.shift()
    if (next.length > 0 && matchesHeading(next[0])) next.shift()

    return next
}

const topicSectionsFromMarkers = (lines: string[]) => {
    const sections = new Map<string, string[]>()
    let activeTopicId: string | null = null
    let activeLines: string[] = []

    lines.forEach(line => {
        const topicId = markerValue(line, TOPIC_MARKER_PREFIX)
        if (topicId) {
            if (activeTopicId) sections.set(activeTopicId, activeLines)
            activeTopicId = topicId
            activeLines = []
            return
        }

        if (activeTopicId) activeLines.push(line)
    })

    if (activeTopicId) sections.set(activeTopicId, activeLines)
    return sections
}

const contentByViewIdFromMarkers = (topicLines: string[], topicViews: NotebookView[]) => {
    const contentByViewId = new Map<string, string>()
    let activeViewId: string | null = null
    let activeLines: string[] = []

    const commit = () => {
        if (!activeViewId) return

        const view = topicViews.find(item => item.id === activeViewId)
        const contentLines = view ? removeHeading(activeLines, line => viewHeadingMatches(line, view)) : activeLines
        contentByViewId.set(activeViewId, trimSectionLines(contentLines))
    }

    topicLines.forEach(line => {
        const viewId = markerValue(line, VIEW_MARKER_PREFIX)
        if (viewId) {
            commit()
            activeViewId = viewId
            activeLines = []
            return
        }

        if (activeViewId) activeLines.push(line)
    })

    commit()
    return contentByViewId
}

const hydrateViewsFromMarkedMarkdown = (topics: Topic[], views: NotebookView[], lines: string[]) => {
    const sections = topicSectionsFromMarkers(lines)
    if (sections.size === 0) return null

    return views.map(view => {
        const topic = topics.find(item => item.id === view.topicId)
        if (!topic) return stripViewContent(view)

        const topicLines = sections.get(topic.id)
        if (!topicLines) return stripViewContent(view)

        const topicViews = views.filter(item => item.topicId === topic.id)
        const topicContentLines = removeHeading(topicLines, line => topicHeadingMatches(line, topic))
        const contentByViewId = contentByViewIdFromMarkers(topicContentLines, topicViews)
        if (contentByViewId.size > 0) return { ...view, content: contentByViewId.get(view.id) ?? "" }

        const selectedView = topicViews.find(item => item.mode === "article") ?? topicViews[0] ?? null
        if (selectedView?.id !== view.id) return stripViewContent(view)

        return { ...view, content: trimSectionLines(topicContentLines) }
    })
}

export const hydrateViewsFromPageMarkdown = (topics: Topic[], views: NotebookView[], markdown: string | null | undefined): NotebookView[] => {
    if (markdown == null) return views

    const orderedTopics = [...topics].sort((first, second) => first.position - second.position)
    const lines = markdown.replace(/\r\n/g, "\n").split("\n")
    const markedViews = hydrateViewsFromMarkedMarkdown(orderedTopics, views, lines)
    if (markedViews) return markedViews

    const contentByTopicId = new Map<string, string>()
    let cursor = 0

    orderedTopics.forEach((topic, index) => {
        const headingIndex = findTopicHeadingIndex(lines, topic, cursor)
        if (headingIndex < 0) return

        const nextTopic = orderedTopics[index + 1]
        const nextHeadingIndex = nextTopic ? findTopicHeadingIndex(lines, nextTopic, headingIndex + 1) : -1
        const endIndex = nextHeadingIndex < 0 ? lines.length : nextHeadingIndex
        contentByTopicId.set(topic.id, trimSectionLines(lines.slice(headingIndex + 1, endIndex)))
        cursor = endIndex
    })

    return views.map(view => {
        const topic = orderedTopics.find(item => item.id === view.topicId)
        if (!topic) return stripViewContent(view)

        const topicViews = views.filter(item => item.topicId === topic.id)
        const selectedView = topicViews.find(item => item.mode === "article") ?? topicViews[0] ?? null
        if (selectedView?.id !== view.id) return stripViewContent(view)

        return { ...view, content: contentByTopicId.get(topic.id) ?? "" }
    })
}
