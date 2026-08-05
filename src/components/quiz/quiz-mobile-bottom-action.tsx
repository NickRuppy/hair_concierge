"use client"

import { createPortal } from "react-dom"
import { useEffect, useSyncExternalStore, type ReactNode } from "react"

import { cn } from "@/lib/utils"

const subscribeToClientReady = () => () => {}
const getClientReadySnapshot = () => true
const getServerReadySnapshot = () => false

export function QuizMobileBottomAction({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const mounted = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot,
  )

  useEffect(() => {
    const root = document.documentElement
    const viewportAction = window.matchMedia("(max-width: 639px), (max-height: 700px)")
    const previousScrollPaddingBottom = root.style.scrollPaddingBottom
    const syncScrollPadding = () => {
      root.style.scrollPaddingBottom = viewportAction.matches
        ? "calc(7rem + env(safe-area-inset-bottom))"
        : previousScrollPaddingBottom
    }

    syncScrollPadding()
    viewportAction.addEventListener("change", syncScrollPadding)
    return () => {
      viewportAction.removeEventListener("change", syncScrollPadding)
      root.style.scrollPaddingBottom = previousScrollPaddingBottom
    }
  }, [])

  return (
    <>
      <div
        className={cn(
          "hidden [@media(min-width:640px)_and_(min-height:701px)]:mt-7 [@media(min-width:640px)_and_(min-height:701px)]:block",
          className,
        )}
        data-quiz-bottom-action="inline"
      >
        <div className="mx-auto w-full max-w-[40rem]">{children}</div>
      </div>
      {mounted
        ? createPortal(
            <div
              className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--brand-plum-light)] bg-[hsl(var(--background))]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_-24px_rgba(var(--brand-plum-rgb),0.45)] backdrop-blur [@media(min-width:640px)_and_(min-height:701px)]:hidden"
              data-quiz-bottom-action="viewport"
            >
              <div className="mx-auto w-full max-w-[40rem]">{children}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export function QuizMobileBottomClearance() {
  return (
    <div
      aria-hidden="true"
      className="h-[calc(6.5rem+env(safe-area-inset-bottom))] [@media(min-width:640px)_and_(min-height:701px)]:hidden"
      data-quiz-bottom-clearance
    />
  )
}
