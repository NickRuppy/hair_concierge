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

function BottomSheet({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  children,
}: BottomSheetProps) {
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

interface BottomSheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  contentClassName?: string
  disableDrag?: boolean
  dragOrigin?: "panel" | "handle"
  header?: React.ReactNode
  initialFocusRef?: React.RefObject<HTMLElement | null>
  keepMounted?: boolean
  modalPriority?: number
  restoreFocusRef?: React.RefObject<HTMLElement | null>
  rootClassName?: string
  footer?: React.ReactNode
  showCloseButton?: boolean
  onDismissRequest?: (origin: "x" | "backdrop" | "escape" | "handle_drag") => void
}

const BottomSheetContent = React.forwardRef<HTMLDivElement, BottomSheetContentProps>(
  (
    {
      className,
      contentClassName,
      disableDrag = false,
      dragOrigin = "panel",
      footer,
      header,
      initialFocusRef,
      keepMounted = false,
      modalPriority = MODAL_LAYER_PRIORITIES.bottomSheet,
      restoreFocusRef,
      rootClassName,
      showCloseButton = true,
      onDismissRequest,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    const { open, onOpenChange, titleId } = React.useContext(BottomSheetContext)
    const [mounted, setMounted] = React.useState(false)
    const [visible, setVisible] = React.useState(false)
    const [closing, setClosing] = React.useState(false)
    const [isTopLayer, setIsTopLayer] = React.useState(false)
    const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(null)

    // Drag state
    const [dragY, setDragY] = React.useState(0)
    const [dragging, setDragging] = React.useState(false)
    const dragYRef = React.useRef(0)
    const draggingRef = React.useRef(false)
    const dragStartY = React.useRef(0)
    // Drag candidate before the movement threshold is reached. We must NOT
    // setPointerCapture on plain taps: with capture active the browser
    // dispatches the subsequent `click` to the capturing panel instead of the
    // child button, which silently kills every button/link inside the sheet.
    const pendingDrag = React.useRef<{ pointerId: number; startY: number } | null>(null)
    const contentRef = React.useRef<HTMLDivElement>(null)
    const panelRef = React.useRef<HTMLDivElement>(null)
    const closeButtonRef = React.useRef<HTMLButtonElement>(null)
    const previousFocusRef = React.useRef<HTMLElement | null>(null)
    const hasCapturedFocusRef = React.useRef(false)

    // Merge forwarded ref with internal panelRef
    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        panelRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      },
      [ref],
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

    const finishClose = React.useCallback(() => {
      setVisible(false)
      setClosing(false)
      setDragY(0)
      dragYRef.current = 0
      draggingRef.current = false
    }, [])

    const modalActive = visible && !closing

    React.useEffect(() => {
      if (!visible || !rootElement) return

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
    }, [modalPriority, rootElement, visible])

    const handleAnimationEnd = React.useCallback(
      (event: React.AnimationEvent) => {
        if (event.currentTarget === event.target && closing) finishClose()
      },
      [closing, finishClose],
    )

    React.useEffect(() => {
      if (!closing || !panelRef.current) return
      const durations = getComputedStyle(panelRef.current)
        .animationDuration.split(",")
        .map((value) => value.trim())
        .map((value) =>
          value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1_000,
        )
        .filter(Number.isFinite)
      const timeout = window.setTimeout(finishClose, Math.max(0, ...durations) + 50)
      return () => window.clearTimeout(timeout)
    }, [closing, finishClose])

    // Focus management: move focus only when this sheet is the active layer.
    React.useEffect(() => {
      if (modalActive && !hasCapturedFocusRef.current) {
        previousFocusRef.current = document.activeElement as HTMLElement
        hasCapturedFocusRef.current = true
      }
    }, [modalActive])

    React.useEffect(() => {
      if (modalActive && isTopLayer) {
        requestAnimationFrame(() => {
          const target =
            initialFocusRef?.current ??
            closeButtonRef.current ??
            getModalTabbableElements(panelRef.current ?? rootElement ?? document.body)[0] ??
            panelRef.current
          focusModalElement(target)
        })
      }
    }, [initialFocusRef, isTopLayer, modalActive, rootElement])

    React.useEffect(() => {
      if (!visible && previousFocusRef.current) {
        const requestedTarget = restoreFocusRef?.current
        const focusTarget =
          requestedTarget?.isConnected === false
            ? previousFocusRef.current
            : (requestedTarget ?? previousFocusRef.current)
        focusModalElement(focusTarget)
        previousFocusRef.current = null
        hasCapturedFocusRef.current = false
      }
    }, [restoreFocusRef, visible])

    // Focus trap: keep Tab/Shift+Tab within the panel
    React.useEffect(() => {
      if (!modalActive || !isTopLayer) return

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return
        const panel = panelRef.current
        if (!panel) return

        const focusable = getModalTabbableElements(panel)
        if (focusable.length === 0) return

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

      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }, [modalActive, isTopLayer])

    const requestDismissal = React.useCallback(
      (origin: "x" | "backdrop" | "escape" | "handle_drag") => {
        if (onDismissRequest) onDismissRequest(origin)
        else onOpenChange(false)
      },
      [onDismissRequest, onOpenChange],
    )

    // Escape key
    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || !isTopLayer) return
        e.preventDefault()
        requestDismissal("escape")
      }
      if (modalActive) {
        document.addEventListener("keydown", handleEscape)
      }
      return () => document.removeEventListener("keydown", handleEscape)
    }, [modalActive, isTopLayer, requestDismissal])

    // Drag handlers
    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        if (disableDrag || !isTopLayer) return
        const target = e.target as HTMLElement
        // Elements with their own pointer interactions (e.g. sliders) manage
        // their own capture — never hijack their gestures.
        if (target.closest('[role="slider"]')) return
        // Only start drag from the handle area or when scrolled to top
        const isHandle = target.closest("[data-bottom-sheet-handle]")
        if (dragOrigin === "handle" && !isHandle) return
        const scrollContainer = contentRef.current
        const isScrolledToTop = !scrollContainer || scrollContainer.scrollTop <= 0

        if (!isHandle && !isScrolledToTop) return

        // Record a drag candidate only — capture happens after real movement.
        pendingDrag.current = { pointerId: e.pointerId, startY: e.clientY }
      },
      [disableDrag, dragOrigin, isTopLayer],
    )

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent) => {
        if (disableDrag || !isTopLayer) return
        const pending = pendingDrag.current
        if (!dragging && pending && e.pointerId === pending.pointerId) {
          const delta = e.clientY - pending.startY
          if (delta > 12) {
            // Real downward drag: take over the gesture now.
            dragStartY.current = pending.startY
            pendingDrag.current = null
            draggingRef.current = true
            setDragging(true)
            panelRef.current?.setPointerCapture(e.pointerId)
            dragYRef.current = Math.max(0, delta)
            setDragY(dragYRef.current)
          } else if (delta < -12) {
            // Upward movement is not a dismiss gesture.
            pendingDrag.current = null
          }
          return
        }
        if (!dragging) return
        const delta = e.clientY - dragStartY.current
        // Only allow dragging downward
        dragYRef.current = Math.max(0, delta)
        setDragY(dragYRef.current)
      },
      [disableDrag, dragging, isTopLayer],
    )

    const handlePointerUp = React.useCallback(
      (event: React.PointerEvent) => {
        if (disableDrag || !isTopLayer) return
        const pending = pendingDrag.current
        pendingDrag.current = null
        if (!draggingRef.current) {
          if (pending && event.clientY - pending.startY > 80) requestDismissal("handle_drag")
          return
        }
        draggingRef.current = false
        setDragging(false)
        if (dragYRef.current > 80) {
          requestDismissal("handle_drag")
          // A controlled consumer may intercept dismissal (for example to show
          // a confirmation) and keep the sheet open. Snap the gesture offset
          // back either way; the CSS exit animation owns the real close path.
          dragYRef.current = 0
          setDragY(0)
        } else {
          dragYRef.current = 0
          setDragY(0)
        }
      },
      [disableDrag, isTopLayer, requestDismissal],
    )

    const handlePointerCancel = React.useCallback((event: React.PointerEvent) => {
      const pending = pendingDrag.current
      if (!draggingRef.current && (!pending || pending.pointerId !== event.pointerId)) {
        return
      }
      pendingDrag.current = null
      draggingRef.current = false
      dragYRef.current = 0
      setDragging(false)
      setDragY(0)
    }, [])

    if (!mounted || (!visible && !keepMounted)) return null

    return createPortal(
      <div
        ref={setRootElement}
        className={cn(
          "bottom-sheet-root fixed inset-0 z-50",
          !visible && "pointer-events-none invisible",
          rootClassName,
        )}
      >
        {/* Backdrop */}
        {visible ? (
          <div
            className={cn(
              "bottom-sheet-backdrop fixed inset-0 bg-black/20",
              dragging && "pointer-events-none",
            )}
            data-state={visible && !closing ? "open" : "closed"}
            onClick={() => {
              if (isTopLayer) requestDismissal("backdrop")
            }}
          />
        ) : null}
        {/* Panel */}
        <div
          ref={mergedRef}
          role={modalActive ? "dialog" : undefined}
          aria-modal={modalActive ? "true" : undefined}
          aria-labelledby={modalActive ? titleId : undefined}
          inert={!modalActive}
          data-bottom-sheet-panel
          data-dragging={dragging ? "true" : "false"}
          data-state={visible && !closing ? "open" : "closed"}
          className={cn(
            "bottom-sheet-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[60vh] touch-pan-y flex-col rounded-t-2xl bg-background shadow-[0_-4px_32px_rgba(0,0,0,0.3)]",
            disableDrag && "touch-auto",
            className,
          )}
          style={{
            ...style,
            transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          }}
          {...props}
          onAnimationEnd={handleAnimationEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={handlePointerCancel}
        >
          {/* Drag handle */}
          {!disableDrag ? (
            <div
              className="flex shrink-0 touch-none items-center justify-center pb-1 pt-3"
              data-bottom-sheet-handle
            >
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>
          ) : null}

          {/* Close button */}
          {showCloseButton ? (
            <button
              ref={closeButtonRef}
              type="button"
              className="absolute right-3 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-md bg-background/95 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => requestDismissal("x")}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Schließen</span>
            </button>
          ) : null}

          {header ? <div className="shrink-0">{header}</div> : null}

          {/* Scrollable content */}
          <div ref={contentRef} className={cn("overflow-y-auto px-6 pb-6", contentClassName)}>
            {children}
          </div>
          {footer ? (
            <div className="shrink-0 border-t bg-background px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>,
      document.body,
    )
  },
)
BottomSheetContent.displayName = "BottomSheetContent"

// --- BottomSheetHeader ---

function BottomSheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start gap-4", className)} {...props} />
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

function BottomSheetDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
}
