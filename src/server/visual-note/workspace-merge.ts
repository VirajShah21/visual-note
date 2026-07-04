import type { VisualNoteWorkspace } from "@/lib/visual-note/types"

type MergeResult = { ok: true; workspace: VisualNoteWorkspace } | { ok: false; conflicts: string[] }

const serialize = (value: unknown) => JSON.stringify(value)

const mergeCollection = <T>(base: T[], current: T[], incoming: T[], idFor: (item: T) => string, label: string) => {
    const baseById = new Map(base.map(item => [idFor(item), item]))
    const currentById = new Map(current.map(item => [idFor(item), item]))
    const incomingById = new Map(incoming.map(item => [idFor(item), item]))
    const ids = new Set([...baseById.keys(), ...currentById.keys(), ...incomingById.keys()])
    const conflicts: string[] = []
    const merged: T[] = []

    ids.forEach(id => {
        const baseItem = baseById.get(id)
        const currentItem = currentById.get(id)
        const incomingItem = incomingById.get(id)

        if (!baseItem) {
            if (currentItem && incomingItem && serialize(currentItem) !== serialize(incomingItem)) conflicts.push(`${label}:${id}`)
            else if (incomingItem) merged.push(incomingItem)
            else if (currentItem) merged.push(currentItem)
            return
        }

        const currentChanged = serialize(currentItem) !== serialize(baseItem)
        const incomingChanged = serialize(incomingItem) !== serialize(baseItem)
        if (currentChanged && incomingChanged && serialize(currentItem) !== serialize(incomingItem)) {
            conflicts.push(`${label}:${id}`)
            return
        }

        if (incomingChanged) {
            if (incomingItem) merged.push(incomingItem)
            return
        }
        if (currentItem) merged.push(currentItem)
    })

    return { conflicts, merged }
}

export const mergeWorkspaceFromBase = (base: VisualNoteWorkspace, current: VisualNoteWorkspace, incoming: VisualNoteWorkspace): MergeResult => {
    const notebooks = mergeCollection(base.notebooks, current.notebooks, incoming.notebooks, item => item.id, "notebook")
    const pages = mergeCollection(base.pages, current.pages, incoming.pages, item => item.id, "page")
    const topics = mergeCollection(base.topics, current.topics, incoming.topics, item => item.id, "topic")
    const views = mergeCollection(base.views, current.views, incoming.views, item => item.id, "view")
    const snapshots = mergeCollection(base.snapshots ?? [], current.snapshots ?? [], incoming.snapshots ?? [], item => item.id, "snapshot")
    const conflicts = [...notebooks.conflicts, ...pages.conflicts, ...topics.conflicts, ...views.conflicts, ...snapshots.conflicts]

    if (conflicts.length > 0) return { ok: false, conflicts }

    return {
        ok: true,
        workspace: {
            notebooks: notebooks.merged,
            pages: pages.merged,
            snapshots: snapshots.merged,
            topics: topics.merged,
            views: views.merged,
        },
    }
}
