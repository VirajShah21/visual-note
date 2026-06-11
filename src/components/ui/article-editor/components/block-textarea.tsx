"use client"

import { motion } from "motion/react"
import { useLayoutEffect, useRef, type ComponentProps } from "react"

export type BlockTextareaProps = ComponentProps<typeof motion.textarea> & {
    value: string
}

export function BlockTextarea({ value, className, ...props }: BlockTextareaProps) {
    const inputRef = useRef<HTMLTextAreaElement | null>(null)

    useLayoutEffect(() => {
        const input = inputRef.current
        if (!input) return

        input.style.height = "auto"
        input.style.height = `${input.scrollHeight}px`
    }, [value])

    return (
        <motion.textarea
            ref={inputRef}
            className={className}
            value={value}
            rows={1}
            initial={{ opacity: 0.98 }}
            animate={{ opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 24 }}
            {...props}
        />
    )
}
