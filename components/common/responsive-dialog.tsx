"use client"

import type { ReactNode } from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface ResponsiveDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Largeur sur desktop. */
  size?: "sm" | "md" | "lg" | "xl"
}

const SIZES = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }

/** Dialogue sur desktop, tiroir (drawer) sur mobile. */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading text-lg">{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90dvh] gap-0 overflow-hidden p-0", SIZES[size])}>
        <DialogHeader className="border-b px-5 pt-5 pb-4">
          <DialogTitle className="font-heading text-lg">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="max-h-[calc(90dvh-5rem)] overflow-y-auto px-5 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

/** Barre d'actions en bas d'un formulaire de dialogue (collante). */
export function DialogActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 -mx-4 mt-6 flex flex-col-reverse gap-2 border-t bg-popover px-4 pt-4 pb-1 sm:-mx-5 sm:flex-row sm:justify-end sm:px-5",
        className
      )}
    >
      {children}
    </div>
  )
}
