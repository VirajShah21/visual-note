"use client"

import { Checkbox } from "@base-ui/react/checkbox"
import { Field } from "@base-ui/react/field"
import { Input } from "@base-ui/react/input"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { Select } from "@base-ui/react/select"
import { motion, type HTMLMotionProps } from "motion/react"
import { useCallback } from "react"
import type { ComponentProps, ReactNode } from "react"
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
        <Field.Root className={styles.field}>
            <Field.Label className={styles.label}>{label}</Field.Label>
            {children}
            {hint ? <Field.Description className={styles.hint}>{hint}</Field.Description> : null}
            {error ? (
                <Field.Error className={styles.error} match>
                    {error}
                </Field.Error>
            ) : null}
        </Field.Root>
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

type SelectFieldProps = {
    className?: string
    disabled?: boolean
    error?: string
    hint?: string
    id?: string
    label: string
    name?: string
    options: Option[]
    required?: boolean
    value?: string
    onValueChange: (value: string) => void
}

export function SelectField({ className, disabled = false, id, label, hint, error, name, options, required = false, value, onValueChange }: SelectFieldProps) {
    const handleValueChange = useCallback(
        (nextValue: string | null) => {
            if (nextValue !== null) onValueChange(nextValue)
        },
        [onValueChange],
    )

    return (
        <FieldShell label={label} hint={hint} error={error}>
            <Select.Root id={id} name={name} value={value} disabled={disabled} required={required} items={options} onValueChange={handleValueChange}>
                <Select.Trigger className={cx(styles.select, className)}>
                    <Select.Value />
                </Select.Trigger>
                <Select.Portal>
                    <Select.Positioner className={styles.selectPositioner} sideOffset={6} collisionPadding={12}>
                        <Select.Popup className={styles.selectPopup}>
                            <Select.List>
                                {options.map(option => (
                                    <Select.Item key={option.value} className={styles.selectItem} value={option.value}>
                                        <Select.ItemText>{option.label}</Select.ItemText>
                                        <Select.ItemIndicator className={styles.selectIndicator}>✓</Select.ItemIndicator>
                                    </Select.Item>
                                ))}
                            </Select.List>
                        </Select.Popup>
                    </Select.Positioner>
                </Select.Portal>
            </Select.Root>
        </FieldShell>
    )
}

type CheckboxFieldProps = Omit<ComponentProps<typeof Checkbox.Root>, "className" | "onCheckedChange"> & {
    className?: string
    label: string
    hint?: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
}

export function CheckboxField({ className, label, hint, checked, onCheckedChange, ...props }: CheckboxFieldProps) {
    return (
        <FieldShell label={label} hint={hint}>
            <motion.span initial={{ opacity: 0.9, scale: 0.995 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 24 }}>
                <Checkbox.Root className={cx(styles.checkbox, className)} checked={checked} onCheckedChange={onCheckedChange} {...props}>
                    <Checkbox.Indicator className={styles.checkboxIndicator}>✓</Checkbox.Indicator>
                </Checkbox.Root>
            </motion.span>
        </FieldShell>
    )
}

type CheckboxCardFieldProps = Omit<ComponentProps<typeof Checkbox.Root>, "className" | "onCheckedChange"> & {
    className?: string
    label: string
    description?: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
}

export function CheckboxCardField({ className, description, checked, label, onCheckedChange, ...props }: CheckboxCardFieldProps) {
    return (
        <Field.Root className={cx(styles.checkboxCard, checked && styles.checkboxCardSelected, props.disabled && styles.checkboxCardDisabled)}>
            <Checkbox.Root className={cx(styles.checkbox, styles.checkboxCardInput, className)} checked={checked} onCheckedChange={onCheckedChange} {...props}>
                <Checkbox.Indicator className={styles.checkboxIndicator}>✓</Checkbox.Indicator>
            </Checkbox.Root>
            <Field.Label className={styles.checkboxCardLabel}>
                <span>{label}</span>
                {description ? <Field.Description className={styles.checkboxCardDescription}>{description}</Field.Description> : null}
            </Field.Label>
        </Field.Root>
    )
}

type RadioOption = {
    label: string
    value: string
    description?: string
    disabled?: boolean
}

type RadioFieldProps = {
    className?: string
    disabled?: boolean
    form?: string
    label: string
    hint?: string
    name: string
    options: RadioOption[]
    layout?: "grid" | "horizontal"
    readOnly?: boolean
    required?: boolean
    value: string
    onValueChange: (value: string) => void
}

export function RadioField({ className, label, hint, name, options, value, layout = "grid", onValueChange, ...props }: RadioFieldProps) {
    return (
        <FieldShell label={label} hint={hint}>
            <RadioGroup
                className={cx(styles.radioGroup, layout === "horizontal" && styles.radioGroupHorizontal)}
                name={name}
                value={value}
                onValueChange={onValueChange}
                {...props}
            >
                {options.map(option => (
                    <Field.Item
                        key={option.value}
                        className={cx(styles.radioOption, option.value === value && styles.radioOptionSelected, option.disabled && styles.radioOptionDisabled)}
                    >
                        <Radio.Root className={cx(styles.radio, className)} value={option.value} disabled={option.disabled}>
                            <Radio.Indicator className={styles.radioIndicator} />
                        </Radio.Root>
                        <Field.Label className={styles.radioLabel}>
                            <span>{option.label}</span>
                            {option.description ? <Field.Description className={styles.radioDescription}>{option.description}</Field.Description> : null}
                        </Field.Label>
                    </Field.Item>
                ))}
            </RadioGroup>
        </FieldShell>
    )
}
