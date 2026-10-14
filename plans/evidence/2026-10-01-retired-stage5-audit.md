# Retired historical / frozen catalog test layer ledger

Baseline: `21e0e41fa996ec6a725c258ab3766971f0edb94d`, worktree `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`. Discovery was read-only; the eight-declaration patch described below is applied locally. Corrected-tree proof completed; see [the verification receipt](2026-10-02-test-audit-receipt.md) for current counts and limitations. Root AGENTS.md and installed test-audit SKILL.md/CAMPAIGN.md read. No scoped AGENTS.md under the searched tests/src/scripts/docs/data trees.

## Chosen layer direction

**7 historical D declarations, 0 C declarations** across four test files: two dead full-registry apply helper tests, one exact duplicate Balea artifact suite, and four repeated checks of independently fingerprint-pinned historical Oil/artifact data. Two whole test files can disappear. Approximately 194 body/file lines plus unused imports/whitespace; ~106 library lines and ~36 adapter lines can be removed for the retired apply lane, subject to final diff accounting.

Prioritize the first three candidates (D1/D2/D3). D4-D7 are a coherent additional frozen-data consolidation: their keeper is an independently fixed fingerprint, not a newly weakened inventory test. Preserve the fingerprint constants unchanged and keep runtime/schema/mutation/migration contracts. These 7 declarations do not materially satisfy the global 20% goal.

The actual retired layer is smaller than the names imply. The full-registry CLI was explicitly retired, but its historical read-only preflight remains deliberately runnable, the frozen artifact is current authority for pointer deltas, and shared write authorization remains live. Deleting all Stage 5 V2 tests would be wrong.

## D1 — retired apply argument parser and its only test

- **Exact test:** `tests/personal-plan-stage5-v2-activation.test.ts:84-100`, `Stage 5 V2 activation is a dry-run unless every explicit production gate is present`.
- **Actual detection:** parser default `{apply:false}`, missing project confirmation rejection, and parsing the explicitly confirmed head/fingerprint options for the old full-registry command.
- **Distinct tested owner:** `parseStage5V2ApplicationApplyArgs` / `Stage5V2ApplicationApplyArgs`, `src/lib/product-intake/catalog-enrichment/stage5-v2-application.ts:33-64`.
- **Non-test callers:** none. Repository-wide symbol search finds only this test and a stale documentation comment in the replacement delta parser. Prior `92f00b8c^:scripts/product-intake/catalog-enrichment/stage5-v2-apply.ts:29` called it; current file exits with a retirement refusal and never imports it.
- **Keeper / no proof needed:** no contract remains for the dead parser. Current delta parser is separately owned by `parseStage5V2PointerDeltaApplyArgs`, with stricter tests at `tests/personal-plan-stage5-v2-pointer-delta.test.ts:271-309`; current CLI uses it at `scripts/product-intake/catalog-enrichment/stage5-v2-pointer-delta-apply.ts:36`. The explicit retirement guard remains at pointer-delta test line340.
- **Lifecycle/history:** `92f00b8c` (2026-09-14, #553) explicitly replaced the full-registry write entry point. `plans/stage5-v2-lane-fix/plan.md` records Nick's Option2 ruling and the structural reasons the old apply cannot run. This is repository evidence of retirement, not inference from a past successful apply.
- **Cleanup unlocked:** remove the test, import, dead parser/type, parser-only SHA256_PATTERN and GIT_SHA_PATTERN. Retain EXPECTED_PROJECT_ID and `isStage5V2ProductionWriteAuthorized`; that helper is still called by the live delta CLI at line56. Update the stale delta-parser comment to describe its own contract without naming the deleted parser.
- **Risk:** low if removal is limited to the unused parser. Removing the shared production authorization helper instead would weaken the live write lane and is prohibited.
- **Focused validation:** `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage5-v2-activation.test.ts tests/personal-plan-stage5-v2-pointer-delta.test.ts tests/personal-plan-stage5-v2-pointer-delta-postgres.test.ts`, then typecheck and symbol search.

## D2 — retired whole-registry verifier and its only test

- **Exact test:** `tests/personal-plan-stage5-v2-activation.test.ts:141-169`, `Stage 5 V2 post-apply verification requires every exact family and product row`.
- **Actual detection:** old verifier accepts every family/pointer returned from a mock synthesized directly from the artifact itself and reports 28/310 counts. It exercises no negative mismatch case. Its subject is the old all-registry verifier, not live database state.
- **Distinct tested owner:** `verifyStage5V2AppliedArtifact` and `Stage5V2ApplicationAppliedRead`, `src/lib/product-intake/catalog-enrichment/stage5-v2-application.ts:300-370`.
- **Non-test callers:** none. Previous full apply invoked it at `92f00b8c^:scripts/product-intake/catalog-enrichment/stage5-v2-apply.ts:59`; current full apply has no imports and refuses. Shared `protocolFamily` must remain because the supported historical preflight still calls it.
- **Keeper / no proof needed:** no supported lane calls this verifier. Current delta CLI re-reads through `preflightStage5V2PointerDelta` and demands every item be `already_applied` at `stage5-v2-pointer-delta-apply.ts:73-83`. Delta preflight tests at lines186-269 and real migration tests preserve that current lifecycle. Retain all historical preflight tests and the migration guard in activation.test.ts:120.
- **Lifecycle/history:** same explicit #553 retirement as D1. The migration/RPC itself stays in the database chain; removing unused TypeScript wrappers does not retire replay/rollback SQL.
- **Cleanup unlocked:** delete test/import and old verifier/read-interface. Additionally the three orphan adapter members `v2.apply`, `v2.listV2Families`, `v2.listV2Protocols` at `scripts/product-intake/catalog-enrichment/stage5-protocol-client.ts:355-390` have no callers; remove their obsolete old-RPC name/argument branches from the private client type. Keep `v2.applyPointerDelta`, `v2.listPointerCoverage`, the V1 `apply`, and read/audit APIs.
- **Risk:** low when symbol/member call search and typecheck remain clean. The old SQL RPC is deliberately retained by the retirement plan and must not be removed as collateral cleanup.
- **Focused validation:** same command as D1, plus `tests/product-intake-stage5-protocol-client-relationships.test.ts` and `tests/personal-plan-stage5-catalog-program.test.ts` if the shared adapter is cleaned.

## D3 — redundant Balea frozen-artifact suite

- **Exact test/file:** all 23 lines of `tests/personal-plan-stage5-balea-amendment-artifact.test.ts`; sole declaration at line7, `the Stage 5 V2 authority artifact includes Balea ordinary wash guidance`.
- **Actual detection:** Balea shampoo_everyday row missing, wrong applicationFamily, non-null contactTime, or non-null runtimeBlockerCode in the committed `application-pointer-backfill.json`.
- **Distinct owner/non-test callers:** the frozen generated artifact is emitted by `scripts/product-intake/catalog-enrichment/stage5-v2-generate.ts` and used by current pointer-delta preflight/apply via `STAGE5_V2_ARTIFACT_PATH`; its authority is still live even though bulk apply retired.
- **Stronger keeper:** `tests/personal-plan-stage5-protocol-amendment.test.ts:370-394` requires exactly one Balea row, correct role and complete deep-equal pointer. Its expected `pointer` is independently asserted at lines190-213 to have the same exact family/contactTime/runtimeBlocker values. The generated artifact bytes are also pinned at activation.test.ts:20-33. This does not rely only on the same builder generating both expected and actual values: actual is checked-in JSON.
- **History:** `39d9f494` (2026-09-01, #496) introduced the separate artifact carry-forward file along with the fuller amendment test. The fuller owner additionally protects the frozen source row and Nivea amendment.
- **Cleanup unlocked:** delete the entire 23-line file; no production seam.
- **Risk:** low, exact stronger keeper. Future changes to the canonical amendment test must retain the field/value assertions above.
- **Focused validation:** Node shim command with `tests/personal-plan-stage5-protocol-amendment.test.ts` and `tests/personal-plan-stage5-v2-activation.test.ts`.

## D4-D6 — duplicate detail checks over one immutable Oil manifest

All three below parse the exact same immutable file as the keeper. No hook, different fixture, adversarial mutation, live state, schema variation, or transport boundary distinguishes them.

**Shared stronger keeper:** `tests/catalog-authority-oil-repair.test.ts:40-74`, especially lines59-60, computes the content fingerprint of the complete _parsed output_ and compares it to fixed literal `bc2cca3c68ae4eea4dd337fcbbd5f02be5d7ac1d42635a26bd68a74255929b2b`; it additionally pins approval metadata, cohort, protocol count, and read-only inspection. `catalogAuthorityRepairReviewFingerprint` (`src/lib/catalog-authority/repair.ts:79-87`) includes all schemaVersion/slice/entries, recursively canonicalized, so every field checked below is covered. The fingerprint constant must not be re-derived from input or changed in this audit. Parser mutation tests at line158 stay: a valid immutable sample alone cannot prove malformed alternatives fail.

**Shared non-test callers:** `parseOilAuthorityRepairManifest` is used by the historical `catalog:authority:oil-repair` inspection CLI (`scripts/catalog-authority/oil-repair-client.ts:181`) and Stage5 artifact generator. The parser remains useful and must stay. `src/lib/catalog-authority/oil-repair.ts:14-16` explicitly documents historical schema retention and current write retirement. `3e5018eb` (#516, 2026-09-04) retired its apply CLI; `ddc553f6` (#492, 2026-09-01) introduced the approved bundle/tests. The immutable exact fingerprint is recorded in `docs/ops/catalog-repairs/2026-09-01-oil-authority-enrichment/README.md:15-17`.

### D4

- **Exact test:** `tests/catalog-authority-oil-repair.test.ts:76-121`, `OGX and Garnier carry only the explicitly recommended finished-product authority`.
- **Actual detection:** accidental change to the two frozen products' affiliate link, exact specs/eligibility, or exact heat-capability ID set.
- **Keeper:** full parsed-entry fingerprint and retained structural mutation guards described above. No alternate inputs are provided here, so weakening the validator without changing this valid immutable output would already pass this test; it is not a negative validator contract.
- **Cleanup:** 46 body lines, no production seam; OGX_ID/GARNIER_ID and targetEntry remain used by retained mutation tests.
- **Risk:** loses human-readable field-specific failure wording, not an independent accidental-change detector. Do not use the hash argument to delete dynamic property tests elsewhere.
- **Validation:** Node shim command with `tests/catalog-authority-oil-repair.test.ts tests/catalog-authority-repair.test.ts` and generator dry `--check` (no regeneration).

### D5

- **Exact test:** same file:123-137, `sheet thickness is immutable and all other oils retain conservative pre-wash purpose`.
- **Actual detection:** changes to immutable before/after identity, thickness arrays, or the old frozen purpose literals.
- **Keeper:** all before/after fields are inside the fixed parsed-entry hash. Runtime Oil purpose behavior is not invoked; current three-purpose behavior has separate owners and this legacy manifest intentionally retains the old four-role shape.
- **Cleanup:** 15 body lines, no production seam.
- **Risk:** same limited loss of field-specific diagnostics; preserve parser mutation test and live Oil behavior tests.
- **Validation:** same as D4.

### D6

- **Exact test:** same file:139-156, `fact provenance excludes protocol-only internal authority and protocols are product-scoped`.
- **Actual detection:** changes to frozen fact sourceType values or any protocol payload scope.
- **Keeper:** both fields are in fully fingerprinted entries; the same parser/schema runs in keeper. This case has no malformed/foreign-scope input and therefore does not prove rejection of new bad payloads beyond parsing the frozen sample.
- **Cleanup:** 18 body lines, no production seam.
- **Risk:** same hash diagnostic tradeoff. Keep all dynamic validation tests and SQL source/privilege checks.
- **Validation:** same as D4.

## D7 — redundant cross-check between two independently pinned immutable artifacts

- **Exact test/file:** all 46 lines of `tests/personal-plan-stage5-oil-authority-artifact.test.ts`; declaration line5, `the Stage 5 V2 artifact carries forward every approved oil authority protocol`.
- **Actual detection:** one of the frozen Oil source's 18 protocol identities missing/duplicated in frozen V2 artifact or carrying non-null runtimeBlockerCode; source review state/reviewer mismatch.
- **Non-test callers/owner:** current generator and delta validator still consume the two artifacts. Keep both artifacts, generation, compiler, schema and delta tests.
- **Stronger keeper:** source manifest's complete parsed entries and approval metadata are fixed by `catalog-authority-oil-repair.test.ts:40-74`; entire raw V2 artifact bytes fixed by `personal-plan-stage5-v2-activation.test.ts:20-33` to `7afa162b8575e07afc3f1c5b801ac66ffdcbebbecba1fa505ffb13bf3aad03a8`. Neither artifact can accidentally change without its independent keeper failing. The removed body executes no generator, compiler or schema: it only traverses raw JSON.
- **History:** `39d9f494` (#496, 2026-09-01) introduced this carry-forward assertion; later #553 explicitly froze the artifact and replaced writes with exact byte-derived deltas. `plans/stage5-v2-lane-fix/plan.md` states no artifact regeneration/no edits to stale artifact items.
- **Cleanup unlocked:** entire 46-line file, no production seam.
- **Risk:** lower-priority candidate because the cross-artifact relationship is easy to read here. For this immutable source pair, however, it adds no independent change detection beyond unchanged hash keepers. If either artifact is deliberately reopened for re-authoring, its owning migration/authoring task must establish new semantics; this audit does not authorize that.
- **Focused validation:** Node shim command with `tests/catalog-authority-oil-repair.test.ts tests/personal-plan-stage5-v2-activation.test.ts tests/personal-plan-stage5-v2-pointer-delta.test.ts`, plus `npm run personal-plan:application-audit` if safe local check mode is confirmed by orchestrator.

## Complete declaration marks for the selected layer

- `personal-plan-stage5-v2-activation.test.ts`: :20 R byte hash; :35 R frozen baseline pins/carry-forward provenance; :84 D1; :102 R shared authorization still used by current delta writer; :120 R still-installed historical SQL executor privileges/replay chain; :141 D2.
- `catalog-authority-oil-repair.test.ts`: :40 R complete manifest/approval hash keeper; :76 D4; :123 D5; :139 D6; :158 R adversarial parser inputs; :190 R installed SQL scope/security/null safety; :217 R SQL ambiguity repair chain; :238 R executable apply retirement.
- `personal-plan-stage5-balea-amendment-artifact.test.ts`: :7 D3.
- `personal-plan-stage5-oil-authority-artifact.test.ts`: :5 D7.

Layer total: 16 direct declarations, 7 D / 9 R; 43.75% within this narrowly owned layer, not within the global test suite. Do not present that layer percentage as achievement of the user's global target.

## Retained tempting historical layers

- `personal-plan-stage5-v2-preflight.test.ts` six tests (:70,:84,:91,:101,:117,:143): R. Current historical CLI explicitly stays runnable and invokes this owner; snapshot binding, source drift, conflicting stored pointers, stale count projections, reverse coverage, and exact family identity are distinct observed report behavior. This is not dead code like D1/D2.
- `personal-plan-stage5-v2-backfill.test.ts` six tests (:35,:61,:79,:92,:108,:122): retain in this batch. Several traverse current schema outputs/runtime template mappings, so they are not all raw immutable JSON duplicates. A separate runtime/schema preservation review could consider consolidation; this lane does not claim a complete stronger keeper for every parsed-field assertion.
- `personal-plan-stage5-k18-live-artifact.test.ts`: retain. It compares a separately editable readiness source-file hash and recomputed source protocol fingerprint to the artifact, in addition to literal fields. No independent complete source-file pin was established here.
- `catalog-authority-historical-repair-migration.test.ts`: retain migration chain (generated column parity, supporting indexes, staged constraint validation, write lifecycle constraint). The standalone existence assertion is redundant with the other four reads but is not a meaningful retired layer; no quota-motivated cut proposed.
- `catalog-additions-2026-06-27.test.ts` seven tests: retain. Package still exposes prepare/dry-run/apply at package.json:114-116 and script retains writer/main. Its four-product approval scope and project/host guards are still independent bounded-write contracts. The date does not establish retirement.
- `seed-deep-cleansing-products.test.ts` five tests and `seed-dry-shampoo-products.test.ts` one: retain. Scripts still have standalone `--apply` branches and destructive stale-row deactivation, with no current retirement declaration. Removing guard tests while executable legacy writers survive would be unsafe.
- OGX search/renewing packages: retain. Current README says prepared/no database change, and tests protect exact SQL scope, privacy-safe snapshots, serializable locks, drift checks and rollback/recovery boundaries. These are operator tools, not frozen completed receipts whose operation was disabled.
- Scanner Phase1A/existing ledger tests: retain. They call builder functions on frozen captured inputs and protect selection partitions and fingerprint stability, not only past inventory literals. No explicit builder retirement was found. Phase1B and larger enrichment suites were inventoried but not fully re-reviewed in this pass and carry no deletion recommendation.

## Evidence and limits

Complete reads covered the selected 16-declaration layer, both corresponding source modules, previous/current full-apply entry points, current delta apply and its guard/call path, complete shared adapter, frozen artifact consumer searches, package/CI routing, relevant Git history, and the retirement plan. Additional full reads: catalog additions test, both seed tests, two OGX artifact tests, historical repair test, scanner existing/Phase1A ledger tests, Stage5 preflight/backfill and reconciliation tests. Large general enrichment/runtime suites were scoped out after identifying active contracts; this is not a claim that every historical-named test has been classified.

All selected files are in root `tests/*.test.ts` routed by package.json:test:node and CI quality-node. No direct file inventory exception was found. Mandatory final proof belongs to the orchestrator: focused keepers, deliberate mutations for any semantic consolidation, production/test LOC accounting, fixed-source-set coverage comparison, typecheck/lint, and whole-branch review. No measured coverage delta is provided by this read-only lane.

Current files and history independently confirmed every lifecycle conclusion.

## Applied integration and additional exact duplicate

The seven historical cuts plus one PostHog subset duplicate are applied. The
PostHog declaration at `tests/posthog-personal-plan-offer-dashboard.test.ts:63`,
"purchase visibility keeps the historical revision exception while retaining
package and session scope", rechecks the same o1/o5 objects as the preceding
"downstream outcome sets remain bounded..." declaration. That keeper asserts the
stronger complete purchase-or-revision predicate and identical package/session
join strings. Owner: `scripts/analytics/personal-plan-offer-dashboard.ts`; callable
updater/restore consumers remain unchanged. Both assertions originated in
`d4ed47c27`. No source cleanup follows that exact subset deletion; risk is minimal
while the stronger keeper remains. Validate dashboard plus revision/migration
siblings locally; no PostHog write command.

Patch preparation independently verified unchanged retained function/test bodies
and surviving adapter methods, clean postimage syntax, and absence of removed
symbols in the proposed tree. Main inspected/applied the patch only after Node
finished. Application/preflight/delta auth/SQL are retained. Source/tooling net
reduction is 149 lines before formatter effects; final numstat is authoritative.
The four immutable-artifact cuts trade field-specific diagnostics for unchanged
complete-content fingerprint guards; reopening those frozen packages is outside
this cleanup.

## Empty Compare Lab sentinel

Remove `tests/agent-compare-runner.spec.ts:281` — "held-out compare turns are
explicitly marked unavailable until real testing data exists" — and its only
owner, `src/lib/agent/compare/held-out-turns.ts` (5 lines). The test only compares
an exported hard-coded empty array with `[]`. Complete file/owner/caller/history
inspection finds no runtime, CLI, dynamic registry or CI importer; the populated
scenario/prompt-pack runners and development QA Lab do not call it. No keeper is
needed for this vacuous placeholder. The future real held-out evaluation
requirement stays documented in the 2026-05-05 agentic-loop spec; the empty
sentinel introduced in `4383accd` never implemented it. Risk: accidentally
removing a populated/private-data loader instead; verified this module contains
only the literal constant and type import. Run the actual Node compare-runner
suite with server-only/tsx loaders, plus typecheck and symbol search. All other
Compare Lab assertions and actual fixtures stay.

Explicit false vs omitted product-intake enablement is retained. They are
separate flag states: replacing `=== true` with `!== undefined` changes the
explicit-false behavior while default stays disabled. Similar output today does
not prove a redundant contract.

## Retained PayPal fixture correction

The first 79-declaration full run exposed an extra failure in unchanged
`tests/paypal-trial-activation.test.ts:1295`. Two separate Date.now samples can
produce different proof timestamps; production correctly rejects that invalid
fixture. Deterministic ticking-clock control fails before the fix for the exact
"PayPal trial authorization proof unavailable" reason. Capture one confirmedAt
for both fields in that case and the adjacent canceled-snapshot replay-refusal
case. Both pass under the same ticking clock afterward. The production parser,
API admission/writer guards and every assertion remain unchanged. This improves
fixture validity rather than weakening the payment contract; no new declaration.
