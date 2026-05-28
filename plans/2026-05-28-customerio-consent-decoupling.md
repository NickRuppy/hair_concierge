# Customer.io Consent Decoupling Plan

Spec source: user decision on 2026-05-28: Customer.io should always receive quiz lead/profile tracking; the final quiz consent controls email marketing eligibility, not whether Customer.io receives operational analytics/profile data.

## User Situation

Production Customer.io quiz sync now works, but the implementation still skips Customer.io entirely when the user clicks "Nein, nur meinen Plan schicken" on the final quiz consent sheet. That is too broad. The sheet asks for permission to send later email tips/offers, while Customer.io is also the operational lifecycle destination for lead traits, segmentation, transactional flows, and internal analytics.

## Promised End State

Every successful `/api/quiz/lead` submission sends Customer.io an identify call with quiz traits and a `quiz_profile_submitted` event. The submitted choice is preserved as `marketing_consent: true | false`. Customer.io campaigns and email sends must filter on `marketing_consent = true`; Customer.io ingestion itself is not gated by that quiz email-consent choice.

## Target File Map

- `src/lib/customerio/quiz-traits.ts`
  - Remove the early return for `marketingConsent === false`.
  - Always build full structured quiz traits.
  - Keep `marketing_consent` equal to the submitted value.
  - Only set `consent_timestamp` when `marketingConsent === true`, or rename/add an explicit `lead_submitted_at` if we need a timestamp for both cases.

- `src/lib/customerio/quiz-sync.ts`
  - Keep the same API and best-effort behavior.
  - The `shouldIdentify` / `shouldTrackProfileSubmitted` flags can either be removed or become always true for valid quiz lead syncs.

- `src/app/api/quiz/lead/route.ts`
  - No behavioral change expected. It already calls `syncQuizLeadToCustomerIo(...)` for both new and deduped leads.
  - Confirm deduped leads with changed `marketing_consent` update Supabase first and then send the latest value to Customer.io.

- `docs/customerio-data-contract.md`
  - Replace the old "skip when marketing_consent false" rule.
  - State that Customer.io always receives quiz lead traits/events after successful lead capture.
  - State that `marketing_consent` is the campaign/send gate.

- `docs/superpowers/specs/2026-05-28-customerio-server-sync-design.md`
  - Update decisions and verification bullets to match the new consent model.
  - Keep the architecture unchanged: server-side Customer.io sync remains best-effort and downstream-only.

- `tests/customerio-quiz-traits.test.ts`
  - Replace "skips Customer.io quiz lead sync when consent is false" with a test proving false-consent leads still produce full traits/event payloads.
  - Assert `marketing_consent === false`.
  - Assert no raw free text is sent.
  - Assert `shouldIdentify` and `shouldTrackProfileSubmitted` are true, or remove those flag assertions if the flags are deleted.

- `tests/customerio-quiz-sync.test.ts`
  - Replace "skips Customer.io entirely when marketing consent is false" with a test proving two calls happen:
    - `/identify`
    - `/track`
  - Assert the identify body includes `marketing_consent: false`.
  - Assert the track body includes `marketing_consent: false` and event `quiz_profile_submitted`.

## Scope Boundaries

In scope:

- Decouple Customer.io ingestion from final quiz email-marketing consent.
- Preserve `marketing_consent` accurately for both yes/no choices.
- Update docs/tests so campaign builders know to filter sends on `marketing_consent = true`.
- Keep Customer.io failures best-effort and non-blocking.

Out of scope:

- Changing cookie-banner analytics behavior.
- Changing PostHog or Meta routing.
- Building a subscription center.
- Changing Customer.io campaign definitions directly.
- Backfilling earlier `marketing_consent = false` quiz leads.
- Legal copy rewrite, unless implementation discovers copy that explicitly says Customer.io is skipped.

## Implementation Tasks

- [x] Update `buildCustomerIoQuizLeadSync` so it always canonicalizes quiz answers and always returns a full identify/event sync object.
- [x] Preserve `marketing_consent` as the submitted boolean in both identify traits and `quiz_profile_submitted` properties.
- [x] Decide timestamp naming while editing:
  - Preferred small version: keep `consent_timestamp` only for true consent and keep `quiz_completed_at` for both true/false.
  - Avoid setting `consent_timestamp` when the user declined, because that name would imply consent was granted.
- [x] Keep `shouldIdentify` / `shouldTrackProfileSubmitted` as always-true compatibility flags for valid quiz lead syncs.
- [x] Update quiz Customer.io unit tests to prove false-consent leads still call Customer.io.
- [x] Update Customer.io docs/spec text so the contract says:
  - Customer.io receives all successful quiz leads.
  - `marketing_consent = true` is required for marketing/lifecycle email campaign sends.
  - Transactional/requested messages are a separate legal/product path.
- [x] Run focused verification.

## Verification

Automated:

```bash
npx tsx --test tests/customerio-quiz-traits.test.ts tests/customerio-quiz-sync.test.ts tests/customerio-server.test.ts
npm run typecheck
npm run lint
git diff --check
```

Manual production/preview smoke after deploy:

1. Submit a quiz with the positive consent button.
2. Confirm Customer.io People contains the email, rich quiz traits, `marketing_consent: true`, and `quiz_profile_submitted`.
3. Submit a quiz with "Nein, nur meinen Plan schicken".
4. Confirm Customer.io People contains the email, rich quiz traits, `marketing_consent: false`, and `quiz_profile_submitted`.
5. Confirm no campaign is configured to send on `quiz_profile_submitted` alone; campaign entry criteria must include `marketing_consent = true`.

## Expected Review Focus

- No accidental reintroduction of direct `_cio` calls.
- No change to Supabase lead persistence semantics.
- No sending of raw `concerns_other_text`.
- No `is_customer: false` trait from quiz sync.
- No Customer.io failure blocking `/api/quiz/lead`.
