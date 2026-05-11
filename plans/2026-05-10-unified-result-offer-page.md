# Unified Result Offer Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-quiz result CTA handoff with one owner-facing result + offer page that shows the diagnosis, pricing selection, and real embedded Stripe checkout before redirecting to the existing `/welcome?session_id=...` account activation flow.

**Architecture:** Build this only for the quiz owner's step-11 result surface. Keep `/result/[leadId]` as the current share artifact and keep `/welcome` as the post-payment password-or-magic-link activation page. Reuse `buildQuizResultNarrative` for the diagnostic content, reuse the existing Stripe checkout session route, and add a focused pricing/checkout component that mounts embedded Stripe only after the selected-plan CTA is clicked.

**Tech Stack:** Next.js App Router, React 19 client components, Tailwind CSS, lucide-react, Stripe Embedded Checkout, Supabase lead metadata, node:test via `tsx`, Playwright.

---

## Alignment Summary

- Replace only `src/components/quiz/quiz-results.tsx` owner flow, not the public `/result/[leadId]` page.
- Use the mockup at `docs/superpowers/specs/2026-05-10-result-offer-merged-mockup.html` as visual source of truth for section order, tone, spacing, and styling.
- Use the current live Stripe pricing from the existing `/pricing` page:
  - `month`: Monatlich, `€14,99`, `/ Monat`
  - `quarter`: Quartal, `€34,99`, `~€11,66 / Monat`, `22% sparen`
  - `year`: Jährlich, `€99,99`, `~€8,33 / Monat`, `44% sparen`
- Keep the countdown cosmetic in this pass. Do not add lead-row expiry fields, server-side offer expiration, Stripe coupons, or price switching.
- Checkout behavior:
  - Plan cards are visible in the pricing section.
  - `quarter` is selected by default.
  - Stripe checkout is not mounted on initial render.
  - Clicking the selected-plan CTA expands an inline checkout panel below pricing and scrolls to it.
  - Changing the selected plan collapses/remounts checkout for that plan.
  - Stripe success still redirects to `/welcome?session_id={CHECKOUT_SESSION_ID}`.
- Keep `/pricing` available for direct entry and resubscribe flows.
- Existing paid/signed-in users should not be forced into a new checkout from a retake result. Use `profile.subscription_status` and `isSubscriptionActive` to keep their direct onboarding CTA.
- Owner result share controls are out of scope for this first pass. The public share page remains available and unchanged.

## Branch / Worktree Setup

Root checkout state at planning time:

- `/Users/nick/AI_work/hair_conscierge` is on `main`.
- It is dirty with unrelated local edits and untracked docs/plans.
- It is `ahead 1, behind 44` against `origin/main`.
- The mockup commit is local `2a13a3c`.

Implementation must not happen in the root checkout.

- [ ] **Step 1: Create a fresh worktree**

Run from the root checkout:

```bash
npm run worktree:new -- unified-result-offer-page
cd /Users/nick/AI_work/hair_conscierge/.worktrees/unified-result-offer-page
```

Expected:

- New worktree exists at `.worktrees/unified-result-offer-page`.
- Branch is `codex/unified-result-offer-page`.
- Base is fresh `origin/main`.

- [ ] **Step 2: Bring in the committed mockup file**

Run inside the new worktree:

```bash
git checkout 2a13a3c -- docs/superpowers/specs/2026-05-10-result-offer-merged-mockup.html
git status --short
```

Expected:

- `docs/superpowers/specs/2026-05-10-result-offer-merged-mockup.html` is present and remains unstaged until the implementation stages it intentionally.
- No unrelated root-checkout files appear in this worktree.

## Target File Map

- Create: `src/lib/stripe/pricing-plans.ts`
  - Shared plan copy and CTA labels for `/pricing` and the merged result page.
- Create: `src/components/quiz/result-offer-countdown.tsx`
  - Cosmetic countdown used by sticky bar and pricing urgency block.
- Create: `src/components/quiz/result-offer-pricing.tsx`
  - Plan selection, selected-plan CTA, inline Stripe checkout expansion, error/retry state.
- Create: `src/components/quiz/quiz-result-offer-page.tsx`
  - Owner-facing merged page using narrative data, static trust/feature/comparison sections, and `ResultOfferPricing`.
- Modify: `src/lib/quiz/result-narrative.ts`
  - Add deterministic hero headline text based on the pull-test protein/moisture signal.
- Modify: `tests/quiz-result-narrative.test.ts`
  - Lock hero headline behavior.
- Modify: `src/components/quiz/quiz-results.tsx`
  - Render the new owner offer page for unpaid/anonymous users; preserve paid signed-in direct-onboarding behavior.
- Modify: `src/app/pricing/pricing-cards.tsx`
  - Import shared pricing plan definitions without changing the direct `/pricing` route's core behavior.
- Create: `tests/result-offer-page.test.tsx`
  - Static render smoke test for the merged owner page sections and CTA labels.
- Modify: `tests/quiz-onboarding-e2e.spec.ts`
  - Update result-step expectations so automated quiz tests do not expect navigation to `/pricing`.
- Modify: `tests/stripe-subscription-e2e.spec.ts`
  - Update the skipped manual golden path comments/test steps to cover quiz result inline checkout.

## Task 1: Shared Pricing Plan Contract

**Files:**

- Create: `src/lib/stripe/pricing-plans.ts`
- Modify: `src/app/pricing/pricing-cards.tsx`
- Test: `tests/stripe-intervals.spec.ts`

- [ ] **Step 1: Create shared plan definitions**

Create `src/lib/stripe/pricing-plans.ts`:

```ts
import type { BillingInterval } from "./intervals"

export interface StripePricingPlan {
  interval: BillingInterval
  name: string
  price: string
  perMonth: string
  badge?: string
  savings?: string
  ctaLabel: string
}

export const STRIPE_PRICING_PLANS: readonly StripePricingPlan[] = [
  {
    interval: "month",
    name: "Monatlich",
    price: "€14,99",
    perMonth: "/ Monat",
    ctaLabel: "Jetzt starten — €14,99 / Monat",
  },
  {
    interval: "quarter",
    name: "Quartal",
    price: "€34,99",
    perMonth: "~€11,66 / Monat",
    savings: "22% sparen",
    ctaLabel: "Jetzt starten — €34,99 im Quartal",
  },
  {
    interval: "year",
    name: "Jährlich",
    price: "€99,99",
    perMonth: "~€8,33 / Monat",
    badge: "Beliebt",
    savings: "44% sparen",
    ctaLabel: "Jetzt starten — €99,99 / Jahr",
  },
] as const

export const DEFAULT_PRICING_INTERVAL: BillingInterval = "quarter"

export function getStripePricingPlan(interval: BillingInterval): StripePricingPlan {
  const plan = STRIPE_PRICING_PLANS.find((candidate) => candidate.interval === interval)
  if (!plan) {
    throw new Error(`Unknown pricing interval: ${interval}`)
  }
  return plan
}
```

- [ ] **Step 2: Update `/pricing` to consume shared plans**

In `src/app/pricing/pricing-cards.tsx`, remove the local `Plan` interface and `PLANS` array, then import:

```ts
import type { BillingInterval } from "@/lib/stripe/intervals"
import { STRIPE_PRICING_PLANS } from "@/lib/stripe/pricing-plans"
```

Use:

```ts
type PlanInterval = BillingInterval
const PLANS = STRIPE_PRICING_PLANS
```

Update existing `Plan["interval"]` references to `PlanInterval`.

Expected behavior:

- `/pricing` still shows the same three plan cards and copy.
- Existing checkout creation payload still sends `interval`.

- [ ] **Step 3: Run interval/pricing-adjacent tests**

Run:

```bash
npx playwright test tests/stripe-intervals.spec.ts --project=chromium
```

Expected:

- PASS.

## Task 2: Narrative Hero Headline

**Files:**

- Modify: `src/lib/quiz/result-narrative.ts`
- Modify: `tests/quiz-result-narrative.test.ts`

- [ ] **Step 1: Add failing tests for hero headline**

Append to `tests/quiz-result-narrative.test.ts`:

```ts
test("hero headline maps overextended pull test to protein-led result", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    pulltest: "stretches_stays",
    concerns: ["breakage"],
    goals: ["strengthen"],
  })

  assert.equal(
    narrative.heroHeadline,
    "Dein Haar braucht mehr Protein als Feuchtigkeit.",
  )
})

test("hero headline maps snapping pull test to moisture-led result", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    pulltest: "snaps",
    concerns: ["dryness"],
    goals: ["moisture"],
  })

  assert.equal(
    narrative.heroHeadline,
    "Dein Haar braucht mehr Feuchtigkeit als Protein.",
  )
})

test("hero headline has a balanced fallback", () => {
  const narrative = buildQuizResultNarrative({
    structure: "curly",
    thickness: "normal",
    pulltest: "stretches_bounces",
    concerns: ["frizz"],
    goals: ["less_frizz"],
  })

  assert.equal(
    narrative.heroHeadline,
    "Deine Balance ist näher dran, als es sich gerade anfühlt.",
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected:

- FAIL because `heroHeadline` does not exist.

- [ ] **Step 3: Add the hero headline to the narrative contract**

In `src/lib/quiz/result-narrative.ts`, add this field to `QuizResultNarrative`:

```ts
heroHeadline: string
```

Add this helper near the other build helpers:

```ts
function buildHeroHeadline(answers: QuizAnswers): string {
  if (answers.pulltest === "stretches_stays") {
    return "Dein Haar braucht mehr Protein als Feuchtigkeit."
  }

  if (answers.pulltest === "snaps") {
    return "Dein Haar braucht mehr Feuchtigkeit als Protein."
  }

  return "Deine Balance ist näher dran, als es sich gerade anfühlt."
}
```

In `buildQuizResultNarrative`, include:

```ts
heroHeadline: buildHeroHeadline(answers),
```

- [ ] **Step 4: Run the narrative tests**

Run:

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected:

- PASS.

## Task 3: Cosmetic Countdown

**Files:**

- Create: `src/components/quiz/result-offer-countdown.tsx`

- [ ] **Step 1: Create the countdown component**

Create `src/components/quiz/result-offer-countdown.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"

interface ResultOfferCountdownProps {
  initialSeconds?: number
  className?: string
}

function formatSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const rest = safeSeconds % 60
  return `${minutes}:${String(rest).padStart(2, "0")}`
}

export function ResultOfferCountdown({
  initialSeconds = 8 * 60 + 28,
  className,
}: ResultOfferCountdownProps) {
  const [remaining, setRemaining] = useState(initialSeconds)

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(id)
  }, [])

  return <span className={className}>{formatSeconds(remaining)}</span>
}
```

- [ ] **Step 2: Keep it explicitly cosmetic**

Do not add database fields, API reads, server actions, or Stripe discount logic for this countdown.

## Task 4: Result Offer Pricing + Inline Checkout

**Files:**

- Create: `src/components/quiz/result-offer-pricing.tsx`
- Test: `tests/result-offer-page.test.tsx`

- [ ] **Step 1: Create the pricing checkout component**

Create `src/components/quiz/result-offer-pricing.tsx`:

```tsx
"use client"

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { CreditCard } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import type { BillingInterval } from "@/lib/stripe/intervals"
import {
  DEFAULT_PRICING_INTERVAL,
  STRIPE_PRICING_PLANS,
  getStripePricingPlan,
} from "@/lib/stripe/pricing-plans"
import { ResultOfferCountdown } from "./result-offer-countdown"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface ResultOfferPricingProps {
  leadId: string | null
  onCheckoutOpen?: (interval: BillingInterval) => void
}

export function ResultOfferPricing({ leadId, onCheckoutOpen }: ResultOfferPricingProps) {
  const [selectedInterval, setSelectedInterval] =
    useState<BillingInterval>(DEFAULT_PRICING_INTERVAL)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const checkoutRef = useRef<HTMLDivElement>(null)
  const selectedPlan = getStripePricingPlan(selectedInterval)

  const fetchClientSecret = useCallback(async () => {
    setCheckoutError(null)

    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        interval: selectedInterval,
        ...(leadId ? { leadId } : {}),
      }),
    })

    if (!res.ok) {
      const msg = "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."
      setCheckoutError(msg)
      throw new Error("failed to create checkout session")
    }

    const data = await res.json()
    return data.client_secret as string
  }, [leadId, selectedInterval])

  const checkoutOptions = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret])

  function choosePlan(interval: BillingInterval) {
    setSelectedInterval(interval)
    setCheckoutError(null)
    setCheckoutOpen(false)
  }

  function openCheckout() {
    setCheckoutError(null)
    setCheckoutOpen(true)
    onCheckoutOpen?.(selectedInterval)
    window.requestAnimationFrame(() => {
      checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  return (
    <section id="pricing" className="border-t border-[var(--border)] py-8">
      <p className="type-label text-center text-[var(--brand-plum)]">Dein Plan ist fertig</p>
      <h2 className="mt-2 text-center font-header text-4xl font-medium text-foreground">
        Starte <em className="text-[var(--brand-plum)]">Haarmony</em>
      </h2>
      <p className="mx-auto mt-3 max-w-[34rem] text-center text-base leading-7 text-muted-foreground">
        Deine Auswertung zeigt, was möglich ist. Dein Plan zeigt dir wie.
      </p>

      <div className="mt-6 rounded-[14px] border border-[rgba(212,97,106,0.14)] bg-[#FDEEF0] p-5 text-center">
        <p className="type-label flex items-center justify-center gap-2 text-[var(--brand-coral)]">
          Angebot läuft ab in
        </p>
        <ResultOfferCountdown className="mt-2 block text-3xl font-bold text-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">Danach gilt der normale Preis</p>
      </div>

      <div className="mt-6 space-y-3">
        {STRIPE_PRICING_PLANS.map((plan) => {
          const selected = plan.interval === selectedInterval
          return (
            <button
              key={plan.interval}
              type="button"
              onClick={() => choosePlan(plan.interval)}
              aria-pressed={selected}
              className={[
                "relative flex w-full items-center gap-4 rounded-[14px] border bg-white px-5 py-4 text-left transition",
                selected
                  ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                  : "border-border hover:border-[rgba(var(--brand-plum-rgb),0.3)]",
              ].join(" ")}
            >
              {plan.badge ? (
                <span className="absolute -top-2 right-4 rounded-full bg-[var(--brand-plum)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-white">
                  {plan.badge}
                </span>
              ) : null}
              <span
                className={[
                  "grid size-5 shrink-0 place-items-center rounded-full border-2",
                  selected ? "border-[var(--brand-plum)] bg-[var(--brand-plum)]" : "border-border",
                ].join(" ")}
              >
                {selected ? <span className="size-2 rounded-full bg-white" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-foreground">{plan.name}</span>
                <span className="block text-xs text-muted-foreground">
                  <strong className="font-semibold text-foreground">{plan.price}</strong>{" "}
                  {plan.perMonth}
                  {plan.savings ? ` · ${plan.savings}` : ""}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={openCheckout}
        className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--brand-coral)] px-5 py-3 text-[15px] font-bold text-white shadow-[0_10px_28px_-14px_rgba(212,97,106,0.55)] transition hover:-translate-y-0.5"
      >
        <CreditCard className="size-4" />
        {selectedPlan.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        14 Tage Geld-zurück-Garantie · Kein Risiko
      </p>

      <div ref={checkoutRef} className="scroll-mt-20">
        {checkoutError ? (
          <div className="mt-5 rounded-lg border border-destructive/50 bg-destructive/10 p-5 text-center">
            <p className="text-sm text-destructive">{checkoutError}</p>
            <button
              type="button"
              onClick={openCheckout}
              className="mt-4 rounded-lg bg-[var(--brand-plum)] px-4 py-2 text-sm font-semibold text-white"
            >
              Erneut versuchen
            </button>
          </div>
        ) : null}

        {checkoutOpen && !checkoutError ? (
          <div className="mt-6 rounded-[16px] border border-border bg-white p-3 shadow-sm">
            <button
              type="button"
              onClick={() => setCheckoutOpen(false)}
              className="mb-3 text-sm font-semibold text-[var(--brand-plum)]"
            >
              Plan ändern
            </button>
            <div className="min-h-[640px]">
              <EmbeddedCheckoutProvider
                key={selectedInterval}
                stripe={stripePromise}
                options={checkoutOptions}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Confirm route contract stays unchanged**

Do not change `src/app/api/stripe/create-checkout-session/route.ts` for this task. It already accepts `{ interval, leadId }` and returns a `client_secret` for embedded checkout with `return_url` set to `/welcome?session_id={CHECKOUT_SESSION_ID}`.

## Task 5: Owner Result Offer Page

**Files:**

- Create: `src/components/quiz/quiz-result-offer-page.tsx`
- Test: `tests/result-offer-page.test.tsx`

- [ ] **Step 1: Create the merged page component**

Create `src/components/quiz/quiz-result-offer-page.tsx`. Use the mockup's section order and this component shape:

```tsx
"use client"

import Image from "next/image"
import type { QuizResultNarrative } from "@/lib/quiz/result-narrative"
import { ResultOfferCountdown } from "./result-offer-countdown"
import { ResultOfferPricing } from "./result-offer-pricing"

interface QuizResultOfferPageProps {
  name: string
  narrative: QuizResultNarrative
  leadId: string | null
  onCheckoutOpen?: () => void
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Du"
}

export function QuizResultOfferPage({
  name,
  narrative,
  leadId,
  onCheckoutOpen,
}: QuizResultOfferPageProps) {
  const displayName = firstName(name)

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[520px] items-center justify-between px-5 py-3">
          <div className="type-label flex items-center gap-2 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-[var(--brand-coral)]" />
            Angebot:{" "}
            <ResultOfferCountdown className="text-sm font-bold text-[var(--brand-coral)]" />
          </div>
          <a
            href="#pricing"
            className="rounded-[12px] bg-[var(--brand-coral)] px-5 py-3 text-sm font-semibold text-white"
          >
            Jetzt sichern
          </a>
        </div>
      </div>

      <main className="mx-auto max-w-[520px] px-5">
        <section className="py-8 text-center">
          <span className="inline-flex items-center rounded-full border border-green-600/25 bg-green-600/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-green-700">
            Analyse fertig
          </span>
          <p className="type-label mt-5 text-[var(--brand-plum)]">
            {displayName}, dein Ergebnis
          </p>
          <h1 className="mt-3 font-header text-[34px] font-medium leading-[1.16] text-foreground">
            {narrative.heroHeadline}
          </h1>
        </section>

        <section className="space-y-4 pb-8">
          {narrative.rows.map((row) => (
            <article
              key={row.label}
              className="rounded-[16px] border border-border bg-white p-5 shadow-sm"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="type-label text-[var(--brand-plum)]">{row.label}</p>
                <span className="rounded-full border border-[rgba(var(--brand-plum-rgb),0.25)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
                  {row.scope}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4616A]">
                    Heute
                  </p>
                  <p className="mt-2 font-header text-[22px] leading-tight text-foreground">
                    {row.before}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-green-700">
                    Ziel
                  </p>
                  <p className="mt-2 font-header text-[22px] leading-tight text-foreground">
                    {row.after}
                  </p>
                </div>
              </div>
              <div className="mt-5 px-3">
                <div className="relative h-2 rounded-full bg-[linear-gradient(90deg,#E47474_0%,#E8A557_33%,#D9C460_55%,#A8C76E_78%,#7AB582_100%)]">
                  <span
                    className="absolute top-1/2 grid size-[22px] -translate-y-1/2 place-items-center rounded-full border-[2.5px] border-[#D4616A] bg-white"
                    style={{ left: `${row.currentPosition}%`, transform: "translate(-50%, -50%)" }}
                  >
                    <span className="size-2 rounded-full bg-[#D4616A]" />
                  </span>
                  <span
                    className="absolute top-1/2 grid size-[22px] -translate-y-1/2 place-items-center rounded-full border border-dashed border-green-700 bg-white"
                    style={{ left: `${row.targetPosition}%`, transform: "translate(-50%, -50%)" }}
                  >
                    <span className="size-2 rounded-full border border-green-700" />
                  </span>
                </div>
                <div className="mt-3 flex justify-between text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>{row.tickBefore}</span>
                  <span>{row.tickAfter}</span>
                </div>
              </div>
            </article>
          ))}

          <article className="rounded-[16px] border border-border bg-white p-6 shadow-sm">
            <p className="type-label text-[var(--brand-plum)]">{narrative.needs.title}</p>
            <h2 className="mt-3 font-header text-2xl font-medium leading-tight text-foreground">
              {narrative.needs.mainLeverTitle}
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-foreground">
              {narrative.needs.mainLeverWhy}
            </p>
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
              {narrative.needs.mainLeverProducts}
            </p>
          </article>
        </section>

        <section className="border-t border-border py-8">
          <div className="relative overflow-hidden rounded-[16px] border border-border bg-white">
            <div className="space-y-3 p-6 blur-sm">
              <div className="h-3 w-3/4 rounded bg-[var(--brand-plum-ice)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--brand-plum-ice)]" />
              <div className="h-3 w-5/6 rounded bg-[var(--brand-plum-ice)]" />
              <div className="h-3 w-2/5 rounded bg-[var(--brand-plum-ice)]" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/55 p-6 text-center">
              <p className="font-header text-xl font-medium text-foreground">
                Dein 30-Tage-Plan ist fertig
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Mit konkreten Produkten für deine Situation
              </p>
              <a
                href="#pricing"
                className="mt-4 rounded-[12px] bg-[var(--brand-coral)] px-8 py-3 text-sm font-semibold text-white"
              >
                Plan freischalten
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-border py-8">
          <div className="flex gap-4">
            <Image
              src="https://assets.cdn.filesafe.space/ezJuYW8Fpy3PxAlRLr5w/media/69a16fda524b7136dd4042ab.png"
              alt="Tom"
              width={80}
              height={80}
              className="size-20 shrink-0 rounded-full border border-[var(--brand-plum)] object-cover"
            />
            <div>
              <p className="font-header text-[15px] italic leading-6 text-foreground">
                "Viele Frauen überladen ihr Haar mit Feuchtigkeit, dabei fehlt Protein. Das Haar wird weich, bricht aber trotzdem. Genau das erkennt Haarmony."
              </p>
              <p className="mt-2 text-sm font-bold text-foreground">Tom</p>
              <p className="text-xs text-muted-foreground">Friseurmeister & Haarmony-Gründer</p>
            </div>
          </div>
        </section>

        <section className="border-t border-border py-8 text-center">
          <p className="type-label text-[var(--brand-plum)]">Was Haarmony für dich tut</p>
          <h2 className="mt-2 font-header text-3xl font-medium leading-tight text-foreground">
            Dein persönlicher Haar-Experte. <em className="text-[var(--brand-plum)]">Immer dabei.</em>
          </h2>
          <div className="mt-6 space-y-4 text-left">
            <FeatureCard
              tag="Dein KI Haar-Berater"
              title="Frag alles. Bekomm sofort Antworten."
              body="Dein persönlicher Berater kennt dein Haar und antwortet sofort."
            />
            <FeatureCard
              tag="500+ geprüfte Produkte"
              title="Das richtige Shampoo. Der richtige Conditioner. Sofort."
              body="Haarmony sagt dir genau, welches Shampoo und welchen Conditioner du brauchst."
            />
            <FeatureCard
              tag="Deine Routine"
              title="Ein klarer Plan. Was. Wann. Wie oft."
              body="Haarmony baut dir eine Routine, die so einfach wie möglich ist."
            />
          </div>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="text-center font-header text-3xl font-medium">
            Ohne vs. mit <em className="text-[var(--brand-plum)]">Haarmony</em>
          </h2>
          <table className="mt-6 w-full overflow-hidden rounded-[12px] border border-border bg-white text-sm">
            <tbody>
              {[
                ["Protein/Feuchtigkeit-Analyse", "—", "Ja"],
                ["Passende Produkte", "Rätselraten", "500+ mit Namen"],
                ["Persönliche Routine", "Trial & Error", "Sofort"],
                ["Beratung bei Fragen", "Teurer Salon", "Jederzeit"],
                ["Sichtbares Ergebnis", "Monate?", "4 Wochen"],
              ].map(([label, without, withIt]) => (
                <tr key={label} className="border-t border-border first:border-t-0">
                  <td className="px-3 py-3 text-muted-foreground">{label}</td>
                  <td className="px-3 py-3 text-center text-muted-foreground">{without}</td>
                  <td className="bg-[var(--brand-plum-ice)] px-3 py-3 text-center font-bold text-[var(--brand-plum)]">
                    {withIt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <ResultOfferPricing leadId={leadId} onCheckoutOpen={onCheckoutOpen} />

        <section className="border-t border-border py-8 text-center">
          <h2 className="font-header text-3xl font-medium">
            Dein Haar wartet nicht.
            <br />
            <em className="text-[var(--brand-plum)]">Starte jetzt.</em>
          </h2>
          <a
            href="#pricing"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-[14px] bg-[var(--brand-coral)] px-5 py-3 text-sm font-bold text-white"
          >
            Mein Angebot sichern
          </a>
          <div className="h-12" />
        </section>
      </main>
    </div>
  )
}

function FeatureCard({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <article className="rounded-[14px] border border-border bg-white p-5">
      <p className="type-label text-[var(--brand-plum)]">{tag}</p>
      <h3 className="mt-2 text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  )
}
```

- [ ] **Step 2: Tighten visual fidelity after first render**

After the component compiles, compare it against the mockup in browser. Adjust only styling, spacing, and static copy in `quiz-result-offer-page.tsx`; do not add new behavior during this styling pass.

## Task 6: Wire `QuizResults`

**Files:**

- Modify: `src/components/quiz/quiz-results.tsx`

- [ ] **Step 1: Import active-subscription helper and new page**

In `src/components/quiz/quiz-results.tsx`, add:

```ts
import { isSubscriptionActive } from "@/lib/stripe/gating"
import { QuizResultOfferPage } from "./quiz-result-offer-page"
```

Change the auth destructure:

```ts
const { user, profile } = useAuth()
```

- [ ] **Step 2: Preserve signed-in active subscriber path**

Add:

```ts
const canGoStraightToRoutine = Boolean(user && leadId && profile && isSubscriptionActive(profile))
```

Use this for `getQuizResultCta({ canGoStraightToRoutine })`.

- [ ] **Step 3: Render the offer page for unpaid/anonymous owner flow**

Before the existing `return <QuizResultsView ... />`, add:

```tsx
if (!canGoStraightToRoutine) {
  return (
    <QuizResultOfferPage
      name={lead.name}
      narrative={narrative}
      leadId={leadId}
      onCheckoutOpen={() => {
        posthog.capture("quiz_completed", {
          structure: answers.structure,
          thickness: answers.thickness,
          scalp_type: answers.scalp_type,
          scalp_condition: answers.scalp_condition,
        })
      }}
    />
  )
}
```

Expected:

- Anonymous post-quiz users see merged diagnosis + pricing + inline checkout.
- Paid signed-in users still see the existing compact result view and can continue to onboarding.
- `/result/[leadId]` remains unchanged because it imports `QuizResultsView`, not `QuizResultOfferPage`.

## Task 7: Static Render Test

**Files:**

- Create: `tests/result-offer-page.test.tsx`

- [ ] **Step 1: Add a static smoke test**

Create `tests/result-offer-page.test.tsx`:

```tsx
import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizResultOfferPage } from "../src/components/quiz/quiz-result-offer-page"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"

test("owner result offer page renders diagnosis, offer pricing, and checkout CTA shell", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_stays",
    concerns: ["breakage"],
    goals: ["strengthen"],
  })

  const html = renderToStaticMarkup(
    <QuizResultOfferPage name="Sarah" narrative={narrative} leadId="lead-id" />,
  )

  assert.match(html, /Sarah, dein Ergebnis/i)
  assert.match(html, /Dein Haar braucht mehr Protein als Feuchtigkeit/i)
  assert.match(html, /Haargefühl/i)
  assert.match(html, /Was dein Haar jetzt braucht/i)
  assert.match(html, /Dein 30-Tage-Plan ist fertig/i)
  assert.match(html, /Monatlich/i)
  assert.match(html, /Quartal/i)
  assert.match(html, /Jährlich/i)
  assert.match(html, /€34,99/i)
  assert.match(html, /Jetzt starten/i)
  assert.doesNotMatch(html, /ERGEBNIS TEILEN|WHATSAPP|ALS BILD SPEICHERN/i)
})
```

- [ ] **Step 2: Run the static tests**

Run:

```bash
npx tsx --test tests/result-offer-page.test.tsx tests/quiz-result-narrative.test.ts tests/quiz-results-view.test.tsx
```

Expected:

- PASS.

If `renderToStaticMarkup` fails because Stripe browser packages are imported during server render, split the page into:

- `src/components/quiz/quiz-result-offer-static.tsx`
- `src/components/quiz/quiz-result-offer-page.tsx`

Then test only the static component and keep `ResultOfferPricing` as the client-only child.

## Task 8: E2E Expectations

**Files:**

- Modify: `tests/quiz-onboarding-e2e.spec.ts`
- Modify: `tests/stripe-subscription-e2e.spec.ts`

- [ ] **Step 1: Update quiz result expectations**

In `tests/quiz-onboarding-e2e.spec.ts`, replace result-step expectations that look for `PLAN FREISCHALTEN` and navigation to `/pricing` with expectations for the merged page:

```ts
await expect(page.getByText(/Analyse fertig/i)).toBeVisible({ timeout: 45_000 })
await expect(page.getByRole("heading", { name: /Dein Haar braucht/i })).toBeVisible()
await expect(page.getByText(/Dein Plan ist fertig/i)).toBeVisible()
await expect(page.getByRole("button", { name: /Jetzt starten/i })).toBeVisible()
```

For non-Stripe onboarding tests that only need to verify lead linking, keep the existing direct-auth shortcut:

```ts
const latestLead = await fetchLatestLead()
await page.goto(`/auth?next=${encodeURIComponent(`/onboarding?lead=${latestLead?.id ?? ""}`)}`)
```

Expected:

- Routine/onboarding tests do not attempt Stripe payment.
- Stripe payment remains covered by the skipped manual Stripe spec.

- [ ] **Step 2: Update manual Stripe golden path**

In `tests/stripe-subscription-e2e.spec.ts`, change the comments and flow from `/pricing?lead=...` to the owner result page flow:

```ts
// Manual golden path after this change:
// 1. Complete or seed the quiz lead.
// 2. Land on step 11 result offer page.
// 3. Confirm Monatlich / Quartal / Jährlich are visible.
// 4. Click the selected "Jetzt starten" CTA.
// 5. Wait for inline Stripe iframe.
// 6. Pay with the Stripe test card.
// 7. Verify redirect to /welcome?session_id=...
// 8. Verify password and magic-link activation choices are visible.
```

Keep the test skipped by default.

## Task 9: Verification

**Files:**

- No new files.

- [ ] **Step 1: Run unit/static tests**

Run:

```bash
npx tsx --test tests/quiz-result-narrative.test.ts tests/quiz-results-view.test.tsx tests/result-offer-page.test.tsx
```

Expected:

- PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected:

- PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected:

- PASS.

- [ ] **Step 4: Run targeted Playwright contracts**

Run:

```bash
npx playwright test tests/stripe-intervals.spec.ts tests/stripe-gating.spec.ts --project=chromium
```

Expected:

- PASS.

- [ ] **Step 5: Browser visual check**

Run:

```bash
npm run dev:worktree
```

Open the worktree dev URL, complete the quiz to step 11, and verify:

- Sticky offer bar stays fixed.
- Hero and three slider cards match the mockup direction.
- Summary card appears before locked plan teaser.
- Tom, feature cards, comparison, pricing, guarantee, and final CTA appear in order.
- Monthly, quarterly, and yearly prices match current `/pricing`.
- Stripe iframe is absent before clicking CTA.
- Clicking CTA reveals inline checkout below pricing and scrolls there.
- Changing plan collapses/remounts checkout for the new selected interval.
- Successful Stripe test payment redirects to `/welcome?session_id=...`.
- `/welcome` still shows password and magic-link activation choices.
- `/result/[leadId]` still renders the share result page, not this offer page.

- [ ] **Step 6: Manual Stripe check**

Run Stripe listener:

```bash
stripe listen --forward-to localhost:<worktree-port>/api/stripe/webhook
```

Use test card:

```text
4242 4242 4242 4242
12 / 34
123
10115
```

Expected:

- Checkout completes.
- Webhook activation succeeds.
- Browser lands on `/welcome?session_id=...`.
- Password path can create a password and route to `/onboarding`.
- Magic-link path sends a link and shows the sent state.

## Self-Review

- Spec coverage: owner result page, mockup section order, live Stripe prices, inline checkout, cosmetic countdown, and separate `/welcome` activation are covered.
- Scope guard: public `/result/[leadId]` and real per-user expiry are explicitly out of scope.
- Type consistency: pricing interval uses `BillingInterval`; result narrative exposes `heroHeadline`; checkout calls the existing `{ interval, leadId }` API contract.
- Risk: static render tests may need a static/client split if Stripe imports are browser-bound. The plan includes the exact fallback split.
