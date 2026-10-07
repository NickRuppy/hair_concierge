# Bondbuilder implementation receipt — 2026-10-02

Status: **local implementation, component verification and review complete; not production/ship-ready**. No commit, push, PR, merge, deployment, migration apply, catalogue mutation or activation was performed.

## Scope and review identity

- Task worktree: `/Users/nick/.codex/worktrees/bondbuilder-research-engine/hair_conscierge`, branch `codex/bondbuilder-research-engine`.
- Refreshed base: `3abfe00a7843882f01009de701affa7b1dff697f`. The task safely fast-forwarded from `fae51dbf72b68de8849190b8b15b459b86f9ecf0`; existing task research was preserved. Root checkout remained clean `main`.
- Review covers all modified and task-owned untracked content, not just the empty committed branch diff. [Canonical manifest](canonical-content-manifest-2026-10-02.json): **211 paths**, final SHA-256 `3381830c9a9df25a5cef5f0f2bbf18bd702546bddcd7bbb8803ba987b65f3c08`. Only this receipt and the self-referential manifest are excluded verification metadata; source, migration, tests, plans, research and retained raw packets are included. The counterpart reviewed fingerprint `ec9af3e6cce6514d1d1dde39c1e54a2534a07e6fcfaff2b642541ad8afef4e71`; the main session reviewed the bounded fixes/documentation delta below and reran affected suites plus full CI.
- Authority: Nick's “okkk do ittt” authorizes the [approved local plan](implementation-plan-2026-10-02.md), verification and staged eight-product package. Separate method-lock, publication, migration and production-write gates remain intact.

## Delivered locally

1. Strict, versioned full research profile and formula/source-bound production adapter. All research properties and provenance are retained; truthful usable fields are projected without inventing obsolete intensity/axis values. English stored facts and German explanation fields remain distinct. Scientific evidence, practical resonance and owner trust rulings are not represented as guaranteed efficacy.
2. Additive four-field spec storage, guarded profile-only enrichment RPC, owner-scoped low/default intake RPC and compatibility constraints. Existing product spine, fit approvals, old spec values and executable guidance are preserved by transactional compare-and-swap checks. Ordinary approval still requires an executable protocol. Unsupported guidance can remain held while owner research is saved with `is_recommended=false`.
3. Source-bound generic application/cadence projection and actual compiler/reader integration: K18 optional conditioner after the full four-minute wait, epres starting dilution/minimum wait/overnight/wash sequence, and Première shampoo layering. Unknown/conditional cadence stays explicit; no new wash schedule, tier-based ranking or extra conditioner purchase.
4. Bounded research context reaches the actual chat selection projections. Admin readers preserve source-managed profiles; profile writes use the guarded service RPC only after existing admin authorization. No new customer tier badge, comparison screen or deeper Routine Plan UI.
5. [Eight-product staged package](owner-batch-2026-10-02/manifest.json): eight validated profiles, 43 retained source records and 23 hashed original source files. This is consolidation of the reviewed research, **not a new blind classification run**. All eight have `publish_ready=false`; none was bound or applied to a live product.

The preserved grades are high for OLAPLEX No.3 PLUS, K18 and epres; medium for Elvital Bond Repair, the selected Redken acidic bonding concentrate source-version and Kérastase Première; low for OGX and Aveda. New resolved eligible identities default low/owner-default, not recommended. A technology comparison cannot transfer an owner's grade, application protocol or efficacy claim.

The synchronized v0.5 method package is prepared but unsealed. Current v0.4 pins authenticate provisional fixtures only. Automatic engine routing remains disabled, enforced by the server-owned worker gate after model output: both unsolicited envelopes and direct new profile/scalar fields are held. Explicit offline projection stays available. The legacy research route remains authoritative until explicit lock/activation.

## Actual verification

Tests use Node's repository runner, not Vitest:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=test-only-not-a-secret \
node --import ./tests/server-only-register.cjs --import tsx --test <paths below>
```

The dummy environment permits imports; these suites do not connect to live Supabase. Results below are separate suite runs with overlapping tests, not an additive unique-test count.

| Check | Observed result |
| --- | --- |
| `npm run ci:verify` | Exit 0: typecheck, lint and optimized Next build passed. Lint has zero errors and five existing warnings in unchanged files. |
| Adapter, batch, application/cadence, chat and catalogue regression paths below | 263 tests passed, zero failures/skips. |
| Actual owner review/dry-run/approve transport and sibling intake paths below | 99 tests passed, zero failures/skips. |
| `tests/bondbuilder-research-storage-postgres.test.ts` | 36 tests passed, zero failures/skips: actual migration/approval-chain PGlite bodies, including 21 scan-chain sibling tests. |
| Frozen v0.3 verifier, `--complete` | 56 hashes; eight products; 34 sources; six lane JSON files; no blind leakage or activation. |
| Frozen v0.4 verifier, `--complete` | 60 hashes; four products; 12 sources; full-family holdout and method lock remain false; zero DB writes. |
| `node plans/bondbuilder-research-engine/verify-review-draft.mjs` | Eight review rows, 12 files, 94 links, no issues; no classification run or production write. |
| `git diff --check` | Passed. |

Regression paths: `tests/bondbuilder-production-adapter.test.ts`, `tests/bondbuilder-product-intake-adapter.test.ts`, `tests/bondbuilder-owner-batch.test.ts`, `tests/bondbuilder-protocol-projection.test.ts`, `tests/personal-plan-stage5-v2-builder.test.ts`, `tests/personal-plan-stage5-compiler-v2.test.ts`, `tests/personal-plan-routine-cadence.test.ts`, `tests/personal-plan-stage5-catalog-facts.test.ts`, `tests/personal-plan/products/stage3-catalog-facts.test.ts`, `tests/agent-select-products-tool.spec.ts`, `tests/agent-v2-product-selection.spec.ts`, `tests/personal-plan/categories/bondbuilder.test.ts`, `tests/catalog-authority-audit.test.ts`, `tests/catalog-authority-audit-reader.test.ts`, `tests/admin-product-support-specs.test.ts`.

Owner/sibling paths: `tests/product-intake-review-workflow.test.ts`, `tests/product-intake-review-scripts.test.ts`, `tests/bondbuilder-product-intake-adapter.test.ts`, `tests/product-intake-review-app.test.ts`, `tests/product-intake-research-package.test.ts`.

Transient logs: `/tmp/bondbuilder-ci-final.log`, `/tmp/bondbuilder-regression-final.tap`, `/tmp/bondbuilder-owner-flow-final.tap`, `/tmp/bondbuilder-sql-final.tap`. The final parent reruns are the evidence above; worker or earlier intermediate output is not substituted.

Guard regression cases exercised during implementation include malformed/hash/source/identity refusal, actual SQL preimage/tamper/replay preservation, low/default origin isolation, non-empty protocol refusal on the held-owner path, unchanged strict ordinary approval, both OLD and NEW dependency IDs on deferred trigger updates, optional-conditioner compiler semantics and filtering uninspected creator leads from chat citation URLs. The parent observed failing guards while integrating, fixed supported defects, and reran the relevant owners plus final suites. A further real TS/SQL differential test failed on producer-page non-breaking whitespace, then passed after SQL was aligned with the existing ECMAScript whitespace/trim and locant-lookahead contract. It exercises 15 ingredient-string fixtures, including ordinary/adjacent locants, parenthesized commas, separators, suffixes, NBSP/narrow-NBSP/BOM and malformed brackets. This is compatibility evidence, not a new product research run.

## Review and decision revalidation

Main-session correctness and structural lenses cover the effective writers/readers, client/server crypto boundary, legacy/null compatibility, owner authority, SQL migration lineage/CAS/replay, deferred dependency moves, source-bound protocols and full property retention. Structural review is warranted by the migration, transactional workflow and shared compiler changes.

One Claude whole-tree read-only advisory review completed with wrapper exit 0 (`claude-opus-4-8`, effort `high`), against the exact base and including untracked implementation. Advisory verdict: **no hard defects found**. The shell was not configured for API-key billing. The main session verified/adjudicated every material observation; reviewer-run checks are not substituted for the parent reruns above.

| Review item | Main-session ruling |
| --- | --- |
| Profile-only admin preimage equality can reject different representations | Verified fail-closed exact-spine check. The current form omits source-managed profile edits; timestamps cited as a hypothetical are not parsed product payload fields. Retain the conservative comparison rather than add speculative coercion. Actual route transport/browser coverage remains an explicit verification gap before real use. |
| Deferred triggers add per-row probes to hot identifier/protocol tables | Verified indexed profile probe and early exit for profile-free products. No throughput measurement was performed. Retain the constraints; batch-scale performance/concurrency rehearsal remains a pre-apply check rather than a silent architecture change. |
| Hand-mirrored INCI parsers need differential coverage | Accepted. The suspected adjacent-locant mismatch did not reproduce in the fixture; NBSP did. Fixed SQL whitespace/trim and lookahead to match the existing TS algorithm. Observed RED `/tmp/bondbuilder-inci-differential-red.tap` (one failure), then GREEN `/tmp/bondbuilder-inci-differential-green.tap` (one pass), and reran the entire 36-test SQL chain. Frozen source/formula bytes and owner pins were not changed. |
| Two-session races / actual admin route transport not exercised | Accepted existing limits; neither is labelled passed. |
| Main-session post-review activation audit | Fixed a genuine gate weakness: mere prompt metadata did not prevent an unsolicited model envelope from invoking the provisional adapter. The live worker now calls a server-gated wrapper for every Bondbuilder result; direct new fields also cannot bypass it. Three new tests prove disabled-envelope/direct-field holds and unchanged legacy output. Pure offline adapter tests still pass. |

The post-review delta is bounded compatibility enforcement, regression tests and documentation/command corrections; it changes no architecture, permissions, trust decisions or live authority. The main reviewed the delta and its callers, reused unchanged advisory conclusions and reran affected suites plus full `ci:verify`; no second counterpart run solely for a cleaner verdict. **No blocking local code findings remain.** Raw advisory output and invocation log are archived outside the repository at `/tmp/bondbuilder-review-archive.7YI0xD/` (recoverable, not deleted).

Original coverage acknowledgement is retained in the approved plan. Current internal revalidation keeps both requested outcomes, all eight targets, the owner's grades, producer-backed facts, full retention, low/non-recommended defaults and existing Routine Plan depth. No new product/UI/ranking decision is silently selected. Exact source-market binding, method lock and live authority remain real dependent gates, not missing approval-record formatting.

## Verification limits and next gates

- **Live SQL prerequisite:** read-only inspection found the shared guidance binder absent. [Live function-lineage receipt](live-sql-lineage-2026-10-02.json) records the observation. Reconcile the migration ledger and exact effective function bodies, including `20260929230000_expansion_protocol_binding_repair.sql`, before the prepared Bondbuilder migration. Its explicit fingerprint guard must refuse incompatible lineage. MD5 definition observations do not replace SHA-256 body guards.
- **Exact products:** the bounded live snapshot found three active anchor candidates and two deprecated OLAPLEX predecessors; the other five targets were not found in that bounded search. Candidate UUIDs are not binding approval. All eight profiles intentionally retain `identity.product_id=null`; package/market/formula/source match and fresh full preimages remain necessary. No deprecated predecessor was selected or reactivated. Five new rows still need their ordinary commercial/image/origin/publish packages.
- **Method lock:** real unused-positive validation covers one of five families, plus two ordinary-repair controls and one unfamiliar technology. Synthetic compatibility tests do not fill this gap. Complete the bounded missing-family pass or bring its exact shortage/limited-lock alternative to Nick; do not silently waive it.
- **Specific fact holds:** K18's selected source does not establish an exact anatomical application area; its newly projected protocol remains held while existing approved guidance is preserved. Selected local cadence/format/market gaps remain explicit in the individual profiles. Missing research fit does not erase existing approved fit on the three anchors or invent fit on new rows.
- **Browser:** the task-owned admin page reached the expected authentication gate. No authenticated changed-profile flow was observed. The environment points to production Supabase; dev login would seed it and was not used. The browser runtime was initially unavailable, and the static Lab fallback then hit an error-page URL-policy failure; these are not counted as browser passes. Temporary task-owned dev servers were stopped; existing Lab artefacts remain unchanged.
- **Chat eval:** `npm run test:chat` was not run. Its setup/cleanup writes auth users, profiles, subscriptions and usage against the configured database (`scripts/eval-chat/client.ts:118,134,141,190,295`). An isolated local database or explicit write authorization is required. Contract/regression suites passed, but they are not a live chat-eval substitute.
- **Concurrency/load:** actual single-connection SQL tests prove checked transitions/atomicity, not two-session lock/interleaving behavior or hot-table deferred-trigger batch throughput. Local PostgreSQL concurrency and realistic batch-load rehearsal remain pre-apply checks.
- **Customer wording:** staged German explanatory copy remains a reviewed-publication gate, not authorization for unseen badges or stronger efficacy claims.

Next operational sequence: resolve method/identity and live-lineage prerequisites → obtain appropriate explicit migration authority → isolated browser/chat/concurrency verification → fresh item-level dry-run and preservation readback → separately authorized catalogue apply → separately activate the locked submission engine. Publication/merge/deployment are not inferred from local implementation approval.

## Artifact disposition and bottom line

Durable source, migration, tests, plan, research corpus, English Lab and staged raw receipts remain task-owned and commit-intended in this worktree. Nothing is staged, committed or published by this turn. Ignored dependency/build/local environment files remain local. Transient review output is archived outside the repository as above; test logs remain in `/tmp`. The root checkout is not a cleanup target; the task worktree and uncommitted artefacts are retained.

**Verdict: local components implemented, tested and reviewed; no blocking local code findings; not production/ship-ready.** The eight database enrichments and automatic research engine are prepared, not live or activated. Missing live prerequisites and verification evidence above must be resolved before their dependent actions.
