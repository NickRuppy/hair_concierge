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
  secondaryActionLabel,
  onSecondaryAction,
  secondaryHint,
}: {
  currentStage: PersonalPlanJourneyStage
  actionHref?: string
  onAction?: () => void
  actionPending?: boolean
  actionPendingLabel?: string
  onBack?: () => void
  backLabel?: string
  errorMessage?: string
  /** Optional quieter alternative under the primary action (e.g. re-opening a completed stage). */
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  secondaryHint?: string
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
      className="flex min-h-dvh flex-col bg-[var(--background,#fdfbf9)] text-[var(--foreground)]"
      data-personal-plan-chapter={currentStage}
    >
      <PersonalPlanJourneyHeader
        currentStage={currentStage}
        onBack={onBack}
        backLabel={backLabel}
        centeredBrand
      />
      <main className="personal-plan-cookie-clearance mx-auto w-full max-w-[430px] px-3 pb-[calc(var(--landing-sticky-cta-offset,76px)+20px)] pt-5 sm:max-w-[560px] sm:px-5">
        <section>
          <div className="px-2 pb-2 text-center">
            <h1 className="mx-auto max-w-[17ch] text-balance font-header text-[clamp(28px,8vw,32px)] leading-[1.15] text-[var(--brand-plum-darkest)]">
              {chapter.title}
            </h1>
            <p className="mx-auto mt-3 max-w-[26ch] text-balance text-[16px] leading-[1.5] text-[var(--text-sub)]">
              {chapter.description}
            </p>
            {errorMessage ? (
              <p
                role="alert"
                className="mx-auto mt-1 max-w-[38ch] text-[13px] leading-[1.4] text-[#a3434b]"
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
          {onSecondaryAction ? (
            <>
              <button
                type="button"
                onClick={onSecondaryAction}
                disabled={actionPending}
                className={cn(
                  buttonVariants({ variant: "outline", size: null }),
                  "mt-2.5 min-h-[46px] w-full rounded-full border-[var(--brand-plum-light)] bg-transparent text-[15px] font-bold text-[var(--brand-plum-darkest)]",
                )}
              >
                {secondaryActionLabel}
              </button>
              {secondaryHint ? (
                <p className="mt-1.5 text-center text-[12px] leading-[1.4] text-[var(--text-sub)]">
                  {secondaryHint}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
