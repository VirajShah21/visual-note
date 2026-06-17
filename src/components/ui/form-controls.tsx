"use client"

import { Input } from "@base-ui/react/input"
import { motion, type HTMLMotionProps } from "motion/react"
import { createElement, useCallback } from "react"
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
            <motion.textarea
                className={cx(styles.textarea, className)}
                initial={{ opacity: 0.9, scale: 0.995 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 24 }}
                {...props}
            />
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
    const handleChange: ChangeEventHandler<HTMLSelectElement> = useCallback(event => onValueChange(event.target.value), [onValueChange])

    return (
        <FieldShell label={label} hint={hint} error={error}>
            <motion.select
                className={cx(styles.select, className)}
                initial={{ opacity: 0.9, scale: 0.995 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 24 }}
                onChange={handleChange}
                {...props}
            >
                {options.map(option => createElement("option", { key: option.value, value: option.value }, option.label))}
            </motion.select>
        </FieldShell>
    )
}

type CheckboxFieldProps = Omit<ComponentProps<typeof Input>, "className" | "type" | "onChange"> & {
    className?: string
    label: string
    hint?: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
}

export function CheckboxField({ className, label, hint, checked, onCheckedChange, ...props }: CheckboxFieldProps) {
    const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(event => onCheckedChange(event.target.checked), [onCheckedChange])

    return (
        <FieldShell label={label} hint={hint}>
            <motion.span initial={{ opacity: 0.9, scale: 0.995 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 24 }}>
                <Input className={cx(styles.checkbox, className)} type="checkbox" checked={checked} onChange={handleChange} {...props} />
            </motion.span>
        </FieldShell>
    )
}

type CheckboxCardFieldProps = Omit<ComponentProps<typeof Input>, "className" | "type" | "onChange"> & {
    className?: string
    label: string
    description?: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
}

export function CheckboxCardField({ className, description, checked, label, onCheckedChange, ...props }: CheckboxCardFieldProps) {
    const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(event => onCheckedChange(event.target.checked), [onCheckedChange])

    return (
        <label className={cx(styles.checkboxCard, checked && styles.checkboxCardSelected, props.disabled && styles.checkboxCardDisabled)}>
            <Input className={cx(styles.checkbox, styles.checkboxCardInput, className)} type="checkbox" checked={checked} onChange={handleChange} {...props} />
            <span className={styles.checkboxCardLabel}>
                <span>{label}</span>
                {description ? <span className={styles.checkboxCardDescription}>{description}</span> : null}
            </span>
        </label>
    )
}

type RadioOption = {
    label: string
    value: string
    description?: string
    disabled?: boolean
}

type RadioFieldProps = Omit<ComponentProps<typeof Input>, "className" | "type" | "onChange" | "value" | "name"> & {
    className?: string
    label: string
    hint?: string
    name: string
    options: RadioOption[]
    layout?: "grid" | "horizontal"
    value: string
    onValueChange: (value: string) => void
}

export function RadioField({ className, label, hint, name, options, value, layout = "grid", onValueChange, ...props }: RadioFieldProps) {
    const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(event => onValueChange(event.target.value), [onValueChange])

    return (
        <FieldShell label={label} hint={hint}>
            <motion.div
                className={cx(styles.radioGroup, layout === "horizontal" && styles.radioGroupHorizontal)}
                initial={{ opacity: 0.9, scale: 0.995 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 24 }}
            >
                {options.map(option => (
                    <label
                        key={option.value}
                        className={cx(styles.radioOption, option.value === value && styles.radioOptionSelected, option.disabled && styles.radioOptionDisabled)}
                    >
                        <Input
                            className={cx(styles.radio, className)}
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={option.value === value}
                            disabled={option.disabled}
                            onChange={handleChange}
                            {...props}
                        />
                        <span className={styles.radioLabel}>
                            <span>{option.label}</span>
                            {option.description ? <span className={styles.radioDescription}>{option.description}</span> : null}
                        </span>
                    </label>
                ))}
            </motion.div>
        </FieldShell>
    )
}
