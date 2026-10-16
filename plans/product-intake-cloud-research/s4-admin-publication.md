# S4: guarded Admin approvals and publication

## Outcome, scope and authority

Finish the approved [Admin journey](review-proposal/journey.md) and steps 2–3 of
[Admin integration](admin-review-integration.md): separate current-version values
and image approvals, explicit publication, human dispositions and recoverable
customer chat notification. Preserve the cockpit until demonstrated parity.
The separate Scanner welcome CI repair is owned in `codex/scanner-welcome-ci`;
do not mix Scanner edits into this increment.

Worktree `codex/intake-admin-publication` starts at #694
`ec81aaa8516a19c0a072e0145b58e9470c091b47`, including #693/#691. Root remains clean
on main. User authorization: “fix the CI blocker and continue with the remaining
Admin approval and publication steps. Keep automatic alerts disabled, and align
any merge, migration or deployment decisions with me.” Earlier authorization
also permits reviewed code commits/pushes/draft PRs; no merge, migration apply,
deployment, live product publication or automatic alert activation is inferred.

## Decision coverage: confirmed

**Confirmed with Nick:** ready-first queue; exact values/application and images
approved separately; final product/revision confirmation including user link and
customer chat effects; rework invalidates approvals; dedicated durable publication
receipt and notification-only recovery; uncertain Admin email sends held;
automatic alerts disabled. On 2026-10-16 Nick confirmed a new customer chat message
for each distinct information request, with identical-request retries deduplicated.
Nick also confirmed that an explicitly deleted submission owns deletion of its
publication receipt, following existing research-history behavior. This permits
no cleanup now; the product FK retains the existing RESTRICT contract.

**Inherited:** canonical [runbook](../../docs/product-intake-research-ops.md),
S3 cycle/lease/budget boundaries and S4 immutable revision/image foundation.
Historical unbound decisions never count. Admin requires verified session plus
`profiles.is_admin` before service-role access. Catalog creation must preserve
all current identifier, canonical protocol, category, Bondbuilder owner-isolation
and user-linking guards. Customer notifications are DB chat messages, independent
of the Customer.io Admin email outbox. Product intake remains non-recommended.

**Implementation defaults:** service-only SQL RPCs with empty search path, strict
request UUID/digest replay, submission→job lock order; no arbitrary paths or
public URLs from request bodies. Existing category validation and finalized-image
validation are extracted into server-safe shared modules rather than duplicated.
Use the existing deterministic chat-message idempotency with an explicit saved
decision event key for distinct information requests. Persist notification result
on the relevant publication receipt or human decision; no new email provider.

**Open consequential assumptions:** none. Undiscussed consequential assumptions
affecting this handoff: none. Individual product approvals, backlog dispositions,
merge/migration/deployment and later alert activation remain separate decisions.
Coverage acknowledgement: approved retained desktop/mobile proposal and latest
implementation request above. Internal revalidation: 2026-10-16 at #694, current
CLI/cockpit/RPC/read-model inspected; live read 13:05 UTC: zero active jobs/outbox,
revision schema unapplied. This is no production-write authorization.

## Designed journey and evidence

Reuse the approved proposal without changing its hierarchy. Nick opens the exact
saved revision, reviews values and images, and saves either approval independently.
An action posts revision/hash/job plus request UUID; a stale tab receives 409 and
must reload. Rework immediately invalidates approvals by cycle binding even before
the next payload replacement. Answering a research question records the exact
answer and requests a new bounded cycle; it never invents a product or extra listing.

Passing server preflight enables “Zur Veröffentlichungsfreigabe”. Confirmation
names the product and revision and explains catalog, user-link and chat effects.
Success shows the committed product. If customer notification fails, show
“Produkt veröffentlicht · Nachricht ausstehend” and a notification-only retry.
Uncertain publication response is reconciled by its durable request/receipt before
any new publication request. Info/reject/link actions describe their customer
effects and require explicit confirmation. Mobile keeps the same facts and actions.

No product or customer notification will be sent during local QA. Synthetic Lab
fixtures exercise success, stale/reload, blockers, busy, failed publication and
post-commit notification recovery. Keep durable sanitized browser evidence with
the PR, transient logs outside Git. Real authenticated Storage/PostgREST and exact
product publication are later live gates requiring the user's approval.

## Ordered implementation and verification

1. **Database authority.** Generate an ordered local migration. Add idempotent
   revision/hash/job/cycle-bound decision RPC and a durable publication receipt.
   Require exact separate data/image decision IDs and committed final rendition
   hash; reject revoked/superseded decisions, unresolved questions and non-ready
   jobs. Check receipt replay before calling the catalog writer. Preserve both
   approved and resulting persisted revision/hash: the existing writer explicitly
   assigns `researched_payload.final`, legitimately rotating revision. Under the
   same SQL transaction delegate the existing catalog guard chain, finish the job,
   and write the receipt. Restrict every legacy service-callable approval entry
   point so it cannot bypass current approvals: rename the normal/owner writers
   to private delegates and revoke service/public execution. Preserve the separately
   guarded `apply_scan_expansion_batch_v1` by changing only its known internal
   catalog call to the private normal delegate; do not add a GUC or source-based
   bypass to the public approval API. Prove the actual batch contract afterward.
   Human dispositions lock and pause/cancel jobs atomically; rework calls S3's
   cycle-reset RPC without refunds. Bind legacy package approval after the final
   research save and verified immutable image manifest, without pretending it was
   researched by a worker. Test actual SQL denial, replay, changed-request conflict,
   rollback, stale revision, rework invalidation, old-ABI bypass and receipt recovery.

2. **Shared guarded service and CLI parity.** Core exposes bound action/preflight/
   publish RPC types and transport functions. Server shared service validates the
   persisted normalized payload using existing category/owner rules. Preflight
   explicitly replaces `buildPublishPreflight`/`latestDecisionForField` in
   `packages/product-intake-core/src/repository.ts`: no decision can count without
   exact revision/hash/job/cycle binding. Preflight checks current approvals,
   exact final/thumbnail manifests and deterministic
   finalizer evidence; final copy reads private manifest bytes, verifies hash,
   length and image dimensions, uploads public immutable objects without overwrite
   and verifies downloaded bytes before atomic publication. This HTTP Storage phase
   reads revision N before the SQL catalog transaction rotates it to N+1; no HTTP
   write is part of the SQL transaction. A failed catalog commit may leave an
   unreferenced immutable public object; no orphan sweep is in scope. No filesystem path or
   model-provided hash authorizes publication. CLI `approve`, `approve-package`
   and Bondbuilder callers use the same service. A legacy package bridge records
   its explicit exact reviewed approvals only after saving and reloading current
   revision; unchanged replay uses the receipt before resaving/uploading. Preserve
   existing no-image package decision when explicitly reviewed; never synthesize
   an image approval. Test real Storage HTTP transport and one legacy package.

3. **Customer recovery.** Publication receipt tracks pending/sent/failed/not-required
   chat delivery. Retry reconciles the existing deterministic message, never invokes
   catalog creation. Monotonic completion prevents a late failure overwriting sent.
   Distinct info requests use durable decision event keys; request replay preserves
   key and content. Existing request-info/reject notifications and AgentV2 context
   behavior remain shared. Notification errors do not roll back committed publication
   or misreport completion. Tests cover commit-before-failure, retry/concurrency,
   duplicate response, deleted owner and distinct-versus-identical info request.

4. **Authenticated Admin actions and UI.** Every mutation checks admin auth before
   client/body processing, checks same-origin POST and strict bounded payload input,
   and returns private/no-store German responses. Carry only server-loaded actor
   identity. Add approve-data/image, answer/rework, request-info/reject/link, preflight,
   explicit publish and notification recovery. Read detail includes current hash,
   current action/preflight state and sanitized receipt; never serialize owner IDs.
   Old cockpit uses the same guarded functions or explicitly directs unavailable
   actions to Admin, never fabricates final publication approval from two checkboxes.
   Inspect actual desktop/mobile and keyboard confirmation/error/recovery. Tests
   cover auth-before-service, CSRF, strict confirmation, stale 409 and failed delivery.

5. **Final integration.** Main runs focused combined checks once under shared budget,
   then typecheck/source lint/build and actual PostgreSQL two-backend publication /
   payload-write/rework races. Run ready-check and one read-only terminal Claude/high
   correctness+structural whole-increment review; verify findings and refresh only
   affected checks. Keep exact fingerprints and migration IDs in receipts. Commit
   code, plan and durable browser proof; archive private diagnostics and discard raw
   reviewer output after verdict/hash. Push/open draft only reviewed exact content.
   Hosted CI remains mandatory; Scanner repair and stack retarget checks are gates.

## Concrete target and check map

- SQL: one generated migration under `supabase/migrations/`; extend decision
  binding, private asset guard for explicit legacy bridge, add service-only
  `product_intake_record_review_decision`, `product_intake_review_preflight`,
  `product_intake_register_legacy_review`, `product_intake_publish_reviewed_submission`
  and monotonic notification-result RPC. Owning SQL tests:
  `tests/product-intake-admin-publication-postgres.test.ts`; real races extend
  `tests/product-intake-review-cycle-race.test.ts`. Reuse actual catalog migration
  chain with `tests/scan-expansion-batch-postgres.test.ts` and Bondbuilder integration.
- Shared transport/types: `packages/product-intake-core/src/{jobs,repository}.ts`.
  Shared service: new `src/lib/product-intake/review-publication.ts`, with extracted
  finalized-image validator/storage code and `notifications.ts` event-key support.
  CLI: `scripts/product-intake/{approve,approve-package,review-actions}.ts` and
  existing link/request-info/reject/notify entry points. Owner tests:
  `tests/product-intake-publication.test.ts`, `product-intake-approve-package.test.ts`,
  `product-intake-review-workflow.test.ts`, `product-intake-notifications.test.ts`.
- Admin: new `admin-review-actions.ts` + HTTP handler and action route under
  `src/app/api/admin/produkt-intake/[submissionId]/`; extend `admin-review-repository.ts`
  and `admin-review-model.ts`. UI: `src/components/product-intake/admin-review.tsx`
  plus a focused client actions component; fictional states in
  `src/app/labs/produkt-intake/page.tsx`. Tests:
  `tests/product-intake-admin-actions.test.ts`, existing Admin read tests and a
  focused browser journey. Same-origin precedent: `api/admin/beratung/invites/route.ts`.
- Cockpit: its `review-decision`, `rework`, `publish-preflight` and `publish` route
  adapters and controls consume bound core interfaces or safely direct to Admin.
- Commands: `npm run verification:plan -- --files <changed paths>`; focused tests
  via `npm run test:focused -- <owners above>`; real race with
  `PRODUCT_INTAKE_REVIEW_CYCLE_POSTGRES_TEST=1 npm run test:focused -- tests/product-intake-review-cycle-race.test.ts`;
  `npm run typecheck`; gated explicit source ESLint; `npm run build`.

## Counterpart plan review disposition

Claude/high read-only terminal review: approve with revisions. Accepted explicit
preflight replacement, two-phase Storage→SQL ordering and revision-N verification,
public-orphan disposition, concrete target/check map and private delegate mechanism.
The attribution concern is resolved by Nick's actual asynchronous answer in this
chat on 2026-10-16: “New message for each distinct request (recommended)”; it is
not an inference. No new choice or design reapproval is needed. Main revalidated
the complete plan against those revisions; decision coverage remains confirmed.
Whole-increment Claude/high review approved without blocking findings. Main fixed
its truthful-preflight labels and stale delegate comment; retained unused legacy
exports rather than widening this patch for cleanup. Main also restored no-job
request-info/reject/link parity with strict stale/null-forgery denials. The narrow
counterpart delta and final exact fingerprint are retained in the external receipt.
Raw review is transient under `/tmp`; archive its verdict/hash in the final receipt.

## Verification evidence

Main observed the approved desktop and 390px flow in Chrome; retained evidence is
[publication-proof](publication-proof/README.md). Four browser checks pass, including
keyboard confirmation, missing images and uncertain-request recovery; Lab makes zero
Admin POSTs. Combined owner/sibling suite passed 181 tests; the refreshed SQL owner
passed 14 tests after preserving optional rejection next steps and historical
no-job dispositions; the final shared-service/SQL delta passed 20 tests. Actual PostgreSQL
proved six lock/race paths, including stale publication, concurrent receipt replay,
and rework winning over publication. Recorded mutation checks fail with the old CSRF,
publication replay and stale-notification behavior and pass with the guards restored.
Current source-level typecheck passes. Final lint/build and counterpart code review
are recorded outside Git against the final content fingerprint. No production data
or switches were changed.

## Rollout and stop contract

All automatic switches stay disabled. All new migrations remain unapplied. Before
any merge: refresh dependency CI and exact reviewed heads, review migration-first
compatibility with the idle existing worker, and align that sequence with Nick.
No cleanup/retirement of the running cockpit before parity and explicit deployment.
No backlog replay, individual product approval, production image upload or customer
notification is authorized by building these controls. Full setup completion still
requires shared host resource/monitoring proof and a separately approved bounded
live cohort; this increment must not claim those completed.
