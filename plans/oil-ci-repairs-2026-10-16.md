# Oil PR CI repair record and verification checklist — 2026-10-16

## Outcome and decision coverage — confirmed

Nick requested checking #690/#692 and fixing failing CI, using subagents where useful, keeping matching manual and not deploying. #690 head `24a7e8d9` is green and needs no change. #692 head `e4f47644` has one stale prompt hash, a profile smoke save timeout and CodeQL findings. These are bounded compatibility/security/test repairs; no property, matching, UI or deployment policy changes.

Confirmed with Nick: the current request authorizes corrections and pushing them to the existing draft PR. Inherited: final Oil v0.10 research contract and manual matching stay settled; raw source captures and historical provenance are immutable. Implementation defaults: reuse clean `codex/oil-intake-integration`; do not change main, live database or worker. Open consequential assumptions: none. Coverage acknowledgement is the 2026-10-16 CI-fix request. Internal revalidation: failure logs and the five CodeQL annotations checked directly before implementation. Undiscussed consequential assumptions affecting this handoff: none.

The bounded repairs below are implemented in the working tree. This records the diagnosis, remaining verification and publication steps; it is not a new implementation handoff.

## Evidence, repair and ownership

1. `tests/product-intake-router-characterization.test.ts`: the frozen prompt assertion still expects pre-engine Oil hash `b07faaf...`, while reviewed current v0.10 emits `e485179...`. Preserve every sibling category hash; update only Oil and label that reviewed transition. Main owns this file. Acceptance: existing owner suite demonstrably red before correction, green afterwards; current Oil method/manual matching owner tests stay green.
2. `tests/profile-page-smoke.spec.ts`: CI artifact shows the Haar-Check request still saving when the fixed 5-second toast assertion expires. No profile/Oil implementation regression is evidenced. Wait for the exact save POST response before asserting success and retained field values; assert HTTP 200 and bound the response wait to 30 seconds. Preserve all existing user-visible assertions; no sleeps or profile behavior changes. Profile lane owns the test. Acceptance: focused browser scenario completes and still fails a failed POST; hosted smoke passes.
3. `.github/workflows/security.yml`: exclude exactly the four archived Rahua HTML captures from CodeQL extraction, never the application or a security query. These are third-party evidence bytes with unsafe retailer JavaScript, not shipped executable source. Preserve exact paths/hashes and provenance; do not rewrite/dismiss alerts. Security lane owns workflow. Acceptance: four hashes unchanged and hosted CodeQL scans all application source with those false positives absent.
4. `src/lib/product-intake/pipeline/process.ts` and `tests/product-intake-worker-heartbeat.test.ts`: the shared spawn helper accepts a shell option although every production caller uses argv arrays. Force `shell:false` after the options spread. Add an actual child-process regression proving literal metacharacter arguments cannot invoke a shell. Replace the sole `sh -c` timeout fixture with equivalent Node parent/descendant behavior so timeout/process-group proof remains without polluting context-insensitive CodeQL modeling of production arguments. Security lane owns these files. Acceptance: argv regression red on prior helper and green after repair; heartbeat/output/timeout/descendant tests green; hosted medium alert cleared. The medium alert predates Oil; this is a small safe hardening, not a claim that Oil introduced injection.

## Verification, review and stop point

Use the shared verification slot, one heavy check at a time. Run focused prompt/category/current-intake/heartbeat tests, appropriate profile smoke, root typecheck and scoped lint. Existing whole-branch integration evidence remains applicable outside this delta. Claude plan and code review are read-only and terminal; reports stay under `/tmp`. Review the security/config/test delta against the settled integration, refresh the final content receipt, commit and push only owned changes, then verify hosted checks on both exact PR heads.

No new UX proposal is needed: product behavior is preserved, and the browser test waits for the existing save result. No merge, deployment, migration application, catalog publication or matching approval is authorized. Artifact disposition: repair code/tests, this plan and verification receipt are commit candidates; transient logs/reviewer output outside the repo. Original source worktree stays untouched.

## Counterpart plan review disposition

Claude found no technical blocker (`/tmp/oil-ci-repair-plan-review.md`). Adopted: label this as an implemented repair record, provide reproducible checks and distinguish hosted-only proof. The proposed reapproval of the Oil hash is unnecessary: Nick already authorized the reviewed v0.10 engine integration, the prior whole-branch review covered its registry/admission/manual boundary, and the owner inspected `oil-research-prompt-contract.ts` directly. Its schema, evidence instructions, excluded properties and manual matching boundary match that approved contract. No prompt bytes changed in this repair; only the stale assertion changed. The pre-existing shared-helper hardening is included because Nick explicitly requested fixing all failing checks on these PRs; argv-only callers preserve their existing behavior.

Local commands (serialized through the repository gate):

```sh
CODING_TEST_CONCURRENCY=1 npm run test:focused -- tests/product-intake-worker-heartbeat.test.ts tests/product-intake-router-characterization.test.ts tests/product-intake-category-research-router.test.ts tests/oil-current-intake.test.ts tests/oil-worker-admission.test.ts tests/product-intake-pipeline-image.test.ts
npm run typecheck
~/.local/bin/coding-check -- npx eslint src/lib/product-intake/pipeline/process.ts
git diff --check
```

The profile smoke and CodeQL alert clearance require the hosted runs on the pushed head. The local browser attempt stopped before execution because this worktree has no production build; it supplies no browser-pass evidence. Hosted profile smoke retains the full existing journey and uses the exact save response as its completion signal.
