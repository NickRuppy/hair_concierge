# Oil intake integration — 2026-10-16

## Outcome and authority

Make the existing Oil research engine usable by incoming Product Intake jobs on the same category-owned path as Leave-In, using the approved recurring minimum in `docs/research/oil-inci/v1.0/01_property-set-v0.4.md` and classification v0.10. Preserve manual matching approval. Fix PR #690's stale expected Oil request profile in its own worktree.

This is implementation and verification only: no deployment, production migration application, queue claims/retries, product publication or merge.

## Decision coverage — confirmed

- **Confirmed with Nick:** on 2026-10-16, “do that integration pass and fix the CI failure too. Use subagents, keep matching tags manual ... Don't deploy yet.” Earlier approvals locked base, weight, persistence, supported uses, heat, UV and five ingredient flags as the recurring minimum; richer optional research may be retained.
- **Inherited:** adapter owns only weight, supported fibre uses and heat protection. Matching suggestions need explicit manual approval. Research, review approval, catalog publication and deployment are distinct gates. Existing v0.8/v0.9 records and their identities, method pins and bytes remain historical evidence.
- **Implementation defaults:** work on fresh `codex/oil-intake-integration` from main `80b963a2`; preserve the source worktree; add a separately versioned current v0.10 contract and retain legacy read compatibility. Derive hashes server-side; retain exact submission, identity, formula, source and method binding. Keep normal image, brand, protocol and publication gates. No new recommendation criteria or user questions.
- **Open consequential assumptions:** none. Pre-wash/scalp-only exclusions retain their existing explicit scope boundary.
- **Coverage acknowledgement:** the exact request above approves this bounded integration; no new property decisions are implied.
- **Internal revalidation:** 2026-10-16, initial source audit identified executable v0.8/v0.9 versus normative v0.10 drift, inactive routing and absent deployed files. These are the scope of this pass. Undiscussed consequential assumptions affecting this handoff: none.

## Integration journey

An incoming oil submission uses the server-pinned category engine. Research derives the approved properties from the exact formula and reviewed maker/source directions, then the adapter supplies the three canonical specs. The existing Lab shows the current research fields and projection. Matching suggestions remain separately reviewable and require human approval. Stale methods, identity/formula mismatch, incomplete evidence or missing required review reject admission/publication with the existing recoverable review flow. Historical Lab records remain viewable under their original contracts. No new user flow or visual design is introduced; this implements the already approved Lab journey.

## Ordered work and ownership

1. Carry forward the Oil engine, reference/evidence, shared Lab and intake binding from the old Oil worktree, excluding Chat selection changes already isolated in #690. Merge shared files against fresh main; preserve new Mask/Leave-In and review safety behavior. Record carry-forward manifest and source hashes.
2. Add current v0.10 fresh research contract, policy pins, explicit producer schema/prompt and projection. Required property values are committed; missing evidence causes admission refusal rather than invented defaults. Preserve historical v0.8 and local v0.9 readers. **Produces:** current typed draft/envelope, current method tuple and projection; **consumed by:** worker and Lab.
3. Connect the current method to the real category registry and job admission. Preserve server-derived hashes, separate source/identity context and stored review binding. Regression proof must use the actual registry path rather than candidate-only injection.
4. Align Lab rows and publication review binding with current required properties while retaining legacy rows. Test that approving properties alone does not approve matching or publish, and that stale/tampered receipts fail. **Consumes:** versioned envelope/method; **produces:** bound human review receipt only.
5. Fix #690's stale exact test expectation without changing runtime semantics; record red/green evidence in that worktree.
6. Run focused combined tests, typecheck and scoped lint through the shared verification gate; exercise a fresh submission → projection → Lab review handoff with local fixtures. Inspect production migration state read-only when available; never apply it. Run Claude plan and final code review, resolve verified findings and retain a matching content receipt.

## Verification and disposition

Primary behavior owners: current Oil contracts/fresh intake, real worker routing/admission, Lab API/review, publication binding PostgreSQL/PGlite, shared category regression tests, and the failed recommendation category suite in #690. Freeze hashes of historical data/documents before transfer and compare afterwards. Use hosted CI for broad coverage when publication is authorized; do not duplicate local broad suites.

New engine code, required source/reference data, current and historical contracts, integration plan and final receipts: commit candidates. Original old worktree: retained untouched. Transient Claude reports: outside the repository. No database or host changes. Stop with reviewed, verified integration and clear deployment prerequisites; deployment remains explicitly forbidden in this pass.

## Concrete interfaces and targets

- Current `CurrentFreshOilResearchDraft` / `CurrentOilResearchEnvelope` use `oil-research-envelope-v2`; `OIL_INTAKE_METHOD` is `v0.10/oil-production-adapter-v1`. Legacy `LegacyOilResearchEnvelope` remains v1 with original consolidation/v0.8/local v0.9 pins. `assembleFreshOilResearchEnvelope` derives preserved record hashes; `applyOilResearchAdapterForWorker` accepts only the current tuple.
- Runtime owners: `src/lib/oil-research/{contracts,registry,storage,production-adapter}.ts`, `src/lib/product-intake/oil-research-{adapter,prompt-contract}.ts`, `src/lib/product-intake/category-research-router.ts`, `src/lib/product-intake/pipeline/inci.ts`, `scripts/product-intake/codex-research-worker.ts`.
- Review owners: `src/lib/oil-research/{lab-package,candidate-package,review-state}.ts`, `src/lib/labs/research/**`, `src/app/{api/labs,labs/research}/**`, `src/components/labs/research/**`, `packages/product-intake-core/src/oil-review-binding.ts`, Oil review migrations and existing approve/review-decision guards.
- Discovery/operator integration: `.agents/skills/product-research-engine/SKILL.md`, `docs/research/README.md`, Oil README, `docs/product-intake-oil-production-adapter.md`, `docs/labs/oil-research-lab.md`, `.gitignore` for local review stores, and npm Oil CLI commands. Current main Mask/Leave-In behavior stays in the merge.
- Source/evidence transfer is recorded in `plans/oil-intake-source-transfer-2026-10-16.json`; transferred research and reference bytes remain unchanged. Explicit exporter/record-resolution dependencies retain their original paths.

## Counterpart plan review reconciliation

Claude's read-only plan review approved the technical direction with revisions. Accepted: give concrete target/interface/verification maps; fix unapplied migration chronology; name the separate #690 output. Oil baseline and successor migrations must both sort after the live ledger maximum `20261015200636`; preserve the baseline SQL content, generate ordered names locally and apply neither.

No new user decision is required for the proposed forks: Nick repeatedly approved manually drafted matching tags with explicit approval, so automatic eligibility derivation is explicitly outside this contract, not unresolved. The impact of eventual catalog publication is already guarded and publication is not authorized here. Code-constant category registration follows the requested Leave-In integration pattern and is authorized by “do that integration pass”; deployment remains explicitly forbidden. Adding a new runtime flag is unnecessary scope. The reviewer inspected a moving implementation tree and its inactive-registry description predates the completed registration; this does not change the recorded approval.

The #690 correction is a separate test-only change in `.worktrees/chat-oil-facts`, `tests/recommendation-engine-categories.test.ts`, with its own `plans/oil-inci/chat-oil-facts-alignment-2026-10-16-ci-fix.md`. The failed expectation omitted `weightRequest: light`; `coding-check --node-tests tests/recommendation-engine-categories.test.ts` failed 46/47 before and passed 47/47 after.

## Exact verification plan and red evidence

- Actual registry regression: `npm run test:focused -- --test-name-pattern='incoming oil jobs bind' tests/product-intake-category-research-router.test.ts` failed with zero RPC bindings before installation, then passed after current Oil registration. No test-only candidate injection remains.
- Combined owner checks: `npm run test:focused -- tests/oil-*.test.ts tests/product-intake-category-research-router.test.ts tests/product-intake-pipeline-inci.test.ts` (use actual existing INCI owner filename), plus shared Lab category/API/DOM tests. Expected: zero failures; record exact final counts rather than guessing them in the plan.
- Current scope: `tests/oil-current-intake.test.ts`, `tests/oil-current-lab.test.ts`, `tests/oil-current-review-binding.test.ts` protect current11property admission,13review rows and separate matching approval; legacy tests retain original17rows and exact tuples.
- Local SQL proof: use both ordered Oil migrations in PGlite and `OIL_LAB_POSTGRES_TEST=1` with `tests/oil-lab-publication-postgres.test.ts` for real two-session locks, rollback and privileges. No live database writes.
- Run `npm run verification:plan -- --files <changed executable paths>`; unknown new paths receive explicit owner review. Run repository-gated typecheck and scoped eslint, `git diff --check`, and browser inspection on this worktree with temporary copied state/bundles.
- Recheck historical transfer hashes, live migration ledger (SELECT only), no deployments/production writes, and final canonical content fingerprint. Claude whole-branch review is read-only, terminal and outside the repo; incorporate verified findings and refresh only affected checks.

## Completion and publication scope

All implementation slices are complete. The actual registry test has a red/green receipt; an isolated mutation of the required-evidence guard makes the existing owner test fail for the intended unreviewed-boolean case. The unchanged repository guard passes. Final combined Oil/Lab verification is 145/145, including real PostgreSQL; worker/registry/INCI/Mask/admin checks are 107/107. Root, core and review-cockpit typechecks pass. Browser QA used a hypothetical temporary bundle and temporary journal, proving independent weight approval and blocking manual matching rework. No actual cohort approval was changed.

The earlier request to prepare the oil work as a draft PR continues to authorize commit, push and draft publication. #690 already contains the separately reviewed chat slice; this integration receives its own draft PR to preserve that separation. No merge, deployment, migration application, queue claim/retry or catalog publication is authorized. The old source worktree and root main remain untouched by implementation.

Artifact disposition: engine/reference evidence, historical dependencies, approved Lab machinery, current integration code/tests/migrations, this plan and final receipt are commit candidates. The source-transfer manifest records exact source hashes and the renamed unapplied baseline migration source path. Historical assembly is excluded from automatic formatting because its bytes are pinned in the immutable candidate bundles. Transient Claude outputs and command logs remain outside the repository; temporary browser state stays under `/tmp` and the QA server/tab will be stopped. Reviewer suggestions about reporting hashes and redundant reads are non-blocking; no unused refactor or new matching policy is introduced.
