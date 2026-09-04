# Shampoo v1.4 classification recovery

Status: administrative preservation and five-product pilot complete; formula-led Focus v1.5 amendment approved by Nick on 2026-09-03. Expansion to the remaining 47 products is authorized in staged cells.

## 2026-09-03 focus-policy amendment

The completed v1.4 lanes, adjudications, adapter inputs, and Production Light outputs remain immutable historical evidence. The active review decision for `focusPrimary`/`focusSecondary` is now a hash-bound `focus-v15.json` overlay governed by `focus-v15-amendment-plan.md`:

- active focus values are `volume`, `shine`, `repair`, `moisture`, `clarifying`, `scalp_active`, and `general`;
- `gentle` is no longer a focus, but remains valid cleansing-language evidence;
- repair/moisture decisions record formula support as `repair_supported`, `moisture_supported`, `dual_supported`, `nonspecific`, or `not_applicable`;
- claims identify or confirm a candidate job and may break a genuine dual-support tie, but cannot turn nonspecific formula evidence into a confident specialist focus;
- future products in the remaining 47 require the same overlay and validation before review. They must not feed v1.5 values into the shipped v1.4 adapter until a separately versioned adapter contract exists.

## Outcome and source context

Preserve the useful administrative research already completed for the frozen Shampoo wave, invalidate the unsupported property-review claim, and produce auditable Shampoo v1.4 ingredient classifications for the 52 new regular-Shampoo rows. Of the 53 selected roster entries, rank 157 resolved to an existing deep-cleansing product update and is not a classification candidate. The separate Glycolic Gloss action remains an identity-only existing-product correction.

Sources of truth:

- `docs/research/shampoo-inci/v1.4/classification-standard.md`
- `docs/research/shampoo-inci/v1.4/new-product-research-runbook.md`
- `docs/product-intake-shampoo-production-light.md`
- `docs/product-intake-research-ops.md`
- `src/lib/shampoo/production-light-adapter.ts`

## Chosen direction

Use two durable layers:

1. classification-free administrative snapshots containing exact identity, size, EAN evidence, source URLs, price, raw image candidate, protocol source/deviation, and duplicate disposition;
2. one machine-readable v1.4 package per classification candidate containing the frozen formula packet, blind Lane A, independent Lane B, comparison/adjudication, complete adapter input, and Production Light output.

The current manifest property projections are invalidated drafts. They may not be used as Lane A/B inputs, priors, adjudication targets, or reviewed output. Administrative evidence may be reused only after exact source binding is checked.

Nick selected the higher-rigor route: two independent classification lanes for every one of the 52 products. The first five form an operator-quality pilot, not a method holdout. Nick reviewed and approved that pilot and the v1.5 focus amendment on 2026-09-03, authorizing expansion to the remaining 47 products.

## Scope and non-goals

In scope:

- preserve administrative facts for 52 new products and two existing-product updates;
- correct the EAN evidence for ISANA Feuchtigkeit and Aussie Bouncy Curls;
- retain Honig Schätze's EAN as excluded until an independent exact-GTIN publisher is found;
- run the complete five-product pilot;
- after separate pilot sign-off, classify the remaining 47 products in the existing `15/15/14/8` new-product batch boundaries;
- rebuild the four expansion manifests only from adjudicated Production Light outputs.

Non-goals:

- no Supabase or database reads/writes;
- no catalog apply, approval, recommendation activation, image processing/upload, commit, push, PR, merge, deployment, or cleanup;
- no changes under `docs/research/shampoo-inci/**`, `data/research/shampoo-inci/**`, `src/**`, `scripts/**`, `supabase/**`, selection ledgers, templates, or the frozen v1.4 policy;
- no medical claims and no profile-result tuning of direct formula labels.

## Target map

- `admin/batch-0N.json` — classification-free administrative snapshots and source receipts.
- `pilot/<product-id>/source-packet.json` — exact raw/normalized INCI, fingerprint, identity/source/conflict facts, formula architecture, claims, and directions.
- `pilot/<product-id>/lane-a-blind.json` and `lane-a-final.json` — formula-first and post-unblind Lane A records.
- `pilot/<product-id>/lane-b.json` — independent Lane B record.
- `pilot/<product-id>/comparison.json` and `adjudication.json` — disagreements and final decisions.
- `pilot/<product-id>/adapter-input.json`, two fresh `adapter-artifacts-run-{1,2}/` directories, CLI receipts, and a determinism receipt — the complete `shampooProductionLightInputSchema` envelope and byte-stable deterministic projection. The product research directory itself is never used as the CLI output directory because `--overwrite` replaces an entire output directory.
- `pilot/validation.json` and `pilot/review.md` — membership, evidence, agreement, confidence, adapter, and operator-review receipt.
- The four existing `shampoo-manifest-0N.json` files remain drafts until regenerated after classification.

Intermediate lane records are task-specific research evidence. The shipped adapter validates only the final `adapter-input.json`; pilot completeness/agreement checks are implemented as a task-local read-only validator under this authorized research directory and do not alter production code.

## Designed operator journey

There is no end-user change. Nick receives a five-product pilot containing exact current INCI, ingredient architecture, Lane A/B decisions, disagreements, final eight properties, thickness judgments, scalp targets, and proposed production values. An incomplete formula, material conflict, low confidence, missing evidence structure, or failed adapter outcome remains visibly blocked. Nick can reject a named field; rework changes the source/research record and regenerates the adapter output. Only after Nick confirms the pilot's evidence quality and journey may the same frozen process expand to the other 47 products.

## Planning evidence

This is backend/operator research, so no UI mockup is required. The pilot itself is the review artifact. Its frozen representative membership is:

1. Elvital Hydra Hyaluronic — moisture/conditioning and weight;
2. Syoss Intense Keratin — repair and substantive care;
3. head&shoulders Classic Clean — recognized anti-dandruff route;
4. ISANA Sensitiv — sensitive-scalp positioning and counter-signals;
5. ISANA 2-in-1 Volumen — richer 2-in-1 deposition architecture.

## Ordered tasks

### 1. Preserve and quarantine

Extract the reusable administrative fields into four snapshots with source URLs and SHA-256 receipts. Correct ISANA Feuchtigkeit `4068134071132` using Rossmann plus independent Drogas and Aussie `8006530325530` using dm plus official P&G/for-me evidence. Retain Honig Schätze `3600542461030` as EAN-excluded. Record that all existing manifest classification fields are invalidated pending regeneration.

Completion: 52 new products plus two existing updates preserved; 51/52 new-product EANs independently verified and one excluded; 52 identities, 51 prices, 52 raw image candidates, and 52 protocol packets accounted for; no current property value is described as reviewed.

### 2. Freeze five exact source packets

Re-open current authoritative product pages and freeze each exact identity/formula before classification. Each packet stores raw and normalized complete INCI, exact fingerprint, source tier and capture time, completeness/conflicts, claims/directions, surfactant architecture, conditioning/deposition routes, humectant/refatting/protein/film clues, dandruff actives, exposure flags, and unresolved ingredients. Source packets contain no current manifest labels.

Completion: all five packets pass identity, completeness, provenance, fingerprint, and blind-content checks; any unresolved material conflict blocks that SKU.

### 3. Run independent Lane A and Lane B

Lane A performs the blind formula pass, freezes its receipt, then performs post-unblind reconciliation and records every delta. Lane B receives the same frozen source packet and policy but no Lane A answers. Both classify all eight v1.4 properties with value, confidence, exact formula facts/positions, counter-signal, neighboring alternative, and evidence references. Weight additionally records deposition load, persistence, reset capacity, unresolved facts, `whyThisBand`, and `whyNotNeighborBand`.

Completion: every lane record is complete; no final property is low confidence; dandruff is mechanically recomputed from the complete INCI; independence receipts prove neither lane consumed the other or the old manifest projections.

### 4. Compare, adjudicate, and project

Compare seven judgment properties, report dandruff separately, preserve every disagreement, and adjudicate each as product correction, source failure, process ambiguity, or systematic rule gap. A systematic gap stops the pilot rather than patching a product. Build the final adapter envelope using the complete authoritative `shampooProductionLightInputSchema`, including research-method hashes, exact formula fingerprint, all properties, all three thickness fits, scalp targets, `exactAntiDandruffPositioning`, and `positioning.explicitResetPositioning`. Run the pinned Production Light adapter twice and require byte-stable output.

Completion: at least 75% overall agreement, at least 60% per judged property, 100% dandruff agreement, zero unresolved identity failures, all final confidence moderate/high, and five valid `property_lane_ready` outputs or explicit `needs_research` blockers.

### 5. Present the pilot and obtain expansion approval

Generate one concise review table with the complete formula source, Lane A/B values, disagreements, adjudicated eight properties, thickness fits, scalp targets, exact projected Shampoo rows, confidence, and open questions. Do not change the four expansion manifests' property fields yet.

Completion: Nick can verify each conclusion against durable evidence without consulting chat or `/tmp`. Completed on 2026-09-03 when Nick approved the Lab presentation and requested expansion.

### 6. Authorized expansion after pilot approval

Process the other 47 products in cells of five while preserving the administrative `13/12/14/8` remaining-product boundaries. A source researcher owns the frozen packet; two independent labelers own disjoint lane records; the main session owns comparison, adjudication, the formula-led v1.5 focus overlay, projection, manifest integration, and readiness. Regenerate classification-derived manifest fields only from adjudicated adapter outputs plus the separately reviewed focus overlay, then rerun exact equality and all four expansion validators. Do not project a v1.5-only focus into Production Light until its adapter contract is explicitly versioned. The 15 extension entries are included by Nick's explicit 2026-09-03 approval to expand the full remaining wave.

## Verification

Automated:

- task-local roster/admin receipt and pilot completeness validator;
- formula SHA-256 recomputation and source binding;
- source-packet blind-content check;
- Lane A/B membership and evidence-shape checks;
- agreement and confidence report;
- shipped Production Light CLI and deterministic rerun;
- exact adapter-to-manifest equality only after later regeneration;
- four expansion validators only after later regeneration;
- `git diff --check` and changed-file scope audit.

Evidence-sensitive:

- exact current DE identity and complete formula;
- no cross-GTIN, size, market, or reformulation merge;
- whole-formula rationales with positions, counter-signals, and neighboring alternatives;
- full structured v1.4 weight assessment;
- cosmetic/medical boundary preserved;
- profile replay, if run later, remains diagnostic and cannot tune direct properties.

Manual:

- Nick reviews the five-product pilot, then each later completed batch summary;
- raw image candidates remain candidates only; final image processing is deferred.

Live/migration: none.

## Review and handoff

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/db-expansion-scan`
- Branch: `codex/db-expansion-scan`
- Counterpart review: approved with revisions; roster/batch accounting, complete adapter-envelope fields, and validator/tooling boundaries were corrected.
- Operator-journey sign-off: confirmed for administrative preservation, the five-product pilot, the v1.5 focus presentation, and staged expansion on 2026-09-03.
- Durable research artifacts: retain for later explicit commit authorization.
- Transient source downloads and counterpart review: discard.
- Stop: research artifacts and local review only; no database/catalog apply, approval, publication, commit, push, PR, merge, deployment, or cleanup.
