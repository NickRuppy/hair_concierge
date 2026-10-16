# Finish Shampoo intake integration and refresh the engine index

## Outcome, authority and decision coverage

Nick requested: “finish the Shampoo integration in PR #693 and refresh the engine index. Use subagents, keep matching tags manual and don't deploy yet.” Finish the existing reviewed v1.6.2 staged-engine implementation as a reviewable draft with synchronized living guidance, preserved Oil integration, focused evidence and hosted CI. Implementation, corrections and publication to existing #693 are authorized; merging #691/#693, closing #682, applying migrations, live model runs, queue mutations, catalog approval and deployment are not.

Decision coverage: confirmed. Confirmed with Nick: current request; existing one isolated routine lane plus shared Sol and his approval, two lanes for validation, D2 retains regular Shampoo research and asks about a second listing, immutable assessment reuse within six runs/45 minutes. Inherited: exact method/source/formula/cycle bindings, atomic completion, manual matching approval, frozen method artifacts, separate production activation. Defaults: reuse clean task branch; reconcile current main while preserving the separate #691 dependency; prepare an explicit unapplied successor migration rather than modify #691's reviewed SQL. Open consequential assumptions: none for this code-completion scope. Coverage acknowledgement: the request quoted above. Internal revalidation: branch and PR identities checked before edits; current main is 412ec3bd (Oil and Chat merged), #691 remains open, #693 was 3cfc2efb stacked on75da3b16. No undiscussed consequential assumptions affect this handoff.

## Concrete repairs and ownership

1. Preserve both active Shampoo v1.6.2 and Oil v0.10 in registry, normalization, source evidence and worker completion while merging current main. Router lane owns its four conflict files/tests; main owns worker conflict and final integration. Immutable historical source and method bytes stay untouched.
2. Missing engine-binding RPC must fail closed for Shampoo, rather than continue an unbound staged run. Existing compatibility fallback for older category paths stays unchanged. Existing owner-boundary test gets a red-capable missing-RPC rejection case; main runs it red before changing binding behavior.
3. The #691 completion RPC atomically inserts evidence, but the merged Oil path previously needed identity/property IDs returned by separate appends. Preserve both contracts by allocating those two IDs on the server before completion, updating Oil context JSON/digest and draft binding, and passing IDs into the same atomic RPC. Add optional artifact IDs in the core serializer and a generated successor migration `20261016131141_product_intake_atomic_artifact_ids.sql`. Copy the exact existing completion function/signature with only ID allowlist/type/insert changes; preserve lease/cycle/deadline/budget/idempotency/outbox guarantees, service-only privileges and id-less compatibility. No separate Oil artifact/preview writes are allowed. The SQL lane owns core serializer, successor migration, SQL owner test and one-line test-chain registration; main owns worker/Oil preparation and its real owner-boundary evidence.
4. Retry of identical Oil completion must reuse server-allocated IDs within the same prepared output; no model-authored ID is trusted. SQL owner evidence covers actual ID persistence, references, mixed id-less rows, duplicate/invalid ID rollback, stale lease, exact replay and changed-request refusal. Worker owner evidence covers validated identity/context/digests and one transaction request, including no append fallback on storage failure.
5. Docs lane owns only the engine index, research skill router and Shampoo bridge guide. Current versions: Shampoo candidate v1.6.2, Conditioner v1.6, Leave-in v1.2, Mask v1.0, Bondbuilder bounded v0.5, Oil v0.10. Separate code wiring, research lock and running deployment. Four other supported categories retain ordinary research contracts, Styling remains concept/calibration outside the ten-key registry. D2 retains ordinary Shampoo research; no automatic second listing/rerouting. Historical Oil notes are explicitly superseded by their current header, not a defect to rewrite.

## Verification and stop contract

One heavy local job at a time through the shared gate; current Scanner owner has the slot. Queue focused red proofs, then apply corrections and run combined affected owner/sibling tests, root/core/review-app typechecks as changed scope requires, source lint, and YAML/guide checks. SQL owner tests include isolated real PostgreSQL where supported; never use the production database for proof. Root main remains clean. No new UI or customer-facing flow is introduced; reuse the approved Admin journey.

Use Claude/high read-only terminal plan review for this compatibility repair and a final whole-branch review before push. Record exact content fingerprints and red/green commands in a completion receipt. Reuse prior unchanged v1.6.2 calibration/blindness/budget evidence. Publish only to the existing draft #693, preserving its separate #691 dependency. Its displayed stacked diff may include already merged main changes until the dependency is refreshed; review the semantic tree against current main and identify the dependency separately. Full workflow-dispatch checks verify this head; PR-event-only checks must run after separately authorized dependency merge/retarget before merge. The Scanner modal race is a separately owned issue; do not waive a failure or modify its behavior to manufacture Shampoo readiness.

#682's projector was adopted unchanged and its PR remains open; recommend supersession disposition when #693 is eventually merged, without silently closing it. Keep all release/backlog/cohort/Admin-publication work explicitly separate from this engine-code completion. Commit source/tests/guidance/this record and a matching receipt; transient logs and Claude reports remain under /tmp. No deployment, migrations, matching approval or catalog publication.

## Counterpart plan review disposition and exact proof

Claude/high found no hard technical blocker (`/tmp/shampoo-completion-plan-review.md`). Accepted: make completed-versus-pending work explicit, enumerate ownership and commands, and state the new migration-before-release gate. Rejected two proposed approval re-interviews: Shampoo v1.6.2 is not deployed, and its already-approved server-bound engine must not continue without binding; keeping Oil references valid inside the already-approved atomic completion is a necessary compatibility repair, not a new classification/publication choice. Oil is merged but likewise not deployed; no live behavior changes in this pass. Both repairs preserve Nick's stated contract, with no viable fail-open alternative under that contract.

The completed disjoint write scopes were: router lane — `src/lib/product-intake/category-research-router.ts`, `src/lib/product-intake/pipeline/inci.ts`, `tests/product-intake-category-research-router.test.ts`, `tests/product-intake-router-characterization.test.ts`; docs lane — `.agents/skills/product-research-engine/SKILL.md`, `docs/research/README.md`, `docs/product-intake-shampoo-production-light.md`; SQL lane — core `repository.ts`, generated successor SQL, `tests/product-intake-research-jobs-postgres.test.ts`, one-line registration in `scripts/product-intake/admin-alert-test-database.ts`; main — worker reconciliation, `pipeline/oil-completion.ts`, `tests/oil-worker-admission.test.ts`, records and final verification. All lanes are complete and main owns integration.

Red proofs: owner batch 50 passed / 8 failed for intended missing binding/refusal failures before worker fixes; SQL targeted case failed with old `invalid research artifact` as expected; disabling server-ID reuse makes the exact-retry owner case fail. Restored code passes 85/85 owner/SQL tests before the expanded sibling batch. The initial owner attempt's router parse error was corrected and is not counted as red evidence.

Concrete final checks, serialized by the shared gate:

```sh
CODING_TEST_CONCURRENCY=1 npm run test:focused -- tests/oil-worker-admission.test.ts tests/product-intake-category-research-router.test.ts tests/product-intake-shampoo-research-adapter.test.ts tests/product-intake-shampoo-research-stages.test.ts tests/product-intake-shampoo-worker.test.ts tests/product-intake-worker-heartbeat.test.ts tests/product-intake-worker-reliability.test.ts tests/product-intake-worker-review-cycle.test.ts tests/product-intake-research-jobs-postgres.test.ts tests/product-intake-pipeline-inci.test.ts tests/product-intake-router-characterization.test.ts tests/shampoo-production-light-adapter.test.ts tests/shampoo-production-light-calibration.test.ts tests/shampoo-production-light-cli.test.ts tests/shampoo-research-v1-6-2-lock.test.ts
PRODUCT_INTAKE_REVIEW_CYCLE_POSTGRES_TEST=1 CODING_TEST_CONCURRENCY=1 npm run test:focused -- tests/product-intake-review-cycle-race.test.ts
npm run typecheck
~/.local/bin/coding-check -- npm run typecheck --workspace @chaarlie/product-intake-core
~/.local/bin/coding-check -- npm run typecheck --workspace @chaarlie/product-intake-review
```

Scoped ESLint runs through the same gate on affected source/core/worker paths (explicit `--no-ignore` for otherwise ignored worker/core files); `git diff --check` applies to the owned delta, preserving immutable main-imported whitespace exceptions. Hosted full CI and Security are required on the final pushed head; no broad overlapping local suites. Before any future release, separately authorize and apply the ordered required migrations, including new `20261016131141`, before worker code.

## Final local completion and review

The final owner/sibling batch passes 222/222 with no skips; the two additional
Docker PostgreSQL concurrency suites pass 2/2. Root, core and review-app typechecks
pass. Scoped source lint has zero errors and six unchanged worker warnings.
Prettier confirms affected helper/core/worker/test source is already formatted.
The original #691 migration remains byte-identical. The stale characterization
assertion now pins the reviewed Shampoo v1.6.2 contract; no method was rewritten.

Claude/high reviewed correctness, data integrity and structural compatibility
against current main and found no blocking defects. Main verified the ID consumer
chain, SQL-only delta, same-reference retry boundary and parent migration bytes.
The only post-freeze delta was cloud-ops migration-order documentation, reviewed
by main; the final verification receipt fingerprints the resulting tree.
Transient reports and logs are retained outside the repository under `/tmp` for
diagnostics; task-owned source/tests/docs/plans and the receipt are committed.
Full exact-head hosted CI and Security follow publication to the existing draft;
PR-event-only checks remain required after the separate dependency merge/retarget.
