import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildRetiredRoutineRedirect } from "../src/app/lp/[slug]/page"
import {
  isAttributableFunnelPackage,
  resolveAttributablePackageForPath,
  shouldStartNewFunnelSession,
} from "../src/proxy"
import { getFunnelPackageBySlug, type FunnelPackage } from "../src/lib/funnel/packages"

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

test("the scan_v1 landing route 404s without its flag, mirroring the personal-plan gate", () => {
  const routeSource = readFileSync(
    new URL("../src/app/lp/[slug]/page.tsx", import.meta.url),
    "utf8",
  )
  assert.match(
    routeSource,
    /funnelPackage\.key === "meta_personal_plan_v1" && !isPersonalPlanQuizV1Enabled\(\)\) \{\s*\n\s*notFound\(\)/,
  )
  assert.match(
    routeSource,
    /funnelPackage\.key === "scan_v1" && !isScanFunnelEnabled\(\)\) \{\s*\n\s*notFound\(\)/,
  )
})

test("archived landing routes cannot mint or preserve a live quiz journey", () => {
  assert.equal(resolveAttributablePackageForPath("/lp/scalp-check", true, false), null)
  assert.equal(resolveAttributablePackageForPath("/lp/routine", true, false), null)
  assert.equal(resolveAttributablePackageForPath("/lp/haarplan", false, false), null)

  const defaultPackage = resolveAttributablePackageForPath("/quiz", true, false)
  assert.ok(defaultPackage)
  assert.equal(
    shouldStartNewFunnelSession({
      existingPackageKey: "scalp_check_placeholder",
      explicitlySelectsPackage: false,
      personalPlanEnabled: true,
      scanFunnelEnabled: false,
      selectedPackage: defaultPackage,
    }),
    true,
  )
  assert.equal(
    shouldStartNewFunnelSession({
      existingPackageKey: "default_organic",
      explicitlySelectsPackage: false,
      personalPlanEnabled: true,
      scanFunnelEnabled: false,
      selectedPackage: defaultPackage,
    }),
    false,
  )
})

test("the placeholder scan_v1 package is attributable only behind its own flag", () => {
  assert.equal(resolveAttributablePackageForPath("/lp/scan", true, false), null)

  const scanPackage = resolveAttributablePackageForPath("/lp/scan", true, true)
  assert.ok(scanPackage)
  assert.equal(scanPackage.key, "scan_v1")

  // The personal-plan flag must not leak into scan_v1 attribution, and vice versa.
  assert.equal(resolveAttributablePackageForPath("/lp/haarplan", false, true), null)
})

test("an active scan_v1 package is attributable regardless of the placeholder flag", () => {
  const placeholderScanPackage = getFunnelPackageBySlug("scan")
  assert.ok(placeholderScanPackage)
  assert.equal(placeholderScanPackage.status, "placeholder")

  const activeScanPackage: FunnelPackage = { ...placeholderScanPackage, status: "active" }
  assert.equal(isAttributableFunnelPackage(activeScanPackage, false, false), true)
  assert.equal(isAttributableFunnelPackage(activeScanPackage, true, false), true)
})

test("existing organic and meta attribution branches are unaffected by the scan flag", () => {
  const organicPackage = resolveAttributablePackageForPath("/", false, true)
  assert.ok(organicPackage)
  assert.equal(organicPackage.key, "default_organic")

  assert.equal(
    resolveAttributablePackageForPath("/lp/haarplan", true, true)?.key,
    "meta_personal_plan_v1",
  )
  assert.equal(resolveAttributablePackageForPath("/lp/haarplan", false, true), null)
})
