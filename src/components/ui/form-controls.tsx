"use client"

import { Input } from "@base-ui/react/input"
import { motion, type HTMLMotionProps } from "motion/react"
import { createElement } from "react"
import type { ChangeEventHandler, ComponentProps, ReactNode } from "react"
import { cx } from "./class-name"
import styles from "./form-controls.module.css"

type FieldShellProps = {
    label: string
    hint?: string
    error?: string
    children: ReactNode
}

function FieldShell({ label, hint, error, children }: FieldShellProps) {
    return (
        <motion.label className={styles.field} layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 220, damping: 24 }}>
            {createElement("span", { className: styles.label }, label)}
            {children}
            {hint ? createElement("span", { className: styles.hint }, hint) : null}
            {error ? createElement("span", { className: styles.error }, error) : null}
        </motion.label>
    )
}

type TextFieldProps = Omit<ComponentProps<typeof Input>, "className"> & {
    className?: string
    label: string
    hint?: string
    error?: string
}

export function TextField({ className, label, hint, error, ...props }: TextFieldProps) {
    return (
        <FieldShell label={label} hint={hint} error={error}>
            <motion.span initial={{ opacity: 0.9, scale: 0.995 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 24 }}>
                <Input className={cx(styles.input, className)} {...props} />
            </motion.span>
        </FieldShell>
    )
}

type NativeInputFieldProps = Omit<ComponentProps<typeof Input>, "className" | "type"> & {
    className?: string
    label: string
    hint?: string
    error?: string
}

export function DateField({ className, label, hint, error, ...props }: NativeInputFieldProps) {
    return (
        <FieldShell label={label} hint={hint} error={error}>
            <motion.span initial={{ opacity: 0.9, scale: 0.995 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 24 }}>
                <Input className={cx(styles.input, className)} type="date" {...props} />
            </motion.span>
        </FieldShell>
    )
}

export function TimeField({ className, label, hint, error, ...props }: NativeInputFieldProps) {
    return (
        <FieldShell label={label} hint={hint} error={error}>
            <motion.span initial={{ opacity: 0.9, scale: 0.995 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 24 }}>
                <Input className={cx(styles.input, className)} type="time" {...props} />
            </motion.span>
        </FieldShell>
    )
}

type TextAreaFieldProps = Omit<HTMLMotionProps<"textarea">, "children"> & {
    label: string
    hint?: string
    error?: string
    className?: string
}

export function TextAreaField({ className, label, hint, error, ...props }: TextAreaFieldProps) {
    return (
        <FieldShell label={label} hint={hint} error={error}>
            <motion.textarea className={cx(styles.textarea, className)} initial={{ opacity: 0.9, scale: 0.995 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 24 }} {...props} />
        </FieldShell>
    )
}

type Option = {
    label: string
    value: string
}

type SelectFieldProps = Omit<HTMLMotionProps<"select">, "onChange"> & {
    label: string
    hint?: string
    error?: string
    options: Option[]
    onValueChange: (value: string) => void
}

export function SelectField({ className, label, hint, error, options, onValueChange, ...props }: SelectFieldProps) {
    const handleChange: ChangeEventHandler<HTMLSelectElement> = event => onValueChange(event.target.value)

    return (
        <FieldShell label={label} hint={hint} error={error}>
            <motion.select className={cx(styles.select, className)} initial={{ opacity: 0.9, scale: 0.995 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 24 }} onChange={handleChange} {...props}>
                {options.map(option => createElement("option", { key: option.value, value: option.value }, option.label))}
            </motion.select>
        </FieldShell>
    )
}
