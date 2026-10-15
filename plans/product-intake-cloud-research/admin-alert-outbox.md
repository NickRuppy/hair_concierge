# Admin review alert outbox

## Outcome and authorization

Finish the approved internal email slice with a dedicated Customer.io template,
atomic final review handoff, durable delivery receipts and one labelled test to
Nick's configured email. Automatic alerts stay disabled. Source: parent
[plan §4b](plan.md#slice-4b--email-per-product-worktree-intake-review-email--after-s3)
and [template contract](../../docs/customerio/product-intake-admin-review.md).
Nick explicitly requested template creation, outbox integration and one email
test on 2026-10-15. This increment does not activate auto-rework or publication.

## Decision coverage: confirmed

- **Confirmed with Nick:** sole private recipient; dedicated template; one test;
  automatic alerts disabled; approved German email journey. On 2026-10-15 Nick
  selected **Hold uncertain sends for reconciliation**, superseding parent F4’s
  proposed one-resend default. See [disabled release increment](disabled-alert-release.md).
- **Inherited from contract:** outcome and outbox commit together; no historical
  backfill, intermediate rework alert or end-user personal data. Migration before
  worker release; preserve the current release and one verified rollback.
- **Implementation defaults:** service-only RLS/RPCs; UUID send leases, five-minute
  lease expiry, five attempts/backoff for definite 429 rejection. Uncertain HTTP
  408/5xx, transport/missing-receipt and expired-lease outcomes become explicit
  `needs_reconciliation`, never automatically resent. Safe error codes only.
  Server-owned labels and strict public identity/snapshot bounds stay unchanged.
- **Open consequential assumptions:** none for this email/disabled-release
  increment. Full S3, Admin actions, exact backlog/cohort and automatic activation
  retain their parent gates.
- **Coverage acknowledgement:** Nick’s template/outbox/test request, current
  continuation with automatic alerts disabled and explicit hold-policy answer.
- **Internal revalidation:** removed the inactive proposed ambiguous-resend path;
  real persistence and transport regression checks now enforce hold semantics.
  Provider message20/template190 and real received-email evidence remain valid.
- Undiscussed consequential assumptions affecting this handoff: none.

## Direction and target map

A new `product_intake_commit_research_pass` RPC locks the current submission and
job, extends the existing exact non-null running lease fence, writes the proposed preview (when
present), resolves only captured rework decision IDs, completes the job and inserts
one immutable notification snapshot in one transaction. TypeScript retains all progress/outcome computation; SQL accepts that exact payload and adds only completion metadata. Artifacts/evaluation remain
before this final handoff. A deterministic job/lease completion key deduplicates a
lost RPC acknowledgement; a stale owner cannot overwrite a subsequent pass.

Research `completeResearchPass` and both `processApprovedImageForReview` returns in `src/lib/product-intake/pipeline/image.ts` call the same RPC. The image branch returns/continues before research completion; the counterpart claim that it shared one funnel was rejected against those call sites.
Research continuing into image preparation is `continue` and creates no alert;
final ready creates `ready_for_review`, incomplete research/image review creates
`needs_nick`. Technical exceptions retain the existing ops failure path, no email.

A separate dispatcher claims and settles outbox rows through service-only RPCs,
sends via the existing Customer.io receipt transport with an optional per-send `tracked:false` override (existing callers without the new optional field retain their behavior), and records provider IDs.
Automatic worker draining checks `PRODUCT_INTAKE_REVIEW_EMAILS === true` before
any claim; missing/false is off. Explicit test is a separate CLI mode, requires
`--test --confirm`, refuses with automatic delivery enabled and uses an isolated
local PGlite ledger/synthetic submission, never the live backlog. It uses the same
claim/send/settle implementation. No test profile or real product is created in
Supabase. A test link opens the existing authenticated Admin home, labelled as a test;
normal alerts link to the exact submission. Automatic activation requires the Admin detail route to be deployed first. The new explicit test command is `scripts/product-intake/admin-review-alert.ts`; it never calls legacy customer `notify-pending.ts` or `notifyReviewResult`. The provider template is read back and
both zero/three-question variants are provider-rendered before sending if access
permits. Provider acceptance and inbox verification are separate evidence.

Files: one migration; core repository completion wrapper; worker and image final
handoff; `src/lib/product-intake/admin-review-email.ts` and dispatcher; explicit
notification CLI; existing real PGlite harness and focused email/worker tests.
Runtime config stays private. Canonical HTML is the provider source; Customer.io
automatically generates the verified plain-text alternative.

## Operator journey and evidence

Existing approved email mockups are in `review-proposal/email-ready.html` and
`email-decision.html`; no new Admin UI. Nick receives a clearly labelled test,
checks its content/link and replies before automatic delivery can be activated.
No live product publication or customer notification. A failure leaves a safe,
visible ledger error and automatic delivery off; uncertain sends remain held for
provider reconciliation and cannot be automatically reclaimed.

## Ordered tasks and acceptance

1. Create/read back the dedicated provider template and ID with tracking off,
   fixed verified sender and passthrough layout; restore CLI auth through browser
   if needed. No edits to existing transactional messages.
2. Add migration/RPC completion + ledger claim/settle, extend real migration tests:
   atomic rollback, stale owner denial, repeated completion, no continue event,
   captured decisions only, claim fencing, retry/backoff, ambiguous recovery,
   no access for anon/authenticated. No live migration application in this slice.
3. Replace final worker preview/job handoff and image completion with the RPC;
   preserve artifact-before-shadow-evaluation contract, block intermediate alerts.
4. Add strict email snapshot builder and worker drainer with default-off flag;
   exercise actual persistence plus transport, exact one transition, no claim while
   disabled, safe provider failure, and receipt settlement. Add isolated explicit
   CLI test using the same drainer, never a fallback inline/live-backlog sender.
5. Run focused owner/sibling tests, typecheck and targeted lint via shared launcher,
   inspect the full diff and obtain read-only high-effort Claude review. Provider
   render/send only when template exists; verify delivery receipt and inbox.
6. Update checklist/docs/verification receipt with exact completed/pending evidence,
   template ID and disabled status, without recipient or credentials in Git.

## Verification and handoff

Real PGlite owns transactional/idempotency/RLS assertions; transport boundary owns
allowlisted message data and dispatch failures; worker owner tests prove delayed
final handoff and image readiness routing. Verify private config false before and
after test. No broad duplicated local suites. Full hosted CI awaits publication.
All plans/source/templates/tests are commit artifacts. Provider/auth receipts and
review output are private outside Git; transient outputs discarded after findings
resolved. Stop before publication/deployment/migration activation; finish the
explicit external template and test where access allows, report any real blocker.

## Counterpart plan review disposition

Read-only Claude/high reviewed this plan on 2026-10-15. Image single-funnel finding rejected with both image.ts return sites and the worker's continue; progress boundary made explicit. Ambiguous delivery choice remains pending for Nick rather than inferred from parent defaults. CLI identity and Admin deployment prerequisite clarified. Full final branch review follows combined checks.

## Final review disposition

Read-only Claude/high whole-branch review found no blocking defects. Aligned SQL
and application snapshot text bounds to 180; added outcome/label consistency
and timezone-independent completion keys. Reused the existing lifecycle job RPC
in the transaction to avoid a second copy. Pending-alert reconciliation is now
an explicit, human-gated activation prerequisite; no unsent row may be marked
sent. Sender tests use the real transport with fetch mocked; no test-only sender
injection seam. The optional shared transport tracking override leaves existing
callers unchanged and explicitly disables tracking for these alerts; 17 sender/
transport checks pass, including the recorded red proof before the override.
All final deltas were reviewed by the main session and their affected checks run.

## Live provider/test completion, 2026-10-15

Dedicated message 20/template 190 created in workspace 219516; trigger
`product_intake_admin_review_v1`, existing verified Chaarlie sender, passthrough
layout, no CC/BCC, tracking off, retention protection on, draft queuing off.
Provider API template enabled for the explicitly authorized test; worker dispatch
remains false. Nick approved a dedicated App API key, saved only in ignored private
runtime configuration. Existing templates/keys were untouched.

Both outcome variants rendered correctly, including escaped angle brackets and
ampersands. The isolated-ledger CLI test sent once through the actual outbox and
provider transport; provider receipt matches the email received in Nick’s inbox
at 19:40:58 UTC. Both HTML and automatically generated text alternatives verified;
tracking headers false and sender authentication passed. See
[delivery receipt](receipts/admin-alert-delivery-2026-10-15.json).

Still pending: Nick’s review of the received test;
reviewed release/CI, migration before new worker deployment, Admin routes live,
private runtime configuration on worker, pending-row reconciliation and explicit
bounded activation. Management CLI renewal is optional and does not block the
verified API sender. No migration/deployment/automatic activation performed.
