# Product Intake Review Cockpit Phase 1 Implementation Plan

Date: 2026-06-30
Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke`
Branch: `codex/product-intake-full-flow-smoke`
Parent strategy: `plans/2026-06-30-product-intake-review-cockpit.md`
Status: implemented, then extended into local review/rework/preflight flow

## Goal

Build the first durable foundation for the Product Intake Review Cockpit:

1. Keep the customer-facing Chaarlie app behavior unchanged.
2. Add a true separate internal Next app in this repo.
3. Add the minimal workspace/shared-package structure required for that app.
4. Add durable `product_intake_research_jobs` state in Supabase.
5. Show a DB-backed intake queue with clear job status.
6. Add a local Codex runner skeleton that can claim and update jobs without doing full research yet.

Phase 1 should make work visible. It does not need to solve product research, image judging, rework comments, or publish.

Do not deploy the internal app publicly in Phase 1. Local no-login is acceptable only for local development; any deployed preview must be protected before it can reach service-role backed routes.

## Implemented Extension

After Phase 1 landed, the local cockpit was extended to cover the first usable
review loop:

- durable research artifacts and review decisions
- product-level rework from saved field/image comments
- Codex CLI worker execution behind `--execute-codex`
- worker persistence of review preview payloads into `researched_payload`
- publish preflight blockers for final image approval, final product handoff,
  unresolved comments, job readiness, and submission readiness
- fail-closed publish route that records blocked publish attempts until the
  canonical package/image approval gate is integrated

The extension still does not apply migrations, upload images, publish products,
or notify users without Nick explicitly approving the relevant write path.

## Settled Decisions

- The review cockpit is a separate internal app in the same repo, not `/admin/product-intake` in the customer app.
- We accept the setup cost for workspaces/shared packages.
- V1 research runs through local Codex CLI/subagents, not direct model API keys.
- The app uses queued jobs plus a background runner.
- Default runner concurrency is 2, but Phase 1 may implement the concurrency setting without full research execution.
- All products require Nick review in v1.
- Rework is product-level later: Nick marks all issues, then clicks `Rework product` once.
- No new workflow columns or statuses are added to `product_submissions` in Phase 1.
- Phase 1 adds only `product_intake_research_jobs`; artifacts and review decisions come later.
- Local package files remain as fallback during the transition.

## Non-Goals

- No direct product approval/publish from the new app.
- No image upload/cutout/background-removal work.
- No field-level review decisions table.
- No research artifacts table.
- No Codex product research prompt execution beyond a skeleton runner.
- No moving the root Chaarlie app into `apps/chaarlie-web`.
- No production Vercel deployment work beyond keeping the app deploy-shaped.
- No Customer.io/user notification changes.
- No automatic publishing.

## Source Context

Current app/repo shape:

- `package.json` is a single root Next app named `chaarlie`.
- There is no current `workspaces` key, `turbo.json`, or `pnpm-workspace.yaml`.
- `tsconfig.json` maps `@/*` to `./src/*`, so an `apps/product-intake-review` app cannot import root `@/` paths directly.
- Current customer app scripts are `npm run dev`, `npm run build`, `npm run typecheck`, and `npm run ci:verify`.
- `vercel.json` only defines the billing reconcile cron today.

Current intake state:

- `product_submissions.status` currently allows:
  - `pending_review`
  - `researching`
  - `ready_for_review`
  - `needs_more_info`
  - `matched_existing`
  - `approved`
  - `rejected`
  - `cancelled_by_user`
- `product_submissions_success_product_check` requires `approved_product_id` for `approved` and `matched_existing`.
- `idx_product_submissions_status_created_at` exists and supports status queue reads.
- Current local package flow uses `scripts/product-intake/prepare-research.ts`, `research-queue.ts`, and `review-app.ts`.

## Chosen Architecture

Use npm workspaces, but do not move the existing customer app yet.

Target phase-1 shape:

```text
package.json                         root customer app remains here
apps/product-intake-review/           separate internal Next app
packages/product-intake-core/         shared job types/repository primitives
supabase/migrations/...jobs.sql       durable job table + claim/update RPCs
scripts/product-intake/codex-research-worker.ts
```

Root remains the customer app for now. The internal app imports only from workspace packages, not from root `@/src/*`. This keeps the new app separate without forcing a risky root-app relocation.

Root isolation requirement:

- Add `apps` and `packages` to the root `tsconfig.json` `exclude`, or otherwise ensure `npm run typecheck` continues to typecheck only the existing customer app scope.
- Scope root `eslint .` intentionally so workspace app/package files are not linted under the wrong root app assumptions.
- Add separate workspace scripts for the internal app/package checks.
- Verify the root customer app build still works after the workspace change.

## Workspace Plan

### Root `package.json`

Add npm workspaces:

```json
"workspaces": [
  "apps/*",
  "packages/*"
]
```

Keep existing root scripts working for the customer app.

Add explicit internal-app scripts:

```json
"products:intake:review-cockpit:dev": "npm run dev --workspace @chaarlie/product-intake-review",
"products:intake:review-cockpit:build": "npm run build --workspace @chaarlie/product-intake-review",
"products:intake:review-cockpit:typecheck": "npm run typecheck --workspace @chaarlie/product-intake-review",
"products:intake:review-cockpit:lint": "npm run lint --workspace @chaarlie/product-intake-review",
"products:intake:review-cockpit:verify": "npm run typecheck --workspace @chaarlie/product-intake-review && npm run lint --workspace @chaarlie/product-intake-review && npm run build --workspace @chaarlie/product-intake-review",
"products:intake:codex-worker": "tsx scripts/product-intake/codex-research-worker.ts"
```

Root `ci:verify` should continue to verify the customer app. Phase 1 can add a separate `products:intake:review-cockpit:verify` script instead of forcing the new app into every existing CI lane on day one.

### Shared package

Create `packages/product-intake-core`.

Phase 1 contents should be intentionally small:

- job status/stage types
- job row projection types
- queue query helpers
- claim/update helper contracts
- constants for terminal/non-terminal statuses

Do not move all existing product-intake logic into this package in Phase 1.

The package should avoid importing from root `src/*`. If a helper needs app-specific Supabase clients, pass the client in from the caller.

Package `package.json` must define exports so tests and the internal app can import it through the workspace symlink:

```json
{
  "name": "@chaarlie/product-intake-core",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

### Internal app

Create `apps/product-intake-review`.

Phase 1 app capabilities:

- local no-login development
- queue page
- submission/job detail page stub
- worker status indicator stub
- manual `Queue research` / `Retry job` actions only if they update the job table safely

The app should be visually utilitarian and German-language, matching the internal ops use case:

- dense queue table
- clear status chips
- timestamps
- next action
- no marketing hero
- no decorative UI

Use plain app-local CSS for Phase 1. Do not introduce a separate Tailwind/PostCSS setup in the internal app until there is a real design-system need.

## Database Plan

Create migration:

```text
supabase/migrations/YYYYMMDDHHMMSS_product_intake_research_jobs.sql
```

Add table `public.product_intake_research_jobs`.

Recommended fields:

- `id uuid primary key default gen_random_uuid()`
- `submission_id uuid not null references public.product_submissions(id) on delete cascade`
- `status text not null`
- `stage text not null`
- `priority integer not null default 0`
- `attempt_count integer not null default 0`
- `max_attempts integer not null default 3`
- `locked_by text`
- `locked_at timestamptz`
- `started_at timestamptz`
- `completed_at timestamptz`
- `next_run_at timestamptz not null default now()`
- `last_error text`
- `progress jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Job statuses:

- `queued`
- `running`
- `waiting_for_review`
- `waiting_for_rework`
- `publish_preflight`
- `publishing`
- `blocked`
- `failed`
- `done`
- `cancelled`

Phase 1 actively uses:

- `queued`
- `running`
- `waiting_for_review`
- `blocked`
- `failed`
- `done`
- `cancelled`

Statuses reserved for later phases:

- `waiting_for_rework`
- `publish_preflight`
- `publishing`

Non-terminal status set for uniqueness:

```sql
status IN (
  'queued',
  'running',
  'waiting_for_review',
  'waiting_for_rework',
  'publish_preflight',
  'publishing',
  'blocked',
  'failed'
)
```

Add a partial unique index:

```sql
CREATE UNIQUE INDEX product_intake_research_jobs_one_open_per_submission
ON public.product_intake_research_jobs (submission_id)
WHERE status IN (
  'queued',
  'running',
  'waiting_for_review',
  'waiting_for_rework',
  'publish_preflight',
  'publishing',
  'blocked',
  'failed'
);
```

Rationale:

- `done` and `cancelled` are terminal.
- `blocked` and `failed` remain non-terminal so the same job can be inspected/retried instead of accidentally creating a second active job.

Add indexes:

- `(status, priority desc, next_run_at asc, created_at asc)`
- `(submission_id)`
- `(locked_at)`

RLS and permissions:

- Enable RLS on `public.product_intake_research_jobs`.
- Add a `service_role` ALL policy, following existing product-intake table conventions.
- Revoke table access from `anon` and `authenticated`.
- Do not leave this public table with RLS disabled.

Updated-at:

- Add `set_updated_at_product_intake_research_jobs` trigger using `public.update_updated_at_column()`.

Add helper RPCs:

- `product_intake_enqueue_research_job(submission_id uuid, requested_stage text default 'identity')`
- `product_intake_claim_research_jobs(worker_id text, claim_limit integer default 2, stale_after interval default interval '10 minutes')`
- `product_intake_update_research_job(job_id uuid, status text, stage text, progress jsonb, last_error text default null)`

Claim behavior:

- claims only non-terminal jobs where `next_run_at <= now()`
- claims `queued` or stale `running`
- respects `claim_limit`
- sets `locked_by`, `locked_at`, `started_at`, `attempt_count`
- uses `FOR UPDATE SKIP LOCKED` inside an update-with-returning pattern so two workers cannot claim the same job

RPC security boilerplate:

- Use `SECURITY DEFINER`.
- Set `search_path TO 'public'`.
- `REVOKE ALL` execute access from `PUBLIC`.
- Grant execute only to `service_role` unless a later deployment decision requires another role.

Enqueue/retry semantics:

- `product_intake_enqueue_research_job` must not blindly insert a second open job.
- If a non-terminal job already exists for the submission, update that row back to `queued`, clear lock fields, set `next_run_at = now()`, and increment or preserve attempt metadata according to the retry path.
- `/api/jobs/[jobId]/retry` operates on the existing job id. It does not create a new row.
- A new row is created only when no non-terminal job exists for the submission.

## Internal App Plan

### Routes

```text
apps/product-intake-review/app/page.tsx
apps/product-intake-review/app/submissions/[submissionId]/page.tsx
apps/product-intake-review/app/api/queue/route.ts
apps/product-intake-review/app/api/submissions/[submissionId]/queue/route.ts
apps/product-intake-review/app/api/jobs/[jobId]/retry/route.ts
apps/product-intake-review/app/api/health/route.ts
```

### Queue page

Show lanes or filters:

- needs job
- queued
- running
- waiting for review
- blocked/failed
- done
- cancelled/history

Each row shows:

- submission id
- brand/product/category
- submission status
- job status
- job stage
- priority
- attempt count
- locked age
- last update
- next action

### Detail page stub

Phase 1 detail page does not review product content yet.

It should show:

- raw submission summary
- existing `researched_payload` presence
- current job row
- progress JSON
- last error
- local package path if available
- actions to enqueue/retry

### Worker status

Show a simple status area:

- app online
- last queue refresh
- worker heartbeat placeholder

Do not add heartbeat storage in Phase 1. A last refresh timestamp and job lock age are enough.

## Codex Runner Skeleton

Create:

```text
scripts/product-intake/codex-research-worker.ts
```

Phase 1 behavior:

- reads `PRODUCT_INTAKE_CODEX_CONCURRENCY`, default `2`
- claims up to 2 jobs
- writes status `running`
- writes progress such as `{ "message": "Codex worker skeleton claimed job" }`
- writes a local dry-run prompt packet for each job under `tmp/product-intake-codex-worker/`
- does not invoke Codex CLI for real research yet unless behind an explicit `--execute-codex` flag
- marks job back to `queued`, `waiting_for_review`, or `blocked` according to the chosen skeleton behavior

Recommended Phase 1 skeleton behavior:

- default dry run: claim and immediately mark `waiting_for_review` with progress explaining that research execution is not implemented yet
- `--no-complete`: claim and leave running for manual lock/testing
- `--fail-test`: mark a claimed job failed to test UI failure states

The Phase 2 plan will add actual `codex exec` invocation and structured output parsing.

Worker implementation constraints:

- Keep the script thin.
- Put typechecked worker logic in `packages/product-intake-core` where possible.
- The script should use the existing script-side Supabase env helper pattern from `scripts/product-intake/cli.ts`, especially `createSupabaseClientFromEnv`.
- Do not import root app-only Supabase helpers such as `src/lib/supabase/admin.ts` into the script.

## Task Checklist

### 1. Workspace scaffold

- Add root `workspaces`.
- Exclude `apps` and `packages` from root `tsconfig.json` customer-app typecheck, or otherwise scope root typecheck intentionally.
- Scope root ESLint so it does not accidentally lint workspace files under root-app assumptions.
- Add `apps/product-intake-review/package.json`.
- Add app-local `next.config.ts`, `tsconfig.json`, and minimal app files.
- Add `packages/product-intake-core/package.json`.
- Add package build/typecheck config.
- Keep existing root customer app scripts working.

### 2. Job schema

- Add `product_intake_research_jobs` migration.
- Add status/stage constraints.
- Add partial unique index with explicit non-terminal statuses.
- Add claim/enqueue/update RPCs.
- Add `set_updated_at_product_intake_research_jobs` trigger using `public.update_updated_at_column()`.
- Enable RLS, add service-role policy, revoke anon/authenticated access.
- Use `SECURITY DEFINER`, `SET search_path TO 'public'`, and explicit execute grants on RPCs.
- Implement claim with `FOR UPDATE SKIP LOCKED`.
- Implement enqueue/retry as re-queue/update when a non-terminal job already exists.

### 3. Shared job library

- Add job types.
- Add terminal/non-terminal constants.
- Add queue projection type.
- Add helper functions that accept a Supabase client.

### 4. Internal app queue shell

- Build queue API route.
- Build submission enqueue route.
- Build retry route.
- Build health route.
- Build queue page.
- Build detail stub.
- Use German UI copy.
- Make empty/error/loading states clear.

### 5. Codex runner skeleton

- Add CLI script.
- Add concurrency setting.
- Add dry-run prompt packet generation.
- Add claim/update behavior.
- Add debug modes for success/failure/lock testing.
- Ensure worker core logic is typechecked through the shared package or covered by a targeted test.

### 6. Tests

- Unit test job status constants and non-terminal set.
- Unit test claim selection logic where possible.
- Unit test enqueue/retry does not violate the partial unique index when a non-terminal job exists.
- Integration test enqueue/claim/update using mocked Supabase or local test helpers used elsewhere.
- Component/API smoke test for queue formatting if existing test setup supports it.

### 7. Documentation

- Update `docs/product-intake-research-ops.md` with Phase 1 local workflow:
  - how to start internal app
  - how to run worker skeleton
  - what is intentionally not implemented yet
  - no publish/apply from the new app in Phase 1

## File Map

Likely new files:

- `apps/product-intake-review/package.json`
- `apps/product-intake-review/next.config.ts`
- `apps/product-intake-review/tsconfig.json`
- `apps/product-intake-review/app/layout.tsx`
- `apps/product-intake-review/app/page.tsx`
- `apps/product-intake-review/app/globals.css`
- `apps/product-intake-review/app/submissions/[submissionId]/page.tsx`
- `apps/product-intake-review/app/api/queue/route.ts`
- `apps/product-intake-review/app/api/submissions/[submissionId]/queue/route.ts`
- `apps/product-intake-review/app/api/jobs/[jobId]/retry/route.ts`
- `apps/product-intake-review/app/api/health/route.ts`
- `packages/product-intake-core/package.json`
- `packages/product-intake-core/src/index.ts`
- `packages/product-intake-core/src/jobs.ts`
- `packages/product-intake-core/src/repository.ts`
- `scripts/product-intake/codex-research-worker.ts`
- `supabase/migrations/YYYYMMDDHHMMSS_product_intake_research_jobs.sql`
- `tests/product-intake-research-jobs.test.ts`

Likely modified files:

- `package.json`
- `package-lock.json`
- `docs/product-intake-research-ops.md`

Do not modify in Phase 1:

- `src/app/admin/*`
- customer-facing chat/onboarding routes
- approval/publish scripts except for read-only import compatibility if absolutely required
- `product_submissions` status constraint
- image pipeline scripts

## Verification

Minimum targeted checks:

```bash
npm run typecheck
npm run products:intake:core:typecheck
npm run products:intake:review-cockpit:typecheck
npm run products:intake:review-cockpit:lint
npm run products:intake:review-cockpit:build
npx tsx --test tests/product-intake-research-jobs.test.ts
```

Full gate before handoff if feasible:

```bash
npm run ci:verify
```

Manual smoke:

1. Start the internal app locally.
2. Open the queue page.
3. Confirm pending submissions are visible.
4. Queue a job for one submission.
5. Run the Codex worker skeleton.
6. Confirm job state changes are visible in the app.
7. Queue five jobs and confirm at most two are claimed when concurrency is 2.
8. Confirm no product publish/apply command runs.

## Stop Lines

Stop and ask Nick before:

- moving the root app into `apps/chaarlie-web`
- changing customer-facing routes
- adding direct model API billing
- invoking real Codex CLI research in Phase 1 without a separate approval
- applying product approval/publish writes
- adding artifacts/decisions tables before their later phase

## Risks

- Workspace setup can accidentally change root app typecheck/build behavior. Keep root scripts verified.
- npm workspace lockfile changes can be large. Review `package-lock.json` carefully.
- A separate app can duplicate styling or environment patterns. Keep Phase 1 UI minimal.
- Job claim RPC is new concurrency logic. Test the active-status uniqueness and stale-lock behavior.
- Supabase migrations must remain additive and avoid changing `product_submissions`.

## Handoff

Recommended execution mode:

- sequential main-agent implementation for workspace/migration skeleton
- optional subagent review after the scaffold compiles
- no subagent should execute Supabase apply/publish actions

Implementation goal contract:

```text
Implement plans/2026-06-30-product-intake-review-cockpit-phase-1.md in the existing product-intake worktree. Keep customer-facing app behavior unchanged, preserve unrelated dirty files, add only the Phase 1 workspace/app/jobs/worker skeleton scope, run the listed checks, run review, and stop before commit/push/PR for explicit approval.
```

## Claude Review Integration

Claude review completed on 2026-06-30:

```text
plans/2026-06-30-product-intake-review-cockpit-phase-1.claude-review.md
```

Accepted fixes:

- Collapse duplicate queue endpoints into one queue API.
- Exclude/scope `apps` and `packages` from root customer-app typecheck/lint behavior, and add separate workspace checks.
- Prescribe RLS-enabled table setup with service-role policy and revoked anon/authenticated table access.
- Use `SECURITY DEFINER`, fixed `search_path`, and explicit execute grants for RPCs.
- Implement claim with `FOR UPDATE SKIP LOCKED`.
- Make enqueue/retry update an existing non-terminal job instead of blindly inserting into the partial unique index.
- Add the `updated_at` trigger explicitly.
- Keep the worker script thin, use the script-side Supabase env helper pattern, and put typechecked logic in the shared package where possible.
- Use plain app-local CSS for Phase 1.

No unresolved Phase 1 product decisions remain.

## Follow-On Cockpit Extension

After Nick tested the Phase 1 shell, the next slice was implemented on top of
this same worktree so the cockpit is not only inspectable:

- added durable `product_intake_research_artifacts`
- added durable `product_intake_review_decisions`
- added a guarded `product_intake_request_rework_job` RPC
- added detail-page controls for research, comments, product-level rework,
  publish preflight, and fail-closed publish testing
- updated the Codex worker skeleton to write preview artifacts for identity,
  property, and image review visibility

The extension still does not apply migrations, run real Codex CLI research,
process final images, publish product rows, or notify users without explicit
follow-up approval.
