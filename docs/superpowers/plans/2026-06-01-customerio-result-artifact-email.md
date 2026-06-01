# Customer.io Result Artifact Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send every completed quiz lead who lands on the result/offer surface a transactional Customer.io result-artifact email and make `/result/[leadId]?focus=routine` the canonical return path into the result + plan-selection flow.

**Architecture:** Supabase remains the source of truth. The app builds a structured Customer.io `message_data` payload from the same deterministic quiz result narrative used by the UI, sends it through the Customer.io App API as a transactional artifact email, and records race-safe send status on `leads`. `/result/[leadId]` reuses the existing post-quiz result/offer surface and scrolls to plan selection when `focus=routine` is present.

**Tech Stack:** Next.js App Router, React 19, Supabase Postgres/Admin client, Customer.io App API transactional email, TypeScript, Node test runner, Playwright component/e2e tests.

**Review status:** Reviewed through local Claude CLI with `claude-plan-review` on 2026-06-01. The plan below incorporates the blocking fixes from that review.

---

## Source Context

Design spec:

- `docs/superpowers/specs/2026-06-01-customerio-result-artifact-email-design.md`

Related docs already updated:

- `docs/customerio-data-contract.md`
- `plans/2026-06-01-retire-quiz-analyze-share-results.md` is superseded and must not be executed as written.

Final product decisions:

- Email subject: `Deine Haaranalyse ist fertig`
- Email preheader: `Öffne deine Ergebnisse und fahre mit deiner Routine fort.`
- Email CTA: `Zur Routine`
- CTA URL: `/result/[leadId]?focus=routine`
- Return-page status: `Weiter mit deiner Routine`
- Routine-context copy: `Wir schauen uns an, was du aktuell verwendest, damit Chaarlie gezielter empfehlen kann.`
- Email contains result artifact only: no prices, discounts, countdown, urgency, or offer-activated copy.
- Retry is manual only for v1: failed sends are stored. A later operator/dev tool may reset a row to `NULL` and replay it, but the public result endpoint must not automatically reclaim `failed` rows on reload.
- This email intentionally uses `send_to_unsubscribed: true` because it is a requested transactional/service artifact for the quiz user, not a marketing campaign. This bypasses marketing consent, not product-state checks.
- `/result/[leadId]` remains unauthenticated and keyed by UUID for v1. It must stay `noindex`; signed access tokens are deliberately deferred.

## Target File Map

- Create: `supabase/migrations/20260601120000_add_lead_artifact_email_status.sql`
- Create: `src/lib/customerio/transactional.ts`
- Create: `src/lib/customerio/quiz-result-artifact.ts`
- Create: `src/lib/customerio/result-artifact-service.ts`
- Create: `src/app/api/quiz/result-artifact/route.ts`
- Create: `tests/customerio-transactional.test.ts`
- Create: `tests/quiz-result-artifact-email.test.ts`
- Create: `tests/quiz-result-artifact-route.test.ts`
- Modify: `src/components/quiz/quiz-results.tsx`
- Modify: `src/components/quiz/quiz-result-offer-page.tsx`
- Modify: `src/components/quiz/quiz-analysis.tsx`
- Modify: `src/app/result/[leadId]/page.tsx`
- Modify: `src/app/result/[leadId]/result-client.tsx`
- Modify: `src/app/api/quiz/analyze/route.ts`
- Modify: `src/app/api/og/result/[leadId]/route.tsx`
- Modify: `src/lib/quiz/store.ts`
- Delete: `src/lib/quiz/share.ts`
- Modify: `src/lib/analytics/events.ts`
- Modify: `src/lib/analytics/routes.ts`
- Modify: `src/lib/analytics/destinations/customerio.ts`
- Modify: `src/lib/analytics/destinations/posthog.ts`
- Modify: `src/lib/customerio-tracking.ts`
- Modify: `tests/analytics-tracking.test.ts`
- Modify: `tests/customerio-tracking.test.ts`
- Modify: `tests/quiz-results-view.test.tsx`
- Modify: `tests/quiz-onboarding-e2e.spec.ts`
- Delete: `tests/quiz-share.test.ts`
- Create: `docs/customerio/quiz-result-artifact-template.html`

## Task 1: Create Isolated Worktree

**Files:**
- None.

- [ ] **Step 1: Create a fresh worktree**

Run:

```bash
npm run worktree:new -- customerio-result-artifact-email
```

Expected: a clean repo-local worktree at `.worktrees/customerio-result-artifact-email` on branch `codex/customerio-result-artifact-email`.

- [ ] **Step 2: Enter the worktree and verify status**

Run:

```bash
cd .worktrees/customerio-result-artifact-email
git status --short --branch
```

Expected: clean status.

## Task 2: Add Lead Email Status Columns

**Files:**
- Create: `supabase/migrations/20260601120000_add_lead_artifact_email_status.sql`

- [ ] **Step 1: Create migration**

Create:

```sql
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS artifact_email_status text,
  ADD COLUMN IF NOT EXISTS artifact_email_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS artifact_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS artifact_email_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS artifact_email_error text;

DO $$
BEGIN
  ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS leads_artifact_email_status_check;

  ALTER TABLE public.leads
    ADD CONSTRAINT leads_artifact_email_status_check
    CHECK (
      artifact_email_status IS NULL
      OR artifact_email_status IN ('sending', 'sent', 'failed')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 2: Verify migration parses**

Run:

```bash
npx supabase db lint
```

Expected: no migration syntax errors. If local Supabase is unavailable, record that and continue with TypeScript tests.

- [ ] **Step 3: Plan deployment order**

Before deploying the app route, apply this migration to the target Supabase project (`pqdkhefxsxkyeqelqegq`) through the team's normal migration path. The production order is:

```txt
1. Apply Supabase migration.
2. Configure Customer.io App API env vars.
3. Deploy app route/client changes.
4. Send one non-production/test lead before broad rollout.
```

Expected: app code never reaches production before the `artifact_email_*` columns and Customer.io App API configuration exist.

## Task 3: Customer.io Transactional Send Helper

**Files:**
- Create: `src/lib/customerio/transactional.ts`
- Test: `tests/customerio-transactional.test.ts`

Note: `supabase/functions/send-email/message-builder.ts` already uses the same Customer.io App API request shape in Deno. Keep this Node helper aligned with that edge-function payload shape, but do not import the Deno code into the Next.js route.

- [ ] **Step 1: Write tests for request shape**

Create `tests/customerio-transactional.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import {
  buildCustomerIoTransactionalEmailRequest,
  type CustomerIoTransactionalEmailPayload,
} from "../src/lib/customerio/transactional"

test("builds Customer.io App API transactional request with privacy flags", () => {
  const payload: CustomerIoTransactionalEmailPayload = {
    to: "lea@example.com",
    transactionalMessageId: "quiz_result_artifact",
    messageData: { first_name: "Lea", cta_label: "Zur Routine" },
  }

  const request = buildCustomerIoTransactionalEmailRequest(payload)

  assert.equal(request.path, "/v1/send/email")
  assert.deepEqual(request.body.identifiers, { email: "lea@example.com" })
  assert.equal(request.body.to, "lea@example.com")
  assert.equal(request.body.transactional_message_id, "quiz_result_artifact")
  assert.equal(request.body.send_to_unsubscribed, true)
  assert.equal(request.body.disable_message_retention, true)
  assert.deepEqual(request.body.message_data, payload.messageData)
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx tsx --test tests/customerio-transactional.test.ts
```

Expected: fails because `src/lib/customerio/transactional.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `src/lib/customerio/transactional.ts`:

```ts
export type CustomerIoMessageDataValue =
  | string
  | number
  | boolean
  | null
  | CustomerIoMessageDataValue[]
  | { [key: string]: CustomerIoMessageDataValue }

export type CustomerIoMessageData = Record<string, CustomerIoMessageDataValue>

export interface CustomerIoTransactionalEmailPayload {
  to: string
  transactionalMessageId: string
  messageData: CustomerIoMessageData
}

export interface CustomerIoTransactionalEmailRequest {
  path: "/v1/send/email"
  body: {
    to: string
    transactional_message_id: string
    identifiers: { email: string }
    message_data: CustomerIoMessageData
    disable_message_retention: true
    send_to_unsubscribed: true
  }
}

export function buildCustomerIoTransactionalEmailRequest(
  payload: CustomerIoTransactionalEmailPayload,
): CustomerIoTransactionalEmailRequest {
  return {
    path: "/v1/send/email",
    body: {
      to: payload.to,
      transactional_message_id: payload.transactionalMessageId,
      identifiers: { email: payload.to },
      message_data: payload.messageData,
      disable_message_retention: true,
      send_to_unsubscribed: true,
    },
  }
}

export async function sendCustomerIoTransactionalEmail(
  payload: CustomerIoTransactionalEmailPayload,
  options: {
    apiKey?: string
    apiUrl?: string
    fetchImpl?: typeof fetch
    timeoutMs?: number
  } = {},
): Promise<void> {
  const apiKey = options.apiKey ?? process.env.CUSTOMERIO_APP_API_KEY
  if (!apiKey) throw new Error("CUSTOMERIO_APP_API_KEY is not set")

  const apiUrl = options.apiUrl ?? process.env.CUSTOMERIO_APP_API_URL ?? "https://api-eu.customer.io"
  const fetchImpl = options.fetchImpl ?? fetch
  const request = buildCustomerIoTransactionalEmailRequest(payload)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000)

  let response: Response
  try {
    response = await fetchImpl(`${apiUrl}${request.path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Customer.io transactional email failed: ${response.status} ${body}`)
  }
}
```

- [ ] **Step 4: Run test**

Run:

```bash
npx tsx --test tests/customerio-transactional.test.ts
```

Expected: pass.

## Task 4: Quiz Result Artifact Payload Builder

**Files:**
- Create: `src/lib/customerio/quiz-result-artifact.ts`
- Test: `tests/quiz-result-artifact-email.test.ts`

- [ ] **Step 1: Write tests for deterministic payload**

Create `tests/quiz-result-artifact-email.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import { buildQuizResultArtifactEmailPayload } from "../src/lib/customerio/quiz-result-artifact"
import type { QuizAnswers } from "../src/lib/quiz/types"

const answers: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  fingertest: "leicht_uneben",
  pulltest: "stretches_stays",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["frizz", "dryness"],
  treatment: ["gefaerbt"],
  goals: ["less_frizz", "moisture"],
}

test("builds Customer.io message data from quiz result narrative", () => {
  const payload = buildQuizResultArtifactEmailPayload({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    name: "Lea Beispiel",
    email: "lea@example.com",
    quizAnswers: answers,
    siteUrl: "https://chaarlie.de",
  })

  assert.equal(payload.to, "lea@example.com")
  assert.equal(payload.transactionalMessageId, "quiz_result_artifact")
  assert.equal(payload.messageData.lead_id, "550e8400-e29b-41d4-a716-446655440000")
  assert.equal(payload.messageData.first_name, "Lea")
  assert.equal(payload.messageData.cta_label, "Zur Routine")
  assert.equal(
    payload.messageData.result_url,
    "https://chaarlie.de/result/550e8400-e29b-41d4-a716-446655440000?focus=routine",
  )
  assert.equal(Array.isArray(payload.messageData.rows), true)
  assert.equal(Array.isArray(payload.messageData.routine_levers), true)
})

test("sanitizes first name and never includes raw free text", () => {
  const payload = buildQuizResultArtifactEmailPayload({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    name: "<script>Lea</script> Danger",
    email: "lea@example.com",
    quizAnswers: { ...answers, concerns_other_text: "<b>raw</b>" },
    siteUrl: "https://chaarlie.de",
  })

  assert.equal(payload.messageData.first_name, "scriptLeascript")
  assert.equal("concerns_other_text" in payload.messageData, false)
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npx tsx --test tests/quiz-result-artifact-email.test.ts
```

Expected: fails because builder does not exist.

- [ ] **Step 3: Implement builder**

Create `src/lib/customerio/quiz-result-artifact.ts`:

```ts
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"
import type { CustomerIoTransactionalEmailPayload } from "./transactional"

export const QUIZ_RESULT_ARTIFACT_MESSAGE_ID = "quiz_result_artifact"
export const QUIZ_RESULT_ARTIFACT_CTA_LABEL = "Zur Routine"

export interface QuizResultArtifactEmailInput {
  leadId: string
  name: string
  email: string
  quizAnswers: QuizAnswers
  siteUrl: string
}

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ""
  return first.replace(/[^\p{L}\p{N}' -]/gu, "").slice(0, 60)
}

function resultUrl(siteUrl: string, leadId: string): string {
  const url = new URL(`/result/${leadId}`, siteUrl)
  url.searchParams.set("focus", "routine")
  return url.toString()
}

export function buildQuizResultArtifactEmailPayload(
  input: QuizResultArtifactEmailInput,
): CustomerIoTransactionalEmailPayload {
  const narrative = buildQuizResultNarrative(input.quizAnswers)

  return {
    to: input.email,
    transactionalMessageId: QUIZ_RESULT_ARTIFACT_MESSAGE_ID,
    messageData: {
      lead_id: input.leadId,
      first_name: firstName(input.name),
      headline: narrative.heroHeadline,
      intro: narrative.intro,
      rows: narrative.rows.map((row) => ({
        label: row.label,
        scope: row.scope,
        before: row.before,
        after: row.after,
      })),
      main_lever_title: narrative.needs.mainLeverTitle,
      main_lever_why: narrative.needs.mainLeverWhy,
      routine_levers: narrative.needs.products.map((product) => ({
        name: product.name,
        description: product.description,
      })),
      cta_label: QUIZ_RESULT_ARTIFACT_CTA_LABEL,
      result_url: resultUrl(input.siteUrl, input.leadId),
    },
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npx tsx --test tests/quiz-result-artifact-email.test.ts tests/customerio-transactional.test.ts
```

Expected: pass.

## Task 5: Race-Safe Result Artifact Endpoint

**Files:**
- Create: `src/lib/customerio/result-artifact-service.ts`
- Create: `src/app/api/quiz/result-artifact/route.ts`
- Test: `tests/quiz-result-artifact-route.test.ts`

- [ ] **Step 1: Write service tests around claim/send/mark flow**

Create `tests/quiz-result-artifact-route.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import {
  handleResultArtifactEmail,
  type ResultArtifactEmailLead,
  type ResultArtifactEmailStore,
} from "../src/lib/customerio/result-artifact-service"
import type { CustomerIoTransactionalEmailPayload } from "../src/lib/customerio/transactional"

const completeQuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  fingertest: "leicht_uneben",
  pulltest: "stretches_stays",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["frizz"],
  treatment: ["natur"],
  goals: ["less_frizz"],
}

function createStore(lead: ResultArtifactEmailLead | null): {
  store: ResultArtifactEmailStore
  updates: Array<{ status: string; error?: string }>
} {
  let current = lead
  const updates: Array<{ status: string; error?: string }> = []

  return {
    updates,
    store: {
      async claimLead(leadId) {
        if (!current || current.id !== leadId) return null
        if (current.artifact_email_status !== null) {
          return null
        }
        current = { ...current, artifact_email_status: "sending" }
        updates.push({ status: "sending" })
        return current
      },
      async markSent() {
        updates.push({ status: "sent" })
      },
      async markFailed(_leadId, error) {
        updates.push({ status: "failed", error })
      },
    },
  }
}

const validLead: ResultArtifactEmailLead = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Lea Beispiel",
  email: "lea@example.com",
  quiz_answers: completeQuizAnswers,
  artifact_email_status: null,
}

test("claims an unsent lead, sends, and marks sent", async () => {
  const { store, updates } = createStore(validLead)
  const sends: CustomerIoTransactionalEmailPayload[] = []

  const result = await handleResultArtifactEmail({
    leadId: validLead.id,
    siteUrl: "https://chaarlie.de",
    store,
    send: async (payload) => {
      sends.push(payload)
    },
  })

  assert.deepEqual(result, { sent: true, skipped: false })
  assert.equal(sends.length, 1)
  assert.deepEqual(
    updates.map((update) => update.status),
    ["sending", "sent"],
  )
})

test("skips a lead already sent or currently sending", async () => {
  for (const status of ["sent", "sending"] as const) {
    const { store } = createStore({ ...validLead, artifact_email_status: status })
    const result = await handleResultArtifactEmail({
      leadId: validLead.id,
      siteUrl: "https://chaarlie.de",
      store,
      send: async () => {
        throw new Error("should not send")
      },
    })

    assert.deepEqual(result, { sent: false, skipped: true })
  }
})

test("skips a failed lead until manual retry resets the row", async () => {
  const { store, updates } = createStore({ ...validLead, artifact_email_status: "failed" })
  const result = await handleResultArtifactEmail({
    leadId: validLead.id,
    siteUrl: "https://chaarlie.de",
    store,
    send: async () => {
      throw new Error("should not send")
    },
  })

  assert.deepEqual(result, { sent: false, skipped: true })
  assert.deepEqual(updates, [])
})

test("two calls against the same claimed row only send once", async () => {
  const { store } = createStore(validLead)
  let sendCount = 0

  const first = await handleResultArtifactEmail({
    leadId: validLead.id,
    siteUrl: "https://chaarlie.de",
    store,
    send: async () => {
      sendCount += 1
    },
  })
  const second = await handleResultArtifactEmail({
    leadId: validLead.id,
    siteUrl: "https://chaarlie.de",
    store,
    send: async () => {
      sendCount += 1
    },
  })

  assert.deepEqual(first, { sent: true, skipped: false })
  assert.deepEqual(second, { sent: false, skipped: true })
  assert.equal(sendCount, 1)
})

test("marks failed when Customer.io send fails", async () => {
  const { store, updates } = createStore(validLead)

  const result = await handleResultArtifactEmail({
    leadId: validLead.id,
    siteUrl: "https://chaarlie.de",
    store,
    send: async () => {
      throw new Error("Customer.io timeout with secret-token")
    },
  })

  assert.deepEqual(result, { sent: false, skipped: false })
  assert.equal(updates.at(-1)?.status, "failed")
  assert.match(updates.at(-1)?.error ?? "", /Customer\.io timeout/)
  assert.doesNotMatch(updates.at(-1)?.error ?? "", /secret-token/)
})

test("rejects incomplete quiz answers before sending", async () => {
  const { store, updates } = createStore({
    ...validLead,
    quiz_answers: { ...completeQuizAnswers, structure: undefined },
  })

  const result = await handleResultArtifactEmail({
    leadId: validLead.id,
    siteUrl: "https://chaarlie.de",
    store,
    send: async () => {
      throw new Error("should not send")
    },
  })

  assert.deepEqual(result, { sent: false, skipped: false })
  assert.equal(updates.at(-1)?.status, "failed")
  assert.match(updates.at(-1)?.error ?? "", /complete quiz answers/)
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npx tsx --test tests/quiz-result-artifact-route.test.ts
```

Expected: fails because the service does not exist.

- [ ] **Step 3: Implement service**

Create `src/lib/customerio/result-artifact-service.ts`:

```ts
import { buildQuizResultArtifactEmailPayload } from "@/lib/customerio/quiz-result-artifact"
import type { CustomerIoTransactionalEmailPayload } from "@/lib/customerio/transactional"
import { normalizeStoredQuizAnswers } from "@/lib/quiz/normalization"
import { quizAnswersSchema } from "@/lib/quiz/validators"
import type { QuizAnswers } from "@/lib/quiz/types"

export type ArtifactEmailStatus = "sending" | "sent" | "failed" | null

export interface ResultArtifactEmailLead {
  id: string
  name: string | null
  email: string | null
  quiz_answers: unknown
  artifact_email_status: ArtifactEmailStatus
}

export interface ResultArtifactEmailStore {
  claimLead(leadId: string): Promise<ResultArtifactEmailLead | null>
  markSent(leadId: string): Promise<void>
  markFailed(leadId: string, error: string): Promise<void>
}

export interface ResultArtifactEmailDeps {
  leadId: string
  siteUrl: string
  store: ResultArtifactEmailStore
  send: (payload: CustomerIoTransactionalEmailPayload) => Promise<void>
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown Customer.io error"
  return message.replace(/secret[-_a-z0-9]*/gi, "[redacted]").slice(0, 500)
}

function completeQuizAnswers(raw: unknown): QuizAnswers | null {
  const normalized = normalizeStoredQuizAnswers((raw as Record<string, unknown> | null) ?? null)
  const parsed = quizAnswersSchema.safeParse(normalized)
  return parsed.success ? parsed.data : null
}

export async function handleResultArtifactEmail({
  leadId,
  siteUrl,
  store,
  send,
}: ResultArtifactEmailDeps): Promise<{ sent: boolean; skipped: boolean }> {
  const claimed = await store.claimLead(leadId)
  if (!claimed) {
    return { sent: false, skipped: true }
  }

  const quizAnswers = completeQuizAnswers(claimed.quiz_answers)
  if (!claimed.email || !claimed.name || !quizAnswers) {
    await store.markFailed(leadId, "lead is missing email, name, or complete quiz answers")
    return { sent: false, skipped: false }
  }

  try {
    const payload = buildQuizResultArtifactEmailPayload({
      leadId,
      name: claimed.name,
      email: claimed.email,
      quizAnswers,
      siteUrl,
    })

    await send(payload)
    await store.markSent(leadId)
    return { sent: true, skipped: false }
  } catch (error) {
    await store.markFailed(leadId, sanitizeError(error))
    return { sent: false, skipped: false }
  }
}
```

- [ ] **Step 4: Run service tests**

Run:

```bash
npx tsx --test tests/quiz-result-artifact-route.test.ts
```

Expected: pass.

- [ ] **Step 5: Implement Next route wrapper**

Create `src/app/api/quiz/result-artifact/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  handleResultArtifactEmail,
  type ResultArtifactEmailStore,
} from "@/lib/customerio/result-artifact-service"
import { sendCustomerIoTransactionalEmail } from "@/lib/customerio/transactional"
import { checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

const BodySchema = z.object({
  leadId: z.string().uuid(),
})

const RESULT_ARTIFACT_RATE_LIMIT = {
  prefix: "quiz-result-artifact",
  limit: 8,
  windowMs: 60_000,
} as const

function siteUrlFromRequest(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
}

function createSupabaseArtifactStore(supabase: SupabaseClient): ResultArtifactEmailStore {
  return {
    async claimLead(leadId) {
      const { data, error } = await supabase
        .from("leads")
        .update({
          artifact_email_status: "sending",
          artifact_email_claimed_at: new Date().toISOString(),
          artifact_email_failed_at: null,
          artifact_email_error: null,
        })
        .eq("id", leadId)
        .is("artifact_email_status", null)
        .select("id, name, email, quiz_answers, artifact_email_status")
        .maybeSingle()

      if (error) throw new Error(`artifact email claim failed: ${error.message}`)
      return data
    },
    async markSent(leadId) {
      const { error } = await supabase
        .from("leads")
        .update({
          artifact_email_status: "sent",
          artifact_email_sent_at: new Date().toISOString(),
          artifact_email_failed_at: null,
          artifact_email_error: null,
        })
        .eq("id", leadId)
      if (error) throw new Error(`artifact email sent update failed: ${error.message}`)
    },
    async markFailed(leadId, errorMessage) {
      const { error } = await supabase
        .from("leads")
        .update({
          artifact_email_status: "failed",
          artifact_email_failed_at: new Date().toISOString(),
          artifact_email_error: errorMessage,
        })
        .eq("id", leadId)
      if (error) throw new Error(`artifact email failed update failed: ${error.message}`)
    },
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown"
  const rateCheck = await checkRateLimit(ip, RESULT_ARTIFACT_RATE_LIMIT)
  if (!rateCheck.allowed) {
    const status = rateCheck.error === "service_unavailable" ? 503 : 429
    return NextResponse.json({ error: "Zu viele Anfragen" }, { status })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Daten" }, { status: 400 })
  }

  const leadRateCheck = await checkRateLimit(parsed.data.leadId, {
    ...RESULT_ARTIFACT_RATE_LIMIT,
    prefix: "quiz-result-artifact-lead",
  })
  if (!leadRateCheck.allowed) {
    const status = leadRateCheck.error === "service_unavailable" ? 503 : 429
    return NextResponse.json({ error: "Zu viele Anfragen" }, { status })
  }

  try {
    const supabase = createAdminClient()
    const result = await handleResultArtifactEmail({
      leadId: parsed.data.leadId,
      siteUrl: siteUrlFromRequest(request),
      store: createSupabaseArtifactStore(supabase),
      send: sendCustomerIoTransactionalEmail,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[quiz-result-artifact]", error)
    return NextResponse.json({ error: "Senden fehlgeschlagen" }, { status: 502 })
  }
}
```

- [ ] **Step 6: Run route/service test**

Run:

```bash
npx tsx --test tests/quiz-result-artifact-route.test.ts
```

Expected: pass.

## Task 6: Trigger Artifact Email When Result Offer Is Shown

**Files:**
- Modify: `src/components/quiz/quiz-results.tsx`

- [ ] **Step 1: Add idempotent client trigger**

In `src/components/quiz/quiz-results.tsx`, add a ref and effect near the existing quiz-completed tracking, after `canGoStraightToRoutine` has been computed:

```tsx
const artifactEmailTriggeredRef = useRef(false)

useEffect(() => {
  if (!leadId || canGoStraightToRoutine || artifactEmailTriggeredRef.current) return
  artifactEmailTriggeredRef.current = true

  void fetch("/api/quiz/result-artifact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ leadId }),
  }).catch((error) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[quiz-results] result artifact email trigger failed", error)
    }
  })
}, [canGoStraightToRoutine, leadId])
```

Place it after subscriber/access state is known. This email is for non-subscriber result/offer completion; active subscribers who go straight to the routine should not get a pricing-return email from this trigger. The backend remains the authoritative idempotency guard.

- [ ] **Step 2: Run typecheck for component changes**

Run:

```bash
npm run typecheck
```

Expected: no TypeScript errors.

## Task 7: Canonical `/result/[leadId]` Result + Routine Page

**Files:**
- Modify: `src/app/result/[leadId]/page.tsx`
- Modify: `src/app/result/[leadId]/result-client.tsx`
- Modify: `src/components/quiz/quiz-result-offer-page.tsx`

- [ ] **Step 1: Expose pricing section focus in offer page shell**

In `src/components/quiz/quiz-result-offer-page.tsx`, update the shell props:

```tsx
export function QuizResultOfferPageShell({
  name,
  narrative,
  pricingSlot,
  focusRoutine = false,
}: {
  name: string
  narrative: QuizResultNarrative
  pricingSlot?: ReactNode
  focusRoutine?: boolean
}) {
```

Add `id="pricing"` to the existing pricing section if it is not already present. Add a small status near the top of that section:

```tsx
{focusRoutine ? (
  <p className="mb-3 rounded-[12px] bg-[var(--brand-plum-ice)] px-3 py-2 text-center text-[12px] font-bold text-[var(--brand-plum)]">
    Weiter mit deiner Routine
  </p>
) : null}
```

Add concise explanatory copy near the plan selection header:

```tsx
<p className="mx-auto mb-4 max-w-[36ch] text-center text-[13px] leading-[1.55] text-muted-foreground">
  Wir schauen uns an, was du aktuell verwendest, damit Chaarlie gezielter empfehlen kann.
</p>
```

Do not apply the following copy changes globally. The primary post-quiz conversion page should keep its current copy unless product explicitly chooses otherwise. Gate the return-page wording behind `focusRoutine` where the strings appear in `src/components/quiz/quiz-result-offer-page.tsx`:

```txt
focusRoutine ? "Der nächste Schritt: deine aktuelle Routine" : "Dein vollständiger 30-Tage-Plan ist fertig"

focusRoutine ? "Damit Chaarlie später gezielt Produkte, Reihenfolge und Anwendung empfehlen kann." : "Mit konkreten Produkten für deine Situation"

focusRoutine ? "Deine Haaranalyse ist fertig. Jetzt verstehen wir deine aktuelle Pflege-Routine." : "Dein persönlicher Plan ist fertig. Hol dir jetzt das Sonderangebot."

focusRoutine ? "Mach mit deiner Routine weiter." : "Dein Haar wartet nicht. Starte jetzt."
```

Update the wrapper `QuizResultOfferPage` as an explicit part of this step:

```tsx
export function QuizResultOfferPage({
  name,
  narrative,
  leadId,
  onCheckoutOpen,
  focusRoutine = false,
}: {
  name: string
  narrative: QuizResultNarrative
  leadId: string
  onCheckoutOpen?: () => void
  focusRoutine?: boolean
}) {
  return (
    <QuizResultOfferPageShell
      name={name}
      narrative={narrative}
      pricingSlot={existingPricingSlot}
      focusRoutine={focusRoutine}
    />
  )
}
```

Use the component's existing pricing slot construction; `existingPricingSlot` is only a placeholder in this plan snippet.

- [ ] **Step 2: Add client-side focus scroll**

In `src/app/result/[leadId]/result-client.tsx`, replace the old `QuizResultsView` share-oriented render with `QuizResultOfferPage`.

Use:

```tsx
import { useEffect } from "react"
import { QuizResultOfferPage } from "@/components/quiz/quiz-result-offer-page"
```

Add a prop:

```ts
focusRoutine: boolean
```

Then:

```tsx
useEffect(() => {
  if (!focusRoutine) return
  window.requestAnimationFrame(() => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" })
  })
}, [focusRoutine])
```

Render:

```tsx
return (
  <QuizResultOfferPage
    name={name}
    narrative={narrative}
    leadId={leadId}
    focusRoutine={focusRoutine}
  />
)
```

- [ ] **Step 3: Read `focus` search param in server page**

In `src/app/result/[leadId]/page.tsx`, update props:

```ts
interface Props {
  params: Promise<{ leadId: string }>
  searchParams: Promise<{ focus?: string }>
}
```

Pass:

```tsx
const sp = await searchParams
const focusRoutine = sp.focus === "routine"

return (
  <ResultPageClient
    leadId={lead.id}
    name={lead.name}
    quizAnswers={lead.quiz_answers as QuizAnswers}
    shareQuote={null}
    focusRoutine={focusRoutine}
  />
)
```

Remove share behavior from the result client; keep `shareQuote` only if temporarily required by types, then remove the prop entirely once callers are updated.

Add a focused test or manual assertion for checkout behavior from this route:

```txt
Given /result/<leadId>?focus=routine
When the user selects a plan
Then /api/stripe/create-checkout-session receives the same leadId
And the checkout does not auto-open before a plan/CTA interaction
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

## Task 8: Retire Analyze And Share-Only Surfaces Without Retiring `/result/[leadId]`

**Files:**
- Modify: `src/app/api/quiz/analyze/route.ts`
- Modify: `src/app/api/og/result/[leadId]/route.tsx`
- Modify: `src/lib/quiz/store.ts`
- Modify: `src/components/quiz/quiz-analysis.tsx`
- Modify: `src/components/quiz/quiz-results.tsx`
- Modify analytics files listed in Target File Map.

- [ ] **Step 1: Stop analysis screen from calling OpenAI**

In `src/components/quiz/quiz-analysis.tsx`, remove fetches to `/api/quiz/analyze` and make the screen a timed transition only. Keep the existing visual pacing.

Important: the current reveal button is gated by both timer completion and `apiDone`. Do not leave `apiDone` permanently false. Either remove `apiDone` from `canReveal`, or set the equivalent "done" state from the timer. Also remove unused `setAiInsight` / `setShareQuote` destructuring from the quiz store.

Expected behavior: the quiz still reaches result/offer screen; no `/api/quiz/analyze` request is made.

- [ ] **Step 2: Return 410 from `/api/quiz/analyze`**

Replace `src/app/api/quiz/analyze/route.ts` with:

```ts
import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "Quiz-Analyse nicht mehr unterstuetzt" }, { status: 410 })
}
```

- [ ] **Step 3: Return 410 from OG share image route**

Replace `src/app/api/og/result/[leadId]/route.tsx` with:

```ts
export async function GET() {
  return new Response("Result sharing image is no longer supported", { status: 410 })
}
```

- [ ] **Step 4: Remove public share action from quiz results**

In `src/components/quiz/quiz-results.tsx`, remove imports/usages of `buildQuizShareConfig`, `shareQuote`, `handleShare`, and the `ERGEBNIS TEILEN` secondary action.

Keep the result/offer flow intact.

- [ ] **Step 5: Remove retired share/AI state**

Remove retired state and helpers:

```txt
src/lib/quiz/store.ts: aiInsight, shareQuote, setAiInsight, setShareQuote, isAnalyzing if now unused
src/lib/quiz/share.ts: delete file if no active imports remain
src/lib/quiz/results-lookup.ts: remove share_quote reads if the result page no longer consumes them
src/app/result/[leadId]/page.tsx: stop selecting/passing share_quote once the client no longer needs it
```

Expected: the quiz store no longer carries deprecated AI/share output for the new flow.

- [ ] **Step 6: Remove retired analytics events**

Remove `result_shared` and `result_page_viewed` from:

```txt
src/lib/analytics/events.ts
src/lib/analytics/routes.ts
src/lib/analytics/destinations/customerio.ts
src/lib/analytics/destinations/posthog.ts
src/lib/customerio-tracking.ts
```

Do not remove checkout/pricing/quiz events.

- [ ] **Step 7: Search for retired references**

Run:

```bash
rg -n "shareQuote|setShareQuote|aiInsight|setAiInsight|/api/quiz/analyze|result_shared|result_page_viewed|buildQuizShareConfig" src tests -S
```

Expected: no active app references. Historical docs/specs may still mention them.

## Task 9: Customer.io Template Starter

**Files:**
- Create: `docs/customerio/quiz-result-artifact-template.html`

- [ ] **Step 1: Create starter template**

Create `docs/customerio/quiz-result-artifact-template.html`:

```html
<div style="font-family: Arial, sans-serif; color: #332f2d; line-height: 1.5;">
  <p style="margin: 0 0 16px;">{% if trigger.first_name != blank %}{{ trigger.first_name | escape }}, {% endif %}deine Haaranalyse ist fertig.</p>

  <h1 style="font-size: 28px; line-height: 1.15; margin: 0 0 14px; color: #4b2f68;">
    {{ trigger.headline | default: "So kommen wir deinem Haarziel näher" | escape }}
  </h1>

  <p style="margin: 0 0 22px; color: #746d67;">
    {{ trigger.intro | default: "" | escape }}
  </p>

  {% for row in trigger.rows %}
    <div style="border-top: 1px solid #e7ddd6; padding: 14px 0;">
      <p style="margin: 0 0 6px; color: #4b2f68; font-size: 12px; font-weight: bold;">
        {{ row.label | escape }}{% if row.scope != blank %} · {{ row.scope | escape }}{% endif %}
      </p>
      <p style="margin: 0 0 4px;"><strong>Aktuell:</strong> {{ row.before | escape }}</p>
      <p style="margin: 0;"><strong>Ziel:</strong> {{ row.after | escape }}</p>
    </div>
  {% endfor %}

  <div style="background: #f7f1fb; border-radius: 14px; padding: 18px; margin: 22px 0;">
    <p style="margin: 0 0 8px; color: #4b2f68; font-size: 12px; font-weight: bold;">Dein größter Hebel</p>
    <h2 style="font-size: 22px; line-height: 1.2; margin: 0 0 10px; color: #332f2d;">
      {{ trigger.main_lever_title | escape }}
    </h2>
    <p style="margin: 0;">{{ trigger.main_lever_why | escape }}</p>
  </div>

  {% for lever in trigger.routine_levers %}
    <p style="margin: 0 0 10px;"><strong>{{ lever.name | escape }}:</strong> {{ lever.description | escape }}</p>
  {% endfor %}

  <p style="margin: 26px 0 0;">
    <a href="{{ trigger.result_url }}" style="display: inline-block; background: #d96f5d; color: #ffffff; text-decoration: none; border-radius: 12px; padding: 14px 22px; font-weight: bold;">
      {{ trigger.cta_label | default: "Zur Routine" | escape }}
    </a>
  </p>
</div>
```

- [ ] **Step 2: Preview manually in Customer.io**

Operational checklist:

```txt
1. Create or open Customer.io transactional message `quiz_result_artifact`.
2. Confirm the workspace region and set `CUSTOMERIO_APP_API_URL` to `https://api-eu.customer.io` for EU workspaces or the matching Customer.io App API base URL for the actual workspace.
3. Set subject to `Deine Haaranalyse ist fertig`.
4. Set preheader to `Öffne deine Ergebnisse und fahre mit deiner Routine fort.`
5. Paste the HTML into the Customer.io code editor.
6. Preview with the fixture payload from `tests/quiz-result-artifact-email.test.ts`.
7. Send one test email in a non-production Customer.io workspace before enabling production env vars.
```

Expected: no Liquid errors; empty optional fields fall back cleanly.

## Task 10: Verification

**Files:**
- All changed files.

- [ ] **Step 1: Verify migration exists before app deploy**

Against the target environment, confirm the migration has been applied before testing the route:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'leads'
  and column_name like 'artifact_email_%'
order by column_name;
```

Expected: `artifact_email_status`, `artifact_email_claimed_at`, `artifact_email_sent_at`, `artifact_email_failed_at`, and `artifact_email_error` are present.

- [ ] **Step 2: Run focused unit tests**

Run:

```bash
npx tsx --test tests/customerio-transactional.test.ts tests/quiz-result-artifact-email.test.ts tests/quiz-result-artifact-route.test.ts
```

Expected: pass.

- [ ] **Step 3: Run broader node tests**

Run:

```bash
npm run test:node
```

Expected: pass.

- [ ] **Step 4: Typecheck and lint**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: pass.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: pass.

- [ ] **Step 6: Manual browser verification**

Run:

```bash
npm run dev:worktree
```

Open:

```txt
http://localhost:<worktree-port>/result/<test-lead-id>?focus=routine
```

Expected:

- result page renders result + plan selection
- page scrolls to plan selection
- status says `Weiter mit deiner Routine`
- pricing/checkout is visible but not auto-opened

- [ ] **Step 7: Customer.io request verification**

With Customer.io env configured in a non-production workspace, complete a quiz and reach the result screen.

Expected:

- `leads.artifact_email_status = 'sent'`
- `artifact_email_sent_at` is set
- Customer.io receives transactional send `quiz_result_artifact`
- email has subject `Deine Haaranalyse ist fertig`
- preheader `Öffne deine Ergebnisse und fahre mit deiner Routine fort.`
- CTA text `Zur Routine`
- CTA href includes `?focus=routine`

- [ ] **Step 8: Final review gate**

Before handoff/push, run the repo's configured final review flow on the diff from the worktree branch to `main` and address any blocking findings.

Expected: no unresolved blocking review findings remain.

## Task 11: Commit

**Files:**
- All implementation files.

- [ ] **Step 1: Check status**

Run:

```bash
git status --short
```

Expected: only files from this plan are modified.

- [ ] **Step 2: Commit**

Run:

```bash
git add supabase/migrations src tests docs/customerio docs/superpowers/plans docs/superpowers/specs docs/customerio-data-contract.md plans/2026-06-01-retire-quiz-analyze-share-results.md
git commit -m "feat(customerio): send quiz result artifact email"
```

Expected: one focused commit.
