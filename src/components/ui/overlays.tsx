"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Popover } from "@base-ui/react/popover"
import { Info, X } from "lucide-react"
import type { ReactNode } from "react"
import styles from "./overlays.module.css"

type SurfaceProps = {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onOpenChange: (open: boolean) => void
}

export function ModalDialog({ open, title, description, children, onOpenChange }: SurfaceProps) {
  return (
    <Dialog.Root open={open} onOpenChange={nextOpen => onOpenChange(nextOpen)}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Viewport className={styles.viewport}>
          <Dialog.Popup className={styles.popup}>
            <SurfaceHeader title={title} description={description} />
            <div className={styles.body}>{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function SideDrawer({ open, title, description, children, onOpenChange }: SurfaceProps) {
  return (
    <Dialog.Root open={open} onOpenChange={nextOpen => onOpenChange(nextOpen)}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Viewport className={styles.drawerViewport}>
          <Dialog.Popup className={styles.drawer}>
            <SurfaceHeader title={title} description={description} />
            <div className={styles.body}>{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type SurfaceHeaderProps = {
  title: string
  description?: string
}

function SurfaceHeader({ title, description }: SurfaceHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <div className={styles.titleRow}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          {description ? (
            <InfoPopover title={title} label={`${title} details`}>
              {description}
            </InfoPopover>
          ) : null}
        </div>
        {description ? <Dialog.Description className={styles.visuallyHidden}>{description}</Dialog.Description> : null}
      </div>
      <Dialog.Close className={styles.close} aria-label="Close">
        <X size={16} />
      </Dialog.Close>
    </div>
  )
}

type InfoPopoverProps = {
  title: string
  label?: string
  children: ReactNode
}

export function InfoPopover({ title, label = "More information", children }: InfoPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.infoTrigger} aria-label={label} openOnHover delay={150} closeDelay={80}>
        <Info size={14} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className={styles.infoPositioner} side="bottom" align="start" sideOffset={8} collisionPadding={12}>
          <Popover.Popup className={styles.infoPopup}>
            <Popover.Arrow className={styles.infoArrow} />
            <Popover.Title className={styles.infoTitle}>{title}</Popover.Title>
            <Popover.Description className={styles.infoDescription}>{children}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
