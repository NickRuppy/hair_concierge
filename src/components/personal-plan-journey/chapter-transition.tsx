"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { PERSONAL_PLAN_CHAPTERS, type PersonalPlanJourneyStage } from "./journey-content"
import { PersonalPlanJourneyHeader } from "./journey-header"
import { PersonalPlanJourneyOverview } from "./journey-overview"

export function PersonalPlanChapterTransition({
  currentStage,
  actionHref,
  onAction,
  actionPending = false,
  actionPendingLabel,
  onBack,
  backLabel,
  errorMessage,
}: {
  currentStage: PersonalPlanJourneyStage
  actionHref?: string
  onAction?: () => void
  actionPending?: boolean
  actionPendingLabel?: string
  onBack?: () => void
  backLabel?: string
  errorMessage?: string
}) {
  const actionDockRef = useRef<HTMLElement>(null)
  const chapter = PERSONAL_PLAN_CHAPTERS[currentStage - 1]
  const actionLabel = actionPending
    ? (actionPendingLabel ?? `${chapter.actionLabel} …`)
    : chapter.actionLabel

  useEffect(() => {
    const dock = actionDockRef.current
    if (!dock) return

    const rootStyle = document.documentElement.style
    const previous = {
      priority: rootStyle.getPropertyPriority("--landing-sticky-cta-offset"),
      value: rootStyle.getPropertyValue("--landing-sticky-cta-offset"),
    }
    let ownedOffset = ""
    const updateOffset = () => {
      ownedOffset = `${Math.ceil(dock.getBoundingClientRect().height)}px`
      rootStyle.setProperty("--landing-sticky-cta-offset", ownedOffset)
    }
    updateOffset()
    const observer = new ResizeObserver(updateOffset)
    observer.observe(dock)

    return () => {
      observer.disconnect()
      if (rootStyle.getPropertyValue("--landing-sticky-cta-offset") !== ownedOffset) return
      if (previous.value) {
        rootStyle.setProperty("--landing-sticky-cta-offset", previous.value, previous.priority)
      } else {
        rootStyle.removeProperty("--landing-sticky-cta-offset")
      }
    }
  }, [])

  const actionClassName = cn(
    buttonVariants({ variant: "funnelCta", size: null }),
    "min-h-[50px] w-full [@media(min-height:731px)]:min-h-[58px]",
  )

  return (
    <div
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--background,#fdfbf9)] text-[var(--foreground)] [@media(max-height:519px)]:overflow-y-auto"
      data-personal-plan-chapter={currentStage}
    >
      <PersonalPlanJourneyHeader
        currentStage={currentStage}
        onBack={onBack}
        backLabel={backLabel}
        sticky={false}
        centeredBrand
      />
      <main className="personal-plan-cookie-clearance mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col px-3 pb-[76px] pt-2 [@media(min-height:731px)]:pb-[84px] sm:max-w-[560px] sm:px-5">
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex-none px-2 pb-2 pt-1 text-center">
            <h1 className="mx-auto max-w-[23ch] text-balance font-header text-[21px] leading-[1.12] text-[var(--brand-plum-darkest)] [@media(min-height:731px)]:text-[24px] sm:text-[26px]">
              {chapter.title}
            </h1>
            <p className="mx-auto mt-1 max-w-[38ch] text-balance text-[10px] leading-[1.35] text-[var(--text-sub)] [@media(min-height:731px)]:mt-1.5 [@media(min-height:731px)]:text-xs sm:text-[13px]">
              {chapter.description}
            </p>
            {errorMessage ? (
              <p
                role="alert"
                className="mx-auto mt-1 max-w-[38ch] text-[10px] leading-[1.3] text-[#a3434b]"
              >
                {errorMessage}
              </p>
            ) : null}
          </div>

          <PersonalPlanJourneyOverview currentStage={currentStage} />
        </section>
      </main>

      <footer
        ref={actionDockRef}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece6df] bg-[#fdfbf9]/95 px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur"
      >
        <div className="mx-auto max-w-[430px] sm:max-w-[560px]">
          {actionHref ? (
            <Link
              href={actionHref}
              onClick={onAction}
              aria-disabled={actionPending || undefined}
              className={cn(actionClassName, actionPending && "pointer-events-none opacity-65")}
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              disabled={actionPending}
              aria-busy={actionPending}
              className={actionClassName}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
