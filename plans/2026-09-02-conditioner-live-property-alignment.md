# Conditioner live-property alignment

Implementation status: completed and logic locked as Conditioner Standard v1.6 on 2026-09-02. Product-level Lab approvals and production integration remain separate gates.

## Outcome and source context

Extend the Conditioner Research Lab from seven to nine comparison properties so every independent live conditioner fit fact has a reproducible research source while the Lab remains the more sophisticated research model.

Source context:

- Nick's 2026-09-02 decision: include product-side `care_direction` and quickly check whether any other live conditioner property is absent.
- Live operations contract: `docs/product-intake-research-ops.md`.
- Current research authority: `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md`.
- External evidence boundary: INCI can identify plausible conditioning, film-forming, humectant, emollient, and protein/peptide routes, but it does not prove a user's deficiency or measured finished-product performance.

## Chosen direction

Add two independently reviewable research properties:

1. `care_direction: protein | moisture | balanced`
   - This is the product formula's comparative care direction.
   - It projects one-to-one to live `balance_direction`.
   - It must never be described as proof that a user has a protein or moisture deficiency.
2. `repair_support_level: low | medium | high`
   - This is the strength of the product's distinct damage-support route.
   - It projects one-to-one to live `repair_level`.
   - It is not interchangeable with `damage_fit`, which remains the broad product-cohort prior.

Both fields ship in this pass. Repository evidence settles the second-field question: live fit independently compares `repair_level` against a user repair target, while `damage_fit` is explicitly a broad cohort prior and not a repair-efficacy claim. Deriving one from the other would collapse two different decisions and could produce contradictory live behavior.

The semantic standard version is locked as `v1.6`. This work sequences after the accepted v1.5 Damage Fit recalibration and treats the current 77-cell / 63-cell adjudicated artifacts as historical input, not as constants to preserve after the nine-field rerun.

The current live fields map as follows:

| Live fact | Research source | Decision |
| --- | --- | --- |
| `weight` | `weight_potential` | derive `low/moderate/high` to `light/medium/rich` |
| `repair_level` | `repair_support_level` | add as a new reviewed property |
| `balance_direction` | `care_direction` | add as a new reviewed property |
| suitable thickness rows | `hair_thickness_fit` | derive with `medium` to live `normal` vocabulary normalization |
| protein/moisture eligibility rows | user target plus `care_direction` compatibility policy | derive later; do not research as a product ingredient fact |
| `ingredient_flags` | normalized INCI and detailed route trace | deterministic trace export; do not add as a headline review property |

Classification boundaries:

- `protein`: a specific protein, peptide, or keratin route is sufficiently meaningful to define the formula's comparative direction; a product name alone never creates this value.
- `moisture`: no meaningful protein route dominates and the differentiating architecture is humectant, emollient, lipid, or conventional softening support. This is cosmetic care shorthand, not proof of water delivery inside the fibre.
- `balanced`: meaningful protein/peptide and moisture/emollient routes coexist without one clearly dominating. It is not an uncertainty bucket.
- Unresolved formula conflicts remain explicitly uncertain while still using the best-supported value for pragmatic review.
- `repair_support_level` follows route strength: ordinary lubrication only is low; a distinct temporary protein/film route is medium; high requires a materially stronger named bond route visible in the reviewed formula and remains capped by the standard's E2 evidence ceiling. Positioning alone cannot raise the level.

## Scope and non-goals

In scope:

- update the normative standard and every consuming Conditioner research guide;
- add the two fields to the accepted pilot data, Lab types, validation, evidence reasoning, fingerprints, UI, queue state, calibration totals, and tests;
- preserve every unchanged approval and open only the two new fields for the 11 eligible products;
- keep the excluded leave-in at the G0 boundary;
- research and expose English, ingredient-specific reasoning with exact INCI positions and adjacent-class explanations.
- preserve the complete evidence payload and resulting unsalted field fingerprint for each existing field byte-for-byte; adding the two new properties must not reword or regenerate any existing field evidence.

Non-goals:

- no Supabase, catalog, Product Intake, recommendation-engine, or production data writes;
- no automatic publication of eligibility rows or ingredient flags;
- no change to the user's pull-test vocabulary or assessment logic;
- no claim that INCI proves penetration, structural repair, or a biological protein/moisture deficiency;
- no redesign of the Lab navigation or approval interaction.

## Target map

- Normative guidance: `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md`, quick reference, agent context, research prompt, runbook, integration contract, checkpoint, rule changes, and reading copies.
- Pilot data and calibration: `data/research/conditioner-inci/v1.0/calibration-full-profile-key.json` plus active packet/agreement/schema/manifest artifacts.
- Lab data and evidence: `src/lib/labs/conditioner-research-access.ts` including the hard calibration invariants and vocabulary validation, `src/lib/conditioner-research/profile-evidence.ts`, `src/lib/conditioner-research/review-state.ts`.
- Lab surface: `src/app/labs/conditioner-research/research-lab-client.tsx`, `queue-audit-client.tsx`, and calibration copy.
- Verification: `tests/conditioner-research-lab-access.test.ts`, `conditioner-research-lab-api.test.ts`, `conditioner-research-queue-audit.test.tsx`, `conditioner-research-review-state.test.ts`, plus focused classification and fingerprint-preservation cases.

## Designed user journey

1. Nick opens the local Conditioner Research Lab and selects an eligible pilot product.
2. The compact classification overview shows nine properties. The existing seven remain in their prior state. `Pflegerichtung / care_direction` and `Repair-Unterstützung / repair_support_level` appear as new open rows.
3. Each new row shows the value, exact INCI signals, how the formula pattern maps to that value, why the adjacent alternative was rejected, and the E2 or stronger evidence ceiling.
4. Nick can approve or request rework on either new property exactly like the existing properties.
5. A whole-product approval remains blocked until all nine properties are approved. Existing seven approvals are not lost merely because the standard version advances.
6. Source conflict or genuine ambiguity stays visible as an uncertainty and can be sent to rework; the Lab does not silently copy current production values.
7. Completion is a locally approved nine-property pilot profile. Catalog/production activation remains a separate, explicit later gate.

No new loading, empty, or navigation state is introduced. Persistence failure continues to use the Lab's existing rollback/error behavior.

User-journey sign-off: confirmed by Nick on 2026-09-02. The confirmed journey keeps the existing Lab workflow, adds both new fields, preserves the seven existing per-field approvals, and intentionally reopens whole-product approval until all nine properties are reviewed.

## Planning evidence

- `docs/research/conditioner-inci/v1.0/planning-evidence/conditioner-live-property-alignment.html`
- Question answered: how the two missing live facts appear without making the product audit harder to use.
- Selected direction: two ordinary review rows in the existing compact table and evidence cards; no new tab or workflow.
- Evidence review: confirmed by Nick on 2026-09-02; both proposed rows and the unchanged review interaction were accepted.

## Ordered tasks

### 1. Lock the two property contracts and draft pilot values

Consumes: exact manufacturer-authoritative pilot formula, existing direct-property trace, and the external evidence ceiling.

Produce: normative v1.6 `care_direction` and `repair_support_level` rules plus one proposed value/evidence packet for each eligible pilot product. The new research names remain distinct from historical `rerank_spec.balance_direction` and `rerank_spec.repair_level`, which stay comparison-only under the evidence firewall.

Completion: every value names decisive INCI signals, rejects the closest alternative, and avoids user-deficiency or structural-repair wording.

### 2. Run the fresh blind calibration and regenerate invariants atomically

Consumes: the v1.6 property rules, exact pilot formula packets, and proposed new-field values withheld from the blind reviewer.

Produce: independent blind values for both new fields, adjudicated decisions, regenerated reviewer/agreement artifacts, new total/exact/non-focus denominators, and updated hard invariants and error copy in `src/lib/labs/conditioner-research-access.ts`.

Completion: the Lab data loader accepts the regenerated nine-field artifact set; no seven-field or 77-cell invariant remains active; any disagreement stays visible instead of being overwritten. Repeatability is claimed only for the newly run v1.6 review, not inferred from the historical v1.5 artifacts.

### 3. Extend the accepted research artifacts without invalidating unchanged work

Consumes: the two property packets and existing seven-field profiles.

Produce: nine-field accepted profiles, updated schema/manifest/calibration artifacts, `PROFILE_VOCABULARY` values for both new enums, validation/parsing support, and property-scoped fingerprints.

Completion: existing seven field fingerprints and complete evidence payloads remain byte-equivalent; the two new field fingerprints are new and unreviewed. Per-field approvals persist, while the whole-product profile fingerprint intentionally changes and its approval becomes stale until all nine properties are approved.

### 4. Add the two rows to the existing Lab review workflow

Consumes: nine-field Lab data.

Produce: compact overview rows and full evidence cards using the current approval/rework controls.

Completion: all nine properties are visible, individually actionable, and counted correctly; every literal that means the property count changes from seven to nine, while unrelated historical copy about seven adjudicated differences stays unchanged; G0 remains unchanged.

### 5. Synchronize durable guidance and reading copies

Consumes: implemented rules and verified pilot values.

Produce: synchronized normative standard, operator guidance, integration contract, checkpoint, change log, DOCX/PDF reading copies, and explicit statement that no production activation occurred.

Completion: no consuming guide still calls the model seven-field or treats historical balance/repair data as research input.

## Verification

Automated:

- focused Lab data/access/API/review-state/rendering tests;
- regression proof that seven existing approvals survive and two new fields open;
- direct assertion that every existing field evidence payload and fingerprint is unchanged across the v1.5 to v1.6 version bump;
- regression proof that whole-product approval requires nine eligible fields;
- vocabulary and per-product evidence assertions for both new fields;
- typecheck, lint, and production build.

Manual/browser:

- inspect one moisture, one protein, one balanced, and one G0 example;
- approve and rework each new property once;
- verify compact table, detailed evidence, progress count, queue state, and persistence rollback copy.

Evidence-sensitive review:

- verify that formula-only statements remain at E2;
- verify that `balanced` is not used merely because evidence is unclear;
- verify the fresh blind calibration and adjudicated agreement artifacts before claiming v1.6 repeatability.

Live-state checks: none. Production and Supabase remain untouched.

## Review and handoff

- Worktree: `.worktrees/conditioner-inci-research-plan` on `codex/conditioner-inci-research-plan`.
- Planning evidence review: confirmed 2026-09-02.
- Designed user-journey sign-off: confirmed 2026-09-02.
- Counterpart plan review: complete with revisions incorporated.
- Implementation must use `implementation-loop`, then `ready-check` and `request-code-review`.
- Stop before commit, push, PR, catalog write, production activation, deploy, merge, or cleanup.
- Artifact disposition: plan and HTML evidence commit with the eventual research branch; transient counterpart output is discarded after reconciliation.

## Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | Lab loader hardcodes seven-field and 77/63-cell calibration invariants | accepted | Fresh blind calibration and invariant regeneration promoted to Task 2 | loader and calibration tests |
| C2 | defect | Existing approval preservation hashes the complete evidence payload | accepted | Existing evidence generators and payloads are frozen; explicit byte/fingerprint regression added | approval-preservation test |
| C3 | tradeoff | A second property expands the calibration pass | accepted | Keep `repair_support_level`; live runtime proves it is independent from `damage_fit` | formula and fit-contract review |
| C4 | defect | Whole-profile approval cannot survive addition of two fields | accepted | Clarified that only per-field approvals persist; whole-product approval intentionally becomes stale | review-state/API test |
| C5 | defect | Vocabulary, literal counts, and specific tests enumerate seven fields | accepted | Named validation and test targets explicitly | focused suite plus build |
