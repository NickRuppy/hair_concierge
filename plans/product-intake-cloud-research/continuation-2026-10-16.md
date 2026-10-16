# Product Intake continuation — 2026-10-16

## Outcome and authority

Continue the remaining setup under the approved parent [plan](plan.md) and
[Admin journey](admin-review-integration.md). Nick requested: “continue with the
remaining setup steps, keeping automatic alerts disabled. Align any central
decisions with me as you go.” Existing approvals remain settled. The current
increment prepares review safety and independent outbox reconciliation visibility;
it does not activate email, automatic images/rework, publish a product, retry the
backlog, apply a new migration or switch the live worker by implication.

Branch `codex/intake-review-safety`, base `80b963a2cfac866a4083ea00ffbea28acdd1b69c`.
The merged completion worktree is preserved because its guarded finisher refused
unique ignored configuration/evidence. This fresh worktree owns continuation.

## Current evidence and complete remaining queue

PR #689 merged at the base above; exact reviewed worker `7c00ca4a` is deployed.
Main app production deployment is READY. Outbox migration `20261015200636` is
applied. One real isolated-ledger email reached Nick’s inbox; Nick confirmed on 2026-10-16 that wording/layout/link look right. Hold uncertain sends
for reconciliation is implemented. Runtime email/image switches remain false.
Read-only refresh 2026-10-16 05:18 UTC: same healthy idle worker PID 709751, fresh
heartbeat, zero active jobs and zero outbox rows; review service HTTP 200. Exactly
current `20261015-201339-7c00ca4a76c6` plus rollback `20261007-92bfe95862eb` installed;
disk 60%, ~15 GiB available. Research/images/configuration archived before older
release removal. No production changes on this continuation inspection.

Remaining requested deliverables, in dependency order:

- Independent visibility of held/expired email deliveries. Nick approved the test
  email on 2026-10-16; separate activation decision remains required. Automatic
  email stays disabled.
- S3 projected-value judge, durable six-model-run/45-minute cycle reservations,
  two automatic rework rounds and fenced atomic pass/artifact completion.
- Immutable private review images and payload revisions; revision/hash-bound
  data/image approvals; exact guarded Admin publication and notification recovery.
  Approved desktop/mobile journey is reused; no design re-interview.
- Shampoo PR #682 owner/locked-version reconciliation and worker integration.
  Oil stays unavailable pending its owner contract.
- Shared rembg/price-audit lock, representative bounded resource proof and
  monitoring delivery before activation of resource caps/automatic images.
- Exact backlog disposition and ten-case cohort alignment, bounded end-to-end
  trial, Nick’s explicit final approval per product. No inferred bulk retry.

These remain requested work. Splitting implementation does not declare the parent
program complete or park requested work without Nick’s acknowledgement.

## Decision coverage

Confirmed for the independent reconciliation-visibility increment. Confirmed with
Nick: email remains disabled; uncertain sends are held, never automatically
resent; human product publication; ready-first Admin and separate exact data/image
approvals. Parent D3 settles at most two machine-fixable automatic rework rounds;
identity/category/missing-INCI-after-one-search/medical uncertainty goes to Nick.
Inherited: current ledger and runbook, service-only access, five-minute send lease,
no product-state mutation during email observation, no raw payload/recipient/key in
logs, no new communication provider. Implementation defaults: read-only paginated
risk-status ledger observation (held/sending/failed only, never sent/pending), aggregate held/expired/failed counts and oldest reconciliation age, Sentry technical issue
reporting using the existing worker monitor, at most one unchanged observation per
process (subsequent polling still reads current state), and a read-only CLI report.
The monitor never claims, settles, retries or sends an email. It runs independently
of the delivery switch, so disabled sends cannot hide a delivery requiring review.
No new user surface/copy/timing; separate mockup not applicable to this operator
increment. Existing Admin journey remains its own approved authority.

Open consequential assumptions: none for the implemented safety increment.
S3 API is specified in s3-review-cycles.md; Nick confirmed reserved slots stay used.
Shampoo v1.6.2 is the current locked method; #682 remains an offline-only PR and
requires refreshed owner review and worker integration, not a new methodology
choice. Exact cohort/backlog decisions remain dependent rollout work.
Nick confirmed on 2026-10-16: when Shampoo also qualifies for a separate
deep-cleansing listing, retain its regular-shampoo research and show
“Entscheidung nötig” for the additional listing. Do not create it automatically.
Undiscussed consequential assumptions affecting the independent observer: none.
Coverage acknowledgement: Nick’s continuation request plus explicit hold policy.
Internal revalidation: existing sender reports only its returned row; stale sending
quarantine inside the claim RPC can be omitted from that result. Therefore monitor
all held rows and expired sending leases directly, without invoking the claim RPC.
A read failure is visible and must never be reported as zero.

## Independent observer implementation and verification

1. Add `src/lib/product-intake/admin-review-outbox-health.ts`: read only minimal
   notification id/status/lock/error/timestamps with complete pagination, report
   held/expired/failed counts and opaque ID evidence (no payload or recipient),
   evaluate against an explicit clock. Separate pure classification from I/O.
2. Add `scripts/product-intake/admin-review-alert-health.ts`: safe read-only report,
   no credential/config values, nonzero exit for storage failure. Existing env
   loader and service client only. Document safe command and interpretation.
3. Worker polls independent observation on its own non-overlapping 60-second timer,
   started/stopped with the worker. Do not await it in the heartbeat lease-renewal
   tick or batch loop; use a ten-second query deadline so a stalled read cannot
   retain the observer indefinitely; report existing Sentry technical event only on changed
   nonempty issue fingerprint. Do not notify Nick by Customer.io. On read error,
   emit sanitized technical monitoring failure; continue worker. This monitor
   observes existing records and never changes their state or drains extra rows.
4. Tests first: real table query response shape/pagination, expired versus fresh
   sending, held records beyond first page, clock boundary, unchanged suppression,
   changed issue/new IDs, resolved/no issues, and read failure versus empty. No
   tests of source text/private structure. Run focused owner/sibling cases through
   shared verification, root typecheck/source lint once, final whole diff review.

Consumes: existing `product_intake_admin_notifications` schema; status
`needs_reconciliation` and sending `locked_at` expiration. Produces: read-only
observer report and sanitized existing-Sentry diagnostics; no schema write.

## Review and handoff

Read-only Claude/high plan review before implementation and whole-branch review
before publication; reports transient outside Git, verified dispositions retained.
Source/tests/plan/runbook intended for commit; private live receipts archived
outside Git, transient output discarded after disposition. Root main stays clean.
A local proof of Sentry emission is not proof that an operator received its alert;
actual provider issue/routing verification remains a distinct rollout check.
Continue independent authorized work; stop only dependent work at a real missing
decision/access or exact publication/production gate.

## Observer plan review disposition

Claude/high read-only review: approve with revisions. Accepted the genuine cadence
contradiction: a separate non-overlapping 60-second timer observes during model
work without joining/awaiting the lease-renewal tick; ten-second query deadline.
Accepted oldest reconciliation age, explicit `.from` reader type, documented
five-minute SQL lease coupling and one owner for held Sentry signals (remove the
sender-only duplicate). Rejected the proposed extra scope approval: the immediately
preceding completion checklist explicitly identified reconciliation monitoring as
remaining work, and Nick now asks to continue those remaining setup steps. No
new provider, customer message or activation is introduced. The reviewer only saw
the condensed authorization wording; full current chat settles this scope.

Do not introduce a new aggregate SQL RPC/migration just for low-volume risk reads.
Filter out sent/pending in SQL and paginate only risk rows with narrow columns;
this is complete risk visibility without repeatedly reading successful history.
A direct read remains read-only and works on the already applied schema. Provider
alert receipt/routing proof remains a distinct rollout gate. Test command uses
`npm run test:focused -- tests/product-intake-admin-review-outbox-health.test.ts`
and sibling email/worker-observability checks; main owns final verification.

## Current checkboxes after this continuation

- [x] Nick approved the received test email’s wording/layout/link.
- [x] Reconfirmed live healthy worker, zero active jobs/outbox rows and email false.
- [x] Independent read-only observer and CLI implemented; held/expired/failed reads,
      oldest affected-alert age, change-only technical signals, read failure/recovery.
      Separate non-overlapping timer cannot block heartbeat lease renewal. Actual
      read-only CLI reports healthy against the current empty production outbox.
- [x] S3 durable budgets/cycle fences, strict projected-value judge, bounded
      rework outcomes and atomic final research/image evidence implemented locally.
      Nick chose no refunds for reserved slots. Root typecheck/owner proofs pass;
      final exact-content check and counterpart review receipts stay private.
      Combined verification passed 200 tests, including the isolated PostgreSQL
      concurrency proof. Counterpart review found no blockers; verified deadline
      and auth-pause fixes passed 89 affected tests plus final typecheck/source
      lint (zero errors; six pre-existing worker warnings). No new migration or
      worker code has been applied to production.
- [ ] Publish verified safety branch, pass final hosted CI, obtain exact merge and
      migration/release authorization; then deploy with all automatic switches off.
- [ ] Complete private immutable review images and revision/hash-bound Admin
      data/image approvals, guarded publication/rework and notification-only recovery.
- [ ] Refresh/review #682 and integrate locked Shampoo v1.6.2 into worker.
- [ ] Prove shared rembg/price-audit lock, representative caps and monitor routing.
- [ ] Align exact backlog dispositions and ten-case cohort; run bounded proof and
      obtain exact product approval. Automatic alerts stay disabled until Nick chooses
      a separate reviewed activation; no automatic backlog flush.

No requested remaining subsystem is declared complete merely because this safety
increment passes. Current source is local/uncommitted; new migration is unapplied.
