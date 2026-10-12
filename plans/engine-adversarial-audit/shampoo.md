# Shampoo engine — adversarial audit (2026-10-09)

Scope: `src/lib/shampoo/*` (incl. Production Light adapter, Focus v1.5 overlay), the Personal-Plan shampoo decision + Stage-3 authority (the live plan/scanner path), shampoo intake validator and research prompt contract, and the legacy recommendation-engine shampoo cadence. Audit only; no code was changed.

Test file: `tests/audit-shampoo-rules.test.ts` (red = contradiction, `describe("verified")` = regression net).

```
node --import ./tests/server-only-register.cjs --import tsx --test tests/audit-shampoo-rules.test.ts
# tests 17 · pass 6 · fail 11
```

Governing sources used:

- R = `docs/research/shampoo-inci/v1.4/classification-standard.md` (+ runbook)
- PL = `docs/product-intake-shampoo-production-light.md`
- D = `docs/personal-plan/categories/shampoo/decision.md` (confirmed, v3)
- S = `plans/2026-08-02-personal-plan-computation-spec.md` § "Shampoo behavior"
- V16 = `.worktrees/shampoo-v16/plans/shampoo-v16/rulings.md` (R1–R17; v1.6 is locked in that worktree but **not implemented in this tree**)
- CR = `plans/stage3-coverage-ranking.md` (PR #448 ruling)

Production path note: the live Personal Plan and the scanner both use `evaluateStage3Authority` → `evaluateShampooAuthority` with catalog facts from `catalog-facts.ts` (`selectShampooSpec`). The tests drive that real path through `deriveStage3RecommendationCandidates` over an in-memory batch snapshot. Chat, routines and the quiz offer preview still use the legacy `recommendation-engine` (collapsed `scalp_condition`).

## (a) Rule inventory

| ruleId | Rule (own words) | Citation | Status |
|---|---|---|---|
| shampoo.adapter.low_confidence_refused | Any low-confidence direct property or thickness projection → `needs_research` | PL "Required input" | holds (inspection + existing tests) |
| shampoo.adapter.unknown_comfort_dandruff_refused | `scalpComfortTarget`/`dandruffSupport` = `unknown` on a canonical formula → `needs_research` | PL "Required input" | holds (inspection) |
| shampoo.adapter.identity_formula_gates | Low identity confidence, unresolved conflict, non-canonical formula, fingerprint mismatch → `needs_research` | PL; R §2 | holds (inspection) |
| shampoo.dandruff.target_requires_support_and_claim | Dandruff row needs `dandruffSupport: supported` **and** exact anti-dandruff positioning | PL "Scalp target" | holds (verified test) |
| shampoo.dandruff.formula_recompute | `dandruffSupport` is mechanical: supported iff INCI has Piroctone Olamine/Climbazole; tea tree/salicylic/"anti-flake" never upgrade | R §11, §13; runbook L152 | **contradicted** |
| shampoo.dandruff.formula_recompute.reverse | A recognized active recorded as `not_supported` must not pass silently | R §11; adapter warning contract | **contradicted** (P2) |
| shampoo.scalp.sensitive_dry_require_comfort_target | `sensitive`/`dry` targets need `scalpComfortTarget: targeted` | PL "Scalp target" | holds (inspection) |
| shampoo.thickness.only_ideal_emitted | Only `ideal` thickness becomes eligibility; `conditional` stays in rationale | PL "Thickness" | needs-ruling (vs V16 R2–R4) |
| shampoo.intensity.basic_mapping | low→gentle, moderate→regular, ordinary strong→regular | PL "Observed cleansing intensity" | holds (inspection) |
| shampoo.intensity.reset_support_is_clarifying | Strong + alternating/reset support → `clarifying` | PL; R §9 | **contradicted** (+ needs-ruling vs R16.2) |
| shampoo.deep_cleansing.explicit_reset_routing | Explicit reset positioning + compatible (strong) architecture → `routed_deep_cleansing` | PL "Observed cleansing intensity"; R §7 | **contradicted** (+ needs-ruling vs R6) |
| shampoo.roles.schuppen_is_dandruff_only | `schuppen` rows → `shampoo_dandruff` only; others → `shampoo_everyday` | PL "Production fields emitted" | holds (verified test) |
| shampoo.dandruff.no_dry_flakes_row | Dry flakes never create a dandruff (`schuppen`) row; legacy dry_flakes mappings reconciled to the dry route | PL "Scalp target"; D "Data, catalog, and launch gates" | **contradicted** |
| shampoo.secondary_target.dandruff_path | A dandruff-primary product projects dandruff rows only | V16 R15–R17 | needs-ruling (v1.6 not implemented; PL permits secondary) |
| shampoo.focus_v15.binding | Overlay bound to product id, formula fingerprint, adjudication bytes, v1.4 focus, exact INCI positions, resolvable refs | PL "Focus v1.5" | holds (inspection) |
| shampoo.focus_v15.no_gentle | `gentle` is not a v1.5 focus value | PL "Focus v1.5" | holds (enum) |
| shampoo.focus_v15.nonspecific_no_confident_specialist | `nonspecific` formula verdict cannot carry a confident specialist (moisture/repair) focus | PL "Focus v1.5" | **contradicted** (P2, research-only) |
| shampoo.inclusion.basis | Shampoo always `basis` | D "Role and concern rules" | holds (existing tests) |
| shampoo.role.dandruff_only_from_targeted_concern | Dry flakes or irritation alone never create `shampoo_dandruff` | D "Role and concern rules" | holds (verified test) |
| shampoo.role.dry_flakes_is_trocken | `dry_dandruff` → gentle `trocken` everyday route, no `schuppen` | D fixture 6; S concern table | holds (verified test) |
| shampoo.role.irritated_everyday | `irritated` → `irritationen` everyday route, no dandruff role | D fixture 5 | holds (verified test) |
| shampoo.dandruff.irritated_requires_sensitive | `oily_dandruff + irritated` → dandruff role requires a sensitive anti-dandruff profile; prefer it when available | D "Role and concern rules", fixture 4; S `requiresSensitiveProfile` | **contradicted** (P0) |
| shampoo.combo.dry_plus_irritated | `dry_dandruff + irritated` → one gentle everyday role requiring dry-scalp **and** irritation compatibility | D; S concern table | needs-ruling |
| shampoo.cadence.scalp_oiliness_sets_band | Band from scalp oiliness; `oily_dandruff`, dry flakes, irritation never move the band | D "Total wet-wash cadence"; S | holds (verified test) |
| shampoo.cadence.dry_band_table | Dry scalp = `weekly_1x` (biweekly–weekly_1x) | D cadence table | needs-ruling (vs Nomi T4 ruling 2026-10-09) |
| shampoo.cadence.retain_or_nearest_boundary | In-range current frequency retained; outside → nearest boundary; `does_not_wash` valid | D cadence rules | holds (existing tests) |
| shampoo.cadence.goals_never_change | Goals never change cadence | D; S | holds in Personal Plan (inspection of `needs.ts`) |
| shampoo.catalog.empty_thickness_not_wildcard | `suitable_thicknesses` null = unverified, `[]` = invalid, never a wildcard | D "Product facts and catalog authority" | holds (verified test) |
| shampoo.fit.precedence_thickness_before_role | Verdict precedence: … strict thickness → required role/route → protocol gap …; thickness exclusion is a `mismatch` reason of its own | D "Stage 2" | **contradicted** (P1) |
| shampoo.fit.precedence_route_before_protocol_gap | Wrong required role/route outranks a protocol gap → `mismatch`, not `unknown` | D "Stage 2" | **contradicted** (P1) |
| shampoo.selection.ideal_or_supportive | Select only `ideal` or explicitly limited `supportive` candidates (all roles) | D "Stage 2"; S | needs-ruling (vs CR "dandruff stays ideal-only" and V16 R4) |
| shampoo.legacy.cadence_consistency | Chat/routines/offer preview cadence agrees with the plan | (no single owner) | needs-ruling |
| shampoo.missing_scalp_inputs_typed_error | Missing `scalpOiliness`/`scalpConcerns` → typed incomplete-source error | D "Inputs and missing-data behavior" | untestable here (schema-gated upstream; `buildPlanProfile` uses `!`/`?? []` and would coerce) |
| shampoo.no_gap (R5) | No thickness × scalp cell without a recommendable shampoo | V16 R5 | untestable offline (catalog data) |
| shampoo.coverage.coarse_oily | Coarse × oily covered (Monday exception) | memory / PR #449; V16 R5 | untestable offline (prod data) |

Counts: **35 rules · 17 holding · 9 contradicted (11 red tests) · 6 needs-ruling · 3 untestable.**

## (b) Contradictions

### 1. shampoo.dandruff.irritated_requires_sensitive — P0, confidence medium-high

- User: someone with fine, wavy hair, an oily scalp with dandruff **and** an itchy, irritated scalp.
- Expected (D fixture 4, S concern table): the dandruff role needs a sensitive anti-dandruff product and recommends it when available.
- Observed: the dandruff role always targets `schuppen` + `regular` intensity, ignoring irritation. A gentle anti-dandruff product only scores `supportive` ("Reinigungsintensität weicht ab") and the dandruff role drops every `supportive` candidate. Result: the regular-intensity product wins; if the gentle one is the only anti-dandruff option, the role is left without a recommendation.
- Code: `src/lib/personal-plan/products/authority/categories/shampoo-spec-target.ts:15-16` (dandruff role ignores `everydayConstraint`), `src/lib/shampoo/constants.ts:35` (`schuppen` → `regular`), `src/lib/personal-plan/products/authority/categories/shampoo.ts:200` (dandruff ideal-only filter). No `requiresSensitiveProfile` exists on the target (`src/lib/personal-plan/categories/shampoo.ts:82-88`).
- Note: R12 confirms the intent and defers only the product-side marker. Live `cleansing_intensity = gentle` on a `schuppen` row is already available as a proxy, but the target never asks for it.

### 2. shampoo.dandruff.formula_recompute — P0, confidence medium

- User: someone with oily dandruff gets a "Schuppen" shampoo whose formula holds only tea tree oil and salicylic acid.
- Expected (R §11/§13, runbook "recomputed from the complete formula", PL "Scalp target"): a dandruff row exists only when the frozen INCI contains Piroctone Olamine or Climbazole.
- Observed: the adapter trusts the envelope's `dandruffSupport: supported` and emits 3 `schuppen/dandruff` rows. It already hashes `canonicalInci` but never checks the dandruff actives against it.
- Code: `src/lib/shampoo/production-light-adapter.ts:355-372` (`targetIsSupported` checks only the property value). The Personal Plan then treats `schuppen` as treatment-capable (S "Catalog invariant").
- Why medium: the adapter "projects reviewed truth", so a bad envelope is a research error. But the standard makes this property mechanical, and the adapter already enforces other mechanical consistency (fingerprint).

### 3. shampoo.dandruff.no_dry_flakes_row — P1, confidence medium-high (2 red tests)

- User: someone with dry flakes but no true dandruff. A dry-flakes comfort shampoo can be approved into `schuppen`, which the plan trusts as treatment-capable.
- Expected (PL "Dry flakes do not create a dandruff row"; D launch gate "legacy dry_flakes intake/category mappings must be reconciled"): `schuppen` pairs only with the `dandruff` route.
- Observed: the intake approval validator accepts `{schuppen, dry_flakes}`. The research prompt contract tells the model `schuppen: "dandruff or dry_flakes"` and never mentions the claim + recognized-active gate.
- Code: `src/lib/shampoo/constants.ts:27`, `src/lib/product-intake/category-validators.ts:477-500`, `src/lib/product-intake/category-research-router.ts:208`. The legacy engine `evaluateShampooFit` (`src/lib/recommendation-engine/categories/shampoo.ts:112`) would score such a row `ideal` for a dandruff user.

### 4. shampoo.deep_cleansing.explicit_reset_routing — P1, confidence medium

- User: someone with a balanced scalp is offered an explicit "Tiefenreinigung & Volumen" product (strong formula, reset usage) as an ordinary everyday shampoo.
- Expected: PL says `routed_deep_cleansing`; later ruling R6 says keep a regular entry with `clarifying`. Under either reading, never `regular`.
- Observed: `property_lane_ready` with 3 `regular` rows. `isDeepCleansing` also requires `focusPrimary === "clarifying"`, and `observedIntensity` upgrades only `alternating`.
- Code: `src/lib/shampoo/production-light-adapter.ts:335-353`.

### 5. shampoo.intensity.reset_support_is_clarifying — P1, confidence medium

- Example: a strong clarifying shampoo with usage role `occasional_reset` but no positioning flag projects as `regular`. The milder `alternating` variant of the same formula projects as `clarifying`, so the stronger reset product gets the weaker label.
- Expected (PL): reset support → `clarifying` (or `needs_research` for the inconsistent flag).
- Observed: `regular`.
- Code: `src/lib/shampoo/production-light-adapter.ts:339-343`.
- See needs-ruling N2: R16.2 may make `clarifying` explicit-deep-cleanser-only in v1.6.

### 6. shampoo.fit.precedence_thickness_before_role — P1 (wrong rationale), confidence high

- User: someone with coarse hair who owns a shampoo verified for fine hair only.
- Expected (D "Stage 2" precedence): `mismatch` with the thickness criterion ("Haardicke").
- Observed: `mismatch` carried by `shampoo.role` ("Das Produkt deckt die erforderliche Shampoo-Aufgabe nicht ab"), a false reason shown in the plan and the scanner.
- Code: `src/lib/personal-plan/products/authority/categories/shampoo.ts:81-97`. The gate compares `facts.spec.thickness`, which `selectShampooSpec` sets to null on a failed tuple match (`catalog-facts.ts:1110-1170`), instead of `input.hairThickness`. For catalog-derived facts the thickness gate is effectively dead code.

### 7. shampoo.fit.precedence_route_before_protocol_gap — P1, confidence medium

- User: someone with a balanced scalp and normal hair who owns an irritated-scalp shampoo whose protocol is not yet verified.
- Expected (D precedence: role/route before protocol gap): `mismatch` ("wechseln empfohlen").
- Observed: `unknown` ("noch in Prüfung") with `verified_protocol` missing.
- Code: `src/lib/personal-plan/products/authority/categories/shampoo.ts:100-131` (`known_mismatch` is only reported once some shampoo protocol is verified).
- Medium: this may be a deliberate conservative choice from #369, but no ruling records it.

### 8. shampoo.dandruff.formula_recompute.reverse — P2, confidence medium

- Example: a regular shampoo containing Climbazole, with the active recorded as `not_supported`, passes as `property_lane_ready`. The reviewer never sees the "active without dandruff positioning" warning.
- Code: `src/lib/shampoo/production-light-adapter.ts:592-598` (the warning keys on the recorded value, not the formula).

### 9. shampoo.focus_v15.nonspecific_no_confident_specialist — P2 (research-only), confidence high

- Example: an overlay with `careDirection.verdict = "nonspecific"` and a high-confidence `moisture` primary validates `ok: true`.
- Code: `src/lib/shampoo/focus-v15.ts:147-186` (verdict and primary focus consistency is never checked).

## (c) Needs ruling

- **N1 Thickness `conditional`**: PL says only `ideal` is emitted and `conditional` is dropped. V16 R2–R4 say `conditional` becomes amber/`supportive`, and for scalp-concern users thickness never hides a product. Example: a moderate-weight shampoo for a fine-haired oily-scalp user is invisible today, amber under v1.6. Pending v1.6 implementation.
- **N2 What earns `clarifying`**: PL v1 says strong + alternating clarifying/reset support → `clarifying`. R16.2 says only explicit deep cleansers (D1 wording) record `clarifying`; strong oily-scalp shampoos stay `regular` (green). Example: a strong "Anti-Fett" shampoo marked alternating + clarifying focus is `clarifying` today (amber for oily users), `regular` under R16.2.
- **N3 Deep-cleanser listing**: PL routes explicit deep cleansers out of regular Shampoo. R6 keeps a regular entry with `clarifying` plus a deep-cleanser record. R16.3 requires a strong formula for the deep-cleanser entry. Example: Balea Tiefenreinigung.
- **N4 Dandruff product with a secondary target**: PL lets a dandruff-primary product carry an independently supported secondary `sensitive`/`dry`/`oily` target, which emits `irritationen`/`trocken`/`dehydriert-fettig` rows. R15–R17 forbid this so that "an irritated-only user is never sent to an anti-dandruff active". Today's adapter would emit `irritationen` rows for an H&S-style "Sensitive" anti-dandruff product, and the plan would recommend it to irritated-only users.
- **N5 Dandruff role ideal-only**: D/S say "select only `ideal` or explicitly limited `supportive`". CR (PR #448) says `shampoo_dandruff` stays ideal-only, which is conservative and medically adjacent. R4 lets the dandruff role accept thickness-only amber. Contradiction 1 is independent of this (it is about the target), but its gentle-only sub-case depends on it.
- **N6 `dry_dandruff + irritated`**: D says "require dry-scalp and irritation compatibility". Code requires only `irritationen` + `gentle`. Unclear whether `gentle` intensity counts as dry-scalp compatibility or whether a separate dry marker/row is required. Example: a gentle `irritationen`-only product is `ideal` today for this user.
- **N7 Dry-scalp cadence table**: D (confirmed v3) says dry = `weekly_1x` (biweekly–weekly_1x). `needs.ts:170-184` applies the Nomi T4 ruling (2026-10-09): straight/wavy dry scalp = `weekly_2x` (weekly_1x–weekly_3_4x). The doc was never updated. Which is canonical?
- **N8 Legacy engine vs Personal Plan**: chat, routines and the quiz offer preview (`src/lib/quiz/offer-preview.ts:92`) use `recommendation-engine/shampoo-cadence.ts`. There, dandruff → `high` band regardless of scalp type, irritation → `medium`, the `healthy_scalp` goal shifts the band up, frequent dry shampoo shifts it up, and missing frequency counts as `less_than_monthly`. Example: a dry, curly scalp with dandruff gets 3–4×/week in the offer preview but 1×/week in the plan. D calls the legacy helpers "prior art only", so it is unclear whether these surfaces must converge. The legacy path also collapses `scalpConcerns[]` into one `scalp_condition` (`offer-adapter.ts:315`), so dandruff + irritated loses irritation (acknowledged in R12).

## (d) Coverage gaps

- **Catalog coverage invariants** (R5 no-gap, coarse × oily Monday exception, coarse dandruff ≈0 cells): these need prod `product_shampoo_specs` data. No network or DB was used, so they are untestable here.
- **Missing scalp inputs → typed error**: the v3 envelope schema gates this upstream. Calling `buildPlanProfile` directly with missing fields would coerce (`!`, `?? []`), but that bypasses validation, so it was not recorded as a contradiction.
- **Allocation/cadence-sum rules** (dandruff protocol consumes events first, primary/secondary from planned use, 21-day check, medicinal escalation): these live in portfolio/day compilation outside the shampoo modules and were not exercised.
- **v1.6 classification standard**: locked in `.worktrees/shampoo-v16` but not present in this tree. The adapter still pins the v1.4 hashes, and the router declares shampoo `pending_lock` with methodology `"v1.6"`. v1.6 gate rules (S-SENSITIVE, S-OILY weight check, C2 humectant, etc.) cannot be audited against code that does not exist yet.
- **Scanner**: shares `evaluateStage3Authority`, so contradictions 1, 6 and 7 apply to scan verdicts too. The scan presentation layer itself was not exercised.
