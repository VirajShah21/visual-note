import JSON5 from "json5"

export const visualBlockKinds = ["pull-request", "calendar-event", "packing-list", "contact-card", "address-card", "chart", "recipe", "task-list", "shopping-list", "timeline", "poll"] as const

export type VisualBlockKind = (typeof visualBlockKinds)[number]

export type VisualBlockData = Record<string, unknown>

export const isVisualBlockKind = (value: string): value is VisualBlockKind => visualBlockKinds.includes(value as VisualBlockKind)

export const visualBlockLabel = (kind: VisualBlockKind) =>
    kind
        .split("-")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")

export const defaultVisualBlockData = (kind: VisualBlockKind): VisualBlockData => {
    if (kind === "pull-request")
        return {
            source: "github",
            url: "https://github.com/example/visual-note/pull/12",
            title: "Add structured article blocks",
            number: "#12",
            author: "viraj",
            status: "Ready for review",
            reviewers: ["reviewer"],
            notes: ["Verify parser round trips", "Confirm inline rendering"],
        }

    if (kind === "calendar-event")
        return {
            title: "Design review",
            date: "2026-06-11",
            startTime: "10:00",
            endTime: "10:30",
            location: "Conference room",
            attendees: ["Viraj", "Reviewer"],
            notes: "Review the article block insertion flow.",
        }

    if (kind === "packing-list")
        return {
            title: "Weekend trip",
            sections: [
                {
                    title: "Clothing",
                    items: [
                        { label: "Shirts", packed: false },
                        { label: "Socks", packed: false },
                    ],
                },
            ],
        }

    if (kind === "contact-card")
        return {
            name: "Alex Morgan",
            role: "Product lead",
            company: "Example Co",
            email: "alex@example.com",
            phone: "+1 555 0100",
            links: ["https://example.com"],
        }

    if (kind === "address-card")
        return {
            label: "Hotel",
            lines: ["123 Main Street", "New York, NY 10001"],
            mapUrl: "https://maps.google.com/",
            notes: "Check in after 3 PM.",
        }

    if (kind === "chart")
        return {
            title: "Notebook activity",
            type: "bar",
            xLabel: "Day",
            yLabel: "Blocks",
            data: [
                { label: "Mon", value: 4 },
                { label: "Tue", value: 7 },
                { label: "Wed", value: 5 },
            ],
        }

    if (kind === "recipe")
        return {
            title: "Pasta",
            basePortions: 2,
            ingredients: [
                { name: "Pasta", quantity: 200, unit: "g" },
                { name: "Tomato sauce", quantity: 1, unit: "cup" },
            ],
            steps: ["Boil pasta.", "Warm sauce.", "Combine and serve."],
        }

    if (kind === "task-list")
        return {
            title: "Launch checklist",
            tasks: [
                { title: "Finish renderer", done: false, dueDate: "2026-06-11", owner: "Viraj" },
                { title: "Run build", done: false, dueDate: "2026-06-11", owner: "Codex" },
            ],
        }

    if (kind === "shopping-list")
        return {
            title: "Costco for Thanksgiving",
            items: [
                { name: "Cranberries", quantity: "2 bags", purchased: false },
                { name: "Butter", quantity: "4 sticks", purchased: false },
            ],
        }

    if (kind === "timeline")
        return {
            title: "Project timeline",
            events: [
                { label: "Prototype", date: "2026-06-11", time: "09:00" },
                { label: "Review", date: "2026-06-12", time: "" },
            ],
        }

    return {
        question: "Which block should we polish first?",
        options: [
            { label: "Chart", votes: 3 },
            { label: "Recipe", votes: 2 },
        ],
    }
}

export const parseVisualBlockBody = (body: string): { data: VisualBlockData; error?: string } => {
    try {
        const parsed = JSON5.parse(`{\n${body}\n}`)
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { data: {}, error: "Visual block data must be an object body." }

        return { data: parsed as VisualBlockData }
    } catch (error) {
        return { data: {}, error: error instanceof Error ? error.message : "Unable to parse visual block data." }
    }
}

export const serializeVisualBlockBody = (data: VisualBlockData) => {
    const text = JSON5.stringify(data, null, 4)
    if (text === "{}") return ""

    return text.replace(/^\{\n?/, "").replace(/\n?\}$/, "")
}
