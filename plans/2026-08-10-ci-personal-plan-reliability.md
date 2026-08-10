# Personal Plan CI reliability and runtime plan

## Outcome and source context

Implement the CI redesign approved by Nick on 2026-08-10 after reviewing the recent GitHub Actions history. The review found that every observed `Personal Plan DB contract` failure occurred in the persisted browser journey rather than the SQL contract, the custom Next readiness request could wait until the job-level timeout, and the required `quality-core` gate serialized duplicated unit and browser work.

The outcome is a review-ready local change that keeps the existing required check names and current migration/browser coverage while making failures attributable and reducing both pull-request wall time and unnecessary Personal Plan work on unrelated changes.

## Chosen direction

Keep `quality-core` as the required aggregate check, but move its work into parallel child lanes for static validation, Node contracts, generic Playwright contracts, and path-aware Personal Plan browser contracts. Keep `playwright-smoke` as the required smoke name while running the payment-feedback scenario in the same build and server lifecycle.

Make `personal-plan-db-contract` a SQL-only job and add a separately named `personal-plan-persisted-journey` job. Give the journey its own path signal, production-server harness, bounded readiness probes, retained failure evidence, and CI artifacts. Add a nightly full run plus the existing `[full-ci]` escape hatch so path scoping does not become the only safety net.

## Scope and non-goals

In scope:

- `.github/workflows/ci.yml` job decomposition, aggregation, path-aware execution, smoke consolidation, artifact upload, and nightly trigger.
- `scripts/ci/path-rules.mjs` and `scripts/ci/changed-paths.mjs` scope outputs for the SQL contract and persisted journey.
- Package test orchestration that removes the duplicate top-level Personal Plan Node pass without removing nested contracts.
- `scripts/test-personal-plan-stage1-5-browser.sh` startup bounds, production-server execution, failure evidence, and cleanup behavior.
- `playwright.config.ts` failure trace/screenshot retention and deterministic CI worker count.
- Focused regression tests and this durable plan.

Non-goals:

- No application behavior, UI, copy, routing, recommendation, billing, auth, or database schema change.
- No hosted Supabase operation, migration application, feature activation, deployment, branch-protection edit, commit, push, PR, or merge.
- No removal of the existing generic, Stage 3, Stage 4, Stage 5, SQL, or persisted Stage 1-5 coverage.
- No dependency upgrade or unrelated vulnerability remediation.

## Target map

- `.github/workflows/ci.yml`: parallel quality lanes, aggregate checks, split Personal Plan jobs, combined smoke, artifacts, and nightly run.
- `scripts/ci/path-rules.mjs`: independent `personal_plan_db` and `personal_plan_journey` classifications, including shared auth/middleware seams used by the journey.
- `scripts/ci/changed-paths.mjs`: explicit scheduled/full-CI forcing.
- `package.json` and `scripts/ci/run-personal-plan-nested.mjs`: deterministic nested-only Personal Plan Node command and de-duplicated aggregate contracts.
- `scripts/test-personal-plan-stage1-5-browser.sh`: per-run Supabase/app isolation, bounded production-server harness, and durable failure logs.
- `playwright.config.ts`: CI worker and failure-artifact policy.
- `tests/ci-path-rules.test.ts`, `tests/ci-workflow-orchestration.test.ts`, `tests/personal-plan-browser-harness.test.ts`: regression contracts.

## Designed operator and integration journey

There is no end-user journey change, so no user-facing mockup or prototype is required.

1. A pull request or `main` push starts CI. The scope detector fails closed to full CI when the diff cannot be read and honors `[full-ci]`.
2. Static, Node, generic browser, and relevant Personal Plan browser lanes start independently. Unrelated changes visibly skip only the expensive Personal Plan lane; nightly runs execute every path-aware gate.
3. `quality-core` runs after all child lanes, fails when any child failed or was cancelled, tolerates a deliberately skipped path-aware child, and remains the stable dependency for chat/retrieval gates and branch protection.
4. A relevant database/schema change runs the SQL-only `personal-plan-db-contract`. Its result identifies a database contract failure without browser noise.
5. A relevant Personal Plan runtime/auth change runs `personal-plan-persisted-journey`. The harness starts a per-run Supabase project on a per-run port range, exports its generated URL and keys, then builds and starts the production server on its own app port so client-side `NEXT_PUBLIC_*` values are compiled correctly. It probes readiness with per-request and total bounds and runs the Stage 1-5 Playwright journey.
6. If readiness or the journey fails, the job terminates its owned Next process group and Supabase project, prints the server tail, retains Playwright trace/screenshot plus server log, and uploads them under the journey job. A timeout cannot be caused by an unbounded readiness request.
7. The required `playwright-smoke` job builds once, starts one server, and runs both the existing `@ci` and `@payment-feedback-v2` tests. Its required check name and artifact contract remain stable.
8. CI completes with attributable child results and the same stable required gate names.

## Ordered tasks

### 1. Lock CI contracts with failing tests

Add regression expectations for independent database/journey scope outputs, the previously missed auth and Supabase middleware seams, parallel quality children with a fail-closed `quality-core` aggregator, SQL-only database job, separate journey artifacts, combined smoke execution, nightly full-CI forcing, de-duplicated Node orchestration, and bounded browser readiness/failure evidence.

Produces: consumer-visible tests that fail against the current workflow and harness.

Completion: focused Node test execution fails only on the missing redesigned behavior.

### 2. Split path classification and Personal Plan jobs

Consumes: task 1 scope expectations.

Implement distinct conservative SQL and journey path rules. Keep shared workflow/dependency changes full-scope, add explicit schedule forcing, retain `personal-plan-db-contract` as the SQL-only check, and introduce `personal-plan-persisted-journey` with browser installation and failure artifact upload.

Produces: attributable Personal Plan checks and no browser dependency in the SQL job.

Completion: path/workflow tests pass and representative paths classify independently as intended.

### 3. Parallelize and de-duplicate core quality

Consumes: task 1 orchestration expectations and task 2 path output.

Create parallel static, Node, generic browser, and path-aware Personal Plan browser child jobs. Replace the old serial implementation with a fail-closed `quality-core` result aggregator that rejects failed or cancelled children but accepts a deliberately skipped path-aware child. Add a new nested-only Personal Plan Node command so the local aggregate still covers nested tests without narrowing the existing focused `test:personal-plan` command or rerunning its top-level tests already included in `test:node`.

Produces: stable `quality-core` semantics with lower critical-path latency and unchanged contract inventory.

Completion: orchestration tests prove child dependencies and the exact fail/cancel/skip aggregation semantics, package tests prove de-duplication, and focused commands pass.

### 4. Consolidate the smoke server lifecycle

Consumes: existing `playwright_smoke` scope and required check contract.

Enable the payment-feedback feature in `playwright-smoke`, run `@ci` and `@payment-feedback-v2` in one Playwright invocation against one build/server, retain the current artifact upload, and remove the redundant payment job.

Produces: one required smoke job with both scenario groups.

Completion: workflow regression tests prove the required name, guards, flags, combined grep, and single build/install/server lifecycle.

### 5. Harden the persisted journey harness

Consumes: separate journey job from task 2.

Start a per-run Supabase project on per-run ports, export its URL/keys, and only then build and serve Next in production mode on a per-run app port. Bound every readiness request and the total readiness phase, keep process-group cleanup, persist a sanitized server log on failure, and use journey-specific environment flags to retain traces/screenshots on first failure with one worker without changing other Playwright jobs.

Produces: deterministic termination and actionable artifacts for startup and browser failures.

Completion: harness regression tests pass, shell syntax validates, and the isolated journey either passes locally or reports an environment-specific blocker with complete evidence.

### 6. Verify and review the integrated change

Consumes: tasks 1-5.

Run focused CI contract tests, package/shell/config validation, readiness checks proportionate to risk, and the relevant disposable SQL/browser exercises. Run repository `ready-check`, repository `request-code-review`, and one read-only Claude whole-branch review; verify every finding locally.

Produces: review-ready evidence and an explicit list of residual risks.

Completion: no unresolved blocking finding remains and the branch is handed back without publication.

## Verification

Automated checks:

- Focused Node tests for path classification, workflow orchestration, and browser harness contracts, including a recorded red-to-green result.
- JSON, shell syntax, and workflow YAML parsing/structural validation.
- `npm run test:node`, nested-only Personal Plan tests, agent tests, and generic Playwright contracts as warranted by changed orchestration.
- `npm run ci:verify` or the repository readiness equivalent for typecheck, lint, and production build.

Manual/browser checks:

- Run `npm run test:playwright:personal-plan-stage1-5` locally when Docker and Chromium are available; inspect failure artifact output if it does not pass.
- Confirm the combined smoke command selects both tags without duplicate tagged test execution.

Migration/live-state checks:

- Run `npm run test:personal-plan-db` against its disposable local project when Docker is available.
- No hosted project query or write is required because schema/runtime behavior is unchanged.

Evidence-sensitive review:

- Compare job names and dependencies with current branch-protection requirements. Live recheck on 2026-08-10 confirmed only `quality-core`, `playwright-smoke`, `chat-live-smoke`, `retrieval-gate`, and `funnel-contributor-scope` are required; the existing combined Personal Plan job is advisory, so splitting its two results does not remove an enforced gate.
- Compare old and new test inventories to confirm coverage is moved or de-duplicated rather than deleted.
- Review path rules conservatively for shared runtime seams and verify nightly/full-CI recovery.

## Review and handoff

- Worktree: `.worktrees/ci-personal-plan-reliability`
- Branch: `codex/ci-personal-plan-reliability`
- User approval: implementation approved 2026-08-10; publication not authorized.
- Review gates: focused red/green tests, ready-check, request-code-review, read-only Claude counterpart review.
- Rollout risks: GitHub Actions expression/aggregation semantics, path false negatives, CI-only timing, and increased runner concurrency. The approved tradeoff is that expensive Stage 3/4/5 browser contracts may be deferred to nightly on unrelated changes; conservative shared-seam rules, nightly/full-CI execution, and fail-closed scope detection bound that risk. Local workflow tests and failure artifacts bound diagnosis risk.
- Artifact disposition: plan and regression tests `commit`; failure artifacts and Claude reports `discard` after review; no archive-only artifact expected.
- Stop point: verified, review-ready local worktree before commit/push/PR.
