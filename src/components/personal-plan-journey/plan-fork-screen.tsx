"use client"

import { useEffect, useRef } from "react"

import { buttonVariants } from "@/components/ui/button"
import { CATEGORY_LABELS } from "@/lib/personal-plan/decision-presentation"
import type { DirectAcceptanceAssumption } from "@/lib/personal-plan/direct-acceptance/defaults"
import type { Stage1ProductExamplePreviewResponse } from "@/lib/personal-plan/product-preview-contract"
import { cn } from "@/lib/utils"

import { PersonalPlanJourneyHeader } from "./journey-header"

export const PLAN_FORK_TITLE = "Dein Idealplan steht."
export const PLAN_FORK_LEAD =
  "Du kannst ihn direkt umsetzen — oder wir passen ihn an deinen Alltag und deine Produkte an."
export const PLAN_FORK_ASSUMPTIONS_TITLE = "Dafür haben wir angenommen"
export const PLAN_FORK_ASSUMPTIONS_NOTE =
  "Der Feinschliff ersetzt diese Annahmen durch deine echten Angaben."
export const PLAN_FORK_REFINE_LABEL = "Feinschliff starten · ca. 2 Min."
export const PLAN_FORK_ACCEPT_LABEL = "Plan direkt übernehmen"
export const PLAN_FORK_ACCEPT_PENDING_LABEL = "Plan wird übernommen …"
export const PLAN_FORK_MICROCOPY = "Nichts ist endgültig — verfeinern kannst du jederzeit später."
export const PLAN_FORK_ACCEPT_ERROR =
  "Dein Plan konnte nicht übernommen werden. Versuche es noch einmal."
export const PLAN_FORK_REFINE_ERROR =
  "Der Feinschliff konnte nicht geladen werden. Versuche es noch einmal."
export const PLAN_FORK_STALE_NOTICE = "Deine Empfehlungen wurden aktualisiert."
/**
 * Shown once re-fetching has failed to converge, i.e. the mismatch is
 * structural rather than a race. Naming the working path beats a retry button
 * that cannot succeed.
 */
export const PLAN_FORK_ACCEPT_UNAVAILABLE =
  "Die direkte Übernahme ist gerade nicht möglich. Der Feinschliff bringt dich sicher ans Ziel."

/**
 * One seen-state entry per recommendation role, exactly as
 * `POST /api/personal-plan/accept-ideal-plan` expects it. The Stage-1 card
 * adapter drops these three fields, so they are echoed from the raw payload.
 */
export type PlanForkSeenRole = {
  decisionKey: string
  productId: string
  factFingerprint: string
}

export type PlanForkPreviewState = {
  seenRoles: PlanForkSeenRole[]
  /** Set when at least one role has no product yet, which the accept contract rejects. */
  fallbackNotice: string | null
  /**
   * Set when the server has already determined that the defaults would plan a
   * category this payload could never show. Blocks acceptance the same way a
   * fallback does, but says something different: the plan is complete, the
   * *choice* needs the refinement.
   */
  refinementRequiredNotice: string | null
}

/**
 * Returns `null` when direct acceptance cannot be offered honestly at all —
 * no payload, or a payload without a single buyable recommendation.
 */
export function derivePlanForkPreviewState(
  response: Stage1ProductExamplePreviewResponse | null,
): PlanForkPreviewState | null {
  if (!response) return null
  const recommendations = response.previews.filter(
    (preview): preview is Extract<typeof preview, { kind: "recommendation" }> =>
      preview.kind === "recommendation",
  )
  if (recommendations.length === 0) return null

  const fallbackCategories = [
    ...new Set(
      response.previews.flatMap((preview) =>
        preview.kind === "fallback" ? [preview.category] : [],
      ),
    ),
  ]

  return {
    // Stays per-role and complete: the accept contract compares this set to the
    // server's Stage-3 evaluations and rejects any difference. Every role the
    // payload recommends is echoed here, independent of how Stage 1 renders it.
    seenRoles: recommendations.map((preview) => ({
      decisionKey: preview.decisionKey,
      productId: preview.productId,
      factFingerprint: preview.factFingerprint,
    })),
    refinementRequiredNotice: directAcceptanceBlockedNotice(response.directAcceptance),
    fallbackNotice:
      fallbackCategories.length === 0
        ? null
        : fallbackCategories.length === 1
          ? `Für ${CATEGORY_LABELS[fallbackCategories[0]]} steht die Produktwahl noch aus — der Feinschliff schließt das ab.`
          : "Für einige Kategorien steht die Produktwahl noch aus — der Feinschliff schließt das ab.",
  }
}

/**
 * A single `seen_state_stale` is a recoverable race — the previews moved under
 * the user, and re-fetching converges. A second consecutive one means
 * re-fetching did NOT converge: the server plans a role the preview payload
 * does not contain at all, so every further retry produces the same 409 while
 * telling the user their recommendations were "updated". Retire the path
 * instead of looping.
 */
export function acceptStatusAfterStale(consecutiveStaleCount: number): "idle" | "unavailable" {
  return consecutiveStaleCount >= 2 ? "unavailable" : "idle"
}

export type AcceptIdealPlanOutcome =
  | { kind: "accepted"; href: string }
  /** The server plans other products than the user saw; re-fetch and re-render. */
  | { kind: "seen_state_stale" }
  /** A real Stage 2 is already under way — continue it instead of accepting. */
  | { kind: "refinement_in_progress" }
  | { kind: "plan_already_accepted"; href: "/routine" }
  | { kind: "error" }

export function interpretAcceptIdealPlanResponse(
  status: number,
  body: unknown,
): AcceptIdealPlanOutcome {
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null
  if (status === 200) {
    const next = payload?.next
    const href =
      next && typeof next === "object" && typeof (next as { href?: unknown }).href === "string"
        ? (next as { href: string }).href
        : null
    return payload?.status === "accepted" && href ? { kind: "accepted", href } : { kind: "error" }
  }
  if (status === 409) {
    if (payload?.error === "seen_state_stale") return { kind: "seen_state_stale" }
    if (payload?.error === "refinement_in_progress") return { kind: "refinement_in_progress" }
    if (payload?.error === "plan_already_accepted") {
      return { kind: "plan_already_accepted", href: "/routine" }
    }
  }
  return { kind: "error" }
}

/**
 * Distinct from the fallback line on purpose: nothing is missing from the plan,
 * the deferred category's product choice simply depends on an answer only the
 * refinement collects.
 */
function directAcceptanceBlockedNotice(
  verdict: Stage1ProductExamplePreviewResponse["directAcceptance"],
): string | null {
  if (verdict.available) return null
  if (verdict.blockedCategories.length === 1 && verdict.blockedCategories[0] === "scalp_care") {
    return "Für deine Kopfhaut-Empfehlung brauchen wir den Feinschliff — er stellt sicher, dass die Produktwahl zu deiner Kopfhaut passt."
  }
  return "Für einen Teil deines Plans brauchen wir den Feinschliff — er stellt sicher, dass die Produktwahl zu dir passt."
}

export function PlanForkScreen({
  assumptions,
  previewState,
  directAcceptanceAvailable,
  refineStatus = "idle",
  acceptStatus = "idle",
  noticeMessage,
  onRefine,
  onAccept,
  onBack,
}: {
  assumptions: readonly DirectAcceptanceAssumption[]
  previewState: PlanForkPreviewState | null
  directAcceptanceAvailable: boolean
  refineStatus?: "idle" | "loading" | "error"
  /** `unavailable` retires the accept path for this mount; only a remount restores it. */
  acceptStatus?: "idle" | "pending" | "error" | "unavailable"
  noticeMessage?: string | null
  onRefine: () => void
  onAccept: () => void
  onBack?: () => void
}) {
  const actionDockRef = useRef<HTMLElement>(null)
  const showsAcceptPath =
    directAcceptanceAvailable && previewState !== null && acceptStatus !== "unavailable"
  // Both blockers disable the same control; only the explanation differs.
  const acceptBlockedNotice =
    previewState?.refinementRequiredNotice ?? previewState?.fallbackNotice ?? null
  const acceptBlocked = Boolean(acceptBlockedNotice)
  const busy = refineStatus === "loading" || acceptStatus === "pending"

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

  return (
    <div
      className="flex min-h-dvh flex-col bg-[var(--background,#fdfbf9)] text-[var(--foreground)]"
      data-personal-plan-fork="true"
    >
      <PersonalPlanJourneyHeader
        currentStage={2}
        onBack={onBack}
        backLabel="Zum Idealplan"
        sticky={false}
        centeredBrand
      />
      <main className="personal-plan-cookie-clearance mx-auto w-full max-w-[430px] flex-1 px-3 pb-[calc(var(--landing-sticky-cta-offset,188px)+20px)] pt-3 sm:max-w-[560px] sm:px-5">
        <h1 className="mx-auto max-w-[17ch] text-balance text-center font-header text-[clamp(28px,8vw,32px)] leading-[1.15] text-[var(--brand-plum-darkest)]">
          {PLAN_FORK_TITLE}
        </h1>
        <p className="mx-auto mt-3 max-w-[28ch] text-balance text-center text-[16px] leading-[1.5] text-[var(--text-sub)]">
          {PLAN_FORK_LEAD}
        </p>

        {noticeMessage ? (
          <p
            role="status"
            className="mx-auto mt-3 max-w-[38ch] rounded-[12px] bg-[var(--brand-plum-ice)] px-3 py-2 text-center text-[13px] leading-[1.4] text-[var(--brand-plum-dark)]"
          >
            {noticeMessage}
          </p>
        ) : null}

        {showsAcceptPath && previewState ? (
          <section className="mt-4 rounded-[16px] bg-[#f6efe7] px-[18px] py-4">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#4a304d]">
              {PLAN_FORK_ASSUMPTIONS_TITLE}
            </h2>
            <ul className="mt-2.5 flex flex-col gap-[7px]">
              {assumptions.map((assumption) => (
                <li
                  key={assumption.id}
                  className="flex items-baseline gap-2 text-[14px] leading-[1.4] text-[#5f5954]"
                >
                  <span aria-hidden="true" className="font-extrabold text-[#a77d31]">
                    ·
                  </span>
                  <span>{assumption.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12.5px] leading-[1.4] text-[#8a837c]">
              {PLAN_FORK_ASSUMPTIONS_NOTE}
            </p>
          </section>
        ) : null}
      </main>

      <footer
        ref={actionDockRef}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece6df] bg-[#fdfbf9]/95 px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur"
      >
        <div className="mx-auto flex max-w-[430px] flex-col gap-2 sm:max-w-[560px]">
          <button
            type="button"
            onClick={onRefine}
            disabled={busy}
            aria-busy={refineStatus === "loading"}
            className={cn(
              buttonVariants({ variant: "funnelCta", size: null }),
              "min-h-[50px] w-full [@media(min-height:731px)]:min-h-[58px]",
            )}
          >
            {refineStatus === "loading" ? "Feinschliff wird geladen …" : PLAN_FORK_REFINE_LABEL}
          </button>

          {showsAcceptPath ? (
            <button
              type="button"
              onClick={onAccept}
              disabled={acceptBlocked || busy}
              aria-busy={acceptStatus === "pending"}
              className="min-h-[50px] w-full rounded-[12px] border-[1.5px] border-[var(--brand-plum)] bg-transparent px-4 text-[15px] font-bold text-[var(--brand-plum)] transition hover:bg-[var(--brand-plum-ice)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.45)] focus-visible:ring-offset-2"
            >
              {acceptStatus === "pending" ? PLAN_FORK_ACCEPT_PENDING_LABEL : PLAN_FORK_ACCEPT_LABEL}
            </button>
          ) : null}

          {acceptBlockedNotice && showsAcceptPath ? (
            <p className="text-center text-[12px] leading-[1.4] text-[#8a837c]">
              {acceptBlockedNotice}
            </p>
          ) : null}

          {refineStatus === "error" ? (
            <p role="alert" className="text-center text-[12px] leading-[1.4] text-[#a3434b]">
              {PLAN_FORK_REFINE_ERROR}
            </p>
          ) : null}
          {acceptStatus === "error" ? (
            <p role="alert" className="text-center text-[12px] leading-[1.4] text-[#a3434b]">
              {PLAN_FORK_ACCEPT_ERROR}
            </p>
          ) : null}
          {acceptStatus === "unavailable" ? (
            <p role="alert" className="text-center text-[12px] leading-[1.4] text-[#a3434b]">
              {PLAN_FORK_ACCEPT_UNAVAILABLE}
            </p>
          ) : null}

          <p className="text-center text-[12px] leading-[1.4] text-[#8a837c]">
            {PLAN_FORK_MICROCOPY}
          </p>
        </div>
      </footer>
    </div>
  )
}
