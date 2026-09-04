# Shampoo Focus v1.5 Engine and Wave Expansion

Status: approved direction; implementation authorized 2026-09-03

## Outcome

Make the approved formula-first Focus v1.5 policy a reusable, deterministic research-engine contract and use it to expand the Shampoo v1.4 research from the five-product calibration set to the remaining 47 candidates in staged cells.

This is research infrastructure and research output only. It does not change the shipped Production Light v1/v1.4 projection, catalog or recommendation behavior, product approval, images, Supabase, or any database.

Source context: `focus-v15-amendment-plan.md` is the approved policy and five-product evidence record; `plan.md` is the governing classification-recovery plan; `admin/batch-01.json` through `admin/batch-04.json` are the preserved administrative roster.

## Chosen direction

- Adopt the approved forward focus values: `volume`, `shine`, `repair`, `moisture`, `clarifying`, `scalp_active`, and `general`.
- Retire `gentle` only from Focus v1.5. Keep it valid in the frozen v1.4 adapter and as cleansing-language evidence.
- Keep `src/lib/shampoo/production-light-adapter.ts`, its input schema, CLI, output shape, and existing artifacts byte-compatible with PR #508.
- Implement Focus v1.5 as a separately versioned, hash-bound research overlay. It is not a Production Light output.
- Reuse the approved Lab evidence model. Do not enlarge the frozen five-product pilot manifest or mingle review state across datasets.
- Serve completed wave cells through a validated `?dataset=wave-01` URL option. The default remains the frozen pilot, the rendered UI does not change, and every dataset has an isolated review-state file. Nick's approval to reuse the same interface covers this config-only route; any visible selector or material workflow change requires a new evidence review.
- Preserve the existing administrative evidence and remaining-product boundaries: 13 / 12 / 14 / 8. Work within them in cells of at most five.
- Include the extension candidates because Nick explicitly approved expansion of the remaining wave on 2026-09-03.
- Research Honig Schätze, but retain its EAN/apply exclusion until an independent exact-GTIN publisher confirms it.
- No existing manifest property classification is a prior. Only exact-SKU source packets, independent lanes, adjudication, and v1.5 overlays can regenerate classification-derived fields.

## Scope and non-goals

In scope: extract the approved inline v1.5 validation into a reusable research-only contract, add its read-only batch validator, preserve exact Lab behavior, add isolated config-only wave routing, and research the remaining 47 products in cells of at most five.

Out of scope: Production Light v1/v1.4 semantics, catalog/recommendation behavior, Supabase or database access, image processing/upload, manifest apply, product approval, commit, push, PR, merge, deployment, and cleanup.

## Target map

- `src/lib/shampoo/focus-v15.ts` — canonical research-only overlay contract.
- `scripts/shampoo-research/validate-focus-v15.ts` — read-only single/dataset validator.
- `src/lib/labs/shampoo-v14-pilot-review.ts` — shared-contract consumer and safe dataset resolver.
- `src/app/labs/shampoo-research/**` and `src/app/api/labs/shampoo-research/**` — unchanged visual review flow with isolated dataset routing.
- `plans/scan-db-expansion/research/shampoo-v14/pilot/waves/wave-01/**` — first five-product expansion dataset.
- Existing focused tests, task-local validator, Production Light tests, and operator documentation — compatibility gates.

## Decision coverage

Status: confirmed

- Confirmed with Nick: add `moisture`, remove `gentle` from the forward focus taxonomy, use formula-first care vectors with claims as bounded confirmation/tie-breaker, update the research engine, reuse the existing Lab, and expand research beyond the five-product calibration set.
- Inherited from evidence or contract: PR #508 Production Light v1/v1.4 stays unchanged; research remains local-only; two independent classification lanes and hash-bound artifacts remain mandatory; EAN/apply readiness stays separate from formula readiness.
- Implementation defaults: use `?dataset=wave-01` rather than a visible selector; keep the pilot as the default; use the existing manifest filename/version inside an isolated wave root; preserve administrative 13/12/14/8 boundaries and work in cells of at most five.
- Open consequential assumptions: none.
- Coverage acknowledgement: Nick saw and approved the v1.5 Lab/policy and requested the engine update and expansion on 2026-09-03. This acknowledgement covers this plan revision after counterpart review, including config-only wave routing and the exact executable roster.
- Undiscussed consequential assumptions affecting this handoff: none.

## Current coverage

- Administrative research is preserved for all 52 new products.
- Five products have complete source packets, independent v1.4 lanes, adjudication, two deterministic Production Light runs, and valid Focus v1.5 overlays.
- Forty-seven products still require exact-formula freezing and genuine classification.
- The five-product Lab already renders the approved v1.5 evidence and was explicitly accepted by Nick.

## Engine implementation

### 1. Canonical research-only contract

Add `src/lib/shampoo/focus-v15.ts` containing:

- the Focus v1.5, care-direction, and claim-role enums;
- the Zod overlay schema and inferred TypeScript type;
- deterministic validation of product ID, formula fingerprint, exact adjudication SHA-256, and prior v1.4 focus equality;
- distinct primary/secondary enforcement and complete rationale/evidence requirements.

The contract receives exact source/adjudication bindings; it does not read the database, fetch the web, classify formulas, or project catalog rows.

### 2. Consumer migration without semantic drift

Refactor the Shampoo Research Lab loader to consume the shared contract while preserving its current display, product-local blocking behavior, and integrity hash. Keep the task-local JavaScript validator as an independent mirror/oracle rather than importing application TypeScript.

Add a standalone research CLI that validates one overlay or a batch descriptor against exact source-packet and adjudication files. It must emit a deterministic pass/fail receipt and make no changes to inputs.

The shared contract is intentionally load-bearing now: the Lab is its runtime consumer and the standalone CLI is its batch/operator consumer. The task-local JavaScript validator remains independent so it can detect shared TypeScript regressions; it is not a third source of truth.

Add a safe dataset resolver for the Lab page and review API:

- `pilot` maps only to the existing pilot root and remains the default;
- `wave-01` maps only to `pilot/waves/wave-01` once that dataset exists;
- unknown or unsafe dataset IDs return not-found/bad-request rather than becoming filesystem paths;
- the client includes the resolved dataset ID in every review action;
- each dataset reads/writes only its own `review-state.json`;
- wave roots use the existing `pilot-manifest.json` filename and `shampoo-v14-pilot-manifest-v1` shape so the approved loader contract does not drift.

### 3. Compatibility locks

Add tests first that prove:

- shared validation accepts all five approved overlays;
- `gentle`, unknown values, duplicate focus joins, bad product/formula/adjudication bindings, and incomplete evidence fail;
- malformed evidence blocks only its product in the Lab;
- the task-local validator and shared contract agree on the accepted and rejected fixture set;
- Production Light continues accepting its legacy v1.4 values and continues rejecting v1.5-only `moisture` input;
- existing five-product adapter outputs and determinism receipts remain unchanged.

The extraction drift gate must compare the exact five current product verdicts and the existing malformed-overlay/adjudication-drift fixtures before and after the refactor, not merely validate five happy paths. The integrity hashes must remain byte-identical because no artifact bytes change.

Document Focus v1.5 as a separate research layer in the Production Light operator documentation.

## Expansion execution

### Cell protocol

For each cell of at most five products:

1. Freeze exact current identity, complete raw and normalized INCI, formula fingerprint, authoritative sources, claims, directions, formula architecture, conflicts, and unresolved ingredients.
2. Run formula-blind Lane A, freeze it, then unblind to claims; run independent Lane B without Lane A outputs.
3. Compare and adjudicate all v1.4 properties. Stop a product on unresolved formula identity, material formula conflict, low-confidence final property, or systematic rule gap.
4. Create the Focus v1.5 overlay only after adjudication, using the full formula vectors and explicit counter-signal. Claims may confirm or break a genuinely dual-supported tie but cannot manufacture formula support.
5. Project through the unchanged Production Light adapter twice and require deterministic equality.
6. Add the completed cell to `pilot/waves/wave-01`, with its own same-shape `pilot-manifest.json` and local `review-state.json`. Reuse the approved Lab presentation through `?dataset=wave-01`; do not mutate pilot review state.
7. Nick reviews completed cells. Lab approval remains research approval only and never catalog activation.

### Ordered cohorts and executable roster

The executable identifiers are the `source_product_index` values inside the cited administrative snapshot, not chat-only ranks:

- Cohort A — `admin/batch-01.json`, 13 remaining indices: `0` Honig Schätze; `2` NIVEA Power Repair; `3` schauma Repair & Pflege; `4` Fructis Coco Water; `5` Herbal Essences Fiji; `6` Gliss Liquid Silk; `7` Gliss Total Repair; `9` Fructis Locken Methode; `10` Being Big Hair; `11` Gliss Sealing Miracle; `12` Elvital Dream Length; `13` Herbal Essences Blütensanft; `14` Pantene Repair & Care XXL.
- Cohort B — `admin/batch-02.json`, 12 remaining indices: `1` Syoss Men Intense Power; `2` Syoss Intense Color; `3` Syoss Intense Repair; `4` Elvital Color Glanz; `5` Jean&Len Hydration; `8` ISANA Seidenglanz; `9` ISANA Anti-Schuppen; `10` ISANA Oil Repair; `11` ISANA MED Jeden Tag; `12` ISANA MED pH 5,5; `13` ISANA Feuchtigkeit; `14` John Frieda Intensiv Silbershampoo.
- Cohort C — `admin/batch-03.json`, all 14 indices: `0` Plantur DMG Clinical; `1` Head & Shoulders Apple Fresh; `2` Being Max Moisture; `3` Being Bye Bye Anti-Frizz; `4` Being Curl Power; `5` Being Nourish + Shine; `6` IDA WARG Moisture; `7` Bali Gents Coffein Activator; `8` Gliss Full Hair Magic; `9` Elvital Bond Repair; `10` schauma For Men; `11` Pantene Grow Abundant; `12` Plantur 21 Nutri-Coffein; `13` Fructis Keratin Sleek.
- Cohort D — `admin/batch-04.json`, all 8 indices: `0` ISANA MED Totes Meer; `1` Balea Professional Plex Care; `2` ISANA Professional Keratin & Repair; `3` ISANA Professional Plex; `4` ISANA MEN Energy Power; `5` Wahre Schätze Kokosmilch & Macadamia; `6` John Frieda Refresh & Shine; `7` AUSSIE Bouncy Curls.

The first expansion cell is `admin/batch-01.json` indices `0`, `9`, `2`, `10`, and `11`: Honig Schätze, Fructis Locken Methode, NIVEA Power Repair, Being Big Hair, and Gliss Sealing Miracle. Research directories receive stable product IDs only when exact source packets are frozen.

## Operator journey

There is no customer-facing change. The operator journey reuses the approved local Lab:

1. Open a versioned dataset containing no more than one completed research cell.
2. Select a product and verify exact identity/formula provenance before reading conclusions.
3. Review the eight v1.4 properties, thickness reasoning, v1.5 focus formula routes, counter-signal, claim role, and unchanged Production Light projection.
4. Mark a research decision approved or request field-specific rework; stale dataset hashes invalidate older review decisions.
5. Complete the cell review. The resulting state records research review only and cannot trigger a database or catalog write.

The current Lab design and this journey were approved by Nick on 2026-09-03. Any future material UI or workflow change requires separate evidence review.

## Planning evidence

The five-product local Shampoo Research Lab is the rendered planning evidence. Nick reviewed its current formula, property, focus-v1.5, thickness, and Production Light presentation and explicitly approved it on 2026-09-03. The wave route reuses that layout and action structure; only the dataset label/count changes so the surface remains truthful. No customer-facing journey changes.

## Verification

- Focus v1.5 unit and CLI tests.
- Existing Shampoo Lab service/API/UI tests.
- Task-local pilot validator and self-test.
- Production Light adapter, calibration, CLI, and determinism tests.
- Typecheck and relevant lint.
- `npm run ci:verify` before declaring the engine review-ready.
- `git diff --stat da8c9cc33452e7c8ca81f15fcad1d7c525210938` plus a reviewed changed-file allowlist proving no Supabase/database/catalog writer and no mutation of frozen v1.4 artifacts.
- Per-cell source, lane-independence, adjudication, focus, adapter, and deterministic-receipt validation.
- One repository-standard adversarial whole-diff review after implementation, with every finding verified locally before readiness is claimed.

## Review and handoff

The engine phase stops at a verified research-only contract. The expansion phase proceeds cell by cell and may preserve research artifacts and local review state only. It does not commit, push, open a PR, merge, deploy, apply manifests, approve catalog products, upload images, or change recommendation behavior without separate explicit authorization.

Branch/worktree: `codex/db-expansion-scan` in `/Users/nick/AI_work/hair_conscierge/.worktrees/db-expansion-scan`. Counterpart plan review completed with its dataset-routing, executable-roster, exact-drift, and adversarial-review findings incorporated. Engine and completed research artifacts are retained for a later explicit publication decision; transient source downloads and counterpart output are discarded. Decision coverage and operator-journey sign-off are confirmed as recorded above.
