"use client"

import { Toast } from "@base-ui/react/toast"
import { X } from "lucide-react"
import { useEffect, useMemo, useRef } from "react"
import { cx } from "./class-name"
import styles from "./feedback.module.css"

export type ToastTone = "success" | "info" | "error"

export type ToastMessage = {
    id: string
    title: string
    description?: string
    tone?: ToastTone
}

type ToastShelfProps = {
    messages: ToastMessage[]
    onDismiss: (id: string) => void
}

export function ToastShelf({ messages, onDismiss }: ToastShelfProps) {
    if (messages.length === 0) return null

    return (
        <Toast.Provider timeout={4200}>
            <ToastShelfContent messages={messages} onDismiss={onDismiss} />
        </Toast.Provider>
    )
}

function ToastShelfContent({ messages, onDismiss }: ToastShelfProps) {
    const manager = Toast.useToastManager()
    const activeIds = useMemo(() => new Set(messages.map(message => message.id)), [messages])
    const addedIds = useRef(new Set<string>())
    const closingIds = useRef(new Set<string>())

    useEffect(() => {
        messages.forEach(message => {
            if (addedIds.current.has(message.id)) return

            addedIds.current.add(message.id)
            manager.add({
                id: message.id,
                title: message.title,
                description: message.description,
                type: message.tone,
                priority: message.tone === "error" ? "high" : "low",
                onClose: () => {
                    addedIds.current.delete(message.id)
                    closingIds.current.delete(message.id)
                    onDismiss(message.id)
                },
            })
        })
    }, [manager, messages, onDismiss])

    useEffect(() => {
        manager.toasts.forEach(toast => {
            if (activeIds.has(toast.id) || closingIds.current.has(toast.id)) return

            closingIds.current.add(toast.id)
            manager.close(toast.id)
        })
    }, [activeIds, manager])

    return (
        <Toast.Viewport className={styles.viewport}>
            {manager.toasts.map(toast => (
                <Toast.Root key={toast.id} className={cx(styles.toast, toast.type === "error" && styles.error)} toast={toast}>
                    <Toast.Content className={styles.content}>
                        <Toast.Title className={styles.title} />
                        <Toast.Description className={styles.description} />
                    </Toast.Content>
                    <Toast.Close className={styles.close} aria-label="Dismiss notification">
                        <X size={14} />
                    </Toast.Close>
                </Toast.Root>
            ))}
        </Toast.Viewport>
    )
}
