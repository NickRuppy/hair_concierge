"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

// --- Context ---

interface BottomSheetContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleId: string
}

const BottomSheetContext = React.createContext<BottomSheetContextValue>({
  open: false,
  onOpenChange: () => {},
  titleId: "",
})

// --- BottomSheet ---

interface BottomSheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function BottomSheet({ open: controlledOpen, onOpenChange: controlledOnOpenChange, children }: BottomSheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const titleId = React.useId()

  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen
  const onOpenChange = controlledOnOpenChange || setUncontrolledOpen

  return (
    <BottomSheetContext.Provider value={{ open, onOpenChange, titleId }}>
      {children}
    </BottomSheetContext.Provider>
  )
}

// --- BottomSheetContent ---

interface BottomSheetContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const BottomSheetContent = React.forwardRef<HTMLDivElement, BottomSheetContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange, titleId } = React.useContext(BottomSheetContext)
    const [mounted, setMounted] = React.useState(false)
    const [visible, setVisible] = React.useState(false)
    const [closing, setClosing] = React.useState(false)

    // Drag state
    const [dragY, setDragY] = React.useState(0)
    const [dragging, setDragging] = React.useState(false)
    const dragStartY = React.useRef(0)
    const contentRef = React.useRef<HTMLDivElement>(null)
    const panelRef = React.useRef<HTMLDivElement>(null)
    const closeButtonRef = React.useRef<HTMLButtonElement>(null)
    const previousFocusRef = React.useRef<HTMLElement | null>(null)

    // Merge forwarded ref with internal panelRef
    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        panelRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      },
      [ref]
    )

    React.useEffect(() => {
      setMounted(true)
    }, [])

    // Open → visible, close → closing → animationend → hidden
    React.useEffect(() => {
      if (open) {
        setVisible(true)
        setClosing(false)
      } else if (visible) {
        setClosing(true)
      }
    }, [open, visible])

    const handleAnimationEnd = React.useCallback(() => {
      if (closing) {
        setVisible(false)
        setClosing(false)
        setDragY(0)
      }
    }, [closing])

    // Focus management: auto-focus close button on open, restore focus on close
    React.useEffect(() => {
      if (visible && !closing) {
        previousFocusRef.current = document.activeElement as HTMLElement
        // Small delay to let the portal mount
        requestAnimationFrame(() => {
          closeButtonRef.current?.focus()
        })
      } else if (!visible && previousFocusRef.current) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
    }, [visible, closing])

    // Focus trap: keep Tab/Shift+Tab within the panel
    React.useEffect(() => {
      if (!visible || closing) return

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return
        const panel = panelRef.current
        if (!panel) return

        const focusable = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }

      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }, [visible, closing])

    // Body overflow lock
    React.useEffect(() => {
      if (visible) {
        document.body.style.overflow = "hidden"
      } else {
        document.body.style.overflow = ""
      }
      return () => {
        document.body.style.overflow = ""
      }
    }, [visible])

    // Escape key
    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") onOpenChange(false)
      }
      if (visible) {
        document.addEventListener("keydown", handleEscape)
      }
      return () => document.removeEventListener("keydown", handleEscape)
    }, [visible, onOpenChange])

    // Drag handlers
    const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
      const target = e.target as HTMLElement
      // Only start drag from the handle area or when scrolled to top
      const isHandle = target.closest("[data-bottom-sheet-handle]")
      const scrollContainer = contentRef.current
      const isScrolledToTop = !scrollContainer || scrollContainer.scrollTop <= 0

      if (!isHandle && !isScrolledToTop) return

      setDragging(true)
      dragStartY.current = e.clientY
      panelRef.current?.setPointerCapture(e.pointerId)
    }, [])

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent) => {
        if (!dragging) return
        const delta = e.clientY - dragStartY.current
        // Only allow dragging downward
        setDragY(Math.max(0, delta))
      },
      [dragging]
    )

    const handlePointerUp = React.useCallback(() => {
      if (!dragging) return
      setDragging(false)
      if (dragY > 80) {
        onOpenChange(false)
        // Don't reset dragY — handleAnimationEnd cleans it up after exit animation
      } else {
        setDragY(0)
      }
    }, [dragging, dragY, onOpenChange])

    if (!mounted || !visible) return null

    const spring = "cubic-bezier(0.32, 0.72, 0, 1)"

    return createPortal(
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div
          className={cn("fixed inset-0 bg-black/20", dragging && "pointer-events-none")}
          style={{
            animation: closing
              ? `backdropFadeOut 250ms ${spring} forwards`
              : `backdropFadeIn 350ms ${spring} forwards`,
          }}
          onClick={() => onOpenChange(false)}
        />
        {/* Panel */}
        <div
          ref={mergedRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[60vh] flex-col rounded-t-2xl bg-background shadow-[0_-4px_32px_rgba(0,0,0,0.3)]",
            className
          )}
          style={{
            animation: closing
              ? `bottomSheetDown 250ms ${spring} forwards`
              : `bottomSheetUp 350ms ${spring} forwards`,
            transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
            transition: dragging ? "none" : undefined,
          }}
          onAnimationEnd={handleAnimationEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          {...props}
        >
          {/* Drag handle */}
          <div
            className="flex shrink-0 items-center justify-center pb-1 pt-3"
            data-bottom-sheet-handle
          >
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Close button */}
          <button
            ref={closeButtonRef}
            className="absolute right-3 top-2 flex h-10 w-10 items-center justify-center rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>

          {/* Scrollable content */}
          <div ref={contentRef} className="overflow-y-auto px-6 pb-6">
            {children}
          </div>
        </div>
      </div>,
      document.body
    )
  }
)
BottomSheetContent.displayName = "BottomSheetContent"

// --- BottomSheetHeader ---

function BottomSheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start gap-4", className)}
      {...props}
    />
  )
}

// --- BottomSheetTitle ---

function BottomSheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = React.useContext(BottomSheetContext)

  return (
    <h2
      id={titleId}
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
}

// --- BottomSheetDescription ---

function BottomSheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
}
