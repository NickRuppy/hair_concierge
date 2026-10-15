# Admin alerts: hold uncertain delivery and prepare disabled release

## Outcome and authority

Continue the approved intake setup with automatic alerts disabled. Nick explicitly
selected **Hold uncertain sends for reconciliation** on 2026-10-15. The already
approved dedicated template and real isolated-ledger delivery test are complete;
see [receipt](receipts/admin-alert-delivery-2026-10-15.json). The parent completion
plan records authorization for reviewed release steps; individual product writes,
backlog retries and automatic activation retain their exact approval gates.

## Decision coverage: confirmed for this increment

- **Confirmed with Nick:** uncertain delivery is held, never automatically resent;
  continue remaining setup, keep automatic alerts disabled.
- **Inherited from evidence/contract:** new completion RPC requires its migration
  before a worker switch; no historical backfill; preserve current release and one
  verified rollback, research/images/configuration, exact leases and human publish.
- **Implementation defaults:** explicit `needs_reconciliation` ledger status;
  no automatic recovery RPC; keep definite 429 rejection retry/backoff (five total
  attempts). Treat network failure, missing receipt, HTTP 408/5xx and expired
  send leases conservatively as uncertain. Existing transport performs one fetch.
  Remove the unused ambiguous-resend counter from this unapplied new migration.
- **Open consequential assumptions:** none affecting this increment. Backlog
  dispositions, exact product cohort and production activation remain dependent
  parent work, not approvals inferred from this change.
- **Coverage acknowledgement:** Nick's current continuation request and explicit
  hold-for-reconciliation answer; parent completion checklist authorization.
- **Internal revalidation:** current draft resends uncertain sends once and
  reclaims expired send leases; these contradict the now selected policy. Live
  migration state must be refreshed before applying anything. Production worker
  still uses release `92bfe95862eb`, both services healthy at 19:48 UTC.
- Undiscussed consequential assumptions affecting this handoff: none.

## Direction, operator outcome and target map

Edit the new, still-unapplied
`20261015200636_product_intake_admin_notifications.sql`: ambiguous settlement
and expired `sending` claims become `needs_reconciliation`, clear the lease, keep
attempts/receipt evidence, and never become claimable again. A claim quarantines
stale rows and continues to eligible pending work so an uncertain row cannot
block a later alert. Failed permanent/exhausted definite sends remain `failed`.

`src/lib/product-intake/admin-review-outbox.ts` returns the explicit `needs_reconciliation` result;
only known definite rejections return `retry_recorded`. No new delivery switch or
retry seam. Worker exceptions preserve current ops monitoring. No new Admin UI;
the approved product-review journey and email content remain unchanged. Operators
inspect aggregate status and minimal ID/error/receipt fields through a read-only
SQL query in the runbook; any resend or resolution needs the exact row reviewed
against provider activity first. Holding an email never changes product status.

## Ordered tasks and verification

1. Extend existing real PGlite notification lifecycle test: 429 backoff/fence,
   ambiguous hold, no reclaim, expired first-attempt lease hold without increment,
   stale receipt rejection, later pending row progress, definite fifth-attempt
   exhaustion. Extend the existing real-transport error table for held 408/5xx,
   network and missing-receipt results. Red proof is recorded against the pre-policy local draft: 26/28 passed, with
   exactly the SQL hold-state and transport result assertions failing. After
   repair, all 36 SQL/email/shared-transport owner checks pass.
2. Implement SQL/dispatcher behavior; run focused SQL/email/shared-transport owner
   tests through the shared launcher, typecheck/source lint and diff checks. No
   additional real email is authorized or needed for this policy-only change.
3. Update owning email/setup/runbook decisions, remove stale proposed resend
   claims, retain sanitized provider receipt and private configuration.
4. Refresh live queue/schema, migration lineage, branch/release CI and deployment
   prerequisites. Prepare the exact disabled release with no claims/retries or
   automatic switches. Apply only the reviewed surgical migration before an
   authorized release switch, never blind `db push`. Verify roles/RLS/functions
   read-only afterward. Do not install unproven resource caps or clear live locks.
5. Obtain read-only terminal Claude plan/whole-branch reviews, verify findings,
   refresh exact content receipts and carry already authorized release steps
   through their gates. If a real release prerequisite blocks progress, preserve
   the healthy live worker and state the exact missing evidence; continue
   independent preparation.

## Artifacts and limits

Plan/source/tests/runbook/sanitized receipts: commit. Credentials, raw provider
receipts and temporary review reports: private outside Git; discard transient
reports after retaining disposition. Root main stays clean. No product publish,
customer notification, blocked-job retry or automatic-alert activation. Production
resource controls, remaining Admin approval actions and full program completion
remain tracked in the parent plan.

## Counterpart plan review disposition

Claude/high read-only terminal review found no blocking technical defect. The main
session verified the live table/RPC and migration are absent, current heartbeat
fresh and complete queued/running/rework counts zero. Accepted exact result-token
clarification and updated already-completed red-proof wording. Rejected the
suggestion that a red proof needs a committed baseline: the recorded local-draft
run failed for the intended behaviors before this policy repair. Explicitly carry
HTTP 408/5xx manual-reconciliation behavior into activation review; no automatic
activation occurs here and no settled hold-policy question is reopened.

The release audit proposed disabling the existing manual image judge. Rejected
as a behavior change: retain current manual image QA; keep automatic image
preparation false and recheck that no image/rework job is queued before switch.
Resource caps/shared-lock activation remain separate until their representative
proof; a code-only release preserves installed units/existing drop-ins and their
effective native Node startup. A minimal owned `30-disabled-release.conf` loads
the reviewed SHA from `shared/release.env` to override the installed unit's old
hardcoded SHA, and explicitly disables both automatic switches; no resource
settings change. Prior current release becomes the verified rollback only
after new-release health checks; older unique evidence is preserved before any
retention cleanup.

## Final code review disposition

Claude/high read-only terminal whole-branch review found no blocking defect.
Migration-before-code remains mandatory. Accepted dormant observability gap:
expired-send quarantine occurs inside the claim RPC, so its held row may not
surface in the drainer result. Before enabling automatic alerts, operational
monitoring must inspect all `needs_reconciliation` rows independently of send
results. The runbook already provides a read-only reconciliation query; no
automatic resend or held-row resolution is introduced. Unused old core helper
exports and one-row polling are non-blocking maintenance notes, not rollout gates.
Main reviewed the minimal release-identity/disabled-switch override added after
review; Linux unit validation is required before installation. No settled product
or manual image-QA behavior changes.

## Migration execution receipt

Applied the reviewed additive SQL through the Supabase migration endpoint. It
generated canonical production version `20261015200636`; the repository filename
and offline harness were aligned immediately with byte-identical SQL
(`0c75500de827ae3c267f4124814edc76ad31ce119d21381686f3679604b07406`).
Read-back confirms table/RLS, all three signatures, service-role access and denied
anon/authenticated access, with zero outbox rows. No claim, research/job mutation,
provider send or worker restart occurred. See
[migration receipt](receipts/migration-20261015200636.json).
