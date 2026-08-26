# Scanner Catalog Coverage Program — Phases 1–4

**Status:** Complete-existing-catalog-first amendment reviewed; full 259-product readiness audit and safe E1/E2 correction implemented locally; complete ledger and remaining-ready research are in progress (no production apply)
**Branch:** `codex/scanner-catalog-coverage-plan`
**Worktree:** `.worktrees/scanner-catalog-coverage-plan`
**Baseline snapshot:** production read taken 2026-08-26
**Artifact disposition:** this plan is `commit`; transient research exports, reviewer prompts, and reviewer output are `discard` after their conclusions are incorporated; approved batch manifests and verification receipts are `commit` or `archive` according to the product-intake runbook.

## 1. Outcome and source context

Increase the chance that a valid barcode scanned in a German drugstore resolves on the first attempt to the **correct exact product package** and a usable personalized verdict. Product count is an input; the governing outcome is correct first-scan resolution.

The program first makes the active supported catalog searchable, then adds genuinely missing popular products, deliberately broadens the sample set, learns from real scan misses, and finally becomes a continuous catalog operation. The approximately 140-identity “80/20” checkpoint remains an early activation recommendation, but it no longer ends the existing-catalog lane or allows new-product work to displace it.

Source contracts:

- [Scanner MVP](scan-mvp.md): catalog-only scoring, exact identifier lookup, unknown-product intake, and personalized verdict behavior.
- [Scan attempt log](../docs/scan-attempt-log.md): current miss-ranking source and its privacy-sensitive `user_id`/raw-barcode data.
- [Product-intake research operations](../docs/product-intake-research-ops.md): identity-first research, evidence order, exact category facts, dual readiness, review, and guarded approval.
- [GTIN hardening plan](scan-gtin-attempt-log.md): GTIN canonicalization, multiple package barcodes, and the product decision that one canonical barcode belongs to exactly one product identity.

Production baseline re-verified read-only on 2026-08-26 after counterpart review:

- 282 product rows total; 259 are both `is_active = true` and `lifecycle_status = 'active'`.
- All 259 active products are in the ten supported scanner categories.
- 38 active products have at least one barcode-shaped identifier.
- 40 barcode rows exist, proving that more than one package barcode per product is already a real requirement.
- The attempt log contains only six attempts from one user (two hit, three miss, one pending), so it is not yet a representative demand sample.
- 207 active products have the primary category-spec rows required by the current authority loader and no barcode. This is a candidate pool, not proof of complete scan readiness; protocols, eligibility, disposition, presentation, and real verdict rendering still require per-row preflight.
- The scanner is still direct-link/stealth: 288 auth users exist, 76 signed in during the preceding 30 days, and no scan event has been recorded since 2026-08-21.
- `pg_cron` is installed, so the selected retention policy can be implemented and verified as a database-scheduled job rather than an ownerless manual task.
- The Task 1 exact live ownership preflight found 39 valid GTIN rows, zero cross-product collisions, and zero same-product canonical duplicates. One active Eucerin `PZN:09508065` row is an adjudicated cleanup hold because a PZN is mislabeled as `barcode`; it remains outside canonical GTIN ownership and does not block the partial index.
- The cutover preflight found zero open scanned submissions with an invalid GTIN, and all expected approve/link wrapper, base-function, Heat/Scalp executor, and `pg_cron` prerequisites are present.

The baseline must be regenerated immediately before every cohort is frozen. Counts below are end-state targets; the executor computes the remaining delta rather than assuming the snapshot is still current.

## 2. Chosen direction

Use four successive phases with explicit exit gates and one early activation decision:

1. **Phase 1 — complete current catalog, then add new products:** release the already researched safe existing-product waves; research every remaining scanner-ready active catalog product; repair the held authority rows; reach 259/259 active supported identities with at least one verified GTIN or an explicit unresolved hold; only then add the 54 genuinely missing popular German-drugstore products.
2. **Phase 2 — broader samples:** expand beyond the 313-identity Phase 1 end state, deliberately adding retailer, price-tier, format, formulation, and package-variant diversity for the research/classification machine.
3. **Phase 3 — real-miss learning:** after separately authorized activation, turn distinct-user scan misses, pending submissions, quarantines, model uncertainty, and reviewer disagreement into ranked intake batches until measured first-scan performance clears the reliability gate.
4. **Phase 4 — continuous coverage:** operate retailer refresh, package/reformulation detection, miss SLAs, and model benchmark maintenance as a steady-state catalog function.

Recommended activation timing: prepare the activation recommendation after the approximately 140-identity existing-catalog checkpoint once measurement, privacy, ownership, and real-path verification gates pass. Do not wait for all 259 existing identities to collect the first demand signal, but do not start the 54-new-product production lane until current-catalog identity coverage is complete or every residual hold has an explicit owner and decision. The recommendation is not authorization to activate.

The barcode is an identity key, not an ingredient predictor. The path is:

`barcode → exact package identity → source-backed product/INCI evidence → derived category properties → reviewed catalog facts → personalized verdict`

Every stage may fail closed into research or quarantine. A plausible but incorrect match is worse than a visible unknown result.

### Readiness definitions

- **Barcode-linked:** an active product has at least one barcode-shaped identifier. This is the current baseline measure, not a sufficient completion state.
- **Scan-result-ready:** the exact active, non-quarantined package owns the canonical GTIN globally; the product has the category facts needed by `loadScanProductFacts`; and the resolve route renders the expected verdict in a fixture/field check.
- **Existing-catalog identity complete:** every active supported catalog product is scan-result-ready with at least one verified canonical GTIN. Additional size, market, or packaging GTINs are tracked as package breadth and do not block the first identity-complete pass.
- **Catalog intake ready:** the product can be stored and linked to its submitter under the product-intake contract.
- **Global recommendation ready:** the product may be promoted into Personal Plan recommendations. This is a separate review state and is **not** required merely to identify and evaluate a scanned product.

No phase automatically changes `is_chaarlie_recommended`.

### Metrics and guardrails

North-star service metric after activation telemetry includes client acknowledgement:

`client-confirmed first-scan result rate = distinct user × canonical GTIN windows whose exact-product verdict is acknowledged by the client on the first valid attempt / all eligible distinct user × canonical GTIN windows with a valid barcode attempt`

A window is one user and one canonical GTIN in a fixed seven-day period, so repeated retrying by one tester does not dominate demand. Raw attempt hit rate remains an operational diagnostic, not the north star. Before raw rows age out, the retention job materializes non-user-level counts for each completed seven-day period; formal historical assessments use those fixed-period aggregates rather than claiming an unrecoverable rolling “latest 200” view.

The Task 1 server terminal event proves only that a usable exact-product verdict payload was built. An exact-product lookup whose verdict remains `unknown` is not a successful resolve. Server telemetry supplies a reliable **server-completed usable-verdict rate** and failure-stage metric; it must not be described as browser rendering. Task 8 owns a consent-compatible client acknowledgement keyed to the opaque attempt ID, including the resolve response contract that returns that ID without exposing the barcode in client analytics, before Phase 3 makes an end-to-end first-scan claim.

Correctness is a separate precision guard because telemetry alone cannot prove that the physical bottle matched the returned product. The cohort has 100% evidence review before apply; after activation, physical/user-evidence audits estimate exact-match precision. The program reports the completion rate and audited precision side by side and never labels an unaudited lookup rate “correctness.”

Required supporting measures:

- attempt-start, lookup hit, pending, miss, quarantine, invalid, profile-ineligible, terminal resolve success, incomplete/aborted, and post-lookup failure-stage rates;
- distinct users and distinct canonical GTINs, with category cuts only after the product is known;
- sampled exact-identity precision, including front/back/barcode comparison, with sample size and selection method shown;
- time from ranked miss to reviewed scan-result-ready product;
- barcode collision blocks and quarantine age;
- model extraction/classification agreement against the human-reviewed gold sample, by category and property;
- phase target progress by **product identity** and by **package EAN**.

Guardrails:

- No known false match is accepted in a phase batch.
- One canonical GTIN may have one product owner globally. This plan recommends that inactive products continue to reserve their GTIN because resurrection or an old bottle must not resolve to a different product; this previously open scope decision becomes confirmed only with Nick's plan sign-off.
- The uniqueness key is the canonical 14-digit GTIN across `ean|gtin|barcode`, not today's whitespace-normalized value. Invalid legacy barcode-shaped rows stay outside the partial unique index and enter a cleanup hold; valid new writes are checksum-validated before insert.
- Multiple EANs may attach to the same product only when evidence shows they represent the same exact formulation/variant sold in different packages or markets.
- A materially different formula or variant becomes a separate product identity even when the marketing family is similar.
- Retailer presence or a bestseller badge is prioritization evidence, not proof of market share or product facts.
- Raw barcode/user-level logs receive an approved retention rule before public activation.
- Selected retention for review: keep raw `user_id` and raw barcode events for 30 days; before deletion, retain non-user-level daily operational aggregates and fixed seven-day distinct-window aggregates by category/outcome for 12 months. A versioned migration creates the aggregates and a named `pg_cron` job, and verifies job history plus deletion/aggregation fixtures. The implementation must verify that no export or secondary report silently extends those periods; platform backup retention is documented separately because row-level cron deletion cannot rewrite historical backups.

## 3. Scope and non-goals

### In scope

- A reproducible German-market cohort ledger across dm, Rossmann, Müller, and relevant German/EU brand or specialist sources.
- Barcode backfill for existing exact products.
- Research and intake of genuinely missing popular product identities.
- Reviewable front/back/barcode/INCI evidence samples for the existing research/classification machine.
- Measurement fixes needed to distinguish lookup hits from successfully rendered scan results.
- Canonical GTIN ownership preflight and database enforcement before bulk application.
- Guarded batch generation, preflight, explicit approval, apply, and post-apply verification.
- Miss-driven prioritization after activation and a durable steady-state operating cadence.

### Non-goals

- No scanner UI or verdict-copy changes.
- No attempt to infer ingredients or product properties from the barcode digits alone.
- No automatic database write, product promotion, collision repair, retry, requeue, or quarantine clearing.
- No global-recommendation promotion as part of catalog coverage.
- No claim that the Phase 1 cohort itself proves an 80% market or scan-demand share.
- No change to how discontinued products resolve; a separate product decision is required if real miss data shows that old bottles must remain identifiable.
- No redesign of the category authorities or personalized verdict logic.

## 4. Phase targets

### Phase 1 — complete the current catalog before new-product expansion

Phase 1 has four ordered milestones:

- **Phase 1A0 — reviewed existing waves:** E1 remains 20 products / 22 GTINs. E2 is corrected to hold the authority-blocked Balea Med Anti-Schuppen row, leaving 22 products / 24 GTINs. After both batches, linked active identities would move from 38 to 80 and valid canonical GTIN rows from 39 to 85 (raw barcode-shaped rows from 40 to 86), but strict scan-result-ready identities move from 26 to 68 because 12 already-linked products still need authority repair.
- **Phase 1A1 — remaining ready catalog:** freeze and research the other 150 strict-ready existing products in independent evidence lanes and production manifests of at most 20 products. The first 72 accepted products reach approximately 140 scan-result-ready identities; the full lane reaches 218/259.
- **Phase 1A2 — authority repair:** keep all 41 blocked products—29 unlinked and 12 already linked—out of identifier-only manifests. Repair their exact missing facts, protocols, disposition, presentation, or verdict fixtures through separately fingerprinted authority work; research GTINs only for the 29 currently unlinked repairs; then reach 259/259.
- **Phase 1B — genuinely new products:** only after Phase 1A2 closes or every residual hold has an explicit owner/decision, intake the 54 genuinely missing popular products and reach 313 scan-result-ready identities.

The numbers below are exact against the 2026-08-26 baseline. They measure one verified GTIN per product identity; package-size/market breadth is a separate follow-on measure.

| Category | Active baseline | Scan-ready baseline | Safe E1/E2 | Ready research remaining | Authority repair | Existing target | New products | Phase 1B target |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Shampoo | 54 | 3 | 10 | 29 | 12 | 54 | 7 | 61 |
| Conditioner | 49 | 1 | 9 | 32 | 7 | 49 | 8 | 57 |
| Mask | 36 | 6 | 9 | 20 | 1 | 36 | 6 | 42 |
| Leave-in | 46 | 0 | 6 | 35 | 5 | 46 | 8 | 54 |
| Oil | 41 | 1 | 5 | 19 | 16 | 41 | 6 | 47 |
| Dry shampoo | 10 | 0 | 2 | 8 | 0 | 10 | 7 | 17 |
| Heat protectant | 7 | 7 | 0 | 0 | 0 | 7 | 5 | 12 |
| Deep-cleansing shampoo | 5 | 0 | 1 | 4 | 0 | 5 | 3 | 8 |
| Scalp care | 8 | 8 | 0 | 0 | 0 | 8 | 2 | 10 |
| Bondbuilder | 3 | 0 | 0 | 3 | 0 | 3 | 2 | 5 |
| **Total** | **259** | **26** | **42** | **150** | **41** | **259** | **54** | **313** |

Existing-catalog minimum package expectation: **at least 260 valid canonical GTIN rows** (today's 39 valid rows plus at least one for each of the 221 initially unlinked products). The one invalid PZN hold remains outside this count. Phase 1B adds at least 54 more exact package GTINs. Preserve every additional supported German/EU package code, but never delay identity-complete coverage merely to exhaust all package variants.

### Phase 2 — broader sample set

Expand the end state from 313 to approximately 434 scan-result-ready identities. The numeric allocation is a capacity envelope; the frozen Phase 2 ledger may reallocate at most 12 of the 121 added identities between categories when current assortment evidence supports the move, while keeping the total and every Phase 1 floor intact.

Phase 2 is **not** an activation gate. It is a deliberate model/catalog breadth investment that starts only after the complete-existing-catalog and 54-new-product Phase 1 receipts. Before committing the full 121 identities, publish measured research/review time and a batch forecast from the completed Phase 1 work. The planned operating units are at most 20 identifier-first candidates per batch and 8–12 full new-product samples per batch; calendar dates come from measured throughput rather than invented capacity.

| Category | Phase 1 target | Phase 2 end-state target | Added identities |
|---|---:|---:|---:|
| Shampoo | 61 | 86 | 25 |
| Conditioner | 57 | 75 | 18 |
| Mask | 42 | 58 | 16 |
| Leave-in | 54 | 70 | 16 |
| Oil | 47 | 59 | 12 |
| Dry shampoo | 17 | 26 | 9 |
| Heat protectant | 12 | 20 | 8 |
| Deep-cleansing shampoo | 8 | 15 | 7 |
| Scalp care | 10 | 15 | 5 |
| Bondbuilder | 5 | 10 | 5 |
| **Total** | **313** | **434** | **121** |

Phase 2 package breadth is forecast only after the complete-existing-catalog throughput receipt; do not invent a fixed package count before measuring package variants per accepted identity. The additional samples come from four lanes:

1. Current high-visibility products not selected in Phase 1.
2. Shelf/package samples with front, back, barcode, and readable INCI evidence.
3. Deliberate category diversity across retailer, price tier, format, brand family, claim, and ingredient/property pattern.
4. Additional German/EU package EANs for already-known exact formulations.

Closely related variants do not crowd out category breadth: before real demand exists, no more than two variants from one product line enter a research wave unless they have distinct formulation evidence or independent popularity evidence.

### Phase 3 — real-miss and active-learning expansion

After separately authorized activation, stop treating catalog size as the decision rule. During low volume, review weekly or after every 25 valid distinct user × GTIN windows, whichever comes first, and freeze a new intake batch of at most 25 exact identities. Rank candidates by:

1. distinct users affected;
2. recency and persistence across weeks;
3. category coverage gap once the product is researched;
4. retailer/brand breadth;
5. model uncertainty or reviewer disagreement;
6. total attempts only as a final tiebreaker.

The first formal Phase 3 assessment occurs after both six complete seven-day periods and 200 valid distinct user × GTIN windows across those periods. Until that volume exists, reports are directional and may not claim that an SLO has passed. Continue batches until all exit conditions hold:

- at least 90% client-confirmed first-scan result rate overall across the latest six complete seven-day aggregate periods, with at least 200 qualified windows, audited exact-match precision reported separately, and no known false match;
- no supported category below 80% when it has at least 20 independent windows; categories below 20 windows are explicitly marked unqualified, never passed;
- no unresolved GTIN affecting three or more distinct users remains untriaged for more than seven days;
- no known false match remains active;
- the top 95% of demand-weighted unresolved scans have either become scan-result-ready or have a documented identity/evidence blocker.

Category rates use hits plus misses whose category has been established through intake triage. Unclassified misses remain in the overall denominator and the ranked unresolved queue; they are never discarded to make a category rate look better.

The program does not invent a fixed Phase 3 product count: observed demand decides how many additions are necessary.

### Phase 4 — continuous catalog coverage

Move to a steady-state operating loop by either of two explicit entries:

- **Evidence-qualified:** Phase 3 clears its 200-window reliability gate.
- **Low-volume provisional:** twelve weeks have elapsed after activation without 200 qualified windows. Enter steady-state operations but publish no first-scan SLO claim; keep the weekly low-volume review until the evidence-qualified gate is eventually met.

Steady-state cadence:

- weekly review for the first eight weeks after the gate, then biweekly while scan volume is low and monthly only after the SLO is stable;
- retain at least 25 identity reviews and 50 EAN reviews of monthly operating capacity, used only when the ranked queue justifies them;
- refresh dm, Rossmann, Müller, brand-direct, and specialist assortment evidence on a rotating schedule;
- detect new packaging, regional GTINs, reformulations, renamed lines, lifecycle changes, and repeated quarantines;
- preserve a versioned, human-reviewed gold sample for every supported category and re-run it whenever the classification model or category schema changes;
- return to Phase 3 batch cadence whenever overall client-confirmed first-scan performance drops below 90%, a qualified category drops below 80%, or a known false match appears.

## 5. Target map

Likely implementation and operating surfaces:

- `src/app/api/scan/resolve/route.ts` and `src/lib/scan/resolve-event-log.ts`: keep an attempt row before expensive resolution, then update it with terminal outcome/completion/failure stage; a null terminal state makes a crash, timeout, or abort visible instead of losing the attempt.
- `supabase/migrations/*scan_resolve_events*` and `docs/scan-attempt-log.md`: expand → backfill → contract migration for legacy `outcome`, an independently materialized aggregate, the named retention cron job, and distinct user × GTIN reporting queries. All six legacy rows remain labeled legacy/terminal-unknown; the two historical hits are never rewritten as proven payload or render successes.
- `src/lib/product-identity/normalize.ts`, every product-identifier writer, and a dedicated migration/test package: canonical GTIN ownership hardening across `ean|gtin|barcode`. The inventory includes `src/lib/product-intake/repository.ts`, the Scalp/Heat enrichment writers, `scripts/product-identity/apply-normalization.ts`, Product Intake approve/link RPCs, and every still-supported SQL executor that inserts identifiers.
- `tests/scan-resolve-route.test.ts`, `tests/scan-resolve-event-log.test.ts`, `tests/scan-identifier-lookup.test.ts`, and `tests/product-identity-schema.test.ts`: measurement semantics, canonical equivalence, collisions, and failure-path coverage.
- `scripts/product-intake/catalog-enrichment/**`: reusable generate/preflight/apply/verify seam for category-spanning coverage batches; implementation must locate and reuse current category-specific validators and authority schemas rather than create a parallel policy.
- `scripts/product-intake/**` plus the Product Intake Review Center: exact-product research, evidence review, image finalization, category-property review, and guarded approval.
- `plans/2026-08-15-catalog-authority-architecture.md`, `scripts/catalog-authority/audit.ts`, and the future `publish_catalog_product_v1` boundary: Phase 1 research may proceed now, but production writers must not race the authority cutover. Existing-product identifier-only applies use the catalog-authority program's reviewed narrow identity operation; new product/category-fact publication waits for or writes through `publish_catalog_product_v1`. Every phase gate runs the catalog-authority audit oracle.
- `src/lib/catalog-authority/repair.ts`: reuse its content-fingerprint and expected-old-fingerprint contract for repairs to existing authority facts. Its closed repair slices and required prior row mean it is not the new-product publication path.
- `docs/product-intake-research-ops.md`: source of truth; update only if execution exposes a genuine policy gap.
- A durable cohort ledger, approved batch manifests, and verification receipts under a repository location chosen during implementation; raw scraped/search exports and reviewer transcripts stay outside the repository and are discarded.

The category-specific product list is intentionally not frozen in this program plan. Phase 1 Task 2 produces the reviewable exact cohort, because retailer assortment, package EANs, and existing catalog identities must be checked live together.

## 6. Designed operator journey

This is a backend/catalog operations program. It does not propose a new end-user scanner journey or visual behavior, so no new UI mockup is required; any still-open copy/activation gate in the scanner work remains unchanged.

Actor: catalog operator/reviewer. Entry condition: a fresh production baseline export, current German-market source access, the existing research machine, and no production mutation authorization.

1. The operator regenerates the baseline and sees each category’s active products, barcode-linked products, scan-result readiness, known package EANs, dispositions, and current target delta.
2. The operator separates the current catalog into already linked rows, safe researched waves, remaining strict-ready rows, and authority-blocked rows. New products stay parked until those existing-catalog lanes close.
3. The reviewer corrects and releases E1/E2 by exact row IDs and fingerprints. The authority-blocked Balea Med row moves to the repair lane rather than entering an identifier-only batch.
4. The 150 remaining strict-ready products are frozen into four disjoint research lanes. Researchers gather exact German/EU package identity, EAN, size/market context, and primary source evidence without editing shared production manifests.
5. A single integrator deduplicates canonical GTINs and emits at-most-20-product manifests. Preflight validates checksum/canonical form, global ownership including inactive products, open-submission overlap, exact product identity/lifecycle, category readiness, source presence, reviewed head, and retry idempotency.
6. Nick reviews each exact manifest fingerprint. The guarded executor applies only the approved batch; verification re-reads the live rows, runs the catalog-authority audit, and scans the approved EAN fixtures through the real resolve path against representative profiles.
7. The 41 blocked products follow separately fingerprinted authority repairs and are re-audited; only the 29 unlinked repairs then need GTIN research. Failures return to the specific lane; previously accepted rows are not silently rewritten.
8. Once all 259 active supported products are scan-result-ready or every residual hold has an explicit owner/decision, the 54-new-product lane begins. Phase 2 then broadens diversity, Phase 3 replaces retailer estimates with the ranked distinct-user miss queue, and Phase 4 keeps the same review/apply boundary on a recurring cadence.

Recovery states:

- **Already owned EAN:** link evidence to the existing exact product; do not create or reassign a product.
- **Cross-product collision:** fail closed and adjudicate; never use deterministic winner behavior as acceptance.
- **Same formulation, additional package EAN:** add another identifier row after exact-evidence review.
- **Different formulation/variant:** create a separate product identity and research package.
- **Insufficient INCI or property evidence:** retain as research-blocked; do not fabricate fields or count it scan-result-ready.
- **Catalog intake ready but not global recommendation ready:** it may be identified/evaluated if scan facts are complete, but remains non-promoted.
- **Lookup succeeds but verdict rendering fails:** count as unsuccessful first-scan resolution and route it to engineering, not catalog backfill.
- **Profile missing/ineligible:** record a distinct terminal state and exclude it from the catalog completion denominator; it is an access/onboarding case, not a catalog miss or model failure.
- **Apply or verification mismatch:** stop; preserve the exact manifest and receipt; do not advance the checkpoint.

Completion state: every accepted row has a correct exact identity, unique canonical GTIN ownership, reviewed evidence and category facts, a successful real-path resolve test, and a durable verification receipt.

**Evidence review:** confirmed by Nick on 2026-08-26 and amended after the complete-existing-catalog walkthrough.
**Operator-journey sign-off:** confirmed when Nick responded “Well go do it then” to the ordered existing-catalog-first walkthrough. The later Balea Med readiness finding changes one row from the safe release to the authority-repair lane without changing the confirmed journey.

## 7. Ordered tasks

### Task 1 — Make first-scan success measurable and barcode application safe

**Consumes:** current resolve-event schema, resolve route, GTIN canonicalization, all barcode writers, retention decision.
**Produces:** two-stage attempt/terminal telemetry contract; approved retention rule; canonical barcode-ownership preflight/enforcement; shared collision fixtures.

- Insert an attempt row before expensive resolution, then update the same `attempt_id` with `lookup_outcome`, `terminal_outcome`, `failure_stage`, and `completed_at`. A null terminal outcome is an observable incomplete/abort state; terminal success is written only after an exact product and non-`unknown` usable verdict payload is built.
- Use expand → backfill → contract migration sequencing: add the new fields/enums, dual-write/read them, classify all six historical rows as legacy terminal-unknown, then retire the ambiguous legacy `outcome` contract only after verification.
- Track `profile_ineligible` separately and exclude it from the catalog completion denominator.
- Keep the raw operational outcomes while adding fixed seven-day distinct user × canonical GTIN aggregates before 30-day raw deletion.
- Implement the decided one-GTIN/one-product principle across all `ean|gtin|barcode` writers with a canonical 14-digit generated/expression key, a partial unique index for valid GTINs, and writer compatibility checks. Include inactive product rows. Canonical ownership and lookup are additive database/runtime contracts; rollback requires an explicit follow-up migration or redeploy, while the existing environment switch controls only the offline bulk-normalization executor and must not be described as a runtime scanner kill switch.
- Update the approve/link RPC ownership query, conflict target/exception mapping, Heat/Scalp preflights, repository writer, normalization script, and every supported SQL executor before enabling the unique index. Checksum validation belongs at intake/preflight; canonical storage equivalence does not by itself prove a valid check digit.
- Encode the selected 30-day raw-event and 12-month non-user-level daily plus fixed-seven-day aggregate retention; document who can read raw/user-level data and verify that backups, exports, and secondary reports follow the same boundary.
- Add regression tests for incomplete attempts, early-return profile ineligibility, lookup-hit/render-failure, stored GTIN-8/12/13/14 equivalence, same-product multi-EAN, inactive-owner/cross-product collisions, retry behavior, kill-switch behavior, and retention execution. Scanner/manual input remains EAN-8/EAN-13; stored 12/14-digit variants are verified through the identifier lookup seam unless a separate input-contract change is approved.

**Complete when:** measurement distinguishes lookup from server-built usable-verdict success and incomplete attempts; all write paths pass the same collision oracle; the exact live preflight is clean or has an adjudicated hold list; retention is active and documented. Client-render acknowledgement remains an explicit Task 8 measurement dependency.

**Local implementation receipt (2026-08-26):** two-stage fail-open telemetry, 30-day raw/12-month daily aggregate retention, shared checksum validation, canonical GTIN-14 ownership, approve/link writer guards, the offline bulk-normalization switch, legacy executor retirement, and fail-closed canonical scanner lookup are implemented. The production preflight is clean apart from the adjudicated PZN hold above, and every required live function plus `pg_cron` is present. The migrations execute in an in-process Postgres harness; local Supabase Docker verification was unavailable because the Docker daemon was not running. Task 1 is not operationally complete: before release it must distinguish `unknown` verdict payloads from usable success and add the fixed-seven-day non-user-level aggregate required by the amended metric; client acknowledgement remains Task 8. The corrected migrations then require separate authorization, production application, and verification.

### Task 2 — Freeze the complete existing-catalog ledger

**Consumes:** fresh live baseline; strict readiness audit; current identifiers; safe E1/E2 evidence; inactive ownership and open-submission reconciliation.
**Produces:** one versioned ledger that partitions all 259 active supported products into 26 already scan-ready, 42 safe researched, 150 remaining strict-ready, and 41 authority-blocked rows; four disjoint research-lane assignments; one hold ledger. Linked identity is retained as a separate 38-product baseline attribute, not a readiness partition.

- Re-run the baseline/readiness exporters over all 259 products and fail if the four readiness partitions overlap or do not total 259.
- Remove Balea Med Anti-Schuppen from E2 and place it in the authority hold ledger with `missing_required_protocol`.
- Freeze the 150 strict-ready products into four disjoint researcher-owned artifacts: shampoo/deep-cleansing/dry-shampoo; conditioner; leave-in/bondbuilder; mask/oil.
- Keep the 54-new-product ledger parked and unchanged until Task 5 closes.
- Record one-GTIN identity coverage and additional package-variant breadth separately.

**Complete when:** deterministic tests reproduce every product ID and category count, E1/E2 contain strict-ready rows only, and the 259-row partition has no gap or duplicate.

**Local implementation receipt (2026-08-26):** the schema-v2 read-only audit evaluated all 259 active supported products and froze the exact readiness split at 26 already scan-result-ready, 192 unlinked strict-ready, and 41 authority-blocked (29 unlinked, 12 already linked). The corrected safe waves account for 20 E1 plus 22 E2 products; the deterministic remaining-ready lanes account for 150 unique products (A 41, B 32, C 38, D 39). The complete ledger fingerprint is `0e09116759e01e33ad20627664648c25e59e114ef5f8a79149e6a71580364fbf`. No database write occurred.

### Task 3 — Research and backfill all 192 strict-ready existing products

**Consumes:** Task 2 safe researched lane plus the four remaining-ready research assignments; Task 1 collision oracle; exact live product IDs.
**Produces:** corrected E1/E2 manifests, source-backed research artifacts for the remaining 150 products, at-most-20-product production manifests, and live verification receipts.

- Research official manufacturer or reputable German/EU retailer package EAN evidence for every exact product.
- Preserve raw GTIN, canonical GTIN-14, exact size/market context, source URL, and source date; retain multiple codes only when evidence ties them to the same exact formulation.
- Generalize the executor into a reviewed batch-family contract without weakening exact raw-manifest fingerprint pins, max-20 size, clean reviewed head, migration state, GS1 checksum, global inactive-owner/open-submission preflight, transactionality, replay, or read-back.
- Do not mechanically reuse the stale 2026-08-21 dm artifact; its unselected codes are research leads only.
- Run every accepted EAN through lookup and verdict rendering; identity-only insertion is insufficient.

**Complete when:** all 192 originally strict-ready products are scan-result-ready, no accepted EAN collides globally, and production/live receipts account for every accepted or held row.

### Task 4 — Repair the 41 authority-blocked existing products

**Consumes:** Task 2 hold ledger; catalog-authority repair contract; exact readiness blockers and expected-old fingerprints.
**Produces:** separately reviewed authority-repair manifests, refreshed readiness evidence, GTIN research artifacts, identifier manifests, and verification receipts.

- Group repairs by exact blocker: missing facts, protocol, disposition, presentation, or real verdict fixture.
- Never combine authority changes with an identifier-only batch or treat a researched GTIN as proof of scan readiness.
- Apply only separately approved, compare-and-set repairs; rerun the full readiness oracle before moving a row into GTIN research.
- For the 12 already-linked blocked rows, retain the verified owner and repair only authority/readiness; GTIN research is required only for the 29 unlinked blocked rows.
- Return unresolved identities to the hold ledger with an owner and next evidence requirement rather than lowering the 259 target silently.

**Complete when:** every held row is scan-result-ready with at least one verified GTIN, or the full-catalog receipt names its exact unresolved blocker, owner, and user-visible fallback.

### Task 5 — Close existing-catalog coverage and activation gates

**Consumes:** Tasks 1–4 outputs.
**Produces:** the approximately 140-identity activation recommendation, the 259-identity complete-existing-catalog receipt, and an explicit go/hold decision for the new-product lane.

- At the early checkpoint, recompute at least 140 scan-result-ready identities and the corresponding verified package rows; activation remains separately authorized.
- At the complete-existing checkpoint, prove 259/259 active supported identities or name every explicit hold without counting it as success.
- Run automated schema, collision, resolver, authority, and production read-back checks; field-scan representative packages across all ten categories.
- Audit a stratified sample of at least 30 accepted identities for exact front/back/barcode/formula agreement.
- Confirm retention, permissions, zero known false matches, and zero unresolved ownership collisions.

**Complete when:** the receipt proves the gate or names the exact hold. This plan stops before feature activation; activation remains a separate explicit decision.

### Task 6 — Research and intake the 54 genuinely new Phase 1 products

**Consumes:** Task 5 go decision; parked new-product ledger; product-intake research contract; current classification model interface.
**Produces:** exact research packages, reviewed structured properties, non-promoted catalog rows, identifiers, scan-verification receipts, and a 313-identity Phase 1 receipt.

- Capture identity, package/barcode, product image, current INCI/evidence, commercial fields, category facts, and exact application protocols required for scanner evaluation.
- Run the research/classification machine, but require human review of identity and every property that affects a verdict.
- Keep each accepted evidence package as a labeled sample for later model evaluation, with source date and formula/package identity.
- Report catalog-intake, scan-result, and global-recommendation readiness independently; do not add another direct multi-table writer.

**Complete when:** 54 exact new products satisfy scan-result readiness, remain non-promoted unless separately authorized, and their EANs resolve through representative profile fixtures.

### Task 7 — Execute Phase 2 broader sampling

**Consumes:** Phase 1 receipt; Phase 2 allocation; model error/uncertainty report; additional shelf and package samples.
**Produces:** approximately 434 scan-result-ready identities and a broader category-labeled gold sample with a measured package-breadth forecast.

- Freeze and execute batches with the same guarded workflow as Phase 1.
- Track coverage across retailer, price tier, format, brand family, formulation/property pattern, and package market—not only raw identity count.
- Use model uncertainty and reviewer disagreement to choose informative samples after demand/popularity requirements are satisfied.

**Complete when:** the Phase 2 end-state target and diversity matrix are met, all added identifiers pass the global ownership gate, and model results are reported against the expanded gold sample.

### Task 8 — Run Phase 3 from real scanner demand

**Consumes:** final-outcome telemetry; distinct-user miss ranking; pending submissions; quarantine queue; model uncertainty/disagreement.
**Produces:** recurring ≤25-identity batches, response-time receipts, and the Phase 3 reliability decision.

- Before collecting the north-star metric, return the opaque `attempt_id` in the resolve response and add consent-compatible client acknowledgement of a rendered usable verdict; keep server-built and client-confirmed outcomes separate.
- Review weekly or every 25 valid distinct windows, with the first formal assessment after six weeks and 200 windows.
- Deduplicate retries, research exact products, and route engineering failures separately from catalog misses.
- Continue guarded batches until every Phase 3 exit condition in §4 is proven.

**Complete when:** the latest qualified assessment clears the overall/category gates, high-demand misses meet the SLA, and the evidence supports entering steady state.

### Task 9 — Establish Phase 4 steady-state operations

**Consumes:** Phase 3 evidence-qualified receipt or the explicit 12-week low-volume provisional entry; retailer refresh inputs; classification-model releases; lifecycle and quarantine data.
**Produces:** recurring coverage report, ranked intake queue, refreshed gold sample, drift alerts, and return-to-Phase-3 trigger.

- Automate only read-only collection, ranking, and reporting; research acceptance and database apply remain reviewed and fingerprint-gated.
- Version the gold sample and record model/schema compatibility.
- Measure SLOs on qualified windows and use the defined trigger to increase cadence when performance drops.
- In provisional low-volume mode, publish coverage counts and queue age but no passed first-scan SLO until 200 qualified windows exist.

**Complete when:** the cadence, owner, capacity, dashboards/queries, escalation path, and first recurring review date are documented and exercised once without bypassing approval boundaries.

## 8. Verification

### Automated checks

- Stored-identifier canonicalization and checksum/preflight fixtures across GTIN-8/12/13/14; scanner/manual-entry contract fixtures remain EAN-8/EAN-13.
- Cross-type/global ownership collision preflight and writer contract tests.
- Resolve-route tests proving attempt start, terminal payload-built success, null/incomplete terminal, profile-ineligible early return, post-lookup failure stage, quarantine, pending, miss, and invalid outcomes are measured distinctly.
- Product-intake validators and category-authority fixtures for every new product.
- Batch determinism: input/content fingerprints, dry-run idempotency, exact retry, conflicting retry, and partial-apply rejection.
- Aggregate query fixtures for distinct user × GTIN windows and phase/category metrics.
- Catalog-authority audit and publication/read-back parity checks for every accepted batch.
- Repository-wide `npm run ci:verify` for implementation packages.

### Manual and field checks

- Exact source comparison for every accepted identity/EAN; stratified independent audit at each phase gate.
- Real scanner route checks across all ten categories and representative verdict states.
- Physical package scans when a sample exists; manual EAN fixtures do not substitute for the Phase 1 physical-sample minimum.
- Verify same-product multi-EAN and cross-product collision recovery with dedicated examples.

### Migration and live-state checks

- Exact future-index-key collision audit before any ownership constraint is applied.
- Verify every identifier writer is compatible before enabling the partial unique index; test the rollback/kill-switch path before enforcement.
- Re-read the exact approved product/identifier/spec/protocol/image rows after every batch.
- Run `scripts/catalog-authority/audit.ts` before and after every production batch; new-product writes use `publish_catalog_product_v1` once that boundary exists.
- Compare live phase totals to the frozen ledger and preserve hold rows outside the success count.
- Confirm log access, independently materialized aggregate, named `pg_cron` cleanup job, and job-run evidence in production before public activation.

### Evidence-sensitive review

- Retailer popularity and assortment signals are dated and source-linked.
- INCI/formula evidence is attached to the exact package or explicitly blocked.
- Model-derived properties remain proposals until reviewed against evidence.
- Identity precision is audited separately from model property/classification accuracy.
- The Phase 1 report says “modeled launch cohort” until real scan demand can substantiate an 80% or higher coverage claim.

### Task 1 local readiness receipt — 2026-08-26

- Focused scanner/intake/GTIN/retention suite: 120/120 passed, including in-process Postgres execution of both migration chains.
- Legacy enrichment compatibility: Heat 31/31 and Scalp 38/38 passed.
- Repository-wide Node suite: 4,495/4,495 passed before the final narrow review fixes; affected tests were rerun afterward.
- `npm run ci:verify`: typecheck and production build passed; lint reported zero errors and five unrelated existing warnings.
- Read-only production preflight: 39 valid GTIN rows, zero canonical collision/duplicate groups, one adjudicated PZN hold, six legacy scan events, zero invalid open scanned submissions, and every required database prerequisite present.
- Claude whole-tree code review found no hard defects. Its two test gaps were closed, the redundant expand-phase index is dropped after uniqueness enforcement, and the affected checks plus repository gate were rerun.
- Local Supabase Docker reset was unavailable because the Docker daemon was not running; executable migration coverage used the repository's PGlite Postgres harness instead. No production migration or data write was performed.

## 9. Review and handoff

- Planning work remains on `codex/scanner-catalog-coverage-plan`; no production data or feature activation is authorized by this plan.
- The original self-review and Claude counterpart review are complete. The complete-existing-catalog-first amendment received a separate read-only Claude high-effort review. Its blocking findings were reconciled by correcting E2 to 22 products/24 GTINs, expanding strict readiness across all 259 products, replacing the invalid rolling-200 retention claim with fixed seven-day aggregates, assigning client acknowledgement to Task 8, distinguishing usable verdict success from lookup success, stating the real rollback boundary, and enforcing expand-before-runtime release order.
- Nick confirmed the amended operator journey after the ordered walkthrough. This confirms the approximately 140-identity early activation recommendation, continued existing-catalog work to 259/259 before the 54-new-product lane, inactive products reserving their GTIN, and 30-day raw/12-month aggregate retention.
- Task 1 passed ready-check and whole-tree correctness/structural review. Claude reported no hard defects; its actionable test gaps and minor redundant-index finding were resolved and reverified locally.
- Task 1 implementation is isolated in this task worktree; product-data cohorts remain separate because measurement/uniqueness code and product-data application have different review and release risks.
- Release sequencing is expand-before-runtime: isolate and review the additive database migrations, explicitly authorize and apply them before any application deployment that reads `canonical_gtin14`, verify the live schema, then merge/deploy the compatible application code. Only after that runtime is verified may separately approved E1 and E2 data fingerprints be applied. A generic `supabase db push` is prohibited because local and remote migration histories diverge.
- Every production cohort requires an exact manifest, fingerprint, preflight, explicit final approval, guarded executor, and live verification receipt.
- Phase gates authorize planning progression only. Commit, push, PR, merge, migrations, production writes, and scanner activation each remain separate actions under the repository workflow.
- Principal residual uncertainty: current retailer visibility is only a proxy for demand. Phase 3 is the first point at which Chaarlie can validate real first-scan coverage with its own users.

**Current implementation stop point:** commit the corrected safe E1/E2 artifacts, the deterministic complete-existing-catalog ledger, the generalized guarded batch-family executor, and source-backed research artifacts for the remaining strict-ready products. Tasks 6–9 are retained as explicit Phase 1B/2/3/4 follow-on plans and are not implementation scope for this commit. Do not push, open a PR, merge, apply migrations, write production data, or activate the scanner without the relevant separate authorization.
