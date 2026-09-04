import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function read(path: string) {
  return readFileSync(path, "utf8")
}

test("acquisition funnel keeps Meta, Customer.io, and PostHog tracking from landing through checkout success", () => {
  const trackingProviders = read("src/providers/tracking-providers.tsx")
  const routeProviders = read("src/providers/route-providers.tsx")
  assert.match(trackingProviders, /function LandingTracking\(\)/)
  assert.match(trackingProviders, /function PublicFlowProviders\(/)
  assert.match(routeProviders, /function PublicAuthFlowProviders\(/)
  assert.match(trackingProviders, /<MetaPixelProvider>/)
  assert.match(trackingProviders, /<CustomerIoProvider>/)
  assert.match(trackingProviders, /<PostHogClientProvider>/)
  assert.match(trackingProviders, /<AnalyticsRuntimeCoordinator \/>/)
  assert.doesNotMatch(trackingProviders, /auth-provider|useAuth|supabase/i)
  assert.match(routeProviders, /<CustomerIoIdentify \/>/)
  assert.match(routeProviders, /<PostHogIdentify \/>/)

  const landing = read("src/app/page.tsx")
  assert.match(landing, /<LandingTracking \/>/)
  assert.match(landing, /@\/providers\/tracking-providers/)
  const campaignLanding = read("src/app/lp/[slug]/page.tsx")
  assert.match(campaignLanding, /getFunnelPackageBySlug/)
  assert.match(
    campaignLanding,
    /renderLandingVariant\(funnelPackage\.landingVariant, \{[\s\S]*personalPlanQuizResume,[\s\S]*\}\)/,
  )
  assert.match(campaignLanding, /<LandingTracking \/>/)
  assert.match(campaignLanding, /\{landingVariant\}/)

  for (const path of [
    "src/app/auth/layout.tsx",
    "src/app/pricing/layout.tsx",
    "src/app/result/layout.tsx",
  ]) {
    assert.match(read(path), /<PublicFlowProviders>{children}<\/PublicFlowProviders>/, path)
    assert.match(read(path), /@\/providers\/tracking-providers/, path)
  }

  assert.match(
    read("src/app/welcome/layout.tsx"),
    /<PublicAuthFlowProviders>{children}<\/PublicAuthFlowProviders>/,
  )
  assert.match(read("src/app/quiz/layout.tsx"), /<QuizShell[^>]*>{children}<\/QuizShell>/)
  assert.match(read("src/app/quiz/quiz-shell.tsx"), /<AppRouteProviders>/)
})

test("public editorial context is isolated from the acquisition provider graph", () => {
  const shell = read("src/components/editorial/editorial-shell.tsx")
  const bootstrap = read("src/providers/public-funnel-context-bootstrap.tsx")

  assert.doesNotMatch(shell, /route-providers|LandingTracking/)
  assert.match(shell, /@\/providers\/public-funnel-context-bootstrap/)
  assert.match(bootstrap, /@\/lib\/funnel\/client/)
  assert.doesNotMatch(bootstrap, /posthog|customerio|meta-pixel|useAuth|supabase/i)
})

test("vendor SDKs stay behind post-paint dynamic import boundaries without consent gates", () => {
  const coordinator = read("src/providers/analytics-runtime-coordinator.tsx")
  const customerIoRuntime = read("src/lib/analytics/runtime/customerio.ts")
  const postHogRuntime = read("src/lib/analytics/runtime/posthog.ts")
  const trackingSources = [
    coordinator,
    customerIoRuntime,
    postHogRuntime,
    read("src/providers/customerio-provider.tsx"),
    read("src/providers/meta-pixel-provider.tsx"),
    read("src/providers/posthog-provider.tsx"),
    read("src/lib/customerio-tracking.ts"),
    read("src/lib/meta-pixel.ts"),
  ].join("\n")

  assert.match(coordinator, /scheduleAfterFirstPaint/)
  assert.match(customerIoRuntime, /import\("@customerio\/cdp-analytics-browser"\)/)
  assert.match(postHogRuntime, /import\("posthog-js"\)/)
  assert.doesNotMatch(postHogRuntime, /advanced_disable_flags: true/)
  assert.match(postHogRuntime, /advanced_disable_feature_flags: true/)
  assert.match(postHogRuntime, /advanced_disable_feature_flags_on_first_load: true/)
  assert.match(postHogRuntime, /before_send:/)
  assert.match(postHogRuntime, /maskCapturedNetworkRequestFn:/)
  assert.match(postHogRuntime, /NEXT_PUBLIC_POSTHOG_UNMASK_INPUTS/)
  assert.match(
    postHogRuntime,
    /maskInputOptions:\s*\{\s*email: true,\s*password: true,\s*tel: true/,
  )
  assert.match(postHogRuntime, /recordBody: false/)
  assert.match(postHogRuntime, /recordHeaders: false/)
  assert.doesNotMatch(postHogRuntime, /sanitize_properties:/)
  assert.doesNotMatch(customerIoRuntime, /from "@customerio\/cdp-analytics-browser"/)
  assert.doesNotMatch(postHogRuntime, /from "posthog-js"/)
  assert.doesNotMatch(trackingSources, /cookie-consent|COOKIE_CONSENT|loadConsent/)
})

test("landing quiz CTAs do not prefetch checkout-heavy quiz bundles", () => {
  for (const path of [
    "src/components/landing/landing-header.tsx",
    "src/components/landing/hero.tsx",
    "src/components/landing/how-it-works.tsx",
    "src/components/landing/final-cta.tsx",
    "src/components/landing/sticky-quiz-cta.tsx",
  ]) {
    const source = read(path)
    const quizLinks = source.match(/<Link\b(?=[^>]*href="\/quiz")[^>]*>/g) ?? []
    assert.ok(quizLinks.length > 0, `${path} should contain at least one /quiz link`)

    for (const link of quizLinks) {
      assert.match(link, /prefetch=\{false\}/, `${path} /quiz links should opt out of prefetch`)
    }
  }

  // The unified legal footer carries no /quiz link at all, so it cannot prefetch quiz bundles.
  const footerSource = read("src/components/landing/site-footer.tsx")
  const footerLinksSource = read("src/components/landing/footer-links.tsx")
  assert.match(footerSource, /legalFooterLinks\.map/)
  assert.doesNotMatch(footerLinksSource, /href: "\/quiz"/)
  assert.match(footerLinksSource, /<Link href=\{href\} prefetch=\{prefetch\}/)
})

test("shared loader may warm Stripe.js, but pricing starts checkout only on explicit open", () => {
  const source = read("src/components/quiz/result-offer-pricing.tsx")
  const loaderSource = read("src/lib/stripe/offer-client-loader.ts")
  const supportSource = read("src/components/quiz/guided-story-support.tsx")

  assert.match(loaderSource, /from "@stripe\/stripe-js\/pure"/)
  assert.match(source, /getOfferStripePromise/)
  assert.doesNotMatch(source, /useEffect\(\(\) => \{[\s\S]{0,120}getOfferStripePromise\(\)/)
  assert.match(
    source,
    /const openCheckout = useCallback\(\(\) => \{[\s\S]*const stripePromise = getOfferStripePromise\(\)/,
  )
  assert.match(supportSource, /useEffect\(\(\) => \{\s*warmOfferStripe\(\)/)
  assert.doesNotMatch(supportSource, /ResultOfferPricing|pricingSlot/)
})

test("offer and profile reactivation pricing views keep funnel attribution with fresh event ids", () => {
  const source = read("src/components/quiz/result-offer-pricing.tsx")
  const profilePricingSource = read(
    "src/components/reactivation/membership-reactivation-checkout.tsx",
  )

  assert.doesNotMatch(source, /bootstrapFunnelContext\(\)\.then/)
  assert.match(source, /const fallback = offerTracking \?\? getCurrentFunnelContext\(\)/)
  assert.match(source, /trackAppEvent\("pricing_viewed", \{[\s\S]*funnelEventId,/)
  assert.match(
    source,
    /funnelSessionId: offerContext\?\.funnelSessionId \?\? fallback\?\.funnelSessionId/,
  )
  assert.match(
    source,
    /funnelPackageKey: offerContext\?\.funnelPackageKey \?\? fallback\?\.funnelPackageKey/,
  )
  assert.doesNotMatch(profilePricingSource, /bootstrapFunnelContext\(\)\.then/)
  assert.match(
    profilePricingSource,
    /const context = getCurrentFunnelContext\(\)[\s\S]*trackAppEvent\("pricing_viewed", \{[\s\S]*funnelEventId: createFunnelEventId\(\),[\s\S]*funnelPackageKey: context\?\.funnelPackageKey/,
  )
})

test("checkout return emits browser Subscribe only for subscription Stripe returns", async () => {
  const source = read("src/app/welcome/checkout-return-analytics.tsx")
  const { shouldTrackCheckoutReturnSubscriptionStarted } =
    await import("@/app/welcome/checkout-return-analytics")

  assert.ok(
    source.indexOf('window.history.replaceState(window.history.state, "", "/welcome")') <
      source.indexOf('trackAppEvent("subscription_started"'),
  )
  assert.ok(
    source.indexOf('window.history.replaceState(window.history.state, "", "/welcome")') <
      source.indexOf("trackMetaPageView()"),
  )
  assert.ok(
    source.indexOf("trackMetaPageView()") < source.indexOf('trackAppEvent("subscription_started"'),
  )

  assert.match(
    source,
    /if \(shouldTrackCheckoutReturnSubscriptionStarted\(\{ purchaseKind, sessionId \}\)\) \{[\s\S]*trackAppEvent\("subscription_started", \{[\s\S]*checkoutSessionId: sessionId/,
  )
  assert.equal(
    shouldTrackCheckoutReturnSubscriptionStarted({ purchaseKind: "one_time", sessionId: "cs_123" }),
    false,
  )
  assert.equal(shouldTrackCheckoutReturnSubscriptionStarted({ sessionId: "cs_123" }), true)
  assert.equal(shouldTrackCheckoutReturnSubscriptionStarted({ sessionId: "paypal:token" }), false)
})
