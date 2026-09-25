# Discovery toolkit — batch 7 refinement plan (Rev. 2)

Status: **Rev. 1 — locked by Nick 2026-09-25 („lock this in … build it")**, D1/D2 ruled 2026-09-25. Rev. 2 = Codex plan review round 1 (6×P1, 2×P2) folded in, see §6.
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

Data — every site named (Codex P1-3); invariant everywhere: `primary_concern` is optional, must be ∈ `concerns`, a stale value is dropped (never a validation failure), and answers without it stay valid:
- Standard quiz: `QuizAnswers.primary_concern?: QuizConcern` (`src/lib/quiz/types.ts`); store `src/lib/quiz/store.ts` (clear on concerns change when no longer contained); `baseQuizAnswersShape` + the strict lead schema and `storedQuizAnswersSchema` in `src/lib/quiz/validators.ts` (strict — without the key the field is stripped/rejected); `canonicalizeQuizAnswers` / `normalizeStoredQuizAnswers` in `src/lib/quiz/normalization.ts` (drop if not contained); lead write `src/app/api/quiz/lead/route.ts`; stored re-read on `src/app/result/[leadId]/page.tsx:~176`.
- Personal-plan quiz: answer model + durable strict schema `src/lib/personal-plan-quiz/persistence.ts:~26`, server-draft schema `src/lib/personal-plan-quiz/server-draft.ts:~43`, draft sanitizer `src/lib/personal-plan-quiz/draft.ts:~95`; the concerns screen and the recurrence prompt/write sites in `personal-plan-quiz.tsx` (~1241 prompt currently calls `resolvePrimaryPersonalPlanConcern`, ~2751 recurrence) switch to the stated pick; `resolvePrimaryPersonalPlanConcern` retired like its standard-quiz twin.
- Migration `hair_profiles.primary_concern text null` (CHECK against the concern vocabulary, NULL allowed). `link-to-profile.ts` writes it (legacy vocabulary projection like `concerns`).

Logic (TDD — `src/lib/quiz/` is test-first territory):
- `resolvePrimaryQuizConcern` (`need-lane.ts:115`) is **retired as the source of truth**: new `resolveStatedPrimaryConcern(answers)` returns `primary_concern` if valid, else the single concern if exactly one, else `null`. `resolveQuizNeed` uses it. The inferred weight ranking is deleted (not kept as fallback — ruling F1.2).
- `result-narrative.ts` / `offer-preview.ts` / `app-value-stack-copy.ts`: when `primaryConcern` is `null` with ≥ 2 concerns (legacy answers without a stated pick), use neutral copy (no „Du hast gesagt, dass dich vor allem … stört"); the existing `!primaryConcern` branches already cover the scalp fallback — extend them for the „several concerns, none stated" case.
- Damage assessment in `src/lib/personal-plan/needs.ts` keeps seeing all concerns (unchanged).

Tests: validator accepts the new key and still accepts old answers without it (standard lead + stored re-read; personal-plan durable + server-draft + sanitizer), stale pick dropped not rejected, canonicalisation drops a stale pick, `resolveStatedPrimaryConcern` table (0/1/≥2 concerns, pick present/absent/stale), narrative copy for legacy multi-concern answers, modal component (≥2 → sheet, 1 → no sheet, back-edit clears stale pick), personal-plan quiz recurrence uses the stated pick.

### 1.2 F2 search (ruling F2, `ScanSearchSheet` shared by discovery + prod scan)

`src/components/scan/scan-search-sheet.tsx`:
1. Catalog lane unchanged (250 ms, ≥ 2 chars) + typo tolerance in `matchCatalogProducts` (`src/lib/scan/catalog-search.ts`): Damerau-Levenshtein per token, 1 edit for tokens ≤ 5 chars, 2 above; exact/prefix matches rank first.
2. dm lane auto-fires after ~500 ms pause at ≥ 3 chars. Rendering change, not only a timer (Codex P2-7): the dm section is no longer gated on `submitted` (`scan-search-sheet.tsx:~552`), and dm catalog matches are no longer merged into the upper live-catalog list (`:~283`) — dm-derived rows (catalog matches and dm-only rows) render in a stable section BELOW the live catalog rows with a loading row; live rows never reorder.
3. `AbortController` on both lanes on top of the token guard.
4. Arrow button stays, optional; arrow/Enter fire dm immediately.
5. Input attributes: `enterKeyHint="search" autoCorrect="off" autoCapitalize="none" spellCheck={false}`.
6. Client cache (query → results, per sheet session) for both lanes.
7. Rate limit: `createScanRoute` (`src/lib/scan/route.ts:44`) hardcodes `SCAN_RATE_LIMIT` for the check and `Retry-After` (Codex P1-4) → add an explicit `rateLimit` config to `createScanRoute` (default `SCAN_RATE_LIMIT`, so other scan routes are unchanged); `/api/scan/search-retailer` passes a new `SCAN_RETAILER_SEARCH_RATE_LIMIT` bucket (own prefix, e.g. 40/min). Test: auto dm searches consume only the retailer bucket and its Retry-After; analytics `scan_retailer_search` gains `trigger: "auto" | "submit"`.

Tests: typo matcher table; typing → auto dm after debounce; immediate Enter/arrow submit; abort of superseded requests; cache hit; 429 from the retailer bucket shows the existing retailer-unavailable state; append-not-reorder; rate-limit bucket routing.

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
- `discovery_intakes.heat_styling jsonb null` + zod schema `DiscoveryHeatStylingV1 = { dryingRoutes: DryingRoute[], additionalHeatTools: AdditionalHeatTool[], heatEvents: Record<\`heat:${Stage2HeatEventSource}\`, { frequency: ProductFrequency, protectionConsistency?: HeatProtectionConsistency }> }` reusing `src/lib/personal-plan/refinement/types.ts` vocab + `heat-events.ts` ids. „Keiner dieser Wege" = `dryingRoutes: []` (same as production `allowNone`), „Keine weiteren Tools" = `additionalHeatTools: []` (Codex P2-8). Cross-field validation at the route (reuse `projectStage2HeatEvents` / `requiresStage2HeatProtection`): exactly one event per heat source implied by the routes + tools (air_dry implies none), no extra keys, `protectionConsistency` present iff the source requires protection. Test the projection the routine builder consumes.
- D1: `usage_role` CHECK `discovery_intake_items_usage_role_pair` + `DISCOVERY_USAGE_ROLES` / `isValidDiscoveryUsage` (`src/lib/discovery/classify.ts`) allow `pre_wash_conditioner` only with `category='conditioner'`.
- D2: `product_type` CHECK + intake zod vocab (`src/lib/discovery/intake.ts:~306`) gain `styling`; a `styling` item has `category IS NULL` AND `product_type='styling'` (new CHECK: styling ⇒ category null, usage_role null). It is NOT „Kategorie offen": the finalize `category_open` block, research auto-enqueue (no `product_submissions` row for styling), verdicts, binding and routine all skip `product_type='styling'`; the cockpit lists it under „Styling (nicht bewertet)". `styling` stays out of `SUPPORTED_PRODUCT_CATEGORY_KEYS` (the 10 categories are untouched).
- Freeze (Codex P1-5 — there is no freeze trigger today; participant writes are route-checked): participant item frequency writes go through the existing app-checked item routes (same guard + accepted race as today's usage PATCH); `heat_styling` write is a compare-and-set `update … where id=$intake and state='draft'` returning the row (0 rows ⇒ 409 `not_draft`). Admin post-submit frequency correction: extend `discovery_admin_set_intake_item_usage` (or a sibling RPC) with `frequency`, same „refuse if finalized" guard. Tests: write after submit ⇒ 409; heat write racing submit ⇒ exactly one wins; admin frequency correction refused on a finalized intake.

APIs (`src/app/api/beratung/intake/…`, all keep same-origin + kill switch + ownership):
- items POST/PATCH accept `frequency` (`.strict()` schemas in `src/lib/discovery/intake.ts`).
- new `PUT /api/beratung/intake/heat-styling` (validated whole object, draft only).
- submit unchanged server-side (does not hard-require frequency/heat — clients mid-session on the old UI must still submit; the new UI enforces answers).

Legacy/in-flight: drafts created on the old UI render in the new UI; items with `frequency IS NULL` show a „Wie oft?" pill that opens the frequency step. Already-submitted intakes are untouched.

### 2.3 Cockpit + engine (TDD for the engine seam)

- Cockpit product list shows each item's frequency; a compact „Hitze & Styling" block (drying, tools with frequency + protection).
- **Idealroutine uses the answers** (ruling F3.3). Build a `PlanRoutineContext` directly from intake data (NOT via `buildPlanRoutineContextFromCompletedRefinement`, whose completeness contract requires towel/night answers we deliberately don't collect): `shampooFrequency` from the most frequent shampoo item, `heatToolUse` from `projectStage2HeatEvents(heat_styling)`, `currentProductLoad` from item categories/oil roles; everything else stays `unknown`.
  Concrete path (Codex P1-1): the single read model `loadDiscoveryCockpitModel` (`src/lib/discovery/cockpit.ts`, shared by the cockpit page, the PDF page and the admin decisions/finalize routes via `src/app/api/admin/beratung/shared.ts`) loads intake items + `heat_styling` BEFORE the ideal routine, builds the override with the pure `buildDiscoveryRoutineContext(items, heatStyling)`, and passes it to `loadDiscoveryIdealRoutine(admin, userId, intakeId, { routineOverride })`. That calls `prepareScannerContext(source, { routineOverride })` (`src/lib/scan/scanner-context.ts`): only on the **initial** path (no Stage-2 refined source — a refined participant keeps her real Feinschliff answers), after the existing base `computeNeedPlan`, it recomputes `computeNeedPlan({ rawEnvelope: source, artifactId: base.snapshot.profile.source.artifactId, projection: "refined_post_plan", computationVersion, createdAt: base.snapshot.createdAt, routine: routineOverride })` and marks `snapshotSource: "discovery_intake"`. The previews (`computeStage1ProductExamplePreviews`) are computed on that same snapshot, so steps and previews stay consistent. Nothing persists: the override path calls no publisher/persistence service (test asserts the admin client sees only the existing reads).
  Legacy protection (Codex P1-2): the override is built ONLY when the intake has new answers (`heat_styling IS NOT NULL` or any item `frequency IS NOT NULL`); otherwise the loader runs exactly today's computation, so steps — and therefore `discoveryRoutineSourceHash` — are unchanged for every legacy/finalized intake. Test: a finalized legacy intake fixture through cockpit model AND PDF page produces its stored hash; a new intake's hash includes the new inputs.
  Unknown heat still yields the deferred heat-protectant step → cockpit shows „Hitzeschutz: im Call fragen" instead of silently dropping it (F3 quick fix; applies to legacy intakes too since it is display-only and not part of the hashed steps — implementer verifies it is outside the hashed payload, otherwise it is gated like the override).
- Pure builder `buildDiscoveryRoutineContext(items, heatStyling)` in `src/lib/discovery/` with rule-ID fixtures (heat-protectant basis/optional/not-needed, leave-in recurring-heat upgrade, shampoo cadence retained vs. unknown).
- Hash invariant: frequency/heat fields enter printed objects and `discoveryRoutineSourceHash` **only when non-null**, and the routine override only runs for intakes with new answers (above), so finalized legacy calls keep their hash (golden hash test stays green). New finalizations include them.
- Admin item-usage correction RPC: also allows correcting `frequency` post-submit (cockpit), same finalize guard.

### 2.4 F7 and F4 (ruled 2026-09-25)

- **D1 conditioner „Vor der Haarwäsche" — RULED (a)**: intake-level only — 4th option on `care_use`, new usage role `pre_wash_conditioner` allowed only with `conditioner`; cockpit shows the usage; routine engine and PDF treat it as a conditioner (rinse-out guide). Binding (Codex P1-6): `refined-routine.ts` role-exact binding (~227) must NOT try to match `pre_wash_conditioner` to a step role — for binding the item behaves like a role-less conditioner (positional per category), so it is never left unassigned. (b, not chosen) full engine support — possible later batch.
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

## 6. Codex plan review round 1 → Rev. 2

Verdict „not ready", no P0. All findings accepted and folded in:
- P1-1 override seam made concrete (single read model, `prepareScannerContext` option on the initial path, previews on the same snapshot, no writes) — §2.3.
- P1-2 override gated on the intake having new answers; legacy finalized hash tested through cockpit + PDF — §2.3.
- P1-3 every quiz validator / sanitizer / write / re-read site named for both quiz flows; old answers stay valid — §1.1.
- P1-4 `createScanRoute` gets an explicit rate-limit config; retailer bucket — §1.2.
- P1-5 no freeze trigger exists → app-level guards + compare-and-set for `heat_styling`, admin frequency correction RPC — §2.2.
- P1-6 D1/D2 were ruled; binding + validation + CHECK + finalize mappings specified — §2.2, §2.4.
- P2-7 dm rendering change (ungate, separate stable section) + tests — §1.2.
- P2-8 heat schema: `[]` for none, cross-field event validation — §2.2.
