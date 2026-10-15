# Product Intake completion — 2026-10-15

## Outcome and authority

Finish the existing cloud-research program: confirmed unknown product → durable
queue → versioned category research and image preparation → bounded validation
and rework → Nick's review → explicit guarded publication → user linking and
notification. The owning contract is `docs/product-intake-research-ops.md`;
`plan.md` describes the earlier program. This record supersedes its stale
deployment statuses, not its settled product decisions or frozen research.

Nick's 2026-10-15 request: "please align any decisions with me that I need to get
this going. Otherwise please feel free to start this and do these steps exactly
as you mentioned" refers to the eight-item completion checklist in this chat.
The referenced checklist explicitly called for refreshing/merging the existing
PRs and deploying a reviewed worker release; the request authorizes those named
steps once their gates pass. Proceed with independent implementation and
reviewed follow-ups. Final catalog
publication remains approval of an exact product/package, not blanket approval.

## Verified baseline (read-only, 2026-10-15, about 14:02 UTC)

- Root base `72e64e3ba16bfc089fc2dbb6c42062a5a6835dba`; clean `main`.
- Hetzner worker/review release `92bfe95862eb20f0d1a53a71cac22fc4e8b60892`.
  Worker PID 530273; active since 2026-10-12 20:30 UTC; heartbeat 55 seconds old.
  Review HTTP 200. Worker concurrency 1, poll 5 seconds.
- Runtime override uses Node `--conditions=react-server --import tsx`. The
  worker, router and pipeline-process source hashes equal that Git commit.
  PR #650 was refreshed to use that proven native startup command.
- Four intake migrations are already in production: `20261006112322`,
  `20261006112337`, `20261006141653`, `20261007062729`. PR #645 aligns names;
  do not apply a second copy under predecessor filenames.
- 141 unfinished submissions (includes test/historical records): latest jobs
  113 blocked, 16 failed, 12 waiting for review. No queued/running jobs.
  Error-text buckets are triage hints, not root-cause proof: 74 brand, 34
  readiness/missing fields, 8 timeout, 5 parse/JSON, 8 other.
- Automatic image preparation off; visual judge and rembg enabled; all five
  image-QA references present with matching hashes. Recent image processing and
  four publish/notify completions prove use of the existing manual workflow.
- Sentry DSN loads from release `.env.local` (not visible in initial process
  environment); instrumentation configured, alert delivery not yet proven.
- Host 3.7 GiB RAM, disk 80%; worker/review have no MemoryMax; no observed
  `/run/chaarlie/heavy-work.lock`. Persistent finalized assets/rembg model exist.
- PRs #645/#650 refreshed against main, locally verified and reviewed, then
  pushed as `5e94674be112ba4936a9875a5e52366355dcc0b6` and
  `7777d0ef082865a2c6dd58f92b33ae0043784003`. At 14:47 UTC final CI is still
  running the Node contracts; completed checks pass, no unresolved review
  conversations. Do not merge using earlier-head checks.
  #682 is draft, behind main, offline Shampoo projection only.

## Decision coverage

Program coverage: **pending** only for the dependent decisions below.
Immediate operational/migration/startup and retention scope: **confirmed**.

- **Confirmed with Nick:** implement the eight-step checklist; retain human
  final product approval; route existing category engines; keep Oil unavailable
  until its owning contract is ready; bounded recovery and ten-submission proof.
  MAD-1 reply in this chat: keep moderate/high-conditioning → formula-supported
  `detangling_slip`, without an efficacy or repair-claim upgrade.
- **Inherited from evidence/contract:** exact engine pins and approvals; no
  fuzzy brand creation; no duplicate migration application; preserve evidence
  and frozen profiles; one local heavy check at a time; concurrency one on host.
- **Implementation defaults:** reuse #645/#650 worktrees and PR identities;
  new `codex/intake-completion` worktree owns current plan and operational docs;
  use focused tests and final hosted CI; keep persistent assets across releases;
  prepare deployment as an explicit script with read-only preflight by default.
- **Open consequential assumptions — resolve before affected implementation:**
  1. Integrated admin review: **confirmed** after the concrete German desktop/
     mobile proposal and recovery journey. Nick approved building it and chose
     Ready for review first. See `admin-review-integration.md`.
  2. Backlog dispositions/new brands: produce exact triage and proposed actions;
     no inferred customer/test classification and no bulk cancellations.
  3. Final publication/test cohort: present exact review packages and cohort
     before any catalog write or real-user notification.
  4. Resource/retention policy: measure current memory and release directories;
     present any irreversible cleanup or materially disruptive limits before
     activation. Retention is now confirmed: current + one verified rollback,
     preserve research/images/configuration. Authorized cleanup completed; see
     the milestone receipt below. Resource activation still needs bounded proof.

Coverage acknowledgement: quoted request above and previously accepted
checklist. Internal revalidation: live audit above, fresh origin/main, current
runbook and category-engine/router contracts. No undisclosed consequential
assumption affects the immediate operational/migration/startup work.

## Ordered deliverables and boundaries

1. **Align existing follow-ups.** Reuse `.worktrees/intake-migration-version-sync`
   (#645) and `.worktrees/intake-worker-server-only` (#650). Bring current main
   into each without rewriting published history; preserve exact migration SQL
   bytes. Refresh obsolete handoff and startup receipts. Verify production
   versions/content and focused PGlite lineage; exercise worker import without
   entering its polling loop, including red/green startup regression. Claude
   reviews complete final diffs before publication. Produces reviewed canonical
   migration paths and worker npm entry. Merge/deploy only on verified heads
   with all repository gates; no runtime change merely to tidy documentation.
   Canonical startup: `node --conditions=react-server --import tsx` plus the
   worker entry and existing flags. Align #650 to the proven live native Node
   condition rather than adding a production dependency on a test preload.
   When versioned units are activated, explicitly reconcile the existing
   `20-server-runtime.conf` override, preserving a rollback copy, and verify
   effective `ExecStart` plus the process command after daemon reload/restart.
   Confirm all required migrations are applied before switching any release.
2. **Operational controls.** Inspect actual installed units and price-audit
   budget before choosing limits; retain current running release and assets.
   Add versioned units, release/rollback and read-only preflight under
   `deploy/product-intake/`, and `docs/product-intake-cloud-ops.md`. Checks:
   Follow `deploy/price-audit/` for host conventions, not its outdated paths.
   shell/Python static validation as applicable; Linux `systemd-analyze verify`
   against prepared units; inspect diff vs installed units; no restart until
   release prerequisites and queue/lock state are proven safe. Verify alert
   routing without deliberately interrupting a live job.
3. **Engine integration.** Finish #682's independent review, then dedicated
   Shampoo worker prompt/envelope/projection integration in
   `category-research-router.ts`. Consume locked current method and exact
   submission identity; preserve historical replay. Mask follows its own MAD-1
   ruling/runbook and guarded wrapper; Oil is a separate owner dependency, not
   invented here. Verify real normalization outputs and rejection of missing,
   stale/mismatched identities and versions. No catalog backfill implicit.
4. **Validation and bounded rework.** Extend the existing worker's actual
   normalized-payload readiness boundary and canonical brand resolution. Judge
   projected values; enforce reservation/retry/cycle budgets and lease ownership
   before model work and atomic pass commit. Tests cover lease loss, stale human
   decisions, retry exhaustion, invalid judge outputs and no auto-publication.
   Any new schema uses surgical ordered migrations, not blind `db push`.
5. **Automatic images.** Reuse current image modules and verified reference
   assets. Exercise complete-ready → serial processing → visual judgement →
   human final image review. Missing/invalid candidate or uncertain judge stays
   actionable. Enable only after bounded proof; no inferred image approval.
   Toggle/kill switch: `PRODUCT_INTAKE_AUTO_PREPARE_IMAGES`, default off.
6. **Review experience and emails.** Inspect existing cockpit; prepare concrete
   contextual German desktop/mobile mockup and actor journey (ready, blocked,
   rework, stale approval, publication/notification recovery). After Nick's
   approval, implement admin-only routes and immutable version-bound image/value
   decisions. Port guarded publication shared with CLI, then email outbox.
   Use the existing Customer.io transport for admin alerts. The legacy
   `notify-pending.ts` customer lane stays separate. Nick authorized dedicated
   provider template creation and one isolated test on 2026-10-15.
   Prove unauthorized/stale actions fail and duplicate/retry behavior is safe.
   Retire old cockpit only after successful replacement flow, never beforehand.
7. **Backlog.** Read-only latest-job triage per submission, excluding closed
   submissions from actionable counts. Separate existing-brand resolution,
   genuinely new brands, missing research, infrastructure failures and known
   test identities. Present exact proposed retry/close/identity actions to Nick.
   Apply only approved actions and keep audit receipts.
8. **Bounded end-to-end proof.** Present ten-case cohort spanning engines and
   success/uncertainty/failure recovery. Track model calls, cost when available,
   elapsed time, corrections and complete links/notifications. Final publication
   requires exact package approval. Do not substitute trial starts or model
   completion for successful final handoff. Update dated completion checklist.

## Verification, review and artifacts

Use `docs/coding-verification.md`, `ready-check` and `request-code-review`.
Focused owner/sibling commands are routed by `verification:plan`; inspect
`coding-check --status` before each heavy job and never double-wrap gated npm
commands. CI remains full. No advisory reviewer launches broad local suites.
Plan and meaningful full-branch reviews use one read-only terminal Claude lane
at effort high; transient output stays outside Git and is discarded after
verified findings/receipt are recorded. Shell has no ANTHROPIC_API_KEY set.

The operational/Mask backend slice changes no customer-facing flow. The Admin
journey has now been approved; retain its proposal and implement per the dedicated
Admin integration plan.
Plan, operational docs, reviewed code and sanitized verification receipts:
commit. Private queue data and credentials: never commit. Transient reviews:
discard after recording their decisions. No unrelated worktree cleanup.

## Plan review disposition

Claude read-only/high review (2026-10-15): approve immediate implementation with
revisions. Accepted: make override reconciliation/canonical startup and
migration-before-release explicit; name image toggle; reuse notification path;
treat later deliverables as dependent slice plans with their own evidence.
Authorization finding rejected after inspecting the full chat: the checklist
explicitly names merge/release steps and Nick requests those exact steps, not
only "get this going" in isolation. No new publication/catalog approval inferred.
Reviewer did not independently confirm live SQL; orchestrator owns live receipts.
Transient report `/tmp/intake-completion-plan-review-20261015.md`: discard after
its verified findings and disposition have been retained here.

## Execution milestones — 2026-10-15

### Current completion checklist

- [x] #645/#650 verified and merged; production migration names aligned.
- [x] Retain current + one verified rollback; archive unique old data and remove
      generated copies. Disk now 56%, about 16 GiB free.
- [x] Upgrade configured Codex CLI with bounded auth/JSON compatibility proof.
- [x] Prepare candidate units, read-only host preflight and rollback runbook.
- [ ] Activate resource controls: shared rembg/price-audit lock, representative
      capped workload proof, alert delivery and reviewed release reconciliation.
- [x] Implement/review local Mask worker integration; 115 focused checks pass.
- [ ] Review #682 and integrate the current Shampoo projector with the worker.
      Oil stays unavailable pending its owner contract.
- [ ] Implement atomic pass commit, judge of projected values and reserved
      two-round/six-run/45-minute rework budgets before enabling auto-rework.
- [ ] Prove and enable automatic images only for the approved bounded cohort.
- [x] Approve Admin journey/default and implement authenticated read-only queue
      and detail. The actual repository read returns 141 rows: 12 ready, 113
      decisions, 16 errors. No 100-row truncation. Desktop/390px inspected.
- [ ] Add immutable cross-host images, revision/hash-bound decisions, guarded
      publication, bounded rework actions and notification-only recovery.
      These controls are explicitly absent from the current read-only increment.
- [x] Implement the local admin alert outbox: atomic final preview/job/outbox RPC,
      service-only fenced claims, safe receipt settlement and default-off worker
      dispatch. Explicit test CLI uses an isolated ledger, with no backlog claims.
      The real-migration SQL suite and sender checks pass; a stub-provider CLI run
      proves persistence through stored receipt without sending an email.
- [x] Nick selected hold for reconciliation: uncertain provider responses and
      expired send leases are never automatically resent. Real SQL/transport
      checks cover holds, stale fences, later queue progress and bounded 429 retries.
- [x] Create/read back dedicated Customer.io message 20/template 190 using the
      signed-in business browser. Configure the approved dedicated sending key
      privately, render both variants, and send one isolated-ledger outbox test.
      Matching HTML/plain-text email received in Nick’s inbox at 19:40:58 UTC;
      open/click tracking disabled. Automatic alerts remain false.
- [ ] Nick reviews the received test before automatic activation. Activation
      review explicitly includes manual holds during HTTP 408/5xx provider outages.
      Management CLI renewal remains optional tooling work.
- [x] Apply the reviewed additive outbox migration surgically and verify table,
      three RPCs, RLS/service-only permissions and zero rows. Actual production
      version `20261015200636` is the repository filename; SQL bytes unchanged.
- [ ] Deploy the reviewed worker/Admin routes through the existing release/CI
      gates, then verify before any switch activation.
- [ ] Approve exact backlog dispositions and the ten-case cohort; run bounded
      end-to-end proof and exact product approval. No retry or publication yet.

The local increment is uncommitted and not deployed. Root `main` and this task
base are now `9fc02a26` after the unrelated consultation middleware fix; task
source content reviewed against `a34feee1` is unchanged by that fast-forward.
The remaining program is requested work, not silently dropped or declared done.
The email increment additionally passed 154 combined intake checks and affected
sender/SQL/image checks after final fixes, plus root/CLI typechecks and source lint.
Read-only Claude/high found no blocking defects. A simulated provider CLI run
stored one receipt and refused the repeated run; this was not a real email.
Production outbox table/RPC are absent (read-only verified). A subsequent real
outbox run sent exactly one test and the matching email was verified in Nick’s
inbox. Template creation/sending access are complete; production release and
activation remain gated. See the [delivery receipt](receipts/admin-alert-delivery-2026-10-15.json)
and [exact email status](admin-alert-outbox.md).

- Retention complete at 15:14 UTC: current `20261007-92bfe95862eb` plus verified
  rollback `20261006-880a07c46cff`. Five other installed copies removed after
  every non-generated file was preserved/verified in private archives. Disk
  80% → 56%, about 16 GiB free. Live services unchanged.
  Receipt: `receipts/retention-2026-10-15.json`.
- #650 merged: reviewed head `7777d0ef082865a2c6dd58f92b33ae0043784003`; merge
  `6ae710fb32add7fb9192645b88aae2d952b8d41e`; all hosted checks passed. Root
  fast-forwarded, clean `main`. Worktree finish dry run refused unique ignored
  `tmp/`; preserved exact task worktree/branches, no forced cleanup.
- #645 brought up to date with that main at reviewed head
  `21d5e4f4150628e01a9b593ed029f2ec4c40273f`. Migration-task content fingerprint
  unchanged; SQL hashes and focused/Claude receipts remain valid.
  Precommit lint/typecheck and all hosted CI passed; merged as recorded below.
- Admin proposal: desktop + 390px responsive view inspected; independent data
  and image approvals enable final confirmation. Nick asked whether this is
  the review center integrated into admin; explained authenticated entry, queue,
  exact facts/images, final product approval and fallback retention. Nick subsequently approved implementation and selected the default queue, as
  recorded below.
- Backlog refreshed at 15:12 UTC: unchanged 113 blocked, 16 failed, 12 ready.
  Of 74 latest brand-error blockers, 63 use “Unbekannte Marke”, 7 have a blank
  submitted brand, 2 say Dove, 1 Eve curl, 1 Mutter; none has an exact case-
  insensitive canonical-name match. These are triage clues, not approvals to
  create brands or classifications of real users/test records. No job retried.

- Read-only host preflight added under `deploy/product-intake/preflight.py`,
  Python compilation and actual Linux/loopback execution passed at 15:22 UTC.
  It explicitly separates its 100-row queue sample from complete DB/lease
  evidence and cannot approve deployment.
- Mask slice plan in `mask-worker-integration.md` reviewed read-only/high by
  Claude; verified revisions incorporated. Worker integration implemented
  locally: 115 focused tests pass, targeted source lint passes, root typecheck
  passes. Frozen research/calibration unchanged. Not deployed or activated.

- Admin proposal approved by Nick after explaining the integrated review-center
  journey. He selected **Ready for review first**, with decisions/errors still
  accessible. Build the shown separate data/image approvals and explicit final
  per-product publication; no individual product is approved by this decision.
- CLI operational upgrade complete: official standalone installer pinned to
  0.162.1, previous 0.156.1 retained. ChatGPT login status succeeded; worker/
  price-audit flags present; bounded ephemeral read-only Luna/low request with
  web disabled returned exactly valid `{"ok":true}` via last-message file.
  Price-audit's actual environment file includes the CLI on PATH. No product/DB
  operation performed; live worker/review services not restarted.
- #645 merged after all checks on `21d5e4f4150628e01a9b593ed029f2ec4c40273f`;
  merge `a34feee1789843f76681673a655fd8c9cf01ff80`. Root and completion worktree
  fast-forwarded. Exact worktree finish dry run refused ignored `tmp/`;
  preserved worktree/branches without repair.

- Admin read surface implemented under `/admin/produkt-intake`, matching the
  approved navigation and Ready-first default. Every page/API checks the shared
  admin gate before a service client; reads are private/no-store. Full queue and
  latest-job selection include newer terminal jobs. Existing unversioned
  research is visibly identified; no inferred test/history classification.
  Focused Admin + shared-shell print regression: 20/20; source lint and root
  typecheck passed. Real read-only repository probe: 141 rows, detail loaded;
  explicit submission projection excludes user/conversation IDs. Browser proof
  uses fictional Lab data with the actual components, not seeded production
  fixtures. The existing unauthenticated middleware redirects to `/auth`;
  direct handler 401/403 behavior is separately tested.
- Claude read-only/high whole-branch review approved the local Mask/ops + Admin
  read increment with no blocking findings. Nested artifact payloads remain
  admin-gated research evidence (the PII allow-list claim is deliberately only
  about the submission row); job-less entries remain in decisions until triage.
  Source/receipt fingerprints are recorded in the verification receipt. No
  claim that private image delivery, approvals, publication or the whole setup
  is complete. Transient reports stay outside Git and are discarded after the
  verified review disposition is retained.

- Disabled-alert continuation: Nick selected hold for reconciliation. 72 affected
  SQL/transport/worker cases pass; root typecheck, source lint and diff checks pass.
  Claude/high plan and whole-branch reviews found no blocking defects. Production
  migration applied as `20261015200636`; old worker untouched. The timestamp was
  generated by Supabase and repository filename aligned immediately, preserving
  exact SQL bytes to avoid a duplicate-apply lineage mismatch. Full latest queue
  at 19:59 UTC: 141 unfinished, 17 waiting review, 110 blocked, 14 failed; complete
  queued/running/rework count zero. These are not verified waiting customers.
