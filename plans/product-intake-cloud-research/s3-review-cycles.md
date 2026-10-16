# S3 — bounded research cycles and projected-value review

## Outcome and authority

Implement the remaining S3 contract in [plan.md](plan.md#slice-3--judge-on-projected-values--bounded-auto-rework-worktree-intake-judge-rework).
Nick requested continuing the remaining setup on 2026-10-16. Preserve the approved
Luna/low researcher, Sol/medium judge, two machine-fixable automatic rounds, six
model runs and 45-minute cycle limit, and human publication. Automatic alerts,
automatic images, automatic rework remain disabled in the live runtime. No live
product/job mutation or migration application is part of local implementation.

Decision coverage: confirmed. Nick explicitly selected “Keep reserved slots used”
on 2026-10-16, including failures before Codex starts. Confirmed with Nick: parent D3
and current continuation/hold policy. Inherited: exact machine/human defect codes
and outcomes in parent §5; existing service-only RPC/lease fences; model output is
never approval. Defaults: reserve one run immediately before each actual model
launch (including optional shadow and image judges); consumed reservations remain
consumed after crash/failure. This is the conservative implementation of the
six-run upper bound, rather than refunding uncertain launches. Deadline begins on
first reservation and survives reclaim; cap child-process timeout by remaining
cycle time. Any model-budget denial stops launching and escalates to Nick.
Open consequential assumptions affecting implementation: none. All reservations
stay consumed; no refund path. The per-human-cycle 45-minute clock never resets
on reclaim; only explicit human rework creates a fresh cycle. Activation for the
first exact ten eligible submissions and backlog dispositions require Nick later.
Coverage acknowledgement: parent plan D3 acknowledgement and current request.
Internal revalidation: commit_research_pass exists but final research artifacts
are inserted before it; current shadow judge compares raw drafts and is not the
projected-value gate; no durable cycle/run reservation fields exist. Existing
lease renewal mutates the same job object under serialization; use that seam.
Undiscussed consequential assumptions affecting this handoff: none.

## Boundaries and interfaces

Ordered additive migration `20261016052958_product_intake_review_cycles.sql` adds
job fields `review_cycle_id uuid NOT NULL DEFAULT gen_random_uuid()`,
`auto_rework_count int NOT NULL DEFAULT 0` (0..2),
`reserved_model_runs int NOT NULL DEFAULT 0` (0..6), `cycle_deadline_at timestamptz`.
Types retain optional fields for compatibility with historical records and test
fixtures; new active review-cycle paths require valid server-owned cycle values.

`product_intake_reserve_model_run(target_job_id uuid, expected_locked_by text,
expected_locked_at timestamptz, expected_review_cycle_id uuid)` returns the job;
submission-then-job lock order, matching current open submission/running lease
and cycle required. It initializes deadline to now()+45min only when null and
increments reserved count only if <6 and before deadline. No refund. Denial uses
explicit SQLSTATE check/authorization errors; wrapper preserves enough structured
code to distinguish budget denial from lease loss/storage failure without exposing
private database text. Every production model lane uses this reservation before
spawn, under the existing lease.write serialization. Direct utility/test calls
without an executing worker job retain their existing standalone behavior.

Extend `product_intake_commit_research_pass` with trailing defaulted
`expected_review_cycle_id uuid DEFAULT NULL`, `research_artifacts jsonb DEFAULT
'[]'`, `request_auto_rework boolean DEFAULT false`. Replace its old signature,
not an overloaded PostgREST ambiguity. Legacy callers remain compatible while no
reservation exists; once a job reserved any run, a current cycle is mandatory.
The RPC atomically validates/inserts all supplied final research/judge artifacts,
updates final preview, resolves only claim-captured decision IDs, updates job and
outbox. Any invalid artifact rolls the entire transaction back. Existing terminal
completion replay is idempotent; never append artifacts twice. Model-run telemetry
may remain independently durable before completion as execution evidence.

Automatic outcome request is permitted only for `waiting_for_rework`/`rework`,
review outcome `continue`, zero notification payload, matching cycle, count<2,
at least two remaining run slots (research + mandatory judge) and unexpired deadline. It increments auto_rework_count,
resets ordinary claim attempt_count for that next bounded pass, clears the lease,
keeps cycle/deadline/reservations and queues immediately. An exhausted budget
becomes blocked before a new launch; no third round is claimable. Explicit human
rework RPC creates a fresh cycle, zeros counters and deadline, preserving old
artifacts. Existing retry/reclaim must never reset cycle budgets.

`CommitResearchPassParams` adds `expectedReviewCycleId`, `artifacts` (same fields
as AppendResearchArtifactParams, excluding job/submission IDs), `autoRework`.
Repository exports `reserveResearchModelRun(client, {jobId, expectedLockedBy,
expectedLockedAt, expectedReviewCycleId})`. Shared job type extends new fields.
SQL tests replay the new migration after canonical outbox migration; isolated
email-test DB bootstrap and its 11-name RPC adapter must include the new arguments
to exercise the current commit signature. Drop the exact old 11-type function
identity before creating/granting the new 14-argument signature; no overload.

## Worker integration and judge

Introduce the already planned `PRODUCT_INTAKE_AUTO_REWORK` activation switch
(default false); it was named in the parent plan but not yet implemented. Worker
research calls reserve before launch whenever the new cycle schema is in use;
a migration-before-code rollout is required. Image and optional shadow lanes
also reserve, so six means all launched Codex runs, not only research runs.
Use per-execution async context to associate the common runCodexJson launch with
its current job/lease/client, avoiding global current-job leaks at concurrency>1.
A small reservation context has a real worker caller; it is not a test-only seam.
The deadline also caps spawn timeout and final pass checks. Heartbeats continue.

After category normalization and commerce, a new pipeline module builds a strict
judge packet from projected final payload, server-owned engine/projection hashes,
readiness warnings and source/artifact evidence. Research/judge packet text is
untrusted data, never instructions to publish or write production. Sol/medium
judges without web. Strict output is `{defects:[{code,field,reason}]}`; only parent
codes accepted. Unknown keys/codes, malformed response or judge failure result in
blocked human review. No model-provided approved/published outcome is accepted.
Deterministic checks/readiness and human defects dominate a model “clean” verdict;
resolved unique brands use the existing brand resolver, not a new fuzzy matcher.

No defects + research-ready → waiting_for_review. Machine-only defects and enabled
auto-rework with remaining counters/time/runs → waiting_for_rework and one explicit
server-authored rework instruction; otherwise blocked with at most three German
questions. Identity/category/medical uncertainty never auto-fixes. A targeted INCI
retry is allowed once per cycle, recorded durably; later missing INCI escalates.
Judge artifacts and research artifacts go through the atomic commit, not separate
append calls. Existing shadow comparison stays optional telemetry/off in live.
Final outcome snapshot/outbox is produced only when the cycle reaches a human
outcome, not on intermediate rework. Email delivery switch remains false.

No new user journey or UI; this implements the already approved worker behavior.
Admin approval/rework routes consume these APIs in their subsequent slice; human
publication and revision/hash binding remain required before enabling UI actions.

## Ordered implementation and verification

1. SQL/core: fields, reservation, commit transaction, explicit-rework reset and
   type/wrappers. Real PGlite tests: six cap, crash reservation preserved, deadline,
   lease/cycle mismatch, stale rework, max2 auto rounds, terminal replay and atomic
   artifact/outbox rollback. Two-session final-completion-vs-human-rework race using the isolated Docker
   postgres:17/psql pattern in tests/paypal-trial-scheduling-postgres.test.ts; prove
   the waiting session in pg_stat_activity. Live running-job human rework stays
   forbidden, so claim/rework are not competing valid operations; never claim concurrency proof from a single sequential mock.
2. Pure projected judge parser/outcome rules with independent literal fixtures for
   every defect code, mixed human+machine, unknown output and no publish state.
3. Worker common model launch reserves and bounds timeout; final output/judge
   artifacts committed together. Focused worker transport test proves reservation
   rejection prevents spawn; concurrency contexts cannot borrow another job.
4. Final owner/sibling checks, root typecheck and affected lint through shared
   launcher, diff/format and read-only Claude/high whole-branch review. A review
   receipt covers exact final content. Red tests precede each behavior repair.

Consume: existing deterministic category adapter and lease RPCs, outbox snapshot
contract. Produce: cycle/budget reservation and atomic final artifact transaction,
structured projected verdict and bounded work outcome; subsequent Admin actions
consume cycle-aware explicit rework and complete research evidence.

Source/tests/plan are commit-intended. Private receipts archive outside Git; raw
reviews discarded after disposition. No frozen research edits. No migration apply,
new server release, email/auto-rework activation or product publication implied.
Full program checklist stays in continuation-2026-10-16.md; all remaining requested
subsystems remain tracked. Activation evidence includes representative host proof
and exact bounded cohort approved by Nick.

## Counterpart plan review disposition

Claude/high read-only review: approve with revisions, no hard blockers. Accepted
exact old-signature DROP/new-signature grants, relaxed continue validation only
for bounded rework, double-apply-idempotent migration and harness registration,
new planned-switch wording and common-launch timeout enforcement for all lanes.
Independent mapping additionally requires actual two-backend completion-versus-
human-rework race proof (PGlite cannot prove locks), cycle-bound exact-request
replay, two available slots before admitting research+judge rework, and generated
local migration filename. Final blocked escalation remains allowed after deadline.

The reviewer proposed asking whether reclaim resets the clock. Rejected that fork
as contradicting the already agreed per-human-cycle maximum; only explicit human
rework creates a fresh cycle. Nick then explicitly chose to keep reserved slots used, including proven
pre-launch failures. No refund path exists; only explicit human rework resets
the cycle. This completes the recovery decision; all implementation coverage is
confirmed.

## Implementation proof and activation boundary

SQL/core and worker integration are implemented locally. Final research/projected
judge artifacts and processed-image/visual-judge evidence use the atomic pass RPC.
Independent execution telemetry remains separate. The server preserves the
once-per-cycle targeted INCI marker through every ordinary progress/failure/retry
write; only a fresh human cycle clears it. A runtime-expired worker may record
only a fenced blocked human outcome; confirmed lease loss still forbids all writes.
Every actual common Codex launch consumes one reservation and a deadline-bounded
child timeout. Unknown/malformed judge output blocks; human defects dominate.

Observed proof: SQL/core 26/26 including real PostgreSQL two-backend lock wait;
137 combined checks passed with the opt-in race separately proven; actual worker
CLI cap denial prevented spawning and committed blocked needs_nick. Behavioral
red proofs cover changed replay, cap/deadline/counter/transaction guards, durable
INCI, actual common launch and image atomic handoff, projected outcome integration,
human-defect dominance and observer recovery. Root typecheck passes. Final combined
check/review receipts are private outside Git and identify the exact content.
No production migration, worker switch, automatic activation or product write has
been performed by this increment. Migration-before-code remains mandatory.

## Whole-branch review disposition

Claude/high read-only normal correctness/security/data-integrity and structural
review of all 24 task paths: approve with residual risk, no hard blockers. Main
verified all findings. Fixed the effective-timeout diagnostic and the commit-time
deadline edge: repository maps the real SQL `23514/cycle_deadline` to the same
typed exhaustion used by worker blocked-human handling. Real SQL transport guard
failed before that mapping (24/25), then passed after repair. Main also preserved
auth-failure claim pausing in the new projected-judge callback and removed its
new unused type import. Reviewed those exact deltas; no policy or architecture
change, so unchanged whole-branch conclusions are reused.

Accepted dormant residuals: optional shadow can consume shared cycle slots before
the mandatory gate (off in live); worker/DB clock skew can fail safely toward
human review; historical optional TypeScript fields rely on mandatory migration-
before-code. Before activating image/rework/shadow lanes, prove their representative
full cycles and operator alert routing on the exact approved cohort. Local SQL,
pure policy and actual CLI denial proof do not replace that rollout evidence.
Raw plan/code reports are transient and discarded after this disposition; private
verification/review receipts identify the final content.
