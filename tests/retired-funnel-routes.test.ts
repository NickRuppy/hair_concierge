import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildRetiredRoutineRedirect,
  shouldBlockPlaceholderScanRoute,
} from "../src/app/lp/[slug]/route-helpers"
import {
  isAttributableFunnelPackage,
  resolveAttributablePackageForPath,
  shouldStartNewFunnelSession,
  isPrefetchRequest,
} from "../src/proxy"
import {
  getFunnelPackageByKey,
  getFunnelPackageBySlug,
  type FunnelPackage,
} from "../src/lib/funnel/packages"

test("an enabled email-return package survives the ordinary quiz without attributing a token GET", () => {
  const emailPackage = getFunnelPackageByKey("customerio_scan_return_v1")
  assert.ok(emailPackage)
  assert.equal(emailPackage.channel, "email")
  assert.equal(emailPackage.slug, null)
  assert.equal(emailPackage.offerVariant, "scan-regal-v1")
  assert.equal(isAttributableFunnelPackage(emailPackage, false, false, true), true)
  assert.equal(isAttributableFunnelPackage(emailPackage, false, false, false), false)
  assert.equal(resolveAttributablePackageForPath("/quiz/return", false, false), null)

  const organicPackage = resolveAttributablePackageForPath("/quiz", false, false)
  assert.ok(organicPackage)
  assert.equal(
    shouldStartNewFunnelSession({
      existingPackageKey: emailPackage.key,
      explicitlySelectsPackage: false,
      personalPlanEnabled: false,
      scanFunnelEnabled: false,
      emailReturnEnabled: true,
      selectedPackage: organicPackage,
    }),
    false,
  )
})

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

test("the placeholder scan_v1 landing route 404s without its flag, mirroring the personal-plan gate", () => {
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
    /shouldBlockPlaceholderScanRoute\(funnelPackage, isScanFunnelEnabled\(\)\)\) \{\s*\n\s*notFound\(\)/,
  )
})

test("the scan_v1 route gate is status-aware: active renders regardless of the flag, placeholder still needs it", () => {
  const registryScanPackage = getFunnelPackageBySlug("scan")
  assert.ok(registryScanPackage)
  // Activated 2026-09-13; the placeholder semantics stay covered via a derived package.
  assert.equal(registryScanPackage.status, "active")
  const placeholderScanPackage: FunnelPackage = { ...registryScanPackage, status: "placeholder" }

  // placeholder + flag off -> blocked (today's behaviour, unchanged)
  assert.equal(shouldBlockPlaceholderScanRoute(placeholderScanPackage, false), true)
  // placeholder + flag on -> not blocked
  assert.equal(shouldBlockPlaceholderScanRoute(placeholderScanPackage, true), false)

  const activeScanPackage: FunnelPackage = { ...placeholderScanPackage, status: "active" }
  // active + flag off -> renders regardless of the flag
  assert.equal(shouldBlockPlaceholderScanRoute(activeScanPackage, false), false)
  assert.equal(shouldBlockPlaceholderScanRoute(activeScanPackage, true), false)

  // meta_personal_plan_v1's own gate is untouched by this helper: it only ever
  // targets scan_v1 and never blocks another package's route.
  const personalPlanPackage = getFunnelPackageBySlug("haarplan")
  assert.ok(personalPlanPackage)
  assert.equal(shouldBlockPlaceholderScanRoute(personalPlanPackage, false), false)
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

test("a placeholder scan_v1 package is attributable only behind its own flag", () => {
  const registryScanPackage = getFunnelPackageBySlug("scan")
  assert.ok(registryScanPackage)
  const placeholderScanPackage: FunnelPackage = { ...registryScanPackage, status: "placeholder" }

  assert.equal(isAttributableFunnelPackage(placeholderScanPackage, true, false), false)
  assert.equal(isAttributableFunnelPackage(placeholderScanPackage, false, true), true)

  // The registry package is active since activation: the real path resolver attributes
  // /lp/scan without the flag, and the personal-plan flag still never leaks into it.
  assert.equal(resolveAttributablePackageForPath("/lp/scan", true, false)?.key, "scan_v1")
  assert.equal(resolveAttributablePackageForPath("/lp/haarplan", false, true), null)
})

test("an active scan_v1 package is attributable regardless of the placeholder flag", () => {
  const activeScanPackage = getFunnelPackageBySlug("scan")
  assert.ok(activeScanPackage)
  assert.equal(activeScanPackage.status, "active")

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

test("browser speculation requests never touch funnel attribution", () => {
  assert.equal(isPrefetchRequest(new Headers({ purpose: "prefetch" })), true)
  assert.equal(isPrefetchRequest(new Headers({ "sec-purpose": "prefetch;prerender" })), true)
  assert.equal(isPrefetchRequest(new Headers({ accept: "text/html" })), false)
  assert.equal(isPrefetchRequest(new Headers()), false)

  const proxySource = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8")
  assert.match(
    proxySource,
    /!isFunnelAttributionEnabled\(\) \|\| isPrefetchRequest\(request\.headers\)/,
  )
})

test("only a landing URL may replace an existing funnel session; `/` keeps it", () => {
  // Next prefetches `/` from every wordmark link and strips its prefetch header
  // before middleware, so `/` must not count as an explicit organic choice.
  const proxySource = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8")
  assert.match(
    proxySource,
    /const explicitlySelectsPackage =\s*\n\s*rewriteRegularFieldTest \|\| request\.nextUrl\.pathname\.startsWith\("\/lp\/"\)/,
  )
  assert.doesNotMatch(proxySource, /request\.nextUrl\.pathname === "\/" \|\|/)

  const scanPackage = getFunnelPackageBySlug("scan")
  assert.ok(scanPackage)
  const organicPackage = resolveAttributablePackageForPath("/", false, false)
  assert.ok(organicPackage)
  // An existing scan_v1 session survives a non-explicit `/` request …
  assert.equal(
    shouldStartNewFunnelSession({
      existingPackageKey: scanPackage.key,
      explicitlySelectsPackage: false,
      personalPlanEnabled: false,
      scanFunnelEnabled: false,
      selectedPackage: organicPackage,
    }),
    false,
  )
  // … and a visitor without any session still starts the organic one.
  assert.equal(
    shouldStartNewFunnelSession({
      existingPackageKey: null,
      explicitlySelectsPackage: false,
      personalPlanEnabled: false,
      scanFunnelEnabled: false,
      selectedPackage: organicPackage,
    }),
    true,
  )
})
