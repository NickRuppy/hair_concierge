# Standalone waitlist launch

## Outcome and source context

Build a public Chaarlie waitlist journey at `/warteliste` using Jonas's PR
[#314](https://github.com/NickRuppy/hair_concierge/pull/314) as the visual and copy
starting point, while integrating it through an owner-controlled branch with the
repository's reliable validation, persistence, delivery, tracking, and security
primitives.

The reviewed upstream concept is PR head
`af37752fae8c3d3509e50928190963e09ecd3a35`. Product decisions confirmed by Nick:

- the route is public on deployment, with no feature flag;
- a successful email submission immediately secures the waitlist place;
- the Typeform survey and WhatsApp community are optional follow-ons;
- the approved launch dates, 300-place founding cohort, pricing promises, daily-email
  promise, and `4.000+ / 82 % / 63 %` claims remain;
- the existing Typeform and WhatsApp destinations are the production destinations;
- the implementation owns the working Customer.io launch email flow rather than
  stopping at an event-contract handoff;
- existing quiz, offer, checkout, subscription, and funnel-package behavior must not
  change.

## Chosen direction

Keep the three-route campaign journey from PR #314, but make the conversion boundary
truthful and durable:

1. `/warteliste` captures and validates the signup.
2. After Supabase commits the registration and delivery work, the user proceeds to
   `/warteliste/umfrage`, which confirms that the place is already secured and offers a
   short, explicitly optional Typeform survey.
3. Completing or skipping the survey leads to `/warteliste/danke`, which confirms the
   registration and presents WhatsApp as the fastest optional launch channel.

Use a dedicated waitlist data model and typed waitlist analytics. Do not introduce a
fake quiz funnel package, reuse the `leads` table, or make Customer.io the source of
truth. Customer.io delivery is dispatched immediately from a durable Supabase delivery
ledger, and the live automation is verified before the route is considered operationally
ready.

## Scope and non-goals

### In scope

- public waitlist, optional survey, and optional WhatsApp pages;
- shared email deliverability validation and user-visible correction/retry states;
- idempotent Supabase signup persistence and secure survey association;
- immediate outbox-backed Customer.io identify plus `waitlist_signup` and
  survey-completion delivery;
- live Customer.io welcome/launch automation verification and activation;
- dedicated non-PII PostHog events and bounded waitlist UTM attribution;
- Typeform CSP support, loading, failure, retry, and skip behavior;
- rate limits, Sentry-safe observability, route classification, SEO/noindex behavior,
  responsive QA, and focused tests.

### Non-goals

- changing `/quiz`, Personal Plan, offer variants, checkout, billing, subscriptions, or
  result pages;
- registering `/warteliste` as a quiz/offer funnel package or writing waitlist activity
  into `funnel_sessions`;
- adding a feature flag, pricing experiment, authentication, or user account;
- changing the Typeform questions or WhatsApp community itself;
- indexing the campaign pages in search. They remain reachable by direct URL but
  `noindex, nofollow`.

## Target map

### Durable data and delivery

- `supabase/migrations/<timestamp>_waitlist_signups_and_customerio_outbox.sql`
  - add `waitlist_signups` with unique `(campaign, normalized_email)`, consent and
    attribution fields, hashed survey-association token, and optional survey result;
  - add a protected waitlist Customer.io outbox with claim, terminal-failure, and
    delivery state;
  - enable RLS and deny direct public table access.
- `src/lib/waitlist/config.ts`
  - centralize every campaign/date/copy-sensitive value and the approved external
    destinations; remove hard-coded date leaks.
- `src/lib/waitlist/persistence.ts`, `tokens.ts`, `customerio.ts`, and
  `customerio-outbox.ts`
  - normalize and persist signups, issue/verify opaque association tokens, build
    Customer.io messages, and dispatch immediate delivery from current Supabase truth.
- `src/app/api/waitlist/route.ts`
  - expose an injectable/testable POST handler; rate-limit, parse, validate email
    deliverability, save transactionally, schedule immediate outbox dispatch, and
    return an opaque survey token after persistence succeeds.
- `src/app/api/waitlist/survey/route.ts`
  - accept `responseId + opaqueToken`, never browser-supplied email identity; validate
    association, record idempotently, enqueue delivery, and keep the optional survey
    from affecting signup truth.
### User journey

- `src/app/warteliste/layout.tsx`, `page.tsx`, `umfrage/page.tsx`, `danke/page.tsx`
- `src/components/waitlist/*`
  - port PR #314's narrow shell, form, proof, WhatsApp card, QR treatment, and launch
    explanation;
  - change all post-submit copy from “fast gesichert” to “gesichert”;
  - add explicit survey skip and Typeform loading/error recovery;
  - frame WhatsApp as optional and fastest, not required;
  - use a legal-only waitlist footer so the standalone path does not link users into
    the existing quiz funnel.
- `plans/mockups/2026-08-03-standalone-waitlist-flow.html`
  - durable responsive prototype for entry, secured-survey, survey-error, and final
    WhatsApp states.

### Tracking, security, and routing

- `src/lib/analytics/events.ts`, `routes.ts`, `destinations/posthog.ts`
  - add typed `waitlist_signup_completed`, `waitlist_survey_completed`, and
    `waitlist_whatsapp_clicked` events with bounded, non-PII properties.
- `src/lib/waitlist/attribution.ts` and a waitlist client bootstrap
  - retain an allowlisted, length-bounded set of `utm_source`, `utm_medium`,
    `utm_campaign`, `utm_content`, and `utm_term` for this campaign only;
  - preserve normal automatic PostHog page views without creating a funnel cookie.
- `src/lib/auth/route-classification.ts`, `tests/seo-metadata-routes.test.ts`
  - classify only the intended public pages and APIs.
- `next.config.ts`
  - allow the exact Typeform script and frame origins in CSP and cover them with a
    regression test.

## Designed user journey

Status: **approved by Nick on 2026-08-03**.

1. A visitor arrives directly at `/warteliste`, normally from a campaign link. The page
   explains the August 9 launch, the founding-round limit, the product promise, and the
   approved research proof. The page is public but not indexed.
2. The visitor enters first name and email and chooses **Platz sichern**. While the
   request is active, the button reads **Wird gesichert ...** and cannot be submitted
   twice.
3. Invalid fields stay on the page with field-specific German guidance. A confirmed
   email-domain problem shows the shared correction/retry experience. Rate-limit,
   storage, and network failures say that the place was not yet saved and let the
   visitor retry.
4. Once Supabase commits the registration, the place is secured even if Customer.io is
   temporarily unavailable. The browser stores only the opaque survey-association token
   and opens `/warteliste/umfrage`.
5. The survey page starts with **Dein Platz ist gesichert**. It presents the under-
   60-second Typeform as voluntary, with **Umfrage überspringen** and explicit reassurance
   that skipping does not affect the registration.
6. While Typeform loads, the page shows a visible loading state. If the embed fails, the
   visitor can retry or continue without it. A completed survey is securely associated
   through the opaque token; a forged or stale token cannot update another signup.
7. Completing or skipping opens `/warteliste/danke`. The page confirms **Du bist drin**,
   explains the welcome email and launch timing, and offers WhatsApp as the fastest
   optional way to receive the launch link, founding price, and resources. Email remains
   a complete fallback.
8. On desktop, the visitor can scan the QR code; on mobile, the same primary CTA opens
   WhatsApp. QR generation failure removes only the QR block, never the button.
9. Completion means the Supabase registration exists, Customer.io delivery is queued or
   delivered, the visitor sees a truthful confirmation, and signup analytics contain no
   name, email, or Typeform response identifier.

## Mockup evidence

- Prototype:
  `plans/mockups/2026-08-03-standalone-waitlist-flow.html`
- Selected direction: PR #314's restrained single-column Chaarlie presentation, revised
  so signup is the conversion and both later steps are optional.
- Feedback incorporated: no feature flag; all approved campaign promises retained;
  public direct route; end-to-end email flow; no dependency on the existing quiz funnel.
- Mockup review: **approved by Nick on 2026-08-03**. Nick explicitly confirmed the
  four-state entry, optional-survey, survey-recovery, and optional-WhatsApp journey and
  asked Codex to proceed with Workers and Explorers.

## Ordered tasks

1. **Add red contract tests and the waitlist migration.** Cover table/RLS/index/outbox
   structure, idempotent `(campaign,email)` signup, association-token hashing, and no
   `leads`-table changes. Completion: migration tests fail before and pass after the
   schema is added.
2. **Implement deterministic waitlist persistence and secure association.** Add
   normalization, token generation/verification, duplicate behavior, and injectable
   server seams. Completion: focused tests prove duplicate signup safety and reject
   forged or cross-signup survey association.
3. **Implement immediate Customer.io projection.** Build identify/event payloads from
   current Supabase rows, inspect `{ok, skipped, status, error}`, claim safely, record
   failures, and avoid any scheduled reconciliation endpoint. Completion: tests cover
   success, missing credentials, provider failure, terminal failure, stale claims, and
   idempotent messages.
4. **Implement the two public APIs.** Reuse email deliverability and separate signup/
   survey rate-limit buckets. Return signup success only after durable persistence;
   keep Customer.io asynchronous. Completion: handler tests cover 400, 422 correction,
   429, 503, persistence failure, success, and duplicate retry.
5. **Port and adapt the user-facing journey.** Implement the reviewed entry, survey,
   survey loading/error/skip, and final WhatsApp states in the approved layout.
   Completion: component/browser tests prove the ordered journey and all recovery paths.
6. **Add standalone analytics and attribution.** Define typed PostHog-only events,
   bounded UTM registration, CTA surface metadata, and privacy tests. Remove PR #314's
   ineffective funnel milestone. Completion: events fire once with no PII and no
   `funnel_sessions` writes.
7. **Finish public/security integration.** Add exact routes, legal-only footer, CSP
   allowlists, noindex metadata/header coverage, Sentry-safe logs, and centralized dates.
   Completion: route/CSP/SEO tests pass and Typeform renders without CSP reports.
8. **Verify the live email automation contract.** Inspect the existing Customer.io
   workspace, create or update the waitlist automation if needed, verify trigger,
   consent, frequency, content, unsubscribe behavior, and one-time welcome delivery.
   Do not activate duplicate or ambiguous flows. Completion: a controlled non-customer
   smoke signup produces one profile update, one signup event, and one welcome email.
9. **Run full readiness and review.** Execute focused tests, `npm run test:node`,
   `npm run ci:verify`, browser checks at mobile/desktop widths, `ready-check`, and the
   repository's single `request-code-review` gate. Completion: one content fingerprint
   identifies the verified and reviewed tree with no blocking findings.

## Verification

### Automated

- focused waitlist migration, persistence, token, outbox, API, analytics, CSP, route,
  and component/browser tests;
- `npm run test:node`;
- `npm run ci:verify`;
- relevant Playwright smoke/contract suites;
- `ready-check` and `request-code-review` on the exact final tree.

### Manual and browser

- 390x844 and desktop entry, survey, Typeform loading/failure, skip, and thank-you
  states;
- keyboard labels/focus, pending state, correction, retry, and no horizontal overflow;
- Typeform completion and skip both preserve the already-secured message;
- mobile WhatsApp link and desktop QR fallback;
- direct `/warteliste?utm_*` visit records bounded attribution without setting or
  changing quiz-funnel assignment.

### Migration and live-state

- linked migration history and RLS verification before any production application;
- Customer.io server credential and exact automation inventory;
- controlled signup confirms one Supabase row, queued/delivered outbox state, one
  Customer.io profile/event, and one welcome email;
- production writes, migration application, activation, deployment, merge, and cleanup
  remain separately receipted even though the product direction is “fully on.”

## Review and handoff

- Worktree: `.worktrees/waitlist-launch`
- Branch: `codex/waitlist-launch`
- Mockup review: **approved by Nick on 2026-08-03**
- Designed-user-journey sign-off: **approved by Nick on 2026-08-03**
- Counterpart review: intentionally skipped because Nick explicitly asked not to use
  Claude for this work.
- Live Customer.io preflight (2026-08-03): Automation 6, **Warteliste Welcome
  (Launch 1)**, was verified against the `waitlist_signup` trigger and activated. Its
  welcome message is configured for subscribed profiles with an unsubscribe link.
  Segment 20 expects `waitlist_campaign = launch_1_2026_08`; the backend contract was
  aligned to that exact value. The seven dated follow-up broadcasts remain Draft, the
  segment currently has zero profiles before deployment. Nick confirmed on 2026-08-03
  that the prior payment warning is sufficiently resolved and Customer.io remains fully
  usable. No live smoke event was emitted.
- Live migration preflight after removing scheduled reconciliation (2026-08-03): the
  linked production ledger contains `20260803120000`. Its already-applied SQL remains
  unchanged; the application no longer configures or serves a waitlist retry cron.
- PR #314 disposition: source/reference only; owner branch ports the useful UI and copy.
- Durable plan and mockup: **commit** with the implementation.
- Explorer and transient render output: **discard** after integration.
- Implementation stop point: verified review-ready branch. Commit, push, PR, merge,
  deployment, migrations, and production activation require the applicable publication
  and production-write receipts.
