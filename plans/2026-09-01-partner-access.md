# Dedicated partner access

## 1. Outcome and source context

Build a reusable, admin-operated partner-access system for creators and influencers. Each creator receives a personal, named, email-bound invitation. They experience the ordinary quiz, result and offer journey; the payment position becomes a concise partner activation moment. Activation creates indefinite-time app access (`expires_at = null`) that an admin can revoke or later reactivate without deleting the account, quiz data or Personal Plan.

This plan is based on:

- the existing indefinite and revocable `manual_access_grants` access primitive in `supabase/migrations/20260602120000_add_manual_access_grants.sql`;
- the current email-bound moderator implementation as security and lineage reference, not as the product model;
- the approved admin evidence in `plans/partner-access-evidence/admin-partner-access.html` and `.png`;
- the approved creator offer direction in `plans/partner-access-evidence/offer-copy-creator-revision.html` and `.png`;
- the final creator invitation and email-correction journey in `plans/partner-access-evidence/creator-invitation-journey.html` and `.png`.

Contract:

- **Outcome:** a repeatable individual and batch invitation mechanism, a low-friction creator claim flow, ordinary account return, a normal offer experience with partner activation, and explicit revoke/reactivate controls.
- **Safety:** no payment-provider resource or billing subscription is created; invitation views cannot consume links; raw invitation credentials are not persisted; mutations are exact, authenticated, idempotent and auditable; partner traffic cannot become paid-conversion traffic.
- **Verification:** deterministic unit and route tests, executable database tests, authenticated browser coverage for the complete journey and recovery states, and an operator dry run.
- **Stop:** implementation ends in a draft PR. Merge, deployment, external email-template activation and production partner creation remain separately authorized.

## 2. Chosen direction

Create a dedicated partner-access model rather than extending moderator or field-test campaigns.

The admin enters the creator's name and email and receives a stable personal link. The link contains a versioned, HMAC-signed invitation credential that can be reproduced for copying but is never stored in raw form. The first page load and any preview are read-only. Client-side resolution displays the creator's name and email; pressing **“Los geht’s”** is the first state-changing action.

For a new email, that action uses the repository's proven server-side bootstrap-session pattern: create a normal Supabase Auth user with a cryptographically random hidden password, `email_confirm: true`, the invitation name and partner metadata; sign in through a request/response-bound Supabase SSR client; and set the resulting Auth cookies on the response without returning or logging the password. It then binds the invitation to the exact user, creates the normal `default_organic` funnel session and enters `/quiz`. If the email already belongs to an unrelated existing account, the system does not use the bearer invitation to expose that account; it sends the ordinary inbox login link once and resumes the same invitation after successful login. A retry for a user previously created by this exact invitation may repeat the server-side bootstrap sign-in without an inbox round-trip.

At the ordinary offer, the payment slot is replaced with the approved creator card. **“Zugang aktivieren”** atomically binds the exact lead/funnel/user lineage, creates a `manual_access_grants` row with `reason = 'partner'` and `expires_at = null`, activates the partner enrollment and routes into the Personal Plan. Revocation removes only partner-granted access; independent paid access remains valid.

The dedicated admin page is pinned in the existing admin navigation. It supports one creator or validated batch paste, optional best-effort invitation email, copyable links and messages, resend, revoke and reactivate. A guarded CLI uses the same service contract for explicitly authorized direct operations.

The following scope decisions are already owner-confirmed and must not be reopened during implementation:

- **Dedicated partner state:** keep partner invitations separate from moderator/test campaigns. The overlap in HMAC, exact lineage, activation and revocation patterns should be reused through narrow helpers, but partner state must not inherit campaign expiry, test-reset or moderator semantics.
- **Creator email correction in version one:** keep the mailbox-proof correction path because the creator must be able to resolve a mistyped invitation without waiting for an admin.
- **Guarded direct-operation path in version one:** keep the CLI because Nick explicitly expects to ask Codex to perform exact database-backed create/revoke operations. It is a thin caller of the same RPC/service contract, not a second business-logic implementation.

## 3. Scope and non-goals

### In scope

- Dedicated partner invitation, claim, activation and access history.
- One and batch creation from `/admin/partner-access`.
- A copyable personal link and precomposed WhatsApp-friendly message for every row.
- Optional invitation, correction-verification and account-ready transactional emails; email failure never invalidates the manual link or committed database state.
- Personal name and email shown at the start, with the approved account-creation heads-up.
- Email correction before claim, returning to the same welcome screen with the corrected address and a confirmation state.
- Preview-safe, read-only link resolution; no automatic invitation expiry while pending.
- Normal account return through the existing email login after first claim.
- Indefinite, manually revocable access and auditable reactivation.
- Ordinary PostHog product analytics with an explicit `partner` classification; suppression from Meta, paid conversion and commercial Customer.io automation.
- A dry-run-by-default operator CLI for direct, explicit production operations.

### Non-goals

- Public promo codes, a reusable shared creator link or self-service public registration.
- Reusing or changing moderator/field-test campaign duration, roster, reset or campaign behavior.
- Giving creators admin or moderator privileges.
- Creating Stripe/PayPal customers, subscriptions, purchases, invoices or synthetic revenue.
- Automatically replacing an existing user's Personal Plan or revoking independent paid access.
- Deleting accounts or creator data on revocation.
- Password creation during invitation claim; normal return remains the existing email login flow.
- Claiming delivery from Customer.io without a delivery webhook. Version one records `not_requested`, `sent`, or privacy-safe `failed`, never “delivered”.
- Production data changes, email-template creation/activation, deploy or launch as part of implementation.

## 4. Authoritative contract and target map

### Data and state contract

Add `public.partner_access_invitations` with service-role-only mutation and no public row access. It contains:

- `id`, `display_name`, `normalized_email`, `token_version`, `created_by_user_id`;
- `claimed_user_id`, `claimed_at`, `activated_at`, `revoked_at`, `updated_at`, `created_at`;
- `claim_attempt_id` and `claim_attempt_expires_at` for a resumable compare-and-set claim reservation;
- `lead_id`, `funnel_session_id`, and the current `manual_access_grant_id`;
- `email_corrected_at`, `last_invitation_email_sent_at`, and bounded `last_invitation_email_status` (`not_requested`, `sent`, `failed`);
- checks that email is normalized, version is positive, activation requires an exact claimed user/lead/funnel/grant, and revoked/active transitions remain internally consistent.

Add `public.partner_access_email_changes` for one-time correction verification. Store only a token hash, invitation ID, normalized proposed email, bounded expiry, consumed timestamp and audit timestamps. Only service-role code can read or mutate it; a later request replaces any still-pending correction for the same invitation.

Extend `manual_access_grants.reason` with `partner` and add nullable `partner_invitation_id`. The existing inline CHECK is named `manual_access_grants_reason_check`; the migration must explicitly `DROP CONSTRAINT IF EXISTS manual_access_grants_reason_check` and recreate it with `('friend', 'tester', 'admin', 'support', 'partner')`. Enforce at most one unrevoked partner grant per invitation. Reactivation inserts a new grant and leaves the revoked grant as history.

Add nullable `partner_access_invitation_id` to `funnel_sessions` and `leads`, with ownership checks in service-only RPCs. Partner invitation, claimed Auth user, funnel, lead, enrollment and manual grant must all agree before activation.

Invitation status is derived rather than independently mutable:

- **Eingeladen:** not revoked and `activated_at IS NULL` (with claimed/quiz progress shown as secondary detail).
- **Aktiv:** not revoked and the linked partner grant is current.
- **Widerrufen:** invitation or current grant is revoked.

Invitation credentials are `version.payload.signature`, signed with `PARTNER_ACCESS_INVITATION_SIGNING_SECRET` over the invitation ID and stored `token_version`. The raw credential is reproducible by trusted server/CLI code and is never stored. Rotating a link increments `token_version`; ordinary copy returns the same current link. A pending invitation has no automatic expiry and becomes unusable only after explicit revoke or replacement. Credentials must never be logged, sent to analytics or copied into error messages.

### Database and access seams

- New migration: `supabase/migrations/20260901*_partner_access.sql`.
- Existing access reader: `src/lib/billing/subscriptions.ts` already honors null-expiry manual grants and requires no behavior change; retain regression coverage only.
- Personal Plan authority: add a dedicated partner enrollment resolver in `src/lib/personal-plan/enrollment.ts`. It must recognize only the exact active invitation/user/lead/grant relation with `reason = 'partner'`, allow `expires_at = null`, and reject revoked/mismatched rows. Do not route partner grants through `resolveActiveFieldTestEnrollment`, which intentionally requires `reason = 'tester'` and a future expiry.
- Add `sourceKind = 'partner'` to `src/lib/personal-plan/enrollment.ts`, `src/lib/personal-plan/journey-access-loader.ts`, `src/lib/personal-plan/persistence/stage1-service.ts`, `src/lib/personal-plan/frontier-routing-loader.ts`, the authenticated routing RPC and their callers. Partner is always cohort-qualified once its `qualifiedAt` is valid, like field test for cutoff purposes; it is indefinite for access validity; and it never takes migration-only recovery behavior in `src/app/plan-bereit/page.tsx`. Add exhaustive source-kind helpers/tests so future kinds cannot silently fall through.
- New partner modules under `src/lib/partner-access/`: contracts, token codec, database/service operations, auth claim, email payloads and UI-safe projections.

### Creator entry and authentication seams

- `src/app/partner/einladung/page.tsx` renders generic, non-indexable, no-store HTML with generic Open Graph metadata.
- A client component under `src/components/partner-access/` reads the credential from the incoming URL, resolves it through a read-only POST, receives only display name and email, stores a short-lived HttpOnly invitation cookie and removes the credential from the visible URL with `history.replaceState`.
- New routes under `src/app/api/partner-access/` own resolve, claim, email correction and activation.
- For new accounts, mirror `src/app/api/personal-plan/field-test/activate/route.ts`: create a request/response-bound Supabase SSR client, call server-side `signInWithPassword` using the hidden bootstrap credential, copy only Auth cookies to the response, and immediately discard the credential. Never serialize it to the browser or store it outside Supabase Auth.
- Reuse `/auth/confirm` for the existing-account and email-correction inbox links, with a signed short-lived partner claim intent cookie and a fixed `/partner/einladung/fortsetzen` continuation. Add a dedicated `isPartnerReturnPath` allowlist alongside the moderator return handling in `src/app/auth/confirm/route.ts`; the continuation validates the authenticated user against the invitation before binding and creating the normal funnel session.
- Existing unrelated users receive the existing inbox login flow; exact users created for this invitation can retry without email.
- `src/app/partner/einladung/fortsetzen/page.tsx` completes or resumes the claim and redirects to `/quiz` only after exact binding succeeds.

### Quiz, offer and analytics seams

- Carry a dedicated partner invitation reference through the normal `default_organic` funnel and lead routes; do not express it as `field_test` or moderator context.
- Update `src/app/quiz/quiz-shell.tsx`, `src/app/api/quiz/lead/route.ts`, `src/app/result/[leadId]/page.tsx`, `src/app/result/[leadId]/result-client.tsx`, `src/funnels/types.ts`, and `src/components/organic-plan-offer/organic-plan-offer.tsx` to render the ordinary journey with server-authorized partner activation at the payment slot.
- Add a dedicated `PartnerAccessActivationCard` in `src/components/partner-access/` using the approved copy:
  - `Dein Chaarlie Zugang ist bereit.`
  - `Dein persönlicher Plan und deine Routine sind freigeschaltet.`
  - `Zugang aktivieren`
  - `Für dich kostenlos`
- Add a shared `FunnelTestKind = 'field_test' | 'partner'` and centralized `isCommerciallyEligibleTestKind`/`isNonCommercialTestKind` predicate rather than adding another scattered literal check. Apply it to `src/lib/analytics/events.ts`, `src/lib/analytics/destinations/meta.ts`, `src/lib/analytics/destinations/customerio.ts`, `src/components/quiz/offer-tracking-provider.tsx`, `src/lib/personal-plan-quiz/customerio.ts`, `src/lib/personal-plan-quiz/customerio-outbox.ts`, and experiment assignment in `src/lib/funnel/server.ts`; the regular-quiz lead route must skip its legacy Customer.io sync for partner context. PostHog retains product behavior events with the bounded partner marker, while Meta, Customer.io commercial automation, offer-engagement delivery, Meta offer-view and paid experiments reject partner traffic. Partner activation emits a non-commerce `partner_access_activated` event; it must never emit purchase, subscription or checkout-provider events.

### Admin and operator seams

- Pin `Partnerzugänge` in `src/app/admin/layout.tsx`.
- Add `src/app/admin/partner-access/page.tsx` and focused components under `src/components/admin/partner-access/`.
- Add authenticated admin routes under `src/app/api/admin/partner-access/` for list/create, batch create, link/message projection, optional send, revoke, reactivate and link rotation.
- Batch input is `Name, E-Mail` per non-empty line, validates the complete input before writing, rejects duplicates within the batch and against unresolved/active invitations, and returns one result per row. No partial write occurs on validation failure.
- Add `scripts/partner-access.ts` and an npm script. It is read-only/dry-run by default; mutations require `--apply`, `--confirm-project=pqdkhefxsxkyeqelqegq`, an exact command, and exact invitation ID or normalized email. It calls the same database RPC/state contract as the admin service and prints personal links only to the invoking terminal.

### Email and documentation seams

- Reuse `src/lib/customerio/transactional.ts` through dedicated partner payload builders. Add environment keys for invitation, correction and account-ready transactional message IDs.
- Email sends are best-effort after the durable state exists. Persist only `sent` or a bounded failure classification; never provider bodies, tokens or email content.
- Add `docs/partner-access-operations.md` for admin/CLI operation, Customer.io template variables, link rotation, revoke/reactivate semantics, direct-database authorization boundaries and privacy-safe troubleshooting.
- Update `docs/customerio-data-contract.md`, `docs/analytics/offer-page-tracking.md`, and `docs/local-qa-access.md` for partner classification and local QA.

## 5. Designed user journey

### Standard new-creator path — confirmed

Actor: a creator whose name and email were entered by an admin and whose personal link was sent by WhatsApp or optional email.

1. The creator opens the personal link. A preview, crawler, reload or ordinary GET may resolve/render the page but cannot change invitation state.
2. The page shows `Hi {firstName}, dein Zugang ist bereit.`, the full registered email, `Nicht deine E-Mail? Ändern`, and **“Los geht’s”**.
3. Beneath the CTA, the page states: `Damit erstellst du dein Chaarlie Konto mit dieser E-Mail.`
4. The creator presses **“Los geht’s”**. The server reserves the claim with an atomic attempt ID, creates the new normal account, establishes the browser session, completes the exact binding and enters the ordinary quiz. No inbox visit, visible password or creator-only form is required.
5. The creator completes the normal quiz, result and offer experience.
6. At the payment position, the creator sees the approved partner card and presses **“Zugang aktivieren”**.
7. The system atomically binds the exact lead and creates indefinite partner access without creating billing/provider state. The Personal Plan opens.
8. A best-effort account-ready email explains that future returns use the normal Chaarlie login. Email failure does not roll back access.
9. On later devices or after session expiry, the creator uses the normal email login and receives the existing magic link.

Completion: the creator has a named normal account, full app access, an exact Personal Plan source and no payment obligation or expiry date.

### Incorrect-email recovery — confirmed

1. Before claiming, the creator presses **“Nicht deine E-Mail? Ändern”**.
2. The email editor opens inline with `E-Mail ändern` and the single explanation `Wir senden dir einen Bestätigungslink.`
3. The creator enters the new address and requests confirmation. A correction record is created and the transactional email is attempted; failures allow resend or another correction without changing the invitation.
4. The creator verifies the new email through the one-time correction link. The server consumes the correction exactly once, updates the invitation, and binds an existing account only after that mailbox proof.
5. The creator returns to the same welcome screen, now showing the corrected address and `Bestätigt`.
6. **“Los geht’s”** continues through the standard path.

### Existing-account variant — confirmed safety exception

If the invitation email already belongs to an unrelated existing Auth account, the bearer link does not sign into or reveal that account. Pressing **“Los geht’s”** sends the existing login link to that inbox. After successful login, the invitation attaches to the exact account and returns to the ordinary quiz. If the existing account already owns a Personal Plan, activation grants partner access but does not overwrite its plan; the user is routed to the current saved frontier.

### Preview, retry and re-entry recovery

- GET, WhatsApp preview, browser prefetch and read-only resolve do not claim, expire or rotate the invitation.
- Multiple views remain valid. The first successful human claim wins through an atomic compare-and-set.
- A deliberate claim creates a short-lived reservation. The same signed attempt can resume it; a crashed/abandoned attempt becomes claimable again after its reservation expires. A preview never creates a reservation.
- A double-click or transport retry returns the same bound account/funnel; it cannot create duplicate users, invitations, leads or grants.
- If Auth user creation succeeds but browser session issuance fails, the invitation remains resumable for that same invitation-owned user and a retry reissues the login.
- A claimed link opened by the same signed-in user routes to the current journey frontier. A claimed link opened elsewhere offers the normal email login and never acts as a permanent bearer login.
- A revoked link shows a neutral unavailable message and cannot be claimed or corrected.

### Admin/operator journey — confirmed

1. Admin opens the pinned `Partnerzugänge` page.
2. Admin creates one invitation or pastes a complete batch and reviews validation.
3. The system commits exact rows, then returns one personal link and copy-ready message per creator. Optional email delivery is best-effort and independently retryable.
4. Admin sees derived status, email send state and secondary claim/quiz progress.
5. Admin may copy the current link again, deliberately rotate it, resend email, revoke partner access or reactivate it.
6. Revocation preserves account/data and cannot remove independent paid access. Reactivation creates a new audited indefinite grant.

## 6. Planning evidence

- `plans/partner-access-evidence/admin-partner-access.html` and `.png`
  - **Question:** Can Nick operate recurring individual and batch partner creation, sharing and revoke/reactivate from one pinned surface?
  - **Selected direction:** dedicated admin navigation item, single/batch tabs, link-first receipt, optional email and explicit status/actions.
  - **Feedback incorporated:** direct database operation remains a guarded fallback; email is not required for link creation; individual links remain distinct.
  - **Evidence review:** confirmed in conversation on 2026-08-31/2026-09-01.
- `plans/partner-access-evidence/offer-copy-creator-revision.html` and `.png`
  - **Question:** What should replace payment without overexplaining that creators receive the product free?
  - **Selected direction:** one headline, one sentence and one CTA, with `Für dich kostenlos` as quiet supporting copy.
  - **Feedback incorporated:** removed subscription, payment and lifetime/revocation explanations, then removed the eyebrow, badge and `Voller Zugang` subheading.
  - **Evidence review:** concise revision confirmed in conversation on 2026-09-01.
- `plans/partner-access-evidence/creator-invitation-journey.html` and `.png`
  - **Question:** How can the invitation be personal, preview-safe and almost frictionless while retaining email correction and informed account creation?
  - **Selected direction:** visible name/email, one deliberate CTA, quiet account-creation heads-up, inline correction, familiar return after verification.
  - **Feedback incorporated:** full email shown at the beginning; corrected email returns to the same screen; page view never consumes the invitation; creator-facing copy is reduced to the minimum needed to identify the account and continue.
  - **Evidence review:** concise rendered journey confirmed in conversation on 2026-09-01.
- `plans/partner-access-evidence/current-moderator-offer-mobile.png` and `current-moderator-offer-card-mobile.png`
  - **Question:** What current test-oriented copy and hierarchy must the creator experience avoid?
  - **Finding:** the current `0 €`, no-payment, 90-day test frame overemphasizes the commercial exception.
  - **Disposition:** commit as annotated baseline evidence.

Rejected verbose variants in `offer-copy-variants.html` and `.png` are classified **discard** before publication. All approved HTML/PNG evidence and this plan are classified **commit**. No prototype runtime or transient counterpart output is retained in the repository.

## 7. Ordered tasks

### Task 1 — Define and execute the partner state machine

Create the additive migration, RLS/permissions, explicit manual-grant CHECK replacement, exact constraints, indexes and service-role RPCs for create/batch-create, correction issue/consume, claim reserve/complete, activation, revoke, reactivate and token rotation.

- **Consumes:** the data/state contract in section 4 and existing `profiles`, `funnel_sessions`, `leads`, `manual_access_grants` and Personal Plan source tables.
- **Produces:** stable invitation IDs, token versions, exact user/funnel/lead lineage, active-grant uniqueness and idempotent transition results.
- **Tests:** add `tests/partner-access-schema.test.ts` for the named CHECK replacement plus static privilege/constraint guards, and `tests/partner-access-sql-execution.test.ts` with PGlite coverage for duplicate batches, preview immutability, two concurrent reservations, abandoned-attempt recovery, activation replay, null expiry, revoke, paid-independent access and reactivation history.
- **Complete when:** invalid or mismatched transitions fail closed, exact replays reuse their prior result, and no anon/authenticated caller can mutate partner or manual-grant state directly.

### Task 2 — Build the invitation service, credential codec and guarded operator CLI

Implement normalization, deterministic credential signing/verification, UI-safe projections, no-secret logging, batch validation and service operations. Add the dry-run CLI and exact confirmation gates.

- **Consumes:** Task 1 RPC signatures and `PARTNER_ACCESS_INVITATION_SIGNING_SECRET`.
- **Produces:** `createInvitation(s)`, `projectPersonalLink`, `resolveInvitation`, `revoke`, `reactivate`, `rotate`, plus CLI JSON/text receipts that never persist raw credentials.
- **Tests:** `tests/partner-access-token.test.ts`, `tests/partner-access-service.test.ts`, and `tests/partner-access-cli.test.ts` cover tampering, version rotation, normalization, complete-batch rollback, output redaction and apply guards.
- **Complete when:** a link is reproducible and preview-resolvable without database mutation, rotation invalidates only the prior version, and no mutation can run from the CLI without exact project confirmation.

### Task 3 — Deliver the pinned admin workflow

Implement admin-only routes and the reviewed page for single/batch creation, copying link/message, optional send, resend, rotate, revoke and reactivate. Use bounded API payloads and existing admin authorization.

- **Consumes:** Task 2 service operations and UI-safe statuses.
- **Produces:** `/admin/partner-access`, admin API response contracts, and one receipt per successful creator.
- **Tests:** add `tests/admin-partner-access-routes.test.tsx` for 401/403, validation, atomic batch and exact action targeting; add `tests/admin-partner-access-page.test.tsx` for single/batch states, failure copy and status/action rendering.
- **Complete when:** the approved desktop/mobile hierarchy is represented, all copy is German, email failure leaves link copy available, and status does not overclaim delivery.

### Task 4 — Deliver preview-safe claim and email-correction authentication

Implement the generic invitation page, read-only resolve, deliberate claim POST, server-side hidden-password bootstrap session, exact claim intent, continuation and correction verification. Account creation metadata includes `full_name`, `access_kind = 'partner'` and the invitation ID. Existing-account handling must use mailbox proof. The invitation URL cleanup must be a same-document replacement and receive a regression test against the current Next 16 history patch; it must not trigger navigation or route-table mutation.

- **Consumes:** Task 2 credential resolution and Task 1 bind/correction RPCs.
- **Produces:** a normal authenticated user, exact claimed invitation, short-lived intent/cookies and one `default_organic` funnel session linked to the invitation.
- **Tests:** add `tests/partner-access-resolve-route.test.ts`, `tests/partner-access-claim-route.test.ts`, `tests/partner-access-auth-continuation.test.ts`, and `tests/partner-access-email-change.test.ts` for GET/preview immutability, server-side cookie issuance with no credential serialization, existing-user inbox path, same-invitation retry, wrong-user rejection, correction expiry/replay, history replacement and revoked links.
- **Complete when:** opening/prefetching never consumes a link, first deliberate claim is idempotent, failed session issuance remains recoverable, and an invitation can never reveal an unrelated existing account.

### Task 5 — Carry partner lineage through the ordinary quiz and suppress commercial attribution

Add a dedicated partner context to funnel cookies/server resolution, quiz lead persistence and offer authorization. Mark the funnel internal/partner while keeping the ordinary visible quiz. Introduce the shared commercial-eligibility predicate and replace the existing fail-open field-test-only checks at every enumerated analytics/Customer.io/experiment site without suppressing PostHog product usage.

- **Consumes:** Task 4 invitation/funnel binding and the exact `partner_access_invitation_id`.
- **Produces:** a partner-bound lead, server-authorized offer context, `testKind = 'partner'` analytics envelope and no paid-conversion side effects.
- **Tests:** update `tests/analytics-tracking.test.ts` and Customer.io/offer tracking suites, add an isolated partner lead-route suite, and add result authorization tests for missing/mismatched/revoked lineage. Table-driven assertions must prove both `field_test` and `partner` are non-commercial at Meta, browser Customer.io, server Customer.io, offer engagement, Meta offer view and experiment assignment, while ordinary traffic stays eligible.
- **Complete when:** ordinary traffic is unchanged, partner traffic reaches the same visible questions/results/offer, Meta receives none of its funnel events, commercial Customer.io synchronization is skipped, and PostHog receives the bounded partner marker without email/token data.

### Task 6 — Activate indefinite access at the offer and route the Personal Plan

Render the approved partner activation card in the organic offer payment slot. Implement the activation endpoint/RPC and integrate the exact `reason = 'partner'`/null-expiry source into Personal Plan enrollment, readiness, Stage-1 ownership and authenticated routing. Partner bypasses acquisition cutoff like an authorized partner source, remains indefinite, and does not enter migration-only recovery. Preserve any existing Personal Plan source.

- **Consumes:** Task 5 exact user/funnel/lead authorization and Task 1 activation RPC.
- **Produces:** active partner invitation, null-expiry manual grant, partner Personal Plan source, `partner_access_activated`, and the existing authenticated Personal Plan frontier.
- **Tests:** add `tests/partner-access-activation-route.test.ts`; extend `tests/personal-plan-enrollment.test.ts`, journey-access, Stage-1 persistence, `tests/personal-plan-ready-readiness.test.ts`, `tests/personal-plan-frontier-routing.test.ts`, and offer component tests. Assert partner is accepted with null expiry, bypasses cohort cutoff, avoids migration recovery, becomes unavailable after revoke, and creates no billing/provider rows or commerce events.
- **Complete when:** the CTA is replay-safe, the plan opens, indefinite access survives future dates, revoked access fails unless independent paid authority exists, and paid/existing plans are never overwritten.

### Task 7 — Add best-effort partner emails and operational documentation

Implement invitation, correction and account-ready payload builders, bounded delivery recording and resend. Document Customer.io template variables/IDs, local QA, admin and CLI operation, exact revoke/reactivate semantics and production gates.

- **Consumes:** Task 2 links, Task 4 correction tokens and Task 6 completion state.
- **Produces:** retryable optional emails, privacy-safe send status and a complete operator runbook.
- **Tests:** add `tests/partner-access-email.test.ts` with accepted, rejected, transport-unknown and replay cases; assert no email failure rolls back invitations, corrections already committed by the safe boundary, or access.
- **Complete when:** templates can be provisioned separately without code changes, version one labels only API-accepted sends as `sent`, and the manual-link path remains fully functional with all message IDs absent.

### Task 8 — Verify the complete journey and settle artifacts

Add authenticated browser fixtures for a new creator, corrected email, existing account, preview/reload, activation, return login, revoke and reactivate. Run the repository readiness and review gates, then discard rejected/transient artifacts.

- **Consumes:** Tasks 1–7 and the reviewed mockups.
- **Produces:** browser evidence and a review-ready worktree with only commit-classified artifacts.
- **Tests:** add `tests/partner-access.e2e.spec.ts`; use local Supabase/Auth/Customer.io fakes according to `docs/local-qa-access.md` and never send a real email or touch production.
- **Complete when:** the browser journey matches section 5 at mobile and desktop widths, reduced motion/focus/error states remain usable, all required checks pass, and artifact disposition is clean.

## 8. Verification

### Automated

- Focused partner unit, route, component and SQL execution suites from Tasks 1–7.
- Existing billing/manual-access, Auth confirm, quiz lead, organic offer, Personal Plan enrollment/readiness/frontier and analytics suites.
- Typecheck, lint on changed files and production build through the repository `ready-check` contract.
- Secret scan/assertions: tokens absent from analytics payloads, logs, persisted rows and serialized errors.

### Manual/browser

- Mobile and desktop: initial personal screen shows correct name/email and account-creation heads-up.
- Repeated GET, WhatsApp-style preview request, refresh and browser prefetch leave the invitation pending.
- New creator: one CTA enters the normal quiz without inbox; offer card matches approved evidence; activation reaches the Personal Plan.
- Correction: wrong email remains authoritative until verification; return uses the same screen and corrected confirmed address.
- Existing account: inbox proof is required; no prior data appears before proof.
- Failure recovery: Auth generation failure, lost callback, double-click, email delivery failure and activation retry remain recoverable and do not duplicate state.
- Return: same session reaches current frontier; fresh browser uses normal email login.
- Revoke/reactivate: partner access changes immediately, data remains, and an independent paid entitlement continues.
- Admin: individual/batch creation, duplicate/invalid input, copy message/link, send failure, rotate, revoke and reactivate match the mockup and never expose secrets in list APIs.

### Migration/live-state gates

- Apply migration to an isolated local database and execute concurrent claim/activation tests.
- Before deployment, inventory reason constraints and Personal Plan routing readers against the reviewed head.
- Deploy migration before code that reads partner columns/source kinds; verify schema/API visibility before enabling routes.
- Configure signing secret and Customer.io message IDs separately. Manual sharing remains the launch-safe fallback if email templates are not activated.
- A production smoke creator requires explicit production-write authorization, an exact non-customer email, a cleanup/revoke receipt and analytics proof. It is not part of implementation authorization.

### Evidence-sensitive review

- Compare the implemented admin, invitation and offer states with the committed rendered evidence.
- Re-run a creator-perspective simulated-user review specifically for clarity, effort and “internal test” leakage.
- Run one read-only counterpart code review on the complete branch before any push and verify every finding locally.

## 9. Review and handoff

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/partner-access`
- Branch: `codex/partner-access`, rebased onto `origin/main` at `1d29ead8` before publication.
- User-journey direction: confirmed on 2026-09-01, including personal email display, correction return, preview-safe claim and account-creation heads-up.
- Rendered invitation evidence review: confirmed by Nick on 2026-09-01; implementation may proceed against this baseline.
- Counterpart plan review: Claude Opus 4.8 at `high` returned **approve with revisions** on 2026-09-01. Verified findings incorporated: explicit manual-grant CHECK replacement; dedicated partner/null-expiry Personal Plan source; enumerated centralized commercial suppression; proven server-side Auth bootstrap; exhaustive source-kind placement; partner Auth-return allowlist. The proposed scope cuts were rejected because the dedicated model, correction path and guarded direct-operation path were already owner-confirmed. Transient review output remains outside the repository.
- Implementation handoff: use `implementation-loop`; it owns `ready-check` and `request-code-review` before review-ready handoff.
- Implementation receipt (2026-09-01): typecheck and lint passed with five unrelated pre-existing warnings, and the 157-page production build passed; the complete Node suite passed on the rebased tree with 5,073/5,073 tests; the creator invitation/offer Playwright journey passed at desktop and 390px mobile widths with the explicit lab flag; `git diff --check` passed. The executable SQL path now uses the real funnel constraint and drives reservation enforcement, claim, lead save, activation, revoke and reactivation. Local browser fixtures exercise the real components and interaction states, while real Auth and Customer.io delivery remain post-deployment smoke gates.
- Review receipt (2026-09-01): two pre-push whole-branch Claude passes found real blockers and recovery gaps. Supported findings were reproduced and fixed: the real funnel constraint accepts partner lineage; the SQL fixture executes the full path and rejects unreserved completion; cross-device mailbox continuation carries a short-lived signed fragment handoff and retains it for retry; old invite cookies cannot block ordinary quiz submissions; invitation reload resumes from the signed HttpOnly intent; failed claims remove their exact new unbound funnel and user before releasing the reservation; existing field-test Customer.io routing is preserved; schema-cache relationship misses degrade safely; partner routing uses an additive owner-only RPC; and tracking remains null when no funnel envelope exists. The ship workflow requires an exact-final counterpart refresh after these fixes; its result belongs in the PR receipt.
- Final counterpart delta (2026-09-01): Claude's exact staged-tree pass found no ship blocker and identified three medium issues that were accepted as fixes rather than residual risk. Existing paid creators now continue to their canonical paid lead after partner activation; a missing additive partner RPC during code-before-migration rollout degrades ordinary users to legacy routing; and partner manual grants bind only by `user_id`, never by a reusable email address. The operations guide now requires migration-first rollout and RPC-backed revocation. Claude's focused re-review returned **approve**; its low-severity activation-ordering and test-fidelity suggestions were also incorporated before publication.
- Migration receipt (2026-09-01): production project `pqdkhefxsxkyeqelqegq` does not contain `20260901120000_partner_access.sql`. Existing local/remote migration history is divergent, so merge/deploy requires a separately authorized surgical migration-first sequence; never use a blind `supabase db push`.
- Publication stop: commit, push and draft PR were authorized on 2026-09-01. Merge, deploy, email-template activation and production partner writes remain unauthorized.
- Artifact disposition:
  - **Commit:** this plan; approved/baseline admin, invitation and offer HTML/PNG evidence.
  - **Discard before publication:** rejected `offer-copy-variants.*` and transient counterpart output.
  - **Archive:** none.

Primary rollout risks are accidental bearer-link consumption, signing-secret/token leakage, attaching to an unrelated existing account, partial account/funnel binding, partner traffic entering commercial analytics, and revocation overriding paid access. The task and verification contracts above fail closed on identity/lineage uncertainty while keeping invitation/email retries recoverable.
