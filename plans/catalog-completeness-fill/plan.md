# Catalogue completeness fill — program plan

**Status:** Rev. 4 (2026-10-09) after Codex plan review (§11), decision coverage `confirmed` for all slices; F17 accepted (done = named batches + explicit residual ledger). Worktree `.worktrees/catalog-completeness-fill`, branch `codex/catalog-completeness-fill`, base `origin/main` 404db24f.

## 1. Outcome and source context

Every active catalogue product is either correctly scannable and recommendable, or explicitly retired — and the categories that today pick the same product for everyone pick by the user's profile.

Sources (all in `plans/catalog-completeness-fill/`): rulings in `decisions.md`; research `research/r1-leave-in-heat`, `r2-bondbuilder`, `r3-identity-cadence-duplicates`, `r4-user-submitted-14`, `r5-selection-facts`, `r6-scalp-oil-neqi`, `x1-multi-use`, `x2-bondbuilder-prefs`, `x3-heat-activation`. Origin: read-only prod audit 2026-10-09 (382 products, 358 surface-eligible, 236 recommended).

## 2. Chosen direction

Five slices, each its own PR, ordered by dependency:

| Slice | What changes | UI change | Depends on |
|---|---|---|---|
| S1 Data completeness + heat evaluator fix | Heat binaries, Bondbuilder data, user-submitted products, wrong-category retirements, small identity facts; port `23a83cfa` | Guidance/plan content only (no new surface) | — |
| S2 Profile-based picks | Dry shampoo, deep cleansing, scalp care join the shared Stage-3 ranking with the profile answers they need | Different products shown; no new surface | PR #654 merged (shared input-building files) |
| S3 Heat activation | New directions-led leave-in property; activation ⇒ heat routine only, never conditioner replacement; bespoke manufacturer guidance | New guidance copy in Anwendung | S1 (evaluator fix) |
| S4 Bondbuilder usage + Aveda schedule | Usage-preference refinement question; ranking trust → usage → budget → K18; damage-band schedule | New refinement question (mockup) | PR #654 merged |
| S5 One row per category | Same-package identity, scan → several category rows, plan same-package semantics, sibling intake, research of ~22 multi-use packages | Scan result + plan presentation (mockups) | S1 retirements |

Shampoo re-checks (incl. H&S DERMAXPRO intensity) stay with the Shampoo v1.6 program (`.worktrees/shampoo-v16`).

## 3. Scope and non-goals

In scope: the products and rules named per slice. Non-goals: new categories (styling families), Oil engine, Shampoo engine changes, price audit (stale prices go to the price-audit lane), Hair Tools, the legacy chat engine beyond keeping it non-crashing on changed data (its Bondbuilder intensity/axis scoring is a known follow-up), scalp-care schedules without a manufacturer frequency, Elvital/Redken/Première Bondbuilder schedules (no German manufacturer frequency).

Must remain true: claim-led heat binary (Leave-In §2.4.1/§13.3); application protocols only from manufacturer directions; frozen research artifacts never rewritten (new amendments/overlays instead); medically adjacent scalp copy stays separate and claim-limited; no production write without Nick's approval of the exact reviewed batch.

## 4. Target map

- Stage-3 authority: `src/lib/personal-plan/products/authority/{contracts.ts,catalog-facts.ts,categories/*.ts}`, shared ranking `candidate-ranking.ts`, `comparison-dimensions.ts`; input-building sites `production-persistence-gateway.ts`, `product-previews.ts`, `fit-comparison.ts`, `discovery/equal-options.ts`, `src/lib/scan/resolve-verdict.ts`, `load-scan-verdict.ts`, `src/lib/mobile/scan-service.ts`.
- Leave-in engine: `docs/research/leave-in-inci/` (v1.2 overlay), `src/lib/leave-in-research/production-adapter.ts`, `docs/product-intake-leave-in-production-adapter.md`, `docs/personal-plan/categories/leave-in/decision.md`.
- Application/guidance: `src/lib/personal-plan/routine/{cadence.ts,application-adapter.ts}`, V1/V2 contracts and exact-workflow registry (`EXACT_WORKFLOW_FAMILIES`), `docs/product-application-protocol-templates.md`.
- Bondbuilder: `src/lib/bondbuilder-research/cadence-projection.ts`, `src/lib/product-intake/catalog-enrichment/bondbuilder-reviewed-promotion.ts`, `categories/bondbuilder.ts`, `needs.ts`.
- Refinement question (S4): `src/lib/personal-plan/refinement/{types.ts,question-path.ts,session.ts,assumed-defaults.ts}`, `src/components/personal-plan-refinement/*`, `src/lib/user-facts/schema.ts` (`careHabitsV1Schema`). Precedent: `dryShampooVisibleHairColor`.
- Identity/scan (S5): `product_identifiers` unique GTIN owner (migration 20260826142200), `product_relationships` CHECK (20260503123000), `src/lib/scan/identifier-lookup.ts`, scan routes (web + `api/mobile/v1`), `scan-contracts.ts`, `src/components/scan/*`, iOS `ios/Chaarlie`, intake `product-matching.ts`, `review-workflow.ts`, `expansion-apply.ts`.
- Data writes: guarded one-shot migrations with seeded-prestate PGlite rehearsal (migration + rollback + reapply + tamper), precedent `20261007080123_bondbuilder_reviewed_promotion_p08.sql` and the Kevin Murphy oil migration.

## 5. Decision coverage

**Status: confirmed (all slices).**

Confirmed with Nick (2026-10-09, chat): S1–S2, H1–H4, A1–A2, B1–B4, M1–M2, U1–U5, D-a … D-h, and the UX rulings X1 (Bondbuilder routine question), X2 (multi-use scan + save), X3 (same package in two slots) — all recorded in `decisions.md`; mockups in `mockups/`.

Inherited from evidence or contract: heat claim authority (Leave-In §2.4.1, §13.3); `application_stage` transcribed from directions only (§7.13); protocols from manufacturer directions only; mask contact time per product (templates P5); scalp/Bondbuilder schedules stay generic without a manufacturer frequency; retirement = tombstone, no deletes (`docs/catalog-authority.md`); Balea Hair Sealer application stages per the 2026-09-18 ruling; deep-cleansing scalp fit from Shampoo v1.6 §13.5; Balea Tiefenreinigung dual listing (Shampoo v1.6 R6).

Implementation defaults: guarded one-shot migrations per slice with PGlite rehearsal (migration + rollback + reapply + tamper); Stage-3 changes test-first; Sonnet for mechanical tasks, Opus for German copy and judgment-heavy migration work; main session owns Stage-3 design and integration.

Open consequential assumptions — resolve before S5:
- None. O1–O4 ruled 2026-10-09 (see `decisions.md`).

Undiscussed consequential assumptions affecting this handoff: none.

Coverage acknowledgement: Nick requested the audit, then the research batch, engine use, and the rulings in `decisions.md` (2026-10-09).
Internal revalidation: Rev. 1 against origin/main 404db24f and live prod 2026-10-09.

## 6. Designed user journey

- S1, S2, S3: no new surface. Users see corrected recommendations and guidance in the existing plan (Personal Plan, Anwendung) and scanner verdicts: e.g. a sensitive-scalp user sees a sensitive-scalp dry shampoo; a user scanning Syoss Intense Volume gets a verdict instead of „Noch nicht einschätzbar"; heat-styling users get Pantene/Alcina/Neqi as heat-protecting leave-ins.
- S4: user with a Bondbuilder in the plan → refinement, after „Wie oft wäschst du deine Haare nass?" → „Wann passt der Extra-Schritt?" (Vor dem Waschen / Nach dem Waschen / Ist mir egal) → Weiter. Plan picks the most trusted Bondbuilder matching the answer (budget cap from #654 still applies); routine card adds one neutral line only when the answer cannot be met. No answer = today's default (K18). Aveda shows its damage-band schedule (moderate → once a week; high/severe → every wash day).
- S5: scan of a multi-use package → normal result with the verdict for the use the plan needs (else best-fitting) → other uses reachable from the result („Auch nutzbar als Maske › · Leave-in ›" opens that use's full result, footer „Zurück" | „Speichern") → „Speichern" → one sheet „Wohin speichern?": „Benutze ich schon als …" one row per use with verdict chip, plus „Auf die Merkliste"; one tap saves (single-use products keep today's sheet) → saved as that use; the result then shows the saved use. Plan: the same package may fill two slots, shown as two cards, the second with „Dieselbe Packung wie beim Conditioner", counted once (purchases and budget count the package once).

## 7. Planning evidence

S1–S3: non-user-facing logic/data; verification via Stage-3 fixtures, audits, and live before/after reads. S4/S5: `mockups/mockup-1-bondbuilder-preference.html` (approved 2026-10-09 with short copy), `mockups/mockup-2-scan-multi-use.html` (approved incl. 2b left/right footer, iOS button style), `mockups/mockup-3-plan-same-package.html` (variant 1 approved). Mockups are planning artifacts (commit); generator scripts stay outside the repo (discard).

## 8. Ordered tasks — Slice 1

**T1.1 Heat evaluator fix. — DONE 2026-10-09 (red → green; stage3-authority + fit-comparison 214/214).** Port `23a83cfa` (`categories/leave-in.ts`: `pre_heat_application` needs `providesHeatProtection === true` + verified pre-heat protocol; drop the `application_stage ∋ pre_heat` requirement). Tests: `tests/personal-plan/products/stage3-authority.test.ts` cases for Gliss/Olaplex/Redken shape (hp true, stage towel_dry, verified protocol → ideal) and hp false → mismatch. Done when the suite passes and the three live rows evaluate ideal in a fixture replay.

**T1.2 Leave-in heat data (curated).** Source-bound amendment (R1 evidence) + guarded migration: `provides_heat_protection` false→true for Alcina Hyaluron 2.0, Neqi Build Boost, Neqi Moisture Mystery, Pantene Bonding, Pantene HEAT&GLOW, Urban Alchemy; `application_stage` only where directions state it (HEAT&GLOW +pre_heat,+dry_hair; Pantene Bonding +dry_hair); re-point `pre_heat_protection` protocol source URLs to the C2 pages. Done when a post-apply read matches the manifest and Stage-3 replay shows all nine as pre-heat candidates.

**T1.0 Rebase + recapture.** Merge origin/main (#654: `products.market_segment`, Bondbuilder serializer changes in `20261009140000`), recapture prestate, regenerate fingerprints, rehearse against the real prerequisite chain (F01).

**T1.3 Bondbuilder data.** `category='Bondbuilder'` on the five October rows; Aveda GTIN `018084067994` (gtin); K18 cadence copy → moved to S4 (blocked in S1: any edit to K18's reviewed product/protocol rows breaks its bound publication approval; needs the Bondbuilder research lane); OGX cadence `{"kind":"label_schedule","copy_de":"Ein- bis zweimal pro Woche anwenden."}` via a create-only source-bound amendment citing the UK manufacturer page. Aveda cadence moves to S4. Done when chat matcher finds all eight Bondbuilders and the plan shows K18/OGX schedules.

**T1.4 Retirement + Garnier.** Tombstone Midnight Serum oil row `21a94166` → keeper leave-in `6b01025d` (0 owners, 0 drafts; move GTIN 3600524135805 in the same transaction). Garnier Fructis Sleek & Stay `c574ee6f`: `is_chaarlie_recommended=false` + disposition `retired_from_personal_plan`/`wrong_category` (handed to Styling). Balea Tiefenreinigung keeps both rows (Shampoo v1.6 R6). Pantene 7in1 leave-in row `f8f3b51d` moves to S5 (13 completed + 1 stale draft and 1 leave-in owner reference it; no reference-migration mechanism exists yet, `user_products` must stay same-category). Done when the audit treats Midnight's oil row as a tombstone, its GTIN resolves to the leave-in row, and Garnier no longer surfaces in plan/scan.

**T1.5 User-submitted products (14).** 8 shared-template protocols (Syoss ×2, Ultimate Shampoo, Jean&Len Colorglow, John Frieda, Neqi Conditioner, Pantene Moisture Boost, GLISS Liquid Silk) from `research/r4-user-submitted-14/proposal/protocol-rows.json`; Aussie SOS + Balea Hair Sealer v1.1 projections (+ Balea GTIN 4070765027518); Bali Curls N°3 v1.1 projection with `provides_heat_protection=false` and post-wash role only (H4); Jean&Len mask Mask v1.0 projection + protocol 300–1800 s; Pantene Moisture Boost GTIN → 8700216939508; Neqi Rosemary Oil → scalp care per D-g with protocol (pre-wash, scalp, minimum 600 s, then shampoo) and the mandatory limitation copy — requires code: `density_claim_tonic` may use the `rinse_off_scalp_care` family (`stage5-v2-builder.ts` allows only leave-on today) and the rinse-off scalp template must render „mindestens 10 Minuten einwirken lassen, dann mit Shampoo auswaschen"; V1/V2 family agreement + rendered guidance test (F03). Fresh reference inventory (owners, drafts, submissions) for Neqi before recategorising (F04). Neqi spray protocols move to S3. Needs a guarded executor for `origin=user_submitted` rows (none on main). Done when all 13 non-S3 products resolve to a verdict in a scan replay.

**T1.6 Small identity facts.** Balea Aqua Hyaluron 3in1 150 ml on both rows. Epres 30 ml → moved to S4 (same bound-approval block as K18). Done when audit shows no missing net content on recommended products.

Generator coverage (F02): K18 German cadence, OGX create-only amendment, Neqi recategorisation, evidence/ledger/postflight for every group must be in the generated batch and the rehearsal; anything left out is listed as blocked in `slice1/README.md`.

**T1.7 Rehearse, apply, verify.** Seeded-prestate PGlite rehearsal for every migration; apply only after Nick approves the exact batch; then rerun `npm run catalog:authority:audit -- --pretty --allow-issues`, `npm run personal-plan:stage3:coverage-audit`, pointer-coverage audit, and the scan-readiness query from the 2026-10-09 audit. Done when the before/after receipt shows the targeted findings closed and no new ones.

Exact change set: `slice1-spec.md`; generator/migration under `slice1/`.

Slices S2–S5 get task-level breakdowns once their open decisions (§5) are ruled; their shape is fixed in §2.


## 8b. Minimum task content for S2–S5 (from Codex review; full breakdown written before each slice starts)

- **S2 Profile-based picks.** (a) Shampoo v1.6 handoff for the deep cleansers: engine-derived scalp targets (zero/one/several) with provenance, stored as an array per the deep-cleansing contract (`targetScalpTypes`), adapter + category-contract update (F07). (b) Typed profile slice (scalp sensitivity, visible hair colour, volume goal, oily/dry scalp) through every builder: production gateway, previews, fit comparison, discovery equal-options, web scan, mobile scan (F06). (c) Comparison dimensions + fit criteria for dry shampoo, deep cleansing, scalp care inside the shared comparator; missing-answer behaviour; #654 budget policy unchanged after fit ranking. (d) Winner fixtures per example profile across plan, preview, scan.
- **S3 Heat activation.** (a) Leave-In v1.2 overlay (directions-led field, manufacturer-only evidence, invariant activation ⇒ pre_heat stage), lock/manifest, versioned envelopes, adapter + apply lane (F08). (b) Activation removes post-wash role and conditioner replacement; separate activation from protection in SQL `expand_leave_in_eligibility` and TS mirror. (c) DB publication gate aligned with T1.1 before any heat-only row is published; deferred-constraint tests (F05). (d) Reviewed exact workflow (family/compiler/builder registration) for manufacturer-specific steps; Neqi sectioning/tension and HEAT&GLOW verified in Anwendung (F09). (e) Contract reusable by the Styling category; amend `leave-in/decision.md` (activation is now a fit axis).
- **S4 Bondbuilder.** (0) K18 German cadence copy and Epres net content 30 ml via a reviewed Bondbuilder research-lane amendment (blocked in S1). (a) Refinement question: gating (plan recommends a Bondbuilder), placement after `wet_wash_frequency`, answer storage in `care_habits` + provenance, assumed default, save/read/rebase/recompute, edit/reset (F10). (b) Ranking trust → usage → budget → K18 applied identically in default, alternatives, previews, discovery and native; tests for absent/unmet preference and budget cap. (c) Aveda: persist source-bound cadence branches, resolve moderate → weekly / high+severe → every wash from derived damage, carry it into routine cadence, generic fallback otherwise (F11).
- **S5 One row per category.** (a) Package identity: linkage table/column, identifier ownership per package (unique GTIN owner index changes), sibling semantics distinct from `replaced_by`, backfill of the 7 known pairs, types/RPCs/audits, replay + rollback tests (F12). (b) Scan/save end to end: package expansion, plan-needed/best-fit verdict, per-use result navigation, one-sheet save into the chosen sibling, wishlist/history/free-reveal semantics, web + mobile contract + iOS, single-use regression (F13). (c) Plan: same package in two slots; budget/purchase counting by package (#654 counts by product id) (F14). (d) Intake: package-aware sibling submission/review/apply with per-category research; engine standards versioned for multi-use (Conditioner exclusion, Guhl mode conflict) (F15). (e) Pantene 7in1 leave-in row: reference migration (owner, drafts, frozen plans) within this slice. (f) Research the ~22 multi-use candidates against M2.

## 11. Codex plan review (2026-10-09) — findings ledger

| ID | Type | Decision | Plan change |
|---|---|---|---|
| F01 stale baseline vs #654 | defect | accepted | T1.0 |
| F02 generator omits K18/OGX/Neqi | defect | accepted | §8 generator coverage |
| F03 Neqi needs rinse-off density protocol code | defect | accepted (verified `stage5-v2-builder.ts` maps density to leave-on only) | T1.5 |
| F04 reference handling for recategorise/retire | defect | accepted | T1.5 inventory; Pantene in S5(e) |
| F05 publication gate alignment before heat-only rows | defect | accepted | S3(c) |
| F06 S2 input/ranking task | defect | accepted | S2(b–d) |
| F07 deep-cleansing targets need v1.6 handoff + array storage | defect | accepted | S2(a) |
| F08 S3 is an engine version, not a flag | defect | accepted | S3(a,b,e) |
| F09 bespoke guidance needs exact workflow lane | defect | accepted | S3(d) |
| F10 S4 persistence + ranking parity | defect | accepted | S4(a,b) |
| F11 Aveda branches need projector + damage context | defect | accepted | S4(c) |
| F12 package identity migration | defect | accepted | S5(a) |
| F13 scan/save contracts end to end | defect | accepted | S5(b) |
| F14 budget counts by product id | defect | accepted | S5(c) |
| F15 intake + engine standards for multi-use | defect | accepted | S5(d) |
| F16 stale text vs rulings | defect | accepted | §6 rewritten; research files superseded by `decisions.md` (Bali no heat, Neqi spray → S3, Balea Tiefenreinigung keeps both rows) |
| F17 completion claim | scope proposal | accepted by Nick 2026-10-09 | Rule: "done" = the named batches closed + an explicit residual ledger (e.g. provenance debt for Balea Hydra Volume, Balea 2in1 Urea, Nivea), not "whole catalogue complete" |

## 9. Verification

Automated: `npm run ci:verify`; targeted suites `stage3-authority`, `stage3-fit-comparison`, product-previews, scan resolve tests, new per-example winner tests (S2), leave-in adapter tests (S3). Live-state: audits listed in T1.7, before/after reads per manifest. Manual: scan replay of the named products on web; Personal Plan check with a sensitive-scalp and an oily-scalp test profile (S2); Anwendung view for a heat-activated product (S3).

## 10. Review and handoff

One Codex whole-branch review per slice before push. Each slice ships as its own PR via `/ship`; merges and production applies are separate go-aheads. Artifacts: `decisions.md`, `plan.md`, `research/**` → commit with S1; transient agent transcripts → discard.
