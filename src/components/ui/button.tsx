"use client"

import { Button as BaseButton } from "@base-ui/react/button"
import { motion } from "motion/react"
import type { ComponentProps, ReactNode } from "react"
import { cx } from "./class-name"
import styles from "./button.module.css"

type ButtonProps = Omit<ComponentProps<typeof BaseButton>, "className"> & {
  className?: string
  children?: ReactNode
  icon?: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  fullWidth?: boolean
  iconOnly?: boolean
}

export function Button({ children, className, icon, variant = "secondary", fullWidth = false, iconOnly = false, ...props }: ButtonProps) {
  return (
    <motion.span
      className={cx(styles.buttonHost, fullWidth && styles.buttonHostFull)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1, transition: { duration: 0.12 } }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
    >
      <BaseButton className={cx(styles.button, styles[variant], fullWidth && styles.fullWidth, iconOnly && styles.iconOnly, className)} {...props}>
        {icon}
        {children}
      </BaseButton>
    </motion.span>
  )
}
