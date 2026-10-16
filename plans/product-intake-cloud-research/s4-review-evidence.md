# S4: immutable review evidence and payload revisions

## Outcome, scope and authority

Implement step 2's evidence foundation from [Admin integration](admin-review-integration.md)
and [parent S4a](plan.md). Admin can show the exact private image renditions for a
specific saved research revision. Every research replacement invalidates older
approvals. This increment does not enable approval/publication/retry controls;
their implementation remains required subsequent work, with the dedicated
publication receipt Nick selected on 2026-10-16.

Worktree: `codex/intake-admin-revisions`, base Shampoo #693
`3cfc2efb71a9cd5f9341b729c8da8e926a27ba71`, which includes safety #691
`75da3b16ec4ea96c28341ca7cae342342866a627`. Dependencies were integrated locally
by fast-forward before shared worker changes; no GitHub PR merge. Root main stays
clean. Production migrations, uploads, deployment and individual product writes
are not authorized by local implementation approval.

## Decision coverage: confirmed

**Confirmed with Nick:** approved desktop/mobile [journey](review-proposal/journey.md),
ready-first queue, separate exact data/image approval, explicit product publication,
rework invalidation, durable publication receipt with notification-only recovery;
automatic alerts disabled. Original scope acknowledgement: “Yeah build it first
but the central decisions, let's align on them quickly,” followed by continued
setup authorization and the explicit receipt answer on 2026-10-16.

**Inherited:** parent S4a.1/S4a.3 requires private service-only Storage, immutable
`<submission>/<payload_revision>/<sha>` keys, SHA-256 of actual bytes, revision-bound
decisions and stale-tab 409. Existing rows start at revision 1; historical unbound
decisions are audit only. S3's fenced atomic pass owns final research completion.
No Vercel proxy to Hetzner paths; no model-created approval or asset receipt.

**Implementation defaults:** database-authoritative payload SHA-256 of persisted
JSONB text, consumed as an opaque revision token by Node (never independently
recreated using JSON.stringify); five-minute signed image URLs; no-store Admin
responses; immutable upload with upsert disabled and hash verification on duplicate.
SQL changes use the existing submission-then-job lock order and service-only grants.

**Open consequential assumptions:** none for this foundation. Individual backlog
dispositions, cohort selection, merge/migration/deployment and activation remain
explicit subsequent decisions; none is needed for local implementation.
Undiscussed consequential assumptions affecting this handoff: none.
Internal revalidation: 2026-10-16 against this base and current production read-only
observations: no payload_revision, private review bucket or review_cycle_id yet;
zero active jobs/outbox rows. These live observations do not authorize writes.

## Exact evidence contracts

- Submission gains server-controlled positive `payload_revision` and
  `payload_sha256`; existing rows initialize at 1. A research-payload write
  increments the revision even when JSON values happen to be identical. Ordinary
  status/notification updates cannot increment or forge the revision. Hash the
  stored research payload, with a specified null representation, in the database.
  Use a column-specific `BEFORE UPDATE OF researched_payload` trigger: PostgreSQL
  fires it for an explicit identical assignment, but not for a status-only update.
  A preceding general guard rejects caller-forged revision/hash fields; the column
  trigger alone increments and rehashes. Insert stamps revision 1. Backfill hashes
  for every existing row before installing guards; SQL NULL and JSON null both
  hash the literal UTF-8 text `null`. Image-only atomic passes also assign the
  retained research payload, so new image evidence invalidates the old revision.
- Decisions gain nullable revision/hash/approved-asset fields for historical rows;
  future bound decisions must carry all applicable tokens. Preflight requires
  current submission revision/hash, current job, and exact approved final bytes.
  Legacy unbound approvals never become current by backfill.
- Asset manifest rows contain submission, revision, owning job, rendition kind
  (`raw`, `magenta`, `neutral`, `final`, `search_thumbnail`), SHA-256, immutable
  bucket key, media type and byte length. No arbitrary URL/local path becomes an
  asset reference. Private bucket `product-intake-review` is never public.
- Upload into the next expected revision before final commit; immutable objects
  can exist without a committed manifest after a failed pass. Never serve such
  orphans. Register the complete manifest and payload revision atomically with
  the fenced pass. If another payload revision intervened, fail stale rather than
  silently rebinding uploaded images. No destructive orphan sweep in this slice.
- Admin obtains a rendition only through a current committed manifest after
  `requireAdmin`, then signs its validated bucket/key. Final product publication
  later copies/verifies these exact approved bytes into public `product-images`.

## Ordered implementation and checks

1. **Revision and manifest database boundary.** Generate an ordered migration with
   the Supabase CLI. Add revision/hash fields, service-only immutable asset
   manifests, historical decision bindings and private bucket. Extend S3's
   `product_intake_commit_research_pass` with expected revision and manifest input;
   preserve its cycle/deadline/lease/outbox transaction and lock order. Use one
   supported signature and remove ambiguous defaulted overloads. New trailing
   inputs: `expected_payload_revision integer DEFAULT NULL` and
   `review_assets jsonb DEFAULT '[]'`. Legacy calls with neither input remain
   compatible, receive a new revision and cannot create/rebind asset manifests;
   asset registration requires expected revision. Include both inputs in the
   completion request digest; identical replay returns before revision/CAS
   mutation. Cover non-worker preview writes with the same revision
   rule. Consumes S3 job/cycle fences; produces authoritative revision/hash and
   atomic committed asset manifests. Done when executable SQL tests prove payload
   replacement, identical rewrite, status-only update, forged revision, stale
   commit, transaction rollback and legacy audit behavior. Name the direct writers:
   core `saveSubmissionResearchPreview` and `saveResearchedPayload` in
   `scripts/product-intake/review-actions.ts`; the trigger covers both, including
   the live cockpit. New clients use expected revision/CAS. Extend the isolated
   `admin-alert-test-database.ts` bootstrap and RPC adapter for the signature.
   Primary SQL owner: `tests/product-intake-review-evidence-postgres.test.ts`.
2. **Shared core and worker delivery.** Extend `packages/product-intake-core/src/{jobs,repository}.ts`
   and worker/image final-pass assembly to read expected revision, hash actual
   local bytes and upload all available renditions without overwrite. A dedicated
   server-side storage adapter owns upload/hash/idempotency; model payloads cannot
   supply its manifest. Use the fenced RPC for completion; no separate unfenced
   manifest insert after marking ready. Update legacy preview writers to the same
   revision/CAS rule. Consumes step 1's schema/RPC; produces private evidence whose
   manifest and revision match the committed research. Done when fake Storage/HTTP
   tests prove exact bytes, duplicate-byte verification, rejection of changed bytes,
   failed upload/stale lease, and no manifest publication after failed commit.
3. **Authenticated Admin image reads.** Extend `src/lib/product-intake/admin-review-*`
   and the current detail component with raw/magenta/neutral previews from signed
   committed manifests. Show missing/legacy evidence honestly; no filesystem links
   or public pre-review upload. Reuse the approved layout and German recovery copy.
   Consumes step 2's committed manifest; produces viewable review evidence for the
   exact revision. Done when non-admin/missing/stale asset requests fail before
   signing, no-store is verified, and actual desktop/mobile inspection covers image
   success, missing evidence and expired-link reload. Controls remain disabled.

## Journey, verification and handoff

The existing approved journey supplies the image-review layout. Nick opens a ready
product, sees exact values plus raw/magenta/neutral images for its current revision,
and reloads if evidence changes or a signed link expires. Missing private evidence
is explicit and never presented as approved. Data/image approvals and publication
are the next required increment, not implicitly enabled here.

Use focused SQL/core/storage/Admin owner tests through the shared launcher, plus
real PostgreSQL concurrency for payload-write versus pass/approval races. Run one
final combined typecheck/lint and hosted CI; retain frozen Shampoo method bytes.
Read current Supabase Storage/RLS and relevant changelog before implementation.
Current references: [Storage access](https://supabase.com/docs/guides/storage/security/access-control)
and [private delivery](https://supabase.com/docs/guides/storage/serving/downloads).

Counterpart plan review is read-only/high; incorporate findings before execution.
Ready-check and whole-branch review cover final exact content. Commit plan/code/
durable mockup evidence; keep diagnostic/reviewer reports private and discard
transient output after disposition. Publication of this new increment needs exact
commit/push authority; production migration/deployment decisions require an idle
worker and an explicit compatibility/rollback sequence. Do not apply the new schema
to the existing worker before that sequence is agreed. Email/images/rework automatic
switches remain disabled throughout preparation.

## Counterpart plan review disposition

Claude/high read-only: approve with revisions; scope/authority coverage confirmed.
Accepted named writers/cockpit compatibility, legacy hash backfill/null
representation, harness signature and rollout/rollback precision. Rejected the
claim that PostgreSQL cannot distinguish identical column assignment from a
status-only update: column-specific UPDATE OF triggers explicitly do so
([PostgreSQL contract](https://www.postgresql.org/docs/current/sql-createtrigger.html)).
The mechanism above enforces the invariant without relying on writer discipline
or freezing the cockpit.

Dropping the old function identity does not inherently break older named calls:
two trailing defaulted inputs preserve argument compatibility. Legacy no-asset
completion remains S3-fenced and increments revision; it cannot carry old asset
bindings forward. Executable legacy-call/replay tests must prove this claim.
No schema rollback or object deletion is implied by a code rollback. Preserve
historical evidence and verify compatibility before any live change. Internal
revalidation after these revisions: no new product/scope decision; controls off.

## Local implementation and remaining gates

- [x] Migration `20261016104506_product_intake_review_evidence.sql` generated locally,
      never applied to production. Revision/hash triggers cover every existing writer,
      including identical and image-only assignments; historical approvals stay unbound.
- [x] Private immutable upload and current-revision signing integrated with worker,
      shared core and authenticated Admin reads. Five renditions register atomically;
      model paths/hashes never supply the manifest. Failed signing keeps data visible.
- [x] Ten executable SQL cases, three actual Storage-HTTP transport cases and the
      image worker integration pass. Real two-backend PostgreSQL proves a payload edit
      blocks the stale worker without new artifacts or outbox effects; S3 completion/
      rework races still pass against the upgraded schema.
- [x] Actual desktop and 390px mobile browser inspection: previews, missing images,
      expired-image reload and restored preview. Fixed a demonstrated pre-hydration
      image-error gap using an attached-node check plus onError. All data is fictional;
      no production fixture/Storage writes. Browser evidence is retained below.
- [x] Final combined 59 checks, real PostgreSQL race, typecheck, explicit source lint
  (zero errors; six existing worker warnings), and optimized application build pass.
  Claude/high correctness and structural whole-increment review: no blocking findings.
- [ ] Explicit publication of this increment, full hosted CI, dependency/Scanner
      CI disposition, and separately aligned merge/migration/deployment decisions.
- [ ] Next required increment: revision/hash-bound approval/actions/preflight, CLI
      parity, explicit guarded publication and dedicated durable publication receipt.
      Its notification-only retry must not republish. No action controls are enabled here.

Compatibility note: older no-asset calls first committed after the upgrade retain
named/positional compatibility and exact replay. A pre-upgrade completed RPC has a
14-input digest, so replay against the new 16-input contract fails closed. Reconcile
any such pending response before the separately approved idle-worker migration.
Never refund slots, reset a cycle or remove evidence as a workaround. Automatic
email/image/rework remain disabled; no backlog retry or product approval inferred.

Browser proof: [desktop](review-evidence-proof/desktop.png),
[mobile](review-evidence-proof/mobile.png),
[expired link recovery](review-evidence-proof/expired-green.png).


Final review disposition: accepted the foundation as scoped. Every atomic pass,
including an unchanged blocked outcome, conservatively rotates revision; later
approval UX must consume that exact token. Neutral/final bytes are identical, so
Katalogbild is the neutral rendition. Tests intentionally layer the actual upgrade
on the existing bootstrap rather than replace the old harness. No requested work
is dropped. The final post-review change is this receipt/checklist only, reviewed
by the main session; no executable content changed. Reviewer text is discarded
after retaining its private verdict/hash receipt. New publication authority is
required before committing/pushing this separate increment.
