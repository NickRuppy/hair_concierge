import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  PERSONAL_PLAN_PRICING_EXPERIMENT,
  assignPersonalPlanPricingExperimentVariant,
  isPersonalPlanPricingExperimentVariant,
  resolvePersonalPlanPricingMode,
} from "../src/lib/funnel/personal-plan-pricing-experiment"
import {
  isPersonalPlanLaunchPricingEnabled,
  isPersonalPlanPricingExperimentEnabled,
} from "../src/lib/funnel/flags"
import {
  createPersonalPlanOneTimeQaToken,
  verifyPersonalPlanOneTimeQaToken,
} from "../src/lib/funnel/personal-plan-pricing-qa-token"
import {
  assertPersonalPlanOneTimeCheckoutAuthorized,
  assignPersonalPlanOneTimeQa,
  PersonalPlanOneTimeCheckoutAuthorizationError,
  resolvePersonalPlanPricingExperiment,
} from "../src/lib/funnel/server"

const leadId = "10000000-0000-4000-8000-000000000001"
const sessionId = "20000000-0000-4000-8000-000000000002"

test("personal-plan pricing allocation is deterministic and has exclusive pricing modes", () => {
  const arm = assignPersonalPlanPricingExperimentVariant(sessionId)
  assert.equal(arm, assignPersonalPlanPricingExperimentVariant(sessionId))
  assert.ok(isPersonalPlanPricingExperimentVariant(arm))
  assert.equal(
    isPersonalPlanPricingExperimentVariant(PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant),
    false,
  )
  assert.equal(
    resolvePersonalPlanPricingMode(PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant),
    "membership",
  )
  assert.equal(resolvePersonalPlanPricingMode("personal-plan-one-time-v1"), "one_time")
  assert.equal(resolvePersonalPlanPricingMode("personal-plan-membership-v1"), "membership")
})

test("personal-plan pricing experiment flag is enabled only by exact true", () => {
  const previous = process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED
  try {
    delete process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED
    assert.equal(isPersonalPlanPricingExperimentEnabled(), false)
    process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED = "TRUE"
    assert.equal(isPersonalPlanPricingExperimentEnabled(), false)
    process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED = "true"
    assert.equal(isPersonalPlanPricingExperimentEnabled(), true)
  } finally {
    if (previous === undefined) delete process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED
    else process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED = previous
  }
})

test("personal-plan launch pricing flag defaults off and enables only for exact true", () => {
  const previous = process.env.PERSONAL_PLAN_LAUNCH_PRICING_ENABLED
  try {
    delete process.env.PERSONAL_PLAN_LAUNCH_PRICING_ENABLED
    assert.equal(isPersonalPlanLaunchPricingEnabled(), false)
    process.env.PERSONAL_PLAN_LAUNCH_PRICING_ENABLED = "TRUE"
    assert.equal(isPersonalPlanLaunchPricingEnabled(), false)
    process.env.PERSONAL_PLAN_LAUNCH_PRICING_ENABLED = "true"
    assert.equal(isPersonalPlanLaunchPricingEnabled(), true)
  } finally {
    if (previous === undefined) delete process.env.PERSONAL_PLAN_LAUNCH_PRICING_ENABLED
    else process.env.PERSONAL_PLAN_LAUNCH_PRICING_ENABLED = previous
  }
})

test("QA token helper defaults to a five-minute TTL when the option is omitted", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      fileURLToPath(
        new URL("../scripts/create-personal-plan-one-time-qa-token.ts", import.meta.url),
      ),
      "--lead-id",
      leadId,
      "--session-id",
      sessionId,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PERSONAL_PLAN_ONE_TIME_QA_SIGNING_SECRET: "test-secret",
      },
    },
  )
  assert.equal(result.status, 0, result.stderr)
  const claims = JSON.parse(
    Buffer.from(result.stdout.split(".")[0], "base64url").toString("utf8"),
  ) as { exp: number; iat: number }
  assert.equal(claims.exp - claims.iat, 300)
})

test("personal-plan resolver uses the historical base for disabled, missing, viewed-base, and ineligible sessions", async () => {
  const base = PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant
  assert.equal(await resolvePersonalPlanPricingExperiment({ enabled: true, session: null }), base)
  assert.equal(
    await resolvePersonalPlanPricingExperiment({
      enabled: true,
      session: {
        sessionId,
        packageKey: "default_organic",
        offerVariant: base,
        offerViewedAt: null,
      },
    }),
    base,
  )
  assert.equal(
    await resolvePersonalPlanPricingExperiment({
      enabled: true,
      session: {
        sessionId,
        packageKey: "meta_personal_plan_v1",
        offerVariant: "unexpected-offer",
        offerViewedAt: null,
      },
    }),
    base,
  )
  assert.equal(
    await resolvePersonalPlanPricingExperiment({
      enabled: false,
      session: {
        sessionId,
        packageKey: "meta_personal_plan_v1",
        offerVariant: base,
        offerViewedAt: null,
      },
    }),
    base,
  )
  assert.equal(
    await resolvePersonalPlanPricingExperiment({
      enabled: true,
      session: {
        sessionId,
        packageKey: "meta_personal_plan_v1",
        offerVariant: base,
        offerViewedAt: "2026-07-31T10:00:00Z",
      },
    }),
    base,
  )
})

test("personal-plan resolver persists an enabled unviewed assignment against the base identity", async () => {
  let write: string | null = null
  let updateId: string | null = null
  let offerViewedAtGuard: unknown = "unset"
  let storedVariantGuard: string | null = null
  const client = {
    from: () => ({
      update: (values: { offer_variant: string }) => {
        write = values.offer_variant
        return {
          eq: (column: string, value: string) => {
            updateId = column === "id" ? value : null
            return {
              is: (guardColumn: string, guardValue: null) => {
                offerViewedAtGuard = guardColumn === "offer_viewed_at" ? guardValue : "wrong-column"
                return {
                  eq: (variantColumn: string, variantValue: string) => {
                    storedVariantGuard =
                      variantColumn === "offer_variant" ? variantValue : "wrong-column"
                    return {
                      select: () => ({
                        maybeSingle: async () => ({
                          data: { offer_variant: values.offer_variant },
                          error: null,
                        }),
                      }),
                    }
                  },
                }
              },
            }
          },
        }
      },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  }
  const assigned = await resolvePersonalPlanPricingExperiment({
    enabled: true,
    client: client as never,
    session: {
      sessionId,
      packageKey: "meta_personal_plan_v1",
      offerVariant: "personal-plan-v1",
      offerViewedAt: null,
    },
  })
  assert.equal(write, assigned)
  assert.ok(isPersonalPlanPricingExperimentVariant(assigned))
  assert.equal(updateId, sessionId)
  assert.equal(offerViewedAtGuard, null)
  assert.equal(storedVariantGuard, PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant)
})

test("viewed, checkout-started, internal, and enabled treatment assignments remain sticky", async () => {
  for (const session of [
    {
      sessionId,
      packageKey: "meta_personal_plan_v1",
      offerVariant: "personal-plan-one-time-v1",
      offerViewedAt: "2026-07-31T10:00:00Z",
    },
    {
      sessionId,
      packageKey: "meta_personal_plan_v1",
      offerVariant: "personal-plan-one-time-v1",
      offerViewedAt: null,
      checkoutStartedAt: "2026-07-31T10:00:00Z",
    },
    {
      sessionId,
      packageKey: "meta_personal_plan_v1",
      offerVariant: "personal-plan-one-time-v1",
      offerViewedAt: null,
      isInternalTest: true,
    },
  ]) {
    assert.equal(
      await resolvePersonalPlanPricingExperiment({ enabled: false, session }),
      "personal-plan-one-time-v1",
    )
  }
  assert.equal(
    await resolvePersonalPlanPricingExperiment({
      enabled: true,
      session: {
        sessionId,
        packageKey: "meta_personal_plan_v1",
        offerVariant: "personal-plan-membership-v1",
        offerViewedAt: null,
      },
    }),
    "personal-plan-membership-v1",
  )
})

test("disabling the experiment rolls an unviewed treatment back to personal-plan-v1", async () => {
  let updateValue: string | null = null
  let storedVariantGuard: string | null = null
  const client = {
    from: () => ({
      update: (values: { offer_variant: string }) => ({
        eq: () => ({
          is: () => ({
            eq: (_column: string, value: string) => {
              updateValue = values.offer_variant
              storedVariantGuard = value
              return {
                select: () => ({
                  maybeSingle: async () => ({
                    data: { offer_variant: values.offer_variant },
                    error: null,
                  }),
                }),
              }
            },
          }),
        }),
      }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  }
  const resolved = await resolvePersonalPlanPricingExperiment({
    enabled: false,
    client: client as never,
    session: {
      sessionId,
      packageKey: "meta_personal_plan_v1",
      offerVariant: "personal-plan-one-time-v1",
      offerViewedAt: null,
    },
  })

  assert.equal(resolved, PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant)
  assert.equal(updateValue, PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant)
  assert.equal(storedVariantGuard, "personal-plan-one-time-v1")
})

test("personal-plan rollback reads a concurrent winner and falls back to base on persistence failure", async () => {
  const raceClient = {
    from: () => ({
      update: () => ({
        eq: () => ({
          is: () => ({
            eq: () => ({
              select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { offer_variant: "personal-plan-membership-v1" },
            error: null,
          }),
        }),
      }),
    }),
  }
  const session = {
    sessionId,
    packageKey: "meta_personal_plan_v1",
    offerVariant: "personal-plan-one-time-v1",
    offerViewedAt: null,
  }
  assert.equal(
    await resolvePersonalPlanPricingExperiment({
      enabled: false,
      client: raceClient as never,
      session,
    }),
    "personal-plan-membership-v1",
  )

  let capturedFallback: string | null = null
  const errorClient = {
    from: () => ({
      update: () => ({
        eq: () => ({
          is: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: null, error: new Error("unavailable") }),
              }),
            }),
          }),
        }),
      }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  }
  assert.equal(
    await resolvePersonalPlanPricingExperiment({
      enabled: false,
      client: errorClient as never,
      captureFailure: (_error, details) => {
        capturedFallback = details.fallbackVariant
      },
      session,
    }),
    PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant,
  )
  assert.equal(capturedFallback, PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant)
})

test("assignment races use the persisted winner while assignment failures stay on the base", async () => {
  const session = {
    sessionId,
    packageKey: "meta_personal_plan_v1",
    offerVariant: PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant,
    offerViewedAt: null,
  }
  const raceClient = {
    from: () => ({
      update: () => ({
        eq: () => ({
          is: () => ({
            eq: () => ({
              select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { offer_variant: "personal-plan-one-time-v1" },
            error: null,
          }),
        }),
      }),
    }),
  }
  assert.equal(
    await resolvePersonalPlanPricingExperiment({
      enabled: true,
      client: raceClient as never,
      session,
    }),
    "personal-plan-one-time-v1",
  )

  let capturedFallback: string | null = null
  const errorClient = {
    from: () => ({
      update: () => ({
        eq: () => ({
          is: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: null, error: new Error("unavailable") }),
              }),
            }),
          }),
        }),
      }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  }
  assert.equal(
    await resolvePersonalPlanPricingExperiment({
      enabled: true,
      client: errorClient as never,
      captureFailure: (_error, details) => {
        capturedFallback = details.fallbackVariant
      },
      session,
    }),
    PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant,
  )
  assert.equal(capturedFallback, PERSONAL_PLAN_PRICING_EXPERIMENT.baseVariant)
})

test("QA token validation binds the atomic assignment to one lead/session/package", async () => {
  const secret = "test-secret"
  const token = createPersonalPlanOneTimeQaToken({
    secret,
    leadId,
    sessionId,
    packageKey: "meta_personal_plan_v1",
    arm: "personal-plan-one-time-v1",
    now: 1_000,
    ttlSeconds: 120,
    jti: "30000000-0000-4000-8000-000000000003",
  })
  assert.equal(verifyPersonalPlanOneTimeQaToken(token, secret, 1_050)?.leadId, leadId)
  assert.equal(verifyPersonalPlanOneTimeQaToken(token, "wrong", 1_050), null)
  assert.equal(verifyPersonalPlanOneTimeQaToken(token, secret, 1_200), null)
  let args: Record<string, unknown> | null = null
  assert.equal(
    await assignPersonalPlanOneTimeQa({
      enabled: true,
      secret,
      now: 1_050,
      token,
      leadId,
      session: {
        sessionId,
        packageKey: "meta_personal_plan_v1",
        offerVariant: "personal-plan-v1",
        offerViewedAt: null,
      },
      rpc: async (input) => {
        args = input
        return { data: true, error: null }
      },
    }),
    true,
  )
  assert.deepEqual(args, {
    p_lead_id: leadId,
    p_session_id: sessionId,
    p_package_key: "meta_personal_plan_v1",
    p_arm: "personal-plan-one-time-v1",
  })
})

test("one-time checkout authorization uses only the canonical stored session", async () => {
  const canonical = {
    id: sessionId,
    lead_id: leadId,
    visitor_id: "50000000-0000-4000-8000-000000000005",
    package_key: "meta_personal_plan_v1",
    offer_variant: "personal-plan-one-time-v1",
    offer_viewed_at: "2026-07-31T10:00:00Z",
    first_seen_at: "2026-07-31T09:30:00Z",
    is_internal_test: true,
  }
  assert.deepEqual(
    await assertPersonalPlanOneTimeCheckoutAuthorized({
      leadId,
      funnelSessionId: sessionId,
      fetchSession: async () => ({ data: canonical, error: null }),
    }),
    {
      sessionId,
      leadId,
      visitorId: "50000000-0000-4000-8000-000000000005",
      packageKey: "meta_personal_plan_v1",
      offerVariant: "personal-plan-one-time-v1",
      issuedAt: Date.parse("2026-07-31T09:30:00Z"),
      isInternalTest: true,
    },
  )
  for (const row of [
    { ...canonical, offer_variant: "personal-plan-membership-v1" },
    { ...canonical, lead_id: "10000000-0000-4000-8000-000000000004" },
    { ...canonical, offer_viewed_at: null },
  ]) {
    await assert.rejects(
      assertPersonalPlanOneTimeCheckoutAuthorized({
        leadId,
        funnelSessionId: sessionId,
        fetchSession: async () => ({ data: row, error: null }),
      }),
      /not authorized/,
    )
  }
})

test("one-time checkout authorization distinguishes lookup failure from expected denial", async () => {
  await assert.rejects(
    assertPersonalPlanOneTimeCheckoutAuthorized({
      leadId,
      funnelSessionId: sessionId,
      fetchSession: async () => ({ data: null, error: new Error("database unavailable") }),
    }),
    (error) =>
      error instanceof PersonalPlanOneTimeCheckoutAuthorizationError &&
      error.reason === "lookup_failed",
  )

  await assert.rejects(
    assertPersonalPlanOneTimeCheckoutAuthorized({
      leadId,
      funnelSessionId: sessionId,
      fetchSession: async () => ({ data: null, error: null }),
    }),
    (error) =>
      error instanceof PersonalPlanOneTimeCheckoutAuthorizationError &&
      error.reason === "not_authorized",
  )
})
