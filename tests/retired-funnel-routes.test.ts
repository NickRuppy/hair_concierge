import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildRetiredRoutineRedirect } from "../src/app/lp/[slug]/page"
import { resolveAttributablePackageForPath, shouldStartNewFunnelSession } from "../src/proxy"

test("retired routine links keep only safe campaign parameters", () => {
  assert.equal(
    buildRetiredRoutineRedirect({
      utm_source: "creator",
      utm_campaign: "launch",
      fbclid: "fb-click",
      mode: "preview",
      entry: "other",
    }),
    "/?utm_source=creator&utm_campaign=launch&fbclid=fb-click",
  )
})

test("the retired scalp route is rejected and routine redirects before attribution selection", () => {
  const routeSource = readFileSync(
    new URL("../src/app/lp/[slug]/page.tsx", import.meta.url),
    "utf8",
  )
  const proxySource = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8")
  assert.match(routeSource, /funnelPackage\.status === "archived"\) notFound\(\)/)
  assert.match(proxySource, /pathname === "\/lp\/routine"/)
  assert.match(proxySource, /NextResponse\.redirect\(url, 307\)/)
})

test("archived landing routes cannot mint or preserve a live quiz journey", () => {
  assert.equal(resolveAttributablePackageForPath("/lp/scalp-check", true), null)
  assert.equal(resolveAttributablePackageForPath("/lp/routine", true), null)
  assert.equal(resolveAttributablePackageForPath("/lp/haarplan", false), null)

  const defaultPackage = resolveAttributablePackageForPath("/quiz", true)
  assert.ok(defaultPackage)
  assert.equal(
    shouldStartNewFunnelSession({
      existingPackageKey: "scalp_check_placeholder",
      explicitlySelectsPackage: false,
      personalPlanEnabled: true,
      selectedPackage: defaultPackage,
    }),
    true,
  )
  assert.equal(
    shouldStartNewFunnelSession({
      existingPackageKey: "default_organic",
      explicitlySelectsPackage: false,
      personalPlanEnabled: true,
      selectedPackage: defaultPackage,
    }),
    false,
  )
})
