"use client"

import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"
import { useEffect } from "react"
import { Button } from "./button"
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
    useEffect(() => {
        const timers = messages.map(message => window.setTimeout(() => onDismiss(message.id), 4200))

        return () => timers.forEach(timer => window.clearTimeout(timer))
    }, [messages, onDismiss])

    if (messages.length === 0) return null

    return (
        <div className={styles.viewport} aria-live="polite" aria-relevant="additions">
            <AnimatePresence initial={false}>
                {messages.map(message => (
                    <motion.div
                        key={message.id}
                        className={cx(styles.toast, message.tone === "error" && styles.error)}
                        role={message.tone === "error" ? "alert" : "status"}
                        initial={{ opacity: 0, x: 20, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 210, damping: 24 }}
                    >
                        <div>
                            <p className={styles.title}>{message.title}</p>
                            {message.description ? <p className={styles.description}>{message.description}</p> : null}
                        </div>
                        <Button className={styles.close} variant="ghost" iconOnly aria-label="Dismiss notification" onClick={() => onDismiss(message.id)}>
                            <X size={14} />
                        </Button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
