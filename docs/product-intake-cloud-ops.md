# Product Intake cloud operations

Research/review/publication policy: [canonical runbook](product-intake-research-ops.md).
Completion scope: [2026-10-15 plan](../plans/product-intake-cloud-research/completion-2026-10-15.md).

## Verified running state — 2026-10-15

Read-only audit of `chaarlie-hetzner` (`ubuntu-4gb-nbg1-1`, Nuremberg):

| Item             | Observed                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| Release          | `92bfe95862eb20f0d1a53a71cac22fc4e8b60892` (`20261007-92bfe95862eb`)                                |
| Worker           | Active; PID 530273, since 2026-10-12 20:30 UTC; heartbeat current                                   |
| Review           | Active, bound to `127.0.0.1:3910`; HTTP 200                                                         |
| Worker runtime   | `/usr/bin/node --conditions=react-server --import tsx`; concurrency 1, poll 5 s                     |
| Source integrity | Worker/router/pipeline-process SHA-256 equal their files at the release Git commit                  |
| Sentry           | DSN present in release `.env.local`, loaded at startup; alert delivery not yet verified             |
| Images           | Automatic preparation off; rembg and visual judge enabled; all five references present/hash-correct |
| Disk             | 56%, about 16 GiB free; current + one verified rollback release retained                            |
| Memory           | 3.7 GiB usable + 2 GiB swap; neither intake unit currently has a cap                                |
| Recorded peaks   | Worker 1,036,324,864 bytes; review 108,662,784; price audit 714,870,784 (different lifetimes)       |
| CLI              | Codex 0.162.1; bounded compatibility/auth check passed; old 0.156.1 retained                        |

Latest-job counts for unfinished submissions: 113 blocked, 16 failed, 12 awaiting
review; no queued/running jobs at the audit cutoff. These 141 include test and
historical submissions; not 141 verified waiting customers. Query latest job per
submission and exclude closed submissions when refreshing this view.

## Layout and startup ownership

- Release folders: `/opt/chaarlie/product-intake/releases/<timestamp>-<sha>`.
- Active symlink: `/opt/chaarlie/product-intake/current`.
- Secrets: shared `worker.env` and private release `.env.local`; never print,
  commit, attach or pass their contents in CLI arguments.
- Shared images: `shared/finalized-images`; rembg model: `shared/rembg`.
- Release identity: `shared/release.env` containing only
  `PRODUCT_INTAKE_RELEASE_SHA=<full-reviewed-git-sha>`, mode 0640, owner nick.
- Versioned units: `deploy/product-intake/`. The worker's direct Node command
  and npm command must use the same native `react-server` condition.

The audit found `10-finalized-images.conf` and `20-server-runtime.conf` installed
under the worker's `.service.d/` directory. **The latter resets ExecStart and
overrides any base unit.** Installing a new base unit alone does not replace it.
Back up the exact existing units/drop-ins and active symlink in a private shared
backup directory before activation. Reconcile the two named drop-ins with the
versioned unit, preserving unrelated administrator-owned files. Never remove
an entire drop-in directory. Verify effective `systemctl show ... -p ExecStart`
and the started process command, not only the file copied into `/etc`.

The review service is local-only and has no login layer. Keep loopback binding
and `PRODUCT_INTAKE_CODEX_WORKER_EXTERNAL=true`; access through SSH tunneling.
Do not expose this cockpit as the planned admin review surface.

## Read-only host preflight

From a clean task checkout, run:

```bash
ssh chaarlie-hetzner python3 - < deploy/product-intake/preflight.py
```

This script does not install anything. It reports active release/process paths,
unit state/caps/known drop-in names, disk and shared asset presence, review health
and sanitized queue counts. It never prints environment values or queue product/
user details. The loopback queue is capped at 100 rows, so its counts are only a
sample. Complete DB queue/lease state, heartbeat, schema, reviewed Git head/CI,
workload budget, rollback and alert delivery remain explicit separate gates.
Linux execution after retention cleanup passed at 15:22 UTC; the two live
services still point at the running release, review/DB queue HTTP 200, 58 shared
finalized-image files and one model file present.

## Candidate deployment and rollback

For the first **code-only disabled release**, preserve both installed base units
and the existing `10-finalized-images.conf`/`20-server-runtime.conf` overrides.
Do not activate the candidate resource caps. Install only the owned worker
`30-disabled-release.conf` plus private `shared/release.env` with the reviewed
full SHA. The installed base unit hardcodes the old release identity;
EnvironmentFile overrides that value without replacing startup/resource settings.
The current shared `worker.env` contains neither automatic switch; keep that
verified prerequisite and set both switches false in the new release's private
`.env.local` too. Preserve the prior absence/content of the new override and
identity file in rollback metadata; restore that exact state on rollback.
Back up both base units and the two existing worker overrides before the switch.
Copy the current private `.env.local` and overlay unique `ops/` files without
overwriting tracked source. Keep current release `tmp/` evidence in the retained
rollback copy; do not remove it as scratch cleanup. Verify the new SHA through
the fresh DB heartbeat after daemon reload and restart. Manual image judgement
stays enabled; automatic image preparation and review-email delivery stay false.

The full unit/resource activation sequence below remains separate and requires
its representative workload/shared-lock evidence before installation.

1. Identify the reviewed Git SHA, clean source checkout, passing checks and exact
   migration prerequisites. #645 renames already-applied migrations to
   `20261006112322`, `20261006112337`, `20261006141653`, `20261007062729`; do not
   run their old filenames or a blind `supabase db push`. Any genuinely new
   required schema must be applied and verified **before** worker release switch.
   The current local email increment requires the genuinely new
   `20261015200636_product_intake_admin_notifications.sql` and its final-pass RPC
   **even when email delivery is off**. The migration was surgically applied as
   production version `20261015200636` on 2026-10-15, and table/three RPCs plus
   service-only permissions/RLS were verified. Repository SQL bytes are identical
   to the reviewed migration; its filename now matches actual production lineage.
   The old worker remains running until the reviewed release/CI gates pass. Keep review emails false and
   the bounded cohort unreleased until provider delivery and Admin routes are verified.
2. Inspect latest heartbeat and queue/locks. Do not interrupt a running job.
   Record the existing symlink, effective unit/drop-in configuration, safe flag
   values, and current published/blocked/ready counts as the rollback baseline.
3. Prepare an immutable release from that exact Git tree; exclude local/private
   packages, credentials and Git metadata. Install its lockfile dependencies
   with the existing Node/npm runtime. Copy private runtime configuration through
   the existing private server path, never a public artifact. Build the review
   app and verify the worker import graph **without running its main loop**.
   Preparation/build must obey the shared host memory budget; do not overlap a
   model/rembg/price-audit workload merely because the queue was idle earlier.
4. Run Linux `systemd-analyze verify` on the candidate unit files; compare them
   with installed units and explicitly disposition the two known overrides.
   Prepare `release.env` with the exact full SHA. These unit files are candidates
   until this validation and the resource proof below have succeeded.
5. Recheck job/lock state immediately before switching. Change the active symlink
   atomically, install reviewed units/config and reconcile the overrides, reload
   systemd, and restart only the two exact intake services. Preserve the former
   release and private configuration for rollback.
6. Verify service state, effective ExecStart, process working directory/full
   release SHA, fresh heartbeat with that SHA, review HTTP 200 and a bounded
   approved job. Observe the existing final publication gate; restart is not
   approval of a product or retry of blocked submissions.
7. On startup/readiness failure, restore the recorded symlink, private release
   identity and exact unit/drop-in backup, reload/restart those services and
   repeat the checks. A code rollback **keeps applied schema and job evidence**;
   never clear locks, reset jobs or reverse migrations as an implicit rollback.

Record actual commands, hashes and outcomes in a sanitized release receipt.
Never label unit installation, green CI or an idle heartbeat as end-to-end proof.

## Resource and retention controls

The candidate units cap the worker at 1536 MiB (high watermark 1280 MiB) and
review at 256 MiB, with Nice 10. Those caps leave margin over the observed peaks;
they are **not a whole-host capacity guarantee**. Docker/rembg memory is outside
the worker service's cgroup. Before activation, prove the rembg container limit
and serialize its heavy stage against the price audit's existing 1 GiB budget.
The price-audit unit and any shared host lock must use the same inode/ownership;
never delete/recreate the lock file while contenders may hold it. An image-stage
wait must not stop heartbeat/lease renewal or bypass cancellation.

The Linux implementation is `deploy/product-intake/heavy-stage.py`. Both rembg
and price audit enter it through literal arguments, using
`/run/chaarlie/heavy-work.lock` and the private shared
`heavy-work-state.json` marker. Install `chaarlie-heavy-work.conf` with tmpfiles;
its `f` rule creates a missing lock without replacing an existing inode. Preserve
the installed price-audit user, environment, timer and three-hour budget when
installing its reviewed helper wrapper. Waiting consumes the existing job/cycle
deadline and never reserves a model run.

Nick approved automatic recovery after a crash only when safety is verified.
Under the lock, the next contender checks the exact recorded rembg container
name and ownership label, removes that disposable container, and confirms both
container and launcher absence before clearing the marker. For price audit it
only confirms the recorded process group is gone; it never kills an orphaned
audit. A malformed marker, pending launch, live audit group or unavailable Docker
leaves heavy work paused with `HEAVY_STAGE_UNCONFIRMED`. The small `.unconfirmed`
sidecar routes that hold through the independent health observer. Ordinary active
markers are healthy, including a legitimately long price audit.

For a recovery hold, inspect only the recorded stage with
`sudo cat /opt/chaarlie/product-intake/shared/heavy-work-state.json` and the
helper's journal. Use `docker container inspect <recorded-container-name>` to
compare its exact name and `io.chaarlie.heavy-stage` label; use the recorded
process group and service cgroup to inspect surviving processes. Do not run a
prefix-wide container sweep, unlink the shared lock, or clear an unverifiable
marker. Once the original stage is confirmed absent, let a later authorized
stage perform reconciliation under the lock. Manual reconciliation of malformed
state needs an explicit operator decision and a preserved copy of that state.

Free worker-down monitoring uses
`chaarlie-product-intake-worker-health.timer`, independent of the worker loop.
The read-only observer checks the actual systemd process, current release and
matching Supabase heartbeat; a ten-minute grace avoids short restart alarms.
The same observer reports claimable work waiting more than two hours since its
`next_run_at` eligibility time, three consecutive
failures scoped to the current worker, that worker's latest `infra_auth` outcome,
and free disk strictly below 15%. Old blocked/failed backlog does not count as a
new failure streak. Claimability follows the existing due-time, stale-lock,
attempt and submission-state predicates; an exhausted bounded read is explicitly
incomplete. These checks never claim, retry or modify jobs.
It reports changed unhealthy incidents through the existing production Sentry
error allowance and `product_intake_admin_alert` rule. Failed event delivery
remains retryable. It does not use paid Cron capacity or Customer.io and does not
change any automatic email, image, rework or publication switch. Verify the
effective unit, a healthy read, and a sanitized delivery test before calling the
monitoring route operational.

Validate a representative research/image run under the intended limits and
check for OOM, excessive throttling and lease loss before broad activation.
Configure/verify missed-heartbeat, repeated-failure, auth and low-disk alerts;
record an alert-delivery receipt. Do not stop a working service just to test an
alert while a real job is active.

Retention policy confirmed by Nick on 2026-10-15: keep the current release and
**one verified rollback release**. Cleanup completed on the same date:

- Current: `20261007-92bfe95862eb`; rollback: `20261006-880a07c46cff`.
- Rollback worker import passed; its review app started on a temporary loopback
  port and returned HTTP 200 for health, root and the read-only queue. Worker
  source and lockfile hashes match the recorded Git revision. No research or
  publish job was executed for this check.
- Five unused installed release folders removed after archive verification.
  Their non-generated contents are preserved in five private archives under
  `shared/retained-release-data/20261015/` (816.8 MiB total, 42,745 entries).
  Only root `node_modules` and review `.next` output were excluded. All research,
  images, source, private configuration and other files were preserved.
- Source/archive membership, hashes, modes and symlink targets verified before
  deletion. Current/rollback non-generated content, shared finalized images,
  rembg model and `worker.env` verified unchanged afterward.
- Disk: **80% → 56%**, available **7.5 GiB → about 16 GiB**. Worker/review PIDs
  and start timestamps unchanged; live review health HTTP 200.
- Sanitized receipt: [retention-2026-10-15.json](../plans/product-intake-cloud-research/receipts/retention-2026-10-15.json).

Future deployments follow the same retention policy only after the new release
passes health checks and the rollback is verified. Preserve unique data before
pruning any additional installed copy; do not prune by age alone. The private
archives preserve historical data and require sudo for access; they are not
installed or running application versions. No automatic cleanup was installed.

## Current release and continuation (2026-10-16)

PR #689 merged as `80b963a2`; main app production is READY. Hetzner runs reviewed
head `7c00ca4a` from `20261015-201339-7c00ca4a76c6`; verified rollback is
`20261007-92bfe95862eb`. Other installed copies were archived/verified before
removal. Read-only morning refresh: worker/review healthy, fresh idle heartbeat,
zero active jobs/outbox rows, disk 60% (~15 GiB available); 74 shared finalized
images and one rembg model intact. Runtime email/image switches are false.

The [continuation checklist](../plans/product-intake-cloud-research/continuation-2026-10-16.md)
is current. The next local safety increment introduces independent outbox
observation and [bounded research cycles](../plans/product-intake-cloud-research/s3-review-cycles.md),
including migration `20261016052958_product_intake_review_cycles.sql`.
The Shampoo integration in #693 adds successor
`20261016131141_product_intake_atomic_artifact_ids.sql` so Oil artifact IDs and
review pointers persist in the same completion transaction. Apply the ordered
review-cycle, Oil binding and successor migrations before releasing the combined
worker; see the [completion record](../plans/product-intake-cloud-research/s2-completion-2026-10-16.md).
**These changes were not applied or deployed in the completion pass.**
Migration-before-code, reviewed head/CI and exact release guards remain mandatory;
no automatic activation is implied. Existing resource units/caps have not changed.

## Status of the completion work

- #645: merged as `a34feee1789843f76681673a655fd8c9cf01ff80` after all checks
  passed on `21d5e4f4150628e01a9b593ed029f2ec4c40273f`; focused lineage 14/14.
  Production schema was already applied; no migration reapplied. Exact local
  finish refused ignored `tmp/`; worktree/branches preserved.
- #650: merged as `6ae710fb32add7fb9192645b88aae2d952b8d41e` after all final
  checks passed on `7777d0ef082865a2c6dd58f92b33ae0043784003`; owner tests 23/23.
  Native runtime is preserved in the verified #689 worker release. Exact worktree cleanup refused
  because ignored `tmp/` may be unique; worktree/branches preserved.
- Unit/resource activation and monitoring delivery:
  **not performed** by preparing these files. Retention cleanup is complete as
  documented above.
- Engine integration, bounded rework, automatic image enable, integrated admin
  review/emails and bounded end-to-end cohort: tracked in the completion plan.

## CLI upgrade receipt — 2026-10-15

The configured worker binary is `/home/nick/.local/bin/codex`, pointing into the
standalone package tree. The official installer was downloaded from the
[documented update source](https://developers.openai.com/codex/cli), inspected and
run non-interactively with explicit `--release 0.162.1`. It verified the package
and selected the new binary; the old 0.156.1 package remains available. No
private runtime configuration or service start command changed.

Before the switch, full DB counts were queued 0/running 0, heartbeat fresh and
current_job_id null, and no Codex process was running. Afterward login status
returned 0 using existing ChatGPT auth. Worker/price-audit CLI flags remain
supported; one bounded ephemeral read-only Luna/low/default-tier call, web
disabled and stdin closed, returned valid `{"ok":true}` in the last-message file.
No product research or database action ran. Price audit resolves this binary
through its **own** `/opt/chaarlie/price-audit/shared/worker.env` PATH, not the
intake environment file. A full price-audit apply run was not repeated.

On a verified CLI-specific regression, retain the old package and restore the
standalone current symlink to its recorded 0.156.1 directory; verify visible
binary/auth again before allowing new work. Application-release rollback and
CLI rollback are distinct operations. Never reset auth or research jobs as an
implicit upgrade recovery.
