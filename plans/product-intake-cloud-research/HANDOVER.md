# Handover: cloud Product Intake research on Hetzner

Status: project handover, not an approved implementation plan  
Prepared: 2026-10-05  
Repository: `NickRuppy/hair_concierge`  
Supabase project: `pqdkhefxsxkyeqelqegq`

## 1. Intended outcome

Run the complete research preparation path for every newly confirmed unknown
product on the Hetzner server:

1. capture one canonical Product Intake submission regardless of the originating
   product channel;
2. research identity, sources, commercial data, image candidates, exact
   application instructions, and category properties;
3. route formula research through the owning category research engine whenever
   one exists;
4. project engine results deterministically into the Product Intake payload;
5. prepare and visually judge the product image in the cloud;
6. loop unclear or defective work through bounded rework;
7. notify Nick only when a coherent review package is ready or a genuinely
   human decision is needed; and
8. preserve Nick's explicit final approval before catalog publication, user
   linking, or user notification.

The desired result is a submission page that is already ready for catalog-intake
review when Nick opens it. A few explicitly uncertain facts are acceptable.
Nick remains the final reviewer and may resolve the last one to three uncertain
properties. One further research/rework round may then prepare the product for
the guarded catalog handoff.

## 2. Decisions already made with Nick

- Use the purchased Hetzner server for the long-running worker. The working
  assumption is the smallest 4 GB server in Frankfurt; the exact server type,
  host, operating system, and current service state must be verified before
  planning deployment.
- All product channels converge on one Product Intake workflow. The upstream
  channel must not create a separate research database or alternate catalog.
- An unknown scan's dm lookup is an optional fast enrichment lead. It is not
  the authoritative research run and it must not block the user journey.
- For the current scan flow, user confirmation is the event that creates the
  submission. A lookup attempt or a dm `not found` response alone is not a cloud
  research trigger.
- Use the main Codex account through Codex CLI device-code authentication for
  now. Device-code authorization was enabled during the earlier setup. The
  server login and its survival across service restarts still need a fresh
  operational check. Never commit credentials or copy auth state into Git.
- Routine production research: GPT-6 Luna at low reasoning effort.
- Bounded comparison: GPT-6 Luna at medium reasoning effort.
- Research/output judge: GPT-6 Sol at medium reasoning effort.
- GPT-6 Astra is excluded and is rejected by the worker configuration.
- Standard processing is the default. Fast service tier is opt-in for an
  explicitly expedited run.
- Prefer local processing on Hetzner when it is reliable and avoids a paid
  image API. External/cloud APIs remain allowed where they are the better tool.
- Run at concurrency one on the 4 GB server while local image processing is
  enabled.
- The visual judge must specifically check shadows and reflections, outer or
  secondary packaging, extra objects, halos and edge residue, rectangular
  background remnants, jagged cutouts, and accidentally removed product
  content.
- The visual judge is advisory. A model `pass` never becomes a human image
  approval or publication authority.
- The eventual review surface should live in Nick's admin area as a separate
  navigation item, with an inbox/email notification when review is genuinely
  ready. The existing cockpit is currently an internal no-login surface and
  must not be exposed publicly without an authentication/protection design.

## 3. What already exists

### 3.1 Merged Product Intake worker and image work

PR #615, merge commit `14127b07cefd40c40c0b2d9eb76267ed966818e4`, added:

- the durable worker model configuration;
- Luna/low production research;
- a bounded Luna/medium shadow challenger and Sol/medium anonymous judge;
- model-run and model-judgment telemetry artifacts;
- automatic, reversible image preparation behind configuration;
- Linux `rembg` processing through a pinned `isnet-general-use` container;
- neutral and magenta QA assets;
- a Sol/medium visual-quality judge;
- a compact five-example image reference manifest; and
- persistent finalized-image serving for the review cockpit.

PR #583, commit `7072124b`, added the optional dm enrichment lead to the unknown
scan path. The Product Intake worker treats this as provenance-tagged draft
evidence and must independently verify it.

The database migration set and the code are in `main`. An earlier work session
reported the relevant production migration as applied, but the next agent must
verify live migration and service state rather than treating that report as a
current production audit. Merging the code did not by itself authorize or prove
an always-on production worker.

### 3.2 Durable staging model

The intended separation is already represented in the schema:

| Concern                                                            | Authority                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| One lifecycle record for a user/internal unknown product           | `product_submissions`                                  |
| Durable work scheduling and leases                                 | `product_intake_research_jobs`                         |
| Research evidence, previews, model runs, image work, and judgments | `product_intake_research_artifacts`                    |
| Nick's approvals, rejections, and rework decisions                 | `product_intake_review_decisions`                      |
| Live catalog product                                               | `products` plus the category-specific authority tables |

Research fills the staging records. It does not write a product into the live
catalog. The guarded Product Intake handoff owns the production catalog write,
final image upload, user linking, and user notification.

### 3.3 Current queue trigger

The database trigger in
`supabase/migrations/20260701100000_product_intake_auto_enqueue.sql` runs after
an insert or a real status transition to `product_submissions.status =
'pending_review'`. It idempotently enqueues a `source_research` job.

This gives the canonical acquisition flow:

```text
unknown product in any product channel
  -> user confirms/submits it
  -> one product_submissions row reaches pending_review
  -> Supabase creates or reuses one open research job
  -> the externally supervised Hetzner worker claims it
```

Every product channel must be audited against this invariant. A channel that
does not create or transition the canonical submission row will not trigger the
cloud worker.

### 3.4 Other current worker triggers

The always-on worker can receive claimable work through:

| Trigger                                                         | Effect                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Insert/transition to `pending_review`                           | Automatically enqueue `source_research`                                      |
| Cockpit **Queue** action                                        | Enqueue/reuse an `identity` job                                              |
| Cockpit **Research** action                                     | Enqueue/reuse a `source_research` job                                        |
| Nick requests product or image rework                           | Move the existing job to `waiting_for_rework` / `rework`                     |
| Nick approves a raw image                                       | Requeue the existing job as `image_judging`                                  |
| Automatic image preparation is enabled and research is complete | Requeue the job as `image_judging` without creating a human approval         |
| Retry a `blocked` or `failed` job                               | Requeue the same stage immediately                                           |
| A `running` lock is stale                                       | Another worker may reclaim it after the stale interval (default ten minutes) |
| Worker restart                                                  | Claim already durable queued/rework/stale work                               |

When `PRODUCT_INTAKE_CODEX_WORKER_EXTERNAL=true`, cockpit actions only update
the durable queue. They do not start a detached local Codex worker. The Hetzner
worker is expected to be a separately supervised, continuously running process
polling approximately every 30 seconds. No webhook is required for correctness;
the durable queue is the source of truth and survives missed events or restarts.

### 3.5 Current model behavior

The merged default configuration is:

```text
PRODUCT_INTAKE_CODEX_RESEARCH_MODEL=gpt-6-luna
PRODUCT_INTAKE_CODEX_RESEARCH_REASONING_EFFORT=low
PRODUCT_INTAKE_CODEX_SHADOW_ENABLED=true
PRODUCT_INTAKE_CODEX_SHADOW_TARGET=10
PRODUCT_INTAKE_CODEX_CHALLENGER_MODEL=gpt-6-luna
PRODUCT_INTAKE_CODEX_CHALLENGER_REASONING_EFFORT=medium
PRODUCT_INTAKE_CODEX_JUDGE_MODEL=gpt-6-sol
PRODUCT_INTAKE_CODEX_JUDGE_REASONING_EFFORT=medium
```

The current shadow judge is measurement-only. It cannot replace the Luna/low
draft, change readiness, approve a decision, or publish. The current product
rework loop is still explicitly triggered by Nick; there is no autonomous
research-judge-research loop yet.

## 4. Category engines: current truth and target gap

The worker is category-aware, but it does **not** yet route every eligible
product through its owning category research engine.

| Category                                                                         | Existing engine                                                     | Current worker integration                                                                           | Required future state                                                                                                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Shampoo                                                                          | Shampoo v1.4 + Production Light v1                                  | Uses Shampoo-specific prompt/schema rules, but does not run the full engine/projection automatically | Freeze identity + canonical INCI, run Shampoo v1.4 methodology, retain the research envelope, then run Production Light deterministically |
| Conditioner                                                                      | Conditioner Standard v1.6 + Production Adapter v1                   | Integrated: prompt contract plus deterministic adapter                                               | Preserve and test this route as the reference implementation                                                                              |
| Leave-in                                                                         | Leave-In Standard v1.0 plus current overlay + Production Adapter v1 | Integrated: prompt contract plus deterministic adapter                                               | Preserve and test this route as the reference implementation                                                                              |
| Mask, Oil, Deep Cleansing, Bondbuilder, Heat Protectant, Dry Shampoo, Scalp Care | No registered engine in `docs/research/README.md`                   | Category-specific Product Intake prompt and validation contract only                                 | Continue the ordinary intake contract and record `engine_not_available`; do not invent a pseudo-engine                                    |

The larger project therefore needs an explicit category-engine router, not more
prompt text inside the generic worker.

The target engine sequence is:

```text
canonical identity + category + canonical INCI
  -> select registered engine and exact semantic version
  -> run blind formula-first research
  -> persist immutable/versioned research envelope and provenance
  -> run deterministic production adapter
  -> merge projected category fields into the Product Intake draft
  -> separately research protocols, commerce, identity, and images
```

Shared engine invariants remain mandatory:

- formula-first research is blind to positioning until the contract explicitly
  permits claim-gated evidence;
- product truth is separate from user fit;
- ingredient presence does not prove concentration or experience;
- frozen research artifacts are immutable provenance;
- reusable rule changes update the normative standard and all consuming guides;
  and
- engine/projection readiness is never catalog readiness or publication
  approval.

Building an engine for any missing category is a separate calibrated project
using `docs/research/category-classification-engine-template.md`. Do not make a
new category engine as an incidental part of one product's intake.

## 5. Target end-to-end architecture

```text
Product channels
  scan confirmation / chat / onboarding / manual admin intake
        |
        v
product_submissions (staging source of truth)
        |
        v
Supabase enqueue trigger -> product_intake_research_jobs
        |
        v
Hetzner worker, one claim at a time
        |
        +-> generic evidence research
        |     identity, sources, price/link, candidate image, protocols
        |
        +-> category-engine router
        |     engine envelope -> deterministic adapter -> category DB fields
        |
        +-> image preparation
        |     alpha passthrough or rembg -> crop/normalize -> magenta + neutral
        |
        +-> judges
              structured research judge + visual-quality judge
        |
        +-> bounded automatic rework when policy permits
        |
        v
waiting_for_review / blocked with exact uncertainty
        |
        +-> admin navigation item + inbox/email notification
        |
        v
Nick reviews exact DB values, evidence, image, and remaining questions
        |
        +-> explicit rework, if needed
        |
        v
explicit guarded final handoff
        |
        v
products + category tables + product-images + user link + user notification
```

## 6. Image processing already proven in the pilot

The Linux path uses the digest-pinned image:

```text
danielgatis/rembg@sha256:98e72b790093dec3b21967e22c8eb75a0a67d458fdba7ef5fcc1900cad76396b
```

with `isnet-general-use`, no runtime network, and fixed process/CPU/RAM limits.
Clean-alpha sources pass through without model inference. Flat sources use the
container, then the normal Chaarlie finalizer, magenta QA, neutral background,
and visual judge.

Measured on the 4 GB pilot server:

- approximately 1.9 GiB peak container memory;
- approximately 4.2 GB container storage plus a 179 MB model cache;
- approximately 45 seconds cold startup and approximately three seconds per
  image once loaded;
- approximately 58 seconds end-to-end for the one flat pilot source requiring
  `rembg`;
- approximately 7-10 seconds for clean-alpha passthrough candidates; and
- zero idle container RAM after the one-at-a-time job finishes.

The five-image pilot produced review assets for all five candidates. Nick
accepted the final visual result after the first NEQI output's lower-left
rectangular residue was corrected. The retained manifest includes that failure,
the corrected result, clean Pantene, and acceptable dark-base examples. It is a
small calibration set, not training data and not permission to retain arbitrary
customer photos.

## 7. Deployment work still required

This is the larger project Nick is deferring. Before coding or production
activation, the next agent must run the normal `plan-hardening-loop` and obtain
explicit approval for the concrete deployment and user/admin journey.

At minimum, the implementation plan must cover these workstreams:

### A. Verify server and live state

- exact Hetzner host, server type, RAM/disk, Frankfurt location, OS, patch
  level, deploy user, SSH access, and backup/snapshot policy;
- current Codex CLI version, login state, available models, and noninteractive
  execution under the intended service user;
- Docker availability and the pinned image/model cache;
- current Supabase migration state and existing queued/running jobs;
- whether any pilot/review services are still running; and
- disk, memory, swap, and release-directory headroom alongside the separate
  price-audit workload.

### B. Create an explicit engine router

- versioned registry from category to engine, prompt contract, envelope schema,
  adapter, and boundary exclusions;
- automatic Shampoo engine/projection integration;
- preservation of Conditioner and Leave-in behavior;
- explicit `engine_not_available` behavior for unsupported categories;
- immutable engine artifacts and replay/idempotency rules;
- validation that engine output cannot bypass Product Intake blockers or human
  gates; and
- tests proving the same submission cannot mix engine versions.

### C. Define the autonomous judge/rework loop

The current judge is telemetry-only. A new policy must decide:

- which structured defects may automatically request another research pass;
- which facts must immediately escalate to Nick;
- maximum rework iterations and cost/time budgets;
- how fresh instructions supersede stale blockers without deleting provenance;
- how the final judge distinguishes `ready_for_human_review`,
  `needs_bounded_rework`, and `blocked_needs_human`;
- whether Luna/medium remains a challenger, becomes a conditional repair model,
  or is disabled after the first ten-job evaluation; and
- how every loop remains idempotent and lease-safe.

No judge may approve catalog publication or silently decide a consequential
uncertain fact on Nick's behalf.

### D. Supervise two server services

Create reviewed deployment artifacts for:

1. the Product Intake review app, bound to localhost or protected behind an
   authenticated admin surface; and
2. the Product Intake worker, running roughly:

```bash
npm run products:intake:codex-worker -- \
  --execute-codex --watch --concurrency=1 --poll-ms=30000
```

Use systemd or an equivalently durable supervisor with restart limits,
dependency ordering, resource limits, journald/log retention, deploy health
checks, and a rollback path. Store secrets in a root/service-readable
environment file outside Git. Keep shared model and finalized-image directories
outside atomic release folders.

Recommended shared paths from the existing contract:

```text
/opt/chaarlie/product-intake/shared/rembg
/opt/chaarlie/product-intake/shared/finalized-images
```

Set `PRODUCT_INTAKE_CODEX_WORKER_EXTERNAL=true` on the review service so it
cannot spawn a duplicate worker.

### E. Build the protected admin review and notification path

- add a separate Product Intake navigation entry to Nick's admin area;
- reuse the current cockpit evidence and controls rather than creating another
  review database;
- authenticate and authorize the surface;
- show queue/job stage, exact blockers, source provenance, category engine and
  version, engine envelope, projected DB values, raw/magenta/neutral images,
  both judge verdicts, and the remaining human questions;
- notify Nick only on a meaningful transition to human review, a hard blocker,
  or repeated failure—not on every poll; and
- make notification idempotent so restarts do not produce duplicates.

### F. Observe and roll out safely

- start with an explicitly bounded queue subset;
- keep `PRODUCT_INTAKE_AUTO_PREPARE_IMAGES` and the visual judge as separate
  feature switches;
- measure queue wait, research duration, image duration, total wall time, model
  calls, failures, rework count, human corrections, judge agreement, and cost;
- compare Luna/low with the bounded Luna/medium experiment before changing the
  production model;
- establish dead-worker/queue-age alerting;
- verify restart, stale-lock recovery, duplicate prevention, and disk cleanup;
  and
- require separate authorization for production service activation and any
  publish/database-write change.

## 8. Open decisions for planning

These were not settled by the earlier implementation and should be resolved in
the plan, not guessed during coding:

1. Should the review cockpit remain SSH/private, or be integrated directly into
   the existing authenticated admin deployment?
2. Which inbox/email provider and destination should carry review-ready alerts?
3. What exact autonomous rework policy and maximum loop budget are acceptable?
4. After the first ten judged jobs, does Luna/low remain production, does
   Luna/medium replace it, or does medium run only for low-confidence cases?
5. How should a submission be represented when identity/category is known but
   canonical INCI is unavailable, making the category engine impossible?
6. Which current product channels still bypass the canonical
   `product_submissions -> pending_review` trigger and need migration?
7. What operational uptime, backup, log-retention, queue-age, and cost limits
   are appropriate at the current traffic level?
8. Should deployment share the same release mechanism as the price-audit worker
   or use a separately isolated service/release tree?

## 9. Acceptance criteria for the eventual project

The project is not complete merely because a worker process starts. Completion
means:

- every audited unknown-product channel creates one canonical submission after
  its agreed confirmation event;
- a queued product survives server/app restarts and is processed exactly once
  per claimed attempt;
- Shampoo, Conditioner, and Leave-in use their registered engine and
  deterministic adapter; unsupported categories are honestly marked as such;
- the review record identifies engine name/version and retains the immutable
  input/output envelope;
- generic evidence, commercial fields, protocols, and images remain separate
  from formula-engine claims;
- image preparation and the visual judge run serially within the 4 GB envelope;
- the bounded judge/rework loop stops predictably and escalates remaining
  uncertainty;
- Nick receives one actionable review-ready or blocked notification;
- the admin page shows the complete evidence package and exact database values;
- no model decision records human approval or publishes a catalog product;
- the guarded final handoff still requires Nick's explicit action;
- monitoring detects a dead worker, growing queue, repeated failures, disk
  pressure, and authentication expiry; and
- rollback stops claims without losing durable submissions, artifacts, or
  decisions.

## 10. Authoritative files for the next agent

Read these before producing the implementation plan:

- `AGENTS.md`
- `.agents/skills/product-intake/SKILL.md`
- `.agents/skills/product-research-engine/SKILL.md`
- `docs/product-intake-research-ops.md`
- `docs/research/README.md`
- `docs/research/category-classification-engine-template.md`
- `docs/product-intake-shampoo-production-light.md`
- `docs/product-intake-conditioner-production-adapter.md`
- `docs/product-intake-leave-in-production-adapter.md`
- `plans/product-intake-model-routing.md`
- `scripts/product-intake/codex-research-worker.ts`
- `apps/product-intake-review/`
- `packages/product-intake-core/`
- `config/product-intake-image-qa-references.v1.json`
- `supabase/migrations/20260630120000_product_intake_research_jobs.sql`
- `supabase/migrations/20260630130000_product_intake_research_artifacts_decisions.sql`
- `supabase/migrations/20260701090000_product_intake_rework_resets_attempts.sql`
- `supabase/migrations/20260701100000_product_intake_auto_enqueue.sql`
- `supabase/migrations/20260925061101_product_intake_model_evaluation_artifacts.sql`
- `deploy/price-audit/` and `docs/price-audit.md` for the existing Hetzner
  systemd/release precedent and resource interaction—not as an authority to
  activate Product Intake.

## 11. Recommended first action for the receiving agent

Do not begin by writing systemd files or enabling the live worker.

1. Inspect the current server and Supabase state read-only.
2. Audit every unknown-product intake channel against the canonical trigger.
3. Trace the three registered engines and the current worker adapter seams.
4. Draft a `plan-hardening-loop` plan covering deployment, engine routing,
   autonomous rework, admin UX, notifications, observability, and rollback.
5. Show Nick the concrete admin/review journey and the consequential open
   decisions in section 8.
6. Obtain explicit implementation approval, then implement in an isolated
   worktree with the standard ready-check, counterpart review, and ship gates.

Production activation, Supabase writes/migrations, public/admin exposure, final
image approval, catalog publication, and user notification remain separate
authorization gates.
