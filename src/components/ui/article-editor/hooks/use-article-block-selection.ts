import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react"

type BlockSelectionDrag = {
    anchorIndex: number
    isSelecting: boolean
    pointerId: number
    startX: number
    startY: number
}

type BlockSelectionState = {
    end: number
    isActive: boolean
    start: number
    value: string
}

export type BlockSelectionRange = {
    start: number
    end: number
}

export type BlockSelectionRect = {
    height: number
    left: number
    top: number
    width: number
}

type BlockSelectionRectState = BlockSelectionRect & {
    value: string
}

type BlockSelectionHandlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void
    onPointerMove: (event: PointerEvent<HTMLElement>) => void
    onPointerUp: (event: PointerEvent<HTMLElement>) => void
}

const DRAG_SELECTION_THRESHOLD = 5
const interactiveSelectionBlocker = "button, a, input, select"
const nativeTextSelectionSurface = "textarea, [role='textbox']"

export const useArticleBlockSelection = (editorRef: RefObject<HTMLDivElement | null>, value: string) => {
    const dragRef = useRef<BlockSelectionDrag | null>(null)
    const [selection, setSelection] = useState<BlockSelectionState | null>(null)
    const [selectionRect, setSelectionRect] = useState<BlockSelectionRectState | null>(null)
    const selectedBlockRange =
        selection?.isActive && selection.value === value
            ? {
                  start: selection.start,
                  end: selection.end,
              }
            : null
    const activeSelectionRect = selectionRect?.value === value ? selectionRect : null

    const clearSelection = useCallback(() => {
        dragRef.current = null
        setSelection(null)
        setSelectionRect(null)
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

    const selectedBlockRangeFromRect = useCallback(
        (rect: DOMRect) => {
            const rows = Array.from(editorRef.current?.querySelectorAll<HTMLElement>("[data-article-block-index]") ?? [])
            if (rows.length === 0) return null

            let start: number | null = null
            let end: number | null = null

            for (const row of rows) {
                const rowRect = row.getBoundingClientRect()
                const blockIndex = Number(row.dataset.articleBlockIndex)
                if (!Number.isFinite(blockIndex)) continue
                if (rowRect.left > rect.right || rowRect.right < rect.left || rowRect.top > rect.bottom || rowRect.bottom < rect.top) continue

                start = start == null ? blockIndex : Math.min(start, blockIndex)
                end = end == null ? blockIndex : Math.max(end, blockIndex)
            }

            return start == null || end == null ? null : { start, end }
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
            if (target.closest(nativeTextSelectionSurface)) {
                clearSelection()
                return
            }

            if (target.closest(interactiveSelectionBlocker)) {
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

            dragRef.current = { anchorIndex: blockIndex, isSelecting: false, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY }
            setSelection(null)
            setSelectionRect(null)
            event.currentTarget.setPointerCapture(event.pointerId)
        },
        [clearSelection],
    )

    const onPointerMove = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            const drag = dragRef.current
            if (!drag || drag.pointerId !== event.pointerId) return

            const distanceX = event.clientX - drag.startX
            const distanceY = event.clientY - drag.startY
            if (!drag.isSelecting && Math.hypot(distanceX, distanceY) < DRAG_SELECTION_THRESHOLD) return

            const editor = editorRef.current
            if (!editor) return

            drag.isSelecting = true
            const editorRect = editor.getBoundingClientRect()
            const left = Math.min(drag.startX, event.clientX)
            const top = Math.min(drag.startY, event.clientY)
            const right = Math.max(drag.startX, event.clientX)
            const bottom = Math.max(drag.startY, event.clientY)
            const rect = new DOMRect(left, top, right - left, bottom - top)
            const blockRange = selectedBlockRangeFromRect(rect) ?? { start: drag.anchorIndex, end: drag.anchorIndex }

            event.preventDefault()
            clearBrowserSelection()
            setSelectionRect({ height: rect.height, left: left - editorRect.left, top: top - editorRect.top, value, width: rect.width })
            setSelection({ ...blockRange, isActive: true, value })
        },
        [clearBrowserSelection, editorRef, selectedBlockRangeFromRect, value],
    )

    const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return

        dragRef.current = null
        setSelectionRect(null)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }, [])

    const selectionHandlers: BlockSelectionHandlers = {
        onPointerDown,
        onPointerMove,
        onPointerUp,
    }

    return { selectedBlockRange, selectionHandlers, selectionRect: activeSelectionRect, clearSelection }
}
