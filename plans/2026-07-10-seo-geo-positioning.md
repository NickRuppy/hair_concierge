# Lean SEO + GEO Foundation Implementation Plan

> **Decision amendment — 2026-07-10:** The user approved reducing this rollout to technical SEO/GEO fundamentals plus one compact transparency page. A public Ratgeber, article CMS changes, content publishing, and the RLS migration are explicitly deferred until real demand and worthwhile content justify them.

**Goal:** Make Chaarlie technically indexable, consistently identifiable, and more credible to users and retrieval systems without creating a premature publishing operation.

**Architecture:** Next.js metadata routes and explicit route classification own crawl behavior. A single site-identity module owns canonical brand facts and conservative structured data. The existing landing page and quiz remain the commercial surfaces. `/methodik` is the only new public content page and explains how Chaarlie works, its ownership, commercial relationships, and cosmetic/medical boundary.

**Branch/worktree:** `codex/seo-geo-positioning` in `.worktrees/seo-geo-positioning`, originally based on `origin/main` at `ed945d8`.

**Status:** Lean scope implementation and local verification complete; repository and production
mutations remain paused for explicit approval.

## Settled Decisions

- Germany is the primary market; no regional or language variants are needed.
- `/quiz` stays indexable with unique metadata and a self-canonical.
- Legitimate declared crawlers may access public content.
- Private, authenticated, admin, result, and unstable commercial surfaces remain excluded from indexing.
- `/methodik` remains as a compact credibility and transparency page.
- Existing public trust language is audited. User-approved homepage, FAQ, quiz, offer, guarantee,
  and social-image wording is made more specific and less absolute; the countdown remains.
- No Ratgeber or article pages ship in this rollout.
- No article CMS changes, anonymous article access, publication migration, or editorial workflow ship in this rollout.
- GEO uses the same people-first, crawlable, factual foundation as SEO; no AI-only pages or special schema are added.
- A pre-launch baseline and fixed directional AI prompt set support a later 30-day comparison.
- Ads improvements remain focused on landing-page relevance, crawlability, speed, and delivery of the advertised promise.

## Explicit Non-Goals

- No `/ratgeber`, article routes, initial article set, keyword content program, or publishing cadence.
- No public changes to the existing `articles` table, policies, grants, admin editor, or APIs.
- No `llms.txt`, AI-only mirrors, prompt stuffing, schema stuffing, or mass-generated pages.
- No DACH variants, domain migration, new CMS, or external content platform.
- No broad product-copy rewrite, backlink campaign, directory submissions, purchased links, or fake reviews.
- No promise of ranking, rich-result, ad-quality, or AI-citation outcomes.

## Target File Map

### Baseline and operations

- `docs/seo/seo-geo-baseline.md`
- `docs/seo/seo-geo-operations.md`
- `docs/seo/public-trust-language-audit.md`

### Crawlability and routing

- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/lib/auth/route-classification.ts`
- `src/lib/auth/unauthenticated-redirect.ts`
- `src/lib/supabase/middleware.ts`
- `src/proxy.ts`

### Identity and metadata

- `src/lib/seo/site-identity.ts`
- `src/components/seo/json-ld.tsx`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/quiz/layout.tsx`
- `src/app/quiz/quiz-shell.tsx`
- public legal/contact page metadata
- private-route metadata and response headers

### Transparency experience

- `src/components/editorial/editorial-shell.tsx`
- `src/app/methodik/page.tsx`
- `src/components/landing/site-footer.tsx`

### Measurement and tests

- `scripts/perf/mobile-lighthouse.mjs`
- focused tests under `tests/`

---

## Task 0: Preserve the Implementation Contract

- [x] Work only in `.worktrees/seo-geo-positioning` on `codex/seo-geo-positioning`.
- [x] Preserve unrelated root-checkout and sibling-worktree changes.
- [x] Use the main Codex session for integration and bounded workers only where scopes are independent.
- [x] Stop before staging, commit, push, PR, migration, merge, deploy, submission, or cleanup.

## Task 1: Freeze the Pre-Launch Evidence

- [x] Record live response, redirect, content type, title, description, canonical, robots, and JSON-LD state for `/`, `/quiz`, `/robots.txt`, `/sitemap.xml`, and an unknown route.
- [x] Record unavailable PageSpeed/CrUX, Search Console, Ads, Bing, and PostHog evidence honestly.
- [x] Preserve comparable export windows and filenames.
- [x] Define a fixed 12-prompt German AI-visibility benchmark as directional evidence, not a rank tracker.

## Task 2: Correct Routing and Crawl Resources

- [x] Inventory current page and API routes with segment-aware classification tests.
- [x] Allow known public routes without unnecessary auth lookup.
- [x] Preserve auth, subscription, returning-user, and admin-role behavior on protected routes.
- [x] Pass unknown pages/APIs to Next.js so they return genuine 404 responses.
- [x] Render unknown pages with a branded German recovery page.
- [x] Serve `robots.txt` and `sitemap.xml` without redirects.
- [x] Include only canonical indexable foundation routes in the sitemap.
- [x] Keep private/app/admin/API paths out of the sitemap and list them as robots crawl hints.

## Task 3: Establish Identity, Metadata, and Indexing Intent

- [x] Create one truthful site-identity source with verified facts only.
- [x] Add a root title template without leaking the homepage social URL into child routes.
- [x] Add unique metadata and self-canonicals to the homepage, quiz, Methodik, and legal/contact pages.
- [x] Keep pricing, results, auth, onboarding, profile, routine, chat, admin, welcome, and labs explicitly `noindex`.
- [x] Split the interactive quiz shell from its server metadata layout without changing quiz behavior.
- [x] Render conservative `Organization` and `WebSite` JSON-LD with script-closing protection.
- [x] Back the Organization logo field with a crawlable 512px square image.
- [x] Keep `sameAs` empty until exact owned profile URLs are verified.
- [x] Ensure the indexable quiz entry state has one primary `h1`.

## Task 4: Add the Compact Transparency Page

- [x] Build `/methodik` using the existing Chaarlie visual language.
- [x] Explain quiz inputs, recommendation limits, product-data freshness, commercial relationships, source standards, ownership, and contact.
- [x] Keep cosmetic guidance distinct from diagnosis and medical treatment.
- [x] Add Methodik to the existing footer without changing unrelated trust copy.
- [x] Verify German readability, responsive layout, heading hierarchy, CTA clarity, and absence of overflow.

## Task 5: Keep Trust and GEO Operations Lean

- [x] Produce a read-only public trust-language audit with exact locations and proposed replacements.
- [x] Record verified entity facts and leave unverified external profiles out of structured data.
- [x] Define a selective genuine-mention policy that excludes link schemes and synthetic profiles.
- [x] Define monthly technical, indexing, acquisition, conversion, and directional AI checks.
- [x] Define a 30-day comparison that separates observed facts from inference and sample-size limits.

## Task 6: Verification and Handoff

- [x] Run focused metadata, routing, sitemap, Methodik, and acquisition tests.
- [x] Run `npm run test:node`.
- [x] Run `npm run ci:verify`.
- [x] Run mobile/desktop browser QA for `/`, `/quiz`, and `/methodik`.
- [x] Verify `/ratgeber` now returns a genuine 404 and appears in neither navigation nor sitemap.
- [x] Run Lighthouse SEO/performance reporting on `/`, `/quiz`, and `/methodik` without weakening existing thresholds.
- [x] Run `ready-check`, a whole-branch code review, and a read-only Claude second opinion.
- [x] Confirm the branch contains no article CMS, publication migration, RLS, or Ratgeber implementation changes.
- [x] Stop before repository or production mutations for explicit approval.

## Residual Risks

- Production-build Lighthouse SEO scored `100` on `/`, `/quiz`, and `/methodik`. The unchanged
  performance thresholds still fail: homepage LCP `5179ms` and CLS `0.134`, quiz LCP `5838ms`, and
  Methodik LCP `4993ms`. These are lab results, not field Core Web Vitals; use Search Console/CrUX
  when available and treat performance optimization as separate follow-up scope.
- Search Console, Ads, Bing, and PostHog account exports remain unavailable in this environment.
- AI prompt observations are volatile and directional; they do not prove causal visibility gains.
- Remaining trust-copy findings stay as recommendations unless explicitly accepted or approved.
- The branch is behind current `origin/main`; reconcile only at the explicit pre-PR gate.
