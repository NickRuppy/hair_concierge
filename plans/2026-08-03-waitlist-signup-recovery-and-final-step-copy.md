# Waitlist signup recovery and final-step copy

## Outcome

Valid waitlist signups persist atomically, queue Customer.io delivery, and return a survey token. The survey and thank-you pages use the agreed 67%/95% journey in which WhatsApp is the final visible step.

## Planning evidence

- Product source of truth: Nick's August 3 feedback specifying the target survey and thank-you states.
- Reviewed reference: PR #314 for the German copy, progress treatment, hierarchy, and WhatsApp glyph.
- Technical source of truth: merged PR #317 on current `main` for Supabase persistence, opaque survey tokens, Customer.io outbox delivery, PostHog tracking, QR asset, and failure recovery.
- Nick confirmed that the briefing is authoritative, reviewed the before/after copy mapping, and explicitly authorized implementation.

## Designed user journey

1. A valid signup is saved together with one pending Customer.io outbox row and returns a survey token.
2. The browser redirects to `/warteliste/umfrage`, showing `Fast geschafft`, 67%, and the reviewed survey framing.
3. While Typeform is healthy, there is no skip action. Technical load or association failures retain retry and continue recovery because the signup is already stored.
4. Survey completion redirects to `/warteliste/danke`, showing `Letzter Schritt`, 95%, and WhatsApp as the only interactive next action.
5. Customer.io dispatch, token association, PostHog tracking, email fallback copy, and the existing static QR asset remain intact.

## Implementation

1. Add a forward-only migration that replaces `create_waitlist_signup` and targets the named outbox uniqueness constraint.
2. Add a pgTAP regression that executes a new and duplicate signup and proves one signup plus one outbox row.
3. Log persistence error messages after redacting request PII; keep the public response unchanged.
4. Add the waitlist progress component and apply the briefing-led survey and thank-you states.
5. Remove the healthy-state survey skip while keeping technical recovery paths.

## Verification

- Focused waitlist API, backend, UI, analytics, and pgTAP/static migration tests.
- Typecheck, lint, production build, and repository readiness checks.
- Mobile and desktop rendered checks for `/warteliste/umfrage` and `/warteliste/danke`.
- After separate production-write authorization: apply the migration, run a controlled owned-inbox signup, and verify Supabase, Customer.io, Automation 6, and email delivery.

## Stop boundary

Prepare a verified local branch only. Do not push, merge, deploy, apply the production migration, or create a production signup without later authorization.
