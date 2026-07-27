"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import {
  MODAL_LAYER_PRIORITIES,
  focusModalElement,
  getModalTabbableElements,
  registerModalLayer,
} from "@/lib/ui/modal-layer-manager"
import { cn } from "@/lib/utils"

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleId: string
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => {},
  titleId: "",
})

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  children,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const titleId = React.useId()

  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen
  const onOpenChange = controlledOnOpenChange || setUncontrolledOpen

  return (
    <DialogContext.Provider value={{ open, onOpenChange, titleId }}>
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({
  children,
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = React.useContext(DialogContext)

  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onOpenChange(true)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

function DialogClose({
  children,
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = React.useContext(DialogContext)

  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onOpenChange(false)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  modalPriority?: number
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, modalPriority = MODAL_LAYER_PRIORITIES.dialog, ...props }, ref) => {
    const { open, onOpenChange, titleId } = React.useContext(DialogContext)
    const [mounted, setMounted] = React.useState(false)
    const [isTopLayer, setIsTopLayer] = React.useState(false)
    const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(null)
    const contentRef = React.useRef<HTMLDivElement | null>(null)
    const closeButtonRef = React.useRef<HTMLButtonElement | null>(null)
    const previousFocusRef = React.useRef<HTMLElement | null>(null)
    const hasCapturedFocusRef = React.useRef(false)

    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      },
      [ref],
    )

    React.useEffect(() => {
      setMounted(true)
    }, [])

    React.useEffect(() => {
      if (!open || !rootElement) return

      const layer = registerModalLayer({
        root: rootElement,
        priority: modalPriority,
        onTopLayerChange: setIsTopLayer,
      })
      setIsTopLayer(layer.isTopLayer())

      return () => {
        layer.release()
        setIsTopLayer(false)
      }
    }, [modalPriority, open, rootElement])

    React.useEffect(() => {
      if (open && !hasCapturedFocusRef.current) {
        previousFocusRef.current = document.activeElement as HTMLElement
        hasCapturedFocusRef.current = true
      }
    }, [open])

    React.useEffect(() => {
      if (open && isTopLayer) {
        requestAnimationFrame(() => {
          const target =
            getModalTabbableElements(contentRef.current ?? rootElement ?? document.body)[0] ??
            contentRef.current ??
            closeButtonRef.current
          focusModalElement(target)
        })
      }
    }, [isTopLayer, open, rootElement])

    React.useEffect(() => {
      if (!open && previousFocusRef.current) {
        focusModalElement(previousFocusRef.current)
        previousFocusRef.current = null
        hasCapturedFocusRef.current = false
      }
    }, [open])

    React.useEffect(() => {
      if (!open || !isTopLayer) return

      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return
        const content = contentRef.current
        if (!content) return

        const focusable = getModalTabbableElements(content)
        if (focusable.length === 0) {
          e.preventDefault()
          focusModalElement(content)
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          focusModalElement(last)
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          focusModalElement(first)
        }
      }

      document.addEventListener("keydown", handleTab)
      return () => document.removeEventListener("keydown", handleTab)
    }, [open, isTopLayer])

    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || !isTopLayer) return
        e.preventDefault()
        onOpenChange(false)
      }
      if (open) {
        document.addEventListener("keydown", handleEscape)
      }
      return () => document.removeEventListener("keydown", handleEscape)
    }, [open, isTopLayer, onOpenChange])

    if (!mounted || !open) return null

    return createPortal(
      <div ref={setRootElement} className="fixed inset-0 z-[120] flex items-center justify-center">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out"
          onClick={() => {
            if (isTopLayer) onOpenChange(false)
          }}
        />
        {/* Content */}
        <div
          ref={mergedRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
            className,
          )}
          {...props}
        >
          {children}
          <button
            ref={closeButtonRef}
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Schließen</span>
          </button>
        </div>
      </div>,
      document.body,
    )
  },
)
DialogContent.displayName = "DialogContent"

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = React.useContext(DialogContext)

  return (
    <h2
      id={titleId}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
}
