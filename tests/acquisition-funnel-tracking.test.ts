import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function read(path: string) {
  return readFileSync(path, "utf8")
}

test("acquisition funnel keeps Meta, Customer.io, and PostHog tracking from landing through checkout success", () => {
  const routeProviders = read("src/providers/route-providers.tsx")
  assert.match(routeProviders, /function LandingTracking\(\)/)
  assert.match(routeProviders, /function PublicFlowProviders\(/)
  assert.match(routeProviders, /function PublicAuthFlowProviders\(/)
  assert.match(routeProviders, /<MetaPixelProvider>/)
  assert.match(routeProviders, /<CustomerIoProvider>/)
  assert.match(routeProviders, /<PostHogClientProvider>/)

  const landing = read("src/app/page.tsx")
  assert.match(landing, /<LandingTracking \/>/)

  for (const path of [
    "src/app/auth/layout.tsx",
    "src/app/pricing/layout.tsx",
    "src/app/result/layout.tsx",
  ]) {
    assert.match(read(path), /<PublicFlowProviders>{children}<\/PublicFlowProviders>/, path)
  }

  assert.match(
    read("src/app/welcome/layout.tsx"),
    /<PublicAuthFlowProviders>{children}<\/PublicAuthFlowProviders>/,
  )
  assert.match(read("src/app/quiz/layout.tsx"), /<AppRouteProviders>/)
})

test("landing quiz CTAs do not prefetch checkout-heavy quiz bundles", () => {
  for (const path of [
    "src/components/landing/landing-header.tsx",
    "src/components/landing/hero.tsx",
    "src/components/landing/how-it-works.tsx",
    "src/components/landing/final-cta.tsx",
    "src/components/landing/sticky-quiz-cta.tsx",
    "src/components/landing/site-footer.tsx",
  ]) {
    const source = read(path)
    const quizLinks = source.match(/<Link\b(?=[^>]*href="\/quiz")[^>]*>/g) ?? []
    assert.ok(quizLinks.length > 0, `${path} should contain at least one /quiz link`)

    for (const link of quizLinks) {
      assert.match(link, /prefetch=\{false\}/, `${path} /quiz links should opt out of prefetch`)
    }
  }
})

test("result offer preloads Stripe only after the offer component mounts", () => {
  const source = read("src/components/quiz/result-offer-pricing.tsx")
  const moduleScope = source.slice(0, source.indexOf("export function ResultOfferPricing"))

  assert.match(source, /from "@stripe\/stripe-js\/pure"/)
  assert.doesNotMatch(source, /const stripePromise\s*=/)
  assert.doesNotMatch(moduleScope, /loadStripe\(/)
  assert.match(source, /useEffect\(\(\) => \{\s*getStripePromise\(\)/)
})
