# S2 — Profile-based picks (slice plan)

**Status:** Draft Rev. 1, 2026-10-09. Implementation-ready, pending the two questions in §10.
**Program:** `plans/catalog-completeness-fill/plan.md` §2 (S2), §8b S2(a–d), §11 F06/F07. **Rulings:** `decisions.md` S1, D-a, D-h. Do not relitigate these.
**Base:** `origin/main` 320940f4 (includes #654 Budget + Profi, #655 segment backfill, #657 Shampoo v1.6 lock). Every file reference below is to that tree. `.worktrees/catalog-completeness-fill` already merges it (57ae223f).
**Live data:** all values read from prod on 2026-10-09 (SELECT only).

## Integration with main #669 (2026-10-13)

Decision coverage is confirmed by Nick's integration request and follow-up: main's canonical gates, additive distance rule, labels and actions govern. Q1 remains A (universal and matching tint are equal fits); S2 profile transport, compact rows, shared ranking, soft deep-cleansing positioning and discovery colour are retained. Nick explicitly authorized updating the two uncovered dry-shampoo expectations to the selected candidate's canonical verdict, with #669 comments. No publication or live-data actions are authorized.

The three category adapters use `evaluateGateCriteria`; dry-shampoo sensitivity, tint and volume direction are binary distance axes. Two or more combined misses now produce `mismatch` rather than the pre-merge S2 `supportive`; the D1–D6 and surface-parity fixture winners remain unchanged. Missing root colour still adds one step for a tinted product under the pinned S2 rule. The optional legacy `dryShampooTarget` input retains #669's nullable-axis semantics; production callers use the shared profile.

The additive schema-only migration is `supabase/migrations/20261013140000_deep_cleansing_target_scalp_types.sql`, ordered after main's `20261013120000`. It does not backfill targets or activate S2b. The focused integration run passed 684 tests, including S2, authority/comparison, scan/mobile, migration checks and the #669 category matrix. `npm run test:personal-plan` passed 3,718 tests with one real-PostgreSQL test skipped. The final `node node_modules/typescript/bin/tsc --noEmit` has only two local-environment blockers: installed Next 16.2.4 versus the merged manifest's ^16.3.8 (`agentRules` type unavailable), and stale `.next/types/validator.ts` referencing the removed Stripe session route. Five new #669 scanner fixtures now supply the required neutral S2 profile; the final focused rerun again passed all 684 tests. No network, external database, browser or Claude CLI verification was performed under the offline boundary.

## 0. Outcome in one paragraph

Dry shampoo, deep-cleansing shampoo and scalp care stop picking "first in the catalogue for everyone". All three now go through the shared Stage-3 comparator (`candidate-ranking.ts`): **verdict (ideal before supportive) → targetMatchCount (more passed user-need rows) → fewer cautions → catalogue order → lower price → product id**. The profile answers each category needs reach the evaluator through one typed slice built in one place. Deep cleansing gets its scalp fit from Shampoo v1.6 §13.5 targets computed on the deep cleansers' formulas (D-a). The #654 budget policy runs afterwards, unchanged. There is no new screen. Users see different products, and the existing compact fit table gets up to three more rows.

---

## 1. Behaviour per category

### 1.1 Shared comparator semantics (unchanged code, new users)

`compareRankableCandidates` (`src/lib/personal-plan/products/candidate-ranking.ts:23-44`) gets each candidate's numbers from that category's single `evaluateFacts(input, facts)`:

| Key | Source for these three (compact) categories |
|---|---|
| `verdict` | `ideal` = no `fail`/`unknown`/`caution` criterion; `supportive` = at least one `caution`, no `fail`/`unknown`. Only ideal and supportive are rankable. |
| `targetMatchCount` | `candidateDimensionCoverage(input, candidate, criteria).matches` (`comparison-dimensions.ts:83-122`). These categories have no comparison dimensions (`comparison-dimensions.ts:187-191`), so it counts the `compactCriterionSchema(category, role)` rows whose criterion is `pass` (`fit-comparison-schema.ts`). **A user-need row only counts if it is in the compact schema.** |
| `cautionCount` | every criterion with `result === "caution"`, rendered or not |
| `catalogSortOrder` | `products.sort_order`; null = last |
| `priceEur` | `products.price_eur`; null = last |

The same function feeds the authority's own pick, the fit-comparison alternatives (`fit-comparison.ts:400-425`, detached evaluation `:572-589` spreads `...input`, so the profile slice reaches it automatically), previews, and scan. None of these categories has an authority pin (unlike the Bondbuilder K18 tie default), so `compareWithAuthorityPin` reduces to the plain comparator. The web alternatives filter (`targetCount > 0 && targetMatchCount > 0`, `fit-comparison.ts:419`) never drops a candidate here, because the identity, role and protocol rows always pass.

**#654 budget after fit (unchanged policy).** `allocateBudgetPortfolio` (`budget-policy.ts:581`) receives the ranked list:
- **No saved budget** (`null`): price-neutral. The fit winner is the pick.
- **Capped** (`Bis 5 €` / `Bis 15 €`): the default is the first candidate *in fit order* at or under the cap. None of the three categories has a `BUDGET_NEED_DIMENSIONS` entry, so improvement exceptions never fire. A strict cap with nothing affordable sets `strict_none_affordable`. A flexible cap on a required role with nothing affordable uses a gap exception.
- **Uncapped:** the 60 % "above 15 €" nudge may swap a default for a fit-comparable product over 15 € (`budget-policy.ts:515-575`). Here that can only reach scalp care, because Eucerin (16,95 €) and The Ordinary (26,50 €) are the only products in these categories above 15 €. This is #654 behaviour and S2 does not change it.

### 1.2 Dry shampoo (`root_refresh_bridge`)

**Fit rules.** These are `docs/personal-plan/categories/dry-shampoo/decision.md` "Stage 2 fit", implemented for the first time. Every rule is a criterion in `evaluateFacts`:

| Criterion (compact row) | Profile input | pass | caution (→ supportive) |
|---|---|---|---|
| `dry_shampoo.identity.active` „Aktive Produktidentität" | — | active, no known reaction | (fail → mismatch, as today) |
| `dry_shampoo.sensitivity.verified` „Kopfhautverträglichkeit" | `sensitiveScalp` | not sensitive (either positioning); sensitive + `sensitive_ok` | sensitive + `normal_only` |
| `dry_shampoo.tint.verified` „Farbpassung" **(newly rendered)** | `visibleHairColor` | `universal`; or the tint matches the colour (`blonde_light`↔`light_blonde`, `brown`↔`brown`, `dark`↔`dark`) | the tint does not match the colour; or a tinted product and the colour is unknown |
| `dry_shampoo.styling.direction` „Volumen" **(new)** | `volumeDirection` | direction null; `more` + `volume_texture`; `less` + standard | `more` + standard; `less` + `volume_texture` |
| `dry_shampoo.protocol.verified` „Verifizierte Anwendung" | — | verified protocol | (missing → unknown, as today) |

"Standard" means `classic_refresh` **or** legacy `sensitive_refresh`. The doc's schema cutover (`sensitive_refresh` → `standard_refresh`) stays out of scope. The adapter maps both values to standard, and sensitivity comes only from `scalp_sensitivity_fit`. A missing product fact still returns `unknown`, as today. Uncovered-role output keeps its current shape (`verdict: "unknown"` plus the `dry_shampoo.selection.uncovered_role` caution). Only the chosen `recommendation` changes. Rule id: `dry_shampoo.selection.shared_rank` (replaces `stable_first_entered_verified`).

**Live catalogue** (10 active recommended, 2026-10-09):

| sort | product | € | effect | colour | sensitivity |
|---|---|---|---|---|---|
| 9201 | Batiste Original | 3,75 | classic | universal | normal_only |
| 9202 | ISANA Jedes Haar | 1,99 | classic | universal | normal_only |
| 9203 | Balea Kopfhaut Sensitive | 1,95 | sensitive_refresh | universal | sensitive_ok |
| 9204 | Batiste Sensible Kopfhaut | 3,95 | sensitive_refresh | universal | sensitive_ok |
| 9205 | Balea Schaum Kopfhaut Sensitive | 1,45 | sensitive_refresh | universal | sensitive_ok |
| 9206 | got2b Liquid to Dry | 3,95 | classic | universal | normal_only |
| 9207 | got2b Extra Volumen | 3,95 | volume_texture | universal | normal_only |
| 9208 | Batiste Blond | 3,95 | classic | blonde_light | normal_only |
| 9209 | Batiste Brünett | 3,99 | classic | brown | normal_only |
| 9210 | Batiste dunkel | 3,95 | classic | dark | normal_only |

**Worked examples** (no budget; dry-shampoo need present):

| # | Profile | Ideal set | Winner | Today |
|---|---|---|---|---|
| D1 | normal scalp, no volume direction, colour not answered | 9201–9207 (tinted 9208–9210 supportive: colour unknown) | **Batiste Original** (9201) | Batiste Original |
| D2 | sensitive scalp (quiz `irritated`), no direction, brown | 9203, 9204, 9205 (all others supportive: `normal_only`) | **Balea Kopfhaut Sensitive** (9203, 1,95 €) | Batiste Original |
| D3 | volume `more` (straight, fine, `volume_balance` or `low_volume_or_weighed_down`), normal scalp, brown | 9207 only | **got2b Extra Volumen** (3,95 €) | Batiste Original |
| D4 | volume `more` + sensitive (2 live users) | none. 9203–9205 supportive (Volumen caution); 9207 supportive (sensitivity caution); 9201 etc. supportive with 2 cautions | tie on verdict, matches and cautions, so catalogue order → **Balea Kopfhaut Sensitive** (9203) | Batiste Original |
| D5 | brown, normal scalp, no direction | 9201–9207 + Brünett 9209; Blond/dunkel supportive | **Batiste Original** (catalogue order; see Q1) | Batiste Original |
| D6 | volume `less` (curly/coily/coarse + `volume_balance`) | everything except 9207 and the wrong/unknown tints | **Batiste Original** | Batiste Original |
| D7 | owns Batiste Brünett, colour `light_blonde` | owned verdict **supportive** („Farbpassung: passt mit Einschränkung"), `keep_owned` still allowed; replacement shown = D1 winner | — | ideal |
| D8 | D3 + strict budget Bis 5 € | fit order 9207 (3,95 €, affordable) | **got2b Extra Volumen** (≤ 5 €) | — |

D4 gives the order the doc wants (sensitivity before styling) only because of catalogue order. A named fixture pins it (T2.4). Live reach: 11 profiles use dry shampoo (10 own one, 1 accepted the bridge). Of these, 2 are sensitive, 5 have a volume goal (all straight/fine → `more`), and 2 are both. Visible colour answers (all `user` provenance): brown 6, light_blonde 4, dark 1.

### 1.3 Deep-cleansing shampoo (`residue_reset`; `mineral_reset` unchanged)

**Fit rule** (`deep-cleansing/decision.md` "Stage 2 fit", step 4, soft rank): hard gates are unchanged (lifecycle, reaction, `supportedResetRoles ∋ role`, verified protocol). One new **soft** criterion is added:

| Criterion (compact row, new) | Profile input | pass | otherwise |
|---|---|---|---|
| `deep_cleansing.scalp_target` „Kopfhauttyp" | `scalpOiliness` (`oily`/`balanced`/`dry`) | product `targetScalpTypes` contains the user's scalp type | **no criterion emitted**. The row shows „nicht bestätigt". The verdict stays `ideal` and no caution is added, so a general product still „passt sehr gut" (doc fixture 16). |

Products with `targetScalpTypes` null (not yet engine-run) or `[]` (engine: no explicit scalp positioning) never match. Owned products keep `ideal`, with no forced switch. Rule id stays `deep_cleansing.stage3.validated_reset_role`. The pick becomes `rank(ideal candidates)[0]` instead of `find(ideal)`.

**Live catalogue** (5 active recommended; `scalp_type_focus` is the legacy single value):

| sort | product | € | legacy focus | expected v1.6 §13.5 targets → `targetScalpTypes` *(T2.9 confirms)* |
|---|---|---|---|---|
| 9301 | NEQI Deep Cleansing Shampoo `07895098` | 12,99 | balanced | dry claim („besonders bei trockener und juckender Kopfhaut") → `['dry']` if the S-DRY formula gate passes, else `[]` |
| 9302 | Swiss-O-Par Tiefenreinigung `898a5a1e` | 2,45 | balanced | no scalp claim („Für jeden Haartyp") → ordinary → `[]` |
| 9303 | Balea Tiefenreinigung `375ee7a0` | 1,25 | oily | v1.6 calibration (L10/U1, both lanes): **ordinary** → `[]` |
| 9304 | ISANA Professional Tiefenreinigung `ae0e9d21` | 1,29 | balanced | „für alle Haartypen" → `[]` |
| 9305 | Gliss Tiefenreinigungs-Shampoo `05753f93` | 5,95 | oily | „speziell für ölige Kopfhaut" → `['oily']` if the S-OILY formula gate passes |

**Worked examples** (residue_reset, no budget):

| # | User scalp | Matched | Winner (expected) | If not engine-confirmed | Today |
|---|---|---|---|---|---|
| C1 | oily | Gliss | **Gliss** (5,95 €) | NEQI (catalogue order) | NEQI |
| C2 | dry | NEQI | **NEQI** | NEQI | NEQI |
| C3 | balanced | none (ordinary maps to `[]`, P4) | **NEQI** (catalogue order) | NEQI | NEQI |
| C4 | any; all targets null (before backfill) | none | **NEQI**, identical to today. The code ships inert. | — | NEQI |
| C5 | oily + strict Bis 5 € | Gliss (5,95 € over cap) | **Swiss-O-Par** (2,45 €, first affordable in fit order); Gliss shown over budget | — | — |
| C6 | owns ISANA, oily | — | owned ISANA `ideal`, `keep_owned`. The „Kopfhauttyp" row says „nicht bestätigt" and nothing forces a switch | — | ideal |

Live reach: 19 real members' completed plans recommend NEQI (17 oily, 1 balanced, 1 dry). Completed plans are frozen (§7). Profiles by scalp type: oily 56, balanced 95, dry 27 (of 180).

### 1.4 Scalp care (all four roles)

**Fit:** unchanged. The role already encodes the profile upstream (`categories/scalp-care.ts`), and the exfoliant suppression (`coverageSuppressesPurchase`) is unchanged. **Selection:** the shared comparator replaces raw UUID order (`authority/categories/scalp-care.ts:61-77`). Every candidate in a role is ideal with 3/3 rows and no cautions, and every row has `sort_order = 0`. So **catalogue order ties and price decides** (S1).

| Role | Candidates (€) | Winner | Today |
|---|---|---|---|
| `scalp_comfort` | Balea Serum Sensitive 2,95 · H&S Leave-In 5,95 · Eucerin Tonikum 16,95 | **Balea Serum Sensitive** | same |
| `scalp_flake_oil_adjunct` | Gliss Klärendes Serum 8,95 (only one) | **Gliss** | same |
| `scalp_exfoliant` | Balea Peeling 2,95 · Isana Peeling 2,99 | **Balea Peeling** | Isana |
| `density_claim_tonic` (before S1) | L'Oréal Anti-Haarverlust 13,99 · The Ordinary 26,50 | **L'Oréal** | same |
| `density_claim_tonic` (after S1 T1.5 publishes Neqi Rosemary Oil 9,95 € with a verified density protocol) | + Neqi 9,95 | **Neqi Smooth Strength Rosemary Oil** (see Q2) | L'Oréal |

Uncapped budget (#654) may still nudge comfort → Eucerin or density → The Ordinary (both above 15 €, fit-comparable). That is existing behaviour, and a named regression test documents it (T2.5).

---

## 2. Data dependency: deep-cleansing scalp targets (F07)

### 2.1 Storage — **new nullable array column** (P1)

Migration `supabase/migrations/<ts>_deep_cleansing_target_scalp_types.sql` (schema only, additive):

```sql
CREATE OR REPLACE FUNCTION public.deep_cleansing_scalp_types_valid(v text[])
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v IS NULL OR (
    v <@ ARRAY['oily','balanced','dry']::text[]
    AND cardinality(v) = (SELECT count(DISTINCT x) FROM unnest(v) x)
    AND NOT (v @> ARRAY['oily','dry']::text[])          -- v1.6 S-SECONDARY: never oily + dry
  )
$$;
ALTER TABLE public.product_deep_cleansing_shampoo_specs
  ADD COLUMN target_scalp_types text[] NULL
  CONSTRAINT product_deep_cleansing_target_scalp_types_check
    CHECK (public.deep_cleansing_scalp_types_valid(target_scalp_types));
COMMENT ON COLUMN public.product_deep_cleansing_shampoo_specs.target_scalp_types IS
  'Soft scalp-target positioning. NULL = not engine-assessed; {} = assessed, no explicit target. Source: Shampoo v1.6 §13.5 (decisions.md D-a).';
```

(A helper function, because Postgres forbids subqueries inside CHECK.) No publication-gate change: the column is soft and nullable, `validate_personal_plan_curated_publication_dependency` and `catalog-authority/audit-reader.ts:353-358` keep their current required set, and a new deep cleanser published through intake gets NULL (no soft rank) until the engine runs.

**Provenance** goes in the existing `personal_plan_catalog_fact_evidence`: one row per product, `fact_key = 'deep_cleansing.target_scalp_types'`, `source_type = 'internal_verified'`, `source_label = 'Shampoo v1.6 §13.5 (Engine)'`, `source_url` = GitHub blob URL of the frozen projection artifact (precedent: GF-20260816 rows), `source_text` = German summary of the projected target plus the gate verdicts, `fact_value` = `{targetScalpTypes, v16Primary, v16Secondary, confidence, reviewFlags, laneAgreement, packetSha256}`, plus `batch_id`, `batch_fingerprint` and `content_fingerprint` from the generator.

### 2.2 Who computes it, and where the artifact lives

| Step | Owner | Location |
|---|---|---|
| Freeze packets (INCI + claims + directions) for the 4 deep cleansers without a shampoo twin: NEQI `07895098` (GTIN 4063528103192), Swiss-O-Par `898a5a1e` (4104260073500), ISANA `ae0e9d21` (4068134135490), Gliss `05753f93` (4015100893007) | Shampoo v1.6 program, rollout lane `.worktrees/shampoo-v16-rollout` (Sonnet freeze workers per `plans/shampoo-v16-rollout/track-a/freeze-brief.md`) | new slots `D01–D04` in `data/research/shampoo-inci/v1.6-track-a/packets/` (that program's `.gitignore` allow rule covers the folder) |
| Balea `375ee7a0` | reuse Track A packet `U1-balea-tiefenreinigung.json` (same GTIN 4070765001020; packet keyed to shampoo twin `0f71ff9d`), with a mapping note | — |
| Two blind lanes + compare (`scripts/shampoo-research/build-lane-kit.ts`, `compare-lanes.ts`); Nick reviews flags/differences (v1.6 runbook) | Shampoo v1.6 program | lane outputs alongside Track A |
| Projection → deep-cleansing targets: `ordinary`→`[]`, `oily`→`oily`, `dry`→`dry`; `sensitive`/`dandruff` → dropped (recorded in `fact_value`, no deep-cleansing vocabulary; deep cleansing already pauses for irritated/dry-dandruff users); `needs_research` → leave NULL | this slice (T2.10) | `plans/catalog-completeness-fill/slice2/scalp-targets.json` (per product: productId, packet path + sha256, lane outputs sha256, v1.6 primary/secondary, confidence, flags, mapped `targetScalpTypes`) |

The v1.6 engine is not re-run here. S2 consumes its frozen output. Coordination with the Shampoo v1.6 program: Track D is 4 packets plus 1 reuse, scheduled with Track A.

### 2.3 Backfill migration

`supabase/migrations/<ts>_deep_cleansing_target_scalp_types_backfill.sql`, generated by `plans/catalog-completeness-fill/slice2/generate.ts` from `scalp-targets.json` (same pattern as `slice1/`: `prestate.json`, `target-state.json`, `rollback.sql`, `verify.sql`, `artifact-manifest.json`):
- CAS guard per row: `target_scalp_types IS NULL` and the captured product fingerprint (`is_active`, `lifecycle_status`, `is_chaarlie_recommended`, `reset_focus`). Any mismatch raises and the migration fails closed.
- Writes the 5 `target_scalp_types` values plus 5 evidence rows in one transaction.
- Rollback sets the 5 values back to NULL and deletes those evidence rows by `batch_id`.
- PGlite rehearsal on seeded prestate covers migration, verify, rollback, reapply, and a tamper case (preimage changed → abort).
- Applied to prod only after Nick approves the exact batch fingerprint.

### 2.4 Adapter / catalog-facts / legacy column

- `authority/contracts.ts` `Stage3DeepCleansingFacts.spec`: **replace** `scalpTypeFocus: string | null` with `targetScalpTypes: Array<"oily"|"balanced"|"dry"> | null`. Keep `supportedResetRoles` and `colorTreatedSuitability` (unread, out of scope).
- `authority/catalog-facts.ts:743-757`: read `target_scalp_types`. Invalid values → null (fail closed: no soft rank). The fact fingerprint therefore changes for all deep cleansers (see risk R3).
- Legacy `scalp_type_focus` (NOT NULL, single value): **frozen, not synced** (P5). Stage 3 stops reading it. Its readers stay as they are: the legacy chat engine (`recommendation-engine/selection.ts:1406`), `agent/tools/select-products.ts`, admin, and intake validators. Record a residual-ledger entry that the legacy chat ranking can disagree (e.g. Balea `oily` vs v1.6 ordinary). The legacy chat engine is a program non-goal.
- `src/types/database.ts` (generated types) gets the new column.
- `docs/personal-plan/categories/deep-cleansing/decision.md` amendment: targets come from v1.6 §13.5 on the formula (D-a), which supersedes "not ingredient inference" for this field; `ordinary` = `[]`; the orientation table is replaced by the engine artifact.

---

## 3. Profile plumbing (F06)

### 3.1 The typed slice

New file `src/lib/personal-plan/products/authority/selection-profile.ts`:

```ts
export type Stage3VisibleHairColor = "light_blonde" | "brown" | "dark"

export type Stage3SelectionProfile = Readonly<{
  /** Quiz `scalpOiliness`; deep-cleansing soft target. */
  scalpOiliness: PlanScalpOiliness | null
  /** Quiz scalp concern `irritated` („gereizt oder empfindlich"); dry-shampoo sensitivity. */
  sensitiveScalp: boolean
  /** Derived; dry-shampoo styling direction. null = no direction. */
  volumeDirection: "more" | "less" | null
  /** Stage-2 answer with `user` provenance only; null = unknown. */
  visibleHairColor: Stage3VisibleHairColor | null
}>

export const UNKNOWN_SELECTION_PROFILE: Stage3SelectionProfile

export function buildStage3SelectionProfile(
  snapshot: InitialNeedPlanSnapshot,
  visibleHairColor: Stage3VisibleHairColor | null,
): Stage3SelectionProfile
```

`Stage3AuthorityInput` (`authority/contracts.ts:203-229`) gains a **required** `selectionProfile: Stage3SelectionProfile`. Required means the compiler finds every builder. Literal builders cast with `as Stage3AuthorityInput`, so T2.3 also adds a per-site test.

| Field | Source (traced) | Missing-value behaviour |
|---|---|---|
| `scalpOiliness` | `snapshot.profile.scalp.oiliness` (`types.ts:148`; quiz `scalpOiliness`, required `oily\|balanced\|dry`, `personal-plan-quiz/persistence.ts:53`) | null only for `UNKNOWN_SELECTION_PROFILE` → no deep-cleansing target match (today's order) |
| `sensitiveScalp` | `snapshot.profile.scalp.concerns.includes("irritated")` (`types.ts:149`; quiz `scalpConcerns`). Deliberately **not** `irritationState`, because the detail answer can be the assumed default `normal` (`assumed-defaults.ts:52`). Active symptoms already pause execution elsewhere, and the dry-shampoo doc ties sensitivity to „gereizt" (P3) | always boolean |
| `volumeDirection` | `planVolumeDirection(profile)`, **extracted unchanged** from the conditioner weight rule (`personal-plan/categories/conditioner.ts:116-133`): `concerns ∋ low_volume_or_weighed_down` → `more`; else `goals ∋ volume_balance` → control route (curly/coily, coarse, or wavy + `shape_definition`/`lost_shape`) ? `less` : `more`; else null. Conditioner calls the shared helper (behaviour-preserving) | null = no styling-direction criterion caution |
| `visibleHairColor` | `hair_profiles.care_habits.dryShampooVisibleHairColor` (`user-facts/schema.ts:332`) **only when** `facts_provenance.care_habits.fields.dryShampooVisibleHairColor === "user"` (live: 11/11 are `user`). Written by the refinement (`from-refinement-draft.ts`) and by profile edits. Not in the need snapshot (`PlanRoutineContext` has no field), so it is loaded next to the snapshot (P2) | null → tinted products get the tint caution (never ideal); universal unaffected |

Colour loader: `src/lib/user-facts/visible-hair-color.ts` → `readUserVisibleHairColor(careHabits: unknown, provenance: unknown): Stage3VisibleHairColor | null` (pure, zod-parsed; an invalid value returns null) plus `loadVisibleHairColor(client, userId)` (one `hair_profiles` select of `care_habits, facts_provenance`; read errors return null, logged; never blocks a plan or a scan).

### 3.2 Every input-building site

| Site (origin/main) | Change |
|---|---|
| **Production gateway** `products/production-persistence-gateway.ts` `loadEvaluationContext` (741-785) + `rawAuthorityAssessment` (504-546) | `Stage3EvaluationContext` (`authority/contracts.ts:231-240`) gains `selectionProfile`. `loadEvaluationContext` adds `persistence.loadVisibleHairColor(userId)` to its `Promise.all`, **not** behind `SHOPPING_BUDGET_ENABLED`, and builds the slice from `refinedNeedSnapshot`. `rawAuthorityAssessment` passes `selectionProfile: context.selectionProfile`. New port method `loadVisibleHairColor` on `Stage3ProductionPersistence` (`:236` area) is implemented in `stage3-persistence-supabase.ts` (next to `loadShoppingContext`, `:685`) and in `fixture-gateway.ts` (returns null) |
| **Previews** `personal-plan/product-previews.ts` `computeStage1ProductExamplePreviews` (127-) → role assessment (290-307) | new optional input `visibleHairColor?: Stage3VisibleHairColor \| null` (default null). Builds the slice from `input.snapshot`. Callers: `app/api/personal-plan/stage-1/previews/route.ts` (loads the colour like the budget), `discovery/load-ideal-routine.ts`, freemium provisioning (`freemium/plan-provisioning-supabase.ts:225` area) |
| **Direct acceptance** (`direct-acceptance/accept.ts`) | no own builder: it evaluates through the production gateway after the synthetic refinement. **Parity requirement:** previews and acceptance must use the same colour loader, or a previewed dry shampoo goes `seen_state_stale` (`accept.ts:229-233`). Dry shampoo is normally not previewed (Stage-1 decision deferred), but the test covers it |
| **Fit comparison** `products/fit-comparison.ts` (`rankStage3ComparisonCandidates` 400-425, `evaluateDetachedCandidate` 572-589, `recommendationForCandidate` 591-) | none. Spreads `...input`. Test: alternatives' first item equals the authority pick for each S2 example |
| **Discovery equal options** `discovery/equal-options.ts:44-59` | input `selectionProfile` param; caller `load-ideal-routine.ts:401` passes the same slice it used for previews. Only Bondbuilder ever returns options; this is for parity only |
| **Web scan** `scan/resolve-verdict.ts` `BuildScanVerdictInput` (72-108) + `scanAuthorityInput` (425-455) | `BuildScanVerdictInput.selectionProfile` (required) → passed through |
| **Web scan loader** `scan/load-scan-verdict.ts:115-134` | new param `visibleHairColor`; builds the slice from `context.snapshot`. Callers `app/api/scan/resolve/route.ts` and `app/api/scan/reveal/route.ts` load the colour via `loadScanVisibleHairColor` (fail-open null, mirrors `scan/shopping-budget.ts`) |
| **Mobile scan** `mobile/scan-service.ts` `loadVerdict` (≈314-386) + `app/api/mobile/v1/scan/resolve/route.ts` | same as web: the route loads the colour; `loadVerdict` builds the slice from `context.snapshot` |
| **Scan readiness audit** `product-intake/scan-catalog-readiness.ts:312-320` | passes `UNKNOWN_SELECTION_PROFILE` (synthetic thickness-only profiles) |
| **Labs/fixtures** `products/fixture-gateway.ts:725-740`, `app/labs/personal-plan/stage-3/lab-client.tsx:86`, `fixture-scenarios.ts` | `UNKNOWN_SELECTION_PROFILE` |
| **Coverage audit** `scripts/personal-plan/audit-stage3-production-coverage.ts` | synthetic profiles get an explicit slice. Adds dry-shampoo/deep-cleansing variants (sensitive, oily, volume) to the audit matrix |

Out of scope: owned-product catalogue search (`personal_plan_search_assessment_products_v2/v3`, SQL-side, matching only), Stage-1 decisions, the legacy chat engine.

---

## 4. Ordered tasks

Test-first for all authority logic: the main session writes the failing tests, and the implementer (Sonnet for mechanical work, Opus for German copy) makes them pass. Run tests with `npm run test:personal-plan` / `npm run test:node` (never bare `npx tsx --test`).

**T2.0 Worktree.** `npm run worktree:new -- catalog-s2-profile-picks` from `origin/main` (S2 does not depend on S1 code). Verify base == fetched `origin/main`. Plan docs stay in `catalog-completeness-fill`.
Produces: clean branch `codex/catalog-s2-profile-picks`.

**T2.1 Selection profile (test-first).**
Consumes: `InitialNeedPlanSnapshot`. Produces: `selection-profile.ts`, `planVolumeDirection` in `src/lib/personal-plan/categories/volume-direction.ts`; `conditioner.ts` calls it.
Tests: new `tests/personal-plan/products/stage3-selection-profile.test.ts` (oiliness passthrough; `irritated` → sensitive; `irritationState` normal/assumed does not clear sensitivity; volume: low_volume concern → more; volume_balance + straight fine → more; + curly/coarse → less; none → null; unknown profile constant). Regression: `tests/personal-plan/categories/conditioner.test.ts` stays green, unchanged.

**T2.2 Colour reader + loaders (test-first).**
Consumes: `care_habits`, `facts_provenance`. Produces: `user-facts/visible-hair-color.ts`, `scan/visible-hair-color.ts` (fail-open), persistence port `loadVisibleHairColor`.
Tests: new `tests/user-facts-visible-hair-color.test.ts` (user → value; assumed → null; unknown_historical → null; invalid enum → null; missing → null; loader error → null).

**T2.3 Plumbing (mechanical, Sonnet).**
Consumes: T2.1, T2.2. Produces: the required `selectionProfile` on `Stage3AuthorityInput` / `BuildScanVerdictInput` / `Stage3EvaluationContext`, and every site in §3.2.
Tests: per-site assertions that the slice arrives: extend `tests/personal-plan/products/production-persistence-gateway.test.ts`, `tests/personal-plan/product-previews.test.ts`, `tests/discovery-equal-options.test.ts`, `tests/scan-resolve-verdict.test.ts`, `tests/mobile-scan-authority.test.ts` (capture the input via a stub `evaluateStage3Authority`/`buildScanVerdict` dep or assert on the outcome with a colour-dependent fixture). `npm run typecheck` must be clean.

**T2.4 Dry-shampoo adapter (test-first).**
Consumes: T2.3. Produces: `authority/categories/dry-shampoo.ts` with a single `evaluateFacts` (owned and candidates), ranking via `compareRankableCandidates` + `candidateDimensionCoverage`, rule `dry_shampoo.selection.shared_rank`; `fit-comparison-schema.ts` dry-shampoo rows = identity, sensitivity, tint, styling direction, protocol.
Tests: new `tests/personal-plan/products/stage3-s2-profile-picks.test.ts`, block "dry shampoo", fixtures **D1–D8** from §1.2 against a frozen copy of the live 10-product catalogue (`tests/personal-plan/products/fixtures/s2-catalog-2026-10-09.ts`), plus: missing product fact → unknown; known reaction → mismatch; `sensitive_refresh` treated as standard.

**T2.5 Scalp-care adapter (test-first).**
Produces: `authority/categories/scalp-care.ts` ranking via the comparator (exfoliant suppression unchanged); rule id unchanged.
Tests (same file, block "scalp care"): comfort → Balea Serum; exfoliant → Balea Peeling (not Isana); density → L'Oréal; density + Neqi fixture (9,95 €, verified density protocol) → Neqi (or L'Oréal if Q2 = B with `sort_order`); exfoliant suppressed by deep-cleansing coverage → no recommendation (existing test `stage3-authority.test.ts:2063` stays green); all `sort_order` null/0 → price; price null → last; uncapped-budget nudge regression in `tests/personal-plan/products/production-persistence-gateway-budget.test.ts` (documents the comfort → Eucerin swap when the target requires it).

**T2.6 Deep-cleansing contract + schema + adapter (test-first; ships inert).**
Produces: schema migration (§2.1), `contracts.ts`/`catalog-facts.ts` changes (§2.4), adapter soft criterion + ranked pick, `fit-comparison-schema.ts` row `deep_cleansing.scalp_target`, `database.ts` types.
Tests: `stage3-s2-profile-picks.test.ts` block "deep cleansing", fixtures **C1–C6** (with the expected targets) + "all null → NEQI" + `mineral_reset` → Swiss-O-Par only (existing `stage3-fit-comparison.test.ts:476` green); `tests/personal-plan/products/stage3-catalog-facts.test.ts` (NULL / `{}` / `{oily}` / invalid → null; fingerprint covers the field); new `tests/deep-cleansing-target-scalp-types-migration.test.ts` (PGlite: column, CHECK rejects `{oily,dry}`, duplicates, unknown values; NULL allowed; publication gate unaffected).

**T2.7 Cross-surface winner parity (test-first).**
Consumes: T2.4–T2.6. Produces: no new code, only proof that one rule holds everywhere.
Tests: new `tests/personal-plan/products/stage3-s2-surface-parity.test.ts`. For each profile example (D2, D3, D5, C1, C3, scalp exfoliant): same winner from (a) `evaluateStage3Authority`, (b) `rankStage3ComparisonCandidates(...)[0]`, (c) `computeStage1ProductExamplePreviews` (fake loader), (d) `buildScanVerdict` top alternative / verdict for a scanned non-winner, (e) the mobile `loadVerdict` builder with stubbed loaders; plus direct-acceptance seen-state round trip for a deep-cleansing preview (`buildDirectAcceptanceIntents` does not throw `seen_state_stale`). Compact rows: `stage3-fit-comparison.test.ts` asserts the new rows and labels; `tests/mobile-scan-presentation.test.ts` asserts the „X von Y Kriterien erfüllt" counts for a dry shampoo.
**Regression (unchanged categories):** full `stage3-authority.test.ts`, `stage3-fit-comparison.test.ts`, `candidate-ranking.test.ts`, `budget-policy.test.ts`, `product-previews*.test.ts`, `scan-resolve-verdict.test.ts`, `mobile-scan-authority.test.ts` stay green with no edits to shampoo/conditioner/leave-in/mask/oil/heat/bondbuilder expectations. `npm run personal-plan:stage3:coverage-audit` output is unchanged for those seven categories (diff before/after).

**T2.8 German copy + docs (Opus for copy).**
Produces: criterion labels/explanations (the drafts in §1 are placeholders for review; idiomatic, no medical claims, „Kopfhauttyp" row never names dandruff/irritation); doc amendments: `dry-shampoo/decision.md` (selection = shared comparator per S1; `sensitive_refresh` = standard until cutover), `scalp-care/decision.md` (catalogue order → price; budget = #654 post-fit), `deep-cleansing/decision.md` (§2.4), `plans/stage3-coverage-ranking.md` table rows for the three categories („durch S1 2026-10-09 ersetzt").

**T2.9 Engine run (Shampoo v1.6 lane, parallel to T2.1–T2.8).**
Consumes: rollout freeze brief. Produces: D01–D04 packets, lane outputs, compare report, Nick's review of flags.
Done when all 5 deep cleansers have a frozen v1.6 projection (or `needs_research`, which leaves the product NULL).

**T2.10 Backfill generator + rehearsal.**
Consumes: T2.9 + T2.6 schema. Produces: `plans/catalog-completeness-fill/slice2/` (`scalp-targets.json`, `generate.ts`, `prestate.json`, `target-state.json`, `rollback.sql`, `verify.sql`, `artifact-manifest.json`) and the backfill migration.
Tests: `tests/catalog-completeness-fill-s2-backfill-postgres.test.ts` (seeded prestate: apply, verify, rollback, reapply, tamper → abort; evidence rows exact; no other column touched).

**T2.11 Verify, review, ship** (§5). One Codex whole-branch review.

Suggested PR split (P6): **PR S2a** = T2.0–T2.8 + schema migration (deep-cleansing soft rank inert); **PR S2b** = T2.10 backfill (after T2.9 and Nick's batch approval).

---

## 5. Verification, live checks, rollout

**Automated:** `npm run ci:verify`; `npm run test:personal-plan`; `npm run test:node`; the named suites above; `npm run personal-plan:stage3:coverage-audit` (diff); `npm run catalog:authority:audit -- --pretty --allow-issues` (no new findings).

**Local flow (ready-check):** labs `/labs/personal-plan/stage-3` and the real Stage-3 flow with three local test profiles (`docs/local-qa-access.md`): (1) oily + sensitive + bridge accepted + colour brown → dry shampoo Balea Kopfhaut Sensitive, deep cleansing per C1 (after a local backfill), (2) straight fine + volume goal + dry shampoo owned → got2b Extra Volumen as replacement, (3) hair-loss → density pick per Q2. Plus a web scan of Batiste Brünett for profile (1) (verdict ideal, tint row „erfüllt") and for a light-blonde profile (supportive).

**Pre-deploy SELECTs** (gate, run against prod immediately before deploy):
- Active drafts with a `planned_purchase` in the three categories whose stored product ≠ the new pick. The live count on 2026-10-09 is **0**: 15 active drafts, none with such a decision. If the count is above 0, those users get `not_ready` at completion (`production-persistence-gateway.ts:1223`) until they re-decide, and the authority-version bump becomes necessary (R1).
- `target_scalp_types` column exists (schema migration applied **before** the code deploy: the loader selects the column).

**Post-deploy live:** Idealplan preview for an oily test profile (deep cleansing still NEQI until S2b, scalp exfoliant Balea Peeling); Sentry `search_events` in `haircare-fw/hair-concierge` for the last hour (CLAUDE.local.md). After the S2b apply: `verify.sql` readback of the 5 rows plus 5 evidence rows, Stage-3 replay for an oily test profile → Gliss (if confirmed), scan of Gliss for the same profile → „Kopfhauttyp: erfüllt".

**Rollout — no flag (P7).** The code is deterministic and the deep-cleansing part is data-gated (NULL = today's order). The visible changes are new picks for dry shampoo, the scalp exfoliant role, and density after S1. Rollback: revert PR S2a; `rollback.sql` for S2b. Order: schema migration → deploy S2a → T2.9 review → Nick approves batch → apply S2b → live checks.

---

## 6. Risks

- **R1 Stored decisions vs new picks.** A `planned_purchase` is only current if the evaluation still recommends the same product (`production-persistence-gateway.ts:865-869`, checked by `completionDecisionsRemainCurrent` → `not_ready` at `:1223`). Completed drafts (120) are frozen and unaffected. Active drafts have 0 affected decisions today. Mitigation: the pre-deploy SELECT; bump the authority version only if the count is above 0 (P8).
- **R2 Colour outside the need version.** `visibleHairColor` comes from `care_habits`, not the snapshot, so `refinedInputHash` does not cover it. A colour edit can change a dry-shampoo verdict without a new need version. This is the same pattern as #654's budget, and the effect is limited to one soft row.
- **R3 Fingerprint churn.** Adding `targetScalpTypes` to deep-cleansing facts changes all 5 fact fingerprints once (S2a deploy) and again at S2b. Previews loaded before and accepted after either change hit `seen_state_stale` once (normal catalogue-change behaviour).
- **R4 Visible compact rows.** New rows („Farbpassung", „Volumen", „Kopfhauttyp") and changed scan subtitles („2 von 3 Kriterien erfüllt" on an ideal general deep cleanser). Intended (honest), but it is a presentation change. Check web + iOS rendering in T2.7.
- **R5 Sensitivity vs volume** (D4) is decided by catalogue order, not by an explicit precedence. It holds for today's `sort_order`, and the fixture pins it. Re-check if dry-shampoo `sort_order` changes.
- **R6 Budget policy ignores `targetMatchCount`.** `fitComparable` (`budget-policy.ts:168-176`) compares verdict, cautions and need dimensions only. An uncapped swap could replace a scalp-matched deep cleanser with an unmatched one above 15 €. That is latent today, since all deep cleansers cost ≤ 12,99 €. Residual-ledger entry; #654 policy stays unchanged per §8b(c).
- **R7 Engine may not confirm** Gliss oily / NEQI dry (formula gates, P0 conservatism). The outcome is then today's order (C4). No harm, and the slice is still done.
- **R8 Legacy chat engine** keeps ranking on `scalp_type_focus` (Balea `oily`). Accepted non-goal; residual ledger.

---

## 7. Proposals (technical choices — one recommendation each)

- **P1 Storage = nullable `text[]` column + evidence rows**, not a new table. The contract is one small array per product (`targetScalpTypes`). The spec table is already one row per product, and `personal_plan_catalog_fact_evidence` is the established provenance home. A table would add joins, RLS and fingerprint code for 5 rows.
- **P2 Colour from `care_habits` with `user` provenance, loaded next to the snapshot**, not added to `PlanRoutineContext`. Adding a field to the stored need snapshot changes the output of every newly computed need version for unchanged inputs, which is risky for version reuse and scanner-context publication equality, and has no precedent since #344. `care_habits` is the source of truth (central profile program), carries per-field provenance, and is already read the same way for #654. Restricting to `user` provenance keeps the assumed default `light_blonde` from silently down-rating brown/dark tinted products (assumption rationale: "adds no constraint").
- **P3 Sensitivity = quiz concern `irritated`**, not the Stage-2 irritation detail. The doc names „gereizt" as the sensitivity source. The detail's assumed default `normal` would otherwise turn sensitive users into normal ones. Active symptoms already pause execution separately.
- **P4 v1.6 `ordinary` → `[]`** (not `balanced`). S-ORDINARY means "no qualifying scalp claim", which is exactly the doc's `[]` ("reviewed, no explicit target"). Mapping it to `balanced` would invent positioning the engine did not find.
- **P5 Freeze the legacy `scalp_type_focus`**, do not sync it. One value cannot represent `[]`/`[dry]` faithfully, and its only remaining reader is the out-of-scope chat engine.
- **P6 Split into S2a (code + schema, inert) and S2b (backfill)**. The code does not need to wait for the engine run, and production writes need a separate per-batch approval anyway.
- **P7 No release flag.** Deterministic logic, data-gated deep-cleansing behaviour, and a trivial revert. Flags in the selection path would need flag-parity across previews, acceptance and scan (seen-state risk).
- **P8 No authority-version bump by default** (precedent: #654 trust ranking, 2026-08-17 coverage ranking). `buildAuthorityRefreshDraft` clears **all** decisions of every active draft (`stage3-persistence-supabase.ts:741-749`, `decisions: []` at `:746`). Bump only if the pre-deploy SELECT finds affected active decisions.
- **P9 Volume direction = the conditioner rule, extracted**, not `resolveVolumeBalanceGoal` (quiz normalization). One Personal-Plan rule from `PlanProfile`. The normalization helper belongs to the legacy vocabulary and needs density/structure fields the snapshot does not use.
- **P10 Non-match on the deep-cleansing row emits no criterion** (row shows „nicht bestätigt"), not a `caution`. A caution would turn „passt sehr gut" into „passt mit Einschränkung" for general products, which contradicts doc fixture 16.
- **P11 Required `selectionProfile` field + `UNKNOWN_SELECTION_PROFILE`** for synthetic/lab callers. The compiler finds every real builder, and the neutral constant reproduces today's behaviour where no profile exists.
- **P12 Existing completed plans are not migrated.** They stay frozen (19 NEQI plans, 11 L'Oréal density plans). New picks reach existing members only through the normal recompute/successor path when their profile changes.

---

## 8. Questions for Nick

**Q1 — Brown or dark roots: universal or tinted dry shampoo?**
Example: Lena has brown roots, a normal scalp and no volume goal. She told us her root colour in the refinement. Under the confirmed dry-shampoo rule, a colourless ("universal") product fits everyone fully, so the tie goes to catalogue order and she gets **Batiste Original (3,75 €)**. Batiste Brünett (3,99 €) shows as an equal alternative. The other option is to count a matching tint as one more fulfilled need, so she gets **Batiste Brünett**.
Real counts: 11 people use dry shampoo. 7 of them have brown (6) or dark (1) roots.
- A — keep the confirmed rule: universal first, tinted as an equal alternative (no extra work).
- B — matching tint wins: needs a small rule change, and blond roots would then get Batiste Blond.
**Recommendation: A.** The doc deliberately treats universal products as a full fit, and B changes a confirmed rule for a 0,24 € difference. Choose B if you want the root-colour question to change the pick, not only rule out wrong tints.

**Q2 — Hair-loss users after the Neqi oil moves to scalp care (S1): which product comes first?**
Example: Mia reports thinning hair. S1 ("catalogue order, then price") applies, and every scalp-care product has the same catalogue order. Once Neqi Smooth Strength Rosemary Oil (9,95 €; massage in, leave at least 10 minutes, then shampoo) is published, she gets **Neqi** instead of **L'Oréal Anti-Haarverlust Serum (13,99 €, leave-on)**.
Real counts: 22 profiles report hair loss or thinning. 11 members' current plans have L'Oréal; those plans stay as they are.
- A — accept the price rule: Neqi first.
- B — set a catalogue order (L'Oréal → The Ordinary → Neqi) so L'Oréal stays first: one data change, no code.
**Recommendation: B.** The rosemary evidence is the weakest of the three (one small trial). The oil adds a 10-minute pre-wash step. The scalp-care doc allows curated order to break such ties.
