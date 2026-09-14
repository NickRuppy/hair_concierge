# Shampoo wave research execution plan

Status: complete — research draft produced; human review/apply remains separate

## Outcome and source context

Research the complete selected German shampoo wave as reviewable, source-backed,
research-only Product Intake manifests. The wave contains 53 new-product candidates
plus one known existing-product correction. Every selected item must finish in one
explicit state: manifest-ready, existing-product update, needs research, routed to
deep cleansing, or structurally excluded. Nothing may silently disappear.

Authoritative sources:

- `plans/scan-db-expansion/research/shampoo-research-handoff.md` — write scope,
  manifest contract, source requirements, image bar, protocol rules, and stop boundary.
- `plans/scan-db-expansion/selection-batch1-draft.json` — 8 pilot and 30 current
  backlog Shampoo entries plus the known Glycolic Gloss correction.
- `plans/scan-db-expansion/shampoo-wave-extension.json` — 15 included extension
  candidates; `considered_and_rejected` remains excluded.
- `docs/research/shampoo-inci/v1.4/classification-standard.md` and
  `new-product-research-runbook.md` — exact-identity, canonical-INCI, formula-first,
  independent-repeatability, and confidence authority.
- Main merge `da8c9cc33452e7c8ca81f15fcad1d7c525210938` (PR #508) — implemented
  Shampoo Production Light v1 adapter and operator guide at
  `/Users/nick/AI_work/hair_conscierge/docs/product-intake-shampoo-production-light.md`.
- `src/lib/product-intake/expansion-manifest.ts`,
  `src/lib/product-intake/category-validators.ts`, and
  `plans/scan-db-expansion/protocol-templates.md` — final manifest referee.

Roster-count ruling: the current selection JSON, not the stale prose count in the
handoff, controls membership. It contains 8 pilot + 30 backlog Shampoo candidates;
the handoff's `(31)` / `~54 total` wording reflects the separate Glycolic Gloss
existing-product correction. With 15 extension candidates, the executable roster is
53 new products plus one existing-product update.

Planning contract:

```text
Outcome: four reviewable Shampoo manifests and four companion notes files account
         for all 53 selected candidates and the known existing-product correction.
Constraints: current German exact-product evidence; Shampoo v1.4 research before
             projection; no invented identifiers; no unsupported or medical claims;
             only permitted research files change; no database or catalog writes.
Non-goals: image processing/upload, Product Intake approval, catalog apply,
           recommendation promotion, migration execution, commit, push, merge,
           deployment, or modification of the frozen Shampoo v1.4 method.
Done when: every selected item has an explicit outcome; each complete manifest passes
           the expansion validator; cross-batch identity/EAN checks pass; notes expose
           confidence, conflicts, exclusions, routing, and open questions; a final
           receipt reports coverage and stop state.
```

## Chosen direction

Use a four-batch evidence pipeline. The main Codex session owns the frozen roster,
adjudication, integration, validation, and final receipt. After Nick explicitly asked
to kick off workers and explorers, bounded workers received disjoint manifest/notes
ownership; no two writers shared a durable file. Read-only research lanes collected
source evidence and independent labels. The main session inspected every handback and
reran the full-wave gates.

For each product, research exact identity and commercial evidence first, freeze a
canonical formula packet, complete Shampoo v1.4 formula-first and post-unblind
classification, run the merged Production Light adapter, and then combine the
projected Shampoo properties with the separately researched Product Intake fields.
The adapter is a property projector, not a web researcher or manifest generator.

Review rulings confirmed by Nick on 2026-09-02:

- Select a current manufacturer formula when the exact product page binds that
  formula to the selected GTIN. Otherwise, two current reputable exact-EAN retailer
  sources may establish the canonical formula. Preserve conflicting stale, regional,
  abbreviated, or reformulated lists in the notes instead of merging them.
- An ordinary rinse-out Shampoo may use `TPL-SHAMPOO-STD` without a separate exact-SKU
  wet-hair/rinse sentence when exact Shampoo identity is solid and the generic
  mechanical-use basis is disclosed. Product-specific waits remain deviations;
  targeted and anti-dandruff evidence is not weakened by this ruling.
- Apply the canonical Product Intake candidate-image bar: exact, product-only,
  front-facing, renderable, and roughly 800 px on the **long** side. The superseded
  800 px short-axis interpretation was stricter than the owning runbook.

Run the adapter from the clean root checkout at
`/Users/nick/AI_work/hair_conscierge`, because the task worktree intentionally has not
been rebased onto PR #508. Store input envelopes and adapter outputs in one
task-specific temporary directory. The only durable research outputs in the task
worktree are the permitted `shampoo-manifest-*.json` and
`shampoo-research-notes-*.md` files plus this plan after operator sign-off.

Do not trust the root checkout merely because it is named `main`. Before research,
compare the blob IDs for the Production Light adapter, CLI, package/lock files, and
its direct repository dependencies (`shampoo/constants`, `shampoo-protocol-roles`,
`vocabulary/index`, and product-identity normalization plus its index boundary)
against merge `da8c9cc3`; also
confirm the worktree's shared Shampoo constants and protocol-role helper match that
pinned merge. Stop if any compared blob differs. Unrelated future root-main commits may
exist, but the exact research engine and shared vocabulary must remain pinned for the
whole wave.

Within every 15-product batch, work in three ordered five-product cells (the final
eight-product batch uses 5 + 3). After each cell, freeze temporary source/research
artifacts, append the five item statuses to the notes draft, and record input/output
hashes. A stopped session resumes from the last complete cell rather than repeating or
silently skipping products.

### Frozen roster and batches

| Batch | New-product candidates | Count | Durable outputs |
| --- | --- | ---: | --- |
| 01 | Pilot Shampoo entries in source order (8), then backlog ranks 32–38 | 15 | `shampoo-manifest-01.json`, `shampoo-research-notes-01.md` |
| 02 | Backlog ranks 39–53 | 15 | `shampoo-manifest-02.json`, `shampoo-research-notes-02.md` |
| 03 | Backlog ranks 54–61, then extension ranks 153–159 | 15 | `shampoo-manifest-03.json`, `shampoo-research-notes-03.md` |
| 04 | Extension ranks 160–167 | 8 | `shampoo-manifest-04.json`, `shampoo-research-notes-04.md` |

The known catalog row `88c230c5-1020-4648-a10e-c2a1e8c87e0e`
(`Ultimate Shampoo` -> `Elvital Glycolic Gloss Shampoo`) is an
`existing_product_updates` action in batch 01, never a new-product row. The 14
`considered_and_rejected` extension items and non-Shampoo parked items are outside
the roster. Its suggested 300 ml Rossmann EAN remains notes-only unless current exact
sources independently verify it; the queued rename does not authorize an unverified
identifier addition.

### Product-versus-size rule

One selected ledger entry is one research product, not one row per package size.
Choose the exact current size supported by the primary reviewed product page for
`net_content_value/unit`. Add another size's EAN to the same product only when current
evidence proves it is the same German formulation. Record unverified alternative sizes
in the notes. A materially different formula, market, or ambiguous reformulation is
blocked rather than merged or silently split into another product.

### Per-product outcome rules

- **Manifest-ready:** exact identity, at least one valid EAN, canonical complete INCI,
  moderate-or-high final Shampoo research, a Production Light
  `property_lane_ready` result, complete Product Intake fields, and reviewable sources.
- **Existing-product update:** same brand and formulation as an existing catalog row;
  no new product is created. Only verified identifiers and/or the queued rename are
  recorded under `existing_product_updates`.
- **Needs research:** missing EAN, unresolved exact identity or formula, low-confidence
  direct property, failed image bar, missing application source, or another evidence
  gap. It remains accounted for in notes and is not forced into a passing product row.
- **Routed deep cleansing:** Production Light returns `routed_deep_cleansing`; record
  the route and evidence in notes and omit a regular-Shampoo product payload. A later
  deep-cleansing workflow is a separate task.
- **Structurally excluded:** the item is not a rinse-out Shampoo or has another category
  mismatch. Record the exact reason; do not repurpose Shampoo templates.

## Scope and non-goals

### In scope

- Read-only browsing of current German manufacturer and reputable retailer sources.
- Read-only existing-catalog duplicate checks by brand, exact name, GTIN, formulation,
  and relevant current catalog aliases.
- Exact identity, size, EAN, formula, claims, directions, price, packshot, and source
  capture.
- Full eight-property Shampoo v1.4 research with a frozen formula-first pass,
  post-unblind reconciliation, an independent judgment lane, and adjudication.
- Deterministic Production Light projection into ideal thicknesses, Shampoo rows,
  observed cleansing intensity, required protocol roles, rationales, and warnings.
- Product Intake concern, evidence, protocol stamp, candidate-image, and commercial
  fields required by the expansion manifest.
- Four manifests, four notes files, per-batch validation, and one cross-wave receipt in
  the final notes file.

### Non-goals

- No changes to selection ledgers, protocol templates, source code, tests, migrations,
  Supabase, or the parked Shampoo research package.
- No EAN inference beyond a real source value followed by GS1 check-digit validation.
- No claim that a product is catalog-intake-ready or globally recommendation-ready.
- No medical diagnosis, treatment framing, or hair-loss efficacy assessment.
- No image download, background removal, final image generation, upload, or approval.
- No apply, publication, activation, commit, push, PR, merge, deploy, or cleanup.

## Target map

Durable task-owned files:

- `plans/scan-db-expansion/research/shampoo-wave-research-execution-plan.md` — this
  plan; intended disposition: commit later only if the owning branch reviewer elects
  to retain the research procedure.
- `plans/scan-db-expansion/research/shampoo-manifest-01.json` through
  `shampoo-manifest-04.json` — exact expansion-manifest payloads; intended
  disposition: commit after human review in the owning branch, not during research.
- `plans/scan-db-expansion/research/shampoo-research-notes-01.md` through
  `shampoo-research-notes-04.md` — evidence/confidence/open-question records and final
  receipt; intended disposition: commit after human review in the owning branch.

Read-only contracts:

- Selection: `plans/scan-db-expansion/selection-batch1-draft.json` and
  `plans/scan-db-expansion/shampoo-wave-extension.json`.
- Manifest: `src/lib/product-intake/expansion-manifest.ts` and
  `src/lib/product-intake/category-validators.ts`.
- Protocols: `plans/scan-db-expansion/protocol-templates.md`.
- Research: `docs/research/shampoo-inci/v1.4/`.
- Projection: root-main `src/lib/shampoo/production-light-adapter.ts` and
  `scripts/shampoo-research/project-production-light.ts` at merge `da8c9cc3`.

Transient artifacts:

- Task-specific temporary directory containing the frozen roster, source packets,
  blind/final lane records, independent labels, research envelopes, adapter outputs,
  and batch summaries. Disposition: retain until Nick completes research review, then
  discard; never commit or copy into disallowed worktree paths.
- Counterpart plan review output. Disposition: discard after findings are reconciled.

## Designed operator journey

There is no end-user or production behavior change.

1. Nick confirms this plan. That confirmation includes the 15 extension candidates
   and authorizes read-only independent research lanes for the frozen 53-product wave.
2. The main session freezes the exact ordered roster and creates a temporary research
   workspace without altering either selection ledger.
3. For each batch, source research resolves exact German identity, formula, EAN,
   price, directions, and a qualifying packshot. Progress reports distinguish ready,
   blocked, existing, and routed items rather than presenting raw browsing activity.
4. Each exact formula is assessed formula-first under Shampoo v1.4. The first result is
   frozen before claims are reconciled. A fresh-context independent lane receives the
   same permitted source packet but no first-lane conclusions. The main session
   adjudicates every disagreement without tuning labels to obtain a preferred result.
5. Every complete product runs through Production Light. Invalid, low-confidence, or
   deep-cleansing outcomes fail closed and remain visible in the batch accounting.
6. The main session writes only the batch's manifest and notes file, runs the canonical
   expansion validator and a temporary adapter-to-manifest equality verifier, and
   corrects research or serialization errors until the complete entries pass. The
   verifier uses the frozen roster's product-ID-to-manifest-index crosswalk and checks
   exact JSON equality for `category_specs`, the renamed thickness list, projected
   rationale strings, and template-derived protocol roles. Evidence gaps remain
   explicit rather than being guessed.
7. After batches 01–04, the main session runs a cross-wave duplicate/EAN and accounting
   audit. The last notes file reports total selected, manifest-ready, existing updates,
   excluded EANs, needs-research items, routed products, structural exclusions,
   protocol deviations, and open questions.
8. Nick receives four draft manifest/notes pairs for review. Nothing has been applied,
   uploaded, committed, published, or activated. Any later apply begins with a separate
   exact-manifest preflight and new authorization.

Recovery behavior:

- Broken or unavailable source page -> try the next authority in the documented source
  hierarchy and record the failed source; never silently substitute a foreign formula.
- Valid single-source EAN -> include it with `cross_source_agreement: false` and
  `excluded_from_apply: true`.
- No EAN after the documented searches -> keep the product in notes as needs research;
  do not invent an identifier or emit a passing product row.
- Conflicting formula or pack-size evidence -> apply the confirmed evidence-precedence
  ruling, preserve every conflicting source, and block only when no current canonical
  formula can be selected honestly.
- No image meeting the product-only, straight-on, roughly >=800 px long-side bar -> record the
  best rejected candidate and block image readiness.
- Adapter `needs_research` -> change the research envelope, not the generated output,
  then rerun.
- Adapter `routed_deep_cleansing` -> record and route; never coerce it to Shampoo.
- Existing-catalog collision -> move the action to `existing_product_updates` and
  remove the proposed new-product entry before validation.

Operator-journey sign-off: **confirmed on 2026-09-02** — Nick authorized the full
53-product roster, including the 15-product extension, parallel read-only workers
and explorers, and continuous execution through all four batches without a planned
pause after batch 01.

## Planning evidence

This is a research/operator workflow with no end-user surface, UI copy, timing, or
feedback change. No visual mockup or prototype is required. The relevant planning
evidence is the shipped Production Light CLI, its ten-product calibration, the passing
expansion-manifest example, and the exact handoff/schema contracts. Evidence review is
complete at the repository-contract level, and Nick confirmed the operator journey on
2026-09-02.

## Ordered tasks

### 1. Freeze the roster and temporary research workspace

Read both selection files, filter exactly the chosen Shampoo candidates, preserve
source order/ranks, add the known existing-product correction, and write a temporary
machine-readable roster with batch assignment, product-ID-to-manifest-index crosswalk,
and initial EAN/source facts. Compute a SHA-256 receipt for the roster and record it in
notes 01. Pin the Production Light implementation by comparing the adapter, CLI,
package/lock, and direct-dependency root-main blob IDs against merge `da8c9cc3`, and
compare the shared Shampoo constants and protocol-role helper with the task worktree.
Run the focused adapter/CLI tests and ten-product fixture batch once as the executable
preflight. Create a temporary equality verifier that reads the frozen roster, adapter
outputs, and four manifests without modifying them.

Consumes: the two selection JSON files and this plan's batch map.

Produces: a temporary 53-member roster plus one existing-update action, pinned-tooling
receipt, and temporary adapter-to-manifest verifier, with no selection-ledger edits.

Checks: counts are 15/15/15/8; all product IDs/ranks are unique; extension rejects and
parked non-Shampoo items are absent; total candidate accounting is 53; pinned blobs
match; the verifier rejects a deliberately altered fixture field before real research.

Completion: the frozen roster and receipt can be reproduced from the two source files,
every later batch member maps to exactly one roster entry, and tooling drift or a
transcription mismatch fails before a research manifest can be called complete.

### 2. Research and validate batch 01

Research the 15 batch-01 candidates through the complete per-product evidence,
v1.4, independent-label, Production Light, and Product Intake assembly pipeline.
Record the known Glycolic Gloss catalog correction under `existing_product_updates`.

Consumes: frozen roster members for batch 01, v1.4 policy/runbook, Production Light,
manifest schema, protocol templates, source hierarchy, and catalog duplicate evidence.

Produces: `shampoo-manifest-01.json`, `shampoo-research-notes-01.md`, and temporary
per-product research/adapter artifacts.

Checks: canonical validator passes for all complete product entries; every one of the
15 candidates plus the existing correction is accounted for; no duplicate EAN exists
inside the manifest; notes contain source URLs, source text, formula fingerprint,
eight-property outcome, projected values, confidence, deviations, and open questions;
the temporary equality verifier passes after each five-product cell and for the final
batch manifest.

Completion: batch 01 is internally reviewable without consulting chat history and
contains no unsupported ready state.

### 3. Research and validate batch 02

Run the identical frozen pipeline for backlog ranks 39–53. Pay particular attention to
anti-dandruff, sensitive-scalp, 2-in-1, silver/pigment, and brand-duplicate boundaries
where applicable; the v1.4 policy, not marketing category language, controls properties.

Consumes: batch-01 rulings only where they clarify serialization or source handling;
no product label is copied as precedent.

Produces: `shampoo-manifest-02.json`, `shampoo-research-notes-02.md`, and temporary
research/adapter artifacts.

Checks and completion: same as task 2, with exactly 15 roster outcomes and a passing
manifest for all complete entries.

### 4. Research and validate batch 03

Run the pipeline for backlog ranks 54–61 and extension ranks 153–159. Treat caffeine,
hair-loss, clinical, and reset language as medically adjacent or category-sensitive:
classify the cosmetic rinse-out formula without endorsing efficacy, and route true
reset products through Production Light's fail-closed outcome.

Consumes: frozen batch-03 roster and the same stable contracts.

Produces: `shampoo-manifest-03.json`, `shampoo-research-notes-03.md`, and temporary
research/adapter artifacts.

Checks and completion: same as task 2, with exactly 15 roster outcomes, explicit
medical-boundary notes where relevant, and no coerced deep-cleansing row.

### 5. Research and validate batch 04

Run the pipeline for extension ranks 160–167. Apply the Rossmann Syndigo/URL EAN method
only where the page exposes a real, mod-10-valid identifier; source it honestly and
exclude it from apply when independent agreement is absent.

Consumes: frozen batch-04 roster and the same stable contracts.

Produces: `shampoo-manifest-04.json`, `shampoo-research-notes-04.md`, and temporary
research/adapter artifacts.

Checks and completion: same as task 2, with exactly 8 roster outcomes and no inferred
digits for Rossmann-only products.

### 6. Run the cross-wave integrity and readiness audit

Aggregate all four manifests and notes without creating a fifth durable data file.
Check exact roster accounting, EAN uniqueness across products and existing updates,
same-formulation identity decisions, source-text availability, image dimensions,
protocol-role coverage, concern-code validity, and adapter-to-manifest consistency.

Consumes: four manifest/notes pairs, frozen roster receipt, temporary adapter outputs,
and read-only current catalog identity evidence.

Produces: final summary appended to `shampoo-research-notes-04.md`.

Checks:

- `npm run products:intake:expansion:validate -- --manifest <each manifest>` passes for
  all complete entries, with any unavoidable unavailable-data exception named.
- Extracted EANs across all product identifiers and `existing_product_updates` contain
  no unreviewed duplicate or ownership collision.
- Manifest `category_specs` and thickness values equal their corresponding
  Production Light result through the temporary equality verifier. Adapter rationale
  objects are converted deterministically: the manifest stores the exact `rationale`
  string under the same projected field key, while confidence/evidence references
  remain in notes. The verifier rejects paraphrased or missing projected rationales.
- Required protocol roles are covered by the correct Shampoo templates.
- Every roster member appears exactly once in the final status accounting; totals sum
  to 53 candidates, and the separate existing update is counted once.
- `git diff --check` passes and `git status --short` shows only the approved plan and
  permitted Shampoo manifest/notes outputs.

Completion: the final receipt is sufficient for Nick to decide review/rework without
rerunning research, and the stop boundary is explicit.

## Verification

### Automated

- Run the merged Production Light CLI from root main for each complete research
  envelope or each structurally valid temporary batch.
- Assert the pinned adapter/CLI/package-lock/direct-dependency blobs before the first
  batch and again before the final cross-wave audit; run the focused adapter/CLI tests
  and ten-product fixture batch at initial preflight.
- Preserve each adapter input SHA-256 and output status in the corresponding notes.
- Run the canonical expansion validator after every batch and again during final audit.
- Run the temporary exact-equality verifier after every five-product cell, after every
  manifest, and during final audit. It compares adapter
  `payload.category_specs` -> manifest `final.category_specs`, adapter
  `payload.suitable_thicknesses` -> manifest `final.thickness_eligibility`, exact
  projected rationale strings, and adapter required roles -> stamped template roles.
- Parse every manifest as JSON and verify batch IDs/timestamps are unique and valid.
- Check EAN GS1 validity through the expansion schema and cross-manifest uniqueness
  through an aggregate read-only extraction.
- Run `git diff --check` and a final scoped status check.

### Manual/operator

- Open every candidate image and verify exact product/variant, product-only framing,
  straight-on presentation, and roughly 800 px on the longer axis.
- Confirm every price and net-content value against the cited current product page.
- Confirm protocol source text is exact-product usage evidence and the selected
  template follows the handoff's claim-based family rules.
- Confirm no current-catalog match was represented as a new product.

### Live-state and migration

- Read-only catalog identity checks are allowed; no Supabase write is allowed.
- No migration, schema apply, storage upload, catalog apply, deployment, or production
  verification belongs to this research plan.
- Any later apply must use the exact reviewed manifest fingerprints and the separate
  guarded preflight/apply/verify workflow.
- Before that later apply, the owning `db-expansion-scan` program must separately
  reconcile/rebase its task branch with current main and rerun the full readiness
  oracle; this research-only plan deliberately does not perform that integration.

### Evidence-sensitive review

- Manufacturer/brand DE and exact German pack evidence outrank retailers; exact German
  preferred retailers outrank foreign or secondary sources.
- Formula conclusions use the whole ordered INCI, counter-signals, and v1.4 confidence
  standard. No isolated ingredient or marketing claim becomes a hard rule.
- Lane-B judgments are generated from a fresh context without lane-A answers.
- Every disagreement is preserved and adjudicated as product correction,
  source/identity failure, researcher-process ambiguity, or systematic rule gap.
- Weak or conflicting evidence remains `needs_research`; it is never upgraded to make
  the batch pass.

## Review and handoff

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/db-expansion-scan`.
- Branch: `codex/db-expansion-scan`; clean at planning start, ahead of and behind current
  main by task-specific history. Do not rebase or merge merely to run Production Light.
- Counterpart plan review: approved with revisions; F-01 through F-06 were reconciled
  below, and the transient output stayed outside the repository.
- Operator-journey sign-off: confirmed on 2026-09-02; continue through all four
  batches unless a genuine product or evidence decision requires Nick.
- Evidence review: repository-contract evidence complete; product evidence begins only
  during execution.
- Durable outputs are intended for later human-reviewed commit by the branch owner;
  this research session must stop with them uncommitted.
- Stop before any database write, image processing/upload, commit, push, PR, merge,
  deployment, production activation, or worktree cleanup.
- Execution kickoff after sign-off: run the research plan directly; this is a research
  operation, not a source-code implementation, but it should retain the same explicit
  verification and review gates.

### Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| F-01 | defect | Root `main` is a moving checkout while the plan cites merge `da8c9cc3` | accepted | Pin adapter/CLI/package-lock/direct-dependency blobs; allow unrelated root commits | Blob assertions before batch 01 and final audit |
| F-02 | defect | Manual adapter-to-manifest transcription could drift across 53 products | accepted | Add a temporary exact-equality verifier and fixed rationale conversion | Negative altered-fixture check plus per-cell/per-batch verification |
| F-03 | defect | Handoff prose says 31 backlog / ~54 although current JSON has 30 + separate correction | accepted | Add explicit roster-count ruling | Roster counts 15/15/15/8 and total 53 + one update |
| F-04 | tradeoff | A 15-product dual-lane task is costly to resume after interruption | accepted | Add five-product recovery cells | Hash/status checkpoint after every cell |
| F-05 | tradeoff | The program will later need current-main integration before apply | deferred | Record as a separate downstream apply prerequisite | Not part of research verification |
| F-06 | defect | Glycolic correction mentions a possible 300 ml EAN without verification | accepted | Keep that EAN notes-only unless independently verified | Existing-update identifier evidence check |
