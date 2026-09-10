import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ProfileLockBadge } from "../src/components/profile/profile-lock-badge"
import { VerfeinerungTeaser } from "../src/components/profile/verfeinerung-teaser"
import { PREMIUM_FEATURES } from "../src/lib/premium-sheet/context"

/**
 * T15 (freemium-scanner-first PR5): the Profil page's two premium gates — the Haar-Check
 * edit affordance and the Verfeinerungs-Teaser.
 *
 * The Profil page itself (`src/app/profile/page.tsx`) is a large, heavily effectful client
 * component with no render-test harness in this repo (every existing test that touches it —
 * `profile-account-logout.test.ts`, `personal-plan-profil-haarprofil.test.tsx`,
 * `billing-plan-change.test.ts` — asserts against its SOURCE TEXT, not a render). This file
 * follows that same established convention for the new wiring, and covers the two new
 * components with real `renderToStaticMarkup` render tests — mirroring how T3's free-tier nav
 * lock is proven (`personal-plan-stage5-navigation.test.tsx` renders
 * `PersonalPlanNavigationView` directly with `tier: "free"`, rather than a real free Supabase
 * session — there is no `/labs/profile` tier-injection harness and no dev-login free-tier
 * path, see `docs/local-qa-access.md` §1: dev-login always seeds paid access).
 */

const pageSource = readFileSync("src/app/profile/page.tsx", "utf8")
const layoutSource = readFileSync("src/app/profile/layout.tsx", "utf8")

// --- VerfeinerungTeaser (free-tier stand-in for "Dein Haarprofil") --------------

test("VerfeinerungTeaser renders the noch-genauer framing, not a bad-current-profile framing", () => {
  const html = renderToStaticMarkup(<VerfeinerungTeaser onUnlock={() => {}} />)

  assert.match(html, /Noch genauer werden/)
  assert.match(html, /noch genauer/)
  // Binding constraint: must never read as "your current recommendations are wrong/missing".
  assert.doesNotMatch(html, /nicht genau|ungenau|fehlerhaft|unvollständig/)
})

test("VerfeinerungTeaser's CTA carries the accessible Premium gate name and the corner lock badge", () => {
  const html = renderToStaticMarkup(<VerfeinerungTeaser onUnlock={() => {}} />)

  assert.match(html, /Verfeinerung freischalten/)
  assert.match(html, /aria-label="Verfeinerung freischalten — Premium"/)
  assert.match(html, /data-profile-lock-badge="true"/)
})

// --- ProfileLockBadge (shared corner marker, NavLockBadge/ScanLockBadge contract) ---

test("ProfileLockBadge is decorative and never covers content (no interactive role, aria-hidden)", () => {
  const html = renderToStaticMarkup(<ProfileLockBadge />)

  assert.match(html, /aria-hidden="true"/)
  assert.match(html, /data-profile-lock-badge="true"/)
  assert.match(html, /pointer-events-none/)
  // Positioned at a corner, not covering the whole affordance.
  assert.match(html, /absolute -right-1 -top-1/)
})

// --- Sheet contexts: exact per the brief's binding design -----------------------

test("the brief's exact sheet contexts are wired: haarcheck and verfeinerung gates", () => {
  assert.match(
    pageSource,
    /const HAARCHECK_GATE: PremiumSheetContext = \{\s*\n?\s*feature: "haarcheck",\s*\n?\s*source: "profil:haarcheck",?\s*\n?\s*\}/,
  )
  assert.match(
    pageSource,
    /const VERFEINERUNG_GATE: PremiumSheetContext = \{\s*\n\s*feature: "verfeinerung",\s*\n\s*source: "profil:verfeinerung",\s*\n\s*\}/,
  )
})

test("both premium-sheet feature ids used by this page have approved copy registered", () => {
  assert.ok(PREMIUM_FEATURES.haarcheck)
  assert.ok(PREMIUM_FEATURES.verfeinerung)
  assert.equal(PREMIUM_FEATURES.haarcheck.name, "Haar-Check bearbeiten")
  assert.equal(PREMIUM_FEATURES.verfeinerung.name, "Profil-Verfeinerung")
})

// --- Haar-Check: editing is corner-locked at a single choke point ---------------

test("startQuizEditing gates on tier before entering edit mode — the single choke point for the header button, per-field cards and the Haarlänge prompt", () => {
  const start = pageSource.indexOf("function startQuizEditing(fieldKey?: string) {")
  assert.notEqual(start, -1, "startQuizEditing must still exist")
  const end = pageSource.indexOf("\n  }", start)
  const body = pageSource.slice(start, end)

  assert.match(body, /if \(tier === "free"\) \{/)
  assert.match(body, /openPremiumSheet\(HAARCHECK_GATE\)/)
  assert.match(body, /return\s*\n\s*\}/)
  // The free branch must return before ever flipping quizEditing.
  const freeBranchIndex = body.indexOf('if (tier === "free")')
  const setEditingIndex = body.indexOf("setQuizEditing(true)")
  assert.ok(freeBranchIndex < setEditingIndex, "the tier check must precede entering edit mode")
})

test("the Haar-Check edit button carries the corner lock and the accessible Premium name only for free tier", () => {
  assert.match(pageSource, /Haar-Check bearbeiten — Premium/)
  assert.match(
    pageSource,
    /aria-label=\{\s*tier === "free" \? "Haar-Check bearbeiten — Premium" : undefined\s*\}/,
  )
  assert.match(
    pageSource,
    /Haar-Check bearbeiten\s*\n\s*\{tier === "free" \? <ProfileLockBadge \/> : null\}/,
  )
})

// --- Verfeinerungs-Teaser: free branch is additive, premium branch untouched ----

test("the Verfeinerungs-Teaser is a SEPARATE block from the existing premium HairProfileSection conditional — the premium branch's source is byte-for-byte unchanged", () => {
  assert.match(
    pageSource,
    /\{tier === "free" \? \(\s*\n\s*<VerfeinerungTeaser onUnlock=\{\(\) => openPremiumSheet\(VERFEINERUNG_GATE\)\} \/>\s*\n\s*\) : null\}/,
  )
  // Exact literal the pre-existing test in personal-plan-profil-haarprofil.test.tsx pins —
  // proof that block was not touched or nested inside the new conditional above.
  assert.match(pageSource, /\{hasRoutineAccess && refinementStatus \? \(/)
})

// --- PremiumSheet mount: one sheet, both gates, PayPal-return fallback ----------

test("the PremiumSheet is mounted once with a PayPal-return fallback to the Haar-Check gate", () => {
  assert.match(pageSource, /<PremiumSheet\b/)
  assert.match(pageSource, /open=\{premiumSheetOpen\}/)
  assert.match(pageSource, /context=\{premiumSheetContext\}/)
  assert.match(
    pageSource,
    /onRequestOpen=\{\(context\) => openPremiumSheet\(context \?\? HAARCHECK_GATE\)\}/,
  )
})

// --- Tier derivation: server-only, route-agnostic loader, no client guess ------

test("tier is read from the server-resolved context, never computed client-side", () => {
  assert.match(pageSource, /const tier = useProfilePageTier\(\)/)
  assert.doesNotMatch(
    pageSource,
    /getEntitlements|hasFreemiumPaidAccess|resolveAuthenticatedAppPageTier/,
  )
})

test("the layout resolves tier server-side via the same route-agnostic loader /scan uses", () => {
  assert.match(
    layoutSource,
    /import \{ loadAuthenticatedAppPageTier \} from "@\/lib\/auth\/authenticated-app-route-access"/,
  )
  assert.match(layoutSource, /const \[navigation, tier\] = await Promise\.all\(\[/)
  assert.match(layoutSource, /loadAuthenticatedAppPageTier\(\)/)
  assert.match(
    layoutSource,
    /<ProfilePageTierProvider tier=\{tier\}>\{children\}<\/ProfilePageTierProvider>/,
  )
})
