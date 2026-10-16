# Product Intake host resource guards

## Outcome and authority

Complete the remaining shared-host safeguards from [the approved plan](plan.md)
and [cloud operations contract](../../docs/product-intake-cloud-ops.md): serialize
rembg and price audit, preserve cancellation and lease renewal, measure the actual
budget, and verify technical monitoring before automatic image/rework activation.
Nick authorized continuing all setup and the coordinated verified rollout. The
Admin release remains owned by #696; this follow-up starts from its reviewed tree
`db4ea5b9`. No product publication, backlog retry or Oil activation is implied.

## Decision coverage

Confirmed: one shared `/run/chaarlie/heavy-work.lock`, concurrency one, six model
runs/45 minutes, no model slot for waiting/rembg, current plus one verified
rollback, explicit human publication, manual Oil matching and separate Oil work.
Inherited: asynchronous child execution and heartbeat; never replace a lock inode
held by another process; preserve installed service identities/environment/timers.

Routine defaults: use the existing job/cycle deadline for lock waits; cancellation
stops waiting and prevents container launch. Hold the lock through verified
container cleanup. Before starting rembg, persist an owned stage marker; remove it
only after cleanup is confirmed. An abnormal supervisor exit leaves a marker. Nick confirmed automatic recovery
when verified safe: the next contender holds the lock, verifies/removes only the
exact owned disposable container and clears the marker only after confirmed
absence. Unknown/malformed state or Docker failure pauses heavy work and raises a
technical alert; a runbook names exact inspection and recovery commands. This prevents releasing a killed process's
flock from permitting overlap with a daemon-owned container. The marker contains
only opaque stage/container identifiers, no product or customer data.

Nick selected free server-side heartbeat monitoring using the existing Sentry
error allowance; do not change billing. Exact ten-case cohort/backlog actions require
alignment on actual IDs and packages; no such cohort is approved yet. Resource
limits remain measured choices: preserve current settings until disposable-image
measurements establish peak plus margin. No new UI is proposed.

Coverage acknowledgement: Nick's request to continue all setup and coordinate it
in one chat. Internal revalidation: no shared lock exists; lease loss currently
fences writes but does not cancel an image child. Current rembg Docker limits are
2500m/3g swap/2 CPUs, outside the worker cgroup. Sentry cron capacity is exhausted;
the separate production outbox-error rule is configured for Nick's existing email.

## Implementation and proof

1. Add `deploy/product-intake/heavy-stage.py`, a small Linux host helper shared by both heavy stages, plus a boot tmpfiles configuration. Provision the common
   directory/lock ownership at boot without replacing an existing inode. Acquire
   asynchronously and obey cancellation/deadline; validate any unresolved marker
   while holding the lock. Keep macOS Vision/fallback behavior unchanged.
2. Update `pipeline/process.ts`, `pipeline/image.ts`, `pipeline/image-background.ts`
   and `scripts/product-intake/codex-research-worker.ts`: thread the existing
   lease/runtime cancellation signal and deadline through the
   image boundary and process runner. Remain responsive during lock waits. A lost
   lease cannot launch a container or commit a result. No deadline reset or model
   reservation is introduced.
3. Hold exclusive ownership for Docker execution and exact named-container
   cleanup. Confirm removal before clearing the marker/releasing the stage; an
   unconfirmed cleanup is an explicit infrastructure failure, not a silent retry.
   Wrap the installed price-audit command with the same helper while preserving
   its existing user, environment, arguments, timer and three-hour timeout. Use
   `deploy/price-audit/price-audit.service` and a surgical installed drop-in; preserve
   control-group termination/OOM-stop so a dead supervisor cannot leave an audit
   child running after releasing its lock.
4. Add `tests/product-intake-heavy-stage.test.ts` for the actual Linux helper and
   `tests/product-intake-image-cancellation.test.ts` for actual image/process
   boundaries; extend existing worker lease tests only where needed. Prove mutual
   exclusion with two Linux contenders, cancellation while waiting,
   heartbeat renewal, deadline expiry, named disposable-container cleanup and
   fail-closed recovery after supervisor termination. Use a disposable image and
   no product/database/storage/publication calls for resource measurements.
5. Measure memory, swap, OOM, CPU throttling and host headroom under representative
   rembg plus a waiting nonapplying price-audit contender. Set limits from those
   measurements; validate effective systemd configuration and preflight output.
   Do not activate automatic images or candidate caps before that evidence.
6. Add `deploy/product-intake/worker-health.py` and its systemd service/timer for Nick's selected free
   worker-down route; use current Supabase heartbeats/service identity, no queue
   writes. Keep outbox and worker-health Sentry events scoped and sanitized.
   Verify repeated-failure/auth/low-disk and held-email routes with sanitized
   technical tests; never stop a real active job for monitoring proof.
7. Propose the exact ten-case cohort across supported engines and success,
   uncertainty and recovery outcomes. After alignment, run it sequentially and
   record calls, elapsed time, cost where available, correction count and review
   links. Nick approves each actual publication separately.

The two Python behavior suites are also invoked by
`tests/product-intake-host-controls.test.ts` in normal hosted Node discovery.
Run focused owner tests through the shared launcher, then combined verification
once on final source, read-only Claude/high plan and whole-branch reviews, and
hosted CI. Do not repeat unchanged Admin UI tests. Plan/source/sanitized receipts
are commit artifacts; credentials, host backups and raw reviews stay private.

## Counterpart review disposition

Accepted the cross-lane recovery issue: Nick explicitly chose automatic verified
recovery, with unknown state failing closed and documented reconciliation. Added
concrete files/tests, Linux-only lock acceptance, and price-audit crash containment.
macOS Vision must never touch `/run/chaarlie`; its normal path remains a no-op for
this lock. A long audit may exhaust an image job's existing45-minute deadline; that
is a visible infrastructure escalation, without a deadline reset. Use focused
owner checks plus typecheck/lint and full hosted CI rather than duplicating broad
local suites against the machine-wide budget. No new model or publication policy.

Stop only the dependent cohort work while its exact IDs remain open;
continue authorized resource implementation after plan review. Record remaining
gates honestly rather than calling an idle worker an end-to-end proof.

Recovery acknowledgement: Nick selected “Recover automatically when verified safe”.
The helper uses `/run/chaarlie/heavy-work.lock` and a private shared marker
`/opt/chaarlie/product-intake/shared/heavy-work-state.json`. Both callers use the
same helper. Only an exactly named and owned disposable rembg container may be
removed; confirmed absence allows automatic marker clearance under the lock.
Unconfirmed cleanup reports a technical failure and prevents both heavy stages.
Document manual reconciliation for malformed/unverifiable state. The installed
price-audit identity is nick:nick, cwd `/opt/chaarlie/price-audit/current`, command
`npm run price-audit -- --apply --llm-budget 100`, timeout3h, MemoryMax1G; preserve it.
Also fix the existing automatic-rework budget-detail mapping and stale reserved-run
snapshot before enabling automatic rework; no model budget or new-cycle change.

Price-audit crash containment also leaves an exact launcher process-group marker.
A later contender only confirms that the group is gone; it never kills an
orphaned audit. The installed control-group termination and OOM-stop contain its
descendants. Unknown/pending launch identity remains a visible recovery hold.
The helper's `.unconfirmed` sidecar contains only a fixed reason and timestamp;
the free monitor reports it while leaving the forensic marker intact.
