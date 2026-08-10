import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import {
  createPersonalPlanFieldTestCampaignCookie,
  decodePersonalPlanFieldTestCampaignCookie,
  evaluatePersonalPlanFieldTestCampaign,
  hashPersonalPlanFieldTestToken,
  issuePersonalPlanFieldTestToken,
  personalPlanFieldTestCampaignCookieOptions,
  PERSONAL_PLAN_FIELD_TEST_ACCESS_DURATION_HOURS,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_MAX_ACTIVATIONS,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_DAYS,
  PERSONAL_PLAN_FIELD_TEST_UNAVAILABLE_CODE,
  verifyPersonalPlanFieldTestToken,
} from "../src/lib/personal-plan-field-test"

const secret = "personal-plan-field-test-cookie-secret-32-plus"
const campaignId = "10000000-0000-4000-8000-000000000001"
const now = Date.UTC(2026, 7, 10, 10, 0, 0)

test("field-test tokens are independent 256-bit opaque credentials stored as SHA-256 hashes", () => {
  const first = issuePersonalPlanFieldTestToken()
  const second = issuePersonalPlanFieldTestToken()

  assert.equal(first.token.length >= 43, true)
  assert.notEqual(first.token, second.token)
  assert.equal(first.tokenHash, hashPersonalPlanFieldTestToken(first.token))
  assert.equal(first.tokenHash, createHash("sha256").update(first.token, "utf8").digest("hex"))
  assert.equal(verifyPersonalPlanFieldTestToken(first.token, first.tokenHash), true)
  assert.equal(verifyPersonalPlanFieldTestToken(second.token, first.tokenHash), false)
  assert.equal(verifyPersonalPlanFieldTestToken(first.token, "not-a-hash"), false)
})

test("field-test campaign cookies are signed, HttpOnly, and contain only trusted campaign context", () => {
  const value = createPersonalPlanFieldTestCampaignCookie(
    {
      campaignId,
      accessDurationHours: 168,
      issuedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    },
    secret,
  )

  assert.ok(value)
  assert.deepEqual(decodePersonalPlanFieldTestCampaignCookie(value, secret, now), {
    campaignId,
    accessDurationHours: 168,
    testKind: "field_test",
    issuedAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
  })
  assert.equal(decodePersonalPlanFieldTestCampaignCookie(`${value}x`, secret, now), null)
  assert.equal(decodePersonalPlanFieldTestCampaignCookie(value, "wrong-secret", now), null)
  assert.equal(
    decodePersonalPlanFieldTestCampaignCookie(value, secret, now + 31 * 24 * 60 * 60 * 1000),
    null,
  )
  assert.equal(PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE, "chaarlie_personal_plan_field_test")
  assert.equal(personalPlanFieldTestCampaignCookieOptions.httpOnly, true)
  assert.equal(personalPlanFieldTestCampaignCookieOptions.sameSite, "lax")
  assert.equal(personalPlanFieldTestCampaignCookieOptions.path, "/")
  assert.equal(personalPlanFieldTestCampaignCookieOptions.maxAge, 30 * 24 * 60 * 60)
})

test("campaign lifecycle fails closed with one generic unavailable outcome", () => {
  const eligible = evaluatePersonalPlanFieldTestCampaign(
    {
      id: campaignId,
      status: "active",
      startsAt: now - 1,
      expiresAt: now + 1,
      maxActivations: 100,
      successfulActivations: 99,
      accessDurationHours: 168,
    },
    now,
  )
  assert.deepEqual(eligible, {
    kind: "eligible",
    context: { campaignId, accessDurationHours: 168, testKind: "field_test" },
  })

  for (const campaign of [
    { status: "revoked" as const },
    { startsAt: now + 1 },
    { expiresAt: now },
    { successfulActivations: 100 },
    { maxActivations: 0 },
    { accessDurationHours: 0 },
  ]) {
    assert.deepEqual(
      evaluatePersonalPlanFieldTestCampaign(
        {
          id: campaignId,
          status: "active",
          startsAt: now - 1,
          expiresAt: now + 1,
          maxActivations: 100,
          successfulActivations: 99,
          accessDurationHours: 168,
          ...campaign,
        },
        now,
      ),
      { kind: "unavailable", code: PERSONAL_PLAN_FIELD_TEST_UNAVAILABLE_CODE },
    )
  }
})

test("field-test defaults preserve the approved campaign and access windows", () => {
  assert.equal(PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_DAYS, 30)
  assert.equal(PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_MAX_ACTIVATIONS, 100)
  assert.equal(PERSONAL_PLAN_FIELD_TEST_ACCESS_DURATION_HOURS, 168)
})
