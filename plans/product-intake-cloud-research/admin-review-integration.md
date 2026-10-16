# Admin Product Review integration

## Outcome and decision coverage

Build the approved Produktprüfung journey inside the existing Admin shell. Nick
approved the concrete desktop/mobile proposal after its explanation, then selected
**Ready for review first** on 2026-10-15. Separate values/application and exact
image approvals, explicit per-product publication, rework invalidation and
notification-only recovery are settled. No individual product is approved.

Coverage: **confirmed** for implementation of that journey. Do not repeat the
design interview. Original request: “Yeah build it first but the central
decisions, let's align on them quickly.” Queue default is now explicitly settled.
The retained proposal and `review-proposal/journey.md` are the design authority.

Publication recovery decision confirmed with Nick on 2026-10-16: use a **dedicated
durable publication receipt**, rather than extending submission notification
fields. Record the exact committed product, submission revision, payload hash and
approved image hash atomically with publication. Notification delivery/recovery
belongs to that receipt; retry must reuse the committed product and send only the
missing customer notification. It must never republish or reuse the separate
Admin-alert outbox. No individual publication/customer notification is approved
by this architecture decision. Automatic Admin alerts remain disabled.

The next implementation worktree is `codex/intake-admin-revisions`, based on the
reviewed safety dependency `75da3b16` (#691). It owns the step-2 revision/private
image foundation; step 3 consumes its exact revision/hash contracts and the
publication receipt decision above. Shampoo #693 remains a separate integration
dependency; shared worker edits are integrated sequentially. Merge, migration
application and deployment require Nick's separate exact decisions.

Internal revalidation: Admin has a shared `requireAdmin` session/profile gate.
The standalone cockpit reads directly from the same intake tables, limits its
queue to 100 rows, and records decisions without payload-revision binding. Its
publish endpoint intentionally refuses writes. Production has no
`payload_revision` or admin-notification ledger. Existing package publication
validates finalized image metadata and uses guarded approval RPCs plus a
recoverable notification path. Porting its guards needs a dedicated shared core;
calling a local script or trusting a checkbox would not implement this contract.

## Implementation order

1. **Authenticated live read surface.** Add `/admin/produkt-intake` and a detail
   route under the approved Admin navigation label. Reuse `requireAdmin` before
   service-role creation on every API read. Send private/no-store responses.
   Paginate the whole open-submission queue rather than report the cockpit's
   truncated sample as complete; select each submission's latest job, including
   terminal jobs, so an older blocked job cannot hide a newer outcome. Ready is
   the initial tab. Decisions and technical errors remain accessible; ongoing
   work stays visible without being described as a human decision. Keep historical
   rows until their dispositions are approved; no inferred test-data filtering.
   Detail shows identity, engine pins, exact proposed final values/rationales,
   application protocols, source links, judge findings and saved evidence. No
   local filesystem path is served as an image. Existing HTTP(S) image references
   are links only; private rendition delivery is implemented in step 2.
   The first incremental slice explicitly has no enabled approval/publication/
   retry controls. This is implementation sequencing, not a reduced end state.
2. **Immutable evidence and decisions.** Ordered migration adds payload revision
   and immutable image-byte hashes; every research write increments revision.
   Private bucket plus server-signed renditions, worker upload and exact revision
   binding. Shared core/RPC checks lock the submission, validate job/status and
   revision, then record an admin decision atomically. Stale tabs receive 409.
   Research/rework invalidates prior approvals; never reuse a “latest decision”
   independently of revision/hash. Preserve legacy cockpit until parity.
3. **Guarded publication/recovery.** Extract existing finalized-image and research
   readiness guards into shared server code, called by Admin and the CLI. The
   final confirmation names product and revision and requires both current
   approvals. Atomic publication must verify revision and asset again under the
   same lock as the existing catalog approval RPC. Notification retry reuses the
   committed product, never republishes it. Wire rework through the separately
   planned bounded-cycle RPC, not the cockpit's unfenced direct updates.
4. **Email and activation.** The local atomic outbox and dispatcher are implemented;
   see [email increment](admin-alert-outbox.md). Use the existing Customer.io transport. Nick confirmed the sole recipient and that no template
   exists; the recipient is private configuration and the German template is
   prepared under `docs/customerio/`. Provider draft/ID and delivery verification
   remain dependencies. Apply migrations/deploy only after reviewed-head gates and host
   resource proof. Real cohort and per-product writes still require exact approval.

Routine defaults: current design tokens/components, responsive stacked cards,
German copy, explicit empty/error/reload states, no new provider or review DB.
No open consequential choice blocks step 1. Later external setup and exact cohort
selection remain recorded dependencies, not guessed approvals.

## Verification and artifacts

Step 1: focused tests of queue grouping/latest-job selection and exhaustive
pagination; authorization 401/403 before any service client/read; safe-link
handling; missing submission and read failure; actual desktop/mobile browser
inspection using fictional local QA data or an authenticated read-only session.
Do not create production fixtures. Typecheck and targeted lint through the shared
launcher. Steps 2–3 require real SQL/PGlite race, stale revision, rollback and
idempotency proofs before enabling their controls. Full CI remains required.

Use one read-only terminal Claude plan review and whole-branch review; keep
transient reports outside Git and record verified dispositions. Commit the plan,
approved proposal, implementation and sanitized receipts. No private queue export,
user identifiers, service keys or host preservation manifests in Git.

## Counterpart review and dependency precision

Claude read-only/high, 2026-10-15: approve with revisions; step 1 executable.
Accepted: the concrete implementation authority remains parent `plan.md`
§4a.1/4a.3/4c, including immutable `<submission>/<payload_revision>/<sha>` storage
keys, `packages/product-intake-core` as shared extraction target,
`buildPublishPreflight`, and the legacy-package approval bridge. Existing rows
start at revision 1; historical unbound decisions remain audit evidence and
never count as current approvals. Cockpit compatibility cannot weaken that gate.

Step 3 **consumes** S3's reviewed `review_cycle_id`, `auto_rework_count`, reserved
model budget, deadline and atomic `product_intake_commit_research_pass` RPC;
its exact signature/receipt belongs to the S3 plan before implementation. S3
ships before enabling Admin rework, not after it. Step 2 owns worker research-save
revision/upload seams in `packages/product-intake-core/src/repository.ts`,
`scripts/product-intake/codex-research-worker.ts` and `pipeline/image.ts`; the
orchestrator integrates sequentially with Mask, without parallel writers.
Vercel cannot read Hetzner's local rendition disk: signed private Storage delivery
is a required dependency, never a proxy to an arbitrary local file path.

The suggestion to ask again about hiding test/history rows is rejected for this
read-only slice: no approved classification exists, so filtering would invent
one and could hide a real unresolved submission. Show all open entries and label
older unversioned research honestly. Exact proposed dispositions still go to Nick
before any classification, hiding, retry or closure. This does not settle that
pending backlog decision. No new feature switch is needed for an authenticated
read-only internal page; the cockpit remains available until full parity.
Transient report: `/tmp/intake-admin-plan-review-20261015.md`, discard after
retaining this verified disposition.

## Step 1 implementation receipt

Queue/detail/pages/API/nav and the shared responsive shell implemented locally.
Eight focused read-model/transport tests plus twelve existing shell/print checks
pass. A read-only real repository probe returns all 141 open entries (12/113/16),
and loads a detail without copying submission user/conversation IDs. Source
ESLint and root typecheck pass. Actual components inspected on desktop and 390px
using fictional Lab fixtures; production fixture writes were unnecessary.
The global middleware's unauthenticated HTTP redirect remains unchanged; the
handler's 401/403/no-service-client order is explicitly tested.

Whole-branch Claude read-only/high: approve, no blocking findings. Reviewed
correctness and structural risks, including pagination/auth and combined Mask
seams. Artifact/decision payloads are admin-gated product research and may contain
verbatim research text; the explicit PII exclusion is limited to the submission
projection, not a claim of a universal redactor. Future actions must use the
revision/hash contract above. No image/data approval, publication, retry, email
or migration is enabled by step 1. Steps 2–4 remain required program work.
