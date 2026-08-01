import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  PERSONAL_PLAN_LAUNCH_PRICING_CATALOG,
  resolveSubscriptionPricingCatalog,
  STANDARD_PRICING_CATALOG,
} from "../src/lib/billing/pricing-catalog"

const read = (path: string) => readFileSync(path, "utf8")

const pageSource = read("src/app/reactivate/page.tsx")
const checkoutSource = read("src/components/reactivation/membership-reactivation-checkout.tsx")
const productionUiSource = read("src/components/reactivation/membership-reactivation-page.tsx")
const pricingRouteSource = read("src/app/pricing/page.tsx")
const middlewareSource = read("src/lib/supabase/middleware.ts")
const stripeRouteSource = read("src/app/api/stripe/create-checkout-session/route.ts")
const paypalRouteSource = read("src/app/api/paypal/create-subscription-intent/route.ts")
const profilePlanSwitcherSource = read("src/components/profile/profile-plan-switcher.tsx")
const reactivationPageSource = read("src/app/reactivate/page.tsx")
const migrationSource = read(
  "supabase/migrations/20260714200000_membership_reactivation_checkout_reservations.sql",
)

test("reactivation is a server-owned, fail-closed expired-member surface", () => {
  assert.match(pageSource, /hasCurrentAppAccess/)
  assert.match(pageSource, /if \(accessState === "active"\) redirect\(returnDestination\)/)
  assert.match(pageSource, /accessState = "uncertain"/)
  assert.match(pageSource, /showCheckout=\{accessState === "expired"\}/)
  assert.match(pageSource, /buildQuizAnswersFromHairProfile\(hairProfile\)/)
  assert.match(productionUiSource, /MembershipReactivationCheckout/)
  assert.match(productionUiSource, /starten wir vorsichtshalber keine Zahlung/)
  assert.match(
    reactivationPageSource,
    /resolveSubscriptionPricingCatalog\(isPersonalPlanLaunchPricingEnabled\(\)\)/,
  )
  assert.match(reactivationPageSource, /pricingCatalog=\{pricingCatalog\}/)
  assert.match(productionUiSource, /pricingCatalog=\{pricingCatalog\}/)
  assert.match(checkoutSource, /pricingCatalog=\{pricingCatalog\}/)
  assert.match(
    checkoutSource,
    /referencePrices=\{getSubscriptionPlanReferencePrices\(pricingCatalog\)\}/,
  )
})

test("reactivation uses the active acquisition catalog for new membership checkout", () => {
  assert.equal(resolveSubscriptionPricingCatalog(true), PERSONAL_PLAN_LAUNCH_PRICING_CATALOG)
  assert.equal(resolveSubscriptionPricingCatalog(false), STANDARD_PRICING_CATALOG)
})

test("membership reactivation uses one correlated attempt across both providers", () => {
  assert.match(checkoutSource, /createCheckoutAttemptController\(createFunnelEventId\)/)
  assert.match(checkoutSource, /const checkoutContext = "membership_reactivation"/)
  assert.match(checkoutSource, /checkoutAttemptId,/)
  assert.match(checkoutSource, /returnDestination,/)
  for (const routeSource of [stripeRouteSource, paypalRouteSource]) {
    assert.match(
      routeSource,
      /checkoutContext: z\.literal\("membership_reactivation"\)\.optional\(\)/,
    )
    assert.match(routeSource, /authenticated reactivation required/)
    assert.match(routeSource, /acquireMembershipReactivationCheckout/)
    assert.match(routeSource, /claimMembershipReactivationProvider/)
  }
})

test("the database atomically prevents competing reactivation checkouts", () => {
  assert.match(migrationSource, /UNIQUE \(user_id, checkout_attempt_id\)/)
  assert.match(migrationSource, /CREATE UNIQUE INDEX membership_reactivation_one_open_per_user/)
  assert.match(
    migrationSource,
    /WHERE status IN \('open', 'provider_selected', 'provider_created', 'reconciliation_required'\)/,
  )
  assert.match(migrationSource, /EXCEPTION WHEN unique_violation/)
  assert.match(migrationSource, /membership reactivation checkout already in progress/)
  assert.match(migrationSource, /expires_at <= now\(\)/)
  assert.match(
    stripeRouteSource,
    /idempotencyKey: `membership-reactivation:\$\{reactivationReservation\.id\}`/,
  )
  assert.match(paypalRouteSource, /createOrAdoptPayPalReactivationCheckoutIntent/)
  assert.match(paypalRouteSource, /resolveStoredPayPalCheckoutIntentPlan/)
})

test("definitively dead Stripe sessions release the reservation and rotate the client attempt", () => {
  assert.match(stripeRouteSource, /existingSession\.status === "expired"/)
  assert.match(stripeRouteSource, /isDefinitivelyMissingStripeResource/)
  assert.match(stripeRouteSource, /expireMembershipReactivationCheckoutReservation/)
  assert.match(stripeRouteSource, /reactivation_checkout_terminal/)
  assert.match(
    checkoutSource,
    /body\?\.error === "reactivation_checkout_terminal"[\s\S]*checkoutAttemptController\.close\(\)[\s\S]*checkoutAttemptController\.open\(\)/,
  )
})

test("pricing and protected routes converge on the dedicated reactivation boundary", () => {
  assert.match(
    pricingRouteSource,
    /redirect\(`\/result\/\$\{encodeURIComponent\(leadId\)\}\?focus=unlock-plan`\)/,
  )
  assert.match(pricingRouteSource, /if \(!user\) redirect\("\/quiz"\)/)
  assert.match(pricingRouteSource, /if \(active\) redirect\("\/profile#mitgliedschaft"\)/)
  assert.match(pricingRouteSource, /redirect\(`\/reactivate\?\$\{params\.toString\(\)\}`\)/)
  assert.match(middlewareSource, /url\.pathname = "\/reactivate"/)
  assert.match(middlewareSource, /error: "subscription_required"/)
  assert.match(middlewareSource, /error: "access_check_unavailable"/)
})

test("provider plan-change reconciliation remains retryable with the authoritative operation", () => {
  assert.match(profilePlanSwitcherSource, /Erneut abgleichen/)
  assert.match(profilePlanSwitcherSource, /state\.retryable/)
  assert.match(profilePlanSwitcherSource, /operationId: reconciliation\.operationId/)
  assert.match(profilePlanSwitcherSource, /targetInterval: reconciliation\.targetInterval/)
  assert.match(
    profilePlanSwitcherSource,
    /body\.error === "plan_change_failed"[\s\S]*onRefresh\(\)/,
  )
})
