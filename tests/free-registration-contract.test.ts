import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildFreeRegistrationEmailRedirect,
  buildFreeRegistrationRecoveryPath,
  isFreeRegistrationConfirmRequest,
  requestFreeRegistrationLink,
  resolveQuizCompletionDestination,
  type FreeRegistrationDependencies,
  type FreeRegistrationLead,
} from "../src/lib/auth/free-registration"
import { createFreeRegistrationPostHandler } from "../src/app/api/auth/free-registration/route"
import { classifyRoute } from "../src/lib/auth/route-classification"

const LEAD_ID = "11111111-1111-4111-8111-111111111111"
const SITE_URL = "https://app.test"

type Recorder = {
  sent: { email: string; emailRedirectTo: string }[]
  leadEmailWrites: { leadId: string; email: string }[]
  rateLimitKeys: string[]
}

function createDeps(
  overrides: Partial<FreeRegistrationDependencies> & { lead?: FreeRegistrationLead | null } = {},
): { deps: FreeRegistrationDependencies; recorder: Recorder } {
  const recorder: Recorder = { sent: [], leadEmailWrites: [], rateLimitKeys: [] }
  const lead: FreeRegistrationLead | null =
    overrides.lead === undefined
      ? { id: LEAD_ID, email: "lena@example.com", quizKind: "personal_plan", userId: null }
      : overrides.lead
  const mutableLead = lead ? { ...lead } : null

  const deps: FreeRegistrationDependencies = {
    siteUrl: SITE_URL,
    async checkRateLimit(identifier) {
      recorder.rateLimitKeys.push(identifier)
      return { allowed: true }
    },
    async loadLead() {
      return mutableLead
    },
    async updateLeadEmail(leadId, email) {
      recorder.leadEmailWrites.push({ leadId, email })
      if (mutableLead) mutableLead.email = email
    },
    async checkEmailDeliverability(email) {
      return { ok: true, normalized: email }
    },
    async sendMagicLink(input) {
      recorder.sent.push(input)
      return { error: null }
    },
    ...overrides,
  }
  return { deps, recorder }
}

test("the free-registration link points /auth/confirm at the exact lead and the /scan landing", () => {
  assert.equal(
    buildFreeRegistrationEmailRedirect(SITE_URL, LEAD_ID),
    `https://app.test/auth/confirm?free=1&lead=${LEAD_ID}&next=%2Fscan`,
  )
  // Trailing slashes on the configured site URL must not double up.
  assert.equal(
    buildFreeRegistrationEmailRedirect(`${SITE_URL}/`, LEAD_ID),
    `https://app.test/auth/confirm?free=1&lead=${LEAD_ID}&next=%2Fscan`,
  )
  assert.equal(
    isFreeRegistrationConfirmRequest(new URLSearchParams(`free=1&lead=${LEAD_ID}`)),
    true,
  )
  assert.equal(isFreeRegistrationConfirmRequest(new URLSearchParams(`lead=${LEAD_ID}`)), false)
  assert.equal(
    buildFreeRegistrationRecoveryPath(LEAD_ID),
    `/registrierung?lead=${LEAD_ID}&error=link_expired`,
  )
  assert.equal(buildFreeRegistrationRecoveryPath("not-a-uuid"), "/registrierung?error=link_expired")
})

test("flag off keeps the quiz-completion destination byte-identical; flag on routes to registration", () => {
  assert.equal(
    resolveQuizCompletionDestination({ leadId: LEAD_ID, freemiumScannerFirstEnabled: false }),
    `/result/${LEAD_ID}/reveal`,
  )
  assert.equal(
    resolveQuizCompletionDestination({ leadId: LEAD_ID, freemiumScannerFirstEnabled: true }),
    "/registrierung",
  )
})

test("a first send goes to the lead's own address and never rewrites the lead", async () => {
  const { deps, recorder } = createDeps()
  const result = await requestFreeRegistrationLink({ leadId: LEAD_ID }, deps)

  assert.deepEqual(result, { outcome: "sent", email: "lena@example.com", corrected: false })
  assert.equal(recorder.sent.length, 1)
  assert.equal(recorder.sent[0].email, "lena@example.com")
  assert.equal(recorder.leadEmailWrites.length, 0)
  assert.deepEqual(recorder.rateLimitKeys, [LEAD_ID])
})

test("resend re-sends to the same address (rate limit consulted every time)", async () => {
  const { deps, recorder } = createDeps()
  await requestFreeRegistrationLink({ leadId: LEAD_ID }, deps)
  const second = await requestFreeRegistrationLink({ leadId: LEAD_ID }, deps)

  assert.equal(second.outcome, "sent")
  assert.equal(recorder.sent.length, 2)
  assert.deepEqual(recorder.rateLimitKeys, [LEAD_ID, LEAD_ID])
})

test("correction rewrites the still-unclaimed lead so the confirm-time lead binding keeps matching", async () => {
  const { deps, recorder } = createDeps()
  const result = await requestFreeRegistrationLink(
    { leadId: LEAD_ID, email: "  Lena.Neu@Example.com " },
    deps,
  )

  assert.deepEqual(result, { outcome: "sent", email: "lena.neu@example.com", corrected: true })
  assert.deepEqual(recorder.leadEmailWrites, [{ leadId: LEAD_ID, email: "lena.neu@example.com" }])
  assert.equal(recorder.sent[0].email, "lena.neu@example.com")
})

test("re-submitting the same address is a resend, not a correction", async () => {
  const { deps, recorder } = createDeps()
  const result = await requestFreeRegistrationLink(
    { leadId: LEAD_ID, email: "LENA@example.com " },
    deps,
  )

  assert.equal(result.outcome, "sent")
  assert.equal(recorder.leadEmailWrites.length, 0)
})

test("an undeliverable correction address is rejected before the lead is rewritten", async () => {
  const { deps, recorder } = createDeps({
    async checkEmailDeliverability() {
      return { ok: false, reason: "no_mx", suggestion: "lena@example.com" }
    },
  })
  const result = await requestFreeRegistrationLink(
    { leadId: LEAD_ID, email: "lena@examplle.com" },
    deps,
  )

  assert.deepEqual(result, {
    outcome: "undeliverable_email",
    reason: "no_mx",
    suggestion: "lena@example.com",
  })
  assert.equal(recorder.leadEmailWrites.length, 0)
  assert.equal(recorder.sent.length, 0)
})

test("a lead that already belongs to an account can no longer be re-pointed", async () => {
  const { deps, recorder } = createDeps({
    lead: {
      id: LEAD_ID,
      email: "lena@example.com",
      quizKind: "personal_plan",
      userId: "99999999-9999-4999-8999-999999999999",
    },
  })
  const result = await requestFreeRegistrationLink(
    { leadId: LEAD_ID, email: "angreifer@example.com" },
    deps,
  )

  assert.deepEqual(result, { outcome: "lead_claimed" })
  assert.equal(recorder.leadEmailWrites.length, 0)
  assert.equal(recorder.sent.length, 0)
})

test("legacy-quiz leads and missing leads are indistinguishable to the caller", async () => {
  for (const lead of [
    null,
    { id: LEAD_ID, email: "lena@example.com", quizKind: "legacy" as const, userId: null },
  ]) {
    const { deps, recorder } = createDeps({ lead })
    const result = await requestFreeRegistrationLink({ leadId: LEAD_ID }, deps)
    assert.deepEqual(result, { outcome: "lead_not_found" })
    assert.equal(recorder.sent.length, 0)
  }
})

test("malformed input never reaches the rate limiter or the lead lookup", async () => {
  const { deps, recorder } = createDeps()
  for (const request of [
    { leadId: "nope" },
    { leadId: 42 },
    { leadId: LEAD_ID, email: "keine-adresse" },
    { leadId: LEAD_ID, email: 7 },
  ]) {
    assert.deepEqual(await requestFreeRegistrationLink(request, deps), {
      outcome: "invalid_request",
    })
  }
  assert.equal(recorder.rateLimitKeys.length, 0)
  assert.equal(recorder.sent.length, 0)
})

test("rate limiting and an unavailable limiter are distinguished", async () => {
  const limited = createDeps({
    async checkRateLimit() {
      return { allowed: false }
    },
  })
  assert.deepEqual(await requestFreeRegistrationLink({ leadId: LEAD_ID }, limited.deps), {
    outcome: "rate_limited",
  })
  assert.equal(limited.recorder.sent.length, 0)

  const unavailable = createDeps({
    async checkRateLimit() {
      return { allowed: false, error: "service_unavailable" }
    },
  })
  assert.deepEqual(await requestFreeRegistrationLink({ leadId: LEAD_ID }, unavailable.deps), {
    outcome: "rate_limit_unavailable",
  })
})

test("a failed OTP send surfaces as send_failed", async () => {
  const { deps } = createDeps({
    async sendMagicLink() {
      return { error: new Error("supabase down") }
    },
  })
  assert.deepEqual(await requestFreeRegistrationLink({ leadId: LEAD_ID }, deps), {
    outcome: "send_failed",
  })
})

test("the endpoint is dark while the flag is off and speaks HTTP codes when on", async () => {
  const { deps } = createDeps()

  const dark = createFreeRegistrationPostHandler({ ...deps, isEnabled: () => false })
  const darkResponse = await dark(
    new Request("https://app.test/api/auth/free-registration", {
      method: "POST",
      body: JSON.stringify({ leadId: LEAD_ID }),
    }),
  )
  assert.equal(darkResponse.status, 404)

  const live = createFreeRegistrationPostHandler({ ...deps, isEnabled: () => true })
  const ok = await live(
    new Request("https://app.test/api/auth/free-registration", {
      method: "POST",
      body: JSON.stringify({ leadId: LEAD_ID }),
    }),
  )
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), { ok: true, email: "lena@example.com", corrected: false })

  const badJson = await live(
    new Request("https://app.test/api/auth/free-registration", { method: "POST", body: "{" }),
  )
  assert.equal(badJson.status, 400)

  const claimed = createFreeRegistrationPostHandler({
    ...createDeps({
      lead: {
        id: LEAD_ID,
        email: "lena@example.com",
        quizKind: "personal_plan",
        userId: "99999999-9999-4999-8999-999999999999",
      },
    }).deps,
    isEnabled: () => true,
  })
  const claimedResponse = await claimed(
    new Request("https://app.test/api/auth/free-registration", {
      method: "POST",
      body: JSON.stringify({ leadId: LEAD_ID }),
    }),
  )
  assert.equal(claimedResponse.status, 409)
  assert.equal((await claimedResponse.json()).code, "lead_claimed")
})

test("an unexpected persistence failure is a 500, never a silent success", async () => {
  const { deps } = createDeps({
    async loadLead() {
      throw new Error("db down")
    },
  })
  const handler = createFreeRegistrationPostHandler({ ...deps, isEnabled: () => true })
  const response = await handler(
    new Request("https://app.test/api/auth/free-registration", {
      method: "POST",
      body: JSON.stringify({ leadId: LEAD_ID }),
    }),
  )
  assert.equal(response.status, 500)
})

test("the new surfaces are classified — reachable before an account exists", () => {
  const production = { nodeEnv: "production", localDevLoginEnabled: false }
  assert.equal(classifyRoute("/registrierung", production), "public")
  assert.equal(classifyRoute("/api/auth/free-registration", production), "public")
})

test("field-test and moderator completions keep the paid reveal even with the flag on", () => {
  const quiz = readFileSync("src/components/personal-plan-quiz/personal-plan-quiz.tsx", "utf8")
  assert.match(
    quiz,
    /const freeRegistrationFunnel = freemiumScannerFirst && !fieldTest && !moderator/,
  )
  assert.match(
    quiz,
    /router\.push\(resolveQuizCompletionNavigation\(leadId, email, freeRegistrationFunnel\)\)/,
  )
})

test("the payment-activation magic-link route stays payment-only and untouched by T18", () => {
  const source = readFileSync("src/app/api/auth/send-magic-link/route.ts", "utf8")

  // The free path is the ONLY `shouldCreateUser: true` sender. Payment
  // activation must never create accounts, and must never import the free
  // registration contract.
  assert.ok(source.includes("shouldCreateUser: false"))
  assert.ok(!source.includes("shouldCreateUser: true"))
  assert.ok(!source.includes("free-registration"))
  assert.ok(!source.includes("provisionFreeInitialSnapshot"))
  assert.ok(source.includes("verifyCheckoutSessionForActivation"))
})
