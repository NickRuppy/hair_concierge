# Product Intake Review Cockpit And Research Worker Plan

Date: 2026-06-30
Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke`
Branch: `codex/product-intake-full-flow-smoke`
Status: alignment draft after Nick decisions; needs another Claude review after decisions settle

## Goal

Replace the current local package-review app mindset with a durable product-intake review cockpit.

When a user submits an unknown product, the system should:

1. Automatically create or update a research job.
2. Research product identity, duplicate matches, product properties, sources, and image candidates.
3. Produce a confidence-scored preview for Nick.
4. Let Nick approve, request rework, request more info, link an existing product, or reject from one clear surface.
5. Publish the product only after explicit final approval.
6. Upload the final image, write product/spec rows, link `user_product_usage`, update `product_submissions`, and notify the user.

The review app should make work visible. Nick should never wonder whether research, image search, rework, upload, publish, or notification is happening.

Nick decision update:

- The review cockpit must not be a route inside the customer-facing Chaarlie app.
- The v1 reviewer is Nick as solo operator.
- The v1 research runtime should use Codex CLI/subagents from Nick's local machine, not a direct model API-key worker.
- A later production worker can replace the Codex CLI runner if volume, cost, or reliability require it.

## Source Context

Current useful pieces:

- `product_submissions` already stores raw submissions, status, reviewed metadata, and `researched_payload`.
- `user_product_usage` already links pending and approved products back to the user's routine.
- `src/lib/product-intake/submissions.ts` creates `pending_review` submissions.
- `src/lib/product-intake/product-matching.ts` and `product-lookup.ts` already contain conservative matching and candidate logic.
- `src/lib/product-intake/review-workflow.ts` validates whether a researched payload is approval-ready.
- `scripts/product-intake/approve.ts`, `approve-package.ts`, and `review-actions.ts` already perform dry-run/apply/link-existing/request-info/reject flows.
- `src/lib/product-intake/notifications.ts` already sends the user-facing review result notification with an idempotent notification claim.
- `scripts/product-intake/review-app.ts` proves the preview/review UI concept and contains some useful source/image helpers, but it should not constrain the new internal app architecture.
- `scripts/product-intake/research-queue.ts` proves queue inspection and local package generation but is not a durable worker.
- `scripts/product-intake/prepare-research.ts` owns the current local package contract under `ops/product-intake-research` and must be part of the migration/deprecation map.
- `scripts/product-images/` and `docs/product-image-background-removal.md` contain the existing background-removal/cutout pipeline and must be reused for final image processing where possible.

Current pain:

- Local package files hide work state from the user and from production.
- The review app mixes research, review, image processing, and approval without a clean job model.
- Nick's comments are saved only as local decisions and require Codex/operator follow-up.
- Image search is not trustworthy enough without candidate scoring and visible rejection reasons.
- There is no durable "in the works" state that survives beyond the local Codex session.

## Chosen Direction

Build Option B from the mockup:

```text
Durable DB-backed research jobs + separate internal review app + Codex CLI research runner + explicit publish handoff.
```

Preview mockup:

```text
.tmp-previews/product-intake-review-cockpit/index.html
```

Why this direction:

- It keeps Nick in control of final approval while removing manual babysitting.
- It makes every stage visible and auditable.
- It lets Codex do the research work in a structured, repeatable way instead of relying on ad hoc chat messages.
- It creates enough history to later consider auto-publishing high-confidence products.

Rejected directions:

- Polish the current local package app only: too much hidden state, not scalable, still depends on Codex/local files.
- Build this as `/admin/product-intake` inside the customer-facing Chaarlie app: wrong product boundary for an internal ops cockpit.
- Make the v1 worker a direct OpenAI/Anthropic API-key service: cleaner for production, but Nick wants to use Codex CLI for the agentic research loop first.
- Auto-publish high-confidence products now: too risky before we have review history, image-judge reliability, and duplicate-match confidence.

Implementation handoff shape:

- This document is the strategy and north-star plan.
- Do not execute it as one large implementation task.
- Before implementation, split it into per-phase plans. Phase 1 should be the first executable handoff: durable state, worker skeleton, and cockpit shell.
- Each phase plan must include concrete write scope, acceptance criteria, and verification commands.

## Scope

In scope:

- Durable job state for research, image search, rework, publish preview, and publish execution.
- A separate internal review app in the same repo, not a customer-app admin page.
- A Codex CLI runner that can pick up jobs, perform product research, compare images/properties, and write structured artifacts back to the job store.
- Research pipeline that combines deterministic source adapters, existing catalog comparison, Codex/LLM structured extraction, and Codex/vision image judging.
- Source-backed property confidence and field-level review.
- Scored image candidate selection against product identity and existing good catalog images.
- One explicit final publish action that performs the current approval workflow safely.
- User notification after successful publish.
- Local/dev script compatibility during migration.

Out of scope for the first implementation:

- Fully always-on cloud automation independent of Nick's machine.
- Multi-user reviewer roles and enterprise-style access management.
- Replacing Codex CLI with a direct API-key worker.
- Fully automatic product publishing without Nick review.
- Making user-submitted products globally recommended.
- Rewriting the recommendation engine.
- Broad web crawling without source allowlists, evidence capture, and rate controls.
- Building a perfect universal product database. The first target is reliable intake for submitted products.

## Decision Register

These are the decisions the plan corrals. Recommended answers are chosen for the implementation plan unless Nick overrides them.

| Decision | Recommended Choice | Why | Tradeoff |
| --- | --- | --- | --- |
| Source of truth | Supabase job/artifact tables, not local package files | Durable, inspectable, works outside Codex thread | Needs migrations and admin APIs |
| Review surface | True separate internal Next app in this repo, e.g. `apps/product-intake-review` | Clean ops boundary without a second repo | Phase 1 must pay real workspace/shared-package setup cost |
| V1 model runtime | Codex CLI runner on Nick's machine | Uses the agent Nick already wants for research/reasoning | Not truly cloud always-on; depends on local Codex auth/session and machine availability |
| Access | Local no-login for dev; simple protected deployment later | Matches solo-operator workflow | Not a multi-user admin system |
| Final approval | One review-app button: `Publish product & notify user`, with preflight preview and confirm | Matches Nick's desired one-step handoff | Needs strong server-side guards |
| Auto-publish | No for v1 | Trust must be earned with audit history | Nick still reviews every product initially |
| Research cadence | Local Codex CLI runner plus manual retry buttons; schedule with launchd/cron only after stable | Runs without hand-prompting Codex chat | Laptop/session must be available unless a later cloud worker is added |
| Research method | Deterministic adapters first, Codex CLI synthesis second | Avoids guesswork and captures evidence | Requires prompt/run contract and artifact parsing |
| Image method | Multiple candidates, Codex/vision judge, local processing QA, existing-image comparison | Gives confidence and avoids wrong product images | Slower per product and dependent on CLI runner |
| Rework flow | Nick marks all image/property issues, then clicks `Rework product` once | One Codex task can reason over the whole product and avoid fragmented fixes | Requires explicit rework action instead of every comment auto-running |
| Catalog duplicates | Always compare against all active intake-dedupe products, including non-recommended | Prevents duplicate user-submitted rows | Requires good match UI for ambiguous cases |
| User notification | Existing notification path after publish | User gets the product when it is usable | Must be idempotent and retry-safe |

## Target State Model

### User-facing submission lifecycle

Keep `product_submissions.status` aligned with the existing DB constraint for v1. Do not add `rework_requested` or `publishing` to `product_submissions.status` unless a separate migration explicitly drops/re-adds the status check and audits all consumers.

Allowed submission statuses today:

- `pending_review`: user submitted; research job should exist or be created.
- `researching`: worker has claimed or is actively preparing preview.
- `ready_for_review`: preview is complete enough for Nick.
- `approved`: product row/specs/user link succeeded and notification has been handled or stored for retry.
- `matched_existing`: submission linked to an existing product.
- `needs_more_info`: user must clarify or upload better evidence.
- `rejected`: submission cannot be used.
- `cancelled_by_user`: user cancelled the submission; cockpit should show it only in history/terminal filters.

Detailed operational stages live on `product_intake_research_jobs`, not on the submission row:

- `queued`
- `running`
- `waiting_for_review`
- `waiting_for_rework`
- `publish_preflight`
- `publishing`
- `blocked`
- `failed`
- `done`

The internal cockpit may still show friendly lane names such as `Rework requested` and `Publishing`, but those should be projections from job status/stage plus review decisions.

### New DB tables

Additive migration only. Do not remove existing fields.

#### `product_intake_research_jobs`

One active job per open submission.

Fields:

- `id uuid primary key`
- `submission_id uuid references product_submissions(id)`
- `status text`
- `stage text`
- `priority int default 0`
- `attempt_count int default 0`
- `max_attempts int default 3`
- `locked_by text`
- `locked_at timestamptz`
- `started_at timestamptz`
- `completed_at timestamptz`
- `next_run_at timestamptz`
- `last_error text`
- `progress jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Statuses:

- `queued`
- `running`
- `waiting_for_review`
- `waiting_for_rework`
- `publish_preflight`
- `publishing`
- `blocked`
- `failed`
- `done`

Stages:

- `identity`
- `source_research`
- `property_research`
- `image_search`
- `image_judging`
- `preview_build`
- `rework`
- `publish_preflight`
- `publish`
- `notify`

Guards:

- unique partial index for one non-terminal job per submission.
- optimistic claim RPC so two workers cannot research the same submission at once.
- retry with backoff for recoverable source/API failures.
- stale lock TTL, initially 10 minutes unless production runtime limits force shorter.
- max-attempt cutoff that moves a job to `blocked` with a visible `last_error`.
- one claimed job per Codex subprocess, with the local runner allowed to manage bounded parallel subprocesses.

#### `product_intake_research_artifacts`

Append-only evidence and generated outputs.

Fields:

- `id uuid primary key`
- `job_id uuid references product_intake_research_jobs(id)`
- `submission_id uuid references product_submissions(id)`
- `kind text`
- `status text`
- `payload jsonb`
- `confidence numeric`
- `source_urls text[]`
- `model text`
- `prompt_version text`
- `created_at timestamptz`

Kinds:

- `identity_candidate`
- `existing_product_match`
- `source_page`
- `property_extract`
- `property_synthesis`
- `image_candidate`
- `image_judgment`
- `processed_image`
- `publication_preview`
- `publish_result`

#### `product_intake_review_decisions`

Field-level and package-level human review decisions.

Fields:

- `id uuid primary key`
- `submission_id uuid references product_submissions(id)`
- `job_id uuid references product_intake_research_jobs(id)`
- `field_path text`
- `decision text`
- `proposed_value jsonb`
- `reviewer_value jsonb`
- `comment text`
- `reviewed_by text`
- `reviewed_at timestamptz`
- `resolved_at timestamptz`
- `created_at timestamptz`

Decisions:

- `approved`
- `change_requested`
- `image_approved`
- `image_rejected`
- `publish_approved`
- `needs_more_info`
- `reject`

### Existing fields to keep

Keep `product_submissions.researched_payload` as the final compact approval payload for compatibility with current scripts/RPCs. Treat job/artifact tables as the research and review history. When a preview is ready, write the normalized preview payload into `researched_payload`.

## Research Worker

### Entry points

Implement a worker boundary that can be called from:

- local Codex CLI runner during v1.
- internal app retry button for a single submission.
- optional local schedule once stable, for example launchd or cron on Nick's machine.
- later cloud/API worker only if we move from Codex CLI to direct model APIs.

Candidate files:

- `src/lib/product-intake/research-worker/`
- `src/lib/product-intake/research-worker/codex-cli.ts`
- `scripts/product-intake/codex-research-worker.ts`
- `apps/product-intake-review/app/api/jobs/[id]/run/route.ts`

The local script and the internal app should call the same job/library boundary, not duplicate logic.

The runner should claim up to two jobs at once by default. Each claimed job gets its own Codex invocation, logs, prompt packet, output artifact, and status trail. If Nick queues five products, all five should appear immediately as queued/running in the app, but only two should be actively researched at the same time; the remaining three wait until a slot opens.

Default concurrency:

- `PRODUCT_INTAKE_CODEX_CONCURRENCY=2`
- debug fallback: `PRODUCT_INTAKE_CODEX_CONCURRENCY=1`
- higher values are deferred until the runner has stable logging, retry, and rate-limit behavior.

Codex CLI runner contract:

- Claim a single job.
- Build a bounded prompt packet from submission, sources, existing product candidates, prior decisions, and current package state.
- Invoke Codex CLI in non-interactive mode with an explicit output file path.
- Require structured JSON output plus human-readable notes.
- Store the prompt packet, run metadata, output JSON, notes, and errors as artifacts.
- Mark progress before and after the CLI run so Nick can see what is happening.
- Never let Codex CLI directly apply final DB/product writes. Publish still goes through the explicit reviewed publish path.

This means v1 does not require a separate OpenAI/Anthropic API key for product research if Nick runs it through his local Codex CLI login. It does mean the worker inherits Codex CLI/session limits and is not a fully cloud-native production worker.

Audit `scripts/product-intake/review-app.ts` and `scripts/product-intake/research-queue.ts` before rebuilding research/image behavior. Reuse helpers that are clearly correct and separable; rewrite prototype-bound pieces from scratch when that gives a cleaner internal app and worker contract.

### Worker steps

1. Claim jobs.
   - Find `pending_review`, `researching`, or `ready_for_review` submissions with no active job or stale job.
   - Find submissions with unresolved `change_requested` decisions and no active rework job.
   - Claim with an RPC or conditional update on `locked_at`.
   - Record visible progress immediately.

2. Load submission context.
   - Raw submission text.
   - User uploaded images.
   - Conversation/product usage context.
   - Existing `user_product_usage`.

3. Identity and duplicate check.
   - Use `matchProductIntake` and `loadCatalog({ eligibilityMode: "intake_dedupe" })`.
   - Compare identifiers, brand, product line, clean name, category, known titles, and retailer SKU/URL.
   - If exact existing product is found, produce a link-existing preview rather than a new product preview.
   - If ambiguous, produce review candidates with reasons.

4. Source gathering.
   - Audit existing source helpers from `review-app.ts` before adding new adapters.
   - Reuse them only where they are cleanly separable from the local package UI.
   - Source adapters first:
     - dm product API/page.
     - Rossmann/product retailer pages when available.
     - official brand/manufacturer page.
     - existing catalog row evidence for similar products.
   - Generic web search only as fallback and only with evidence capture.
   - Store source snapshots/excerpts as artifacts.

5. Property extraction.
   - Use deterministic parsers where possible for identifiers, price, URL, image, and category.
   - Use Codex CLI structured extraction for category-specific fields.
   - Every non-obvious field must include:
     - proposed value
     - confidence
     - source references
     - rationale
     - conflict notes
   - Low-confidence or conflicting fields should be review-highlighted, not hidden.

6. Image search and judging.
   - Audit existing image candidate gathering and rejection helpers from `review-app.ts` before adding new code.
   - Reuse them only where they are cleanly separable from the local package UI.
   - Gather multiple candidates:
     - user front photo if it is clean and exact
     - official image/CDN
     - retailer packshot
     - manufacturer asset/DAM
   - Reject obvious bad candidates before vision:
     - lifestyle/model/regal/bathroom images
     - wrong brand/line/token mismatch
     - low resolution
     - dark reflective background likely to fail cutout
   - Run vision judge on remaining candidates:
     - exact product identity
     - visible full packaging
     - packaging variant/size match
     - foreground/background quality
     - suitability for cutout
   - For v1, the vision judge can be part of the Codex CLI task if the CLI/runtime supports the needed image inputs. If not, the job should fall back to deterministic checks plus a visible `needs_manual_image_review` blocker.
   - Compare processed result against existing good catalog images for:
     - object scale
     - margin
     - background consistency
     - aspect ratio
   - Store all candidate scores and rejection reasons.

7. Build preview payload.
   - Write normalized `researched_payload.final`.
   - Write artifacts for review rows.
   - Mark job `waiting_for_review`.
   - Mark submission `ready_for_review` when validation passes.

8. Handle rework.
   - Nick reviews the whole product and marks all image/property issues first.
   - Comments create unresolved `product_intake_review_decisions` with `change_requested`, but do not automatically launch one job per comment.
   - Nick clicks `Rework product` when done marking issues.
   - The app creates one product-level rework job that includes all unresolved comments, image notes, property notes, prior sources, and previous candidate artifacts.
   - Codex runner re-researches the product as one coherent task and patches affected fields/images where possible.
   - Worker marks prior decisions resolved when the proposed value changes or records why a comment could not be resolved.
   - Cockpit shows before/after for the reworked product and returns the full product to review.

9. Publish preflight.
   - Dry-run the existing approval logic through `buildApprovePackageDryRun` or the shared equivalent extracted from it.
   - Show exactly what will happen:
     - product row create/link
     - spec rows
     - image upload path
     - user usage link
     - notification
   - Block publish if any required review decision is unresolved.

10. Publish.
   - Admin-only action.
   - Confirm dialog before write.
   - Set `product_intake_research_jobs.status = 'publishing'`; do not write `publishing` to `product_submissions.status`.
   - Run the same apply path as `approveSubmissionById` / `approve-package --apply --confirm`.
   - Store `publish_result` artifact.
   - Send notification through `notifyReviewResult`, which delegates to `sendProductIntakeReviewNotification`.
   - Mark terminal submission state.

## Review Cockpit UX

### Route

Build the durable app as a separate internal Next app:

```text
apps/product-intake-review/app/page.tsx
apps/product-intake-review/app/submissions/[submissionId]/page.tsx
```

Do not place this under `src/app/admin` in the customer-facing app.

Access model for v1:

- local development: no Chaarlie login required.
- protected deployment later: one simple outer gate such as Vercel protection or Google/Vercel login.
- no multi-user reviewer role system in v1.
- dangerous write actions still require explicit confirmation and server-side idempotency.

### Queue view

Left side or main table lanes:

- `Needs Nick`
- `Researching`
- `Rework requested`
- `Ready to publish`
- `Published`
- `Blocked`

Each row should show:

- product name / brand / category
- user/source
- stage
- confidence score
- image status
- number of unresolved field comments
- last worker update timestamp
- next action

### Detail view

Top summary:

- product identity
- duplicate-match status
- publish readiness
- last worker run
- blocking issues

Sections:

1. Identity and duplicate matches.
   - Proposed canonical brand/line/name/category.
   - Existing product candidates with match reasons.
   - Action: create new, link existing, request more info.

2. Image candidates.
   - Show all candidates with source, score, rejection reason, and vision explanation.
   - Show selected raw candidate and processed final image.
   - Show comparison row against existing good DB images.
   - Action: approve image, choose another, request new search.

3. Properties.
   - Table with field, proposed value, confidence, source, rationale, decision.
   - Inline comments create unresolved change requests.
   - `Rework product` creates one product-level Codex task from all unresolved image/property comments.
   - `Approve all high-confidence fields` can approve only fields above threshold and leaves low-confidence fields open.

4. Publish preview.
   - Dry-run result.
   - DB writes that will happen.
   - User notification preview.
   - One final `Publish product & notify user` button.

### User feedback requirements

The app must always answer:

- Is anything running right now?
- What stage is it in?
- When did it last update?
- What is blocked?
- What happens if I click this button?
- Did my comment become a rework job?
- Is this ready to publish?
- Was the user notified?

No silent buttons. Any action that starts work must create a visible job row or progress state before doing slow work.

## Internal App Routes And Server Libraries

Suggested route map:

- `GET /api/queue`
- `GET /api/submissions/:id`
- `POST /api/submissions/:id/research`
- `POST /api/submissions/:id/rework`
- `POST /api/submissions/:id/review-decision`
- `POST /api/submissions/:id/publish-preflight`
- `POST /api/submissions/:id/publish`

Local routes may be no-login in dev. If the app is deployed, protect the deployment and require a simple internal app secret/session for write routes. Do not require Nick to log in with Chaarlie user credentials for v1.

Suggested library modules:

- `src/lib/product-intake/research-worker/jobs.ts`
- `src/lib/product-intake/research-worker/codex-cli.ts`
- `src/lib/product-intake/research-worker/identity.ts`
- `src/lib/product-intake/research-worker/sources.ts`
- `src/lib/product-intake/research-worker/properties.ts`
- `src/lib/product-intake/research-worker/images.ts`
- `src/lib/product-intake/research-worker/preview.ts`
- `src/lib/product-intake/research-worker/publish.ts`
- `src/lib/product-intake/research-worker/types.ts`

## Confidence Model

Use evidence bands first, not a mysterious single LLM confidence. In v1, confidence helps Nick triage but does not auto-publish products.

Identity confidence:

- identifier exact match
- brand match
- product line/name match
- category match
- source reliability
- conflict count

Property confidence:

- field source reliability
- direct textual evidence
- category schema validation
- conflict count
- LLM extraction agreement across sources

Image confidence:

- identity token/GTIN/source match
- vision product match
- packshot suitability
- resolution
- background/cutout suitability
- processed-image QA
- similarity to existing product image standards

UI should show confidence bands:

- high: green
- needs skim: neutral/blue
- needs Nick: amber
- blocked/wrong: red

Do not allow confidence to replace evidence. Every field still needs source/rationale.

Defer a full numeric weighted confidence model until the cockpit has enough review history to calibrate it. The first implementation should store the ingredients needed for scoring, but the UI should lead with evidence, source quality, conflict notes, and clear review state.

## Migration Strategy

This strategy must be executed as separate PR-sized phase plans. Claude review explicitly rejected using this whole document as one subagent handoff.

### Phase 1: Durable state and cockpit shell

- Add workspace/shared-package setup required for a true separate internal app.
- Keep the customer-facing Chaarlie app behavior unchanged during the workspace transition.
- Add DB table/RPCs for `product_intake_research_jobs` only.
- Defer `product_intake_research_artifacts` until Phase 2, when research output first reads/writes artifacts.
- Defer `product_intake_review_decisions` until Phase 4, when field/image comments first create rework decisions.
- Add separate internal app shell under `apps/product-intake-review`.
- Add queue/detail routes with read-only data.
- Keep local package app available as fallback.
- Add Codex CLI worker skeleton that can claim and update a job without doing full research.
- Do not alter the `product_submissions.status` check constraint in this phase.

Exit criteria:

- A new submission creates or can be assigned a research job.
- Cockpit shows queued/running/review states.
- Nick can see whether work is in progress.

### Phase 2: Research preview worker

- Audit existing source helpers and identity/image URL extraction from `scripts/product-intake/review-app.ts` and `research-queue.ts`.
- Extract reusable helpers only when they are cleaner than a fresh implementation.
- Implement the Codex CLI prompt packet and structured output parser.
- Implement bounded parallel runner behavior with default concurrency 2.
- Implement identity duplicate check against `intake_dedupe` catalog eligibility.
- Implement property extraction/synthesis for currently supported categories.
- Write preview artifacts and `researched_payload.final`.
- Mark ready for review only when validation passes.

Exit criteria:

- Real product submissions reach `ready_for_review` without manual local package editing.
- Low-confidence fields are visible and reviewable.
- If five products are queued, the app shows five jobs and the runner processes at most two simultaneously.

### Phase 3: Image candidate and image judge

- Audit existing candidate gathering/rejection helpers and reuse only the clean pieces.
- Add Codex CLI image judging when image inputs are supported by the chosen local runner.
- Add visible fallback blockers when image judging cannot run automatically.
- Reuse the existing `scripts/product-images/` background-removal/cutout pipeline and `docs/product-image-background-removal.md` learnings where possible.
- Reuse existing final image processing/upload helpers through shared libraries where possible, not script-only code.
- Show comparison with existing DB images.

Exit criteria:

- Nick sees candidate images with reasons and can approve one.
- Wrong candidates have visible rejection reasons.
- Final image QA must pass before publish.

### Phase 4: Rework loop

- Comments create `change_requested` decisions.
- `Rework product` creates one product-level rework job from all unresolved comments.
- Worker updates targeted fields/images and marks decisions resolved.
- UI shows before/after.

Exit criteria:

- Nick can mark multiple property/image issues, click `Rework product` once, and see one live rework state for the full product.
- Reworked products return to `ready_for_review`.

### Phase 5: Publish handoff

- Build publish preflight by reusing `buildApprovePackageDryRun` or its extracted shared equivalent.
- Build one-click internal review-app publish action with confirm.
- Reuse `approveSubmissionById` / existing RPC paths for DB writes, image upload, user link, and notification.
- Store publish artifact and terminal status.

Exit criteria:

- Nick can publish a reviewed product from the cockpit.
- User is notified.
- Duplicate publish is idempotent.

### Phase 6: Hardening and automation

- Local Codex CLI runner schedule if Nick wants daily automation from his machine.
- Optional protected deployment for the internal app.
- One claimed job per Codex CLI invocation until runtime metrics prove batching is safe.
- Retry/backoff/stale lock recovery.
- Sentry/logging.
- Metrics dashboard:
  - submissions per day
  - time to ready
  - rework rate
  - publish success rate
  - notification success
  - source/image failure reasons

Exit criteria:

- Daily operation does not depend on an active Codex chat thread, but may depend on Nick's local Codex CLI runner until a cloud worker is built.
- Nick reviews only preview/final handoff, not the hidden work.

## File Map

Likely new files:

- `supabase/migrations/YYYYMMDDHHMMSS_product_intake_research_jobs.sql`
- `apps/product-intake-review/package.json`
- `apps/product-intake-review/app/page.tsx`
- `apps/product-intake-review/app/submissions/[submissionId]/page.tsx`
- `apps/product-intake-review/app/api/queue/route.ts`
- `apps/product-intake-review/app/api/submissions/[id]/route.ts`
- `apps/product-intake-review/app/api/submissions/[id]/research/route.ts`
- `apps/product-intake-review/app/api/submissions/[id]/review-decision/route.ts`
- `apps/product-intake-review/app/api/submissions/[id]/publish-preflight/route.ts`
- `apps/product-intake-review/app/api/submissions/[id]/publish/route.ts`
- `src/lib/product-intake/research-worker/jobs.ts`
- `src/lib/product-intake/research-worker/identity.ts`
- `src/lib/product-intake/research-worker/codex-cli.ts`
- `src/lib/product-intake/research-worker/sources.ts`
- `src/lib/product-intake/research-worker/images.ts`
- `src/lib/product-intake/research-worker/properties.ts`
- `src/lib/product-intake/research-worker/preview.ts`
- `src/lib/product-intake/research-worker/publish.ts`
- `src/lib/product-intake/research-worker/types.ts`
- `scripts/product-intake/codex-research-worker.ts`
- `tests/product-intake-research-worker.test.ts`
- `tests/product-intake-review-cockpit.test.tsx`

Likely files to refactor:

- `scripts/product-intake/review-app.ts`
- `scripts/product-intake/research-queue.ts`
- `scripts/product-intake/finalize-package-image.ts`
- `scripts/product-intake/approve-package.ts`
- `scripts/product-intake/prepare-research.ts`
- `scripts/product-images/`
- `src/lib/product-intake/repository.ts`
- `src/lib/product-intake/review-workflow.ts`
- `src/lib/product-intake/notifications.ts`
- `src/lib/product-intake/category-validators.ts`

## Safety And Trust Requirements

- No production DB writes from research worker except job/artifact/decision state.
- Codex CLI runner may research, propose, and write artifacts, but must not directly apply final product DB writes.
- Publish is the only step that writes product/spec/link/notification outcome.
- Publish must be explicit, confirmed, and idempotent.
- Local v1 may run without Chaarlie login, but deployed write routes need a simple protected-app secret/session.
- Publish preflight must run immediately before publish.
- If a product may already exist, the cockpit must offer link-existing rather than create duplicate.
- Any LLM output must be source-backed and schema-validated.
- If sources conflict, the UI must show conflict rather than picking silently.
- If image judge is uncertain, require Nick to choose or request more info.
- If notification fails after product write, store a retryable notification state.
- Do not set `product_submissions.status = 'approved'` or `matched_existing` without `approved_product_id`, matching the existing DB success-product constraint.

## Verification Plan

Each phase plan must name the exact commands it expects to pass. Default project gates:

- targeted unit/integration tests for the changed product-intake modules.
- `npx tsc --noEmit --pretty false`
- `npm run ci:verify` before a final ship handoff, unless the phase plan explicitly explains why it is too broad for that PR.

Unit tests:

- job claim/retry/stale-lock logic
- artifact append and latest preview projection
- duplicate candidate scoring
- property confidence scoring
- image candidate rejection/scoring
- rework decision lifecycle
- publish preflight idempotency

Integration tests:

- pending submission to queued job
- queued job to ready preview
- ready preview to `waiting_for_rework` job state after a comment
- rework job back to ready preview
- ready preview to publish preflight
- publish to approved plus user notification
- matched-existing path
- needs-more-info path

Browser tests:

- queue shows running/rework/ready/published lanes
- detail page shows progress, last update, blockers
- comments create rework state visibly
- publish button shows confirm and result
- no silent buttons

Manual smoke:

- Submit a real product in chat.
- Confirm job appears without manual command.
- Let worker research it.
- Review image and properties.
- Request one property rework.
- Confirm rework job appears.
- Approve after rework.
- Publish.
- Confirm user can use product in chat and receives notification.

## Open Risks

- Source availability: retailer pages and APIs change. Need source adapters with visible failures.
- LLM confidence can be over-trusting. Use source-backed fields and hard schema validation.
- Vision judge may miss subtle packaging variants. Keep Nick review for all products in v1.
- Image background removal quality varies. Keep QA and existing-image comparison.
- Supabase migration/status expansion can affect existing scripts. Phase 1 avoids status expansion and keeps detailed progress on job tables.
- Access mistakes could expose product-intake operations. Keep v1 local or protected by an outer deployment gate before adding public deployment.
- Codex CLI runner reliability depends on local machine availability, local Codex auth, and plan/session limits.

## Nick Decisions To Confirm Before Implementation

1. Should the durable cockpit be built as a separate internal Next app in this repo, not as a Chaarlie admin page?
   - Decision: yes.

2. Should all products require Nick review in v1, even high-confidence ones?
   - Decision: yes. All products require Nick review in v1, even high-confidence ones.

3. Should final publish be a one-button cockpit action after preflight and confirm, instead of copying a CLI command?
   - Decision: yes.

4. Should the first production worker run on a schedule, on-demand, or both?
   - Decision: local Codex CLI runner plus manual retry buttons first; local schedule once stable; cloud schedule later only if the worker moves to direct model APIs.

5. Should rework comments automatically start re-research, or should Nick mark all issues and kick off one product-level rework task?
   - Decision: Nick marks all issues, then clicks `Rework product` once. One product-level Codex task handles image and property rework together.

6. Should local package files remain supported after the cockpit ships?
   - Decision: yes temporarily for debugging/backfill, but not as source of truth.

7. Should Phase 1 explicitly avoid changing `product_submissions.status` values and keep rework/publishing only on jobs?
   - Decision: yes. Do not add new workflow columns/states to `product_submissions` in Phase 1; keep detailed state on job/artifact/decision tables.

8. Should we commit to extracting from `review-app.ts` first, before adding new source/image research modules?
   - Decision: reuse only what is clearly valuable from `review-app.ts`; do not be constrained by it. New app/research UX may be built from scratch where cleaner.

9. Should the next artifact be a standalone Phase 1 implementation plan rather than editing this strategy document further?
   - Decision: yes.

10. Should v1 use Codex CLI as the agentic research runtime instead of direct OpenAI/Anthropic API calls?
   - Decision: yes.

11. Should the plan explicitly accept that Codex CLI v1 is local-runner automation, not a fully always-on cloud worker?
   - Decision: yes.

12. Should the v1 Codex runner process more than one product at once?
   - Decision: yes, default bounded concurrency is 2. Extra kicked-off products stay queued until a slot opens.

13. How should the separate internal app be implemented in this single-app repo?
   - Decision: pay the Phase 1 setup cost for a true separate internal app/workspace. Do not use the cheaper gated route-group shortcut.

## Claude Review Instructions

Ask Claude to review for:

- over-engineering versus necessary durable state
- missing product-intake state transitions
- risky Supabase migration assumptions
- unclear trust boundaries around LLM research and image judging
- missing idempotency/retry logic
- whether the plan should be split into smaller PRs

Claude review file:

```text
plans/2026-06-30-product-intake-review-cockpit.claude-review.md
```

## Claude Review Integration

Claude review completed on 2026-06-30 and recommended reshaping this as a strategy document plus per-phase implementation plans.

Accepted changes:

- Keep `rework_requested` and `publishing` off `product_submissions.status`; store them on job state.
- Include existing `cancelled_by_user` status in the lifecycle model.
- Reuse existing idempotent publish/notification guardrails, but do not require the customer app `is_admin` route pattern for the v1 internal app.
- Use bounded runner parallelism: one Codex invocation per job, default two jobs running at once.
- Audit `review-app.ts` and `research-queue.ts`, but allow fresh implementation where the prototype is the wrong base.
- Treat programmatic vision image judging as genuinely new work.
- Wire publish/preflight/notification to existing `approveSubmissionById`, `buildApprovePackageDryRun`, `notifyReviewResult`, and `sendProductIntakeReviewNotification`.
- Split execution into phase plans before implementation.

Nick alignment after Claude review:

- Review cockpit is a separate internal app in this repo, not `/admin/product-intake`.
- V1 uses Codex CLI/subagents as the research runtime.
- V1 access stays solo-operator simple: local no-login first, protected deployment later.
- Direct model API keys and fully cloud-native workers are deferred.

## Aligned Claude Review Integration

Claude review completed again after Nick's alignment decisions and approved the strategy with revisions.

Accepted changes:

- Phase 1 should add only `product_intake_research_jobs`; artifacts and review decisions move to the phases that first consume them.
- Phase 3 must explicitly reuse the existing `scripts/product-images/` cutout/background-removal pipeline and documented learnings.
- `scripts/product-intake/prepare-research.ts` must be included in the local package migration/deprecation map.
- The plan now states that `apps/product-intake-review` is not light setup in this repo because there is no workspace/shared-package structure yet.

Resolved after Nick decision:

- Keep the product decision of a true separate internal app and include workspace/shared-package setup in Phase 1.
