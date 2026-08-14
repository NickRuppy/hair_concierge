# Stage 3 CI harness hardening

## Outcome and source context

PR #404 must stop depending on the intermittently failing Stage 3 lab route under `next dev` while preserving the complete 16-test Personal Plan browser contract.

The exact PR head `592b27ad` produced two different GitHub Actions outcomes with the same synthetic merge commit, runner image, Node/Next versions, flags, and worker count:

- first attempt: 13 passed and all three `tests/personal-plan-stage3.spec.ts` cases failed because `/labs/personal-plan/stage-3` returned HTTP 404;
- failed-job rerun: all 16 tests passed and the same route returned HTTP 200.

This proves a process-level dev-server flake but does not prove its internal Next.js cause. A green rerun is not treated as proof that the original neutral-probe change fixed the flake.

## Chosen direction

Split the current Personal Plan browser command by server contract:

1. build once with the existing CI-only Personal Plan flags;
2. run the three Stage 3 lab tests against `next start` on `127.0.0.1:3217` with a neutral root readiness probe;
3. after the production server exits, run the remaining thirteen development-only journey tests against `next dev` on the same port with the same neutral readiness probe.

The production `next start` process must receive `CI=true` and `CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED=true` at request time, must use `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3217`, and must not set `NODE_ENV=development`. The development process must continue to receive `CI=true`, `CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED=true`, and `CI_PERSONAL_PLAN_PRODUCTION_JOURNEY_ENABLED=true`.

Keep both phases in the existing `quality-personal-plan-browser` job so the required `quality-core` aggregate and path-aware scheduling remain unchanged. Give the build and both browser phases distinct workflow steps so failures identify the affected boundary.

Do not add automatic Playwright retries or retry HTTP 404. A route or assertion failure remains a real failed check.

## Scope and non-goals

In scope:

- package scripts for the production-lab phase, development-journey phase, and local aggregate command;
- the `quality-personal-plan-browser` workflow steps and CI-only environment;
- orchestration regression coverage for the split server modes, neutral probes, one-minute probe bound, and ten-minute job cap;
- the durable plan and refreshed PR verification/review receipts.

Non-goals:

- no product, copy, timing, navigation, analytics, auth, middleware, or lab-gate behavior changes;
- no relaxation of production access to fixture routes;
- no test retry, server restart, or green-by-rerun policy;
- no migrations, deployment, production writes, or general Playwright-job redesign;
- no claim that the internal Next.js/Turbopack defect is proven.

## Target map

- `package.json`
  - add explicit Stage 3 production-lab and development-journey scripts;
  - keep `test:playwright:personal-plan-stage3` as the complete local aggregate that builds and runs both phases.
- `.github/workflows/ci.yml`
  - build the CI-gated app once;
  - run the production lab and development journey in separately named steps;
  - retain the existing path-aware condition, dependencies, and ten-minute job timeout.
- `tests/ci-workflow-orchestration.test.ts`
  - assert that only the three lab tests use `next start`;
  - assert that the other three spec files use `next dev`;
  - assert that the production start command carries `CI=true` and `CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED=true`, omits `NODE_ENV=development`, and serves the same `127.0.0.1:3217` origin used by `PLAYWRIGHT_BASE_URL` and readiness polling;
  - assert that the development start command retains `CI_PERSONAL_PLAN_PRODUCTION_JOURNEY_ENABLED=true`;
  - assert neutral root probes, `WAIT_ON_TIMEOUT=60000`, explicit CI flags, and the ten-minute cap;
  - reject reintroduction of the guarded lab route as a readiness URL.

## Designed operator journey

There is no end-user journey change.

1. A PR or push that affects the Personal Plan journey schedules `quality-personal-plan-browser` through the existing path detector.
2. The job installs dependencies, builds the application once with the CI-only Stage 3 fixture gates, and installs Chromium.
3. The job starts the production server on `127.0.0.1:3217` with the CI Stage 3 lab gate present at runtime and no development `NODE_ENV`, waits up to one minute for neutral `/`, and runs only the three Stage 3 lab tests against that exact origin. The server exits afterward.
4. The job starts the development server on `127.0.0.1:3217` with the production-journey CI gate intact, waits up to one minute for neutral `/`, and runs the remaining thirteen Personal Plan journey tests. The flaky Stage 3 lab route is not requested in this phase.
5. A build failure, production-lab failure, or development-journey failure appears under its own named step. No automatic retry changes the result.
6. `quality-core` succeeds only when the complete split job succeeds; merge remains blocked on any failed required check.

Important variants and recovery:

- If the CI-gated production lab route is unavailable, the lab step fails directly with route/test evidence.
- If a development-only route or journey regresses, only the development phase fails; existing auth boundaries remain unchanged.
- If the job exceeds ten minutes, GitHub Actions terminates it as before.
- A manual same-head rerun remains diagnosis evidence only, not an acceptance mechanism.
- The observed Stage 3 lab seam is removed from `next dev`; the internal Next.js cause is still unproven, so this plan does not claim that unrelated development-only fixture routes can never exhibit a similar process-level flake.

## Planning evidence

No user-facing mockup is required because this changes only the CI test harness and does not alter product UI, copy, timing, or feedback.

Logic prototype question: can the flaky lab surface move to a production server without weakening development-only route guards while preserving all 16 tests?

Decision criterion: one CI-gated production build succeeds, the Stage 3 lab passes against `next start`, the remaining journeys pass against `next dev`, and the combined prototype stays comfortably within the existing ten-minute cap.

Observed evidence:

- production build succeeded in 33.4 seconds and included `/labs/personal-plan/stage-3`;
- all sixteen tests against production were rejected because existing production-journey routes deliberately require development mode;
- isolated production Stage 3 lab phase passed 3/3 in 6.8 seconds;
- isolated development journey phase passed 13/13 in 27.5 seconds;
- combined measured prototype time was approximately 67.7 seconds before ordinary CI setup.

Selected behavior: split production-lab and development-journey phases in one job.

Artifact disposition: discard generated `.next` output; retain this plan as durable evidence; rewrite the prototype command through package scripts, workflow steps, and regression tests during implementation.

## Ordered tasks

### 1. Define the split command contract

Add a failing orchestration regression that distinguishes the production-lab and development-journey commands, asserts their exact spec ownership, and preserves the timeout/neutral-probe contract.

The regression must also fail when the production start command loses either runtime CI gate, gains `NODE_ENV=development`, or disagrees with the fixed `127.0.0.1:3217` Playwright/readiness origin; and when the development command loses `CI_PERSONAL_PLAN_PRODUCTION_JOURNEY_ENABLED=true`.

Consumes: current package script, workflow job, and same-head failure evidence.

Produces: a red-capable test for the split harness.

Completion criterion: the focused orchestration test fails on the current single-dev-server command for the intended reason.

### 2. Implement one build and two server phases

Add the two focused package scripts and local aggregate, then update `quality-personal-plan-browser` to run in the exact order build → production lab → development journey, invoking each phase in a separately named step. Mirror the repository's existing `playwright-smoke` production-server shape for the lab phase, with the Stage 3 runtime gates and fixed port added. Preserve path detection, job dependencies, CI-only flags, timeouts, and `quality-core` aggregation.

Consumes: the red test from Task 1.

Produces: a production Stage 3 lab phase and a development-only remaining-journey phase.

Completion criterion: focused orchestration coverage passes and the workflow/package diff contains no retry or access-boundary change.

### 3. Verify the complete exact tree

Run the two split phases locally, the aggregate command, focused orchestration coverage, the full Node suite, `npm run ci:verify`, formatting/diff checks, and the repository's `request-code-review` plus Claude counterpart review gates. Push only after the canonical content fingerprint matches the refreshed verification and review receipts.

Consumes: the complete implementation from Task 2.

Produces: exact-tree verification and review receipts.

Completion criterion: local production lab is 3/3, local development journey is 13/13, aggregate is 16/16, all supporting checks pass, and no blocking review finding remains.

### 4. Require fresh exact-head GitHub checks before merge

Update PR #404, wait for the required `quality-core` aggregate and every branch-protection check on the new head, and inspect any failure rather than rerunning to green. Merge only when the first complete exact-head run is green and the branch is current with `main`.

Consumes: the reviewed implementation head.

Produces: merge-ready GitHub evidence.

Completion criterion: CI, Security, Clawpatch, and Vercel are successful on the exact current head with no unresolved conversation or stale-base state.

## Verification

Automated checks:

- red/green `tests/ci-workflow-orchestration.test.ts`;
- production Stage 3 lab phase: 3/3;
- development Personal Plan journey phase: 13/13;
- complete aggregate: 16/16;
- `npm run ci:verify`;
- `npm run test:node`;
- `git diff --check` and repository formatting/lint checks for changed files.

Manual/integration checks:

- confirm the production build route table contains `/labs/personal-plan/stage-3`;
- confirm each workflow step uses its intended server mode and spec set;
- confirm no CI or test process remains listening after local runs;
- inspect the first complete exact-head GitHub Actions run rather than relying on a rerun.

No migration, live-data, production-write, or end-user browser review is required.

## Review and handoff

- Branch/worktree: `codex/ci-stage3-neutral-readiness` in `.worktrees/ci-stage3-neutral-readiness`.
- Counterpart plan review: completed with the runtime-gate, port, assertion, ordering, verification, and residual-risk revisions incorporated; the suggested second Codex-rescue lane was rejected because current `AGENTS.md` requires one Claude counterpart lane when Codex orchestrates.
- Operator-journey sign-off: confirmed by Nick on 2026-08-14 for the build → production lab → development journey flow with no automatic retries.
- Prototype `.next` output: discard/generated, never commit.
- Durable plan: commit with the hardened PR.
- Stop point after implementation: refreshed draft PR; merge remains separately gated by the already requested exact-head merge workflow.
