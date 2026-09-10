"use client"

import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"

import { usePlanSelection } from "@/components/checkout/use-plan-selection"
import { PremiumSheetCheckout } from "@/components/premium-sheet/premium-sheet-checkout"
import { PremiumSheetUnlockToast } from "@/components/premium-sheet/premium-sheet-unlock-toast"
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import {
  FREEMIUM_CHECKOUT_RETURN_PARAM,
  sanitizeFreemiumCheckoutReturnPath,
} from "@/lib/freemium/checkout-return"
import { PREMIUM_FEATURES, type PremiumSheetContext } from "@/lib/premium-sheet/context"
import { premiumSheetDismissLabel } from "@/lib/premium-sheet/dismiss-label"
import { orderedBenefits } from "@/lib/premium-sheet/ordered-benefits"
import {
  premiumSheetPlan,
  premiumSheetPlans,
  PREMIUM_SHEET_DEFAULT_INTERVAL,
  PREMIUM_SHEET_RECOMMENDED_BADGE,
} from "@/lib/premium-sheet/pricing"
import {
  PREMIUM_SHEET_PURCHASE_COPY,
  premiumSheetPurchaseFailureCopy,
} from "@/lib/premium-sheet/purchase-copy"
import {
  initialPremiumSheetPurchaseState,
  isPremiumSheetPlanSelectionActive,
  premiumSheetPurchaseReducer,
  premiumSheetShowsCheckout,
} from "@/lib/premium-sheet/purchase-state"
import { cn } from "@/lib/utils"

/**
 * The Premium sheet (T13, freemium-scanner-first PR4) — the program's one conversion
 * surface. It replaces T5's stub in place: same opener contract (`open` / `context` /
 * `onClose`), so every gate that already opens it — the scan verdict (T9), the trigger
 * cards (T10), the gated „Beispiel" pages (T12) — is untouched.
 *
 * Three things, in this order:
 *  1. what the user just bumped into, explained — `orderedBenefits` puts that feature
 *     first (plum, the repo's selected/accent colour) and fills the other two slots from
 *     the core order, so the sheet never reads as a single-feature paywall;
 *  2. the three plans at standard-catalog prices (`@/lib/premium-sheet/pricing` — never
 *     the launch catalog, whatever the launch-pricing flag says), Jährlich preselected;
 *  3. one coral CTA, and an escape that is always one tap away. Declining costs nothing:
 *     the free scanner keeps working exactly as before.
 *
 * **T14 — contextual purchase completion.** The CTA no longer dismisses: it swaps the
 * sheet's body for Stripe embedded checkout, in place. The whole purchase happens inside
 * this component, which is why the opener contract still does not change — no navigation,
 * no `/welcome`, no lost scan state.
 *
 * What this component may and may not conclude:
 *  - Stripe's `onComplete` moves it to „prüfen", never to unlocked. Only
 *    `POST /api/freemium/purchase/complete` — which re-reads the Session from Stripe —
 *    unlocks anything. The state machine (`lib/premium-sheet/purchase-state.ts`) makes that
 *    the only reachable path.
 *  - On unlock it refreshes the router and closes. The gates are server-rendered from the
 *    entitlement tier, so the refresh is what turns the „Beispiel" frame into the buyer's
 *    real content — the toast just says so.
 *  - Every failure lands back on the plan rows inside the same open sheet. Nothing is
 *    navigated and nothing about the free session is touched.
 */
export function PremiumSheet({
  open,
  context,
  onClose,
}: {
  open: boolean
  context: PremiumSheetContext | null
  onClose: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [purchase, dispatchPurchase] = useReducer(
    premiumSheetPurchaseReducer,
    initialPremiumSheetPurchaseState,
  )
  const [toastDismissed, setToastDismissed] = useState(false)
  // BottomSheetContent keeps rendering through the ~200-250ms exit animation
  // (see bottom-sheet.tsx `closing`), but openers null out `context` the moment
  // they set `open` to false. Hold the last non-null context in state so the
  // benefit order, plum accent and escape label stay put while the sheet
  // animates out instead of flipping mid-exit (T13 fix round 1, F1). Adjusting
  // state during render (not a ref) keeps this compatible with the
  // react-hooks/refs rule, which forbids reading/writing refs during render.
  const [heldContext, setHeldContext] = useState<PremiumSheetContext | null>(context)
  if (context !== null && context !== heldContext) setHeldContext(context)
  const renderedContext = context ?? heldContext

  const benefits = orderedBenefits(renderedContext)
  const plans = premiumSheetPlans()
  const { selectedInterval, selectPlan } = usePlanSelection({
    defaultInterval: PREMIUM_SHEET_DEFAULT_INTERVAL,
  })
  const selectedPlan = premiumSheetPlan(selectedInterval)
  const dismissLabel = premiumSheetDismissLabel(renderedContext)
  const returnPath = sanitizeFreemiumCheckoutReturnPath(pathname)
  const planSelectionActive = isPremiumSheetPlanSelectionActive(purchase)
  const showsCheckout = premiumSheetShowsCheckout(purchase)

  /**
   * Verification. The only path to an unlocked state — and the only place the server is
   * asked whether money actually moved.
   */
  const verify = useCallback(
    async (sessionId: string) => {
      type CompletionPayload = { status?: unknown; routineReady?: unknown } | null
      let payload: CompletionPayload = null
      try {
        const response = await fetch("/api/freemium/purchase/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        payload = (await response.json().catch(() => null)) as CompletionPayload
        if (!response.ok) payload = null
      } catch {
        payload = null
      }
      if (payload?.status === "complete") {
        dispatchPurchase({
          type: "verification_complete",
          routineReady: payload.routineReady === true,
        })
        return
      }
      if (payload?.status === "pending") {
        dispatchPurchase({ type: "verification_pending" })
        return
      }
      dispatchPurchase({ type: "verification_failed" })
    },
    [dispatchPurchase],
  )

  const verifyingSessionId = purchase.phase === "verifying" ? purchase.sessionId : null
  useEffect(() => {
    if (!verifyingSessionId) return
    void verify(verifyingSessionId)
  }, [verifyingSessionId, verify])

  /**
   * The contextual return for redirect-based payment methods (PayPal above all). Stripe
   * navigates back to the ORIGINATING surface — never `/welcome` — carrying the Session id,
   * and this sheet, which is mounted on every gate, picks it up and finishes exactly the
   * same verification the in-place completion runs.
   */
  const consumedReturnRef = useRef<string | null>(null)
  useEffect(() => {
    // Read from `window.location` rather than `useSearchParams`: this component is mounted
    // on every gate, and `useSearchParams` would force a Suspense boundary (and a client
    // bailout) onto all of them for a parameter that only ever exists on a redirect return.
    if (typeof window === "undefined") return
    const returnedSessionId = new URLSearchParams(window.location.search).get(
      FREEMIUM_CHECKOUT_RETURN_PARAM,
    )
    if (!returnedSessionId || consumedReturnRef.current === returnedSessionId) return
    consumedReturnRef.current = returnedSessionId
    dispatchPurchase({ type: "provider_completed", sessionId: returnedSessionId })
    // Drop the parameter so a refresh (or a shared link) cannot replay the return.
    router.replace(pathname ?? returnPath)
  }, [router, pathname, returnPath])

  /**
   * Unlock: refresh the server-rendered gates so the originating surface shows the buyer's
   * real content, raise the toast, then close the sheet into it.
   */
  const unlocked = purchase.phase === "unlocked"
  useEffect(() => {
    if (!unlocked) return
    router.refresh()
    onClose()
  }, [unlocked, router, onClose])
  // Derived, not set from the effect above: the toast is simply "unlocked and not yet
  // dismissed", which also keeps the repo's no-setState-in-effect rule satisfied.
  const toastVisible = unlocked && !toastDismissed

  const startCheckout = useCallback(() => {
    dispatchPurchase({
      type: "checkout_requested",
      interval: selectedInterval,
      attemptId: crypto.randomUUID(),
    })
  }, [selectedInterval])

  const onCheckoutReady = useCallback(() => dispatchPurchase({ type: "checkout_ready" }), [])
  const onCheckoutFailed = useCallback(
    () => dispatchPurchase({ type: "checkout_failed", reason: "checkout_unavailable" }),
    [],
  )
  const onCheckoutCompleted = useCallback(
    (sessionId: string) => dispatchPurchase({ type: "provider_completed", sessionId }),
    [],
  )
  const backToPlans = useCallback(() => dispatchPurchase({ type: "returned_to_plans" }), [])

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <BottomSheetContent
        className="max-h-[88dvh]"
        contentClassName="px-5 pb-5"
        header={
          <div className="px-5 pb-1 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-plum-dark)]">
              Chaarlie Premium
            </p>
            <BottomSheetTitle className="mt-1 text-[19px]">Alles für dein Haar.</BottomSheetTitle>
          </div>
        }
        footer={
          <div className="flex flex-col gap-1">
            {planSelectionActive ? (
              <Button
                variant="cta"
                className="w-full"
                data-premium-sheet-cta="true"
                data-premium-sheet-selected-interval={selectedInterval}
                onClick={startCheckout}
              >
                {selectedPlan.ctaLabel}
              </Button>
            ) : null}
            {/* One escape, always present and always one tap away — including mid-payment,
                where it returns to the plan rows instead of closing the sheet. */}
            <button
              type="button"
              data-premium-sheet-dismiss="true"
              onClick={showsCheckout ? backToPlans : onClose}
              className="min-h-[44px] w-full text-[13px] font-semibold text-muted-foreground"
            >
              {showsCheckout ? PREMIUM_SHEET_PURCHASE_COPY.backToPlans : dismissLabel}
            </button>
          </div>
        }
      >
        {/* The payment step replaces the sheet's BODY, never the sheet: the header, the
            escape and the buyer's place in the app all stay exactly where they were. */}
        {purchase.phase === "starting" || purchase.phase === "paying" ? (
          <PremiumSheetCheckout
            interval={purchase.interval}
            attemptId={purchase.attemptId}
            returnPath={returnPath}
            onReady={onCheckoutReady}
            onFailed={onCheckoutFailed}
            onCompleted={onCheckoutCompleted}
          />
        ) : purchase.phase === "verifying" ? (
          <p
            data-premium-sheet-purchase-phase="verifying"
            aria-live="polite"
            className="py-10 text-center text-sm font-semibold text-[var(--brand-plum-darkest)]"
          >
            {PREMIUM_SHEET_PURCHASE_COPY.verifying}
          </p>
        ) : purchase.phase === "pending" ? (
          <div
            data-premium-sheet-purchase-phase="pending"
            aria-live="polite"
            className="rounded-[14px] bg-[var(--brand-plum-ice)] px-4 py-5 text-center"
          >
            <p className="text-sm font-bold text-[var(--brand-plum-darkest)]">
              {PREMIUM_SHEET_PURCHASE_COPY.pendingTitle}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              {PREMIUM_SHEET_PURCHASE_COPY.pendingBody}
            </p>
          </div>
        ) : (
          <>
            {purchase.phase === "failed" ? (
              <div
                data-premium-sheet-purchase-phase="failed"
                role="alert"
                className="mb-3 rounded-[12px] border border-destructive/30 bg-destructive/10 px-3 py-2"
              >
                <p className="text-[13px] font-semibold text-destructive">
                  {premiumSheetPurchaseFailureCopy(purchase.reason)}
                </p>
              </div>
            ) : null}
            {/* One tinted block for what the user just tapped, two quiet rows behind it —
                the sheet has enough boxes with the plan rows below. */}
            <ul className="flex flex-col">
              {benefits.map((featureId, index) => {
                const feature = PREMIUM_FEATURES[featureId]
                const accented = index === 0
                return (
                  <li
                    key={featureId}
                    data-premium-sheet-benefit={featureId}
                    data-premium-sheet-benefit-accent={accented ? "true" : "false"}
                    className={cn(
                      "px-3 py-2.5",
                      accented
                        ? "rounded-[12px] bg-[var(--brand-plum-ice)]"
                        : "border-b border-border last:border-b-0",
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-bold",
                        accented ? "text-[var(--brand-plum-darkest)]" : "text-foreground",
                      )}
                    >
                      {feature.name}
                    </p>
                    <BottomSheetDescription className="mt-0.5 leading-snug">
                      {feature.benefit}
                    </BottomSheetDescription>
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 grid gap-2" data-premium-sheet-plans="true">
              {plans.map((plan) => {
                const isSelected = plan.interval === selectedInterval
                return (
                  <button
                    key={plan.interval}
                    type="button"
                    aria-pressed={isSelected}
                    data-premium-sheet-plan={plan.interval}
                    data-premium-sheet-plan-selected={isSelected ? "true" : "false"}
                    onClick={() => selectPlan(plan.interval)}
                    className={cn(
                      "relative flex min-h-[60px] items-center gap-3 rounded-[14px] border bg-card px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                        : "border-border",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-[18px] shrink-0 place-items-center rounded-full border-2",
                        isSelected
                          ? "border-[var(--brand-plum)] bg-[var(--brand-plum)]"
                          : "border-border bg-background",
                      )}
                    >
                      {isSelected ? <span className="size-1.5 rounded-full bg-white" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-[var(--brand-plum-darkest)]">
                        {plan.name}
                        {plan.recommended ? (
                          <span className="ml-2 rounded-full bg-[var(--brand-plum)] px-2 py-0.5 align-middle font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-white">
                            {PREMIUM_SHEET_RECOMMENDED_BADGE}
                          </span>
                        ) : null}
                      </span>
                      {plan.detail ? (
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                          {plan.detail}
                        </span>
                      ) : null}
                    </span>
                    <span
                      data-premium-sheet-plan-price={plan.interval}
                      className="shrink-0 text-[17px] font-bold leading-none text-[var(--brand-plum-darkest)]"
                    >
                      {plan.price}
                    </span>
                  </button>
                )
              })}
              <p className="mt-1 text-center text-[11px] text-[var(--text-caption)]">
                Jederzeit kündbar
              </p>
            </div>
          </>
        )}
      </BottomSheetContent>
      {/* Outside BottomSheetContent on purpose: the toast has to survive the sheet's exit
          animation and the surface re-render behind it. */}
      <PremiumSheetUnlockToast
        visible={toastVisible}
        routineReady={purchase.phase === "unlocked" ? purchase.routineReady : true}
        onDismiss={() => setToastDismissed(true)}
      />
    </BottomSheet>
  )
}
