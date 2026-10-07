# Bondbuilder bounded method / intake finish

Date: 2026-10-02. Worktree: existing `codex/bondbuilder-research-engine`, starting head `317aa78065c3d3016babf873b5362ea86d7b7ff7` (draft PR #635). Clean at intake.

## Outcome and scope

Finish the reusable prompt/schema contract, execute a fresh immutable validation replay, and prepare the operative intake branch without changing the settled category, owner grades, low/non-recommended default, routine UI or ranking. This supplements [the implementation plan](implementation-plan-2026-10-02.md); it does not repeat completed storage/compiler work.

No Docker, new infrastructure, new efficacy research program, product promotion, live writes, deployment, merge or notification. Current live migration/exact-product binding gates remain. Publication updates follow existing authorized draft-PR handoff only after matching checks/review.

## Decision coverage

- Confirmed with Nick: continue the three-step finish pass; use subagents; keep the work proportionate to the small category. All earlier property/application/owner/default decisions remain approved.
- Inherited: immutable history, blind formula-first observations, product truth separate from fit, inspected-source closure, exact owner bindings, no technology-to-trust inheritance, server-owned activation and guarded publish. Historical v0.4 profiles must remain readable/replayable.
- Technical defaults: preserve legacy pins and add an explicit versioned pin registry; exact release tuples rather than independently accepted hashes. Keep the live gate off. Select the full research prompt only in the prepared engine branch; disabled live intake retains its ordinary contract.
- Open consequential choice, resolve before method lock: a narrowly locked release using five-family pilot regression plus the four known-outcome test products and explicit edge fixtures, versus four additional genuinely unused family-positive identities. The previous plan requires Nick's decision for this precise coverage shortage. A non-blocking question is outstanding; no limited-lock approval is inferred.
- Coverage acknowledgement: Nick said “Okay let's do it… category … a lot smaller… continue and do it, use subagents” after the comparison and bounded finish recommendation.
- Internal revalidation: read-only method and intake audits confirmed the disabled gate, singleton v0.4 TS/SQL pins, complete profile carrier and old worker intensity/axis contract. No hidden property/ranking choice was introduced.
- Undiscussed consequential assumptions: none for independent preparation; the explicit coverage decision blocks lock and activation.

## Integration journey

No new customer surface/copy/timing. Resolve exact identity and freeze sources → blind formula observations → named source-bound facts/default policy → strict full envelope → deterministic compatibility projection → existing review and separate publish gates. Prepared engine intake uses envelope-first instructions; disabled live intake remains legacy-compatible. Unknown technology is held for category review. Research-only unknowns are retained, not guessed into routine protocols.

## Deliverables and ownership

1. Main: synchronize a self-contained v0.5 release-candidate standard/runbook/prompt/blind guide with the existing wire and source rules. Freeze them with exact anonymous/named packets and source-lineage hashes in a new run directory. Original v0.1–v0.4 files and eight owner envelopes remain byte-identical. Check: old corpus verifiers and new freeze verifier.
2. Two sealed independent validation lanes (fresh context): first anonymous observations, seal both, then named research extraction. Prepare the eight-product calibration regression and four known-outcome replay inputs independently; final lock uses that scope only if Nick selects it. If he instead requires new positives, source/freeze the four uncovered-family identities before claiming that wider validation or lock. Main compares/adjudicates outcomes, source/unknown/timing and wire representations; report denominators honestly. Check: new run verifier and strict schema/adapter acceptance/refusal for actual profiles.
3. Bounded worker: detailed schema-derived prompt contract and conditional worker instructions; no legacy intensity/axis request in the engine branch. Main owns release pins. A narrow acceptance registry retains historical v0.4 and candidate v0.5 without mix-and-match pins. New engine submissions must use current release; offline/history may use v0.4. Gate remains off until separate rollout prerequisites/authority are satisfied. Check: real prompt-packet tests, wrong-version and submission-binding refusal; legacy-disabled behaviour unchanged.
4. Main / SQL worker: admit exact whole pin tuples in `registry.ts`, the TS adapter and the SQL validator together. Preserve `BOND_METHOD_PINS` as historical v0.4; add current v0.5 and an explicit two-version allowlist. Mixed hashes must fail in both TS and SQL. The existing storage migration is committed in an unmerged draft, not deployed; fresh target ledger again confirms `20261002132306` absent. Fold this preparatory validator change into that unapplied migration, rather than invent a second migration/setup solely for the same draft. Keep privileges/validation semantics unchanged. Actual PGlite chain proves old/new roundtrip, mixed/wrong pin refusal, TS↔SQL parity and data-preserving rollback. No live SQL.
5. Main: make the lock receipt only after coverage decision and actual validation support it. Update method/index/router/bridge status to what is achieved. No “active” labels before rollout. Run focused and full checks, ready-check and one read-only counterpart review; refresh exact content receipts before authorized draft publication.

## Test-first / acceptance

Use the repo's Node test runner with existing server-only registrar, `tsx` and dummy localhost Supabase values. No production login/chat seeding. Protect behaviour at the strongest boundary, not source-string inventories: actual prompt packet, adapter output/holds and real SQL validators. Record red proof for method-version acceptance and obsolete prompt fields before implementation.

Run production/intake adapter, owner-batch, research-storage PostgreSQL, product-intake jobs/review and scan-expansion sibling tests; all frozen verifiers; `git diff --check`; `npm run ci:verify`. Actual new release inputs must pass the CLI with no input mutation/overwrite and correct readiness holds. Two-session/authenticated live checks remain unproven without an approved safe target; no mock is called E2E.

## Review and stop

One read-only Claude plan review, effort high; main verifies every finding. Later whole-branch review covers the meaningful delta plus cross-version/SQL and prompt caller contracts. Transient reports/logs stay outside the repository; plan, source packet, new immutable outputs, release docs and receipts are commit-intended.

Stop dependent lock if the coverage choice remains unresolved; finish independent authorized preparation. Stop before live migration, catalogue apply, activation/deployment or merge. A completed prompt/replay is not proof of those operations.

Self-review: both requested outcomes retained; no fabricated new holdout, scope waiver, guessed legacy value, source upgrade, hidden promotion or infrastructure work. All interfaces and historical/live boundaries above are explicit.

### Counterpart adjudication / target map

Read-only Claude plan review (Opus 4.8, high) approved with revisions, no hard blockers. Accepted: name all three pin enforcement sites, add TS mixed-tuple and SQL parity proof, and make wider validation contingent on Nick's coverage decision. Corrected the inaccurate “published migration” wording. Reviewer proposed asking Nick about append-versus-fold: rejected as a consequential product decision here; the ledger confirms the same draft migration is unapplied, the prepared schema/privileges do not change, and folding is normal owner-controlled authoring with no production action. If any target application appears before edits, stop and revisit migration lineage.

Concrete targets: `docs/research/bondbuilder-inci/v0.5/{standard,runbook,researcher-prompt,blind-instructions}.md`; `data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/`; create-only `scripts/bondbuilder-research/build-method-replay.ts`; version registry/TS adapter; existing storage migration; full-profile prompt and worker; strongest-owner tests. History verifier checks original input/source hashes, not file presence. October 3 continuation preserves two abandoned preparatory freezes: the first detected shared-source drift, r2 exposed missing closed Stage A serialization labels. Neither dispatched a sealed classification; r3 corrects the source preparation without rewriting those snapshots or historical v0.4 results.

Focused command: `node --import ./tests/server-only-register.cjs --import tsx --test tests/bondbuilder-production-adapter.test.ts tests/bondbuilder-product-intake-adapter.test.ts tests/product-intake-research-jobs.test.ts tests/bondbuilder-research-storage-postgres.test.ts` with dummy localhost import values. Final historical run verifier command: `node --import tsx scripts/bondbuilder-research/verify-method-replay.ts --complete --frozen-only`. The explicit frozen-only mode reports the later current-prompt clarification rather than pretending those researchers saw it.

## Execution and current decision revalidation — 2026-10-03

Original user acknowledgement is preserved above; current internal check finds no new category, tier, promotion, ranking or customer-UI choice. Whole historical/current method tuples pass TypeScript/SQL parity and mixed tuples fail; wrong fresh-submission method/submission IDs are held. Disabled live routing and legacy contract remain unchanged. Live single-SELECT inspection again confirms both target migration IDs unapplied and the research-profile column absent; no DDL or catalogue mutation.

Both lanes sealed 12 anonymous and 12 named outputs. Eleven uncontaminated policy tuples agree; V04 excluded for prior verdict metadata in S13. These are eight known calibration products and four previously researched products, not twelve new holdouts. Original 24 schema-valid profiles all refused real projection. Exact casing-only amendment yields 16 projected/eight refused; producer-source overlay corrects all eight pilots (16/16 projected), without changing owner grades or identity/formula/fit. Final merged twelve-slot replay has 18 projected/six expected excluded/unresolved refusals. All publish/catalogue/global-recommendation flags stay false. Abandoned freezes, original failures and first source-overlay shortcomings are retained, not overwritten.

Main reviewed the typed 56 fact/24 metadata patches, source-market limits and dependent reasoning/hold changes. Repairs have real boundary proof: missing prepared reference encoding, S13 verdict leakage, ignored CLI run argument, and hashing before P06's final hold mutation all demonstrably failed their guards then passed. Existing adapter refuses original shared-marker casing and missing P05 role; amended CLI projects them without relaxing validation. Source/preimage tampering and overwrite are refused before new writes. The frozen run now passes complete verification with 295 inventoried files; later working prompt drift is explicit. Detailed [findings](../../data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/findings.md) own the limitations.

The coverage choice remains pending: no owner lock/activation is inferred. Authentic browser/chat and multi-session database checks remain rollout blockers without an approved safe target. Independent local preparation and candidate-review publication can finish while those gates remain visible. No Docker or additional infrastructure was used. Current exact-tree tests/review/fingerprint and publication receipt are recorded separately after final checks.
