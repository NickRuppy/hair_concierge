# Customer.io Server Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send campaign-critical quiz lead traits and Stripe lifecycle events to Customer.io from the server without blocking users or payment fulfillment.

**Architecture:** Keep browser Customer.io for behavior and anonymous activity. Add a small server-side Pipelines helper and call it in background work after Supabase lead persistence and Stripe webhook fulfillment. Supabase and Stripe remain the source of truth; Customer.io is a best-effort downstream lifecycle destination.

**Tech Stack:** Next.js App Router, Vercel `after`, Supabase service-role server routes, Stripe webhooks, Customer.io Pipelines HTTP API, Node test runner with `tsx`.

---

Spec: [2026-05-28-customerio-server-sync-design.md](../docs/superpowers/specs/2026-05-28-customerio-server-sync-design.md)

Data contract: [customerio-data-contract.md](../docs/customerio-data-contract.md)

## User Situation

Customer.io browser tracking, analytics facade routing, and Customer.io transactional auth emails are live. Campaigns still lack reliable rich quiz traits and durable Stripe lifecycle events because browser events are not enough for lifecycle truth.

## Promised End State

After this work, quiz lead capture writes Supabase first, then sends Customer.io identify plus `quiz_profile_submitted` in the background. Stripe webhooks fulfill Supabase first, then send Customer.io lifecycle traits/events in best-effort background work. Operators can verify the contract in Customer.io Data Index, People, and Activity Logs.

## Target File Map

Already present, confirm/edit:

```txt
docs/customerio-data-contract.md
docs/superpowers/specs/2026-05-28-customerio-server-sync-design.md
plans/2026-05-28-customerio-server-sync.md
```

Create:

```txt
src/lib/customerio/server.ts
src/lib/customerio/quiz-traits.ts
src/lib/customerio/quiz-sync.ts
src/lib/customerio/stripe-lifecycle.ts
tests/customerio-server.test.ts
tests/customerio-quiz-traits.test.ts
tests/customerio-quiz-sync.test.ts
tests/customerio-stripe-lifecycle.test.ts
tests/customerio-stripe-webhook.test.ts
```

Modify:

```txt
src/app/api/quiz/lead/route.ts
src/app/api/stripe/webhook/route.ts
src/lib/analytics/routes.ts
src/lib/stripe/webhook-handlers.ts
tests/analytics-tracking.test.ts
```

Reuse:

```txt
src/lib/quiz/normalization.ts
src/lib/quiz/types.ts
src/lib/quiz/validators.ts
src/lib/vocabulary/concerns-goals.ts
src/lib/stripe/intervals.ts
src/lib/stripe/purchase-analytics.ts
```

## Scope Boundaries

In scope:

```txt
Customer.io Pipelines identify/track helper
quiz lead server identify
quiz_profile_submitted server event
Stripe purchase/subscription/payment lifecycle server events
disable browser Customer.io routing for purchase/subscription return events
best-effort background dispatch
focused tests
operator checklist
```

Out of scope:

```txt
direct Stripe-to-Customer.io integration
Customer.io Meta CAPI
PDF generation
Reverse ETL
reporting webhooks back into Supabase/PostHog
retry table or queue
raw free-text quiz answers
new cookie category
```

## Task 1: Customer.io Server Helper

**Files:**
- Create: `src/lib/customerio/server.ts`
- Test: `tests/customerio-server.test.ts`

- [ ] **Step 1: Write failing tests for API request shape and failure behavior**

Create `tests/customerio-server.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import {
  identifyCustomerIoServerPerson,
  trackCustomerIoServerEvent,
} from "../src/lib/customerio/server"

function withEnv(name: string, value: string, fn: () => Promise<void>) {
  const previous = process.env[name]
  process.env[name] = value
  return fn().finally(() => {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  })
}

test("server identify uses Customer.io EU Pipelines strict mode", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response("{}", { status: 200 })
  }) as typeof fetch

  try {
    await withEnv("CUSTOMERIO_SERVER_WRITE_KEY", "server-key", async () => {
      const result = await identifyCustomerIoServerPerson({
        userId: "lead@example.com",
        traits: { email: "lead@example.com", lead_id: "lead-123" },
        messageId: "identify:lead:lead-123",
      })
      assert.equal(result.ok, true)
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "https://cdp-eu.customer.io/v1/identify")
  assert.equal(calls[0].init.method, "POST")
  assert.equal((calls[0].init.headers as Record<string, string>)["X-Strict-Mode"], "1")
  assert.equal(
    (calls[0].init.headers as Record<string, string>).Authorization,
    `Basic ${Buffer.from("server-key:").toString("base64")}`,
  )
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    userId: "lead@example.com",
    traits: { email: "lead@example.com", lead_id: "lead-123" },
    messageId: "identify:lead:lead-123",
  })
})

test("server track returns a failed result instead of throwing", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response("bad", { status: 500 })) as typeof fetch

  try {
    await withEnv("CUSTOMERIO_SERVER_WRITE_KEY", "server-key", async () => {
      const result = await trackCustomerIoServerEvent({
        userId: "lead@example.com",
        event: "quiz_profile_submitted",
        properties: { lead_id: "lead-123", source: "quiz_lead_api" },
        messageId: "quiz_profile_submitted:lead-123",
      })
      assert.equal(result.ok, false)
      assert.match(result.error ?? "", /500/)
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("server helper no-ops when CUSTOMERIO_SERVER_WRITE_KEY is missing", async () => {
  const previous = process.env.CUSTOMERIO_SERVER_WRITE_KEY
  delete process.env.CUSTOMERIO_SERVER_WRITE_KEY

  try {
    const result = await identifyCustomerIoServerPerson({
      userId: "lead@example.com",
      traits: { email: "lead@example.com" },
      messageId: "identify:lead:missing-key",
    })
    assert.equal(result.ok, false)
    assert.equal(result.skipped, true)
  } finally {
    if (previous !== undefined) process.env.CUSTOMERIO_SERVER_WRITE_KEY = previous
  }
})
```

Strict mode is expected to work for Pipelines. Customer.io documents `X-Strict-Mode: 1` for Pipelines identify, track, page, screen, alias, and batch endpoints.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx tsx --test tests/customerio-server.test.ts
```

Expected: fail because `src/lib/customerio/server.ts` does not exist.

- [ ] **Step 3: Implement the server helper**

Create `src/lib/customerio/server.ts`:

```ts
type CustomerIoPrimitive = string | number | boolean | null
export type CustomerIoServerValue =
  | CustomerIoPrimitive
  | CustomerIoPrimitive[]
  | Record<string, CustomerIoPrimitive | CustomerIoPrimitive[] | undefined>
export type CustomerIoServerProperties = Record<string, CustomerIoServerValue | undefined>

export type CustomerIoServerResult = {
  ok: boolean
  skipped?: boolean
  status?: number
  error?: string
}

const CUSTOMERIO_PIPELINES_BASE_URL =
  process.env.CUSTOMERIO_PIPELINES_BASE_URL ?? "https://cdp-eu.customer.io/v1"
const DEFAULT_TIMEOUT_MS = 1500

function cleanProperties(properties: CustomerIoServerProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as Record<string, CustomerIoServerValue>
}

function authorizationHeader(writeKey: string) {
  return `Basic ${Buffer.from(`${writeKey}:`).toString("base64")}`
}

async function postCustomerIoPipelines(
  path: "/identify" | "/track",
  body: Record<string, unknown>,
): Promise<CustomerIoServerResult> {
  const writeKey = process.env.CUSTOMERIO_SERVER_WRITE_KEY
  if (!writeKey) {
    return { ok: false, skipped: true, error: "CUSTOMERIO_SERVER_WRITE_KEY is not set" }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${CUSTOMERIO_PIPELINES_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader(writeKey),
        "Content-Type": "application/json",
        "X-Strict-Mode": "1",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      return { ok: false, status: response.status, error: `${response.status} ${text}`.trim() }
    }

    return { ok: true, status: response.status }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Customer.io error"
    return { ok: false, error: message }
  } finally {
    clearTimeout(timeout)
  }
}

export function identifyCustomerIoServerPerson({
  messageId,
  timestamp,
  traits,
  userId,
}: {
  userId: string
  traits: CustomerIoServerProperties
  messageId: string
  timestamp?: string
}) {
  return postCustomerIoPipelines("/identify", {
    userId,
    traits: cleanProperties(traits),
    messageId,
    ...(timestamp ? { timestamp } : {}),
  })
}

export function trackCustomerIoServerEvent({
  event,
  messageId,
  properties,
  timestamp,
  userId,
}: {
  userId: string
  event: string
  properties: CustomerIoServerProperties
  messageId: string
  timestamp?: string
}) {
  return postCustomerIoPipelines("/track", {
    userId,
    event,
    properties: cleanProperties(properties),
    messageId,
    ...(timestamp ? { timestamp } : {}),
  })
}

export function logCustomerIoServerResult(context: string, result: CustomerIoServerResult) {
  if (result.ok) return

  console.warn("[customerio:server]", context, {
    skipped: result.skipped,
    status: result.status,
    error: result.error,
  })
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npx tsx --test tests/customerio-server.test.ts
```

Expected: pass.

## Task 2: Quiz Trait Builder

**Files:**
- Create: `src/lib/customerio/quiz-traits.ts`
- Test: `tests/customerio-quiz-traits.test.ts`

- [ ] **Step 1: Write failing tests for rich trait payloads and consent-gated skips**

Create `tests/customerio-quiz-traits.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import { buildCustomerIoQuizLeadSync } from "../src/lib/customerio/quiz-traits"

test("builds rich Customer.io quiz traits with labels when consent is true", () => {
  const sync = buildCustomerIoQuizLeadSync({
    createdAt: "2026-05-28T10:00:00.000Z",
    email: " Nick@Example.com ",
    leadId: "lead-123",
    marketingConsent: true,
    name: "Nick",
    quizAnswers: {
      structure: "wavy",
      thickness: "fine",
      density: "low",
      fingertest: "leicht_uneben",
      pulltest: "stretches_stays",
      scalp_type: "trocken",
      has_scalp_issue: true,
      scalp_condition: "gereizt",
      concerns: ["dryness", "frizz"],
      concerns_other_text: "please do not send me",
      treatment: ["blondiert"],
      goals: ["moisture", "shine"],
    },
  })

  assert.equal(sync.userId, "nick@example.com")
  assert.equal(sync.identifyTraits.email, "nick@example.com")
  assert.equal(sync.identifyTraits.first_name, "Nick")
  assert.equal(sync.identifyTraits.lead_id, "lead-123")
  assert.equal(sync.identifyTraits.marketing_consent, true)
  assert.equal(sync.identifyTraits.hair_texture, "wavy")
  assert.equal(sync.identifyTraits.hair_texture_label, "Wellig")
  assert.equal(sync.identifyTraits.thickness, "fine")
  assert.equal(sync.identifyTraits.thickness_label, "Fein")
  assert.equal(sync.identifyTraits.density, "low")
  assert.equal(sync.identifyTraits.density_label, "Wenig Haare")
  assert.equal(sync.identifyTraits.cuticle_condition, "leicht_uneben")
  assert.equal(sync.identifyTraits.cuticle_condition_label, "Leicht uneben")
  assert.equal(sync.identifyTraits.protein_moisture_balance, "stretches_stays")
  assert.equal(sync.identifyTraits.protein_moisture_balance_label, "Proteinmangel")
  assert.equal(sync.identifyTraits.scalp_type, "trocken")
  assert.equal(sync.identifyTraits.scalp_type_label, "Trocken")
  assert.equal(sync.identifyTraits.has_scalp_issue, true)
  assert.equal(sync.identifyTraits.scalp_condition, "gereizt")
  assert.equal(sync.identifyTraits.scalp_condition_label, "Gereizte Kopfhaut")
  assert.deepEqual(sync.identifyTraits.concerns, ["dryness", "frizz"])
  assert.deepEqual(sync.identifyTraits.concern_labels, ["Trockenheit", "Frizz"])
  assert.deepEqual(sync.identifyTraits.chemical_treatment, ["blondiert"])
  assert.deepEqual(sync.identifyTraits.chemical_treatment_labels, ["Blondiert"])
  assert.deepEqual(sync.identifyTraits.goals, ["moisture", "shine"])
  assert.deepEqual(sync.identifyTraits.goal_labels, ["Mehr Feuchtigkeit", "Mehr Glanz"])
  assert.equal("concerns_other_text" in sync.identifyTraits, false)
  assert.equal(sync.eventName, "quiz_profile_submitted")
  assert.equal(sync.eventProperties.source, "quiz_lead_api")
})

test("skips Customer.io quiz lead sync when consent is false", () => {
  const sync = buildCustomerIoQuizLeadSync({
    createdAt: "2026-05-28T10:00:00.000Z",
    email: "lead@example.com",
    leadId: "lead-456",
    marketingConsent: false,
    name: "Lead",
    quizAnswers: {
      structure: "curly",
      thickness: "coarse",
      density: "high",
      fingertest: "rau",
      pulltest: "snaps",
      scalp_type: "fettig",
      has_scalp_issue: false,
      concerns: ["breakage"],
      treatment: ["natur"],
      goals: ["anti_breakage"],
    },
  })

  assert.equal(sync.shouldIdentify, false)
  assert.equal(sync.shouldTrackProfileSubmitted, false)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx tsx --test tests/customerio-quiz-traits.test.ts
```

Expected: fail because `src/lib/customerio/quiz-traits.ts` does not exist.

- [ ] **Step 3: Implement quiz trait mapping**

Create `src/lib/customerio/quiz-traits.ts`:

```ts
import type { QuizAnswers } from "@/lib/quiz/types"
import { canonicalizeQuizAnswers } from "@/lib/quiz/normalization"
import { GOAL_LABELS } from "@/lib/vocabulary/concerns-goals"
import type { CustomerIoServerProperties } from "./server"

const HAIR_TEXTURE_LABELS: Record<string, string> = {
  straight: "Glatt",
  wavy: "Wellig",
  curly: "Lockig",
  coily: "Kraus",
}

const THICKNESS_LABELS: Record<string, string> = {
  fine: "Fein",
  normal: "Mittel",
  coarse: "Dick",
}

const DENSITY_LABELS: Record<string, string> = {
  low: "Wenig Haare",
  medium: "Mittlere Dichte",
  high: "Viele Haare",
}

const CUTICLE_CONDITION_LABELS: Record<string, string> = {
  glatt: "Glatt",
  leicht_uneben: "Leicht uneben",
  rau: "Rau",
}

const PROTEIN_MOISTURE_LABELS: Record<string, string> = {
  stretches_bounces: "Ausgewogen",
  stretches_stays: "Proteinmangel",
  snaps: "Feuchtigkeitsmangel",
}

const SCALP_TYPE_LABELS: Record<string, string> = {
  fettig: "Schnell fettend",
  ausgeglichen: "Ausgeglichen",
  trocken: "Trocken",
}

const SCALP_CONDITION_LABELS: Record<string, string> = {
  schuppen: "Schuppen",
  trockene_schuppen: "Trockene Schuppen",
  gereizt: "Gereizte Kopfhaut",
}

const CONCERN_LABELS: Record<string, string> = {
  hair_damage: "Haarschäden",
  split_ends: "Spliss",
  breakage: "Haarbruch",
  dryness: "Trockenheit",
  frizz: "Frizz",
  tangling: "Verknotungen",
}

const TREATMENT_LABELS: Record<string, string> = {
  natur: "Naturhaar",
  gefaerbt: "Gefärbt",
  blondiert: "Blondiert",
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function labelsFor(values: string[] | undefined, labels: Record<string, string>) {
  return values?.map((value) => labels[value] ?? value)
}

function labelFor(value: string | undefined, labels: Record<string, string>) {
  return value ? (labels[value] ?? value) : undefined
}

export function buildCustomerIoQuizLeadSync({
  createdAt,
  email,
  leadId,
  marketingConsent,
  name,
  quizAnswers,
}: {
  createdAt: string
  email: string
  leadId: string
  marketingConsent: boolean
  name: string
  quizAnswers: QuizAnswers
}) {
  const normalizedEmail = normalizeEmail(email)
  const baseTraits: CustomerIoServerProperties = {
    email: normalizedEmail,
    first_name: name.trim().split(/\s+/)[0] ?? name,
    lead_id: leadId,
    marketing_consent: marketingConsent,
    consent_timestamp: createdAt,
  }

  if (!marketingConsent) {
    return {
      userId: normalizedEmail,
      identifyTraits: {},
      eventName: "quiz_profile_submitted",
      eventProperties: { source: "quiz_lead_api", lead_id: leadId, marketing_consent: false },
      shouldIdentify: false,
      shouldTrackProfileSubmitted: false,
    }
  }

  const answers = canonicalizeQuizAnswers(quizAnswers)
  const traits: CustomerIoServerProperties = {
    ...baseTraits,
    quiz_completed_at: createdAt,
    hair_texture: answers.structure,
    hair_texture_label: labelFor(answers.structure, HAIR_TEXTURE_LABELS),
    thickness: answers.thickness,
    thickness_label: labelFor(answers.thickness, THICKNESS_LABELS),
    density: answers.density,
    density_label: labelFor(answers.density, DENSITY_LABELS),
    cuticle_condition: answers.fingertest,
    cuticle_condition_label: labelFor(answers.fingertest, CUTICLE_CONDITION_LABELS),
    protein_moisture_balance: answers.pulltest,
    protein_moisture_balance_label: labelFor(answers.pulltest, PROTEIN_MOISTURE_LABELS),
    scalp_type: answers.scalp_type,
    scalp_type_label: labelFor(answers.scalp_type, SCALP_TYPE_LABELS),
    has_scalp_issue: answers.has_scalp_issue,
    scalp_condition: answers.scalp_condition,
    scalp_condition_label: labelFor(answers.scalp_condition, SCALP_CONDITION_LABELS),
    concerns: answers.concerns,
    concern_labels: labelsFor(answers.concerns, CONCERN_LABELS),
    chemical_treatment: answers.treatment,
    chemical_treatment_labels: labelsFor(answers.treatment, TREATMENT_LABELS),
    goals: answers.goals,
    goal_labels: labelsFor(answers.goals, GOAL_LABELS),
  }

  return {
    userId: normalizedEmail,
    identifyTraits: traits,
    eventName: "quiz_profile_submitted",
    eventProperties: {
      source: "quiz_lead_api",
      lead_id: leadId,
      marketing_consent: true,
    },
    shouldIdentify: true,
    shouldTrackProfileSubmitted: true,
  }
}
```

`CONCERN_LABELS` intentionally covers the six `QUIZ_CONCERN_VALUES` accepted by `leadSchema`. If the quiz validator later widens `concerns`, update this map in the same change.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npx tsx --test tests/customerio-quiz-traits.test.ts
```

Expected: pass.

## Task 3: Background Quiz Lead Sync

**Files:**
- Create: `src/lib/customerio/quiz-sync.ts`
- Modify: `src/app/api/quiz/lead/route.ts`
- Test: `tests/customerio-quiz-sync.test.ts`

- [ ] **Step 1: Write failing sync-helper test for best-effort behavior**

Create `tests/customerio-quiz-sync.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import { syncQuizLeadToCustomerIo } from "../src/lib/customerio/quiz-sync"

function withEnv(name: string, value: string, fn: () => Promise<void>) {
  const previous = process.env[name]
  process.env[name] = value
  return fn().finally(() => {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  })
}

test("quiz lead sync returns failed results without throwing when Customer.io is unavailable", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch

  try {
    await withEnv("CUSTOMERIO_SERVER_WRITE_KEY", "server-key", async () => {
      const result = await syncQuizLeadToCustomerIo({
        createdAt: "2026-05-28T10:00:00.000Z",
        email: "lead@example.com",
        leadId: "lead-123",
        marketingConsent: true,
        name: "Lead",
        quizAnswers: {
          structure: "wavy",
          thickness: "fine",
          density: "low",
          fingertest: "leicht_uneben",
          pulltest: "stretches_stays",
          scalp_type: "trocken",
          has_scalp_issue: true,
          scalp_condition: "gereizt",
          concerns: ["dryness"],
          treatment: ["natur"],
          goals: ["moisture"],
        },
      })

      assert.equal(result.identify.ok, false)
      assert.equal(result.profileSubmitted?.ok, false)
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("quiz lead sync skips Customer.io entirely when marketing consent is false", async () => {
  const calls: unknown[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url))
    return new Response("{}", { status: 200 })
  }) as typeof fetch

  try {
    await withEnv("CUSTOMERIO_SERVER_WRITE_KEY", "server-key", async () => {
      const result = await syncQuizLeadToCustomerIo({
        createdAt: "2026-05-28T10:00:00.000Z",
        email: "lead@example.com",
        leadId: "lead-456",
        marketingConsent: false,
        name: "Lead",
        quizAnswers: {
          structure: "wavy",
          thickness: "fine",
          density: "low",
          fingertest: "leicht_uneben",
          pulltest: "stretches_stays",
          scalp_type: "trocken",
          has_scalp_issue: false,
          concerns: ["dryness"],
          treatment: ["natur"],
          goals: ["moisture"],
        },
      })

      assert.equal(result.identify, undefined)
      assert.equal(result.profileSubmitted, undefined)
      assert.deepEqual(calls, [])
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npx tsx --test tests/customerio-quiz-sync.test.ts
```

Expected: fail because `src/lib/customerio/quiz-sync.ts` does not exist.

- [ ] **Step 3: Add a quiz sync helper**

Create `src/lib/customerio/quiz-sync.ts`:

```ts
import { buildCustomerIoQuizLeadSync } from "@/lib/customerio/quiz-traits"
import {
  identifyCustomerIoServerPerson,
  logCustomerIoServerResult,
  trackCustomerIoServerEvent,
  type CustomerIoServerProperties,
} from "@/lib/customerio/server"
import type { QuizAnswers } from "@/lib/quiz/types"

export async function syncQuizLeadToCustomerIo({
  createdAt,
  email,
  leadId,
  marketingConsent,
  name,
  quizAnswers,
}: {
  createdAt: string
  email: string
  leadId: string
  marketingConsent: boolean
  name: string
  quizAnswers: QuizAnswers
}) {
  const sync = buildCustomerIoQuizLeadSync({
    createdAt,
    email,
    leadId,
    marketingConsent,
    name,
    quizAnswers,
  })

  if (!sync.shouldIdentify) return {}

  const identifyResult = await identifyCustomerIoServerPerson({
    userId: sync.userId,
    traits: sync.identifyTraits,
    messageId: `identify:quiz_lead:${leadId}`,
    timestamp: createdAt,
  })
  logCustomerIoServerResult(`identify quiz lead ${leadId}`, identifyResult)

  if (!sync.shouldTrackProfileSubmitted) return { identify: identifyResult }

  const eventResult = await trackCustomerIoServerEvent({
    userId: sync.userId,
    event: sync.eventName,
    properties: sync.eventProperties,
    messageId: `quiz_profile_submitted:${leadId}`,
    timestamp: createdAt,
  })
  logCustomerIoServerResult(`track quiz_profile_submitted ${leadId}`, eventResult)

  return { identify: identifyResult, profileSubmitted: eventResult }
}
```

- [ ] **Step 4: Call the quiz sync helper in background from the route**

Modify `src/app/api/quiz/lead/route.ts`:

```ts
import { after } from "next/server"
import { syncQuizLeadToCustomerIo } from "@/lib/customerio/quiz-sync"
```

After an existing lead is reused and after a new lead is inserted, schedule the sync:

```ts
const createdAt = new Date().toISOString()
after(() =>
  syncQuizLeadToCustomerIo({
    createdAt,
    email,
    leadId: existingLead.id,
    marketingConsent: parsed.marketingConsent,
    name: parsed.name,
    quizAnswers,
  }),
)
```

For new insert, use `data.id` as `leadId`. Keep the API response `{ leadId }` unchanged.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx tsx --test tests/customerio-server.test.ts tests/customerio-quiz-traits.test.ts tests/customerio-quiz-sync.test.ts
```

Expected: pass.

## Task 4: Stripe Lifecycle Payload Builder

**Files:**
- Create: `src/lib/customerio/stripe-lifecycle.ts`
- Test: `tests/customerio-stripe-lifecycle.test.ts`

- [ ] **Step 1: Write failing tests for checkout and invoice payloads**

Create `tests/customerio-stripe-lifecycle.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCustomerIoCheckoutCompletedSync,
  buildCustomerIoInvoicePaymentFailedSync,
} from "../src/lib/customerio/stripe-lifecycle"

test("builds purchase and subscription events from a completed checkout", () => {
  const sync = buildCustomerIoCheckoutCompletedSync({
    email: "buyer@example.com",
    interval: "month",
    planId: "premium_month",
    session: {
      id: "cs_test_123",
      amount_total: 749,
      currency: "eur",
      customer: "cus_123",
      subscription: "sub_123",
    },
    stripeEventId: "evt_123",
    timestamp: "2026-05-28T10:00:00.000Z",
    userId: "user_123",
  })

  assert.equal(sync.userId, "user_123")
  assert.equal(sync.identifyTraits.email, "buyer@example.com")
  assert.equal(sync.identifyTraits.is_customer, true)
  assert.equal(sync.identifyTraits.subscription_interval, "month")
  assert.equal(sync.identifyTraits.stripe_customer_id, "cus_123")
  assert.equal(sync.identifyTraits.stripe_subscription_id, "sub_123")
  assert.deepEqual(sync.events.map((event) => event.event), [
    "purchase_completed",
    "subscription_started",
  ])
  assert.equal(sync.events[0].messageId, "purchase_completed:cs_test_123")
  assert.equal(sync.events[0].properties.source, "stripe_webhook")
  assert.equal(sync.events[0].properties.value, 7.49)
  assert.equal(sync.events[0].properties.currency, "EUR")
})

test("builds payment_failed from an invoice", () => {
  const sync = buildCustomerIoInvoicePaymentFailedSync({
    email: "buyer@example.com",
    invoice: {
      id: "in_123",
      amount_due: 749,
      attempt_count: 2,
      currency: "eur",
      customer: "cus_123",
      subscription: "sub_123",
    },
    stripeEventId: "evt_failed",
    timestamp: "2026-05-28T10:00:00.000Z",
    userId: "user_123",
  })

  assert.equal(sync.event.event, "payment_failed")
  assert.equal(sync.event.messageId, "payment_failed:in_123")
  assert.equal(sync.event.properties.amount_due, 7.49)
  assert.equal(sync.event.properties.attempt_count, 2)
  assert.equal(sync.event.properties.currency, "EUR")
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx tsx --test tests/customerio-stripe-lifecycle.test.ts
```

Expected: fail because the module does not exist.

- [ ] **Step 3: Implement Stripe lifecycle payload builders**

Create `src/lib/customerio/stripe-lifecycle.ts`:

```ts
import type { BillingInterval } from "@/lib/stripe/intervals"
import type { CustomerIoServerProperties } from "./server"

type StripeId = string | { id?: string } | null | undefined

function idFrom(value: StripeId) {
  if (typeof value === "string") return value
  return value?.id
}

function amountFromCents(value: number | null | undefined) {
  return typeof value === "number" ? value / 100 : undefined
}

function upperCurrency(value: string | null | undefined) {
  return value ? value.toUpperCase() : undefined
}

export function buildCustomerIoCheckoutCompletedSync({
  email,
  interval,
  planId,
  session,
  stripeEventId,
  timestamp,
  userId,
}: {
  email: string
  interval: BillingInterval | string
  planId: string
  session: {
    id: string
    amount_total?: number | null
    currency?: string | null
    customer?: StripeId
    subscription?: StripeId
  }
  stripeEventId: string
  timestamp: string
  userId: string
}) {
  const stripeCustomerId = idFrom(session.customer)
  const stripeSubscriptionId = idFrom(session.subscription)
  const currency = upperCurrency(session.currency)
  const value = amountFromCents(session.amount_total)

  const identifyTraits: CustomerIoServerProperties = {
    email,
    is_customer: true,
    last_purchase_at: timestamp,
    subscription_interval: interval,
    subscription_started_at: timestamp,
    subscription_status: "active",
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
  }

  return {
    userId,
    identifyTraits,
    identifyMessageId: `identify:stripe_checkout:${session.id}`,
    events: [
      {
        event: "purchase_completed",
        messageId: `purchase_completed:${session.id}`,
        properties: {
          source: "stripe_webhook",
          stripe_event_id: stripeEventId,
          checkout_session_id: session.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          value,
          currency,
          interval,
          plan_id: planId,
        },
      },
      {
        event: "subscription_started",
        messageId: `subscription_started:${stripeSubscriptionId ?? session.id}`,
        properties: {
          source: "stripe_webhook",
          stripe_event_id: stripeEventId,
          checkout_session_id: session.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          interval,
          plan_id: planId,
          subscription_status: "active",
        },
      },
    ],
  }
}

export function buildCustomerIoInvoicePaymentFailedSync({
  email,
  invoice,
  stripeEventId,
  timestamp,
  userId,
}: {
  email?: string
  invoice: {
    id: string
    amount_due?: number | null
    attempt_count?: number | null
    currency?: string | null
    customer?: StripeId
    subscription?: StripeId
  }
  stripeEventId: string
  timestamp: string
  userId: string
}) {
  const stripeCustomerId = idFrom(invoice.customer)
  const stripeSubscriptionId = idFrom(invoice.subscription)

  return {
    userId,
    identifyTraits: {
      email,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
    } satisfies CustomerIoServerProperties,
    identifyMessageId: `identify:payment_failed:${invoice.id}`,
    event: {
      event: "payment_failed",
      messageId: `payment_failed:${invoice.id}`,
      properties: {
        source: "stripe_webhook",
        stripe_event_id: stripeEventId,
        invoice_id: invoice.id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        amount_due: amountFromCents(invoice.amount_due),
        currency: upperCurrency(invoice.currency),
        attempt_count: invoice.attempt_count ?? undefined,
        occurred_at: timestamp,
      },
    },
  }
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx tsx --test tests/customerio-stripe-lifecycle.test.ts
```

Expected: pass.

## Task 5: Disable Duplicate Browser Customer.io Revenue Events

**Files:**
- Modify: `src/lib/analytics/routes.ts`
- Modify: `tests/analytics-tracking.test.ts`

- [ ] **Step 1: Write or update routing test**

In `tests/analytics-tracking.test.ts`, add a focused expectation that browser checkout-return events do not send Customer.io:

```ts
test("browser revenue return events do not route to Customer.io", () => {
  assert.equal(eventRoutes.purchase_completed.customerio, false)
  assert.equal(eventRoutes.subscription_started.customerio, false)
  assert.equal(eventRoutes.purchase_completed.posthog, true)
  assert.equal(eventRoutes.subscription_started.posthog, true)
  assert.equal(eventRoutes.purchase_completed.meta, true)
  assert.equal(eventRoutes.subscription_started.meta, true)
})
```

Import `eventRoutes` from `../src/lib/analytics/routes`. Also update the existing purchase completion test so it expects two browser destinations (`posthog`, `meta`) instead of all three.

- [ ] **Step 2: Run routing tests and verify failure**

```bash
npx tsx --test tests/analytics-tracking.test.ts
```

Expected: fail because `purchase_completed` and `subscription_started` still route to Customer.io.

- [ ] **Step 3: Flip Customer.io routing off for browser return events**

Modify `src/lib/analytics/routes.ts`:

```ts
purchase_completed: {
  posthog: true,
  customerio: false,
  meta: true,
},
subscription_started: {
  posthog: true,
  customerio: false,
  meta: true,
},
```

Keep the browser events for PostHog and Meta. Customer.io campaign-trigger revenue events come from Stripe webhooks after Task 6.

- [ ] **Step 4: Run routing tests**

```bash
npx tsx --test tests/analytics-tracking.test.ts
```

Expected: pass.

## Task 6: Stripe Webhook Customer.io Sync

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/lib/stripe/checkout-activation.ts`
- Modify: `src/lib/stripe/webhook-handlers.ts`
- Test: `tests/customerio-stripe-webhook.test.ts`

- [ ] **Step 1: Write failing tests for handler data and exported profile lookup**

Create `tests/customerio-stripe-webhook.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import {
  findProfileByStripeCustomerId,
  handleCheckoutSessionCompleted,
  type HandlerDeps,
} from "../src/lib/stripe/webhook-handlers"

function stubDeps() {
  const profiles: Record<string, any> = {}
  const deps: HandlerDeps = {
    supabase: {
      auth: {
        admin: {
          async createUser({ email }: { email: string }) {
            const user = { id: "user_123", email }
            profiles[user.id] = { id: user.id, email }
            return { data: { user }, error: null }
          },
        },
      },
      from(table: string) {
        const filters: Array<[string, string]> = []
        const api = {
          select() {
            return this
          },
          eq(column: string, value: string) {
            filters.push([column, value])
            return this
          },
          async maybeSingle() {
            const rows = table === "profiles" ? Object.values(profiles) : []
            const row = rows.find((candidate: any) =>
              filters.every(([column, value]) => candidate[column] === value),
            )
            return { data: row ?? null, error: null }
          },
          upsert(row: any) {
            if (table === "profiles") {
              profiles[row.id] = { ...(profiles[row.id] ?? {}), ...row }
            }
            return {
              error: null,
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            }
          },
        }
        return api
      },
    } as any,
    stripe: {
      subscriptions: {
        async retrieve() {
          return {
            id: "sub_123",
            status: "active",
            current_period_end: 1_800_000_000,
            items: {
              data: [
                {
                  price: { interval: "month", interval_count: 1 },
                  current_period_end: 1_800_000_000,
                },
              ],
            },
          }
        },
      },
    } as any,
    premiumTierId: "tier_premium",
  }
  return { deps, profiles }
}

test("checkout handler returns fulfilled account data for Customer.io sync", async () => {
  const { deps } = stubDeps()

  const result = await handleCheckoutSessionCompleted(
    {
      id: "cs_123",
      status: "complete",
      payment_status: "paid",
      customer: "cus_123",
      customer_details: { email: "buyer@example.com" },
      subscription: "sub_123",
    } as any,
    deps,
  )

  assert.equal(result.userId, "user_123")
  assert.equal(result.email, "buyer@example.com")
  assert.equal(result.subscriptionInterval, "month")
  assert.equal(result.stripeCustomerId, "cus_123")
  assert.equal(result.stripeSubscriptionId, "sub_123")
})

test("profile lookup by Stripe customer returns campaign fields", async () => {
  const { deps, profiles } = stubDeps()
  profiles.user_456 = {
    id: "user_456",
    email: "buyer@example.com",
    stripe_customer_id: "cus_456",
    stripe_subscription_id: "sub_456",
    subscription_interval: "quarter",
    subscription_status: "active",
  }

  const profile = await findProfileByStripeCustomerId(deps.supabase, "cus_456")

  assert.deepEqual(profile, {
    id: "user_456",
    email: "buyer@example.com",
    stripe_subscription_id: "sub_456",
    subscription_interval: "quarter",
    subscription_status: "active",
  })
})
```

- [ ] **Step 2: Run test and verify failure**

```bash
npx tsx --test tests/customerio-stripe-webhook.test.ts
```

Expected: fail because `handleCheckoutSessionCompleted` returns `void` and `findProfileByStripeCustomerId` is private/narrow.

- [ ] **Step 3: Thread checkout fulfillment data through the existing handler**

Modify `src/lib/stripe/checkout-activation.ts`:

```ts
export interface CheckoutAccountResult {
  userId: string
  email: string
  canSetInitialPassword: boolean
  subscriptionInterval: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  subscriptionStatus: string
}
```

Change the `ensureCheckoutAccount` return at the end of the function:

```ts
return {
  userId,
  email: valid.email,
  canSetInitialPassword,
  subscriptionInterval: interval,
  stripeCustomerId: valid.customerId,
  stripeSubscriptionId: sub.id,
  subscriptionStatus: sub.status ?? "active",
}
```

Do not add a checkout route lookup; checkout data is already known inside `ensureCheckoutAccount`.

- [ ] **Step 4: Return checkout activation result and export the existing profile lookup**

Modify `src/lib/stripe/webhook-handlers.ts`:

```ts
import type { CheckoutAccountResult } from "./checkout-activation"
```

```ts
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  deps: HandlerDeps,
): Promise<CheckoutAccountResult> {
  return ensureCheckoutAccount(session, deps)
}
```

Widen and export the existing helper:

```ts
export type StripeCustomerProfile = {
  id: string
  email: string | null
  stripe_subscription_id: string | null
  subscription_interval: string | null
  subscription_status: string | null
}

export async function findProfileByStripeCustomerId(
  supabase: HandlerDeps["supabase"],
  customerId: string,
): Promise<StripeCustomerProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,stripe_subscription_id,subscription_interval,subscription_status")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  if (error) throw error
  return data as StripeCustomerProfile | null
}
```

Existing subscription handlers can keep using this helper; no duplicate helper belongs in the route.

- [ ] **Step 5: Implement route-level background sync functions**

In `src/app/api/stripe/webhook/route.ts`, import:

```ts
import {
  identifyCustomerIoServerPerson,
  logCustomerIoServerResult,
  trackCustomerIoServerEvent,
} from "@/lib/customerio/server"
import {
  buildCustomerIoCheckoutCompletedSync,
  buildCustomerIoInvoicePaymentFailedSync,
} from "@/lib/customerio/stripe-lifecycle"
import { findProfileByStripeCustomerId } from "@/lib/stripe/webhook-handlers"
```

Add a small local dispatcher:

```ts
async function dispatchCustomerIoLifecycle(sync: {
  userId: string
  identifyTraits?: CustomerIoServerProperties
  identifyMessageId?: string
  events?: Array<{ event: string; messageId: string; properties: CustomerIoServerProperties }>
}) {
  if (sync.identifyTraits && sync.identifyMessageId) {
    const identifyResult = await identifyCustomerIoServerPerson({
      userId: sync.userId,
      traits: sync.identifyTraits,
      messageId: sync.identifyMessageId,
    })
    logCustomerIoServerResult(`identify ${sync.identifyMessageId}`, identifyResult)
  }

  for (const event of sync.events ?? []) {
    const eventResult = await trackCustomerIoServerEvent({
      userId: sync.userId,
      event: event.event,
      properties: event.properties,
      messageId: event.messageId,
    })
    logCustomerIoServerResult(`track ${event.event} ${event.messageId}`, eventResult)
  }
}
```

For `checkout.session.completed`, use the handler result. Do not call `findProfileByStripeCustomerId` here:

```ts
const session = event.data.object as unknown as Stripe.Checkout.Session
const activation = await handleCheckoutSessionCompleted(session, {
  supabase,
  stripe,
  premiumTierId: await getPremiumTierId(supabase),
  linkQuizToProfile,
  profileLinkMode: "defer",
  defer: (work) => after(work),
})
after(async () => {
  const sync = buildCustomerIoCheckoutCompletedSync({
    email: activation.email,
    interval: activation.subscriptionInterval,
    planId: `premium_${activation.subscriptionInterval}`,
    session,
    stripeEventId: event.id,
    timestamp: new Date().toISOString(),
    userId: activation.userId,
  })
  await dispatchCustomerIoLifecycle(sync)
})
```

For `invoice.payment_failed`, call `handleInvoicePaymentFailed(invoice)` first, then use `findProfileByStripeCustomerId` in `after(...)` and `buildCustomerIoInvoicePaymentFailedSync`.

For `customer.subscription.updated` and `customer.subscription.deleted`, call the existing handler first, then use `findProfileByStripeCustomerId` in `after(...)`. Track events with these stable IDs:

```txt
subscription_updated:<subscription_id>:<stripe_event_id>
subscription_cancelled:<subscription_id>:<stripe_event_id>
```

Properties must include `source: "stripe_webhook"`, `stripe_event_id`, `stripe_customer_id`, `stripe_subscription_id`, and `subscription_status`. Set `is_customer: false` only from the subscription deleted Stripe path; never set `is_customer: false` from quiz lead sync.

- [ ] **Step 6: Run focused Stripe tests**

Run:

```bash
npx tsx --test tests/customerio-stripe-lifecycle.test.ts tests/customerio-stripe-webhook.test.ts
```

Expected: pass.

## Task 7: Operator Checklist And Verification

**Files:**
- Modify: `docs/customerio-data-contract.md` if implementation details changed.
- Optional: create `docs/runbooks/customerio-server-sync-verification.md` if the manual checks need more than this task list.

- [ ] **Step 1: Verify Vercel env exists**

Run:

```bash
npx vercel env ls
```

Expected: `CUSTOMERIO_SERVER_WRITE_KEY` exists for Preview and Production. If missing, stop and ask Nick to add it. Do not place the secret in git.

- [ ] **Step 2: Run full focused verification**

Run:

```bash
npx tsx --test tests/customerio-server.test.ts tests/customerio-quiz-traits.test.ts tests/customerio-quiz-sync.test.ts tests/customerio-stripe-lifecycle.test.ts tests/customerio-stripe-webhook.test.ts tests/analytics-tracking.test.ts
npm run typecheck
npm run lint
```

Expected: tests and typecheck pass. Lint may show only existing warnings.

- [ ] **Step 3: Manual Customer.io verification**

Use a real test alias and Customer.io Activity Logs:

```txt
1. Submit the quiz lead form with marketing consent true.
2. Confirm Customer.io person exists by email.
3. Confirm traits include quiz structured fields and labels.
4. Confirm `quiz_profile_submitted` exists once with `source: "quiz_lead_api"`.
5. Submit a quiz lead with marketing consent false.
6. Confirm no new Customer.io person or Customer.io quiz event is created for that alias.
7. Complete a Stripe test checkout.
8. Confirm `purchase_completed` and `subscription_started` with `source: "stripe_webhook"`.
9. Simulate or inspect a Stripe payment failure if practical.
10. Confirm no raw `concerns_other_text`, card data, billing address, tax ID, or payment method identifiers appear.
```

- [ ] **Step 4: Handoff to Customer.io operators**

Tell campaign builders:

```txt
Use `quiz_profile_submitted` for lead welcome/quiz campaigns.
Use `purchase_completed` with `source = stripe_webhook` for purchase conversion campaigns.
Use `subscription_started`, `subscription_updated`, `subscription_cancelled`, and `payment_failed` with `source = stripe_webhook` for lifecycle campaigns.
Use traits from docs/customerio-data-contract.md for segmentation and Liquid personalization.
```

## Final Checks

- [ ] `git status --short --branch`
- [ ] Confirm no secrets were written to source files, tests, docs, or shell history snippets.
- [ ] Confirm Customer.io failures are logged but do not throw from quiz lead capture or Stripe fulfillment.
- [ ] Confirm all new Customer.io server events include `source` and stable `messageId`.
- [ ] Confirm docs and implementation use the same trait/event names.

## Suggested Commit Sequence

```bash
git add docs/customerio-data-contract.md docs/superpowers/specs/2026-05-28-customerio-server-sync-design.md plans/2026-05-28-customerio-server-sync.md
git commit -m "docs(customerio): define server sync plan"

git add src/lib/customerio/server.ts tests/customerio-server.test.ts
git commit -m "feat(customerio): add server pipelines helper"

git add src/lib/customerio/quiz-traits.ts src/lib/customerio/quiz-sync.ts src/app/api/quiz/lead/route.ts tests/customerio-quiz-traits.test.ts tests/customerio-quiz-sync.test.ts
git commit -m "feat(customerio): sync quiz lead traits"

git add src/lib/analytics/routes.ts tests/analytics-tracking.test.ts
git commit -m "fix(analytics): keep browser revenue events out of Customer.io"

git add src/lib/customerio/stripe-lifecycle.ts src/app/api/stripe/webhook/route.ts src/lib/stripe/checkout-activation.ts src/lib/stripe/webhook-handlers.ts tests/customerio-stripe-lifecycle.test.ts tests/customerio-stripe-webhook.test.ts
git commit -m "feat(customerio): sync Stripe lifecycle events"
```

## Execution Handoff

Recommended next skill: `superpowers:subagent-driven-development`.

Use one subagent for Task 1-2, one for Task 3, and one for Task 4-6, with review checkpoints between them.
