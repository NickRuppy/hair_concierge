# Scanner Catalog Coverage Program — Phases 1–4

**Status:** Evidence review and operator journey confirmed; Tasks 1–2 locally implemented, with the exact pilot frozen for Nick's fingerprint approval (no production apply)
**Branch:** `codex/scanner-catalog-coverage-plan`
**Worktree:** `.worktrees/scanner-catalog-coverage-plan`
**Baseline snapshot:** production read taken 2026-08-26
**Artifact disposition:** this plan is `commit`; transient research exports, reviewer prompts, and reviewer output are `discard` after their conclusions are incorporated; approved batch manifests and verification receipts are `commit` or `archive` according to the product-intake runbook.

## 1. Outcome and source context

Increase the chance that a valid barcode scanned in a German drugstore resolves on the first attempt to the **correct exact product package** and a usable personalized verdict. Product count is an input; the governing outcome is correct first-scan resolution.

The program uses a popularity-weighted launch cohort, then deliberately broadens the sample set, then learns from real scan misses, and finally becomes a continuous catalog operation. “80/20 coverage” is treated as a demand-coverage hypothesis to validate, not as a claim that 80% of catalog rows have been captured.

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

1. **Phase 1 — activation cohort:** first reach a fast existing-catalog milestone of approximately 140 scan-result-ready identities, then continue to a popularity-weighted German drugstore cohort of 194 identities and approximately 220–240 verified package EANs.
2. **Phase 2 — broader samples:** expand to approximately 315 scan-result-ready identities and 420–500 package EANs, deliberately adding retailer, price-tier, format, formulation, and packaging diversity for the research/classification machine.
3. **Phase 3 — real-miss learning:** after separately authorized activation, turn distinct-user scan misses, pending submissions, quarantines, model uncertainty, and reviewer disagreement into ranked intake batches until measured first-scan performance clears the reliability gate.
4. **Phase 4 — continuous coverage:** operate retailer refresh, package/reformulation detection, miss SLAs, and model benchmark maintenance as a steady-state catalog function.

Recommended activation timing: prepare the activation recommendation after the approximately 140-identity existing-catalog milestone once measurement, privacy, ownership, and real-path verification gates pass. Do not wait for all 54 new products or Phase 2 to collect the first demand signal. Phase 1 research continues to the 194-identity cohort after activation. The recommendation is not authorization to activate.

The barcode is an identity key, not an ingredient predictor. The path is:

`barcode → exact package identity → source-backed product/INCI evidence → derived category properties → reviewed catalog facts → personalized verdict`

Every stage may fail closed into research or quarantine. A plausible but incorrect match is worse than a visible unknown result.

### Readiness definitions

- **Barcode-linked:** an active product has at least one barcode-shaped identifier. This is the current baseline measure, not a sufficient completion state.
- **Scan-result-ready:** the exact active, non-quarantined package owns the canonical GTIN globally; the product has the category facts needed by `loadScanProductFacts`; and the resolve route renders the expected verdict in a fixture/field check.
- **Catalog intake ready:** the product can be stored and linked to its submitter under the product-intake contract.
- **Global recommendation ready:** the product may be promoted into Personal Plan recommendations. This is a separate review state and is **not** required merely to identify and evaluate a scanned product.

No phase automatically changes `is_chaarlie_recommended`.

### Metrics and guardrails

North-star service metric after activation telemetry includes client acknowledgement:

`client-confirmed first-scan result rate = distinct user × canonical GTIN windows whose exact-product verdict is acknowledged by the client on the first valid attempt / all eligible distinct user × canonical GTIN windows with a valid barcode attempt`

A window is one user and one canonical GTIN in seven days, so repeated retrying by one tester does not dominate demand. Raw attempt hit rate remains an operational diagnostic, not the north star.

The Task 1 server terminal event proves only that the response payload was built. It supplies a reliable **server-completed resolve rate** and failure-stage metric; it must not be described as browser rendering. Before Phase 3 makes an end-to-end first-scan claim, add a consent-compatible client acknowledgement keyed to the opaque attempt ID without exposing the barcode in client analytics.

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
- Selected retention for review: keep raw `user_id` and raw barcode events for 30 days; before deletion, retain a non-user-level daily aggregate by canonical GTIN and outcome for 12 months. A versioned migration creates the aggregate and a named `pg_cron` job, and verifies job history plus deletion/aggregation fixtures. The implementation must verify that no export or secondary report silently extends those periods; platform backup retention is documented separately because row-level cron deletion cannot rewrite historical backups.

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

### Phase 1 — activation cohort, then full launch cohort

Phase 1 has two explicit milestones:

- **Phase 1A — fast existing-catalog milestone:** select 102 of the 207 spec-complete/no-barcode candidates, prove their full scanner readiness, and move from 38 to approximately 140 scan-result-ready identities. This produces the earliest activation recommendation.
- **Phase 1B — full launch cohort:** add 54 genuinely missing, popular exact products and reach 194 scan-result-ready identities.

The numbers below are modeled targets, not a claim about market share. A fresh readiness audit may replace a nominal backfill candidate with another product in the same category when required facts/protocols are incomplete, but it may not lower the category milestone without an explicit plan revision.

| Category | Active baseline | Barcode-linked baseline | Phase 1A target | Existing-product backfills | New products | Phase 1B target | Why this weight |
|---|---:|---:|---:|---:|---:|---:|---|
| Shampoo | 54 | 6 | 38 | 32 | 7 | 45 | Highest routine frequency and broadest drugstore shelf |
| Conditioner | 49 | 6 | 24 | 18 | 8 | 32 | High paired demand with shampoo |
| Mask | 36 | 6 | 18 | 12 | 6 | 24 | Popular treatment category with meaningful formula diversity |
| Leave-in | 46 | 3 | 16 | 13 | 8 | 24 | High fit sensitivity and many formats |
| Oil | 41 | 2 | 12 | 10 | 6 | 18 | Main-spec-complete candidate pool is 25; selection stays inside it |
| Dry shampoo | 10 | 0 | 9 | 9 | 7 | 16 | Small current catalog but strong drugstore relevance |
| Heat protectant | 7 | 7 | 7 | 0 | 5 | 12 | Existing active cohort is already linked; all growth is new research |
| Deep-cleansing shampoo | 5 | 0 | 5 | 5 | 3 | 8 | Lower frequency but important distinct need |
| Scalp care | 8 | 8 | 8 | 0 | 2 | 10 | Existing active cohort is already linked; preserve conservative scope |
| Bondbuilder | 3 | 0 | 3 | 3 | 2 | 5 | Smaller category with high consumer salience |
| **Total** | **259** | **38** | **140** | **102** | **54** | **194** | |

Phase 1A package expectation: **at least 142 verified EAN rows** (today's 40 plus at least one for each accepted backfill), likely 150–170 when supported German/EU package variants exist. Phase 1B package target: **220–240 verified EANs**. Product identity and package EAN are counted separately because size, market, and packaging variants may have different GTINs.

### Phase 2 — broader sample set

Expand the end state to approximately 315 scan-result-ready identities. The numeric allocation is a capacity envelope; the frozen Phase 2 ledger may reallocate at most 12 of the 121 added identities between categories when current assortment evidence supports the move, while keeping the total and every Phase 1 floor intact.

Phase 2 is **not** an activation gate. It is a deliberate model/catalog breadth investment that starts only after Phase 1A has produced a throughput receipt and the scanner has either been activated separately or has a documented activation hold. Before committing the full 121 identities, review a 20-backfill/5-new-product pilot and publish measured research/review time plus a batch forecast. The planned operating units are 20–25 identifier-first candidates per batch and 8–12 full new-product samples per batch; calendar dates come from the pilot rather than invented throughput.

| Category | Phase 1 target | Phase 2 end-state target | Added identities |
|---|---:|---:|---:|
| Shampoo | 45 | 70 | 25 |
| Conditioner | 32 | 50 | 18 |
| Mask | 24 | 40 | 16 |
| Leave-in | 24 | 40 | 16 |
| Oil | 18 | 30 | 12 |
| Dry shampoo | 16 | 25 | 9 |
| Heat protectant | 12 | 20 | 8 |
| Deep-cleansing shampoo | 8 | 15 | 7 |
| Scalp care | 10 | 15 | 5 |
| Bondbuilder | 5 | 10 | 5 |
| **Total** | **194** | **315** | **121** |

Phase 2 package target: **420–500 verified EANs**. The additional samples come from four lanes:

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

The first formal Phase 3 assessment occurs after both six weeks and 200 valid distinct user × GTIN windows. Until that volume exists, reports are directional and may not claim that an SLO has passed. Continue batches until all exit conditions hold:

- at least 90% client-confirmed first-scan result rate overall on the latest 200-window assessment set, with audited exact-match precision reported separately and no known false match;
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
2. The operator creates the ranked Phase 1 candidate ledger. Existing products and genuinely missing products are separate lanes; exact product, package, and source evidence remain visible.
3. A reviewer freezes one small batch by exact row IDs and content fingerprint. Research gathers official/retailer identity, EAN, product image, INCI/evidence, current price/purchase URL, and category facts; the research/classification machine proposes structured properties.
4. Preflight validates GTIN checksum/canonical form, global ownership, exact product identity, category schema, required verdict facts, source presence, image state, and retry idempotency. A conflict blocks the row or batch with the existing owner and evidence shown.
5. Nick reviews the exact manifest. No apply occurs without explicit approval of that fingerprint.
6. The guarded executor applies only the approved batch through the catalog-authority-compatible identity/publication boundary. Verification re-reads the live rows, runs the catalog-authority audit, and scans the approved EAN fixtures through the real resolve path against representative profiles.
7. Failures return to the specific lane: identity ambiguity, barcode collision, missing evidence, model/property disagreement, image/commercial blocker, quarantine, or route/render failure. Previously accepted rows are not silently rewritten.
8. When the Phase 1 gate passes, Phase 2 repeats the same journey with broader sample diversity. After activation, Phase 3 replaces retailer estimates with the ranked distinct-user miss queue. Phase 4 keeps the same review/apply boundary on a recurring cadence.

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

**Evidence review:** confirmed by Nick on 2026-08-26 (“good plan” and instruction to start implementation).
**Operator-journey sign-off:** confirmed by the same implementation instruction.

## 7. Ordered tasks

### Task 1 — Make first-scan success measurable and barcode application safe

**Consumes:** current resolve-event schema, resolve route, GTIN canonicalization, all barcode writers, retention decision.
**Produces:** two-stage attempt/terminal telemetry contract; approved retention rule; canonical barcode-ownership preflight/enforcement; shared collision fixtures.

- Insert an attempt row before expensive resolution, then update the same `attempt_id` with `lookup_outcome`, `terminal_outcome`, `failure_stage`, and `completed_at`. A null terminal outcome is an observable incomplete/abort state; `resolved` is written only after the response payload is built.
- Use expand → backfill → contract migration sequencing: add the new fields/enums, dual-write/read them, classify all six historical rows as legacy terminal-unknown, then retire the ambiguous legacy `outcome` contract only after verification.
- Track `profile_ineligible` separately and exclude it from the catalog completion denominator.
- Keep the raw operational outcomes while adding the distinct user × canonical GTIN seven-day view.
- Implement the decided one-GTIN/one-product principle across all `ean|gtin|barcode` writers with a canonical 14-digit generated/expression key, a partial unique index for valid GTINs, writer compatibility checks, and a rollout kill switch. Include inactive product rows if Nick confirms this plan's recommendation.
- Update the approve/link RPC ownership query, conflict target/exception mapping, Heat/Scalp preflights, repository writer, normalization script, and every supported SQL executor before enabling the unique index. Checksum validation belongs at intake/preflight; canonical storage equivalence does not by itself prove a valid check digit.
- Encode the selected 30-day raw-event and 12-month non-user-level aggregate retention; document who can read raw/user-level data and verify that backups, exports, and secondary reports follow the same boundary.
- Add regression tests for incomplete attempts, early-return profile ineligibility, lookup-hit/render-failure, stored GTIN-8/12/13/14 equivalence, same-product multi-EAN, inactive-owner/cross-product collisions, retry behavior, kill-switch behavior, and retention execution. Scanner/manual input remains EAN-8/EAN-13; stored 12/14-digit variants are verified through the identifier lookup seam unless a separate input-contract change is approved.

**Complete when:** measurement distinguishes lookup from server-built payload success and incomplete attempts; all write paths pass the same collision oracle; the exact live preflight is clean or has an adjudicated hold list; retention is active and documented. Client-render acknowledgement remains an explicit Phase 3 measurement dependency.

**Local implementation receipt (2026-08-26):** two-stage fail-open telemetry, the 30-day raw/12-month aggregate retention migration, shared checksum validation, canonical GTIN-14 ownership, approve/link writer guards, bulk-normalization kill switch, legacy executor retirement, and fail-closed canonical scanner lookup are implemented. The production preflight is clean apart from the adjudicated PZN hold above, and every required live function plus `pg_cron` is present. The migrations execute in an in-process Postgres harness; local Supabase Docker verification was unavailable because the Docker daemon was not running. Task 1 is not operationally complete until the reviewed migrations are separately authorized, applied, and verified in production.

### Task 2 — Build and review the exact Phase 1 cohort ledger

**Consumes:** fresh live baseline; current dm/Rossmann/Müller and brand/specialist assortments; existing products and identifiers; valid scan misses as weak secondary evidence.
**Produces:** versioned ranked candidate ledger for the 140-identity Phase 1A milestone and 194-identity Phase 1B cohort, plus a frozen 20-backfill/5-new-product pilot with product/package identity, category, readiness checks, source evidence, priority rationale, expected EANs, and research status.

- Research current high-visibility products by retailer/category; use observable rankings, shelf presence, retailer breadth, and brand breadth without converting them into unsupported market-share claims.
- Reconcile every candidate against active, inactive, user-submitted, aliased, and quarantined catalog identities before classifying it as new.
- Run the current `scripts/catalog-authority/audit.ts` oracle and scanner fact/protocol readiness checks before labeling an existing row “identifier-first.” Oil selection is restricted to the 25 active core-spec-complete/no-barcode candidates unless a separately reviewed fact repair is added.
- Preserve the category targets in §4; changes require an explicit plan revision and reason.
- Split the cohort into reviewable waves of at most 25 exact identities, maintaining category breadth in every wave.
- Freeze only the 20-backfill/5-new-product pilot initially. Tasks 3 and 4 execute it first; use its measured throughput to publish the remaining batch forecast before Nick freezes the remaining waves.

**Complete when:** the totals and deltas reconcile to the fresh baseline, every ranked row has a stable exact identity and at least one evidence route, duplicates are removed, and Nick has approved the exact pilot fingerprint before pilot research begins.

**Local implementation receipt (2026-08-26):** the reproducible live baseline (`cc84636c1986bf2fe6a7fa5811ec063e2607ad2655f308220ebf16be93f27332`) contains 259 active supported products, 38 barcode-linked identities, and 221 active products without a barcode. The strict runtime-readiness audit (`ea9580f34c131fb618a94f9434299fed7633c8bbb3242884de46c15bcb763de3`) assesses all applicable scanner roles and hair thicknesses, leaving 192 existing products ready for EAN research and 29 blocked. The exact Phase 1A ledger freezes 102 existing-product rows at the category targets (`b311cfbd18e7df99371dcf2293e8c4bdf86619b8fe9334f0c1b93d6084b64a66`). The exact Phase 1B ledger freezes 54 reconciled confirmed-new identities at the category targets (`d29aecd8ba28bb5f8e47391f6fd41a72e3a65c133e75bb758bceea92120aa9fe`). The initial pilot manifest contains 20 existing products with 22 researched GTINs plus five new products with five researched GTINs, for 25 products and 27 unique canonical GTINs (`685b1f73a2a2524716412822d752522d133f915271876bea03d7b65c051a46d5`). All artifacts remain research-only. Task 2 is not operationally complete until Nick explicitly approves that exact pilot fingerprint; Tasks 3 and 4, Product Intake package creation, and every database write remain gated.

### Task 3 — Backfill identifiers for the 102 existing Phase 1 products

**Consumes:** approved existing-product lane; Task 1 collision oracle; exact live product IDs.
**Produces:** reviewed readiness-audited identifier manifests, any separately approved fact-repair manifests, and live verification receipts.

- Research official or reputable German/EU package EAN evidence for each exact product.
- If the authority/readiness audit finds missing facts or protocols, either replace the candidate within the same category or create a separately reviewed `catalogAuthorityRepairManifest`; do not smuggle fact repair into an identifier-only apply.
- Preserve multiple package EANs when supported; never infer a missing number from a similar size, market, or product-line variant.
- Generate, preflight, approve, apply, and verify small fingerprinted batches through the catalog-authority-compatible narrow identity operation.
- Run every accepted EAN through lookup and verdict rendering; identity-only success is insufficient.
- After the pilot, combine Task 3 and Task 4 throughput into one forecast and pause for Nick to approve the remaining Phase 1 waves.

**Complete when:** all 102 target deltas are scan-result-ready or have been replaced by approved same-category cohort rows with documented blockers, no accepted EAN collides globally, and the live catalog-authority audit remains clean relative to the approved baseline.

### Task 4 — Research and intake the 54 new Phase 1 products

**Consumes:** approved new-product lane; product-intake research contract; current classification model interface.
**Produces:** exact research packages, reviewed structured properties, non-promoted catalog rows, identifiers, and scan-verification receipts.

- Capture identity, package/barcode, product image, current INCI/evidence, commercial fields, category facts, and exact application protocols required for scanner evaluation.
- Run the research/classification machine, but require human review of identity and every property that affects a verdict.
- Keep each accepted evidence package as a labeled sample for later model evaluation, with source date and formula/package identity.
- Report catalog-intake, scan-result, and global-recommendation readiness independently.
- Research/review may proceed while the catalog-authority program is in flight, but production publication waits for or uses `publish_catalog_product_v1`; do not add another direct multi-table writer.
- After the pilot, combine Task 4 and Task 3 throughput into one forecast and pause for Nick to approve the remaining Phase 1 waves.

**Complete when:** 54 exact new products satisfy scan-result readiness, remain non-promoted unless separately authorized, and their EANs resolve through representative profile fixtures.

### Task 5 — Close the Phase 1 activation gate

**Consumes:** Task 1 plus Phase 1A outputs for the first gate; Tasks 1–4 for the full gate.
**Produces:** Phase 1A activation recommendation and Phase 1B full-cohort receipt.

- At Phase 1A, recompute live counts: 140 scan-result-ready identities and at least 142 verified EAN rows, with the Phase 1A category milestones met.
- Run automated schema, collision, resolver, and intake tests plus production read-back/fingerprint verification.
- Field-scan at least two accepted physical/package examples per category where samples are available; use exact manual EAN fixtures for the remainder.
- Audit a stratified sample of at least 30 accepted identities for exact front/back/barcode/formula agreement and run the catalog-authority oracle.
- Confirm retention, permissions, zero known false matches, and zero unresolved cohort collisions.
- Produce an activate/hold recommendation after Phase 1A. Activation still requires separate authorization; Phase 1B continues either way.
- At Phase 1B, recompute 194 scan-result-ready identities and 220–240 verified EANs with all category floors met, then issue the full-cohort receipt.

**Complete when:** the receipt proves every gate or names the exact hold. This plan stops before feature activation; activation remains a separate explicit decision.

### Task 6 — Execute Phase 2 broader sampling

**Consumes:** Phase 1 receipt; Phase 2 allocation; model error/uncertainty report; additional shelf and package samples.
**Produces:** approximately 315 scan-result-ready identities, 420–500 EANs, and a broader category-labeled gold sample.

- Freeze and execute batches with the same guarded workflow as Phase 1.
- Track coverage across retailer, price tier, format, brand family, formulation/property pattern, and package market—not only raw identity count.
- Use model uncertainty and reviewer disagreement to choose informative samples after demand/popularity requirements are satisfied.

**Complete when:** the Phase 2 end-state target and diversity matrix are met, all added identifiers pass the global ownership gate, and model results are reported against the expanded gold sample.

### Task 7 — Run Phase 3 from real scanner demand

**Consumes:** final-outcome telemetry; distinct-user miss ranking; pending submissions; quarantine queue; model uncertainty/disagreement.
**Produces:** recurring ≤25-identity batches, response-time receipts, and the Phase 3 reliability decision.

- Review weekly or every 25 valid distinct windows, with the first formal assessment after six weeks and 200 windows.
- Deduplicate retries, research exact products, and route engineering failures separately from catalog misses.
- Continue guarded batches until every Phase 3 exit condition in §4 is proven.

**Complete when:** the latest qualified assessment clears the overall/category gates, high-demand misses meet the SLA, and the evidence supports entering steady state.

### Task 8 — Establish Phase 4 steady-state operations

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
- Self-review and one read-only Claude counterpart review are complete. Locally verified findings were incorporated: corrected 259-active baseline, repaired category allocation, fact-readiness constraints, attempt/terminal telemetry, writer inventory, authority-cutover ordering, low-traffic gates, input-contract distinction, retention mechanism, and pilot-based capacity forecast. The reviewer's proposal to delete Phases 2–4 was rejected because Nick explicitly requested the four-phase program; activation was instead moved earlier so later phases can use real demand.
- Nick confirmed the evidence and operator journey on 2026-08-26 and instructed implementation to start. This confirms the selected decisions: Phase 1A activation recommendation at approximately 140 identities, Phase 1B continuation to 194, inactive products reserving their GTIN, and 30-day raw/12-month aggregate retention.
- Task 1 passed ready-check and whole-tree correctness/structural review. Claude reported no hard defects; its actionable test gaps and minor redundant-index finding were resolved and reverified locally.
- Task 1 implementation is isolated in this task worktree; product-data cohorts remain separate because measurement/uniqueness code and product-data application have different review and release risks.
- Every production cohort requires an exact manifest, fingerprint, preflight, explicit final approval, guarded executor, and live verification receipt.
- Phase gates authorize planning progression only. Commit, push, PR, merge, migrations, production writes, and scanner activation each remain separate actions under the repository workflow.
- Principal residual uncertainty: current retailer visibility is only a proxy for demand. Phase 3 is the first point at which Chaarlie can validate real first-scan coverage with its own users.

**Stop point:** finish local Task 1 readiness and whole-branch review. Do not commit, push, open a PR, apply migrations, begin cohort research, write production data, or activate the scanner without the relevant separate authorization.
