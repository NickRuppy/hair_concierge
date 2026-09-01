# Creator journey consistency

## Outcome

Make the creator journey feel like the regular Chaarlie journey with only the smallest necessary creator-specific differences: the known identity is reused, activation is one deliberate action, lifecycle copy matches reality, and admins can see when an account has already been claimed.

Regular users keep the current journey unchanged. Creator behavior must be implemented as explicit, server-verified overrides on shared journey components rather than as a separate funnel.

## Source context

- A production creator test showed that an already identified creator is asked for their name and email again at the end of the quiz.
- A read-only journey review found related creator-only inconsistencies in offer activation, account-ready email copy, and the admin invitation status.
- Existing partner-access security and commercial rules remain authoritative: a deliberate claim action prevents link previews from creating accounts; access is indefinite until revoked; creator traffic stays noncommercial; the invitation email must match the resulting account.
- Base revision: `origin/main` at `85972a91`.

## Chosen direction

Use the regular journey as the canonical implementation. Resolve a narrow creator context from the authenticated session and claimed invitation, then supply that context to the shared quiz, offer, and admin surfaces.

The creator context may change only these behaviors:

1. Reuse the verified creator name and email and skip the duplicate quiz identity screens.
2. Turn either creator offer CTA into the same direct, idempotent activation action.
3. Use creator-specific lifecycle copy that describes the actual account/access state.
4. Show a distinct admin status once an invitation has been claimed but access is not yet active.

No URL parameter or client-provided identity is trusted as creator authority.

## Scope

### In scope

- Extend the server-authoritative partner journey resolver to expose the invitation display name when the authenticated user and claimed invitation match.
- Provide a read-only creator quiz context endpoint following the existing `migration-quiz-context` server-boundary and parser pattern.
- In the shared quiz lead-capture UI, initialize the lead with the verified creator identity and move creators directly from the final quiz question to marketing consent.
- Ensure creator back-navigation from consent returns to the final real quiz question, not to hidden name or email steps.
- Provide a short retry state if creator context cannot be verified; do not silently fall back to editable blank identity fields for an authenticated creator journey.
- Extract one reusable creator activation action and use it from the sticky offer CTA, creator activation card, and bottom offer CTA.
- Align creator offer copy around one outcome: `Meinen Plan öffnen`.
- Add a claimed-but-not-active admin status labelled `Konto erstellt`.
- Update the production Customer.io account/access message at the deployment/configuration gate so it says the access is active instead of implying that the account has only just been created.
- Add regression coverage for both creator overrides and the unchanged regular journey.

### Out of scope

- Redesigning or changing the regular quiz name, email, consent, offer, or checkout journey.
- Changing quiz questions, recommendations, pricing, payment, access duration, revocation, analytics attribution, or link-claim security.
- Creating a separate creator quiz or offer implementation.
- Changing database schema unless implementation evidence proves the existing `claimed_at`, `claimed_user_id`, and activation fields cannot express the required states.
- Deploying or changing Customer.io production configuration as part of the code implementation without separate authorization.

## Target map

| Area | Expected target | Intended change |
| --- | --- | --- |
| Creator authority | `src/lib/partner-access/journey.ts` | Return verified creator display identity alongside the existing journey state. |
| Quiz context boundary | New partner endpoint/parser modelled on `src/app/api/personal-plan/migration-quiz-context/route.ts` and `src/lib/quiz/migration-prefill-init.ts` | Expose only the authenticated, claimed invitation identity needed by the quiz. |
| Shared quiz | `src/components/quiz/quiz-lead-capture.tsx`, with the minimum store state needed to share the resolved mode | At lead-capture mount, use authenticated partner metadata only as a fetch hint; let the server validate and apply creator identity. |
| Quiz navigation | `src/components/quiz/quiz-lead-capture.tsx`, `src/components/quiz/quiz-browser-history.tsx`, and `src/lib/quiz/browser-history.ts` | Use a creator screen-order variant without name/email positions and make both back paths skip hidden screens. |
| Offer activation | `src/components/partner-access/**`, `src/components/organic-plan-offer/organic-plan-offer.tsx` | Share one direct creator activation action between sticky CTA and card; keep regular CTA behavior unchanged. |
| Admin status | `src/lib/partner-access/service.ts`, `src/app/admin/partner-access/page.tsx` | Reuse/consolidate the existing pending/claimed/active projection and display claimed-but-not-active state. |
| Lifecycle email | Customer.io transactional message 14 | Replace account-created wording with access-active wording at the production configuration gate. |
| Regression coverage | Existing partner access, quiz, offer, and admin tests | Assert creator deltas and ordinary-user invariants. |

Exact file boundaries may be narrowed during implementation; new abstractions are justified only when they prevent the creator logic from being duplicated.

## Designed user journey

### Entry and identity

1. Nick sends the personal creator link.
2. The creator opens it. Link previews may fetch the page but cannot claim the invitation.
3. The page shows the intended email and the deliberate account-creation disclaimer.
4. The creator confirms the link. The server atomically claims the invitation for that email, creates or reuses the account, signs the creator in, and starts the shared quiz.
5. If the link belongs to another email, the existing `Nicht meine E-Mail` recovery remains available before the claim.

### Quiz completion

1. The creator completes the same quiz questions as a regular user.
2. After the final real question, the server-verified creator name and email are used automatically.
3. The creator sees the existing marketing-consent decision directly; no name or email re-entry is shown.
4. Going back returns to the final quiz question.
5. If creator context cannot be verified, the creator sees a concise retry/recovery state and is not invited to create an inconsistent second identity.

Regular users continue to see the current name, email, and consent sequence exactly as today.

### Offer and activation

1. The creator sees the same analysis and offer content as a regular user.
2. The creator sticky and bottom offer CTAs read `Meinen Plan öffnen` and directly perform the same activation action as the creator card.
3. The creator card says `Dein Zugang ist bereit.` and `Öffne jetzt deinen persönlichen Plan und deine Routine.` Its CTA also reads `Meinen Plan öffnen`.
4. The first successful click activates the invitation and navigates to `/plan-bereit?lead=…`; repeated or concurrent clicks remain safe.
5. A failed activation leaves the creator on the offer, shows a concise retry message, and never creates a partial paid state.

Regular offer and checkout CTAs keep their existing labels and behavior.

### Return and administration

1. After activation, the creator can sign in with the invitation email and use Chaarlie like a regular entitled user until manually revoked.
2. The lifecycle email says `Dein Chaarlie Zugang ist aktiv` and links back to Chaarlie; it does not claim that a just-created account is now ready.
3. Admin shows `Konto erstellt` after claim and before activation, `Aktiv` after activation, and the existing revoked status after revocation.

## Planning evidence

- Review board: [`plans/mockups/2026-09-01-partner-journey-consistency.html`](mockups/2026-09-01-partner-journey-consistency.html)
- Shows current and proposed creator behavior for known identity, activation, lifecycle email, and admin status.
- Explicitly records the architecture rule that the creator journey inherits the shared base and supplies only verified overrides.
- Evidence review: confirmed by Nick on 2026-09-01.

## Implementation tasks

### 1. Lock the server-authoritative creator context

- Add failing tests for accepted and rejected creator-context lookups: matching claimed invitation, wrong user, wrong funnel, revoked access, and ordinary authenticated user.
- Extend the partner journey resolver and expose the smallest safe read-only boundary needed by the quiz, reusing the response/parser structure of the migration quiz context rather than creating a new client trust model.
- Return only normalized display name, email, invitation identifier/state, and the context discriminator needed by the UI.
- Trigger the lookup only when `QuizLeadCapture` mounts and either `AuthProvider` has resolved a user whose client-visible `app_metadata.partner_access_invitation_id` is a string or the server-issued claim destination contains the non-authoritative `partner=1` entry marker. The marker covers an existing account whose current session token has not yet refreshed after metadata is added. Treat both signals only as request-saving hints; the endpoint must still validate the authenticated user, signed HTTP-only partner intent, funnel session, invitation token/version, exact email, claim owner, and revocation state through `resolvePartnerJourney`.
- Ordinary anonymous or authenticated users without that metadata do not make the creator-context request and immediately use the regular lead-capture path.
- A hinted creator remains in a short loading state until the lookup resolves. A network or `unavailable` result shows retry/recovery; it must not fall through to editable regular identity fields. A server-confirmed `none` result clears creator mode and uses the regular flow.
- Acceptance: client input cannot substitute a different name/email or manufacture creator mode.

### 2. Remove duplicate creator identity collection

- Add failing UI/state tests proving that verified creators skip name and email while ordinary users retain both screens.
- Initialize the existing lead flow with the verified creator identity and submit through the existing lead boundary so downstream analytics and recommendations keep their current contract.
- Preserve consent as an explicit decision.
- Add a creator lead-capture mode to the minimum shared state needed by the history provider. Extend `getLegacyQuizScreenPosition` with an explicit screen-order variant in which step 9 contains only `consent`; the regular order remains name/email/consent.
- When verified context resolves, set creator mode, identity, and `consent` together. The preceding final-question-to-step-9 transition owns the single browser-history entry; resolving creator mode must not push extra hidden positions.
- Make both the custom lead-capture back handler and provider fallback route creator consent directly to the final real quiz question. Add browser/system Back, visible Back, and ordinary-flow regression tests plus a retry/recovery test.
- Acceptance: creator reaches consent directly after the final question; ordinary journey snapshots and behavior remain unchanged.

### 3. Make creator activation one action

- Add failing tests for all three creator CTAs, success navigation, in-flight disabling, failure retry, and idempotent replay.
- Extract one client activation action/component and use it from all creator CTA locations. This intentionally converts the current server-rendered sticky and bottom anchors from scroll-only behavior into activating client controls for creator offers.
- Keep the regular offer CTA branch untouched.
- Apply the approved concise creator copy and remove price-focused creator messaging.
- Acceptance: either creator CTA has the same one-click effect; no scroll-to-another-CTA step remains.

### 4. Represent the real admin lifecycle

- Add failing service/UI tests for `invited`, `claimed`, `active`, and `revoked` derivation.
- Consolidate status derivation with the existing `projectPartnerInvitation` pending/claimed/active semantics instead of creating another state model. Extend the admin list status with `claimed`, derived from existing claim data when activation has not occurred, and render it as `Konto erstellt`; revoked must win over claimed and active.
- Acceptance: admin can distinguish account creation from an untouched invitation without a migration.

### 5. Verify the complete shared-base story

- Run focused unit/component tests and the repository-required checks.
- Exercise the full creator fixture: claim, quiz, consent, offer, activation, plan-ready, return login, admin status, and revocation.
- Exercise the ordinary quiz/offer path beside it and capture evidence that its identity and commercial steps are unchanged.
- Confirm analytics remain noncommercial for creator access and that no paid checkout path is introduced.
- Use `implementation-loop`, including its `ready-check` and final `request-code-review` gates, before any ship request.

### 6. Production configuration handoff

- After code deployment is separately authorized, update Customer.io transactional message 14:
  - Subject: `Dein Chaarlie Zugang ist aktiv`
  - Body: `Hi {{first_name}}, dein persönlicher Plan ist jetzt mit deinem Chaarlie Konto verbunden. Du kannst jederzeit zurückkehren.`
  - CTA: `Zu Chaarlie`
- Send a production-safe test to an owned address and verify the login link before calling the configuration complete.

## Verification matrix

| Scenario | Expected result |
| --- | --- |
| Ordinary anonymous quiz | Existing name, email, consent, offer, and checkout behavior is unchanged. |
| Verified claimed creator | Name/email are reused; creator goes from final question to consent. |
| Creator presses back from consent | Final real quiz question appears; hidden identity steps do not. |
| Creator context lookup fails | Concise retry/recovery state; no editable fallback identity. |
| Creator presses either offer CTA | One activation request; success opens the plan-ready route. |
| Activation is retried/replayed | Idempotent success or safe retry; no duplicate entitlement/event. |
| Claimed but inactive invitation | Admin shows `Konto erstellt`. |
| Active/revoked invitation | Existing active/revoked semantics remain correct. |
| Link preview | Cannot claim/create an account without the deliberate creator action. |
| Customer.io message | Copy describes active access and login link works for the intended account. |

## Risks and controls

- **Creator/base drift:** keep creator behavior as an explicit policy/context passed into shared components; prohibit a parallel creator funnel; enforce ordinary-path regression tests.
- **Client identity spoofing:** derive creator identity on the server from authenticated user plus claimed invitation; never trust URL/local state as authority.
- **History regressions:** test creator and ordinary back-navigation separately before touching shared history helpers.
- **Duplicate activation:** centralize the action, disable in flight, and retain server idempotency/replay semantics.
- **Misleading lifecycle messaging:** map each surface to the actual claim/activation state and verify the production template separately.

## Resolved implementation tradeoffs

- **Sticky CTA:** direct activation is intentional. It removes the redundant scroll-and-click step for a busy creator, even though it requires a small client boundary inside the mixed server/client offer surface.
- **Price message:** remove `Für dich kostenlos` from the creator activation card. The invitation and access behavior already establish the noncommercial contract; creator-facing copy should focus on opening the product, not on price.
- **Kill-switch:** do not add a new feature flag. The override is server-authorized, fails closed for a hinted creator when verification is unavailable, and is protected by ordinary-path regression tests. A flag would be speculative infrastructure for this bounded change.

## Review and handoff

- Self-review: complete; confirmed shared-base scope, server authority, regular-path invariants, and separate production gates.
- Claude plan review: complete with revisions; corrected the navigation target map, specified the metadata-hinted context lookup and failure behavior, specified the creator screen-order/history mechanism, reused existing context/status patterns, and recorded the three owner tradeoffs.
- Designed-journey sign-off: confirmed by Nick on 2026-09-01.
- Implementation authorized on 2026-09-01.
- Shipping, merging, deployment, and production Customer.io changes remain separate authorization gates.
