# Conditioner INCI research v1.6 logic-lock verification receipt

Date: 2026-09-02
Branch: `codex/conditioner-inci-research-plan`
Task base: `f5ed63193a697a4a9fc44fad8af2bcd2bcc4f391`; the branch remains intentionally unre-based during this local checkpoint
Scope: local, development-only Conditioner pilot; no catalog, Product Intake, Supabase, commit, push, or PR action

The current standard and reading-copy identities are recorded in `artifact-manifest.json`; this receipt intentionally does not duplicate a whole-scope hash that would become stale as review notes are corrected.

## Verified checkpoint

| Outcome | Evidence | Result |
|---|---|---|
| Current lean profile | 11 eligible products each have the nine required comparison fields; `rinseability`, `usage_role`, and `scalp_application_fit` are absent | pass |
| Independent new-field comparison | Reviewer G classified only `care_direction` and `repair_support_level` for all 11 eligible formulas: 22/22 exact against accepted key | pass |
| Composite agreement | Frozen Reviewer F seven-field values plus Reviewer G's two new fields: 94/99 pre-adjudication, 85/99 overall (85.9%), 68/77 non-focus | disclosed; not full v1.6 repeatability |
| Named focus recalibration | Hair Food, NEQI, John Frieda, Guhl Panthenol, and OGX match Reviewer F on primary and secondary focus | pass |
| Bali formula authority | manufacturer formula plus exact-EAN HAGEL confirmation; zero active formula conflicts; focus hierarchy remains separately visible | pass |
| Boundary | Cantu Leave-In Repair Cream stops at G0 and has no invented Conditioner profile | pass |
| Historical stress cases | v1.2 suite remains 5/5; it does not cover the two new v1.6 fields | disclosed; not current-field validation |
| Review surface | 12 queue cards, nine-property audit, resolved Bali state, focus recalibration view, and no catalog or production actions | pass |
| Reusable logic lock | Nick reviewed the discriminating NEQI `protein / medium`, OGX `balanced / medium`, and Guhl Bond+ `moisture / high` anchors; vocabulary, thresholds, E2 ceiling, and reasoning contract are locked in Standard v1.6 | pass |
| Machine-readable receipt | `data/research/conditioner-inci/v1.0/v1.6-logic-lock-receipt.json` records the locked scope, anchors, validation limits, and separate product/production gates | pass |
| Review-source provenance | Exact v1.6-rc1 source snapshot retained at SHA-256 `f317b8514ecc72e14ea97220c99dbe01ba528e408f2b4f211264bced79a157a8`; final v1.6 records the clarified two-value Damage Fit output separately | pass |

## Recalibration decisions

- `rinseability` is removed from the lean profile. `weight_potential` remains the ingredient-informed deposition signal; actual `rinse_behavior` stays in the detailed trace as `unknown` without exact finished-product testing.
- Bali Curls Moisturising Conditioner Reisegröße uses the producer formula for exact product ID `8182ee3f-cfe9-4a31-8b2f-a6a52c7e7abe`, EAN `4262391991626`, fingerprint `5c643700db25fece77b870b6a1d9d58d15435540c46a011e471563a346808c7f`. The divergent dm transcription is source history; the Flaconi formula belongs to EAN `4262391990056`.
- Primary focus is a forced research headline after baseline conditioning is excluded. `general` is used when no purpose is distinctive; supported capabilities remain available for later flat benefit mapping. Marketing is corroboration only.
- Formula authority was re-resolved for Bali. The five products raised in review were re-read from the locked exact-formula evidence for focus and weight adjudication; focus hierarchy was then blind-checked across all 11 eligible products.

## Remaining review judgments

The five products raised in this review are now independently repeatable:

- Hair Food Aloe Vera: `smoothing` primary; `detangling`, `curl_support` secondary.
- NEQI Volume Victory: `smoothing` primary; `repair` secondary.
- John Frieda Frizz Ease: `smoothing` primary; `detangling` secondary.
- Guhl Panthenol + Reparatur: `general` primary; `detangling`, `smoothing` secondary.
- OGX Biotin & Collagen: `smoothing` primary; `repair` secondary.

Five focus-only differences remain on Cantu Conditioner Cream, Jean&Len Colorglow, and Bali Curls. These are special-purpose hierarchy judgments, not formula blockers. The retained comparison covers conditioning, weight, focus, hair-fit, damage-fit, and texture-fit. Exact use directions remain protocol metadata.

NEQI now uses a human-approved `weight_potential: moderate` fallback and includes fine hair in the broad thickness prior. Reviewer F selected high and medium+coarse, so these are two transparent policy differences rather than blind agreement. Under v1.5, NEQI's oat peptide is one of the three qualifying specialist Damage Fit routes; OGX hydrolyzed collagen and Bond+ named bond pair are the other two. The pilot otherwise maps to `healthy` plus `moderately_damaged`; no low-conditioning profile was observed.

## Fresh checks

- Promoted the reviewed care-direction and repair-support v1.6-rc1 rules to final v1.6 after Nick's anchor review. The exact release-candidate Markdown is retained and hash-bound for historical verification. Final v1.6 also makes the already-accepted Damage Fit shape explicit: the specialist result is exactly `moderately_damaged` plus `highly_damaged`, replacing the general set and never adding a third value. No accepted product classification changed.

- Parsed every current Stage A contract artifact and validated 11 × 9 complete profiles, legal field presence, one exclusion, and no `rinseability`, `usage_role`, or `scalp_application_fit` comparison key; explicitly historical reviewer provenance may still carry retired keys, which current parsers ignore.
- Recorded independent Reviewer G agreement of 22/22 exact for `care_direction` and `repair_support_level`. The active composite preserves frozen Reviewer F values for the historical seven fields and adds only Reviewer G's two fields: 94/99 pre-adjudication, 85/99 overall (85.9%), and 68/77 non-focus. It is not a fresh de-novo nine-property blind rerun and cannot be described as full v1.6 repeatability.
- Confirmed Bali's manufacturer fingerprint and an empty direction-conflict list.
- Ran the focused Conditioner loader, review-state, API, UI, and rework suites after the v1.6 extension: 38 passed, 0 failed. This includes byte-for-byte preservation of all seven v1.5 field fingerprints, an isolated stored-state migration proving that the two new properties alone open when the earlier seven are unchanged, fail-closed handling for a malformed or non-file local review-state path, exact Damage Fit replacement sets, and SHA-256/byte verification of the locked manifest artifacts.
- Ran `npm run typecheck`, `npm run lint`, and a production `npm run build` with non-secret placeholder public Supabase values. Typecheck passed; repository lint passed with five pre-existing warnings outside the Conditioner scope and no task-owned errors or warnings; the production build passed all 144 pages.
- Exercised the local Conditioner Lab with 12 cards, zero active formula conflicts, Cantu G0, the disclosed v1.6 composite comparison, five visible focus differences, the NEQI weight policy override, and the 8/3 Damage Fit split.
- Verified the real local review-state migration read-only: each of the four previously approved v1.4 products retains six unchanged approvals; Damage Fit plus the two v1.6 properties are open, and the whole-product approval is stale until local re-approval.
- Verified desktop Lab reasoning for Balea Med general care plus NEQI peptide, OGX mixed protein/moisture, and Bond+ bond-chemistry routes. Each new property names exact INCI positions, explains the adjacent alternative, and preserves the E2/finished-product evidence ceiling.
- Synchronized the v1.6 DOCX and PDF reading copies from the normative Markdown update; accessibility audit returned 0 high, 0 medium, and 0 low findings, and exact table-width/indent/grid/cell geometry passed. All 9 rendered pages were visually reviewed with the v1.6 title, metadata, repeating header/footer, canonical nine-field list, new rule section, and final composite-calibration caveat present. The changed threshold and table pages were rendered and checked again after the final review corrections; no clipping, overlap, split data row, broken table, or missing clarification remains.
- Confirmed durable and delivery workbooks are byte-identical and the artifact-manifest sizes/hashes match the final files.
- Reloaded the development Lab on port 3237 and confirmed HTTP 200, the nine-field product overview, preserved/open review states, 85/99 composite, 22/22 new-field result, and explicit non-repeatability caveat. No review action was submitted during verification.
- Completed independent code, structural/UX, and Claude review lanes. Resolved the material findings by constraining `balanced` to substantive mixed protein-plus-moisture architecture, requiring formula-visible named bond chemistry for `repair_support_level=high`, blocking malformed review-state reads, removing `Ethylhexylglycerin` as a false glycerin signal, exposing product assumption notes in the audit, deriving calibration caveats from the research artifacts, labeling the 5/5 stress suite as historical v1.2 evidence, aligning atomic whole-product approval wording, retaining the exact v1.6-rc1 review source, correcting the fresh-rerun flag, aligning runtime/schema version `1.6`, adding the v1.5 Damage Fit UI provenance, and binding the final artifacts in an executable manifest check.

## Residual risk and stop boundary

Stage A calibrates ingredient-informed product priors; it does not prove finished-product sensory performance or universal user fit. Full-cohort directions, 40 identifier gaps, repeated-use buildup, exact rinse behavior, production multi-use mapping, and fresh adversarial stress cases for the two new fields remain outside this pilot. The local development-only POST route has no origin check; this is accepted for the current local-file review tool and must be revisited before any broader exposure.

The authority artifacts and reading copies are included in the proposed task tree; only local reviewer decisions and the local rework queue remain ignored. No Stage B, catalog/recommendation write, database mutation, commit, push, PR, deployment, or activation is authorized by this receipt.

Bottom line: **the reusable v1.6 nine-property classification logic is locked. Reviewer G independently matched the two new fields 22/22 under the semantically identical release-candidate rules, and the disclosed 85/99 composite is not a fresh de-novo v1.6 rerun. Formula-only calls remain E2; each product still needs its own Lab decision, and a fresh full rerun remains required before broad repeatability or production claims.**
