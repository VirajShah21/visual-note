import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react"

type BlockSelectionDrag = {
    anchorIndex: number
    pointerId: number
}

type BlockSelectionState = {
    anchorIndex: number
    currentIndex: number
    isActive: boolean
    value: string
}

export type BlockSelectionRange = {
    start: number
    end: number
}

type BlockSelectionHandlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void
    onPointerMove: (event: PointerEvent<HTMLElement>) => void
    onPointerUp: (event: PointerEvent<HTMLElement>) => void
}

export const useArticleBlockSelection = (editorRef: RefObject<HTMLDivElement | null>, value: string) => {
    const dragRef = useRef<BlockSelectionDrag | null>(null)
    const [selection, setSelection] = useState<BlockSelectionState | null>(null)
    const selectedBlockRange =
        selection?.isActive && selection.value === value
            ? {
                  start: Math.min(selection.anchorIndex, selection.currentIndex),
                  end: Math.max(selection.anchorIndex, selection.currentIndex),
              }
            : null

    const clearSelection = useCallback(() => {
        dragRef.current = null
        setSelection(null)
    }, [])

    useEffect(() => {
        const dismissSelection = (event: globalThis.KeyboardEvent) => {
            if (event.key !== "Escape") return

            clearSelection()
        }

        document.addEventListener("keydown", dismissSelection)
        return () => document.removeEventListener("keydown", dismissSelection)
    }, [clearSelection])

    useEffect(() => {
        dragRef.current = null
    }, [value])

    const blockIndexFromPoint = useCallback(
        (clientY: number) => {
            const rows = Array.from(editorRef.current?.querySelectorAll<HTMLElement>("[data-article-block-index]") ?? [])
            if (rows.length === 0) return null

            let closestIndex: number | null = null
            let closestDistance = Number.POSITIVE_INFINITY

            for (const row of rows) {
                const rect = row.getBoundingClientRect()
                const blockIndex = Number(row.dataset.articleBlockIndex)
                if (!Number.isFinite(blockIndex)) continue
                if (clientY >= rect.top && clientY <= rect.bottom) return blockIndex

                const distance = Math.min(Math.abs(clientY - rect.top), Math.abs(clientY - rect.bottom))
                if (distance < closestDistance) {
                    closestDistance = distance
                    closestIndex = blockIndex
                }
            }

            return closestIndex
        },
        [editorRef],
    )

    const clearBrowserSelection = useCallback(() => {
        window.getSelection()?.removeAllRanges()
        if (document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur()
    }, [])

    const onPointerDown = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            if (event.button !== 0) return

            const target = event.target as HTMLElement
            if (target.closest("button, a, input, select")) {
                clearSelection()
                return
            }

            const row = target.closest<HTMLElement>("[data-article-block-index]")
            if (!row) {
                clearSelection()
                return
            }

            const blockIndex = Number(row.dataset.articleBlockIndex)
            if (!Number.isFinite(blockIndex)) return

            dragRef.current = { anchorIndex: blockIndex, pointerId: event.pointerId }
            setSelection(null)
            event.currentTarget.setPointerCapture(event.pointerId)
        },
        [clearSelection],
    )

    const onPointerMove = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            const drag = dragRef.current
            if (!drag || drag.pointerId !== event.pointerId) return

            const currentIndex = blockIndexFromPoint(event.clientY)
            if (currentIndex == null) return
            if (currentIndex === drag.anchorIndex) return

            event.preventDefault()
            clearBrowserSelection()
            setSelection({ anchorIndex: drag.anchorIndex, currentIndex, isActive: true, value })
        },
        [blockIndexFromPoint, clearBrowserSelection, value],
    )

    const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return

        dragRef.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }, [])

    const selectionHandlers: BlockSelectionHandlers = {
        onPointerDown,
        onPointerMove,
        onPointerUp,
    }

    return { selectedBlockRange, selectionHandlers, clearSelection }
}
