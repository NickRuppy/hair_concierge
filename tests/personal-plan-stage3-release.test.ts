import assert from "node:assert/strict"
import test from "node:test"

import { isPersonalPlanStage3LabEnabled } from "../src/lib/labs/personal-plan-stage3-access"
import {
  canAccessPersonalPlanAppV1Rollout,
  getPersonalPlanNewBuyerCohortCutoff,
  isPersonalPlanAppV1Enabled,
  isPersonalPlanLegacyQuizCutoverEnabled,
  isPersonalPlanStage2Enabled,
  isPersonalPlanStage3Enabled,
  resolvePersonalPlanAppV1Rollout,
  resolvePersonalPlanAppV1InternalEmails,
} from "../src/lib/personal-plan/release"

test("the released Personal Plan app ignores obsolete launch flags", () => {
  assert.equal(isPersonalPlanAppV1Enabled({ PERSONAL_PLAN_APP_V1_ENABLED: "true" }), true)
  assert.equal(isPersonalPlanAppV1Enabled({ PERSONAL_PLAN_APP_V1_ENABLED: "false" }), true)
  assert.equal(isPersonalPlanAppV1Enabled({}), true)
})

test("the legacy-quiz Personal Plan cutover is independently strict and default-off", () => {
  assert.equal(isPersonalPlanLegacyQuizCutoverEnabled({}), false)
  assert.equal(
    isPersonalPlanLegacyQuizCutoverEnabled({
      PERSONAL_PLAN_LEGACY_QUIZ_CUTOVER_ENABLED: "TRUE",
    }),
    false,
  )
  assert.equal(
    isPersonalPlanLegacyQuizCutoverEnabled({
      PERSONAL_PLAN_LEGACY_QUIZ_CUTOVER_ENABLED: "true",
    }),
    true,
  )
})

test("the released Personal Plan rollout is all and ignores obsolete cohort flags", () => {
  assert.equal(resolvePersonalPlanAppV1Rollout({}), "all")
  assert.equal(resolvePersonalPlanAppV1Rollout({ PERSONAL_PLAN_APP_V1_ENABLED: "true" }), "all")

  assert.deepEqual(
    [
      ...resolvePersonalPlanAppV1InternalEmails({
        PERSONAL_PLAN_APP_V1_INTERNAL_EMAILS:
          " Nick+Plan@Example.com,invalid, nick+plan@example.com ",
      }),
    ],
    ["nick+plan@example.com"],
  )
  assert.equal(
    resolvePersonalPlanAppV1Rollout({
      PERSONAL_PLAN_APP_V1_ENABLED: "true",
      PERSONAL_PLAN_APP_V1_ROLLOUT: "internal",
    }),
    "all",
  )
  assert.equal(
    resolvePersonalPlanAppV1Rollout({
      PERSONAL_PLAN_APP_V1_ENABLED: "true",
      PERSONAL_PLAN_APP_V1_ROLLOUT: "invalid",
    }),
    "all",
  )

  assert.equal(
    canAccessPersonalPlanAppV1Rollout({ appEnabled: true, rollout: "internal", isInternal: true }),
    true,
  )
  assert.equal(
    canAccessPersonalPlanAppV1Rollout({ appEnabled: true, rollout: "internal", isInternal: false }),
    false,
  )
  assert.equal(
    canAccessPersonalPlanAppV1Rollout({ appEnabled: false, rollout: "all", isInternal: true }),
    false,
  )
})

test("released Stage 2 and Stage 3 ignore obsolete launch flags", () => {
  for (const [reader, key] of [
    [isPersonalPlanStage2Enabled, "PERSONAL_PLAN_STAGE2_ENABLED"],
    [isPersonalPlanStage3Enabled, "PERSONAL_PLAN_STAGE3_ENABLED"],
  ] as const) {
    assert.equal(reader({}), true)
    assert.equal(reader({ [key]: "false" }), true)
    assert.equal(reader({ [key]: "TRUE" }), true)
    assert.equal(reader({ [key]: "true" }), true)
  }
})

test("new-buyer cutoff accepts only real ISO-8601 UTC instants", () => {
  assert.equal(getPersonalPlanNewBuyerCohortCutoff({}), null)
  assert.equal(
    getPersonalPlanNewBuyerCohortCutoff({
      PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF: "2026-08-08T00:00:00Z",
    })?.toISOString(),
    "2026-08-08T00:00:00.000Z",
  )
  assert.equal(
    getPersonalPlanNewBuyerCohortCutoff({
      PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF: "2026-08-08T00:00:00.125Z",
    })?.toISOString(),
    "2026-08-08T00:00:00.125Z",
  )
  for (const value of [
    "2026-08-08",
    "2026-08-08T00:00:00+02:00",
    "2026-02-30T00:00:00Z",
    "not-a-date",
  ]) {
    assert.equal(
      getPersonalPlanNewBuyerCohortCutoff({
        PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF: value,
      }),
      null,
      value,
    )
  }
})

test("Stage 3 fixture lab is available only in dev, Preview, or explicitly flagged CI", () => {
  assert.equal(isPersonalPlanStage3LabEnabled({ NODE_ENV: "development" }), true)
  assert.equal(
    isPersonalPlanStage3LabEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    true,
  )
  assert.equal(
    isPersonalPlanStage3LabEnabled({
      CI: "true",
      CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED: "true",
      NODE_ENV: "production",
    }),
    true,
  )
  assert.equal(
    isPersonalPlanStage3LabEnabled({
      CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED: "true",
      NODE_ENV: "production",
    }),
    false,
  )
  assert.equal(isPersonalPlanStage3LabEnabled({ CI: "true", NODE_ENV: "production" }), false)
  assert.equal(
    isPersonalPlanStage3LabEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }),
    false,
  )
})
