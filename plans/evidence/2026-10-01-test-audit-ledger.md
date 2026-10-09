# Test-pruning evidence

Archived first-batch evidence: the final tree now includes the continued
[retired acquisition audit](2026-10-01-retired-acquisition-audit.md). The coverage
receipt below verifies only the initial eight-declaration batch.

Baseline: `21e0e41fa996ec6a725c258ab3766971f0edb94d`.
Scope counted: `tests/` Node and Playwright declarations, excluding suites and
support files. Baseline 11,892 declarations; target 2,379 removals. This is a
targeted audit, not a declaration-by-declaration audit of the entire repository.
Discovery sampled owner boundaries and checked all exact same-body candidates.

## Outcome: target not achieved

The justified batch reduces declarations from 11,892 to 11,884: eight removed
(0.0673%), including two assertion-preserving consolidations. One additional
duplicate fixture row was removed. The 20% target requires 2,379 declarations;
2,371 additional removals remain unsubstantiated. This audit does not establish
that the remaining tests are all useful or that the target is impossible.

Test LOC: 15 added, 143 deleted, net 128 removed across eight paths (one file
deleted). Production/tooling LOC and separate test-support LOC: zero change.
No production simplification was unlocked. A broader owner-by-owner campaign
is the remaining work; deleting independent contracts solely to satisfy the
numerical target would violate the governing retention bar.

## Applied candidates

Locations below refer to the pinned baseline; deleted titles identify the exact
declarations independently of changing line numbers.

| Candidate                                                                                                                                    | Detectable failure and surviving proof                                                                                                                                                                   | History, callers and risk                                                                                                                                            | Cleanup / proof                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `personal-plan/categories/sentinel.test.ts:6`, “personal-plan category suite discovers nested tests”                                         | Only checks category count 10. `personal-plan/types.test.ts:12` asserts the complete ten-category order; recursive CI discovery does not depend on the sentinel.                                         | Added with `12619247`; types are used by Stage 1/compiler/editor/discovery. Low risk; count proof is strictly subsumed.                                              | Remove one file/declaration; retained types and CI orchestration tests.                             |
| `personal-plan/products/stage3-persistence-supabase.test.ts:3953`, “authority facts consistently use the derived irritation route”           | Exact same body/setup as “authority facts translate an irritation need into the stored irritated route” at :3915. Both assert the same selected irritation spec through `loadStage3AuthorityFactBundle`. | Authority catalogue era `23626d7d`; production Supabase persistence invokes the loader. Low risk; identical input and complete expected value remain.                | Remove one declaration; same persistence suite.                                                     |
| `personal-plan-start-resume.test.tsx:1254`, “NOT accepted + complete draft + frontier stage3, undirected: unchanged Stage 3 resume”          | Exact same body as “plan-start re-entry selects Stage 3 when refinement is complete and current authority exists” at :269.                                                                               | Original `12619247`, duplicated as a control in `4029faf0`. Production `/plan-start` uses the resolver. Low risk.                                                    | Remove one declaration; resume suite.                                                               |
| `personal-plan-start-resume.test.tsx:1277`, “NOT accepted + complete draft + frontier != stage3, undirected: unchanged Stage 2 fall-through” | Exact same body as “completed refinement remains at the Stage 2 bridge until Stage 3 authority is ready” at :325.                                                                                        | Same history/owner as preceding row; accepted-routine redirect regression remains separate. Low risk.                                                                | Remove one declaration; resume suite.                                                               |
| `discovery-classify-b7.test.ts:71`, generated “T5_name: {name: Hitzeschutz Spray} -> heat_protectant”                                        | Exact fixture/classifier/type/rule assertion already in `discovery-classify.test.ts:61`. Distinct ambiguous-spray and usage cases remain.                                                                | Base `2bb16f10`, copied by `6458825e`; classifier is called by Discovery product intake. Low risk.                                                                   | Remove one generated case, zero syntax-tree declarations; both classifier suites.                   |
| `product-catalog-lifecycle.test.ts:113`, “supabase migrations have unique version prefixes”                                                  | `supabase-migration-version-uniqueness.test.ts:6` checks the identical directory and uniqueness, and additionally rejects nonnumeric versions with better diagnostics.                                   | Catalog test `b4fb21f4`, global owner added by `457c64be`; migration filenames are consumed by Supabase release tooling. Low risk; global contract retained.         | Remove one declaration and unused `readdirSync` import; global migration keeper.                    |
| `product-catalog-lifecycle.test.ts:189`, “add-on product remains relationship-retrievable outside primary eligibility”                       | Literal fixture assertions cannot detect retrieval behavior. Its only production call duplicates “product with outgoing add_on_for is not primary-eligible” at :177 with identical inputs.               | Catalog suite `b4fb21f4`; `isEligibleForPrimaryRecommendation` is called by the real selection path. Low risk; relationship retrieval never ran in the removed test. | Remove one declaration; catalog eligibility keeper.                                                 |
| `product-intake-research-package.test.ts:338`, “prepare research script has no apply flags or Supabase write/RPC calls”                      | Move every unique no-apply/no-write assertion into `product-intake-review-scripts.test.ts:161`, which already reads the same script and prohibits update. Nothing unique is dropped.                     | Both originated in `b4fb21f4`; package preparation is called by research queue and npm preparation command. Low risk only with all seven checks preserved.           | Consolidate one declaration, remove unused `readFileSync` import; package and review-script suites. |
| `product-intake-research-jobs.test.ts:921`, “local worker kick starts a persistent watched worker”                                           | Move all four argv/watch assertions into “review cockpit kicks the local Codex worker after enqueueing work” at :693, the same launcher owner.                                                           | Both `b4fb21f4`, keeper maintained by `14127b07`; enqueue/rework/decision/retry routes use launcher. Low risk with exact argv checks preserved.                      | Consolidate one declaration; jobs suite.                                                            |

No production owner, test-only production export, runtime branch or separate
support file became removable. Unique assertions moved during consolidation are
preserved; the reductions are not nine discarded independent contracts.

## Retained candidates and preservation findings

- **Restore developer runner guard (P2, accepted):**
  `personal-plan/persistence/runner-discovery.test.ts:20` protects the still
  documented `test:personal-plan` command. The newer CI guard covers a different
  command. `plans/2026-08-10-ci-personal-plan-reliability.md:80` explicitly retains
  the focused developer command; `plans/2026-08-31-hair-length-card-fit.md:81`
  still uses it. The first candidate rationale was incorrect. File restored
  byte for byte before final verification; its focused test passes.
- Keep the generated chat-route tracing artifact check: it tests built delivery
  of guidance files beyond merely checking Next configuration.
- Keep source-oriented migration/security/CI/package/release/prompt and content
  checks when no stronger independent boundary covers their contract.
- Keep the account-deletion runbook/inventory check: removing it would abandon
  a separate documentation completeness guard in a high-stakes operation.
- Keep the Quiz timer cleanup guard until executable timer/interaction proof
  can replace it; its private-source coupling does not justify losing the only
  stale-timer protection.
- Keep legacy Compare Lab test suites while `classic` and `tool_loop` remain
  delivered lab paths. Removing them requires subsystem retirement, outside
  this test-only maintenance request.
- Category runtime facade, direct category logic, transport serialization,
  persistence, UI orchestration and controller boundaries retain their distinct
  null/race/security/default contracts even when fixtures share vocabulary.

## Final verification and review

- Original full Node baseline: 1,115 files, 12,019 cases; 11,977 pass,
  26 fail (`supabaseUrl is required`), 16 skipped. No live credentials loaded.
- Final full Node run: 1,114 files, 12,010 cases; 11,968 pass, the same 26 named
  failures, 16 skipped, no cancellations. Exit 1 reflects those retained
  baseline failures; the suite is not green. Failures are in the unmodified
  agent product-selection mock paths constructing an admin Supabase client.
- c8 10.1.3, Node 22.12.0, original TypeScript source attribution: 1,935 source
  files, fixed 446,681-line denominator. Global baseline lines/statements 69.79%,
  branches 81.54%, functions 83.07%. Initial synchronous report exceeded the
  default heap; `c8 report --merge-async` recovered saved coverage successfully.
- Affected baseline: 313/313 pass. Repeated unchanged run: identical coverage
  for every file and metric. Final affected run after restoring the runner:
  304/304 pass, with every coverage entry identical to baseline (zero loss).
- Mutation controls for moved contracts: an appended direct RPC call fails the
  kept preparation policy assertion; changing watched-worker argv fails the
  kept launcher assertion. Both fail as `ERR_ASSERTION`; originals restored
  from byte buffers and verified by SHA-256. No mutated source remains.
- Typecheck passes; full lint passes with five warnings in unchanged source.
- Targeted formatting and `git diff --check` pass. Root remains clean on `main`.
- Independent preservation review found the developer-runner issue above;
  remaining removals retain proof. Claude's read-only counterpart review
  approves the final test diff with no blocking findings. Main reviewed the
  numerical evidence and final documentation independently. Structural review
  is unnecessary for isolated test pruning without architecture changes.

Global source-mapped coverage, before → final:

| Metric     | Covered / total before | Covered / total final | Percentage before → final |
| ---------- | ---------------------- | --------------------- | ------------------------- |
| Lines      | 311,739 / 446,681      | 311,739 / 446,681     | 69.79% → 69.79%           |
| Statements | 311,739 / 446,681      | 311,739 / 446,681     | 69.79% → 69.79%           |
| Functions  | 21,163 / 25,474        | 21,163 / 25,474       | 83.07% → 83.07%           |
| Branches   | 69,840 / 85,644        | 69,831 / 85,633       | 81.54% → 81.54%           |

Both reports contain exactly the same 1,935 source paths, including unloaded
files. Lines, statements and functions are identical globally and per file.
Branch counts vary in 60 file entries; the exact global branch decrease is
0.000034852 percentage points (0.000042739% relative loss). All measured
per-file decreases are below two percentage points; the largest is
0.952381 points in `src/lib/scan/profile-context.ts` (13/15 → 12/14).
Focused coverage is exactly identical for every file and metric, including
the unchanged repeat. Run-to-run branch attribution variation is a plausible
explanation for the full-run differences, not a proven cause. The observed
budget passes without relying on that inference.

Browser suites (545 declarations), build and live external evaluation were not
run. No browser assertions or production behavior changed. Node coverage does
not measure browser-only or live-provider behavior. Existing failures remain a
verification limitation and require a separate harness investigation; no live
credentials were added to conceal them.

Decision coverage was internally revalidated against the final diff on
2026-10-01; authorization is Nick's original pruning request. Retained unique
contracts and the unchanged browser scope require no new product decision.
The pruning batch has no blocking review findings, but the requested 20% outcome
is unmet and the broader suite still has its baseline failures.

## Reproduction and artifact disposition

Install temporary tool: `npm install --prefix /tmp/hc-test-audit-tools
--ignore-scripts --no-audit --no-fund c8@10.1.3`.

Use Node with `--enable-source-maps --import ./tests/server-only-register.cjs
--import tsx --test --test-concurrency=4` and the sorted non-Playwright test
manifest. c8 uses `--merge-async --all --src src --src scripts --src apps --src
packages`, include each root's `**/*.{ts,tsx,js,mjs,cjs}`, exclude `**/*.d.ts`,
`**/*.test.*`, `**/*.spec.*`, and emit `json-summary`, `json`, `lcovonly`,
`text-summary`. Baseline and final command/manifest JSON retain exact argv.

Plan and this ledger: durable PR evidence, commit disposition pending explicit
publication authorization. Temporary discovery/review reports, inventory tools,
coverage logs/data and the derived fingerprint receipt: retained under `/tmp`
with archive disposition; they are temporary local evidence, not committed PR
artifacts. `/tmp/test-audit-final-receipt.md` identifies the exact reviewed tree;
`/tmp/test-audit-coverage-comparison.json` records the computed deltas.
No commit, push, PR, merge, deployment or production write occurred.

Named follow-ups: continue a complete campaign for one bounded owner with its
callers/history/keepers audited; diagnose the retained agent mock Supabase
construction failures in isolation. Neither follow-up is represented as done.
