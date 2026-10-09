import assert from "node:assert/strict"
import test from "node:test"
import {
  buildAuthenticatedAppRedirectUrl,
  hasActivePersonalPlanRoutineEntitlement,
  isPartnerAccessGuest,
} from "../src/lib/supabase/middleware"

test("authenticated auth routing strips auth-only error and token query material", () => {
  const redirected = buildAuthenticatedAppRedirectUrl(
    new URL(
      "https://chaarlie.de/auth?error=link_expired&reason=session_expired&code=secret&token=raw&token_hash=hashed&type=magiclink&next=%2Froutine&campaign=welcome",
    ),
    "/chat",
  )

  assert.equal(redirected.toString(), "https://chaarlie.de/chat")
})

test("authenticated auth routing keeps the allowed onboarding lead while removing auth-only query material", () => {
  const redirected = buildAuthenticatedAppRedirectUrl(
    new URL("https://chaarlie.de/auth?error=link_expired&lead=lead-1&code=secret"),
    "/onboarding",
  )

  assert.equal(redirected.toString(), "https://chaarlie.de/onboarding?lead=lead-1")
})

test("non-auth app routing does not silently strip ordinary route query parameters", () => {
  const redirected = buildAuthenticatedAppRedirectUrl(
    new URL("https://chaarlie.de/routine?reason=attention&next=%2Fanwendung"),
    "/quiz",
  )

  assert.equal(redirected.toString(), "https://chaarlie.de/quiz?reason=attention&next=%2Fanwendung")
})

test("Personal Plan routine entitlement accepts active one-time access", () => {
  assert.equal(
    hasActivePersonalPlanRoutineEntitlement({
      hasCurrentAppAccess: true,
      fieldTestGuest: false,
      oneTimeAccessState: "active",
    }),
    true,
  )
})

test("Personal Plan routine entitlement accepts only active field-test access", () => {
  assert.equal(
    hasActivePersonalPlanRoutineEntitlement({
      hasCurrentAppAccess: true,
      fieldTestGuest: true,
      oneTimeAccessState: "none",
    }),
    true,
  )
  assert.equal(
    hasActivePersonalPlanRoutineEntitlement({
      hasCurrentAppAccess: false,
      fieldTestGuest: true,
      oneTimeAccessState: "none",
    }),
    false,
  )
})

test("Personal Plan routine entitlement accepts an active email-bound moderator without guest metadata", () => {
  assert.equal(
    hasActivePersonalPlanRoutineEntitlement({
      hasCurrentAppAccess: false,
      fieldTestGuest: false,
      moderatorAccess: "active",
      oneTimeAccessState: "none",
    }),
    true,
  )
})

test("ordinary app access does not become Personal Plan routine entitlement", () => {
  assert.equal(
    hasActivePersonalPlanRoutineEntitlement({
      hasCurrentAppAccess: true,
      fieldTestGuest: false,
      oneTimeAccessState: "none",
    }),
    false,
  )
})

test("active partner accounts receive Personal Plan routine access", () => {
  assert.equal(isPartnerAccessGuest({ app_metadata: { access_kind: "partner" } }), true)
  assert.equal(
    isPartnerAccessGuest({
      app_metadata: {
        access_kind: "customer",
        partner_access_invitation_id: "10000000-0000-4000-8000-000000000001",
      },
    }),
    true,
  )
  assert.equal(isPartnerAccessGuest({ app_metadata: { access_kind: "customer" } }), false)
  assert.equal(
    hasActivePersonalPlanRoutineEntitlement({
      hasCurrentAppAccess: true,
      fieldTestGuest: false,
      partnerGuest: true,
      oneTimeAccessState: "none",
    }),
    true,
  )
  assert.equal(
    hasActivePersonalPlanRoutineEntitlement({
      hasCurrentAppAccess: false,
      fieldTestGuest: false,
      partnerGuest: true,
      oneTimeAccessState: "none",
    }),
    false,
  )
})
