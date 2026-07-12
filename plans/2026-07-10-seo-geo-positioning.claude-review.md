All 36 focused tests pass, the default export of `next.config.ts` is intact, and the trust audit turns out to contain P0 findings the plan explicitly leaves unresolved. I have everything I need — here is the verdict report.

---

**Verdict:** Approve with revisions

**Scope note:** Tasks 0–5 are already implemented in this worktree, so checked-off claims were verified against the actual code, not taken on faith. Nearly all of them hold. Focused test evidence: `npx tsx --test` on the six SEO/routing/editorial test files → **36/36 pass**.

## Lean shape

- **Irreducible goal:** make chaarlie.de crawlable and correctly indexed, give it one consistent machine-readable identity, and add a single `/methodik` transparency page — without starting a publishing operation.
- **Cut or defer:** almost nothing left to cut — the plan is already the artifact of an explicit scope reduction (Ratgeber, CMS, RLS all deferred). Residual crumbs only: the new named export `export const nextConfig` (next.config.ts) has no consumer (all tests import the default); `SITE_SAME_AS` (`src/lib/seo/site-identity.ts:11`) is consumed only by a test — both harmless intent-documentation.
- **Hard tradeoff the plan is avoiding:** shipping *increased crawl visibility* while the plan's own trust audit flags **P0** contradictions that stay live (see Tradeoff 1). The audit's P0 bar is "resolve or explicitly accept before the affected public surface ships" — the plan does neither; it parks them as a residual risk (plan line 145).

## Prior art

- **robots/sitemap via Next metadata routes** (`src/app/robots.ts`, `src/app/sitemap.ts`): matches the canonical Next.js pattern — OK. Sitemap omits `lastModified` rather than faking dates — correct.
- **noindex via `X-Robots-Tag` in `headers()`** (next.config.ts): canonical — OK, but see the follow/nofollow contradiction below.
- **JSON-LD injection safety** (`src/components/seo/json-ld.tsx:4`): `<` → `\u003c` is the canonical script-closing defense, and it's tested (`tests/seo-metadata-routes.test.ts:324-336`) — OK.
- **Organization/WebSite JSON-LD with `@id` cross-links, empty `sameAs` until verified**: canonical conservative shape — **missing invariant:** Google requires the Organization `logo` image to be ≥112×112px; the plan points it at a 32×32 favicon (Blocker 2).
- **Host canonicalization (www → apex 308)** in `src/proxy.ts:6-10`: canonical — but the new matcher exemption (`src/proxy.ts:25`) means `www.chaarlie.de/robots.txt` and `/sitemap.xml` now bypass that redirect (High-confidence 2).
- **noindex + robots-disallow on the same private routes**: deviates from "noindex must be crawlable to be seen" — externally-linked private URLs can still appear as URL-only results. Acceptable belt-and-braces for private surfaces, but the deviation is undocumented (Tradeoff 5).

## Blockers (hard technical defects)

1. **No `not-found.tsx` exists — unknown routes now show Next's default English 404.** `src/lib/supabase/middleware.ts:82-84` passes unknown routes through (previously they 307'd into the quiz funnel, per `docs/seo/seo-geo-baseline.md`). With no `not-found.tsx` anywhere under `src/app/`, real users hitting dead links get an unbranded English "404 This page could not be found" with zero navigation — a regression for users and a violation of the all-UI-in-German convention. Fix: add a branded German `src/app/not-found.tsx` linking back to `/` and `/quiz`.
2. **Organization JSON-LD `logo` is a 32×32 favicon.** `src/lib/seo/site-identity.ts:149-152` sets `logo.url` to `${SITE_ORIGIN}/icon`, and `src/app/icon.tsx:3` declares `size = { width: 32, height: 32 }`. Google's structured-data guideline requires ≥112×112px, so the logo will be ignored or flagged — the main payoff of shipping Organization JSON-LD silently doesn't materialize. Fix: point `logo` at a ≥112px square asset (a dedicated static logo image, not the favicon).

## High-confidence issues (correctness, not preference)

- **Contradictory robots directives on private pages.** Metadata says `{ index: false, follow: true }` (`src/lib/seo/site-identity.ts:14-18`, applied in auth/chat/onboarding/profile/routine/welcome layouts) while the header rule says `noindex, nofollow` (next.config.ts `noindexRoutes`). Crawlers take the most restrictive union, so `nofollow` silently wins. Pick one value and use it in both places.
- **Crawl resources bypass host canonicalization.** `src/proxy.ts:25` exempts `robots.txt`/`sitemap.xml` from the middleware, so the www→apex 308 in `src/proxy.ts:6-10` no longer covers them. If the Vercel domain config does not already redirect `www.` at the edge, `www.chaarlie.de/robots.txt` serves 200 on the wrong host. Verify the edge redirect at deploy time (Vercel MCP is unauthenticated in this session, so I could not check) — or scope the exemption to the apex host.
- **Task 6 cites a verification step that doesn't resolve.** `ready-check` (plan line 136) matches nothing in `package.json`, `scripts/`, or `.claude/` — it appears only in older plan prose. Per the placeholder rule, an executor will skip or hallucinate it. Replace with the exact project steps: `npm run ci:verify`, the `codex:codex-rescue` **agent** (not the `/codex:rescue` skill — recorded as stalling) on `git diff main...HEAD`, then `/ship`.

## Smaller / nice-to-haves

- **Four hand-maintained route lists with no cross-consistency test:** `PUBLIC_EXACT_ROUTES` (route-classification.ts), robots disallow (robots.ts:4-15), `noindexRoutes` (next.config.ts), and `STATIC_SITEMAP_PATHS` (sitemap.ts:5-14). The inventory tests cover classification only. One cheap test — "every sitemap path classifies `public`, and is neither robots-disallowed nor in `noindexRoutes`" — would catch future drift.
- `/methodik` metadata is defined inline (`src/app/methodik/page.tsx:8-24`) instead of in `site-identity.ts`, so it's excluded from the uniqueness/self-canonical test (`tests/seo-metadata-routes.test.ts:269-294`).
- The one-`h1` quiz claim holds (verified: landing brand-panel variant is the only `h1` at entry, `quiz-brand-panel.tsx:55`; journey variant demotes to `h2` at line 80 while the question `h1` takes over) — but the indexable entry `h1` is just "Chaarlie", which is semantically weak. The guarding test (`tests/seo-metadata-routes.test.ts:301-305`) only regex-checks one source file; it wouldn't catch a second `h1` being reintroduced elsewhere.
- Lighthouse default paths dropped `/pricing` and `/auth` (`scripts/perf/mobile-lighthouse.mjs`); perf thresholds themselves are intact and an SEO ≥0.9 gate was added — but `/auth` loses perf regression coverage.

## Tradeoffs — decisions the owner must make (not defects)

1. **Ship crawl visibility with live P0 trust-copy findings, or fix three lines first.** `docs/seo/public-trust-language-audit.md` flags as **P0**: "Eine Diagnose" (`what-you-get.tsx:41`), "Wissenschaftliche Haaranalyse" (`site-footer.tsx:25` — directly adjacent to the new Methodik link this branch adds), and the "ausschließlich" data-use claim (`faq.tsx:40-41`). The footer claim now sits one click from a Methodik page that says assessments are "keine Messwerte oder Befunde" — a crawler-visible contradiction. **Decide:** apply the three P0 replacements pre-ship, or record explicit acceptance; the plan currently does neither.
2. **Methodik describes article standards for articles that don't exist.** "Ratgeberbeiträge sollen ihre wesentlichen Quellen direkt nennen … Veröffentlichungs- und letztes Prüfdatum werden am Beitrag angezeigt" (`methodik/page.tsx:134-144`) and affiliate "Hinweise stehen am Beitrag oder beim Link" (`:112-113`) — but the rollout ships zero Beiträge. **Decide:** reword to present-tense facts only, or accept forward-looking policy language on a transparency page.
3. **Un-gated tracking on the new transparency page.** `EditorialShell` mounts `LandingTracking` (`editorial-shell.tsx:10`); per recorded project memory, PostHog + Meta Pixel are not yet consent-gated (open TTDSG §25 item). **Decide:** accept (consistent with every other public page, already backlogged) or gate before shipping the page whose subject is transparency.
4. **Rebase risk:** branch is 2 commits behind `origin/main`, including #210 (chat RAG refactor). The plan correctly gates reconciliation at the pre-PR step — just confirm middleware/test overlap at rebase.
5. **noindex + disallow overlap** (robots.ts vs noindex directives on `/auth`, `/chat`, `/welcome`, etc.): accept the small URL-only-indexing risk for externally-linked private URLs, or drop the robots-disallow for the noindexed HTML pages so crawlers can see the directive.

## Bottom line

The plan is well-shaped, genuinely lean, and — unusually — its checked-off claims survive verification against the code: inventory-driven route tests enumerate the real filesystem, auth/subscription/admin gates are preserved in the middleware diff, the pricing anon gate survives at page level (`pricing/page.tsx:24`), the baseline doc is honest, and all 36 focused tests pass. Fix the two blockers (German `not-found.tsx`, ≥112px JSON-LD logo), resolve the follow/nofollow contradiction, replace `ready-check` with the project's real finish steps, and record an explicit decision on the three P0 trust-copy findings — then Task 6 can proceed to ship.
