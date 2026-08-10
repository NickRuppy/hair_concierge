# Personal Plan field-test access

## Outcome and source context

Create one reusable, revocable production test link that lets a supervised tester complete the real Personal Plan quiz, see the real personalized result and offer, replace payment with a free continuation, and enter the same five-stage Personal Plan journey used after payment.

Current source facts shaping the design:

- The Personal Plan quiz is delivered by `/lp/haarplan`; it prepares an artifact, captures an email, saves a `personal_plan` lead, and routes through `/result/{leadId}/reveal` to the offer.
- The result page currently switches from `PersonalPlanOffer` to `PersonalPlanPaidContinuation` solely when authenticated app access exists.
- The post-payment owner path resolves to `/plan-start` when the prepared artifact is ready and `/plan-bereit?lead=...` while attachment is pending.
- `manual_access_grants` already grants non-payment application access, but `findPersonalPlanEnrollmentForUser` only accepts a provider-correlated one-time purchase or launch subscription. A manual grant alone therefore cannot authorize the five-stage Personal Plan.
- Supabase anonymous sign-in is disabled in this project. Although Supabase documents anonymous users for demos, enabling it would expose a new public account-creation path and require an all-policy RLS audit, CAPTCHA, and anonymous-user cleanup. This plan uses a server-created synthetic guest identity instead, keeping guest creation behind the test campaign gate.

Source surfaces:

- `src/app/lp/[slug]/page.tsx`
- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`
- `src/app/api/quiz/personal-plan-lead/route.ts`
- `src/app/result/[leadId]/page.tsx`
- `src/app/result/[leadId]/result-client.tsx`
- `src/components/personal-plan-offer/personal-plan-offer.tsx`
- `src/lib/personal-plan/enrollment.ts`
- `src/lib/personal-plan/journey-access-loader.ts`
- `src/lib/personal-plan/persistence/stage1-service.ts`
- `src/lib/billing/subscriptions.ts`
- `supabase/migrations/20260602120000_add_manual_access_grants.sql`
- `supabase/migrations/20260728130000_add_personal_plan_prepared_artifacts.sql`
- [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)

## Chosen direction

### Product behavior

Use a reusable bearer link such as `https://chaarlie.de/test/haarplan/<random-token>`. The raw token is validated once, exchanged for a signed, HttpOnly campaign cookie, and removed from the browser URL by redirecting to the clean Personal Plan landing route. The campaign mode is then copied into the server-owned funnel session and follows the visitor through quiz, lead capture, result, and offer.

The quiz itself remains unchanged except for a persistent field-test banner. The result and full offer remain visible. All checkout entry points on that offer are replaced with one CTA: **„Kostenlos mit meinem Plan fortfahren“**. The CTA creates a limited guest owner, attaches the prepared artifact, records a non-payment `field_test` enrollment and a seven-day manual access grant, signs the guest into that browser, and redirects to `/plan-start` or the existing `/plan-bereit?lead=...` recovery surface.

The email entered in the quiz remains lead/contact data. It is not used as the Supabase Auth identity and is not treated as proof that the tester owns an existing Chaarlie account. This is what makes “any email, immediately” compatible with account safety. Cross-device login or conversion of the guest into a permanent customer account is a separate future feature.

### Exact campaign defaults

- Initial campaign name: `Personal Plan Feldtest 2026-08`.
- Campaign lifetime: 30 days from separately approved production activation.
- Maximum successful activations: 100.
- Individual access lifetime: 7 days from successful activation.
- One enrollment per exact `campaign_id + lead_id`; retries return the existing result.
- The raw campaign token is at least 32 random bytes, is shown only when the campaign is created, and is stored only as a SHA-256 hash.
- Invalid, expired, revoked, or exhausted links fail before the quiz and never create a lead, guest, grant, or enrollment.

### Identity choice

On free activation, the server creates a Supabase Auth user with a synthetic, non-deliverable internal address and a generated high-entropy password. The password exists only in server memory long enough for the request-bound server client to establish the browser session; it is never returned, logged, or stored by application code. The user receives `app_metadata.access_kind = "field_test"`, while the participant-entered email remains solely on the quiz lead.

This deliberately avoids:

- setting `email_confirmed_at` for the participant-entered address without proving ownership;
- looking up or taking over an existing account by entered email;
- enabling project-wide anonymous sign-ins;
- putting the service-role key or guest credential in client code;
- creating a fake Stripe/PayPal customer, checkout, purchase, subscription, consent, or payment event.

If the browser is already authenticated, the test entry surface must ask the visitor to start a separate test session or return to the existing account. It must not attach a field-test lead to the already signed-in customer silently.

### Data and authorization choice

Add two service-only tables:

1. `personal_plan_test_campaigns`
   - `id`, `name`, `token_hash`, `status`, `starts_at`, `expires_at`, `max_activations`, `access_duration_hours`, `created_at`, `revoked_at`.
   - Check constraints enforce valid status, positive limits, and coherent dates.
   - Only a hashed token is persisted.

2. `personal_plan_test_enrollments`
   - `id`, `campaign_id`, `funnel_session_id`, `lead_id`, `user_id`, `manual_access_grant_id`, `status`, `activated_at`, `expires_at`, `revoked_at`, `created_at`.
   - Unique `campaign_id + lead_id` makes activation idempotent.
   - Foreign keys bind the exact campaign, funnel session, Personal Plan lead, guest owner, and grant.

Both tables have RLS enabled, no `anon` or `authenticated` grants, and service-role-only access. Activation uses one private-schema transaction function with an empty `search_path`, explicit table qualification, and revoked `PUBLIC` execution. The server route validates the campaign cookie and current funnel/lead relationship before calling it. The transaction:

1. locks and revalidates the campaign window, status, and successful-activation count;
2. verifies the funnel session is the field-test session for the exact campaign and lead;
3. verifies the lead is `personal_plan` and its prepared artifact is attached and owner-free;
4. upserts the seven-day `manual_access_grants` row for the guest `user_id` with reason `tester`;
5. links the prepared artifact to the guest owner;
6. inserts or returns the idempotent field-test enrollment;
7. records a non-commercial `field_test_activated` funnel event.

Extend Personal Plan enrollment resolution with `sourceKind: "field_test"` and a neutral `qualifiedAt` timestamp. Paid sources populate `qualifiedAt` from `paid_at`; field tests populate it from `activated_at`. Payment-specific types and monitors continue to use `paidAt`. Active, unexpired field-test enrollment plus its exact prepared artifact becomes a valid Personal Plan source and an internal-rollout-eligible test owner for Stages 1–5.

### Analytics and messaging

Add `test_kind = "field_test"` to the trusted funnel context. Browser and server events keep this property so field-test usability can be analyzed, while purchase, revenue, checkout-conversion, paid-access monitoring, Meta conversion, and commercial experiment cohorts exclude it. Retain existing `is_internal_test` behavior for internal QA; do not overload it with field participants.

The operational quiz-result email may still be sent through the existing result-artifact flow. The field-test trait must suppress paid onboarding, abandoned-checkout, cross-sell, and revenue automations regardless of marketing consent. Marketing consent remains separately recorded and must not be inferred from test participation.

## Scope and non-goals

### In scope

- Reusable secret test-link entry and clean-URL exchange.
- Visible German field-test banner throughout quiz and offer.
- Full existing Personal Plan quiz, preparation, email capture, reveal, and offer.
- Free activation CTA replacing every checkout CTA in trusted field-test context.
- Limited guest owner, artifact binding, manual access grant, and Personal Plan field-test enrollment.
- Seven-day same-browser Personal Plan access through Stages 1–5 and Routine.
- Revocation, expiry, capacity, idempotency, rate limiting, audit events, and clear recovery states.
- Separation from real payment state and commercial analytics/automations.
- One guarded operator command to create, inspect, and revoke the initial campaign; no raw token committed to Git.

### Non-goals

- No payment-provider sandbox or fake production payment.
- No generic `/free` route that works without a campaign credential.
- No email allowlist or environment-variable email maintenance.
- No participant-facing admin page or general coupon system.
- No conversion of a guest test into a permanent account in this slice.
- No cross-device recovery after the guest session is lost.
- No retroactive access for old quiz leads.
- No redesign of quiz questions, recommendation logic, offer structure, or Personal Plan Stages 1–5.
- No production campaign creation, deployment, allowlist change, email send, or production data mutation as part of implementation review; each remains separately authorized.

## Target map

| Surface | Expected change |
| --- | --- |
| `src/app/test/haarplan/[token]/route.ts` | Validate hashed campaign token, set signed HttpOnly campaign cookie, redirect to clean entry, and render safe invalid/expired/revoked/capacity recovery. |
| `src/lib/personal-plan-field-test/*` | Central campaign-cookie codec, trusted context resolution, activation service, guest identity creation, and exact error types. |
| `src/app/lp/[slug]/page.tsx`, `src/funnels/types.ts`, `src/funnels/landing/personal-plan-quiz.tsx` | Pass server-validated field-test presentation state into the existing Personal Plan quiz without creating a second quiz implementation. |
| `src/components/personal-plan-quiz/personal-plan-quiz.tsx` | Render the persistent banner; keep all quiz screens and email/consent behavior unchanged. |
| `src/app/api/quiz/personal-plan-lead/route.ts`, `src/lib/funnel/{cookie,client,server}.ts` | Bind the field-test campaign to the exact server funnel session and lead; never trust a browser boolean. |
| `src/app/result/[leadId]/page.tsx`, `src/app/result/[leadId]/result-client.tsx`, `src/components/personal-plan-offer/personal-plan-offer.tsx` | Render the full offer with field-test banner and replace checkout CTAs with free activation only for the trusted exact lead/session. |
| `src/app/api/personal-plan/field-test/activate/route.ts` | Rate-limit, create/reuse guest session, invoke transactional activation, cleanly recover on retry, and return only approved next destinations. |
| `src/lib/personal-plan/enrollment.ts`, `src/lib/personal-plan/journey-access-loader.ts`, `src/lib/personal-plan/persistence/{stage1-service,stage1-supabase}.ts` | Accept active field-test enrollment as a distinct non-payment Personal Plan source using `qualifiedAt`. |
| `src/lib/personal-plan/rollout-access.ts` and Stage 5 rollout callers | Treat an active field-test enrollment as rollout eligibility without adding participant email to internal allowlists. |
| `src/lib/billing/subscriptions.ts` | Reuse active `manual_access_grants`; preserve paid-access precedence and all existing customer behavior. |
| New Supabase migration | Create service-only campaign/enrollment tables, indexes, constraints, private activation function, grants, RLS, and comments. |
| Funnel/PostHog/Customer.io mappings and dashboard migrations | Carry `test_kind=field_test`, exclude commercial metrics and automations, preserve separate test-analysis visibility. |
| `scripts/` operator command | Create, inspect, and revoke a campaign with explicit confirmation and one-time raw-link output. |
| Focused unit, route, database, browser, and analytics tests | Prove security boundaries, exact correlation, idempotency, expiry, recovery, routing, and non-regression. |

## Designed user journey

### Primary field-test journey

1. A Chaarlie team member opens the reusable campaign link on the participant’s phone. The server validates the token, removes it from the visible URL, and displays the normal Personal Plan quiz with a persistent **„Kostenloser Chaarlie Produkttest · keine Zahlung erforderlich“** banner.
2. The participant answers every normal Personal Plan question. Draft saving, back navigation, preparation, and loading behavior remain unchanged.
3. At the existing email step, the participant enters any syntactically valid, deliverable email and makes the existing consent choice. The email identifies the lead and result delivery only; it does not sign the participant into an existing account.
4. The participant sees the normal result reveal and full personalized offer. The field-test banner remains visible. The commercial plan selector, provider buttons, checkout sheet, reference-price mechanics, and purchase claims are absent. In their place is a `0 €` field-test card with **„Keine Zahlungsdaten · kein Abo · zeitlich begrenzter Testzugang“**.
5. The participant taps **„Kostenlos mit meinem Plan fortfahren“**. The button becomes a single loading state and cannot create parallel activations.
6. The server creates a limited guest owner, connects the exact quiz artifact, creates the seven-day access grant and field-test enrollment, signs the guest into that browser, and responds with the existing approved Personal Plan destination.
7. If preparation is complete, the participant sees **„Dein Haarplan ist bereit“** and continues to `/plan-start`. If attachment is still settling, the existing `/plan-bereit?lead=...` surface polls and then continues automatically.
8. The participant completes Stage 1 Bedarf, Stage 2 refinement, Stage 3 exact products, Stage 4 Routine, and Stage 5 Anwendung using the normal production implementation. The Routine remains available on the same browser until the seven-day grant expires or the campaign/enrollment is revoked.

### Important variants and recovery

- **Invalid, expired, revoked, or exhausted campaign:** show a neutral German unavailable page before quiz creation. Do not reveal which campaign check failed. Provide only **„Chaarlie-Team fragen“** guidance; do not fall through to paid checkout under a misleading test banner.
- **Existing authenticated browser session:** before starting, explain that a fresh product test must be separate. The user may explicitly start a separate local test session or return to their existing account. Never silently attach the test lead to the existing customer.
- **Activation retry:** preserve the saved lead and result. A repeated CTA for the same campaign and lead returns the same enrollment and next destination, not a second guest or grant.
- **Activation failure after guest creation:** no access is granted unless the database transaction completes. The result page shows **„Testzugang erneut aktivieren“**, a non-sensitive support code, and **„Zur Auswertung zurück“**; it never redirects to payment.
- **Access expired/revoked:** authenticated guest access resolves unavailable and routes to a dedicated field-test-ended explanation, not pricing and not a generic subscription error.
- **Lost browser session or different device:** the access is not recoverable by merely typing the lead email. The participant can use a newly issued test journey; permanent-account conversion is explicitly out of scope.
- **Normal customer link:** the current `/lp/haarplan` route without a valid test campaign cookie remains byte-for-byte commercial in decision behavior and continues to payment normally.

Evidence-review status: **confirmed by Nick on 2026-08-10** after reviewing the desktop/mobile proposal; no visual or copy corrections were requested.

User-journey sign-off: **confirmed by Nick on 2026-08-10** for the narrated link → full quiz → result/offer → free activation → five-stage Personal Plan journey, including the proposed campaign/access defaults.

## Planning evidence

- [Rendered review artifact](./mockups/2026-08-10-personal-plan-field-test-flow.html)
- [Desktop capture](./mockups/2026-08-10-personal-plan-field-test-flow-desktop.png)
- [Mobile capture](./mockups/2026-08-10-personal-plan-field-test-flow-mobile.png)
- Current production quiz was inspected at `https://chaarlie.de/lp/haarplan` on 2026-08-10 at desktop width before creating the proposal.

Question answered by the mockup: how can the test mode remain unmistakable without adding a fake quiz or preventing the offer from being tested?

Selected direction: a slim persistent test banner, unchanged quiz questions, the full personalized offer, one explicit free continuation card, a short success handoff, and a retry state that preserves the result.

Feedback incorporated so far:

- The special link includes the quiz from its first screen.
- The system knows test mode from entry rather than deciding it only on the offer.
- The full offer remains reviewable.
- Payment is replaced at the offer CTA, then the journey rejoins the real post-payment Personal Plan flow.
- Any email can be entered immediately without using that email to impersonate an account.
- Nick approved the rendered direction and journey without corrections on 2026-08-10.

## Ordered tasks

### 1. Add the campaign credential and trusted funnel-context seam

**Consumes:** the reusable-link product contract and existing signed funnel-cookie pattern.

Create the campaign table, token hashing/constant-time comparison, entry route, signed HttpOnly cookie, clean redirect, campaign-state resolver, and server-owned `test_kind` funnel correlation. Add the guarded operator command for campaign creation/inspection/revocation. The route must reject invalid lifecycle/capacity states before rendering the quiz and must never place the raw token into PostHog, Customer.io, Meta, Sentry, application logs, referrers, or persisted funnel URLs.

**Produces:** `TrustedPersonalPlanFieldTestContext { campaignId, accessDurationHours, testKind: "field_test" }` available only when the campaign cookie and exact funnel session validate.

**Completion criterion:** route tests prove valid exchange, clean redirect, hash-only persistence, cookie attributes, generic rejection, revocation, expiry, capacity, token non-logging, and ordinary `/lp/haarplan` isolation.

### 2. Carry test presentation through the existing quiz and offer

**Consumes:** trusted field-test context from Task 1.

Pass a narrow presentation object through the existing Personal Plan funnel. Render the reviewed banner on every quiz/offer state. At lead capture, bind campaign, funnel session, and lead server-side. At result render, require the exact trusted campaign/session/lead relationship before showing the free card. Replace all checkout/sticky/final CTAs together; do not mount Stripe Elements, PayPal, Apple Pay, pricing experiments, checkout consent, or provider prewarm in field-test mode.

**Produces:** `FieldTestOfferAuthorization { campaignId, funnelSessionId, leadId }` claimable only for the exact prepared Personal Plan result.

**Completion criterion:** component and route tests prove full quiz preservation, correct German copy, all payment UI absent only in field-test mode, ordinary offer unchanged, result-return/reload preservation, and tampered client flags unable to expose the free CTA.

### 3. Create the guest owner and activate non-payment enrollment

**Consumes:** exact offer authorization from Task 2 and the existing attached prepared artifact.

Implement rate-limited activation, synthetic guest Auth creation, request-bound sign-in, profile readiness, the private transactional activation function, seven-day manual grant, artifact binding, field-test enrollment, idempotent retry, and approved next routing. Store only guest classification in `app_metadata`; never use participant email or `user_metadata` for authorization. If the database transaction fails, the guest has no grant/enrollment and retry safely reuses or replaces the incomplete guest without duplicating access.

**Produces:** an authenticated guest `user_id`, active manual grant, active `field_test` enrollment, owner-bound prepared artifact, and `/plan-start` or `/plan-bereit?lead=...` destination.

**Completion criterion:** deterministic service/route tests and an applied local-database test prove exact correlation, transaction rollback, idempotency, campaign concurrency cap, artifact ownership conflict rejection, no provider writes, no raw guest credential exposure, and stable retry.

### 4. Admit field-test enrollment to the five-stage journey

**Consumes:** active enrollment and artifact from Task 3.

Extend Personal Plan enrollment with `sourceKind: "field_test"` and `qualifiedAt`; preserve real payment semantics in payment code. Make active field-test owners eligible for the internal Personal Plan and Stage 5 rollouts without email allowlisting. Preserve stage frontier/resume behavior and route expired/revoked guests to the dedicated ended surface.

**Produces:** the same `PersonalPlanJourneyAccess` stage permissions and prepared source consumed by existing Stage 1–5 services.

**Completion criterion:** enrollment, Stage 1 persistence, journey-access, rollout, and route tests prove Stages 1–5 work for an active field test; expiry/revocation fails closed; paid and legacy users retain their current behavior.

### 5. Keep field-test data out of commerce and lifecycle automation

**Consumes:** `test_kind="field_test"` from Tasks 1–3.

Carry the marker into analytics envelopes and Customer.io traits. Update commercial PostHog/dashboard predicates, Meta conversion routing, checkout/revenue events, paid-access monitors, and Customer.io automation eligibility so field tests never count as purchases, conversions, revenue, abandoned checkouts, or paid lifecycle members. Preserve a separate field-test funnel view for usability analysis and allow only the operational result artifact email.

**Produces:** analyzable field-test behavior with zero commercial attribution.

**Completion criterion:** analytics destination, dashboard migration, payment monitor, Customer.io outbox/trait, and negative provider-event tests prove exact exclusion and no regression for real customers.

### 6. Verify the complete production-shaped journey without activating production

**Consumes:** all prior tasks.

Add deterministic campaign/guest fixtures and an end-to-end browser test covering token exchange, quiz marker, lead, reveal, offer, free activation, Plan Start, and Routine reachability. Review desktop and mobile against the approved mockup. Run a local applied-database journey and the repository’s focused Personal Plan/auth/billing suites. Prepare, but do not execute, a production activation runbook covering campaign creation, link custody, smoke test, revocation, metrics isolation, and rollback.

**Produces:** review-ready implementation evidence and a separately gated activation procedure.

**Completion criterion:** all automated checks pass; rendered mobile/desktop journey matches approved evidence; database advisors have no new security findings; no production writes or deployment have occurred; readiness handoff explicitly reports `NO_ACTIVATION`.

## Verification

### Automated

- Unit tests for token parsing, hashing, cookie codec, lifecycle/capacity evaluation, exact trusted context, expiry, and idempotency.
- Route tests for entry and activation, including rate limits, invalid/tampered context, unsupported lead kind, artifact conflict, already-authenticated browser, and approved destinations.
- Component tests for banner persistence and complete checkout removal in field-test mode.
- Regression tests proving the normal Personal Plan quiz/offer/checkout is unchanged.
- Enrollment, Stage 1 persistence, journey-access, rollout, and Stage 1–5 integration tests using `field_test` source.
- Database tests for constraints, RLS/grants, private function execution, concurrent campaign capacity, transaction rollback, and artifact ownership.
- Analytics/Customer.io/Meta/payment-monitor negative tests proving no commercial side effects.
- Browser test from special link through quiz, offer, activation, plan stages, Routine, refresh, expiry, and revocation.

### Manual/browser

- Compare desktop and mobile quiz banner, offer card, activation loading/success, retry, link unavailable, existing-session warning, and access-ended states against approved planning evidence.
- Confirm no payment SDK, sheet, provider request, or payment copy appears anywhere in field-test context.
- Confirm the raw token disappears after first navigation and never appears in browser analytics or copied result links.
- Confirm a normal production-shaped visitor without the campaign cookie still receives the current paid offer.
- Confirm repeated testing can start a separate local guest only through an explicit session switch.

### Migration and live-state gates

- Generate the migration with the repo Supabase workflow; run local reset/apply proof appropriate to current replay constraints.
- Run Supabase database advisors after the schema/function change.
- Verify no Data API grants expose campaign or enrollment tables and `PUBLIC`, `anon`, and `authenticated` cannot execute the activation function.
- Before any separately approved production activation, verify deployed schema/app SHA, create exactly one bounded campaign, perform one supervised smoke activation, verify no billing/provider record, and verify PostHog/Customer.io exclusion.
- Revoke the campaign immediately if token handling, provider isolation, entitlement expiry, or analytics isolation fails.

## Review and handoff

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/cofounder-production-access`
- Branch: `codex/cofounder-production-access`
- Plan and rendered HTML artifact: commit with the eventual implementation PR.
- Local PNG captures: transient review previews ignored by Git; discard after evidence review because the HTML remains the durable source.
- Counterpart review: intentionally omitted because Nick explicitly required no Claude/counterpart reviews for this workstream.
- Evidence review: **confirmed 2026-08-10**.
- User-journey sign-off: **confirmed 2026-08-10** with no corrections.
- Implementation gate: cleared for an explicitly requested `implementation-loop`; this planning approval does not itself start implementation.
- Publication gate: implementation approval does not authorize commit/push/PR unless separately requested under the repository workflow.
- Activation gate: merge/deployment still does not authorize campaign creation, production data writes, allowlist changes, email sends, or sharing the live link.
- Primary residual risk: the link is a bearer credential. Hash-only storage, clean-URL exchange, campaign cap, expiry, revocation, and test-only entitlement contain but do not eliminate link sharing.
- Secondary residual risk: same-browser guest access is deliberately not recoverable across devices. Adding verified account conversion later requires a separate data-merge design.

### Self-review findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| F1 | defect | Manual grants satisfy general app access but `enrollment.ts` accepts only paid sources. | accepted | Added distinct field-test enrollment and journey source. | Enrollment and Stage 1–5 tests. |
| F2 | tradeoff | Participant email cannot provide instant access and simultaneously prove account ownership. | accepted | Email remains lead contact; server guest owns the test journey. | Account-takeover and entered-email tests. |
| F3 | tradeoff | Supabase anonymous sign-in is currently disabled and would open a global signup surface. | accepted | Use campaign-gated synthetic guest creation instead. | Auth config unchanged and guest-secret negative tests. |
| F4 | defect | Showing a free CTA from a browser flag would make the bypass forgeable. | accepted | Exact server campaign/session/lead correlation is required. | Tampered-context route tests. |
| F5 | defect | Reusing payment rows would pollute commerce and monitoring. | accepted | No provider or paid row; distinct `field_test` source and analytics exclusions. | Negative provider/commerce tests. |
| F6 | tradeoff | A reusable link can be shared outside the supervised test. | accepted | 30-day campaign, 100 activations, hashed token, clean exchange, revocation, seven-day access. | Lifecycle/capacity/concurrency tests. |
