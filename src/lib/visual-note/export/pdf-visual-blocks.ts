import type { ArticleBlock } from "../article-content"
import { chartDatasetFromData, chartTypeFrom } from "../chart-data"
import { visualBlockLabel, type VisualBlockData } from "../visual-blocks"
import { assetUrlFor } from "./assets"
import {
    arrayFrom,
    checkedLine,
    countLabel,
    dataBlock,
    dateValue,
    joinParts,
    numberFrom,
    objectArrayFrom,
    stringFrom,
    timelineEventsFromData,
    timelineSchedule,
    timeValue,
    visualCard,
} from "./pdf-visual-block-utils"
import type { ExportRenderContext, PdfImageSize, PdfRenderBlock } from "./types"

const isPrivateAssetUrl = (source: string) => /^\/api\/assets\/[^/?#]+/i.test(source.trim())

const imageSizeFrom = (value: unknown): PdfImageSize => {
    const size = stringFrom(value, "full")
    if (size === "wide" || size === "medium" || size === "small") return size

    return "full"
}

export const createPdfImageBlocks = ({
    source,
    alt,
    title = "",
    caption = "",
    overlayText = "",
    size = "full",
    borderRadius = 0,
    borderWidth = 0,
    context,
    breakBefore = false,
}: {
    source: string
    alt: string
    title?: string
    caption?: string
    overlayText?: string
    size?: PdfImageSize
    borderRadius?: number
    borderWidth?: number
    context: ExportRenderContext
    breakBefore?: boolean
}): PdfRenderBlock[] => {
    if (context.assetMode === "ignore") return []

    const url = assetUrlFor(source, context.assetMode, context.assetResolution)
    if (!url || isPrivateAssetUrl(url)) return [visualCard({ label: "Image", title: alt || title || "Image", subtitle: "Image asset could not be embedded.", breakBefore })]

    return [{ kind: "image", alt, url, title, caption, overlayText, size, borderRadius, borderWidth, breakBefore }]
}

const calendarSchedule = (data: VisualBlockData) => {
    const date = dateValue(data.date)
    const start = timeValue(data.startTime)
    const end = timeValue(data.endTime)
    const time = start && end ? `${start}-${end}` : start || end
    if (date && time) return `${date} at ${time}`

    return date || time || "Unscheduled"
}
const pullRequestBlock = (data: VisualBlockData, breakBefore: boolean) => {
    const reviewers = arrayFrom(data.reviewers)

    return visualCard({
        label: "Pull Request",
        title: stringFrom(data.title, "Pull request title"),
        subtitle: `${stringFrom(data.author, "Unknown author")} wants to merge ${stringFrom(data.headBranch, "branch")} into ${stringFrom(data.baseBranch, "base")}.`,
        details: [
            { label: "Number", value: stringFrom(data.number) },
            { label: "Status", value: stringFrom(data.status, "Open") },
            { label: "Source", value: stringFrom(data.source) },
            { label: "URL", value: stringFrom(data.url) },
        ],
        badges: arrayFrom(data.labels),
        sections: [
            { title: "Reviewers", lines: reviewers },
            { title: "Notes", lines: arrayFrom(data.notes) },
        ],
        breakBefore,
    })
}

const calendarEventBlock = (data: VisualBlockData, breakBefore: boolean) =>
    visualCard({
        label: "Calendar Event",
        title: stringFrom(data.title, "Event"),
        subtitle: calendarSchedule(data),
        details: [
            { label: "Location", value: stringFrom(data.location) },
            { label: "Attendees", value: countLabel(arrayFrom(data.attendees).length, "attendee") },
        ],
        sections: [
            { title: "Attendees", lines: arrayFrom(data.attendees) },
            { title: "Notes", lines: [stringFrom(data.notes)] },
        ],
        breakBefore,
    })

const contactCardBlock = (data: VisualBlockData, breakBefore: boolean) =>
    visualCard({
        label: "Contact Card",
        title: stringFrom(data.name, "Contact"),
        subtitle: joinParts([stringFrom(data.role), stringFrom(data.company)]),
        details: [
            { label: "Email", value: stringFrom(data.email) },
            { label: "Phone", value: stringFrom(data.phone) },
        ],
        sections: [{ title: "Links", lines: arrayFrom(data.links) }],
        breakBefore,
    })

const addressCardBlock = (data: VisualBlockData, breakBefore: boolean) =>
    visualCard({
        label: "Address Card",
        title: stringFrom(data.label, "Address"),
        subtitle: arrayFrom(data.lines).join(", "),
        details: [
            { label: "Map URL", value: stringFrom(data.mapUrl) },
            { label: "Notes", value: stringFrom(data.notes) },
        ],
        sections: [{ title: "Address", lines: arrayFrom(data.lines) }],
        breakBefore,
    })

const packingListBlock = (data: VisualBlockData, breakBefore: boolean) => {
    const sections = objectArrayFrom(data.sections)
    const allItems = sections.flatMap(section => objectArrayFrom(section.items))
    const packed = allItems.filter(item => Boolean(item.packed)).length

    return visualCard({
        label: "Packing List",
        title: stringFrom(data.title, "Packing List"),
        subtitle: `${countLabel(sections.length, "section")} - ${packed}/${allItems.length} packed`,
        sections: sections.map((section, index) => ({
            title: stringFrom(section.title, `Section ${index + 1}`),
            lines: objectArrayFrom(section.items).map(item => checkedLine(Boolean(item.packed), stringFrom(item.label, "Item"))),
        })),
        breakBefore,
    })
}

const recipeBlock = (data: VisualBlockData, breakBefore: boolean) => {
    const ingredients = objectArrayFrom(data.ingredients)
    const steps = arrayFrom(data.steps)

    return visualCard({
        label: "Recipe",
        title: stringFrom(data.title, "Recipe"),
        subtitle: joinParts([`Portions: ${stringFrom(data.basePortions, "1")}`, countLabel(ingredients.length, "ingredient"), countLabel(steps.length, "step")]),
        sections: [
            {
                title: "Ingredients",
                lines: ingredients.map(ingredient =>
                    joinParts([joinParts([stringFrom(ingredient.quantity), stringFrom(ingredient.unit)]), stringFrom(ingredient.name, "Ingredient")]),
                ),
            },
            { title: "Steps", lines: steps.map((step, index) => `${index + 1}. ${step}`) },
        ],
        breakBefore,
    })
}

const taskListBlock = (data: VisualBlockData, breakBefore: boolean) => {
    const tasks = objectArrayFrom(data.tasks)
    const completed = tasks.filter(task => Boolean(task.done)).length

    return visualCard({
        label: "Task List",
        title: stringFrom(data.title, "Task List"),
        subtitle: `${completed}/${tasks.length} tasks complete`,
        sections: [
            {
                title: "Tasks",
                lines: tasks.map(task => checkedLine(Boolean(task.done), stringFrom(task.title, "Task"), joinParts([stringFrom(task.owner), stringFrom(task.dueDate)]))),
            },
        ],
        breakBefore,
    })
}

const shoppingListBlock = (data: VisualBlockData, breakBefore: boolean) => {
    const items = objectArrayFrom(data.items)
    const purchased = items.filter(item => Boolean(item.purchased)).length

    return visualCard({
        label: "Shopping List",
        title: stringFrom(data.title, "Shopping List"),
        subtitle: `${purchased}/${items.length} items purchased`,
        sections: [{ title: "Items", lines: items.map(item => checkedLine(Boolean(item.purchased), stringFrom(item.name, "Item"), stringFrom(item.quantity))) }],
        breakBefore,
    })
}

const timelineBlock = (data: VisualBlockData, breakBefore: boolean) => {
    const events = timelineEventsFromData(data.events)

    return visualCard({
        label: "Timeline",
        title: stringFrom(data.title, "Timeline"),
        subtitle: countLabel(events.length, "event"),
        sections: [{ title: "Events", lines: events.map(eventItem => joinParts([timelineSchedule(eventItem), stringFrom(eventItem.label, "Event")])) }],
        breakBefore,
    })
}

const pollBlock = (data: VisualBlockData, breakBefore: boolean): PdfRenderBlock => {
    const options = objectArrayFrom(data.options)
    const totalVotes = options.reduce((total, option) => total + numberFrom(option.votes, 0), 0)

    return {
        kind: "poll",
        question: stringFrom(data.question, "Poll question"),
        totalVotes,
        options: options.map((option, index) => {
            const votes = numberFrom(option.votes, 0)

            return {
                label: stringFrom(option.label, `Option ${index + 1}`),
                votes,
                percent: totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0,
            }
        }),
        breakBefore,
    }
}

const chartBlock = (data: VisualBlockData, breakBefore: boolean): PdfRenderBlock => ({
    kind: "chart",
    title: stringFrom(data.title, "Chart"),
    chartType: chartTypeFrom(data.type),
    xLabel: stringFrom(data.xLabel),
    yLabel: stringFrom(data.yLabel),
    dataset: chartDatasetFromData(data),
    breakBefore,
})

export const createPdfVisualBlocks = (block: Extract<ArticleBlock, { kind: "visual" }>, context: ExportRenderContext, breakBefore = false): PdfRenderBlock[] => {
    if (block.parseError) return [dataBlock(visualBlockLabel(block.visualKind), block.raw, breakBefore)]
    if (block.visualKind === "image")
        return createPdfImageBlocks({
            source: stringFrom(block.data.url),
            alt: stringFrom(block.data.alt, "Image"),
            title: stringFrom(block.data.title),
            caption: stringFrom(block.data.caption),
            overlayText: stringFrom(block.data.overlayText),
            size: imageSizeFrom(block.data.size),
            borderRadius: numberFrom(block.data.borderRadius, 0),
            borderWidth: numberFrom(block.data.borderWidth, 0),
            context,
            breakBefore,
        })
    if (block.visualKind === "pull-request") return [pullRequestBlock(block.data, breakBefore)]
    if (block.visualKind === "calendar-event") return [calendarEventBlock(block.data, breakBefore)]
    if (block.visualKind === "contact-card") return [contactCardBlock(block.data, breakBefore)]
    if (block.visualKind === "address-card") return [addressCardBlock(block.data, breakBefore)]
    if (block.visualKind === "packing-list") return [packingListBlock(block.data, breakBefore)]
    if (block.visualKind === "recipe") return [recipeBlock(block.data, breakBefore)]
    if (block.visualKind === "task-list") return [taskListBlock(block.data, breakBefore)]
    if (block.visualKind === "shopping-list") return [shoppingListBlock(block.data, breakBefore)]
    if (block.visualKind === "timeline") return [timelineBlock(block.data, breakBefore)]
    if (block.visualKind === "poll") return [pollBlock(block.data, breakBefore)]
    if (block.visualKind === "chart") return [chartBlock(block.data, breakBefore)]

    return [dataBlock(visualBlockLabel(block.visualKind), block.data, breakBefore)]
}
