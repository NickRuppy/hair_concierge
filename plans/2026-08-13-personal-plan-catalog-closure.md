# Personal Plan catalog closure

## Outcome and source context

Close the four residual Stage 5 catalog items after PR #382:

- every product approved through Product Intake receives executable Stage 5 V2 guidance in the same guarded handoff;
- an active/recommended curated product cannot exist without valid V2 guidance for every required Stage 3 role;
- OLAPLEX No.0 is retired without deleting historical catalog evidence;
- the existing 30-sample read-only latency check is run and retained as an honest performance receipt;
- Nick receives one grouped review artifact for all canonical family instructions and remaining exact workflows.

Source context:

- `plans/2026-08-13-personal-plan-stage5-production-activation.md`
- `docs/product-intake-research-ops.md`
- `data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json`

## Chosen direction

Use the reviewed V1 product protocol plus typed product facts as the single authoring input. Extract the deterministic V2 pointer builder from the offline backfill generator and call that same pure builder from both the artifact generator and Product Intake validation. Ordinary products resolve to reviewed family templates automatically. A product whose sequence, timing, compatibility, safety, or specialized-treatment behavior cannot be represented by a supported family fails Product Intake preflight and requires an explicitly reviewed exact workflow; it is never silently forced through a generic template.

The refactor is output-preserving at the V2 pointer level: every surviving `guidance_payload_v2` must remain byte-equivalent. OLAPLEX No.0 is the only removed pointer. Source fingerprints may change only where existing behavior is moved from code/name inference into explicit reviewed V1 facts. Product-name regexes and product-ID behavior lookups are removed from the builder. Exact workflow identity, safety caution codes, typed amount facts, and exact step copy are authored in the reviewed V1 protocol before publication. Exact workflow IDs remain a code-reviewed allowlist with compiler placement rules; Product Intake can therefore admit a brand-new special product in one final handoff only after its named workflow has been reviewed and supported.

The exact exception inventory is fixed before implementation:

- Nivea Power Repair Conditioner contact time: derive the existing 60 seconds from V1 `protocolFacts.contactTimeSeconds`.
- Elvital Fiber Booster Conditioner contact time: derive the existing 180 seconds from V1 `protocolFacts.contactTimeSeconds`.
- The Ordinary Multi-Peptide Serum for Hair Density: preserve reviewed `cosmetic_claim_only` and `stop_on_irritation` as explicit structured caution codes.
- L'Oréal Paris Elvital Fiber Booster Anti-Haarverlust Serum: preserve reviewed `cosmetic_claim_only` as an explicit structured caution code.
- Pantene Pro-V Grow Abundant Anti-Haarverlust Shampoo: preserve reviewed `cosmetic_claim_only` as an explicit structured caution code.
- K18 Leave-In Molecular Repair Hair Mask: move the reviewed `apply-k18` German copy into the V1 source step and represent 1–3 pumps as a typed amount fact.
- The four surviving exact-workflow assignments become explicit reviewed `workflowId` facts in their V1 protocols; the builder does not select workflows from names or product IDs.

Product Intake will derive and validate `guidance_payload_v2` before the approval RPC runs. The approval transaction persists V1 and V2 together. A database publication assertion then provides defense in depth for active/recommended curated products. The admission contract deliberately has three paths: internally submitted/curated products cross the complete curated publication gate; user-submitted products remain non-recommendable and owner-scoped but still require V2 so the submitting owner's Anwendung cannot become partial; and any later promotion from user-submitted to curated must cross the same complete curated publication gate before it can become globally active or recommended.

The existing whole-artifact executor remains the backfill/repair path for the already-curated catalog. Product Intake becomes the sole go-forward path for newly approved products. They share the same builder and pointer contract but never both write the same newly approved product. For user-submitted products, the app validator and approval SQL function both reject missing/malformed V2 before the owner-linking transaction completes; the general curated-publication constraint intentionally does not govern unrelated direct user-submitted rows.

OLAPLEX No.0 will be soft-retired: `is_active = false`, `lifecycle_status = 'discontinued'`, and `is_chaarlie_recommended = false`. Its product row, V1 research, protocol evidence, and `add_on_for` relationship remain for audit. Its V2 pointer is cleared, its research row is marked retired, and it is removed from the generated artifact and runtime exact-workflow contract. The production preflight must still prove zero user, active draft, portfolio, routine, or pending-proposal references immediately before the write. Retirement and V2 enforcement live in one migration and one transaction: lock and retire No.0 first, then install the stricter assertion, so no incompatible intermediate state exists.

The latency receipt is not a navigation-feature test. It creates 30 fresh authenticated browser contexts for `/routine` and 30 for `/anwendung`, blocks every write request, and measures Anwendung internal-compute p95 against 1.5 seconds and meaningful-content p95 against 2 seconds.

## Scope and non-goals

In scope:

- shared deterministic V1-to-V2 pointer construction;
- Product Intake validation and approval persistence of V2 pointers;
- a V2-aware curated publication assertion and guarded migration;
- OLAPLEX No.0 soft retirement and artifact/runtime cleanup;
- a generated, grouped instruction-review artifact;
- one preparation instruction per visible Stage 5 sequence, without duplicating a
  canonical category step as a generated transition;
- the existing read-only 30-sample latency receipt.
- explicit regression coverage for the distinct internal-curated, owner-only user-submitted, and user-submitted-to-curated promotion paths.

Non-goals:

- hard-deleting OLAPLEX No.0, its evidence, or its relationship;
- changing canonical instruction copy before Nick reviews the grouped artifact;
- redesigning Stages 1-5 or Product Intake's operator UI;
- auto-publishing products or weakening the explicit Product Intake final-handoff gate;
- inventing support for arbitrary new bespoke workflows without review;
- treating the performance receipt as payment/webhook evidence.

## Target map

- `scripts/product-intake/catalog-enrichment/stage5-v2-generate.ts`: consume the shared builder and exclude explicitly retired research rows.
- `scripts/product-intake/catalog-enrichment/stage5-v2-apply.ts` and its executor RPC: remain the explicit existing-catalog backfill/repair path, not the go-forward intake writer.
- `src/lib/product-intake/catalog-enrichment/`: own the pure pointer builder, typed derivation failures, and instruction-review projection.
- `src/lib/routines/personal-plan/application/contracts.ts`: extend the reviewed V1 fact contract with optional V2 workflow identity, controlled caution codes, and typed pump amounts so future special products are complete before a database ID exists.
- `src/lib/product-intake/category-validators.ts`: derive, validate, and attach `guidance_payload_v2` to every required application-protocol operation.
- `scripts/product-intake/codex-research-worker.ts` and Product Intake tests: keep V1 plus typed facts as the authoring contract and surface exact-workflow blockers without asking the worker to hand-author ordinary V2 JSON.
- `src/lib/routines/personal-plan/application/contracts-v2.ts` and `compiler-v2.ts`: remove the dead No.0-only workflow and companion special case after its data is retired.
- `data/catalog-enrichment/personal-plan-stage5-v1/protocol-research.schema.json` and the bondbuilder research artifact: preserve No.0 evidence with an explicit retired status.
- `data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json`: regenerate to 272 product-role rows, 223 products, four exact workflows, and zero blockers.
- one migration created with `supabase migration new`: lock and atomically retire No.0 first, then persist V2 during Product Intake approval and extend `assert_personal_plan_curated_publication` to require valid V2 coverage.
- `scripts/personal-plan/measure-read-only-transitions.mjs`: reuse unchanged unless implementation evidence exposes a defect.
- `plans/receipts/`: retain the generated instruction review and privacy-safe performance summary; discard raw authenticated storage state.

## Designed operator and user journey

1. A Product Intake package is researched exactly as today: identity, image, category facts, V1 application protocol, evidence, and explicit final review. Its submission origin remains authoritative.
2. Preflight runs the shared pointer builder for every role required by those category facts.
3. For an ordinary product, the builder selects the canonical family template and previews the resulting German steps. For a supported exact workflow, it validates the reviewed exact steps. An unrepresentable special protocol returns a named blocker and cannot be approved.
4. For an internally submitted product, Nick's existing final-handoff action creates or links the curated product, writes category facts, and writes both V1 and V2 in one transaction. It cannot become active or globally recommendable without complete facts and valid V1/V2 coverage.
5. For a user-submitted product, the same guarded handoff preserves `origin=user_submitted`, keeps `is_chaarlie_recommended=false`, creates the owner link, and writes valid V1/V2 in the same transaction. This makes Anwendung complete for that owner without putting the product into global recommendations.
6. A later promotion from user-submitted to curated is a separate state transition. It must satisfy the same complete curated publication assertion as an internally submitted product before global activation or recommendation; the owner link and submission history remain intact.
7. A failed handoff or promotion leaves no partially published product.
8. OLAPLEX No.0 disappears from catalog search, recommendations, and newly compiled routines. Because live preflight currently shows zero user or Personal Plan references, no existing customer journey changes. If the exact pre-write preflight finds a new reference, retirement stops for reconciliation instead of mutating that plan.
9. Nick reviews one grouped document containing 23 family templates, the four remaining exact workflows, and the product count using each. Copy feedback becomes a separate reviewed content patch; merely opening the review does not change production.
10. On an ordinary Waschtag, the day summary and cadence remain general guidance. Product-independent state changes remain separate sequence steps, while each product card renders its canonical category technique. If the first category technique already contains the preparation needed for its anchor, the compiler does not repeat that preparation as a generated transition. Exact-product workflows replace only their product card and retain the surrounding general layers.
11. On the exact preview deployment, a disposable non-customer field-test owner loads `/routine` and `/anwendung` in 30 fresh contexts each. All writes are blocked. The receipt reports p50/p95 and fails if Anwendung internal compute exceeds 1.5 seconds p95, meaningful content exceeds 2 seconds p95, a redirect occurs, or an unexpected same-origin application write is attempted. Expected blocked Routine sync and cross-origin telemetry are classified and reported. Test access and raw session state are then revoked/destroyed.
12. No public Stage 1-5 layout or interaction changes in this work. Completion is a clean catalog admission boundary, removal of No.0, reviewable canonical content, non-duplicative instruction composition, and an honest latency result.

User-journey sign-off: confirmed by Nick on 2026-08-13 after explicitly correcting the submission-origin distinction and approving the No.0 retirement, benchmark, and grouped review.

## Planning evidence

This is primarily a catalog, validation, and database-boundary change. No public UI mockup is required because the released five-stage journey and German rendering stay unchanged. The implementation will generate a grouped content-review artifact from the exact final V2 data rather than a detached copy sample.

Current read-only production evidence on 2026-08-13:

- OLAPLEX No.0 is curated, active, and recommendable.
- It has zero `user_products`, `user_product_usage`, active/all Stage 3 drafts, portfolios, routines, active routines, and pending routine proposals.
- It has one preserved `add_on_for` relationship to OLAPLEX No.3PLUS.
- The current artifact has 273 product-role rows, 224 products, five exact workflows, 272 composable rows, and one No.0 blocker.
- A live all-active-curated protocol audit found exactly one missing/invalid/blocked V2 row: OLAPLEX No.0 with `missing_verified_companion`. Every other active/recommendable curated V1 protocol row has a correctly scoped schema-version-2 pointer with no runtime blocker.

Evidence-review status: Nick approved the grouped instruction content and the rendered example-day hierarchy on 2026-08-13. The retained review evidence is `plans/receipts/2026-08-13-stage5-example-day-mockup.html`. Its prototype-only layer toggle and labels remain review evidence; production receives the approved general day summary in the existing detail header plus the compiler deduplication behavior.

## Ordered tasks

### 1. Retire OLAPLEX No.0 without erasing evidence

Consumes: exact product ID `aadbbab5-bcf5-4b46-b38a-5533648bcb1d`, current reference counts, V1 research row, V2 artifact, and exact-workflow contracts.

Add an explicit retired research state, make the artifact generator exclude it, remove every No.0-only workflow assignment, compiler entry, and workflow-specific schema refinement together, and regenerate the artifact. Keep nullable `requiredCompanionProductId`, the generic `missing_verified_companion` blocker value, and the generic compiler fail-closed branch for stored-contract/rollback compatibility. Replace only the No.0-specific schema refinement with a generic invariant: a pointer may not carry both a verified companion ID and a runtime blocker; ordinary pointers carry neither. No new companion workflow is added. Prepare guarded retirement DML for the single combined migration owned by task 3. That migration locks the product row with `FOR UPDATE`, rechecks zero owner/plan references and exact current product/relationship state in the same transaction, then updates visibility/lifecycle fields and clears only `guidance_payload_v2` before V2 enforcement is installed.

Produces: 272 rows, 223 products, four exact workflows, zero blockers; preserved product/evidence/relationship history; no No.0 runtime contract.

Tests: artifact/schema generation tests, V2 contract/compiler tests, migration source/guard tests, reverse-coverage preflight, and the Stage 5 application suite.

Complete when: generated counts match exactly, No.0 cannot enter search or a new plan, all historical evidence remains addressable, and a drifted live reference blocks the migration.

### 2. Make V2 guidance part of Product Intake admission

Consumes: reviewed V1 protocol, typed category facts, shared family templates, known exact-workflow registry, and Product Intake target spec operations.

Extract and test a pure pointer builder. Define its product-ID boundary explicitly: offline existing-catalog input carries a real UUID; Product Intake input carries `__PRODUCT_ID__`, is validated by temporarily substituting the same sentinel UUID pattern already used for V1, and returns a pointer with the placeholder restored for SQL rewriting. Byte-equivalence between offline and intake projections applies to all fields except this intentional pre-approval `scope.productId` representation.

Remove the two conditioner contact-time name regexes after proving their 60/180-second values come from structured V1 facts. Extend the reviewed V1 protocol facts with controlled optional `workflowId`, `cautionCodes`, and typed pump amounts; move the four surviving exact-workflow assignments, three products/four safety-caution assignments, K18 pump amount, and K18 `apply-k18` copy into those source facts/steps. Have Product Intake validation call the builder and attach `guidance_payload_v2` to each protocol row. Ordinary products require no duplicate V2 authoring. A special product whose reviewed `workflowId` is absent from the code-reviewed allowlist returns a typed exact-review blocker; after that workflow support is reviewed, the same pre-publication package can pass without minting a product row first. There is no bypass flag.

Produces: one authoritative V1-to-V2 transformation used by offline regeneration and every future Product Intake approval.

Tests: table-driven family coverage for every category/role; the four exact workflows sourced from V1 metadata; the two conditioner contact-time derivations; exact preservation of all three products/four `cosmetic_claim_only`/`stop_on_irritation` assignments; K18 typed amount and step-copy preservation; real UUID and placeholder/sentinel/restore paths; malformed/mismatched scope; unsupported exact workflow; deterministic fingerprints; current Product Intake package fixtures; and a V2-pointer diff proving that every survivor is unchanged and No.0 alone is removed.

Complete when: generator and Product Intake produce identical V2 pointer content after normalizing the intentional product-ID placeholder difference, no product name or product ID selects application behavior, and every surviving production pointer matches the pre-refactor pointer byte-for-byte.

### 3. Persist and enforce V2 atomically

Consumes: V2-bearing target operations from task 2 and the current guarded approval/publication functions.

Create one migration through the Supabase CLI. Its precondition requires that No.0 is the sole active/recommended curated required-role pointer with a runtime blocker and that every required role of every other active/recommended curated product already has a valid, correctly scoped, non-blocked V2 pointer. In order: lock and guard No.0, retire it, clear its V2 pointer, validate required V1 and V2 operation scopes before the legacy approval body runs, persist `guidance_payload` and `guidance_payload_v2` together, then extend `assert_personal_plan_curated_publication` so every derived required role has a scoped schema-version-2 pointer with no runtime blocker. The approval RPC change is three-part and inseparable: add `guidance_payload_v2` to its `jsonb_to_recordset`/insert/update shape; validate both payloads carry the matching category and `__PRODUCT_ID__` placeholder; then rewrite both `scope.productId` values to the real approved UUID with `jsonb_set` before the stricter assertion evaluates. Preserve SECURITY DEFINER search-path hardening and existing execute grants. Keep user-submitted products non-recommendable; the approval SQL function itself validates V2 before it invokes the legacy approval body, giving the official owner-linking flow a database transaction backstop without extending the general curated constraint to user-submitted rows.

Produces: atomic future admission with no publish-then-backfill window and a database defense against bypasses for curated/recommended products.

Tests: approval validation/operation tests; an exact assertion that stored V1 and V2 `scope.productId` both equal the newly approved product UUID rather than the placeholder; migration source-contract tests; internally submitted curated success and incomplete-curated rejection; owner-linked user-submitted success with `is_chaarlie_recommended=false`; user-submitted-to-curated promotion rejection until complete; rollback-on-missing/malformed V2; and idempotent retry.

Complete when: a live audit proves zero missing/blocked required-role pointers outside No.0 before apply; the migration has no state where active No.0 is judged by the new no-blocker assertion; missing V2 prevents publication with zero partial writes; complete packages succeed once; and exact retry is stable.

### 4. Generate the instruction review artifact

Consumes: the final regenerated artifact after tasks 1-2.

Generate a deterministic review document grouped by category and family. Show each template's German steps, compatible day types, number/list of mapped products, and the four exact workflows separately. Include artifact fingerprint and counts so feedback is tied to exact content.

Produces: `plans/receipts/2026-08-13-stage5-instruction-review.html` classified for commit.

Tests: generation determinism, HTML escaping, count/fingerprint agreement, and zero unresolved rows.

Complete when: Nick can review every canonical instruction once without reading 272 duplicate product rows.

### 4a. Keep general and category guidance without duplicated preparation

Consumes: the approved example-day mockup, the canonical family steps, and the compiler-generated anchor transitions.

Add a focused compiler regression guard proving that an initial `wet_cleanse` transition is omitted when the first product protocol already carries the canonical wetting preparation, while the generated wetting transition remains for an exact or legacy protocol that does not contain that preparation. Keep the family technique intact and do not deduplicate merely similar product actions or required transitions between anchors.

Produces: one visible wetting instruction for an ordinary Shampoo day, with the general day summary and cadence visible above the category technique and necessary state transitions.

Tests: focused V1/V2 compiler tests, detail-header rendering, Stage 5 route/view-adapter coverage, and a mutation check proving that removing either the family preparation or the compiler fallback breaks a guard.

Complete when: the approved example Waschtag has no repeated preparation and an exact workflow that assumes wet hair still receives the compiler-owned fallback.

### 5. Run the post-deploy read-only latency receipt

This is an operational closure receipt, not a code-development dependency. It does not block tasks 1-4 from becoming review-ready; it runs on the exact deployed preview before final production closure.

Consumes: exact reviewed preview SHA, diagnostic marker enabled only on preview, and an explicitly authorized disposable field-test owner/session.

Run the existing sampler with 30 samples, retain the privacy-safe report, destroy storage state, and revoke test access. Treat a miss as a performance defect to diagnose; do not average it away or silently raise thresholds.

Produces: a committed summary receipt with `/routine` and `/anwendung` p50/p95, deployment SHA, thresholds, blocked background-request classes, zero unexpected application write attempts, and pass/fail.

Checks: 30 samples per route, expected final pathname, marker present, internal p95 at most 1.5 seconds, meaningful-content p95 at most 2 seconds, every non-read request blocked, and no unexpected same-origin application write attempt. The sampler reports the existing Routine sync and cross-origin telemetry separately instead of pretending those blocked requests executed.

Complete when: the exact preview has a truthful pass/fail receipt and no reusable test credential remains.

## Verification

Automated:

- focused Product Intake validator/review/publish tests;
- focused V2 artifact, contract, compiler, repository, and route tests;
- `npm run personal-plan:application-audit` with final exact counts;
- `npm run test:personal-plan-stage5`;
- `npm run test:personal-plan`;
- `npm run test:node`;
- `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

Manual/browser:

- review the grouped instruction artifact;
- verify No.0 is absent from Stage 3 catalog search and cannot enter a new Routine;
- verify an ordinary product still renders its canonical family instructions and one remaining exact product renders bespoke steps.
- verify the approved example-day composition: general day guidance, canonical category cards, and one copy of each preparation transition.

Migration/live state:

- inspect columns and exact current rows before DML;
- preflight zero No.0 owner/plan references immediately before apply;
- mandatory pre-apply audit, reported per category and in total: among active/recommended curated required roles, No.0 is the only blocked pointer and every other role has valid schema-version-2 scope with no blocker; any other gap hard-stops the migration;
- dry-run post-retirement V2 reverse coverage with expected 272/223/23/4/0 counts;
- apply only after separate explicit migration/production-write authorization;
- exact post-apply readback and idempotent retry where supported;
- Supabase security and performance advisors after the schema/function change.
- deployment ordering: the retirement/enforcement migration must apply before code that no longer recognizes the No.0 workflow is promoted to production; preview may run against isolated reviewed data only.

Evidence-sensitive:

- Nick's instruction review may produce copy changes; those changes require regeneration and renewed fingerprint review;
- the 30-sample receipt reports measured data without converting a failure into a relaxed SLO.

## Review and handoff

- Worktree: `.worktrees/personal-plan-catalog-closure`
- Branch: `codex/personal-plan-catalog-closure`
- Counterpart plan review: four read-only passes approved the shape with revisions; all verified blockers, tradeoffs, and high-confidence findings are incorporated.
- Evidence review: architecture and journey confirmed; final instruction-content review pending the generated artifact.
- Operator/user journey sign-off: confirmed 2026-08-13.
- Publication stop point: implementation may prepare migration and guarded commands and may create/revoke only the disposable preview benchmark state Nick explicitly authorized. Commit/push/PR, production migration apply, production data retirement, production deployment, and merge remain their normal explicit gates.
- Artifact disposition: plan and grouped instruction review are committed; raw benchmark JSON may be reduced to a privacy-safe summary; authentication storage state and transient reviewer output are destroyed/discarded.
- Residual risk: a new No.0 reference appearing between today's read and the migration is handled by the migration's exact precondition and blocks the write.

### Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| CR-1 | defect | Active No.0 carries a runtime blocker, so enforcing no-blocker V2 before retirement would fail | accepted | One combined ordered migration: lock/retire/clear first, enforce second | Revised counterpart review plus migration source test |
| CR-2 | defect | Three products/four safety caution assignments currently depend on product-name regexes with no V1 structured caution field | accepted | Extend reviewed V1 facts with controlled caution codes; preserve the exact assignments and make future claim cautions explicit rather than name-inferred | V2 pointer diff and focused tests |
| CR-3 | tradeoff | A broad builder refactor could silently change canonical output | accepted as output-preserving | Require every surviving pointer to match pre-refactor output byte-for-byte | Deterministic artifact diff |
| CR-4 | tradeoff | A V2 admission false positive could block Product Intake | accepted without bypass flag | Structured reviewed V1 metadata plus the exact-workflow allowlist is the controlled path; pure table-tested derivation remains fail-closed | Product Intake blocker and exact-workflow tests |
| CR-5 | defect | A stricter assertion could arm a latent failure for another active curated product lacking valid V2 | accepted | Mandatory live all-curated required-role audit before apply, with No.0 as the sole allowed blocker | Pre-apply query and migration guard |
| CR-6 | defect | Conditioner timing and K18 copy are additional name/code-specific output paths | accepted | Enumerate both 60/180-second structured derivations and move K18 copy/amount into reviewed V1 source facts/steps | Byte-equivalent V2 pointer diff |
| CR-7 | tradeoff | Offline artifact apply and go-forward Product Intake will coexist | accepted | Declare offline apply as existing-catalog backfill/repair and Product Intake as sole go-forward writer | Boundary tests and target-map review |
| CR-8 | tradeoff | General publication trigger excludes user-submitted products | accepted with SQL-function backstop | App validation plus approval-function V2 validation protect the official owner-linking flow; no general user-submitted trigger added | Missing-V2 rollback test |
| CR-9 | defect | Go-forward V2 is derived while `scope.productId` is still the placeholder | accepted | Approval SQL rewrites V2 scope to the actual approved UUID exactly like V1 before persistence | Stored-scope integration test |
| CR-10 | tradeoff | A separate exception manifest/ID constant cannot serve a new product before its UUID exists | rejected | Put workflow identity, caution codes, amount, and exact copy in reviewed pre-ID V1 metadata/steps; retain only the workflow allowlist/placement in code | Placeholder-path and exact-workflow tests |
| CR-11 | tradeoff | No.0 removal leaves generic companion/blocker fields with ambiguous disposition | accepted for compatibility | Remove No.0 workflow/refinement, retain generic nullable fields/value and generic fail-closed compiler branch | Contract/compiler tests |
| CR-12 | scope | The latency run is operational evidence, not implementation | accepted | Keep as post-deploy closure receipt that does not block code review-readiness | Exact-preview receipt |
| CR-13 | defect | UUID-strict V2 parsing cannot consume the Product Intake placeholder directly | accepted | Mirror V1 sentinel validation, restore placeholder for persistence, and scope parity assertions around the intentional ID representation | Real-ID and placeholder builder tests |
| CR-14 | tradeoff | Name inference would automatically caution future hair-loss-claim products but is semantically unsafe | accepted as explicit review | Future caution codes are evidence-backed reviewed facts in the protocol, never inferred from a name | Research-worker/validator caution tests |
| CR-15 | tradeoff | Product-ID overrides are unavailable before a brand-new product is approved | rejected as architecture | Exact workflow identity is reviewed pre-ID in V1 metadata against a code allowlist, enabling one guarded final handoff | New special-product fixture |
