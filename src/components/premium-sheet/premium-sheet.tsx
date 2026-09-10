"use client"

import { usePlanSelection } from "@/components/checkout/use-plan-selection"
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { PREMIUM_FEATURES, type PremiumSheetContext } from "@/lib/premium-sheet/context"
import { premiumSheetDismissLabel } from "@/lib/premium-sheet/dismiss-label"
import { orderedBenefits } from "@/lib/premium-sheet/ordered-benefits"
import {
  premiumSheetPlan,
  premiumSheetPlans,
  PREMIUM_SHEET_DEFAULT_INTERVAL,
  PREMIUM_SHEET_RECOMMENDED_BADGE,
} from "@/lib/premium-sheet/pricing"
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
 * The CTA is still T5's placeholder — **T14** mounts embedded checkout behind it. Nothing
 * here creates a checkout session, charges, or activates anything.
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
  const benefits = orderedBenefits(context)
  const plans = premiumSheetPlans()
  const { selectedInterval, selectPlan } = usePlanSelection({
    defaultInterval: PREMIUM_SHEET_DEFAULT_INTERVAL,
  })
  const selectedPlan = premiumSheetPlan(selectedInterval)
  const dismissLabel = premiumSheetDismissLabel(context)

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
            {/* T14 wires this to embedded checkout; until then it keeps T5's placeholder
                behaviour (dismiss) so nothing here can start a payment by accident. */}
            <Button
              variant="cta"
              className="w-full"
              data-premium-sheet-cta="true"
              data-premium-sheet-selected-interval={selectedInterval}
              onClick={onClose}
            >
              {selectedPlan.ctaLabel}
            </Button>
            <button
              type="button"
              data-premium-sheet-dismiss="true"
              onClick={onClose}
              className="min-h-[44px] w-full text-[13px] font-semibold text-muted-foreground"
            >
              {dismissLabel}
            </button>
          </div>
        }
      >
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
      </BottomSheetContent>
    </BottomSheet>
  )
}
