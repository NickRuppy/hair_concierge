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
