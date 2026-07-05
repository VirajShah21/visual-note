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
const isFenceBoundary = (line: string) => {
    const trimmed = line.trim()
    return trimmed.startsWith("```") || trimmed.startsWith("~~~")
}

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

const nextContentLine = (lines: string[], startIndex: number) => {
    for (let index = startIndex; index < lines.length; index += 1) if (lines[index].trim()) return lines[index]

    return ""
}

const structuralTopicMarkerValue = (lines: string[], index: number, topics: Topic[]) => {
    const topicId = markerValue(lines[index], TOPIC_MARKER_PREFIX)
    if (!topicId) return null

    const topic = topics.find(item => item.id === topicId)
    if (!topic) return null
    if (!topicHeadingMatches(nextContentLine(lines, index + 1), topic)) return null

    return topicId
}

const structuralViewMarkerValue = (lines: string[], index: number, topicViews: NotebookView[]) => {
    const viewId = markerValue(lines[index], VIEW_MARKER_PREFIX)
    if (!viewId) return null

    const view = topicViews.find(item => item.id === viewId)
    if (!view) return null
    if (!viewHeadingMatches(nextContentLine(lines, index + 1), view)) return null

    return viewId
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

const topicSectionsFromMarkers = (lines: string[], topics: Topic[]) => {
    const sections = new Map<string, string[]>()
    let activeTopicId: string | null = null
    let activeLines: string[] = []
    let isInFence = false

    lines.forEach((line, index) => {
        const topicId = isInFence ? null : structuralTopicMarkerValue(lines, index, topics)
        if (topicId) {
            if (activeTopicId) sections.set(activeTopicId, activeLines)
            activeTopicId = topicId
            activeLines = []
            return
        }

        if (activeTopicId) activeLines.push(line)
        if (isFenceBoundary(line)) isInFence = !isInFence
    })

    if (activeTopicId) sections.set(activeTopicId, activeLines)
    return sections
}

const contentByViewIdFromMarkers = (topicLines: string[], topicViews: NotebookView[]) => {
    const contentByViewId = new Map<string, string>()
    let activeViewId: string | null = null
    let activeLines: string[] = []
    let isInFence = false

    const commit = () => {
        if (!activeViewId) return

        const view = topicViews.find(item => item.id === activeViewId)
        const contentLines = view ? removeHeading(activeLines, line => viewHeadingMatches(line, view)) : activeLines
        contentByViewId.set(activeViewId, trimSectionLines(contentLines))
    }

    topicLines.forEach((line, index) => {
        const viewId = isInFence ? null : structuralViewMarkerValue(topicLines, index, topicViews)
        if (viewId) {
            commit()
            activeViewId = viewId
            activeLines = []
            return
        }

        if (activeViewId) activeLines.push(line)
        if (isFenceBoundary(line)) isInFence = !isInFence
    })

    commit()
    return contentByViewId
}

const hydrateViewsFromMarkedMarkdown = (topics: Topic[], views: NotebookView[], lines: string[]) => {
    const sections = topicSectionsFromMarkers(lines, topics)
    if (sections.size === 0) return null

    return views.map(view => {
        const topic = topics.find(item => item.id === view.topicId)
        if (!topic) return view

        const topicLines = sections.get(topic.id)
        if (!topicLines) return view

        const topicViews = views.filter(item => item.topicId === topic.id)
        const topicContentLines = removeHeading(topicLines, line => topicHeadingMatches(line, topic))
        const contentByViewId = contentByViewIdFromMarkers(topicContentLines, topicViews)
        if (contentByViewId.size > 0) return contentByViewId.has(view.id) ? { ...view, content: contentByViewId.get(view.id) ?? "" } : view

        const selectedView = topicViews.find(item => item.mode === "article") ?? topicViews[0] ?? null
        if (selectedView?.id !== view.id) return view

        return { ...view, content: trimSectionLines(topicContentLines) }
    })
}

export const pageMarkdownHasAllViewMarkers = (markdown: string, topics: Topic[], views: NotebookView[]) => {
    const orderedTopics = [...topics].sort((first, second) => first.position - second.position)
    const lines = markdown.replace(/\r\n/g, "\n").split("\n")
    const sections = topicSectionsFromMarkers(lines, orderedTopics)
    if (sections.size === 0) return false

    return orderedTopics.every(topic => {
        const topicViews = views.filter(view => view.topicId === topic.id)
        if (topicViews.length === 0) return true

        const topicLines = sections.get(topic.id)
        if (!topicLines) return false

        const contentByViewId = contentByViewIdFromMarkers(
            removeHeading(topicLines, line => topicHeadingMatches(line, topic)),
            topicViews,
        )
        return topicViews.every(view => contentByViewId.has(view.id))
    })
}

export const pageMarkdownHasTopicSections = (markdown: string, topics: Topic[]) => {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n")
    return topics.some(topic => findTopicHeadingIndex(lines, topic, 0) >= 0)
}

export const mergePlainPageMarkdownIntoViews = (topics: Topic[], views: NotebookView[], markdown: string): NotebookView[] => {
    if (pageMarkdownHasTopicSections(markdown, topics)) return hydrateViewsFromPageMarkdown(topics, views, markdown)

    const firstTopic = [...topics].sort((first, second) => first.position - second.position)[0]
    if (!firstTopic) return views

    const topicViews = views.filter(view => view.topicId === firstTopic.id)
    const selectedView = topicViews.find(view => view.mode === "article") ?? topicViews[0] ?? null
    if (!selectedView) return views

    return views.map(view => (view.id === selectedView.id ? { ...view, content: markdown } : view))
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
        if (selectedView?.id !== view.id) return view

        return contentByTopicId.has(topic.id) ? { ...view, content: contentByTopicId.get(topic.id) ?? "" } : view
    })
}
