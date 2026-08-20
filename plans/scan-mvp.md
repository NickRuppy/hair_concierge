# Produkt-Scan MVP — barcode scan → personal fit verdict

## Context

Yuka-style scan feature, adapted: a premium user who completed the quiz opens `/scan` on their phone, scans a product's EAN, and sees whether it fits **their hair profile** — the personalized counter to Yuka's universal score. Research artifact: "Yuka Deconstructed"; interaction patterns signed off by Nick on the clickable prototype (2026-08-20): https://claude.ai/code/artifact/54e8cf55-5bb8-4ae6-9a4a-290d67177ccd

**Locked product decisions**
- Member utility inside the existing premium paywall; no quota/billing changes in v1.
- Categorical verdicts (Passt / Passt nicht / Brauchst du nicht) — no numeric score.
- Profile-based, not plan-based: all 10 categories scannable; `not_needed` categories yield an honest "Brauchst du nicht" verdict (decisions exist for every category in the snapshot).
- Catalog-only scoring; unknown EAN → intake waiting list (existing pipeline, operator-run research stays operator-run).
- Free camera stack: `barcode-detector` ponyfill (zxing-wasm), normal browser tab, iPhone-first; no torch/zoom; rotation-retry + guidance hints; search + manual EAN as first-class fallbacks.
- Action layer: "same skeleton, honest labels" (research-backed — verdict apps never remove the buy affordance; gating belongs to the promotion layer). No affiliate-disclosure copy until affiliate links go live.
- Chat-from-scan parked. Scan gets the **center tab** in the bottom nav.

## UI Specification (from signed-off prototype)

**1 · Scan screen** (`/scan`): full-height camera viewfinder with corner markers; auto-decode (no shutter), decode confirmed after 2 consecutive identical reads, brief flash on success. Telemetry-driven German hint pill cycling as needed: "Barcode in den Rahmen halten" / "Etwas näher ran" / "Weniger kippen" / "Mehr Licht hilft". Below viewfinder: "Barcode nicht lesbar? **Produkt suchen**" link. Header: "Scan" + info icon. Bottom nav: 5 tabs, Scan center, active state plum. Camera denied/absent → search sheet opens directly (scanner is an enhancement, never a wall). Top-right of screen: Merkliste entry point (bookmark icon) — see §5.

**2 · Result sheet**: slides up over the frozen camera (top strip stays visible), grabber handle, drag-down (>~110px) or ✕ closes → back to scanning. Content scrolls; footer pinned. **Identical anatomy in all three verdicts:**
1. Product header: 48px image, name (bold), "Brand · Kategorie" (category in plum).
2. Verdict banner (rounded, state-colored: `--status-ok/danger/neutral` pairs): title + subtitle. Titles: "Passt zu deinem Haar" / "Passt nicht zu deinem Haar" / "Brauchst du aktuell nicht". Subtitle: "x von y Zielbereichen getroffen" (needed categories) or need-subtitle ("Keine Maske in deinem Bedarf").
3. Dimension bars (from `Stage3FitComparisonDimension`: stops, targetPosition, productPositions): segmented track per dimension, target stops tinted green with inset border, product position as dot (green in-target / red outside / grey when no target), stop labels beneath (target stops bolded green), row header = dimension label + right-aligned "✓/✕ <stop>". `not_needed`: same bars, grey dots, no target zones. Compact categories without dimensions: fall back to criterion rows.
4. "Warum"-block (plum-ice card, uppercase label): "Warum das zu deinem Haar passt" / "Warum nicht" / "Warum du keine <Kategorie> brauchst" — copy from `presentationFor(decision)` / decision reasons. `not_needed` adds a second muted "Gut zu wissen" card (conditions under which this changes).
5. "Passende Alternativen" (Passt + Passt nicht, ≤3): rows with 40px thumb, name, "Brand · Preis · **Kaufen ↗**", "Passt" pill. On **Brauchst du nicht** the same slot renders **"Das übernimmt bei dir: …"** instead — the products/categories already covering this job, sourced from `PlanPortfolioCoverageFact` (coverage[] in the snapshot; job→category mapping exists). Ranked alternatives are undefined without a target; this explains the verdict instead of contradicting it (decided by Nick 2026-08-20).
6. Quiet "Nochmal scannen" text link at list end.

**3 · Pinned footer** (2 slots, identical geometry in all states; labels/weight per verdict):
- Passt: **"Kaufen · <Preis>"** (solid coral) + **"Speichern"** (plum-ice outline)
- Passt nicht: **"Trotzdem kaufen"** (coral outline) + **"Speichern"**
- Brauchst du nicht: **"Speichern"** (solid plum, leads) + **"Trotzdem kaufen"** (coral outline)
- Kaufen opens the product's purchase link (`products.affiliate_link` / purchase URL).

**4 · Save flow**: "Speichern" → mini-sheet "Wohin speichern?" with two options: 🔁 **"Benutze ich schon"** ("Wird Teil deiner Routine und bei Empfehlungen berücksichtigt") and 🔖 **"Auf die Merkliste"** ("Zum später Kaufen — ohne Einfluss auf deine Routine") + Abbrechen. After choosing: toast ("Gespeichert — Teil deiner Routine" / "Auf der Merkliste gespeichert") and the button morphs to "✓ In deiner Routine" / "✓ Gemerkt" (tappable to change).

**5 · Merkliste surface (v1-minimal)**: bookmark icon on the scan screen opens a sheet listing saved products (thumb, name, brand, price, Kaufen ↗, remove). No dedicated page, no nav entry. (Spec gap closed: saving to an invisible list would be broken UX.)

**6 · Unknown-product flow** (2-step, step indicator): Step 1 — eyebrow "NEUES PRODUKT", serif headline "Das kennen wir noch nicht.", lede "Wir recherchieren es für dich — meist innerhalb von 24 Stunden. Was für ein Produkt ist es?", EAN display line, category cards in `ProductKindReviewScreen` style (labels + descriptions from `CATEGORY_COPY`; 5 main + "Weitere Produktart …" expanding the rest), "Weiter" (disabled until selection). Step 2 — "Welche Marke ist es?" with known-brand chips + free brand input + optional product-name input, all optional ("der Barcode reicht meist schon"), "Zur Prüfung einreichen". → Pending screen: 🕐 "Wir prüfen dein Produkt", "Meist innerhalb von 24 Stunden. Du bekommst eine Nachricht im Chat…", ghost "Weiter scannen". Re-scanning an in-review EAN shows this pending state.

**7 · Search/fallback sheet** ("Ohne Scan finden"): opens via link, after ~3s without a stable read, or on camera denial. Name search (reuses `ProductSearchResults` listbox pattern) → tap result → same result sheet via productId. Divider "oder" → manual EAN input (numeric, 8/13 digits, checksum-validated inline, red border + hint on error) → resolve.

## Architecture

```
/scan (client)                          server
camera → barcode-detector ponyfill  →   POST /api/scan/resolve {identifier|productId}
                                          1. rate limit (prefix "scan")
                                          2. snapshot: refined if exists else initial
                                          3. product_identifiers lookup (normalized, direct —
                                             NOT via matchProductIntake)
                                          4a. hit → loadOneProduct facts → evaluate per
                                              decision.role → best verdict + criteria + dims
                                          4b. category not_needed → decision.reasons
                                          4c. miss → open-submission check → unknown
                                        ← render-ready German discriminated union
category picker → submit →              POST /api/scan/submit → submitProductIntake(
                                          source:"scan", identifier → matchProductIntake)
search →                                GET  /api/scan/search (inventory-search machinery)
save →                                  POST /api/scan/save {productId, kind} + DELETE
```

`ScanResolveResult` union: `in_catalog {product, verdict, verdictLabel, evaluatedRole, dimensions[], criteria, coverage{matches,total}, fitNarrative, alternatives≤3, savedState}` | `not_needed {headline, reasons, product?, dimensions[] (no targets), savedState}` | `unknown_product {identifier, categories}` | `pending_submission {submissionId, headline}`.

## Work packages (ordered)

**WP1 — Scan domain core (pure, TDD red-first)**
`src/lib/scan/types.ts`, `role-selection.ts`, `resolve-verdict.ts`, `verdict-labels.ts`. Assembly copies the authority-input template from `src/lib/personal-plan/product-previews.ts:196-225`; per-role evaluation via `evaluateStage3Authority` (`products/authority/evaluate.ts:13`); coverage via `candidateDimensionCoverage` (`comparison-dimensions.ts:59`); dimensions via `comparisonDimensions()`; narrative via `presentationFor` (`decision-presentation.ts:107`); alternatives via `buildStage3FitComparison` (`fit-comparison.ts:126`) — on Passt/Passt nicht, ≤3; for `not_needed`, resolve "Das übernimmt bei dir" entries from the snapshot's `coverage[]` (`PlanPortfolioCoverageFact`: job, primaryCategories, outcome) joined to the user's owned/selected products.
Role selection (new comparator — `compareRankableCandidates` only accepts ideal|supportive): rank ideal > supportive > unknown > mismatch (unknown beats mismatch: mixed role results render honestly as "Unklar"); ties by coverage.matches desc, then cautions asc. Result names the evaluated role.
Tests: `tests/scan-resolve-verdict.test.ts`, `tests/scan-role-selection.test.ts` (not_needed short-circuit, single/multi-role, all-mismatch, ties, alternatives on all verdicts, dimensions pass-through). Reuse personal-plan fixture machinery.

**WP2 — Lookup + snapshot adapters**
Export seam: `loadScanProductFacts` wrapper over module-private `loadOneProduct` (`products/authority/catalog-facts.ts:231`). `src/lib/scan/identifier-lookup.ts` (normalize via `product-identity/normalize.ts:34`, query `idx_product_identifiers_lookup`, ean/gtin/barcode interchangeable; collision → deterministic pick + warn). `src/lib/scan/profile-context.ts` (refined snapshot via `loadRefinedNeedSnapshot` `stage3-persistence-supabase.ts:427` following `production-persistence-gateway.ts` version resolution, else stage1 `loadOrCreate`; emit `snapshot_source`). `pending-submission.ts` (open submission by normalized scanned value). Tests: `tests/scan-identifier-lookup.test.ts`.

**WP3 — Migrations (house style, additive)**
1. Widen `product_submissions_source_check` to include `'scan'` (precedent `20260808062620`).
2. Add `product_submissions.scanned_identifier_type/value` (normalized) + partial index + CHECK (precedent `20260815074148`).
3. NEW `scan_wishlist` table: `id, user_id (FK, RLS owner), product_id (FK), created_at`, unique `(user_id, product_id)`.
4. Only if needed for WP10: catalog-enrichment executor whitelist for `product_identifiers` inserts.

**WP4 — Submission path wiring**
`product-intake/schemas.ts` (optional scannedIdentifier + source "scan"), `repository-types.ts`/`repository.ts` (persist columns), `submissions.ts:791` (pass `identifier` + user-picked category into `matchProductIntake` — already-cataloged EAN auto-links via `identifier_category_exact` instead of spawning research), worker prompt packet (`scripts/product-intake/codex-research-worker.ts` ~1416) includes scanned EAN + optional brand/name as research seed. Category stays user-picked (NOT NULL stands). Extend intake matching/submission tests.

**WP5 — API routes (thin)**
`POST /api/scan/resolve`, `GET /api/scan/search` (over `inventory-search.ts:58-99`; NOT `/api/products` (chaarlie-recommended-filtered), NOT the draft-scoped stage-3 search), `POST /api/scan/submit`, `POST+DELETE /api/scan/save` (kind: `routine` → existing user_products persistence path with source "scan", frequency unknown (engine's existing unknown-frequency handling applies); `merkliste` → scan_wishlist), `GET /api/scan/wishlist`. All: auth, `checkRateLimit(user.id, {prefix:"scan", limit:30, windowMs:60_000})` (fails closed), zod input, render-ready German output.

**WP6 — Route, gating, nav**
`src/app/scan/layout.tsx` (copy `routine/layout.tsx` pattern, PRIVATE_PAGE_METADATA) + `page.tsx` (pure resolver + thin wiring; `resolveScanRouteAccess` in `authenticated-app-route-access.ts` style; quiz-completed required). Add `/scan` + `/api/scan` to `PROTECTED_ROUTE_PREFIXES` (`route-classification.ts`) and `SUB_REQUIRED_PREFIXES` (`supabase/middleware.ts:28`). Center nav tab "Scan": widen literal unions in `navigation-access.ts` (compile-enforced). Extend contract tests: `authenticated-app-route-access`, `auth-intake-state`, `seo-metadata-routes`, `routine-routing-nav`.

**WP7 — Client scanner**
`npm i barcode-detector`. `src/components/scan/scanner.tsx`: getUserMedia environment camera, detect loop (`requestVideoFrameCallback` fallback rAF, formats ean_13/ean_8), rotation-retry on canvas every Nth frame, 2-consecutive-reads debounce, lazy-load wasm after camera permission. Pure + tested: `src/lib/scan/guidance.ts` (telemetry → hint) and EAN checksum helper. Fallback sheet per UI spec §7. Camera denied → search state.

**WP8 — Result UI (per signed-off prototype)**
Sheet component with pinned footer (reuse `ui/bottom-sheet.tsx` drag mechanics), `scan-result-card.tsx` + `scan-dimension-bar.tsx` (NOT `ProductFitComparison`; reuse tokens/primitives). Save mini-sheet + toast + saved-state button morph. Merkliste sheet (§5). Footer variants per verdict (§3). Compact categories: criterion-row fallback.

**WP9 — Analytics**
`ScanAnalyticsPort` mirroring `stage3-analytics.ts` (consent-gated, injected). Triple edit (assertNever-enforced): `analytics/events.ts` + `routes.ts` + `destinations/posthog.ts`. Events: scan_started, scan_decoded {ms,format}, scan_result_shown {verdict, category, in_catalog, snapshot_source}, scan_not_found, scan_submission_created {category}, scan_fallback_search_used {trigger}, scan_saved {kind, verdict}, scan_buy_clicked {verdict}.

**WP10 — EAN backfill (operator-run, parallel after WP3)**
Batch following the catalog-enrichment generate/preflight/apply trio under `scripts/`: research EANs with per-product source URL, checksum + normalize validation, apply via whitelisted executor RPC. Dedup: value already on another product → skip + report, never reassign. Priority: ~50 stage-3 candidate products first. **Ship gate: scanner launches only after priority-50 coverage.** (~30 of 256 active products have barcode identifiers today.)

## Verification

- Unit (red first): scan-resolve-verdict, scan-role-selection, scan-identifier-lookup, scan-guidance, EAN checksum — existing `test:node` glob.
- Contract tests extended (gating, nav, noindex, intake threading, wishlist RLS). `npm run ci:verify`.
- Manual mobile: desktop Chrome first (localhost camera OK, printed EAN). iPhone Safari: repo has no HTTPS tunnel; LAN dev can't grant camera → test on Vercel preview deploy (default). Script: each verdict class incl. not_needed; save both kinds + Merkliste sheet + remove; unknown → picker → brand step → submit → chat notification; re-scan → pending; deny camera → fallback; 3s timeout → sheet; bad checksum error.
- PostHog QA: all events with consent, zero without.

## Non-goals (v1)

No PWA, no scan quota, no OCR/LLM scoring of unknowns, no research automation, no numeric score, no torch/zoom, no scan-history tab, no dedicated Merkliste page (sheet only), no affiliate-disclosure copy (no affiliate live yet — revisit at affiliate launch), no chat-from-scan.

## Risks

1. EAN catalog coverage = adoption risk → launch gated on priority-50 backfill.
2. zxing-wasm decode quality on curved bottles in Safari → build scanner loop early in implementation and field-test on the preview deploy before polishing.
3. Identifier collisions → deterministic pick + log; operator report later.
4. Refined-snapshot version resolution has call-site variants → pin exact logic during implementation.
5. WASM bundle size → lazy-load post-permission.
6. "Benutze ich schon" with unknown frequency: verify the routine engine's existing handling suffices; if it degrades the routine view, capture frequency in a follow-up, not v1.

## Gates status

1. Mockup evidence gate: **confirmed** (v2, 2026-08-20). Artifact: https://claude.ai/code/artifact/df73c2e7-5a84-4903-a6ca-a7b622c17910
2. Prototype/interaction sign-off: **confirmed by Nick 2026-08-20** ("I think I like it") on the clickable prototype incl. sheet transition, unified result states, save flow (variant B), honest-label footer, unknown 2-step flow, search fallback.
3. Open decisions folded in: alternatives on all verdicts; Scan center tab; no disclosure copy yet; Merkliste v1 = sheet on scan screen (specced here — flag if you want it elsewhere). Standing promotion rule (mismatch products never promoted to that user) recorded as recommended, pending adoption.
4. **Worktree**: `npm run worktree:new -- scan-mvp` (verify base == fetched origin/main tip; see feedback_verify_worktree_base), copy plan to `plans/scan-mvp.md` + durable evidence (mockup/prototype artifacts linked; prototype code stays disposable — production is rewritten test-first per prototype contract).
5. Then `implementation-loop` (subagent-driven). Codex review lane DOWN until Sep 15 → one internal reviewer pass instead.
6. Residual micro-question (non-blocking): does "Unklar" name the conflicting role in the subtitle?
