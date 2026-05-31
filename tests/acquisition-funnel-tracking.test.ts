import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function read(path: string) {
  return readFileSync(path, "utf8")
}

test("acquisition funnel keeps Meta and Customer.io tracking from landing through checkout success", () => {
  const routeProviders = read("src/providers/route-providers.tsx")
  assert.match(routeProviders, /function LandingTracking\(\)/)
  assert.match(routeProviders, /function PublicFlowProviders\(/)
  assert.match(routeProviders, /<MetaPixelProvider>/)
  assert.match(routeProviders, /<CustomerIoProvider>/)

  const landing = read("src/app/page.tsx")
  assert.match(landing, /<LandingTracking \/>/)

  for (const path of [
    "src/app/auth/layout.tsx",
    "src/app/pricing/layout.tsx",
    "src/app/result/layout.tsx",
    "src/app/welcome/layout.tsx",
  ]) {
    assert.match(read(path), /<PublicFlowProviders>{children}<\/PublicFlowProviders>/, path)
  }

  assert.match(read("src/app/quiz/layout.tsx"), /<AppRouteProviders>/)
})
