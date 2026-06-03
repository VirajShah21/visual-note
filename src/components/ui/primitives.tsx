"use client"

import { motion, type HTMLMotionProps } from "motion/react"
import type { ReactNode } from "react"
import { cx } from "./class-name"
import styles from "./primitives.module.css"

type Gap = "none" | "xs" | "sm" | "md" | "lg" | "xl"

const gapClass = (gap: Gap) => {
  if (gap === "xs") return styles.gapXs
  if (gap === "sm") return styles.gapSm
  if (gap === "md") return styles.gapMd
  if (gap === "lg") return styles.gapLg
  if (gap === "xl") return styles.gapXl

  return styles.gapNone
}

const motionEnter = { opacity: 0, y: 8, filter: "blur(2px)" }
const motionShow = { opacity: 1, y: 0, filter: "blur(0px)" }
const motionTransition = { type: "spring" as const, stiffness: 205, damping: 24, mass: 0.4 }

type BoxProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children?: ReactNode
}

export function Box({ className, children, initial = motionEnter, animate = motionShow, transition = motionTransition, ...props }: BoxProps) {
  return (
    <motion.div className={cx(styles.box, className)} initial={initial} animate={animate} transition={transition} layout {...props}>
      {children}
    </motion.div>
  )
}

type StackProps = Omit<BoxProps, "direction" | "gap"> & {
  direction?: "horizontal" | "vertical"
  gap?: Gap
}

export function Stack({ className, children, direction = "vertical", gap = "md", initial, animate, transition, ...props }: StackProps) {
  return (
    <motion.div
      className={cx(styles.stack, direction === "horizontal" ? styles.stackHorizontal : styles.stackVertical, gapClass(gap), className)}
      initial={initial ?? motionEnter}
      animate={animate ?? motionShow}
      transition={transition ?? { ...motionTransition, delay: 0 }}
      layout
      {...props}
    >
      {children}
    </motion.div>
  )
}

type GridProps = Omit<BoxProps, "columns" | "gap"> & {
  columns?: "two" | "three" | "auto"
  gap?: Gap
}

export function Grid({ className, children, columns = "auto", gap = "md", initial, animate, transition, ...props }: GridProps) {
  return (
    <motion.div
      className={cx(styles.grid, columns === "two" && styles.gridTwo, columns === "three" && styles.gridThree, columns === "auto" && styles.gridAuto, gapClass(gap), className)}
      initial={initial ?? motionEnter}
      animate={animate ?? motionShow}
      transition={transition ?? { ...motionTransition, delay: 0.02 }}
      layout
      {...props}
    >
      {children}
    </motion.div>
  )
}

type CardProps = Omit<BoxProps, "padding"> & {
  padding?: "normal" | "compact" | "none"
}

export function Card({ className, children, padding = "normal", initial, animate, transition, ...props }: CardProps) {
  return (
    <motion.div
      className={cx(styles.card, padding === "normal" && styles.cardPadded, padding === "compact" && styles.cardCompact, className)}
      initial={initial ?? { ...motionEnter, y: 10 }}
      animate={animate ?? motionShow}
      transition={transition ?? { ...motionTransition, delay: 0.04 }}
      layout
      {...props}
    >
      {children}
    </motion.div>
  )
}

type HeadingLevel = "h1" | "h2" | "h3" | "h4"

type HeadingProps = Omit<HTMLMotionProps<"h2">, "children" | "as" | "size"> & {
  as?: HeadingLevel
  size?: "hero" | "lg" | "md" | "sm"
  children: ReactNode
}

const headingByLevel = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
}

export function Heading({ as = "h2", size = "md", className, children, initial, animate, transition, ...props }: HeadingProps) {
  const Element = headingByLevel[as]

  return (
    <Element
      className={cx(
        styles.heading,
        size === "hero" && styles.headingHero,
        size === "lg" && styles.headingLg,
        size === "md" && styles.headingMd,
        size === "sm" && styles.headingSm,
        className,
      )}
      initial={initial ?? { ...motionEnter, y: 9 }}
      animate={animate ?? motionShow}
      transition={transition ?? { ...motionTransition, delay: 0.04 }}
      {...props}
    >
      {children}
    </Element>
  )
}

type TextKind = "p" | "span" | "code"

type TextProps = Omit<HTMLMotionProps<"p">, "children" | "as" | "tone" | "size"> & {
  as?: TextKind
  tone?: "muted" | "strong" | "code"
  size?: "normal" | "small"
  children: ReactNode
}

const textByKind = {
  p: motion.p,
  span: motion.span,
  code: motion.code,
}

export function Text({ as = "p", tone = "muted", size = "normal", className, children, initial, animate, transition, ...props }: TextProps) {
  const Element = textByKind[as]

  return (
    <Element
      className={cx(styles.text, tone === "strong" && styles.textStrong, tone === "code" && styles.textCode, size === "small" && styles.textSmall, className)}
      initial={initial ?? { ...motionEnter, y: 6 }}
      animate={animate ?? motionShow}
      transition={transition ?? { ...motionTransition, delay: 0.06 }}
      {...props}
    >
      {children}
    </Element>
  )
}

type PillProps = Omit<HTMLMotionProps<"span">, "children"> & {
  children: ReactNode
}

export function Pill({ className, children, initial, animate, transition, ...props }: PillProps) {
  return (
    <motion.span
      className={cx(styles.pill, className)}
      initial={initial ?? { ...motionEnter, scale: 0.98 }}
      animate={animate ?? motionShow}
      transition={transition ?? { ...motionTransition, delay: 0.03 }}
      {...props}
    >
      {children}
    </motion.span>
  )
}

export function Divider({ className, initial, animate, transition, ...props }: Omit<HTMLMotionProps<"hr">, "children"> & { className?: string }) {
  return (
    <motion.hr
      className={cx(styles.divider, className)}
      initial={initial ?? { scaleX: 0, opacity: 0 }}
      animate={animate ?? { scaleX: 1, opacity: 1 }}
      transition={transition ?? { ...motionTransition, delay: 0.02 }}
      {...props}
    />
  )
}

export function ScrollArea({ className, children, initial, animate, transition, ...props }: BoxProps) {
  return (
    <motion.div
      className={cx(styles.scrollArea, className)}
      initial={initial ?? motionEnter}
      animate={animate ?? motionShow}
      transition={transition ?? { ...motionTransition, delay: 0.03 }}
      layout
      {...props}
    >
      {children}
    </motion.div>
  )
}

type ExternalLinkProps = Omit<HTMLMotionProps<"a">, "children"> & {
  children: ReactNode
}

export function ExternalLink({ className, children, initial, animate, transition, ...props }: ExternalLinkProps) {
  return (
    <motion.a
      className={cx(styles.externalLink, className)}
      rel="noreferrer"
      target="_blank"
      initial={initial ?? { opacity: 0, x: -4 }}
      animate={animate ?? { opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01, x: 1 }}
      transition={transition ?? motionTransition}
      {...props}
    >
      {children}
    </motion.a>
  )
}

export function MediaImage({ className, alt, initial, animate, transition, ...props }: Omit<HTMLMotionProps<"img">, "children" | "alt"> & { alt?: string }) {
  return (
    <motion.img
      className={cx(styles.mediaImage, className)}
      alt={alt ?? ""}
      initial={initial ?? { opacity: 0, scale: 0.985 }}
      animate={animate ?? { opacity: 1, scale: 1 }}
      whileInView={{ scale: 1 }}
      transition={transition ?? { ...motionTransition, duration: 0.4 }}
      loading="lazy"
      {...props}
    />
  )
}
