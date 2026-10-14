import assert from "node:assert/strict"
import test from "node:test"

import { buildCustomerIoPagePath } from "../src/providers/customerio-provider"
import {
  hasSensitiveBrowserAnalyticsLocation,
  sanitizeAnalyticsUrl,
} from "../src/lib/analytics/page-url"

test("Customer.io page paths preserve the canonical result identifier and entry context", () => {
  const searchParams = new URLSearchParams({ entry: "quiz_completion", focus: "routine" })

  assert.equal(
    buildCustomerIoPagePath("/result/lead-123", searchParams),
    "/result/lead-123?entry=quiz_completion&focus=routine",
  )
  assert.equal(
    buildCustomerIoPagePath("/result/lead-123", searchParams),
    "/result/lead-123?entry=quiz_completion&focus=routine",
  )
})

test("Customer.io page paths omit a trailing question mark without query parameters", () => {
  assert.equal(buildCustomerIoPagePath("/quiz", new URLSearchParams()), "/quiz")
  assert.equal(buildCustomerIoPagePath("/quiz", null), "/quiz")
})

test("Customer.io page paths remove credentials, identifiers, and nested return URLs", () => {
  const searchParams = new URLSearchParams({
    code: "recovery-code",
    email: "person@example.com",
    entry: "quiz_completion",
    focus: "unlock-plan",
    next: "/auth/update-password?code=nested-recovery-code",
    session_id: "stripe-session",
    token: "paypal-token",
  })

  assert.equal(
    buildCustomerIoPagePath("/result/lead-123", searchParams),
    "/result/lead-123?entry=quiz_completion&focus=unlock-plan",
  )
  assert.equal(buildCustomerIoPagePath("/auth", searchParams), "/auth")
})

test("Customer.io page paths reject arbitrary values under otherwise safe keys", () => {
  const searchParams = new URLSearchParams({
    entry: "person@example.com",
    focus: "/auth/update-password?code=recovery-code",
  })

  assert.equal(buildCustomerIoPagePath("/result/lead-123", searchParams), "/result/lead-123")
})

test("shared analytics URL sanitization removes sensitive queries and fragments", () => {
  assert.equal(
    sanitizeAnalyticsUrl(
      "https://chaarlie.de/auth/update-password?code=recovery-code#access_token=access-token",
    ),
    "https://chaarlie.de/auth/update-password",
  )
  assert.equal(
    sanitizeAnalyticsUrl(
      "https://chaarlie.de/result/lead-123?entry=quiz_completion&focus=routine&email=x",
    ),
    "https://chaarlie.de/result/lead-123?entry=quiz_completion&focus=routine",
  )
})

test("Meta page tracking recognizes credential-bearing browser locations", () => {
  assert.equal(
    hasSensitiveBrowserAnalyticsLocation(new URLSearchParams({ code: "recovery-code" })),
    true,
  )
  assert.equal(
    hasSensitiveBrowserAnalyticsLocation(new URLSearchParams({ session_id: "stripe-session" })),
    true,
  )
  assert.equal(hasSensitiveBrowserAnalyticsLocation(new URLSearchParams(), "#access_token=x"), true)
  assert.equal(
    hasSensitiveBrowserAnalyticsLocation(new URLSearchParams(), "#/auth?code=recovery-code"),
    true,
  )
  assert.equal(hasSensitiveBrowserAnalyticsLocation(new URLSearchParams(), "#pricing"), false)
  assert.equal(
    hasSensitiveBrowserAnalyticsLocation(new URLSearchParams({ utm_campaign: "launch" })),
    false,
  )
})
