# Regular quiz field-test access

## Outcome and source context

Create a reusable, revocable production test link for the regular Chaarlie quiz that mirrors the existing Personal Plan field-test structure: the tester completes the real ten-question `/quiz` funnel, sees the real personalized organic result and offer, replaces payment with a free continuation, and enters the normal post-purchase onboarding and app journey with seven days of non-commercial test access.

Source context:

- Existing implementation and approved behavior: [Personal Plan field-test plan](./2026-08-10-personal-plan-field-test-access.md).
- Existing operator runbook: [Personal Plan field-test access](../docs/personal-plan-field-test-access.md).
- User direction on 2026-08-11: replicate the same structure with the regular quiz funnel in front; ask only if a genuine product decision remains.

## Chosen direction

Use a second entry shape, `https://chaarlie.de/test/quiz/<random-token>`, backed by the same campaign lifecycle and browser-safety model as `/test/haarplan/<token>`. Add an immutable campaign `flow_kind` (`personal_plan` or `regular_quiz`) so a token can authorize exactly one journey. Preserve existing Personal Plan campaign IDs, tokens, cookies, enrollments, and runtime behavior; do not rename or migrate the existing service tables in this slice. Parameterize the proven primitives in place and add narrowly named regular-quiz wrappers; do not extract a new generic field-test framework for this bounded second consumer.

The raw regular-quiz token is validated once, exchanged for a distinct signed HttpOnly cookie, removed from the visible URL, and paired with a fresh `default_organic` funnel session before redirecting to `/quiz`. The regular quiz remains unchanged except for the same persistent field-test banner. Its organic result and offer remain visible, while all payment selectors, provider UI, checkout warming, guarantee claims, purchase wording, and checkout CTAs are replaced or suppressed by field-test-specific presentation. One CTA, **„Kostenlos mit Chaarlie fortfahren“**, creates or reuses a limited guest, grants seven days of manual access, links the exact legacy quiz lead to that guest, projects the lead into the guest hair profile, signs the guest into the browser, and continues to `/onboarding?lead=...`.

The regular quiz's entered email remains lead and result-delivery data. It is not used as the Supabase Auth identity. The guest retains the existing synthetic non-deliverable identity pattern. A browser already authenticated as a customer is rejected before the test starts and receives the same separate-session explanation as the Personal Plan test.

### Compatibility choice

Extend `personal_plan_test_campaigns` additively with `flow_kind text NOT NULL DEFAULT 'personal_plan'` rather than renaming the table or creating a second campaign credential store. The name is historical, but this path keeps the currently distributed Personal Plan token and foreign-key graph stable. Add a separate `regular_quiz_test_enrollments` table because regular access has no prepared Personal Plan artifact and must not weaken `personal_plan_test_enrollments.prepared_artifact_id NOT NULL`.

### Exact regular-quiz defaults

- Campaign flow: `regular_quiz`.
- Global runtime gate: `REGULAR_QUIZ_FIELD_TEST_ENABLED`; false or absent disables regular entry, binding, result authorization, and activation without changing ordinary organic behavior. Campaign revocation remains the per-campaign control.
- Entry route: `/test/quiz/<token>`.
- Funnel package: `default_organic`; quiz and offer variants continue to resolve from that package.
- Campaign lifetime, capacity, raw-token rules, and individual seven-day access match the Personal Plan defaults.
- One enrollment per exact `campaign_id + lead_id`; retries reuse the exact guest, grant, and enrollment.
- Free activation destination: `/onboarding?lead=<lead-id>`.
- Guest metadata includes `access_kind = field_test` and `field_test_flow = regular_quiz`; pre-existing Personal Plan guests without `field_test_flow` continue to resolve as Personal Plan.
- No Stripe, PayPal, checkout consent, purchase, subscription, revenue, or commercial-conversion record is created.

## Scope and non-goals

### In scope

- Reusable secret `/test/quiz/<token>` entry and clean-URL exchange.
- Flow-scoped campaign resolution without invalidating the current Personal Plan campaign.
- Same German field-test banner through the regular quiz and offer.
- Full current ten-question quiz, lead capture, preparation, result, video, diagnosis, and non-commercial offer explanation.
- Free activation replacing all commercial actions and claims in trusted regular field-test context.
- Exact legacy lead/session/campaign binding, synthetic guest, seven-day manual grant, profile projection, and normal onboarding entry.
- Retry, expiry, revocation, capacity, existing-authenticated-browser, and unavailable-state handling.
- `test_kind=field_test` analytics visibility with exclusion from Meta, purchase/revenue, checkout conversion, paid lifecycle messaging, and commercial experiment cohorts.
- Guarded campaign operator support for both flow kinds, with dry-run default and one-time raw-link output.
- Desktop and mobile browser verification of the test journey through the onboarding entry handoff.

### Non-goals

- No quiz question, answer logic, result narrative, recommendation, or onboarding redesign.
- No fake Stripe/PayPal transaction, provider sandbox, subscription, or purchase record.
- No cross-device account recovery or conversion of a guest into a permanent account.
- No sharing of a Personal Plan token with the regular quiz, or vice versa.
- No rename of the historical Personal Plan campaign/enrollment tables in this slice.
- No change to ordinary `/quiz`, `/result/<lead>`, paid checkout, authenticated retake, or Personal Plan behavior without a valid flow-scoped field-test context.
- No production campaign creation, migration application, deployment, link issuance, access activation, or live tester data write as part of implementation review.

## Target map

| Surface | Expected change |
| --- | --- |
| New migration under `supabase/migrations/` | Add campaign `flow_kind`, regular enrollment table, private/service-only bind/activate/revoke behavior, indexes, RLS, grants, and comments without weakening Personal Plan constraints. |
| `src/lib/personal-plan-field-test/*` or a narrowly extracted `src/lib/field-test/*` core | Reuse token hashing, lifecycle, cookie, guest, and rate-limit primitives; make flow scope explicit while keeping current exports compatible. |
| `src/app/test/quiz/[token]/route.ts`, `src/app/test/quiz/beendet/page.tsx` | Validate a regular-quiz token, reject existing authenticated sessions, set signed campaign and `default_organic` funnel cookies, redirect to `/quiz`, and show neutral ended/unavailable recovery. |
| `src/app/quiz/layout.tsx`, `src/app/quiz/quiz-shell.tsx` | Resolve trusted regular field-test presentation server-side and render the reviewed persistent banner without altering quiz logic. |
| `src/app/api/quiz/lead/route.ts` | Bind the exact regular field-test campaign/session/legacy lead, return explicit attachment state, fail closed, and suppress commercial side effects for trusted field tests. |
| `src/app/result/[leadId]/page.tsx`, `src/app/result/[leadId]/result-client.tsx` | Resolve exact regular field-test intent/authorization and carry the state only for `quiz_kind=legacy`. |
| `src/funnels/types.ts`, `src/funnels/offers/organic-plan-v1.tsx`, `src/components/organic-plan-offer/organic-plan-offer.tsx` | Carry trusted test presentation into the existing organic offer; keep evaluation content while replacing commercial CTAs/copy and suppressing payment-only sections. |
| New regular field-test activation card and `/api/quiz/field-test/activate` route | Create/reuse the exact guest, activate enrollment/grant, project the linked legacy lead with the existing `linkQuizToProfile` same-owner retry path, establish the browser session, and return `/onboarding?lead=...`. |
| `src/lib/quiz/link-to-profile.ts` | Preserve the public email-ownership guard; reuse only the already-owned exact-lead retry after transactional activation links the lead to the field-test guest. |
| `src/lib/supabase/middleware.ts`, field-test guest metadata | Route expired/revoked regular guests to `/test/quiz/beendet`; retain existing Personal Plan ended routing for old and Personal Plan guests. |
| Funnel/PostHog/Customer.io/Meta routing | Carry `test_kind=field_test`; allow non-commercial test analysis and operational result handling while suppressing paid lifecycle and conversion delivery. Gate regular-field-test work behind cheap cookie presence plus the global runtime gate so ordinary organic leads retain their current hot path. |
| `scripts/personal-plan-field-test-campaign.ts`, `package.json`, runbook docs | Add an explicit `--flow=personal-plan|regular-quiz` surface while preserving the existing Personal Plan command and default; do not add a second generic operator alias. |
| `src/app/labs/offer-page/page.tsx` and focused tests | Add a deterministic regular field-test render scenario for review and browser verification. |

## Designed user journey

1. A Chaarlie team member opens a reusable regular-quiz test link in a fresh browser session. The server validates the flow-scoped token, removes it from the visible URL, creates a clean organic funnel session, and opens `/quiz` with **„Kostenloser Chaarlie Produkttest · keine Zahlung erforderlich“** visible.
2. The tester completes all ten current questions, the current lead-capture sequence, preparation, and result generation. The existing question copy, answer options, validation, draft behavior, browser Back behavior, email deliverability, and result narrative remain unchanged.
3. The tester sees the current regular result and organic offer, including its real video, diagnosis, plan explanation, evidence, and testimonials. Tariff cards, provider controls, checkout overlays, purchase wording, and the money-back guarantee are absent. The field-test banner remains visible.
4. At the offer conversion point, the tester sees a `0 €` field-test card with **„Keine Zahlungsdaten · kein Abo · 7 Tage Testzugang“** and taps **„Kostenlos mit Chaarlie fortfahren“**. Sticky and final CTAs target the same free activation rather than `#pricing` or checkout.
5. The button enters one loading state. The server revalidates the campaign, exact organic funnel session, exact legacy lead, capacity, and current browser identity; then creates/reuses a synthetic guest, seven-day manual access grant, and regular field-test enrollment. The transaction links the lead and funnel to the guest. The server projects that already-owned lead into the guest hair profile and signs the guest into the browser.
6. On success, the tester sees **„Dein Testzugang ist bereit“** and continues to `/onboarding?lead=...`. They enter the existing product and routine onboarding with their quiz diagnostics already present, then reach the normal chat/routine/tracker app surfaces for the duration of the grant.
7. A retry for the same campaign/session/lead returns the same enrollment and repairs an interrupted hair-profile projection before success. It never creates a second guest or grant.

### Important variants and recovery

- **Existing authenticated browser:** stop before starting the quiz, explain that the product test needs a separate browser session, and offer return to the current account. Never attach the test lead to a customer.
- **Invalid, expired, revoked, exhausted, or wrong-flow token:** show one neutral German unavailable page before quiz creation; do not disclose which check failed and do not fall through to the paid quiz.
- **Lead binding uncertainty:** preserve the saved quiz state, show the test-unavailable recovery, and do not emit Meta/checkout/commercial lifecycle events or expose paid checkout beneath a test banner.
- **Activation failure:** keep the result and answers, show retry plus return-to-result actions, and state that no payment occurred. Retry reuses the exact guest/enrollment if already created.
- **Profile projection interrupted after access activation:** do not report success until the projection is complete. A repeat activation reuses the already-owned lead and completes projection.
- **Access expired or revoked:** route the regular field-test guest to `/test/quiz/beendet`, not pricing, reactivation, or the Personal Plan ended page.
- **Ordinary regular quiz and Personal Plan:** remain commercially and behaviorally unchanged when their exact trusted test context is absent.

User-journey sign-off: **confirmed by Nick on 2026-08-11** when he explicitly requested implementation with workers and explorers after receiving the rendered proposal and exact journey walkthrough. No corrections were requested.

## Planning evidence

- [Rendered responsive regular-quiz field-test proposal](./mockups/2026-08-11-regular-quiz-field-test-flow.html)
- Current local `/quiz` first question inspected at desktop width on 2026-08-11.
- Current local `organic-plan` offer lab inspected at desktop width on 2026-08-11.
- Existing Personal Plan field-test artifact used as the parity reference: [Personal Plan field-test flow](./mockups/2026-08-10-personal-plan-field-test-flow.html).

Question answered by the artifact: does the requested replication preserve the real regular quiz and organic offer while making the free, temporary, non-commercial test context unmistakable and handing off to the correct normal onboarding path?

Selected direction: preserve all regular quiz/result content, use the same slim persistent field-test treatment, replace every commercial conversion surface together, and continue into the existing onboarding rather than the Personal Plan five-stage journey.

Feedback incorporated: Nick explicitly requested the same structure with the other quiz funnel in front and asked to be involved only if a decision is required.

Evidence-review status: **confirmed by Nick on 2026-08-11** through the subsequent explicit implementation instruction; no visual or copy corrections were requested.

## Ordered tasks

### 1. Make campaign authorization flow-scoped without breaking the live Personal Plan link

**Consumes:** current `personal_plan_test_campaigns`, token hashing/cookie primitives, current Personal Plan campaign and enrollment contracts.

Add `flow_kind` with a backward-compatible Personal Plan default, a distinct signed regular-quiz cookie purpose, flow-filtered token/cookie resolution, the `/test/quiz/<token>` entry, existing-session refusal, and `default_organic` funnel-cookie issuance. Extend the guarded operator with explicit flow selection while keeping its current default and write gates. The regular entry and every downstream regular-field-test branch must also require `REGULAR_QUIZ_FIELD_TEST_ENABLED`; absence is a safe global rollback to ordinary behavior.

**Produces:** `EligibleFieldTestCampaign { campaignId, flowKind, accessDurationHours, startsAt, expiresAt }` and a trusted regular-quiz entry context that cannot be created by a Personal Plan token.

**Completion criterion:** migration/schema, primitive, route, operator, route-classification, SEO/noindex, cookie, wrong-flow, revocation, expiry, capacity, existing-session, and backwards-compatibility tests pass; the current Personal Plan raw-link shape and defaults remain unchanged.

### 2. Bind the trusted test context through the real regular quiz and lead lifecycle

**Consumes:** trusted regular-quiz cookie plus `default_organic` funnel session from Task 1.

Render the reviewed banner through the existing quiz shell. At legacy lead creation or reuse, bind the exact campaign/session/lead through a new regular RPC modeled on the Personal Plan RPC, not by calling the hard-coded Personal Plan bind function. Gate all regular-field-test resolution behind the distinct cookie's presence and the runtime flag so ordinary lead requests take the unchanged path without an added campaign lookup. Return a field-test attachment result and fail closed when test intent exists but binding is uncertain. Keep result email behavior explicitly non-commercial; suppress Meta lead conversion and paid lifecycle/customer messaging for field-test leads.

**Produces:** an exact funnel session with `test_kind=field_test`, flow-scoped `field_test_campaign_id`, and the bound legacy `lead_id`; downstream result rendering receives no client-trusted boolean.

**Completion criterion:** quiz-shell, lead-route, lifecycle, analytics, Customer.io, Meta, dedupe/reuse, tamper, and failure-recovery tests prove ordinary leads are unchanged and regular field-test leads cannot leak into commercial conversion paths.

### 3. Replace every regular-offer commercial action with the reviewed free activation

**Consumes:** exact bound regular field-test context from Task 2 and the current organic result/offer model.

Authorize the exact legacy result on the server, carry a narrow `fieldTest` presentation contract through the offer registry, preserve the real diagnosis/video/value content, and replace sticky, pricing, and final CTAs together. Do not mount Stripe, PayPal, prepared checkout, checkout consent, guarantee, or purchase-specific FAQ/copy. Add the deterministic offer-lab scenario used by browser checks.

**Produces:** `RegularQuizFieldTestOfferAuthorization { campaignId, funnelSessionId, leadId, accessDurationHours }` and one idempotent free-activation action exposed only for the exact authorized result.

**Completion criterion:** result-page, offer component, payment-absence, German-copy, tracking, reload, unavailable-intent, ordinary-offer non-regression, and lab-render tests pass at desktop and mobile widths.

### 4. Activate the exact regular test guest and rejoin normal onboarding

**Consumes:** exact offer authorization from Task 3, the existing synthetic guest/session pattern, manual access grants, and the exact legacy lead.

Add a service-only regular enrollment table and a new regular activation RPC modeled on—but not shared with—the Personal Plan RPC. It revalidates campaign flow/window/capacity, `default_organic` session package/test binding, `legacy` lead kind/ownership, and guest identity; omits every prepared-artifact predicate; atomically creates/reuses the seven-day grant, links the lead and funnel, records the enrollment and non-commercial event, and supports exact retries. After the transaction, reuse `linkQuizToProfile` only via its same-owner retry path, sign the guest into the browser, and return `/onboarding?lead=...` only after profile projection returns without error. Retry re-runs the same-owner direct-ID projection path.

**Produces:** authenticated guest with active manual grant, bound legacy lead, populated hair profile, active regular field-test enrollment, and a normal onboarding destination.

**Completion criterion:** route/service/database tests prove exact correlation, capacity locking, idempotency, rollback boundaries, same-owner profile projection, interrupted-projection retry, existing-user refusal, no provider writes, and no guest credential exposure; browser smoke reaches the first onboarding state with the quiz profile present.

### 5. Preserve lifecycle isolation through expiry, analytics, and operations

**Consumes:** flow metadata and enrollment from Tasks 1–4.

Route regular test guests to the regular ended surface on expiry/revocation, preserve Personal Plan guest routing for old and current records, update operational inspection/revocation and privacy-safe runbook steps, and verify commercial dashboards/automations exclude the regular field test while test analysis remains available.

**Produces:** flow-correct lifecycle and operator behavior with no ambiguity between the two test links.

**Completion criterion:** middleware, access, revocation, operator dry-run, analytics routing, observability scrubbing, and runbook tests pass; no production campaign or migration is applied during implementation review.

## Verification

### Automated

- Test-first focused Node suites for campaign primitives, entry route, lead binding, result authorization, activation route/service, offer UI, middleware, analytics, Customer.io, Meta, operator command, and schema assertions.
- Applied local Supabase migration tests for RLS/grants, wrong-flow rejection, exact campaign/session/lead/user correlation, capacity concurrency, idempotent retry, profile-projection recovery, revocation, and Personal Plan compatibility.
- `npm run typecheck` and focused lint over changed files.
- Repository `ready-check` on the final tree, including `npm run ci:verify` when required by the gate.

### Manual/browser

- Desktop and 375×812 mobile review of the deterministic regular field-test lab: quiz banner, full result/offer, all commercial UI absent, free CTA, loading, error, success, and responsive containment.
- Local end-to-end smoke from a fresh browser context through `/test/quiz/<fixture-token>` → `/quiz` → `/result/<lead>` → free activation → first `/onboarding` state, using only local/test data.
- Negative browser checks for ordinary `/quiz`, ordinary organic result, current Personal Plan field-test lab, invalid token, existing authenticated session, and expired regular test guest.
- Verify the pre-seeded `default_organic` funnel cookie remains unchanged from `/test/quiz/<token>` through lead capture.
- Verify the runtime flag can disable every regular-field-test entry/binding/result/activation branch while ordinary `/quiz` and the ordinary organic offer remain unchanged.

### Migration/live-state boundary

- Review migration and local application only. Do not apply to the linked production Supabase project.
- Do not run the campaign command with `--apply`, issue a production link, deploy, or activate production access without separate authorization.

## Review and handoff

- Branch/worktree: `codex/regular-quiz-field-test` in `.worktrees/regular-quiz-field-test`.
- Planning evidence review: confirmed 2026-08-11.
- User-journey sign-off: confirmed 2026-08-11.
- Counterpart plan review: completed with revisions on 2026-08-11; verified findings are recorded below and incorporated.
- Implementation uses `implementation-loop`, then `ready-check` and `request-code-review` on one final fingerprint.
- Whole-branch Claude review is required before any push; reviewer output remains transient outside the repository.
- Durable artifacts: this plan and rendered mockup are **commit** candidates. Counterpart review output is **discard** unless a durable finding is intentionally incorporated into this plan.
- Stop point: verified review-ready worktree. No commit, push, PR, merge, deploy, migration application, campaign creation, link issuance, or production activation without separate authorization.

### Residual risks to verify during implementation

- The historical campaign table name remains Personal Plan-specific even after flow scoping; this is accepted compatibility debt for the bounded slice.
- The current regular offer contains commercial language outside its pricing slot; every purchase/guarantee/CTA occurrence must be covered by field-test component tests rather than assuming pricing replacement is sufficient.
- Profile projection is intentionally a retryable post-transaction step because the canonical mapping lives in TypeScript; the route must not report success until it completes.
- The organic offer is a shared cold-traffic surface. Keep regular-field-test branches narrow and flag-gated, and resolve overlapping task branches against the final current tree before publication.

### Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | tradeoff | Regular field testing branches through shared `/api/quiz/lead` and `organic-plan-offer.tsx`; campaign revocation cannot disable a code regression globally. | accepted | Added `REGULAR_QUIZ_FIELD_TEST_ENABLED` as a global rollback gate across entry, binding, result authorization, and activation. | Flag-off ordinary-flow tests and browser checks. |
| C2 | defect | Personal Plan authorization, bind, and activation functions hard-code `meta_personal_plan_v1`, `personal_plan`, and prepared artifacts. | accepted | Tasks now require new regular wrappers/RPCs modeled on, not calls to, those Personal Plan functions. | Wrong-package, wrong-kind, wrong-flow, and no-artifact database/service tests. |
| C3 | defect | `linkQuizToProfile` returns `void` on success and non-error skips. | accepted | Completion wording now requires no projection error plus browser evidence that the resulting profile reaches onboarding; retry re-runs the same-owner path. | Activation retry tests and onboarding browser smoke. |
| C4 | tradeoff | Shared-core extraction versus in-place parameterization remained implicit. | accepted | Chose in-place parameterization with narrow regular wrappers to avoid speculative abstraction. | Full-diff review for duplication and Personal Plan compatibility. |
| C5 | defect | Ordinary lead requests should not incur field-test DB lookup. | accepted | Added cheap distinct-cookie presence and flag gates before campaign resolution. | Ordinary hot-path dependency-call assertions. |
| C6 | scope/product decision | A generic new operator command alias was not necessary for the requested outcome. | accepted | Removed the alias; extend only the current guarded command with explicit flow. | Operator parse/dry-run compatibility tests. |
