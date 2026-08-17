# Idealplan Konkret — concrete products + fast-path acceptance

**Status:** Approved plan (Approach A), revised after internal plan review (2026-08-16; Codex unavailable — usage limit until Sep 15). Evidence review **confirmed** and user-journey sign-off **obtained** from Nick on 2026-08-16 (mockups: `plans/evidence/idealplan-konkret-mockups.html`, artifact d36c649e).

## Goal

The Stage-1 Idealplan shows concrete products (name, image, price) instead of anonymized examples. After Stage 1, a fork screen lets the user either **accept the plan directly** (creating an accepted, "unverfeinert" routine that unlocks Routine/Anwendung/full nav) or **refine** via the unchanged Stage 2→3 flow. Refinement remains permanently reachable via a dismissible daily nudge on the routine page.

## Decided (do not relitigate)

- Honest framing over pinning: ideal plan = "best given what we know now"; refinement may change picks, framed as "Noch besser für dich", never silently.
- Card layout 1a: product name leads; type + price subline; tap opens detail sheet (no inline expander); "Beispiel" badge removed.
- Detail sheet: image, price, size (data exists: `netContentValue`/`netContentUnit` in catalog facts), availability, the three reasoning blocks from today's expander, refinement hint, coral CTA "Zum Produkt". **No** freshness date, **no** "Ich habe es schon gekauft", **no** affiliate line (see Open questions).
- Fork screen: coral "Feinschliff starten · ca. 2 Min." leads; plum-outline "Plan direkt übernehmen" equally clear below; assumptions block listing this user's actual defaults; reversibility microcopy.
- Guardrails: every basis category renders either a concrete product or the explicit fallback "Produktempfehlung folgt nach dem Feinschliff" — no silent gaps.
- Nudge on `/routine`: dismissible (✕), reappears daily while unrefined, gone after refinement.
- Post-accept refinement ends in the **existing pending-proposal flow** (user explicitly accepts changes) — this IS the "Noch besser für dich" moment, not a silent swap.

## Core architecture decision (from review)

**Direct acceptance drives the real Stage-2→Stage-4 machinery headlessly; it does not synthesize a parallel routine.** `hasAcceptedRoutine` hangs solely on `active_routine_version_id`, written only by `personal_plan_complete_draft_activate_initial_v1`, which validates the full chain (refined need version, active stage-3 draft with matching revisions, complete portfolio, cross-validated product arrays). Stage 5 additionally hard-requires a persisted `kind='refined'` need version (`application-adapter.ts` throws `refined_need_not_found`). Therefore acceptance =

1. Materialize a **synthetic complete Stage-2 answer set** from documented defaults (must satisfy `resolveStage2RefinementContract`: `wetWashFrequency`, heat answers, oil purposes, towel, dry-shampoo bridge, scalp detail, `currentProductCategories: none`). This module is the single source of truth; the fork screen's assumptions block renders from it.
2. Create + complete a refinement draft with those answers → refined need version (`refined_post_plan` projection satisfied — `shampooFrequency` is then known).
3. Create the Stage-3 draft via `buildStage3EntryContext`, auto-resolve **every role** (not category) to `planned_purchase` with the full authority recommendation (`recommendationId`, `productId`, `displayName`, `reason`, `authorityRuleId`); no owned/pending products.
4. Build portfolio (`createProposedProductPortfolio`), compile routine candidate, activate via the existing initial-activation RPC.
5. Record provenance `unrefined_direct_accept` (new column or metadata — migration expected) for the nudge + "unverfeinert" state.

**No edits to `journey-access.ts` or `navigation-access.ts`** — with a real `active_routine_version_id` the gates flip on their own. Editing them would open dead pages.

## Open questions (carry to PR, non-blocking)

- **Affiliate disclosure**: Nick asked to drop it from the Stage-1 sheet; German UWG Kennzeichnungspflicht likely requires it. Implement without, keep one-flag re-addable, needs a legal call before launch.
- **Bondbuilder hardcoded fallback (K18)**: `STAGE1_BONDBUILDER_EXAMPLE_PRODUCT_ID` is an illustration-only constant with no `authorityRuleId`. Decision taken conservatively: **excluded from buyable recommendations** — when the engine has no unique bondbuilder pick, render the post-refinement fallback card instead. Nick may override.

## Tasks (reordered: riskiest persistence work first)

### Task 1 — Default answer set + headless acceptance chain (TDD, core)
**Files:** new `src/lib/personal-plan/direct-acceptance/defaults.ts` (synthetic Stage-2 answer set + German assumption labels), new `src/lib/personal-plan/direct-acceptance/accept.ts` (chain orchestration), new `src/app/api/personal-plan/accept-ideal-plan/route.ts`, migration for provenance (+ nudge dismissal field, see Task 5).
- Chain per architecture decision above. Reuse `stage2-refinement-supabase`, `stage3-persistence-supabase`, `portfolio.ts`, `routine-candidate-compiler.ts`, `routine-proposal-stager.ts` — no forked persistence.
- **Flags:** route refuses unless `stage2Enabled && stage3Enabled && stage4Enabled` (same loaders as `journey-access-loader.ts`).
- **Seen-state integrity:** request carries the per-category `{productId, factFingerprint}` the user saw; server re-evaluates and rejects on mismatch (client re-renders fresh data). Price drift is accepted knowingly (price is outside the fingerprint) — the pinned thing is the product, not the price.
- **Idempotency:** double-accept must resolve via the existing draft rows / `already_completed` paths, never a unique-constraint error (`UNIQUE (plan, parent_need_version, input_hash) WHERE kind='refined'`; `UNIQUE … WHERE status='in_progress'`). Explicit test: user accepts, then later runs real Stage 2 answering exactly the defaults (hash collision path) — must complete cleanly as re-refinement.
- **Post-accept refinement:** verify real Stage-2 re-entry works after synthetic completion and stages a pending proposal (successor path); flag clears on **proposal acceptance**.
- Tests first: contract-completeness of defaults, per-role resolution (incl. `roleMultiplicity > 1` categories), chain success, flag refusal, fingerprint mismatch, idempotency, refine-after-accept.
**Acceptance:** unit tests green; manual: accept → `/routine` shows items, `/anwendung` compiles with **non-empty steps for every planned product that has an application protocol** (not vacuously "compiled"); refine afterwards → pending proposal → accept → flag cleared.

### Task 2 — Preview payload becomes a recommendation payload (TDD)
**Files:** `src/lib/personal-plan/product-previews.ts`, `product-preview-contract.ts`, `src/app/api/personal-plan/stage-1/previews/route.ts`, `products/authorities.ts`, `products/authority/catalog-facts.ts`, extraction from `routine/product-detail-service.ts`.
- **Per-role, not per-category:** replace `firstAllowedRole` with all required roles per `CATEGORY_ROLE_POLICIES`; payload keyed by role; Task 1 consumes the same granularity.
- Add commerce fields: price (`priceEur`), availability (`purchaseLinkStatus`), size (`netContentValue/Unit`), and **add `affiliate_link` to the catalog select** (currently missing). Extract a product-id-keyed commerce resolver shared with `product-detail-service.ts`; decide filter regime = `is_chaarlie_recommended && lifecycle_status='active'` (the planned-item regime).
- Loosen `stage1ExampleVerdictAllowed`: basis categories may surface `supportive` when no `ideal`; emit explicit `fallback: "post_refinement"` otherwise. Remove the bondbuilder hardcoded-ID fallback from the buyable path (see Open questions).
- **Caching:** payload now carries prices — change preview response to `no-store` (or ≤10s private) and adjust warmup accordingly.
- Include per-role reasoning strings for the sheet.
**Acceptance:** policy-matrix tests green; every basis+optional **role** yields recommendation or explicit fallback; `npm run ci:verify` green.

### Task 3 — Stage-1 card 1a + detail sheet
**Files:** `src/components/personal-plan-start/need-card.tsx`, `need-plan-screen.tsx`, `snapshot-adapter.ts`, new `product-detail-sheet.tsx` (reuse `BottomSheet`).
- Per mockup and Decided list. Multi-role categories render one card per role or a grouped card (follow existing card-per-decision structure; keep it minimal). Missing link → "Derzeit kein verifizierter Produktlink", no CTA. Fallback card state per mockup.
- Screen copy swap (example disclaimer → catalog-pick sentence).
**Acceptance:** manual drive of `/plan-start`; cards, sheet, fallback verified.

### Task 4 — Fork screen
**Files:** new `src/components/personal-plan-journey/plan-fork-screen.tsx` (do **not** repurpose shared `chapter-transition.tsx` — it has five call sites), `journey-content.ts`, `plan-start-flow.tsx`.
- **Hoist above `enterStage2`:** the fork renders before any Stage-2 gateway load; "Feinschliff starten" then triggers today's `enterStage2()` (its loading/error states apply only after that choice); "Plan direkt übernehmen" calls the Task-1 endpoint with the seen-state payload, pending + inline error per existing patterns.
- Assumptions block renders from `direct-acceptance/defaults.ts` labels. Accept button hidden when stage flags are off.
**Acceptance:** both paths end-to-end in dev; Stage-2 gateway is not called until Feinschliff chosen.

### Task 5 — Routine nudge
**Files:** `src/components/routine/personal-plan/*` banner, server-side `nudge_dismissed_until` (same migration as Task 1 provenance).
- Show while provenance unrefined; ✕ sets dismissed-until next day (server-side, clock-injected tests); permanent removal on proposal acceptance after refinement; CTA enters Stage 2.
**Acceptance:** dismiss/reappear until-logic tested clock-independently.

### Task 6 — Verification + ship
- `npm run ci:verify`; `npm run test:chat` if dev server running; drive both journeys end-to-end (fast path incl. buy CTA + Anwendung content; refine path unchanged, including refine-after-accept proposal flow).
- Whole-branch counterpart review before push: Codex if quota restored, else the session's internal reviewer lane. Then `/ship`.

## Non-goals

- No changes to Stage 2/3 internals, quiz, checkout/billing, or chat.
- No new size-data ingestion (data already in catalog facts).
- No A/B infrastructure; the fork ships for everyone.
