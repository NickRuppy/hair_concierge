# Discovery toolkit — batch 7 refinement plan (Rev. 1)

Status: **Rev. 1 — locked by Nick 2026-09-25 („lock this in … build it")**, D1/D2 ruled 2026-09-25, pending Codex plan review.
Inputs: `findings.md` (F1–F9, C1–C6, all rulings), clickable prototype `prototype/index.html` (round 6, the approved flow), research notes cited in `findings.md`.
Base: `origin/main` `ee11a80b`. Worktree `.worktrees/discovery-refinement-b7`, branch `codex/discovery-refinement-b7`.

## 0. Scope and PR split

| PR | Content | Surfaces | Migration |
|---|---|---|---|
| **7a** | F1 main-problem priority, F2 search behaviour | **Production funnels** (`/quiz`, personal-plan quiz), scan search (prod + discovery) | `hair_profiles.primary_concern` |
| **7b** | C1–C6 new participant flow (products → routine → Hitze & Styling → final page), per-product frequency, heat answers, F7 conditioner pre-wash (per D1), F4 sprays (per D2), cockpit shows + uses the new data | Discovery participant + admin cockpit/PDF | `discovery_intake_items.frequency` (+ role/type CHECKs), `discovery_intakes.heat_styling` |
| **7c** | F8 quiz answers on the cockpit, F9 main-problem recipe section | Admin cockpit only | none |

7a and 7c are independent of 7b and can run in parallel worktrees (disjoint files except the cockpit page, where 7c only adds sections above the existing ones). Order of merge: 7a → 7b → 7c (7c reads the stated main problem from 7a).

Workflow per PR (standing): worktree per PR, Opus implementers, `npm run ci:verify`, ONE Codex whole-branch review (lean rule), ship → merge under Nick's standing authorization, prod migrations applied only on Nick's explicit go.

---

## 1. PR 7a — main problem + search

### 1.1 F1 main-problem priority (rulings F1.1–F1.3)

Behaviour:
- Standard quiz (`src/components/quiz/quiz-concerns-question.tsx`, step 8 of `src/app/quiz/page.tsx`) AND personal-plan quiz (`currentConcerns` screen in `src/components/personal-plan-quiz/personal-plan-quiz.tsx`): when she continues with **≥ 2 concerns selected**, a bottom sheet opens: „Wenn du dich auf eins konzentrieren müsstest – was stört dich am meisten?" listing only her selected concerns (same labels as the step). One tap = stated main problem → sheet closes → next step. Exactly one concern → it is the main problem, no sheet. Zero concerns → none.
- Going back and changing the selection clears the stated main problem if it is no longer selected; the sheet asks again on continue.
- Personal-plan quiz: its existing `concernRecurrence` follow-up (`personal-plan-quiz.tsx:~2751`) must use the stated main problem instead of `resolvePrimaryPersonalPlanConcern`.

Data:
- `QuizAnswers.primary_concern?: QuizConcern` (`src/lib/quiz/types.ts`). Add to `baseQuizAnswersShape` in `src/lib/quiz/validators.ts` (the object is `.strict()` — without this the field is silently stripped) with a refinement: `primary_concern ∈ concerns`. Canonicalisation in `normalization.ts` keeps it only if still contained in `concerns`.
- Personal-plan quiz answers: the equivalent field in its answer model + its persistence path (implementer maps it; same invariant).
- Migration `hair_profiles.primary_concern text null` (CHECK against the concern vocabulary, NULL allowed). `link-to-profile.ts` writes it (legacy vocabulary projection like `concerns`).

Logic (TDD — `src/lib/quiz/` is test-first territory):
- `resolvePrimaryQuizConcern` (`need-lane.ts:115`) is **retired as the source of truth**: new `resolveStatedPrimaryConcern(answers)` returns `primary_concern` if valid, else the single concern if exactly one, else `null`. `resolveQuizNeed` uses it. The inferred weight ranking is deleted (not kept as fallback — ruling F1.2).
- `result-narrative.ts` / `offer-preview.ts` / `app-value-stack-copy.ts`: when `primaryConcern` is `null` with ≥ 2 concerns (legacy answers without a stated pick), use neutral copy (no „Du hast gesagt, dass dich vor allem … stört"); the existing `!primaryConcern` branches already cover the scalp fallback — extend them for the „several concerns, none stated" case.
- Damage assessment in `src/lib/personal-plan/needs.ts` keeps seeing all concerns (unchanged).

Tests: validator accepts/strips correctly, canonicalisation drops a stale pick, `resolveStatedPrimaryConcern` table (0/1/≥2 concerns, pick present/absent/stale), narrative copy for legacy multi-concern answers, modal component (≥2 → sheet, 1 → no sheet, back-edit clears stale pick), personal-plan quiz recurrence uses the stated pick.

### 1.2 F2 search (ruling F2, `ScanSearchSheet` shared by discovery + prod scan)

`src/components/scan/scan-search-sheet.tsx`:
1. Catalog lane unchanged (250 ms, ≥ 2 chars) + typo tolerance in `matchCatalogProducts` (`src/lib/scan/catalog-search.ts`): Damerau-Levenshtein per token, 1 edit for tokens ≤ 5 chars, 2 above; exact/prefix matches rank first.
2. dm lane auto-fires after ~500 ms pause at ≥ 3 chars; results append below catalog results with a loading row; never reorder in place.
3. `AbortController` on both lanes on top of the token guard.
4. Arrow button stays, optional; arrow/Enter fire dm immediately.
5. Input attributes: `enterKeyHint="search" autoCorrect="off" autoCapitalize="none" spellCheck={false}`.
6. Client cache (query → results, per sheet session) for both lanes.
7. Rate limit: new `SCAN_RETAILER_SEARCH_RATE_LIMIT` bucket for `/api/scan/search-retailer` (separate from `SCAN_RATE_LIMIT`, e.g. 40/min); analytics `scan_retailer_search` gains `trigger: "auto" | "submit"`.

Tests: typo matcher table, debounce/abort behaviour (fake timers), append-not-reorder, rate-limit bucket routing.

---

## 2. PR 7b — new participant flow + data into the cockpit

Reference: `prototype/index.html` is the approved UX. Copy is the prototype's copy. **No sublines** under titles anywhere (ruling C1b); no underline-only CTAs (C4).

### 2.1 Screens (replace `src/components/discovery/intake/*` UI; keep `intake-api.ts` pattern)

1. **Deine Produkte** (`/beratung/produkte`): title only; search field + „Scannen"; **ghost slots** Shampoo · Conditioner · Leave-in · Maske · Öl · Hitzeschutz + „+ Weiteres"; a captured product morphs into its slot as an iOS-style card (≈ 76×92 packshot, brand·line muted, name bold, plum category capsule, frequency line; tap = edit, × = remove). Sticky coral „Weiter" once ≥ 1 product. No „Nicht gefunden" link on this screen.
2. **One persistent add sheet** (large detent, search auto-focused): search → pick → product pinned as header → usage question (only when ambiguous, existing R9 questions + F7/D1 + D2) → **frequency** → saved → sheet closes, card lands in its slot. In-sheet back chevron. „Selbst eintragen" (outline secondary button) appears only in empty results and at the end of results; typed path in the same sheet: „Wie heißt es?" → „Was ist das?" → usage → frequency. Tapping a ghost slot opens the sheet (typed path pre-sets that category). Barcode scan lands in the same sheet at the pinned-header step.
3. **Frequency step** (ruling round 4): „Wie oft nutzt du es?" for EVERY product, same single-tap list: Täglich · 5–6× pro Woche · 3–4× pro Woche · 2× pro Woche · 1× pro Woche · Alle 2 Wochen · 1× im Monat · Seltener · „Weiß ich nicht". Conditioner and leave-in preselect the most recently saved shampoo's frequency with hint „Wie dein Shampoo" (tap confirms); nothing else preselected; no coupling afterwards.
4. **Deine Routine** (replaces „Passt das so?"): auto-composed day cards from items — **Waschtag** (shampoo, conditioner, leave-in; cadence = most frequent shampoo), **Intensiv-Pflegetag** (mask, bondbuilder, pre-wash oil/conditioner; cadence = mask/bondbuilder frequency), **Zwischendurch** (dry shampoo, finish/leave-on oil, scalp care), **Styling** (heat protectant, product only), plus unassigned/„Kategorie offen" items in a neutral „Weitere" card. Only non-empty cards. Tap product = edit sheet. CTAs: coral „Stimmt so" → heat flow; outline „Noch was ergänzen" → products. Pure composer `composeDiscoveryRoutineDays(items)` in `src/lib/discovery/` (client-safe, own label constants — the DB-seeded day labels are server-only).
5. **Hitze & Styling** — one question per screen, production Feinschliff options/icons/photos (`refinement-options.tsx`), progress bar + back chevron:
   1. „Wie trocknet dein Haar meistens?" multi: Lufttrocknen · Gewöhnlich föhnen · Diffusor oder formender Luftstrom · „Keiner dieser Wege" (production `allowNone`) → „Weiter".
   2. „Nutzt du weitere Hitze-Tools?" photo grid: Föhnbürste · Heißluft-Multistyler · Glätteisen · Lockenstab oder Welleneisen · Thermo-Wickler · „Keine weiteren Tools" → „Weiter".
   3. Per heat source (föhnen, diffusor, each tool): „Wie oft nutzt du <Tool>?" (single tap, same frequency list as the product step but without „Weiß ich nicht" — heat events need a concrete `ProductFrequency`, as in production) → if `requiresStage2HeatProtection(source)`: „Nutzt du dabei Hitzeschutz?" Immer · Manchmal · Nein · Unsicher (single tap).
   No towel / night / scalp questions (ruling F3.2).
6. **Final page** „Alles bereit für unser Gespräch": speech-bubble ornament, one card with three check rows (Fragebogen · Erledigt; Deine Produkte · n Produkte + Waschtag cadence + packshot avatars; Hitze & Styling · tools + photo avatars), rows 2–3 tappable to edit; coral „Abschicken" → existing submit (confirm-none RPC) → done page „Danke! Bis bald im Gespräch." **No reassurance line.**

Motion: sheet spring, content cross-slide 280 ms `cubic-bezier(0.32,0.72,0,1)`, check draw-in; `prefers-reduced-motion` respected. Design tokens from `globals.css` (coral CTA, plum selection).

### 2.2 Data model (migration, service-role-only like the rest)

- `discovery_intake_items.frequency text null` + CHECK `frequency IN (PRODUCT_FREQUENCIES…, 'unknown')`; `none` rows must have `frequency IS NULL`. NULL = not asked (legacy rows), `unknown` = „Weiß ich nicht".
- `discovery_intakes.heat_styling jsonb null` + zod schema `DiscoveryHeatStylingV1 = { dryingRoutes: DryingRoute[] | "none", additionalHeatTools: AdditionalHeatTool[], heatEvents: Record<heat:<source>, { frequency: ProductFrequency, protectionConsistency?: HeatProtectionConsistency }> }` reusing `src/lib/personal-plan/refinement/types.ts` vocab + `heat-events.ts` ids.
- F7 / D2 CHECK changes (usage_role pair / product_type) per the decisions.
- Draft-freeze trigger/RPCs extended so both new fields are only writable while `state='draft'` (participant) — same freeze as today.

APIs (`src/app/api/beratung/intake/…`, all keep same-origin + kill switch + ownership):
- items POST/PATCH accept `frequency` (`.strict()` schemas in `src/lib/discovery/intake.ts`).
- new `PUT /api/beratung/intake/heat-styling` (validated whole object, draft only).
- submit unchanged server-side (does not hard-require frequency/heat — clients mid-session on the old UI must still submit; the new UI enforces answers).

Legacy/in-flight: drafts created on the old UI render in the new UI; items with `frequency IS NULL` show a „Wie oft?" pill that opens the frequency step. Already-submitted intakes are untouched.

### 2.3 Cockpit + engine (TDD for the engine seam)

- Cockpit product list shows each item's frequency; a compact „Hitze & Styling" block (drying, tools with frequency + protection).
- **Idealroutine uses the answers** (ruling F3.3): build a `PlanRoutineContext` directly from intake data (NOT via `buildPlanRoutineContextFromCompletedRefinement`, whose completeness contract requires towel/night answers we deliberately don't collect): `shampooFrequency` from the most frequent shampoo item, `heatToolUse` via `projectStage2HeatEvents`-equivalent projection of `heat_styling`, `currentProductLoad` from item categories/oil roles; everything else stays `unknown`. Seam: optional `routineContextOverride` parameter on `loadDiscoveryIdealRoutine` → `computeNeedPlan` (read-only path preserved; no writes). Unknown heat still yields the deferred heat-protectant step → cockpit shows „Hitzeschutz: im Call fragen" instead of silently dropping it (F3 quick fix).
- Pure builder `buildDiscoveryRoutineContext(items, heatStyling)` in `src/lib/discovery/` with rule-ID fixtures (heat-protectant basis/optional/not-needed, leave-in recurring-heat upgrade, shampoo cadence retained vs. unknown).
- Hash invariant: frequency/heat fields enter printed objects and `discoveryRoutineSourceHash` **only when non-null**, so finalized legacy calls keep their hash (golden hash test stays green). New finalizations include them.
- Admin item-usage correction RPC: also allows correcting `frequency` post-submit (cockpit), same finalize guard.

### 2.4 F7 and F4 (ruled 2026-09-25)

- **D1 conditioner „Vor der Haarwäsche" — RULED (a)**: intake-level only — 4th option on `care_use`, new usage role `pre_wash_conditioner` allowed only with `conditioner`; cockpit shows the usage; routine engine and PDF treat it as a conditioner (rinse-out guide). (b, not chosen) full engine support — possible later batch.
- **D2 sprays — RULED (a)**, with Nick's copy note (the care option must clearly read as a leave-in care spray): names with „Spray" and no clear type get „Wofür nutzt du das Spray?": Hitzeschutz · Pflegespray – bleibt im Haar (Leave-in) (→ leave-in) · Styling & Halt (→ new non-evaluated type `styling`) · Weiß ich nicht. `styling` items are listed in the cockpit as „Styling (nicht bewertet)", never block finalize, never enter verdicts/routine. Overnight sprays → the Pflegespray (Leave-in) option. (b, not chosen) keep today.

Tests: frequency CHECK/API validation, heat-styling schema, legacy draft rendering, `composeDiscoveryRoutineDays` table, `buildDiscoveryRoutineContext` rule fixtures, hash golden test, participant flow component tests (add sheet steps, preselect hint, heat flow branching incl. protection skip for plain föhnen, final page), same-origin on the new route.

---

## 3. PR 7c — cockpit quiz answers + main-problem recipe

### 3.1 F8 quiz answers
Section „Quiz-Antworten" at the top of `/admin/beratung/[enrollmentId]`: question label → her answer in German, from `leads.quiz_answers` (standard quiz labels `src/lib/quiz/questions.ts`; personal-plan quiz labels `quiz-data.ts`, texture-aware), main problem highlighted (from 7a). Read-only; missing answers shown as „—".

### 3.2 F9 main-problem recipe (ruling F1.3: internal, research once per problem)
- Research lane (hair-care-expert, pinned opus) turns `docs/research/goal-concern-levers/` into a structured recipe per quiz concern (`dry_lengths, frizz_flyaways, low_shine, lost_shape, low_volume_or_weighed_down, hair_damage, breakage, split_ends, tangling, hair_loss_or_thinning`): primary product categories + non-product levers, conditional categories with profile modifiers (texture/thickness/damage), weak-first/avoid, safety boundary. Output committed as `docs/research/concern-recipes/` (markdown + evidence labels) and a typed table `src/lib/discovery/concern-recipes.ts`. `hair_loss_or_thinning` = boundary only (medical), no product recipe. Three goal-mapped concerns (`low_shine`, `lost_shape`, `low_volume_or_weighed_down`) get an explicit review note.
- Cockpit section „Hauptproblem: <label>" below the quiz answers: recipe (primary / conditional for her profile / avoid) and, per primary category, whether she already has it (from intake) and whether the Idealroutine contains it. Internal only — nothing user-facing, no PDF change.
- Tests: table completeness (every concern code covered), profile-modifier selection, coverage computation.

---

## 4. Verification

Per PR: `npm run ci:verify` (+ `test:node` / `test:personal-plan` as relevant). 7a: drive `/quiz` locally through the concerns step (≥2 / 1 / back-edit) and the result page; scan search in the browser (typo, auto dm, abort). 7b: local walkthrough of the full participant flow in the iOS Simulator against a local dev server (fresh test enrollment, Nick's go needed for the prod-DB enrollment write), cockpit shows frequency + heat block, Idealroutine includes heat protectant for a straightener user and not for an air-dryer. 7c: cockpit render for a legacy and a new participant.

## 5. Risks / accepted

- 7a changes the production funnel (extra sheet for ≥ 2 concerns) — ruled; watch PostHog drop-off at the concerns step after deploy.
- Hash drift for finalized calls avoided by null-omission; an admin re-finalize after editing a frequency drifts by design.
- dm auto-search increases dm lane traffic; bounded by debounce, abort, own bucket, cache.
- Engine seam touches the read-only ideal-routine path — override must not introduce writes (test asserts no write client calls).
