# Waitlist email survey access

## Outcome and source context

PR #334 redirects successful `/warteliste` and `/warteliste/b` signups directly to
`/warteliste/danke`. Review thread `PRRT_kwDOROlljc6W9tjT` correctly identified that the
welcome-email survey link currently opens without the opaque token required to associate the
Typeform response. The live Customer.io configuration is campaign 6, action 114, template 77.

Outcome: keep the direct thank-you redirect while making the optional survey link in the welcome
email complete successfully in a new tab or device.

## Chosen direction

Use the existing 256-bit random survey token hash already stored in Supabase as a distinct
email-only bearer capability:

1. Add a `survey_url` property only to the `waitlist_signup` Customer.io event. Build the absolute
   URL from the repository's existing `SITE_ORIGIN` (`https://chaarlie.de`). Because the outbox can
   reload the stored hash, a manual retry retains the working link without plaintext persistence.
2. Point that URL at an exact public server exchange endpoint. The endpoint accepts the opaque
   hash, applies the existing rate-limit pattern, sets it in a narrow seven-day HttpOnly, Secure,
   SameSite=Lax cookie, and redirects to the clean `/warteliste/umfrage` URL with
   `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
3. Let `POST /api/waitlist/survey` use either the existing body token (same-tab/manual flow) or the
   HttpOnly hash cookie (email flow), and clear the cookie after successful completion. The strict
   request schema makes `opaqueToken` optional and the handler rejects only when neither source is
   present.
4. Update live Customer.io template 77 so its existing survey link uses `{{event.survey_url}}` with
   the current plain URL as a fallback for older events.

This avoids a database migration, a new signing secret, and weakening the survey RPC to accept a
signup UUID. It keeps the bearer capability out of the rendered survey page and third-party
tracking URL. The capability is deliberately reusable until the survey is recorded because survey
completion grants no access, purchase, or entitlement; the RPC still prevents replacing a recorded
response with a different response ID.

## Scope and non-goals

In scope:

- preserve the two direct redirects already committed in PR #334;
- load the existing random token hash through the outbox and place its exchange URL only on the
  signup event;
- add the token-to-cookie exchange and cookie fallback at survey completion;
- update Customer.io campaign 6/template 77 after guarded backup and dry-run validation;
- add route, API, Customer.io payload, security, and browser regression coverage.

Non-goals:

- no Supabase migration or plaintext-token persistence;
- no survey, thank-you, modal, or email copy/layout changes;
- no new survey CTA on the thank-you page;
- no change to duplicate-signup, Meta Lead, Typeform, WhatsApp, or campaign-trigger behavior;
- no retroactive repair for welcome emails already sent without a credential.

## Target map

- `src/lib/waitlist/customerio-outbox.ts` and `src/lib/waitlist/customerio.ts`: carry the optional
  stored hash only into the signup event and build the absolute exchange URL from `SITE_ORIGIN`.
- `src/app/api/waitlist/survey-access/route.ts`: exact public token-to-cookie redirect.
- `src/app/api/waitlist/survey/route.ts`: accept body-token or cookie-token authorization and clear
  the cookie after success.
- `src/components/waitlist/waitlist-survey.tsx`: omit the body token when session storage is empty so
  the HttpOnly-cookie path can complete.
- `src/lib/auth/route-classification.ts`: expose only the exact exchange endpoint.
- Waitlist API/backend/security/browser tests: cover event payload, clean redirect, cookie flags,
  precedence, missing-token rejection, successful clearing, and both direct redirects.
- Customer.io environment 219516, campaign 6, action 114, template 77: change only the existing
  survey href with an `event.survey_url` fallback.

## Designed user journey

1. A new visitor submits either waitlist entry form.
2. Their signup persists, tracking behaves exactly as today, and the browser goes directly to
   `/warteliste/danke`.
3. The welcome email arrives with the same content and visible survey link.
4. Clicking that link in any browser exchanges the email capability server-side and lands on the
   clean `/warteliste/umfrage` URL; the capability is not present in the rendered URL.
5. The visitor completes Typeform. The API associates the response through the HttpOnly cookie,
   clears it, and routes to `/warteliste/danke`.
6. If the email capability is malformed or missing, no signup can be modified; survey saving shows
   the existing recovery state. Existing same-tab session-token completion continues to work.

User-journey sign-off: confirmed by Nick on 2026-08-06 with no corrections.

## Planning evidence

No mockup is required because the visible pages, email copy, controls, layout, and states do not
change. Evidence is the read-only live Customer.io template inspection: its current href is the
plain `https://chaarlie.de/warteliste/umfrage`, while the repository requires a token held only in
`sessionStorage`. Evidence review status: confirmed by repository and live-template inspection;
user journey confirmation is confirmed.

## Ordered tasks

1. **Carry the email capability into Customer.io.**
   - Consumes: the existing `waitlist_signups.survey_token_hash` loaded with the outbox signup.
   - Produces: `waitlist_signup` event property `survey_url` targeting the exchange endpoint.
   - The hash must not become a customer trait, log value, or property on survey-completion events.
   - Completion: unit tests prove the URL exists only for the signup event, uses `SITE_ORIGIN`, and
     remains available when the outbox row is dispatched later.

2. **Exchange the email capability for narrow cookie authorization.**
   - Consumes: a validated 64-character lowercase hexadecimal token hash from the fixed same-origin
     endpoint.
   - Produces: a seven-day HttpOnly/Secure/SameSite=Lax cookie scoped to
     `/api/waitlist/survey`, then a 303 clean redirect with no-store/no-referrer headers.
   - Completion: route tests prove rate limiting, exact redirect target, flags, invalid-input
     refusal, and exact public route classification.

3. **Complete the survey with either existing or email authorization.**
   - Consumes: body token first (hashed server-side), otherwise the narrow cookie hash; Typeform
     response ID unchanged.
   - Produces: the existing token-hash RPC call and a cleared access cookie after success.
   - Completion: API tests cover both authorization paths, body precedence, no-token rejection,
     invalid-token failure, and successful cookie clearing; browser coverage proves the email path.

4. **Update and verify the live welcome-email link.**
   - Consumes: Customer.io event property `event.survey_url`.
   - Produces: template 77 href using the event URL with the current plain route as fallback.
   - Back up the current template outside the repository, validate the update, apply under Nick's
     confirmed production-write authorization, read back the exact template, and send no test
     email to a real customer.
   - Completion: live read-back confirms campaign/action/template identity and the guarded href.

## Verification

Automated:

- focused waitlist API, backend, UI, route-classification, analytics/security tests;
- waitlist B Playwright suite plus an email-link exchange browser scenario;
- typecheck, changed-file lint, `git diff --check`, then repository CI.

Manual/browser:

- mock the signup API for both entry forms and verify direct `/warteliste/danke` navigation;
- open a generated exchange link in a fresh context, verify the address bar is clean, complete a
  mocked survey save through the cookie, and verify cookie clearing;
- verify `/warteliste/umfrage` still loads directly and the existing missing-token recovery remains.

Live state:

- no Supabase schema change; confirm the existing token hash/RPC contract is unchanged;
- read back Customer.io campaign 6/action 114/template 77 after any authorized update;
- after merge/deployment, verify the exchange endpoint headers with a synthetic invalid token only;
  do not create a production signup.

## Review and handoff

- Branch/worktree: `codex/waitlist-direct-thanks` in `.worktrees/waitlist-direct-thanks`.
- Required gates: counterpart plan review, explicit journey sign-off, implementation-loop,
  ready-check, request-code-review, green PR checks, reviewed-head merge guard.
- Rollout ordering: application code may deploy before the template because the template fallback
  preserves the current link. The template must not switch to `event.survey_url` without fallback.
- Artifact disposition: this plan and tests are committed; counterpart reports and Customer.io
  backups are transient outside the repository.
- Customer.io production-write authorization: confirmed by Nick on 2026-08-06.
