# Moderator Account Reset Operator

This is the offline guardrail for the one-off moderator Personal Plan reset. It does not reset production by itself. It turns a private, exact-ID manifest into a transactionally guarded SQL artifact, or refuses to produce SQL when a precondition is missing.

Production manifests, real user IDs, real emails, raw row counts, Storage paths, tokens, and generated production SQL must stay out of git.

## What It Resets

The reset preserves:

- `auth.users.id`, confirmed email, credentials, provider/security identity
- the `profiles` row identity columns: `id`, `email`, `is_admin`, `created_at`
- billing/provider/audit evidence

The reset removes active application state:

- old quiz leads, funnel sessions, funnel events, Personal Plan drafts/artifacts/result-return credentials
- Personal Plan aggregates, need versions, refinement/product/routine/portfolio state
- old test enrollments and the exact approved manual access grants, which are revoked rather than inferred by email
- chat conversations, messages, conversation state, processing traces, feedback and stored conversation memory
- `hair_profiles`, including `conversation_memory`
- tracker logs, tracker nudge dismissals, dismissed suggestions
- product usage, Personal Plan user products, product submissions
- scan wishlist and scan resolve events
- stale checkout activation claims and Customer.io profile sync jobs

Billing-linked tables are `retain_zero`: any matching `billing_one_time_purchases`, one-time checkout consents, or one-time fulfillment jobs block the reset until provider/account reconciliation is done outside this tool.

## Manifest Contract

Run only from a private manifest:

```bash
tsx scripts/moderator-account-reset.ts fingerprint --manifest /private/path/moderator-reset.json
tsx scripts/moderator-account-reset.ts dry-run --manifest /private/path/moderator-reset.json
tsx scripts/moderator-account-reset.ts prepare-sql --manifest /private/path/moderator-reset.json --maintenance-journal /private/path/auth-maintenance.json --output /private/path/guarded-reset.sql
```

The manifest must include:

- `environment`, `projectRef`, `batchId`, exact account count, and `manifestFingerprint`
- exact `userId`, normalized email, expected auth email, per-table expected counts, runtime fingerprint, exact manual grant IDs, and Storage object paths
- a live-schema proof with every owner table in the committed reset inventory and no unclassified owner tables
- every live `profiles` column; every non-retained column must have a fresh-account reset value
- current fresh-account profile baseline, including `onboarding_completed: false` and `onboarding_step: "welcome"`
- per-account Auth maintenance proof: login restriction, session revocation, actual JWT lifetime plus acceptance margin, exact payment replay cutoff, measured request/worker drain, earliest safe reset time, and restore procedure
- external proof flags for Auth admin mechanism, Storage inventory/removal, worker pause, delayed callback write blocking, and billing ownership reconciliation

For production, `projectRef` must be `pqdkhefxsxkyeqelqegq` and `productionOperationApproval` must be `approved_exact_batch`. Local synthetic manifests must use `not_required_local_test`.

## Execution Boundary

`dry-run` prints a redacted JSON report. It never prints account identifiers, emails, Storage paths, or SQL unless the operator explicitly adds `--show-sql`. `prepare-sql` parses and validates the exact manifest bytes that it hashes, then writes the guarded SQL plus a redacted receipt outside the main repository and all worktrees, each mode `0600`; it reports `applied: false` and never makes a network call. It resolves symlinked and not-yet-created descendants before checking that boundary, requires an existing output parent to already be private (`0700` or stricter), and refuses blocked manifests or overwriting an existing artifact.

For production only, `prepare-sql` also requires a private Auth-maintenance journal outside the repository/worktree tree, with mode `0600` or stricter. This is the direct receipt emitted by `scripts/moderator-account-maintenance.ts`: its `operation` is `moderator_auth_maintenance`, it has `batchId` and `manifestFingerprint`, uses account `id` plus normalized `email`, records `jwtIssuedAt` and `jwtExpiresAt` as ISO timestamps, and must show every account at `banned`. Global `errors` must be empty and `partialRecovery` false. Preparation binds the signed-out and login-restricted timestamps plus observed JWT duration and the exact `paymentReplayCutoffAt` to the manifest proof. The maintenance receipt fingerprint is checked for shape and exact batch, rather than equality with the later fresh reset manifest. Preparation refuses a claimed JWT lifetime below the observed duration or below the hosted 3600-second lifetime plus the 120-second acceptance margin (3720 seconds), and refuses a reset time before the required expiry and drain deadline. Its SHA-256 is written into both the preparation receipt and the reviewed SQL header.

`apply` intentionally fails. There is no generic SQL execution RPC and this command never executes production SQL. The root operator reviews the exact private SQL artifact and runs it only through the reviewed Supabase MCP `execute_sql` transport, retaining the output receipt with the preparation receipt.

The SQL itself (after the journal-bound maintenance window has completed):

- locks the matching `auth.users` and `profiles` identity rows
- checks the reviewed `md5:` runtime fingerprint over the full matched auth row and full reset-inventory row payloads (only the digest leaves SQL) before any mutation
- asserts the reviewed per-table counts before any deletion
- sets the Personal Plan erasure owner setting before deleting immutable plan versions
- freezes owned parent IDs for child selection and residual checks, rejects cross-owner exact-email leads, then deletes in dependency order
- revokes only exact manual grant IDs from the manifest
- resets the `profiles` row to the supplied baseline
- removes only allowlisted app-owned `auth.users.raw_app_meta_data` keys and the app-owned `raw_user_meta_data.manual_access_reason` key; it preserves `email_verified`, provider metadata, and credentials
- asserts residual active application state is gone

Any count mismatch aborts the whole transaction.

## What This Does Not Prove

This offline tool does not prove Supabase Auth runtime behavior. Before production reset, the root operation still needs hosted synthetic-account evidence and per-account maintenance receipts in this order: global logout while the account is unbanned, immediate login ban, a zero-session and zero-unrevoked-refresh sweep, then wait out the full JWT lifetime plus a 120-second clock-skew margin from the later of logout and confirmed ban. This includes a token minted in the logout-to-ban gap; the maintenance token's expiry alone is insufficient. Wait until the later of that bound and queue drain, followed by a further 300-second request drain. Capture the fresh per-table counts and runtime fingerprint only after that ban-and-drain window, then prepare the SQL with the matching journal. The reviewed SQL rechecks the clock, a ban active for more than five minutes, and zero Auth sessions plus zero refresh tokens whose revocation is not true while the Auth user is locked. The locked Auth row must carry the exact `moderator_reset_cutoff_at` from the maintenance receipt. This admin-only operational security marker is preserved by the reset; it does not grant access. It must also remove Storage objects and prevent delayed callbacks from writing after reset.

Nick explicitly authorized production verification without Docker on 2026-08-27. PGlite covers supplemental SQL rollback/fault tests; exact marked hosted fixtures must cover real Auth, privileges and independent-connection behavior. No container installation is required. Missing expiry, writer-drain or cleanup proof remains a reset blocker, regardless of environment. The controlling procedure is the production addendum in `plans/2026-08-27-moderator-personal-plan-access.md`.

The last read-only live inventory contained no standalone public memory tables. Memory currently resides in application profile/conversation state; any newly discovered owner table blocks generation until classified. The final live inventory must still be refreshed before execution.

## Hosted Auth probe

`scripts/moderator-hosted-auth-probe.ts` defaults to a no-network dry run. Explicit apply requires the exact production project and a private receipt directory outside the repository. It creates only a new uniquely marked non-delivery fixture, never accepts a real recipient ID, never sends email, and attempts guarded fixture cleanup. Auth secrets remain in memory. Results distinguish observed behavior from unproven JWT-expiry and worker-drain bounds; a successful synthetic probe alone does not authorize or complete a real reset.

Production-only verification must not add fault triggers or global Auth settings. Shared catalog dispositions are not owner data and are excluded entirely. Billing/audit tables, locked backups and views are retained; any unexpected target-linked billing row or ownership mismatch stops this one-off reset.

Billing ownership proof is distinct from provider subscription status. `billingOwnershipReconciled` requires exact target auth IDs, profile provider references, all billing/audit counts and cross-account email joins to be reconciled. If a payer-email match belongs to a different verified auth UUID and all exact-target billing references are absent, preserve that other account unchanged; do not assert that its external subscription is active/cancelled based on DB status. Any billing record actually owned by a reset target remains a `retain_zero` blocker requiring separate resolution.
