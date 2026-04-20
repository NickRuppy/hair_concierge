# Stripe Subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a hard-paywall subscription behind the quiz: 3 billing intervals (€14.99/mo · €34.99/quarter · €99.99/year), Stripe Embedded Checkout, magic-link post-payment sign-in, Customer Portal for cancel/manage, Google OAuth removed.

**Architecture:** Next.js 16 App Router server routes; Stripe Checkout Sessions API in `ui_mode: 'embedded'` + `mode: 'subscription'`; webhook-driven fulfillment creates Supabase users via admin API and updates `profiles` rows; middleware gates `/chat` and `/onboarding` on `subscription_status === 'active'`; Customer Portal is Stripe-hosted.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind 4, Supabase Auth (SSR) + Postgres, Stripe Node SDK (`stripe`) + `@stripe/stripe-js` + `@stripe/react-stripe-js`, Playwright (tests).

**Spec reference:** `docs/superpowers/specs/2026-04-19-stripe-subscription-design.md`.

---

## File Structure

### Created

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260419_add_stripe_subscription_fields.sql` | Add 5 Stripe columns + index to `profiles` |
| `src/lib/stripe/client.ts` | Server-only Stripe SDK init + shared constants (price-id map) |
| `src/lib/stripe/gating.ts` | Pure `isSubscriptionActive(profile)` predicate |
| `src/lib/stripe/webhook-handlers.ts` | Pure per-event handlers; takes injected Supabase + Stripe clients |
| `src/lib/stripe/intervals.ts` | Pure: `intervalFromPrice(price)` → `'month'` / `'quarter'` / `'year'` |
| `src/app/api/stripe/webhook/route.ts` | Verify signature, dispatch to handlers |
| `src/app/api/stripe/create-checkout-session/route.ts` | POST: build Stripe Session, return `client_secret` |
| `src/app/api/stripe/session/route.ts` | GET: read session status (for `/welcome`) |
| `src/app/api/stripe/portal-session/route.ts` | POST: create Customer Portal session URL |
| `src/app/pricing/page.tsx` | Server component; renders 3 plan cards |
| `src/app/pricing/pricing-cards.tsx` | Client component; price-click → POST create-checkout-session → navigate |
| `src/app/pricing/checkout/page.tsx` | Server component; pulls `leadId` + `priceId`, creates Session |
| `src/app/pricing/checkout/embedded-checkout.tsx` | Client component; mounts `<EmbeddedCheckoutProvider>` |
| `src/app/welcome/page.tsx` | Server component; retrieves session, triggers magic link, renders shell |
| `src/app/welcome/welcome-client.tsx` | Client; polls `/api/stripe/session` for activation if needed |
| `src/components/profile/manage-subscription-button.tsx` | Client button → POST to portal-session → redirect |
| `tests/stripe-gating.spec.ts` | Pure-logic tests for `isSubscriptionActive` |
| `tests/stripe-intervals.spec.ts` | Pure-logic tests for `intervalFromPrice` |
| `tests/stripe-webhook-handlers.spec.ts` | Pure-logic tests for each handler with stub Supabase/Stripe clients |
| `tests/stripe-subscription-e2e.spec.ts` | Full golden-path Playwright test |

### Modified

| Path | Change |
|---|---|
| `src/app/result/[leadId]/result-client.tsx` | Add "Jetzt freischalten" CTA linking to `/pricing?lead=<leadId>` |
| `src/lib/supabase/middleware.ts` | Add paywall gate (sub-required route list, redirect to `/pricing?reason=resubscribe`) |
| `src/app/profile/page.tsx` | Show subscription status, `current_period_end`, Manage button |
| `src/components/auth/auth-form.tsx` | Remove `handleGoogleLogin`, `googleButton`, `"google"` loading state |
| `.env.local` (gitignored) | Add 6 Stripe env vars |
| `package.json` | Add `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js` |

---

## Environment Setup (one-time)

Populate `.env.local` with values already captured in conversation:

```bash
# --- Stripe (sandbox) ---
STRIPE_SECRET_KEY=sk_test_REDACTED_SEE_ENV_LOCAL
STRIPE_WEBHOOK_SECRET=whsec_REDACTED_SEE_ENV_LOCAL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51TNwO1K0IN8ErFegbxAHSq7YBzjzeoZp5NWv3kZZy3C4zOe1gZaTj7BeVDg63pRHwjSdzAZ8SB3XD3oUE84bS8yC00X7g3wpbt
STRIPE_PRICE_ID_MONTHLY=price_1TNwPCK0IN8ErFegM1V54x0Q
STRIPE_PRICE_ID_QUARTERLY=price_1TNwPyK0IN8ErFeggwGPBmgc
STRIPE_PRICE_ID_ANNUAL=price_1TNwPyK0IN8ErFegLWCrHfPo
```

For local webhook forwarding during dev (separate terminal):
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
That command prints its own dev `whsec_...` — **do not** overwrite the Dashboard one in `.env.local`. Local dev uses the CLI's secret while it's running; production uses the Dashboard's secret in Vercel env.

---

## Task 0: Worktree + dependencies

**Files:**
- Create: `.worktrees/stripe-subscription/` (new git worktree)
- Modify: `package.json` (root checkout stays clean; worktree gets the change)

- [ ] **Step 1: Create worktree from `origin/main`**

Run:
```bash
git fetch origin
npm run worktree:new -- stripe-subscription
cd .worktrees/stripe-subscription
```
Expected: new directory created, new branch `codex/stripe-subscription`, clean working tree.

- [ ] **Step 2: Copy the spec + plan into the worktree**

Because the spec and plan were written on `main` and are not yet committed, copy them across so the worktree has full context:
```bash
cp ../../docs/superpowers/specs/2026-04-19-stripe-subscription-design.md docs/superpowers/specs/
cp ../../plans/2026-04-19-stripe-subscription.md plans/
```
Then `git add` and commit:
```bash
git add docs/superpowers/specs/2026-04-19-stripe-subscription-design.md plans/2026-04-19-stripe-subscription.md
git commit -m "docs: add Stripe subscription spec + plan"
```

- [ ] **Step 3: Install Stripe dependencies**

```bash
npm install stripe@^18 @stripe/stripe-js@^7 @stripe/react-stripe-js@^5
```
Expected: `package-lock.json` updated, no peer-dep errors.

- [ ] **Step 4: Create `.env.local` with sandbox values**

Paste the block from the **Environment Setup** section above into `.worktrees/stripe-subscription/.env.local`. Verify it is gitignored:
```bash
git check-ignore .env.local
```
Expected: outputs `.env.local`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add stripe sdk dependencies"
```

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260419_add_stripe_subscription_fields.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Stripe subscription fields on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_status     text,
  ADD COLUMN IF NOT EXISTS subscription_interval   text,
  ADD COLUMN IF NOT EXISTS current_period_end      timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles (stripe_customer_id);

COMMENT ON COLUMN profiles.subscription_status IS
  'active | past_due | canceled | incomplete | NULL';
COMMENT ON COLUMN profiles.subscription_interval IS
  'month | quarter | year';
```

- [ ] **Step 2: Apply locally via Supabase CLI**

```bash
npx supabase db push --password "$SUPABASE_DB_PASSWORD"
```
Expected: migration applied, no error. (Use the linked Supabase project `pqdkhefxsxkyeqelqegq` from CLAUDE.md; ask user for password if needed.)

- [ ] **Step 3: Verify the columns exist**

```bash
npx supabase db execute --file - <<'SQL'
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles'
  AND column_name IN ('stripe_customer_id','stripe_subscription_id','subscription_status','subscription_interval','current_period_end');
SQL
```
Expected: all 5 rows returned.

- [ ] **Step 4: Regenerate TypeScript types**

```bash
npx supabase gen types typescript --project-id pqdkhefxsxkyeqelqegq > src/lib/supabase/database.types.ts
```
Expected: `profiles.Row` now includes the 5 new fields.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260419_add_stripe_subscription_fields.sql src/lib/supabase/database.types.ts
git commit -m "feat(db): add stripe subscription fields to profiles"
```

---

## Task 2: Stripe client module

**Files:**
- Create: `src/lib/stripe/client.ts`
- Create: `src/lib/stripe/intervals.ts`
- Test: `tests/stripe-intervals.spec.ts`

- [ ] **Step 1: Write the failing test**

`tests/stripe-intervals.spec.ts`:
```ts
import { expect, test } from "@playwright/test"
import { intervalFromPrice } from "../src/lib/stripe/intervals"

test("month + interval_count=1 → 'month'", () => {
  expect(intervalFromPrice({ interval: "month", interval_count: 1 })).toBe("month")
})

test("month + interval_count=3 → 'quarter'", () => {
  expect(intervalFromPrice({ interval: "month", interval_count: 3 })).toBe("quarter")
})

test("year + interval_count=1 → 'year'", () => {
  expect(intervalFromPrice({ interval: "year", interval_count: 1 })).toBe("year")
})

test("unknown combo throws", () => {
  expect(() => intervalFromPrice({ interval: "week", interval_count: 1 })).toThrow()
})
```

- [ ] **Step 2: Run test — expect 4 failures (module missing)**

```bash
npx playwright test tests/stripe-intervals.spec.ts
```
Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Implement `intervals.ts`**

`src/lib/stripe/intervals.ts`:
```ts
export type BillingInterval = "month" | "quarter" | "year"

export interface PriceRecurrence {
  interval: string
  interval_count: number
}

export function intervalFromPrice(p: PriceRecurrence): BillingInterval {
  if (p.interval === "month" && p.interval_count === 1) return "month"
  if (p.interval === "month" && p.interval_count === 3) return "quarter"
  if (p.interval === "year" && p.interval_count === 1) return "year"
  throw new Error(`Unsupported price recurrence: ${p.interval} x${p.interval_count}`)
}
```

- [ ] **Step 4: Run test — expect 4 passes**

```bash
npx playwright test tests/stripe-intervals.spec.ts
```
Expected: 4 passed.

- [ ] **Step 5: Implement `client.ts`**

`src/lib/stripe/client.ts`:
```ts
import Stripe from "stripe"
import type { BillingInterval } from "./intervals"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  _stripe = new Stripe(key, { apiVersion: "2025-09-30.clover" })
  return _stripe
}

export const PRICE_IDS: Record<BillingInterval, string> = {
  month: process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
  quarter: process.env.STRIPE_PRICE_ID_QUARTERLY ?? "",
  year: process.env.STRIPE_PRICE_ID_ANNUAL ?? "",
}

export function priceIdToInterval(priceId: string): BillingInterval | null {
  const entry = Object.entries(PRICE_IDS).find(([, v]) => v === priceId)
  return entry ? (entry[0] as BillingInterval) : null
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe/client.ts src/lib/stripe/intervals.ts tests/stripe-intervals.spec.ts
git commit -m "feat(stripe): client init + interval helpers"
```

---

## Task 3: Gating predicate

**Files:**
- Create: `src/lib/stripe/gating.ts`
- Test: `tests/stripe-gating.spec.ts`

- [ ] **Step 1: Write the failing test**

`tests/stripe-gating.spec.ts`:
```ts
import { expect, test } from "@playwright/test"
import { isSubscriptionActive } from "../src/lib/stripe/gating"

test("active status → true", () => {
  expect(isSubscriptionActive({ subscription_status: "active" })).toBe(true)
})

test("past_due status → true (grace period)", () => {
  expect(isSubscriptionActive({ subscription_status: "past_due" })).toBe(true)
})

test("canceled → false", () => {
  expect(isSubscriptionActive({ subscription_status: "canceled" })).toBe(false)
})

test("incomplete → false", () => {
  expect(isSubscriptionActive({ subscription_status: "incomplete" })).toBe(false)
})

test("null → false", () => {
  expect(isSubscriptionActive({ subscription_status: null })).toBe(false)
})

test("missing profile → false", () => {
  expect(isSubscriptionActive(null)).toBe(false)
})
```

- [ ] **Step 2: Run test**

```bash
npx playwright test tests/stripe-gating.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/stripe/gating.ts`:
```ts
export interface SubscriptionProfile {
  subscription_status: string | null
}

export function isSubscriptionActive(
  profile: SubscriptionProfile | null | undefined,
): boolean {
  if (!profile) return false
  return profile.subscription_status === "active" ||
         profile.subscription_status === "past_due"
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx playwright test tests/stripe-gating.spec.ts
```
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe/gating.ts tests/stripe-gating.spec.ts
git commit -m "feat(stripe): isSubscriptionActive gating predicate"
```

---

## Task 4: Webhook handler — checkout.session.completed (new user)

**Files:**
- Create: `src/lib/stripe/webhook-handlers.ts`
- Test: `tests/stripe-webhook-handlers.spec.ts`

Handlers take injected `deps` so tests can stub them.

- [ ] **Step 1: Write the failing test (new user path)**

`tests/stripe-webhook-handlers.spec.ts`:
```ts
import { expect, test } from "@playwright/test"
import { handleCheckoutSessionCompleted } from "../src/lib/stripe/webhook-handlers"

function stubDeps() {
  const calls: any[] = []
  const users: Record<string, { id: string; email: string }> = {}
  const profiles: Record<string, any> = {}

  return {
    calls,
    users,
    profiles,
    deps: {
      supabase: {
        auth: {
          admin: {
            async createUser({ email }: { email: string }) {
              calls.push(["createUser", email])
              const id = `user-${Object.keys(users).length + 1}`
              users[email] = { id, email }
              profiles[id] = { id, email, subscription_status: null }
              return { data: { user: users[email] }, error: null }
            },
          },
        },
        from(table: string) {
          return {
            select() { return this },
            eq(col: string, val: string) {
              calls.push([`select-${table}-${col}`, val])
              const row = table === "profiles"
                ? Object.values(profiles).find((p: any) => p[col] === val)
                : Object.values(users).find((u: any) => u[col] === val)
              return { maybeSingle: async () => ({ data: row ?? null, error: null }) }
            },
            update(patch: any) {
              return {
                eq(col: string, val: string) {
                  calls.push([`update-${table}`, val, patch])
                  const row = Object.values(profiles).find((p: any) => p[col] === val)
                  if (row) Object.assign(row, patch)
                  return Promise.resolve({ error: null })
                },
              }
            },
          }
        },
      } as any,
      stripe: {
        subscriptions: {
          async retrieve(_id: string) {
            return {
              id: "sub_1",
              current_period_end: 1_800_000_000,
              items: { data: [{ price: { interval: "month", interval_count: 1 } }] },
            } as any
          },
        },
      } as any,
      premiumTierId: "tier-premium",
    },
  }
}

test("checkout.session.completed creates a new Supabase user and activates the sub", async () => {
  const { deps, calls, profiles } = stubDeps()
  const session = {
    id: "cs_1",
    customer: "cus_1",
    customer_details: { email: "new@example.com" },
    subscription: "sub_1",
  } as any

  await handleCheckoutSessionCompleted(session, deps)

  expect(calls.some(([op]) => op === "createUser")).toBe(true)
  const p = Object.values(profiles)[0] as any
  expect(p.email).toBe("new@example.com")
  expect(p.subscription_status).toBe("active")
  expect(p.subscription_interval).toBe("month")
  expect(p.stripe_customer_id).toBe("cus_1")
  expect(p.stripe_subscription_id).toBe("sub_1")
  expect(p.subscription_tier_id).toBe("tier-premium")
  expect(p.current_period_end).toBeTruthy()
})
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

```bash
npx playwright test tests/stripe-webhook-handlers.spec.ts
```
Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Implement `webhook-handlers.ts` with just `handleCheckoutSessionCompleted`**

`src/lib/stripe/webhook-handlers.ts`:
```ts
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { intervalFromPrice } from "./intervals"

export interface HandlerDeps {
  supabase: SupabaseClient
  stripe: Stripe
  premiumTierId: string
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  deps: HandlerDeps,
): Promise<void> {
  const email = session.customer_details?.email
  if (!email) throw new Error("session has no customer email")
  if (typeof session.customer !== "string") throw new Error("session.customer missing")
  if (typeof session.subscription !== "string") throw new Error("session.subscription missing")

  // 1. Ensure a Supabase user exists for this email
  const { data: existing } = await deps.supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle()

  let userId: string
  if (existing) {
    userId = existing.id
  } else {
    const { data, error } = await deps.supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (error || !data.user) {
      throw new Error(`createUser failed: ${error?.message ?? "unknown"}`)
    }
    userId = data.user.id
  }

  // 2. Retrieve full subscription to get interval + period end
  const sub = await deps.stripe.subscriptions.retrieve(session.subscription, {
    expand: ["items.data.price"],
  })
  const price = sub.items.data[0].price
  const interval = intervalFromPrice({
    interval: price.recurring?.interval ?? price.interval ?? "",
    interval_count: price.recurring?.interval_count ?? price.interval_count ?? 1,
  })

  // 3. Update profile
  await deps.supabase
    .from("profiles")
    .update({
      stripe_customer_id: session.customer,
      stripe_subscription_id: sub.id,
      subscription_status: "active",
      subscription_interval: interval,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      subscription_tier_id: deps.premiumTierId,
    })
    .eq("id", userId)
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx playwright test tests/stripe-webhook-handlers.spec.ts
```
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe/webhook-handlers.ts tests/stripe-webhook-handlers.spec.ts
git commit -m "feat(stripe): checkout.session.completed handler (new user path)"
```

---

## Task 5: Webhook handler — existing user + subscription.updated + deleted

**Files:**
- Modify: `src/lib/stripe/webhook-handlers.ts`
- Modify: `tests/stripe-webhook-handlers.spec.ts`

- [ ] **Step 1: Add failing test — existing user path**

Append to `tests/stripe-webhook-handlers.spec.ts`:
```ts
test("checkout.session.completed on existing email reuses the user", async () => {
  const { deps, calls, profiles, users } = stubDeps()
  users["ret@example.com"] = { id: "user-existing", email: "ret@example.com" }
  profiles["user-existing"] = { id: "user-existing", email: "ret@example.com", subscription_status: null }

  const session = {
    id: "cs_2",
    customer: "cus_2",
    customer_details: { email: "ret@example.com" },
    subscription: "sub_2",
  } as any
  await handleCheckoutSessionCompleted(session, deps)

  expect(calls.some(([op]) => op === "createUser")).toBe(false)
  expect((profiles["user-existing"] as any).subscription_status).toBe("active")
})
```

- [ ] **Step 2: Run — expect pass (existing code already handles this path)**

```bash
npx playwright test tests/stripe-webhook-handlers.spec.ts -g "existing email"
```
Expected: 1 passed.

- [ ] **Step 3: Add failing test — subscription.updated cancel-at-period-end**

Append:
```ts
import { handleSubscriptionUpdated } from "../src/lib/stripe/webhook-handlers"

test("subscription.updated keeps status=active when cancel_at_period_end flips", async () => {
  const { deps, profiles } = stubDeps()
  profiles["u"] = {
    id: "u",
    email: "x@y",
    stripe_customer_id: "cus_X",
    subscription_status: "active",
    subscription_interval: "year",
  }
  const sub = {
    id: "sub_X",
    customer: "cus_X",
    status: "active",
    current_period_end: 1_900_000_000,
    cancel_at_period_end: true,
    items: { data: [{ price: { interval: "year", interval_count: 1 } }] },
  } as any
  await handleSubscriptionUpdated(sub, deps)
  expect((profiles["u"] as any).subscription_status).toBe("active")
  expect((profiles["u"] as any).current_period_end).toBeTruthy()
})
```

- [ ] **Step 4: Implement `handleSubscriptionUpdated`**

Append to `src/lib/stripe/webhook-handlers.ts`:
```ts
export async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  deps: HandlerDeps,
): Promise<void> {
  if (typeof sub.customer !== "string") throw new Error("sub.customer not a string")
  const price = sub.items.data[0].price
  const interval = intervalFromPrice({
    interval: price.recurring?.interval ?? price.interval ?? "",
    interval_count: price.recurring?.interval_count ?? price.interval_count ?? 1,
  })
  await deps.supabase
    .from("profiles")
    .update({
      subscription_status: sub.status,
      subscription_interval: interval,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    })
    .eq("stripe_customer_id", sub.customer)
}
```

- [ ] **Step 5: Run — expect pass**

```bash
npx playwright test tests/stripe-webhook-handlers.spec.ts -g "cancel_at_period_end"
```

- [ ] **Step 6: Add failing test — subscription.deleted**

```ts
import { handleSubscriptionDeleted } from "../src/lib/stripe/webhook-handlers"

test("subscription.deleted flips profile to canceled + Free tier", async () => {
  const { deps, profiles } = stubDeps()
  profiles["u"] = {
    id: "u",
    stripe_customer_id: "cus_D",
    subscription_status: "active",
    subscription_tier_id: "tier-premium",
  }
  const sub = { id: "sub_D", customer: "cus_D", status: "canceled" } as any
  await handleSubscriptionDeleted(sub, { ...deps, freeTierId: "tier-free" } as any)
  expect((profiles["u"] as any).subscription_status).toBe("canceled")
  expect((profiles["u"] as any).subscription_tier_id).toBe("tier-free")
})
```

- [ ] **Step 7: Implement `handleSubscriptionDeleted`**

```ts
export interface DeleteDeps extends HandlerDeps { freeTierId: string }

export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  deps: DeleteDeps,
): Promise<void> {
  if (typeof sub.customer !== "string") throw new Error("sub.customer not a string")
  await deps.supabase
    .from("profiles")
    .update({
      subscription_status: "canceled",
      subscription_tier_id: deps.freeTierId,
    })
    .eq("stripe_customer_id", sub.customer)
}
```

- [ ] **Step 8: Implement `handleInvoicePaymentFailed` (log-only)**

```ts
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  console.warn("[stripe] invoice.payment_failed", {
    invoiceId: invoice.id,
    customer: invoice.customer,
    attempt: invoice.attempt_count,
  })
}
```

- [ ] **Step 9: Run all handler tests — expect all pass**

```bash
npx playwright test tests/stripe-webhook-handlers.spec.ts
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/stripe/webhook-handlers.ts tests/stripe-webhook-handlers.spec.ts
git commit -m "feat(stripe): subscription updated/deleted + invoice failure handlers"
```

---

## Task 6: Webhook route (dispatch + signature verification)

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

Signature verification is tested via live `stripe listen` in manual QA (Task 14). Route is thin.

- [ ] **Step 1: Implement route**

`src/app/api/stripe/webhook/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server"
import { getStripe } from "@/lib/stripe/client"
import { createClient } from "@supabase/supabase-js"
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
} from "@/lib/stripe/webhook-handlers"

export const runtime = "nodejs"  // raw body needed; not edge

async function getTierIds(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("subscription_tiers")
    .select("id, slug")
  const free = data?.find((r) => r.slug === "free")?.id
  const premium = data?.find((r) => r.slug === "premium")?.id
  if (!free || !premium) throw new Error("subscription_tiers seed rows missing")
  return { freeTierId: free, premiumTierId: premium }
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature")
  const body = await req.text()
  if (!sig) return new NextResponse("missing signature", { status: 400 })

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new NextResponse("server misconfigured", { status: 500 })

  const stripe = getStripe()
  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err: any) {
    return new NextResponse(`signature verification failed: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { freeTierId, premiumTierId } = await getTierIds(supabase)
  const deps = { supabase, stripe, premiumTierId, freeTierId }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as any, deps)
        break
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as any, deps)
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as any, deps)
        break
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as any)
        break
      default:
        console.warn("[stripe] unhandled event type:", event.type)
    }
  } catch (err: any) {
    console.error("[stripe] handler error:", err)
    return new NextResponse(`handler error: ${err.message}`, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors in the new files.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat(stripe): webhook route with signature verification + dispatch"
```

---

## Task 7: Create-checkout-session API

**Files:**
- Create: `src/app/api/stripe/create-checkout-session/route.ts`

- [ ] **Step 1: Implement**

`src/app/api/stripe/create-checkout-session/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { getStripe, PRICE_IDS } from "@/lib/stripe/client"
import type { BillingInterval } from "@/lib/stripe/intervals"

export const runtime = "nodejs"

const BodySchema = z.object({
  interval: z.enum(["month", "quarter", "year"]),
  leadId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 })
  const { interval, leadId } = parsed.data

  const priceId = PRICE_IDS[interval as BillingInterval]
  if (!priceId) return NextResponse.json({ error: "price not configured" }, { status: 500 })

  // Look up lead email to pre-fill Checkout
  let customerEmail: string | undefined
  if (leadId) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    const { data } = await supabase.from("leads").select("email").eq("id", leadId).maybeSingle()
    customerEmail = data?.email ?? undefined
  }

  const origin = req.nextUrl.origin
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ui_mode: "embedded",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: customerEmail,
    return_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    automatic_tax: { enabled: true },
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: {
        message:
          "Ich stimme zu, dass der Zugriff auf das Abo sofort beginnt und ich damit mein 14-tägiges Widerrufsrecht verliere (§ 356 Abs. 4 BGB).",
      },
    },
    metadata: leadId ? { lead_id: leadId } : undefined,
  })

  return NextResponse.json({ client_secret: session.client_secret })
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/create-checkout-session/route.ts
git commit -m "feat(stripe): create-checkout-session API route"
```

---

## Task 8: Session status API

**Files:**
- Create: `src/app/api/stripe/session/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse, type NextRequest } from "next/server"
import { getStripe } from "@/lib/stripe/client"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(id)
  return NextResponse.json({
    status: session.status,
    email: session.customer_details?.email ?? null,
    customer: typeof session.customer === "string" ? session.customer : null,
  })
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/app/api/stripe/session/route.ts
git commit -m "feat(stripe): session status API route"
```

---

## Task 9: Pricing page (3 plan cards)

**Files:**
- Create: `src/app/pricing/page.tsx`
- Create: `src/app/pricing/pricing-cards.tsx`

- [ ] **Step 1: Server page**

`src/app/pricing/page.tsx`:
```tsx
import { PricingCards } from "./pricing-cards"

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; reason?: string }>
}) {
  const sp = await searchParams
  const leadId = sp.lead ?? null
  const showResubBanner = sp.reason === "resubscribe"

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      {showResubBanner && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Dein Abo ist abgelaufen — jetzt wieder freischalten.
        </div>
      )}
      <header className="mb-10 text-center">
        <h1 className="font-header text-4xl">Dein personalisierter Haar-Concierge</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Wähle deinen Plan — jederzeit kündbar.
        </p>
      </header>
      <PricingCards leadId={leadId} />
    </main>
  )
}
```

- [ ] **Step 2: Client cards**

`src/app/pricing/pricing-cards.tsx`:
```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Plan {
  interval: "month" | "quarter" | "year"
  name: string
  price: string
  perMonth: string
  badge?: string
  savings?: string
}

const PLANS: Plan[] = [
  { interval: "month", name: "Monatlich", price: "€14,99", perMonth: "/ Monat" },
  { interval: "quarter", name: "Quartal", price: "€34,99", perMonth: "~€11,66 / Monat", savings: "22% sparen" },
  { interval: "year", name: "Jährlich", price: "€99,99", perMonth: "~€8,33 / Monat", badge: "Beliebt", savings: "44% sparen" },
]

export function PricingCards({ leadId }: { leadId: string | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(interval: Plan["interval"]) {
    setLoading(interval)
    setError(null)
    const params = new URLSearchParams({ interval })
    if (leadId) params.set("lead", leadId)
    router.push(`/pricing/checkout?${params.toString()}`)
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.interval}
          className={`relative rounded-xl border bg-card p-6 shadow-sm ${
            plan.badge ? "border-primary ring-2 ring-primary/20" : ""
          }`}
        >
          {plan.badge && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              {plan.badge}
            </span>
          )}
          <h2 className="font-header text-2xl">{plan.name}</h2>
          <div className="mt-4 space-y-1">
            <p className="text-3xl font-bold">{plan.price}</p>
            <p className="text-sm text-muted-foreground">{plan.perMonth}</p>
            {plan.savings && (
              <p className="text-sm font-medium text-primary">{plan.savings}</p>
            )}
          </div>
          <button
            onClick={() => choose(plan.interval)}
            disabled={loading !== null}
            className="mt-6 w-full rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading === plan.interval ? "Wird geladen…" : "Jetzt starten"}
          </button>
        </div>
      ))}
      {error && (
        <p className="col-span-full text-center text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck, lint, commit**

```bash
npm run typecheck && npm run lint -- --fix
git add src/app/pricing/
git commit -m "feat(pricing): three-card pricing page"
```

---

## Task 10: Embedded checkout page

**Files:**
- Create: `src/app/pricing/checkout/page.tsx`
- Create: `src/app/pricing/checkout/embedded-checkout.tsx`

- [ ] **Step 1: Server page**

`src/app/pricing/checkout/page.tsx`:
```tsx
import { EmbeddedCheckoutMount } from "./embedded-checkout"
import { redirect } from "next/navigation"

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string; lead?: string }>
}) {
  const sp = await searchParams
  const interval = sp.interval
  if (interval !== "month" && interval !== "quarter" && interval !== "year") {
    redirect("/pricing")
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-header mb-6 text-2xl">Zahlungsdetails</h1>
      <EmbeddedCheckoutMount interval={interval} leadId={sp.lead ?? null} />
    </main>
  )
}
```

- [ ] **Step 2: Client mount**

`src/app/pricing/checkout/embedded-checkout.tsx`:
```tsx
"use client"

import { useCallback } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export function EmbeddedCheckoutMount({
  interval,
  leadId,
}: {
  interval: "month" | "quarter" | "year"
  leadId: string | null
}) {
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interval, leadId }),
    })
    if (!res.ok) throw new Error("failed to create checkout session")
    const data = await res.json()
    return data.client_secret as string
  }, [interval, leadId])

  return (
    <div id="checkout" className="min-h-[600px]">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck, commit**

```bash
npm run typecheck
git add src/app/pricing/checkout/
git commit -m "feat(pricing): embedded stripe checkout page"
```

---

## Task 11: Welcome page + magic link

**Files:**
- Create: `src/app/welcome/page.tsx`
- Create: `src/app/welcome/welcome-client.tsx`

- [ ] **Step 1: Server page**

`src/app/welcome/page.tsx`:
```tsx
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe/client"
import { WelcomeClient } from "./welcome-client"

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams
  if (!session_id) redirect("/")

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(session_id)
  if (session.status !== "complete") redirect("/pricing")

  const email = session.customer_details?.email
  if (!email) redirect("/")

  // Send magic link (idempotent; Supabase rate-limits on its own)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding` },
  })
  if (error) console.warn("[welcome] magic link failed:", error.message)

  return <WelcomeClient email={email} />
}
```

- [ ] **Step 2: Client component**

`src/app/welcome/welcome-client.tsx`:
```tsx
"use client"

import { Mail } from "lucide-react"

export function WelcomeClient({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-header text-3xl">Zahlung erfolgreich</h1>
        <p className="text-base text-muted-foreground">
          Wir haben dir einen Login-Link an{" "}
          <span className="font-medium text-foreground">{email}</span> gesendet.
          Bitte öffne deine E-Mails, um fortzufahren.
        </p>
        <p className="text-xs text-muted-foreground">
          Keine E-Mail erhalten? Prüfe deinen Spam-Ordner oder warte 1–2 Minuten.
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Add `NEXT_PUBLIC_SITE_URL` to `.env.local`**

```bash
echo 'NEXT_PUBLIC_SITE_URL=http://localhost:3000' >> .env.local
```

- [ ] **Step 4: Typecheck + commit**

```bash
npm run typecheck
git add src/app/welcome/ .env.local
git diff --cached -- .env.local  # sanity: should be empty (gitignored)
git commit -m "feat(welcome): post-payment magic link page"
```

---

## Task 12: Middleware paywall gate

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Modify middleware**

Insert AFTER the `hc_returning` cookie block (around line 79, i.e. after `supabaseResponse.cookies.set("hc_returning"...)` closes) and BEFORE the existing `if ((pathname === "/auth" || pathname === "/quiz")...)` block:

```ts
  // --- Subscription paywall ---------------------------------------------
  const SUB_REQUIRED_PREFIXES = ["/onboarding", "/chat", "/api/chat"]
  const PUB_SUB_EXEMPT_PREFIXES = [
    "/api/stripe/webhook",
    "/api/stripe/session",
    "/welcome",
    "/pricing",
  ]
  const needsSub = SUB_REQUIRED_PREFIXES.some((p) => pathname.startsWith(p))
  const subExempt = PUB_SUB_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))

  if (needsSub && !subExempt) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single()
    const active =
      profile?.subscription_status === "active" ||
      profile?.subscription_status === "past_due"
    if (!active) {
      const url = request.nextUrl.clone()
      url.pathname = "/pricing"
      url.searchParams.set("reason", "resubscribe")
      return NextResponse.redirect(url)
    }
  }
  // --- End subscription paywall ------------------------------------------
```

Also add `/pricing`, `/welcome`, `/api/stripe` to the `publicRoutes` array:

Replace:
```ts
  const publicRoutes = [
    "/auth",
    "/api/auth/callback",
    "/auth/confirm",
    "/quiz",
    "/api/quiz",
    "/result",
    "/api/og",
    "/datenschutz",
    "/impressum",
  ]
```

With:
```ts
  const publicRoutes = [
    "/auth",
    "/api/auth/callback",
    "/auth/confirm",
    "/quiz",
    "/api/quiz",
    "/result",
    "/api/og",
    "/datenschutz",
    "/impressum",
    "/pricing",
    "/welcome",
    "/api/stripe",
  ]
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat(middleware): gate onboarding/chat on active subscription"
```

---

## Task 13: Result page CTA

**Files:**
- Modify: `src/app/result/[leadId]/result-client.tsx`

- [ ] **Step 1: Read file to find current CTA**

```bash
grep -n "button\|Link\|href\|Anmeld" src/app/result/\[leadId\]/result-client.tsx | head -30
```
Use this to find where the current primary CTA is (likely linking to `/auth`).

- [ ] **Step 2: Replace primary CTA**

Change the primary "Weiter" / "Anmelden" button so its `href` becomes:
```tsx
href={`/pricing?lead=${leadId}`}
```
And update the button label to `"Jetzt freischalten"`. Keep any secondary share buttons unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/app/result/
git commit -m "feat(result): CTA links to pricing page"
```

---

## Task 14: Remove Google OAuth from auth form

**Files:**
- Modify: `src/components/auth/auth-form.tsx`
- Modify (audit only): `src/app/auth/actions.ts`
- Modify (audit only): `src/app/api/auth/callback/route.ts`

- [ ] **Step 1: In `src/components/auth/auth-form.tsx` delete in this order:**

1. The `async function handleGoogleLogin()` declaration (lines ~69–87).
2. The `const googleButton = (...)` JSX block (around line 185).
3. Both `{googleButton}` references inside the tab panels.
4. Change `const [loading, setLoading] = useState<"google" | "email" | null>(null)` to `useState<"email" | null>(null)`.
5. Remove any "Oder" / divider JSX that only existed to separate Google from email.

- [ ] **Step 2: Audit `src/app/auth/actions.ts`**

```bash
grep -n "oauth\|google\|provider" src/app/auth/actions.ts || echo "no oauth refs"
```
Delete any function or branch that only ran for the OAuth flow. If nothing is OAuth-specific, skip.

- [ ] **Step 3: Audit `src/app/api/auth/callback/route.ts`**

```bash
grep -n "oauth\|google\|provider\|signInWithOAuth" src/app/api/auth/callback/route.ts || echo "no oauth refs"
```
Same process. The callback route is still used for magic-link confirmation — keep that path. Only delete OAuth-specific branches.

- [ ] **Step 4: Run typecheck + lint**

```bash
npm run typecheck && npm run lint -- --fix
```

- [ ] **Step 5: Smoke-test auth page manually**

```bash
npm run dev
# open http://localhost:3000/auth — verify no Google button, login tab works, signup tab works, Passwort vergessen works
```

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/ src/app/auth/ src/app/api/auth/
git commit -m "feat(auth): remove google oauth; email + magic-link only"
```

---

## Task 15: Customer Portal + Profile page

**Files:**
- Create: `src/app/api/stripe/portal-session/route.ts`
- Create: `src/components/profile/manage-subscription-button.tsx`
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Implement portal-session route**

`src/app/api/stripe/portal-session/route.ts`:
```ts
import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getStripe } from "@/lib/stripe/client"

export const runtime = "nodejs"

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "no subscription" }, { status: 404 })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/profile`,
  })
  return NextResponse.json({ url: session.url })
}
```

- [ ] **Step 2: Button component**

`src/components/profile/manage-subscription-button.tsx`:
```tsx
"use client"

import { useState } from "react"

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)
  async function onClick() {
    setLoading(true)
    const res = await fetch("/api/stripe/portal-session", { method: "POST" })
    if (!res.ok) {
      setLoading(false)
      alert("Konnte Portal nicht öffnen.")
      return
    }
    const { url } = await res.json()
    window.location.href = url
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="rounded-lg border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
    >
      {loading ? "Wird geöffnet…" : "Abo verwalten"}
    </button>
  )
}
```

- [ ] **Step 3: Modify `src/app/profile/page.tsx`**

Add this block alongside any existing profile content (keep the rest untouched):
```tsx
import { ManageSubscriptionButton } from "@/components/profile/manage-subscription-button"
// ...inside the page component, after fetching the profile row:

{profile.stripe_customer_id && (
  <section className="rounded-xl border bg-card p-6">
    <h2 className="font-header text-xl mb-3">Dein Abo</h2>
    <p className="text-sm text-muted-foreground mb-1">
      Status: <strong className="text-foreground">{profile.subscription_status}</strong>
    </p>
    <p className="text-sm text-muted-foreground mb-4">
      Nächste Abrechnung / Laufzeitende:{" "}
      <strong className="text-foreground">
        {profile.current_period_end
          ? new Date(profile.current_period_end).toLocaleDateString("de-DE")
          : "—"}
      </strong>
    </p>
    <ManageSubscriptionButton />
  </section>
)}
```

Make sure the page query selects `stripe_customer_id`, `subscription_status`, `current_period_end`.

- [ ] **Step 4: Typecheck + commit**

```bash
npm run typecheck
git add src/app/api/stripe/portal-session/ src/components/profile/ src/app/profile/
git commit -m "feat(profile): customer portal manage-subscription button"
```

---

## Task 16: E2E golden-path test

**Files:**
- Create: `tests/stripe-subscription-e2e.spec.ts`

- [ ] **Step 1: Write the spec**

`tests/stripe-subscription-e2e.spec.ts`:
```ts
import { expect, test } from "@playwright/test"

// Prereqs:
//   - dev server running on :3000
//   - `stripe listen --forward-to localhost:3000/api/stripe/webhook` running
//   - Supabase service role creds in .env.local
//   - Dashboard webhook can be stale — the CLI one supersedes

const TEST_EMAIL = `e2e-${Date.now()}@hair-concierge-test.local`

test("quiz → pricing → stripe test card → welcome shows magic-link", async ({ page }) => {
  test.setTimeout(120_000)

  // 1. Start at the quiz
  await page.goto("/quiz")
  // (Skip ahead to lead capture — project-specific; advance through questions quickly.)
  // For this MVP test, we open pricing directly with a fabricated lead.

  // 2. Create a lead row via API so /pricing has a leadId + email to pass to Stripe
  const leadRes = await page.request.post("/api/quiz/lead", {
    data: { email: TEST_EMAIL, name: "E2E" },
  })
  expect(leadRes.ok()).toBeTruthy()
  const lead = await leadRes.json()
  const leadId = lead.id ?? lead.leadId
  expect(leadId).toBeTruthy()

  // 3. Go to pricing and pick monthly
  await page.goto(`/pricing?lead=${leadId}`)
  await page.getByRole("button", { name: /Jetzt starten/i }).first().click()

  // 4. Embedded checkout loads — fill in the card inside the Stripe iframe
  const frame = page.frameLocator("iframe[name^='__privateStripeFrame']").first()
  await frame.getByLabel(/Kartennummer|Card number/i).fill("4242 4242 4242 4242")
  await frame.getByLabel(/MM \/ JJ|MM \/ YY|Ablauf/i).fill("12 / 34")
  await frame.getByLabel(/CVC|Prüfziffer/i).fill("123")
  await frame.getByLabel(/PLZ|ZIP/i).fill("10115").catch(() => {})
  // Accept terms-of-service waiver
  await frame.getByRole("checkbox").check()
  await page.getByRole("button", { name: /Abonnieren|Subscribe|Pay/i }).click()

  // 5. Welcome page
  await page.waitForURL(/\/welcome\?session_id=/, { timeout: 60_000 })
  await expect(page.getByText("Zahlung erfolgreich")).toBeVisible()
  await expect(page.getByText(TEST_EMAIL)).toBeVisible()
})
```

- [ ] **Step 2: Run**

```bash
# terminal 1
npm run dev
# terminal 2
stripe listen --forward-to localhost:3000/api/stripe/webhook
# terminal 3
npx playwright test tests/stripe-subscription-e2e.spec.ts --headed
```

- [ ] **Step 3: Commit (even if fragile; iterate later)**

```bash
git add tests/stripe-subscription-e2e.spec.ts
git commit -m "test(stripe): e2e golden path for subscription checkout"
```

---

## Task 17: Final verification + PR

- [ ] **Step 1: Full CI gate**

```bash
npm run ci:verify
```
Expected: typecheck + lint + build all green.

- [ ] **Step 2: Run full test suite**

```bash
npx playwright test tests/stripe-intervals.spec.ts tests/stripe-gating.spec.ts tests/stripe-webhook-handlers.spec.ts
```
Expected: all green.

- [ ] **Step 3: Codex whole-branch review** (per CLAUDE.md)

```bash
# from .worktrees/stripe-subscription
git diff main...HEAD | pbcopy
# then run the /codex:rescue skill with: "review the staged diff for integration-level issues"
```
Address real findings. Skip false positives.

- [ ] **Step 4: Push branch**

```bash
git push -u origin codex/stripe-subscription
```

- [ ] **Step 5: Open PR**

```bash
gh pr create \
  --title "Stripe subscription (€14.99/€34.99/€99.99, hard paywall)" \
  --body "$(cat <<'EOF'
## Summary
- Hard paywall after quiz → /pricing → Embedded Stripe Checkout → magic-link post-payment
- 3 Prices (monthly / quarterly / annual) on one Premium product
- Removes Google OAuth (magic-link + email+password only)
- Customer Portal integration on /profile

See `docs/superpowers/specs/2026-04-19-stripe-subscription-design.md`
and `plans/2026-04-19-stripe-subscription.md`.

## Test plan
- [ ] `npm run ci:verify` green
- [ ] Handler unit tests green
- [ ] E2E golden-path test green (or manually verified)
- [ ] Stripe Dashboard webhook endpoint URL updated to preview URL
- [ ] Test card 4242 ends up on /welcome with magic-link copy
- [ ] Magic link arrives, click → /onboarding loads, chat works
- [ ] Cancel via Customer Portal → /chat redirects to /pricing after period end
EOF
)"
```

- [ ] **Step 6: Update Stripe Dashboard webhook URL**

Once Vercel gives you a preview URL, go to Stripe Dashboard → Webhooks → `hair web` destination → edit URL from `https://example.com/webhook` to the Vercel preview URL. Keep it pointed at the preview until production deploy.

- [ ] **Step 7: Confirm SSO / magic-link delivery works on preview**

Open the preview URL, run through the golden path with test card, click the magic link that arrives, confirm you land on `/onboarding`.

---

## Self-Review (Plan vs. Spec)

**Spec section coverage:**

| Spec § | Plan task |
|---|---|
| §2 User flow | Tasks 9, 10, 11 (pricing → checkout → welcome) + 12 (middleware redirects) |
| §3 Stripe setup | Environment Setup block + Dashboard work already done by user |
| §4 DB schema | Task 1 |
| §5 Webhook handler | Tasks 4, 5, 6 |
| §6 Frontend components | Tasks 9, 10, 11, 13, 15 (all new files + result CTA + profile) |
| §7 Route gating | Task 12 |
| §8 Customer Portal & cancellation | Task 15 + webhook handlers Task 5 |
| §9 EU/DACH compliance | § 355 waiver in Task 7 (create-checkout-session); Stripe Tax enabled; magic-link-only handles click-to-cancel indirectly |
| §10 Testing strategy | Tasks 2, 3, 4, 5 (unit); Task 16 (e2e) |
| §11 Known risks | Documented; paid-users-without-password is known + fallback is the existing reset-password flow already in the codebase |
| §12 Out-of-scope | Not implemented by design |
| Google OAuth removal | Task 14 |

**Placeholder scan:** none found — every step shows code or exact commands.

**Type consistency:** `BillingInterval`, `HandlerDeps`, `DeleteDeps` defined once; stub `Deps` in tests matches runtime shape; Stripe event types use inline `as any` casts at handler entry (acceptable for webhook shape variability).

**Known soft spots:**
- Task 1 Step 2 assumes `SUPABASE_DB_PASSWORD` is available. If not, swap `npx supabase db push` for applying the migration via the Supabase MCP `apply_migration` tool.
- Task 16 (E2E) selectors for the Stripe iframe can be fragile — marked as commit-even-if-fragile, manual QA is the backstop.
- Task 12 inserts middleware code at a specific line range; if unrelated edits have moved the file, re-locate by anchor text rather than line numbers.
