# Legacy quiz email deliverability

## Outcome and source context

Extend the merged Personal Plan email-deliverability behavior from PR #305 to the separate live `/quiz` lead journey without changing its name, consent, analysis, or result flow. The production merge `034b567f` is deployed successfully; this follow-up starts from that exact `origin/main` state.

Planning contract:

- Outcome: the legacy quiz prevents definitive undeliverable addresses from being persisted and gives users a visible, editable recovery path.
- Constraints: one shared three-second DNS deadline, fail-open on resolver uncertainty, no dropped legitimate leads, privacy-safe telemetry, German UI, no second validation endpoint, and no dedicated runtime flag.
- Non-goals: disposable-email blocking, fuzzy/TLD-wide correction, provider-prefix completions, changes to quiz questions/results, production Sentry alert mutation, migrations, or deployment.
- Done when: the rendered recovery mockup and journey are confirmed, the plan passes read-only counterpart review, and implementation has checkable server, client, analytics, and mobile-browser acceptance criteria.

## Chosen direction

Reuse the merged shared deliverability rules in the existing final `/api/quiz/lead` save request. Keep the live email field non-blocking: a documented provider typo produces a clickable correction before consent, but the user may continue unchanged. After consent, the server checks the normalized address before dedupe or persistence. A definitive failure returns typed `422`; the client returns to the email sub-step, focuses and describes the invalid field, shows the shared German error plus any correction, and requires consent again after correction. Timeout or unexpected resolver failure accepts fail-open within one total three-second deadline.

Extract the Sentry metric helper from the Personal Plan route into a shared server-only module and add a bounded `journey` dimension (`personal_plan` or `legacy`). The legacy client emits the already-defined PostHog rejection event; PostHog's existing `$current_url` distinguishes `/quiz` from `/lp/haarplan`, so the event contract does not gain a redundant journey field. No email, local part, domain, name, answer, or lead ID enters either deliverability signal.

The main funnel uses the previously chosen deployment-revert rollback rather than a dedicated kill switch. Rollout is not suggestion-only: the suggestion and authoritative gate ship together, with the existing `quiz_completed → quiz_lead_captured` ratio on `/quiz` recorded before deployment and compared after deployment. A material lead-conversion regression stops/rolls back the release; expected-address rejections are separately visible through the Sentry metric.

## Scope and non-goals

In scope:

- live provider-typo suggestion in the legacy email sub-step
- authoritative deliverability check before legacy dedupe/persistence
- typed `422` recovery to the email sub-step
- focused field, `aria-invalid`, associated alert copy, correction action, and stale-state clearing
- existing PostHog rejection event emitted from the legacy client and shared Sentry outcomes with bounded journey attribution
- deterministic route/DNS/analytics tests and narrow-mobile browser coverage
- correction of every legacy persistence fixture using reserved `.test`/`.local` domains

Non-goals:

- a standalone validation endpoint or earlier DNS request
- blocking a syntactically valid address solely because it resembles a provider
- disposable-email detection
- changes to name collection, consent copy, quiz answers, analysis, result navigation, Customer.io, Meta, or funnel ownership
- a dedicated feature flag or staged suggestion-only release
- production alert creation before a measurable baseline and authenticated Sentry access exist
- migration, merge, or deployment in the planning phase

## Target map

- `src/components/quiz/quiz-lead-capture.tsx` — live suggestion and typed recovery state
- `src/app/api/quiz/lead/route.ts` — handler factory/injection seam and pre-persistence deliverability gate while retaining the exported `POST` and `enqueueMetaLead`
- `src/lib/email-deliverability-observability.ts` — shared server-only Sentry outcome helper with bounded journey
- `src/app/api/quiz/personal-plan-lead/route.ts` — consume the extracted helper without behavior change
- `tests/quiz-lead-deliverability.test.ts` — real legacy handler rejection and accepted-persistence boundary
- `tests/personal-plan-lead-persistence.test.ts` — extracted Sentry helper regression coverage
- `tests/legacy-quiz-email-deliverability.spec.ts` — mobile recovery journey with intercepted lead responses
- `tests/quiz-onboarding-e2e.spec.ts` — replace its reserved `.test` lead domain with a deliverable owned-domain address
- `tests/quiz-result-routing.e2e.spec.ts` — replace its reserved `.test` lead domain
- `tests/auth-intake-routing.e2e.spec.ts` — replace its reserved `.test` lead domain
- `tests/stripe-subscription-e2e.spec.ts` — replace its reserved `.local` lead domain
- `scripts/k6/launch-flow.js` — replace the reserved `.test` write fixture with a deliverable owned-domain address

## Designed user journey

1. A user completes the ten-question legacy quiz, enters their name, and reaches the existing email step.
2. Normal valid addresses look and behave exactly as today.
3. If the completed address matches a documented provider typo, a non-blocking `Meintest du?` correction appears below the field before consent. Clicking it replaces the address; typing manually clears any stale suggestion or error.
4. The user continues to the existing consent card and chooses either consent option.
5. The selected consent action disables while the final lead-save request runs. The server normalizes the email and checks deliverability before dedupe, insert, Customer.io, Meta, or funnel side effects; the DNS work has one total three-second deadline rather than three seconds per lookup.
6. Known-good or DNS-deliverable domains continue into the existing analysis/result journey. Resolver uncertainty or the shared three-second deadline also continues fail-open.
7. A syntactically invalid address remains at the existing client/schema boundary. A definitive `no_mx` or `null_mx` result returns typed `422` without persistence.
8. The client returns to the email step with the field focused, marked invalid, and associated with the visible shared German alert. A server correction appears first when available.
9. Clicking the correction or editing manually clears the error and stale server suggestion. The user continues through consent again, then reaches the existing analysis/result flow after a successful save.
10. The legacy client emits the existing PostHog rejection event with only rejection reason and suggestion presence; `$current_url=/quiz` provides journey context. Sentry records only bounded outcome/reason/suggestion/journey attributes; expected rejections remain metrics rather than issues.

Meaningful variants:

- provider typo with correction: voluntary correction before consent; recoverable correction after definitive rejection
- custom domain with valid MX or implicit A/AAAA: accepted
- NXDOMAIN, null MX, or no MX/A/AAAA: rejected before persistence
- timeout or unexpected resolver error: accepted fail-open within the shared total deadline
- consent save in progress: both consent actions disabled, existing saving copy visible, no duplicate request
- metric delivery failure: conversion continues unchanged

## Mockup evidence

- Current live surface inspected at `https://chaarlie.de/quiz` on 2026-08-02 at 390×844.
- Proposed rendered prototype: `plans/mockups/legacy-quiz-email-deliverability-recovery.html`
- Selected direction: retain the existing layout and add only the contextual suggestion and definitive-rejection recovery states.
- Mockup review: confirmed by Nick on 2026-08-02; the three states and existing-flow fit are approved.
- User-journey sign-off: confirmed by Nick on 2026-08-02; no further product decision is required.

## Ordered tasks

1. Add failing server behavior tests and an explicit `createQuizLeadPostHandler(overrides)` seam mirroring the Personal Plan handler factory.
   - Complete when tests execute the real legacy handler through injected rate-limit, deliverability, request-context, and admin-client dependencies; the module-level `POST` still uses production defaults; and the existing exported `enqueueMetaLead` contract remains intact.
   - The accepted-path test must stop deliberately at the injected Supabase boundary before `after()`, Customer.io, Meta, or funnel side effects can run.
2. Extract the privacy-safe Sentry metric helper and add the bounded journey attribute without changing Personal Plan behavior.
   - Complete when both journeys emit exact bounded attribute objects and an unavailable/throwing metrics surface cannot change the HTTP outcome.
3. Insert the legacy deliverability gate immediately after schema parsing/normalization and before any Supabase lookup.
   - Complete when definitive failures return the shared typed `422`, successful normalization is the value persisted/forwarded, and resolver uncertainty stays fail-open.
4. Add the pre-consent suggestion and post-consent recovery states to `QuizLeadCapture`.
   - Complete when correction click/manual edit clears stale state, the existing keyed remount is verified to restore focus (or a ref is added only if necessary), `aria-invalid`/`aria-describedby` are correct, both consent actions are disabled while saving, and consent remains an explicit repeated choice after recovery.
   - Emit the existing `quiz_email_deliverability_rejected` event on typed `422`; exact payload assertions must prove it contains no email/domain/name/answers/lead ID.
5. Replace every reserved-domain fixture that reaches legacy persistence before enabling the gate.
   - Complete when all four legacy E2E specs and `scripts/k6/launch-flow.js` use unique tagged addresses at the owned `chaarlie.de` domain, so the E2E and opt-in write load profile still reach persistence without creating fabricated Gmail recipients.
6. Add the real narrow-mobile recovery journey with seeded draft state and intercepted APIs.
   - Complete when an `@ci`-tagged 390×844 spec seeds `chaarlie:quiz-draft:v1`, clicks `Weitermachen`, enters a name, and proves the suggestion, disabled saving state, typed-`422` focus/alert association, correction/manual recovery, repeated consent, successful continuation, and no live persistence.
7. Run implementation-loop verification and the standard exact-head review, then publish only when separately authorized.
   - Complete when build/typecheck/lint/format, focused and repository tests, browser checks, and the implementation-loop review receipt are recorded.

## Verification

Automated:

- focused deliverability, legacy route, Personal Plan metric, analytics, and quiz-entry Node tests
- `npm run test:node`
- `npm run test:playwright:contracts`
- `npx playwright test tests/legacy-quiz-email-deliverability.spec.ts --project=chromium` (explicit coverage; the contract script does not list this spec)
- `npm run typecheck`
- changed-source ESLint and changed-file Prettier
- `npm run build`
- `git diff --check`

Manual/browser:

- 390×844: normal field, pre-consent typo suggestion, post-`422` focus/error/correction, manual edit, repeated consent, success continuation
- 390×844: consent saving state keeps both actions disabled and does not duplicate the final request
- verify no duplicate/stale suggestion after manual editing or back navigation
- verify a worst-case DNS stub respects the one total three-second cap; record observed browser-request duration without making wall-clock timing the primary correctness oracle
- physical soft-keyboard behavior remains a device-level residual risk

Live/operational:

- no production write during planning or browser verification
- before a separately authorized deployment, record the recent `/quiz` PostHog ratio `quiz_lead_captured / quiz_completed`; after deployment, compare the same route-filtered ratio over a comparable sample/window and roll back on a material unexplained regression
- after deployment, verify the exact release SHA and collect a small Sentry metric baseline before choosing an alert threshold

Evidence-sensitive review:

- structural lens for the shared metric extraction and legacy route seam
- normal correctness/privacy review on the exact implementation fingerprint
- one read-only Claude counterpart review at Opus/high effort

## Counterpart findings ledger

| ID  | Type        | Evidence                                                                                                | Decision              | Plan change                                                                                                                | Revalidation                                |
| --- | ----------- | ------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| C1  | Blocker     | Five legacy E2E/k6 write fixtures use reserved `.test`/`.local` domains that return `no_mx`             | Accept                | Added every affected fixture to target map/task 5 and require unique owned-domain addresses                                | Focused E2E plus opt-in k6 check contract   |
| C2  | Blocker     | `test:playwright:contracts` is an explicit list and would skip the new spec; CI filters `@ci`           | Accept                | Added explicit Playwright command and `@ci` acceptance criterion                                                           | Run explicit spec and inspect CI invocation |
| C3  | Blocker     | Legacy route has no injection seam although task 1 depended on one                                      | Accept                | Made `createQuizLeadPostHandler(overrides)` a deliverable and preserved `POST`/`enqueueMetaLead` exports                   | Route tests, typecheck, Meta tests          |
| C4  | Correctness | Schema rejects invalid syntax before deliverability, so `format` cannot be typed `422`                  | Accept                | Limited server rejection journey to `no_mx`/`null_mx`                                                                      | Route contract tests                        |
| C5  | Scope       | PostHog already supplies `$current_url`; adding `journey` changes five files                            | Accept                | Kept existing event contract; added journey only to shared Sentry helper                                                   | Exact analytics payload test                |
| C6  | Rollout     | Main funnel has no flag and needs conversion review                                                     | Prior owner decisions | Record revert-only rollback; ship suggestion+gate together; compare existing `/quiz` completion-to-lead ratio before/after | Operational receipt                         |
| C7  | UX          | Consent waiting state was absent from the mockup                                                        | Accept                | Added third rendered state with existing saving behavior and a single three-second deadline note                           | Mockup/journey sign-off                     |
| C8  | Scope       | Personal Plan also has provider-prefix completion                                                       | Reject                | Intentional narrower scope: correction only; no new provider autocomplete behavior                                         | Mockup and client tests                     |
| C9  | Blocker     | Initial fixture migration missed three E2Es and pointed synthetic writes at fabricated Gmail recipients | Accept                | Migrated all persistence fixtures to unique `info+…@chaarlie.de` addresses                                                 | Search every legacy email-field E2E         |
| C10 | Coverage    | Route tests did not explicitly prove the high-stakes `fail_open` outcome reaches persistence            | Accept                | Changed the accepted-path test to inject and assert a normalized `fail_open` outcome                                       | Focused Node test                           |
| C11 | Operations  | Owned-domain E2Es could send result-artifact messages to the shared info inbox                          | Accept                | Intercept only `/api/quiz/result-artifact` while retaining real lead persistence                                           | Typecheck, lint, affected diff review       |

## Review and handoff

- Branch: `codex/legacy-quiz-email-deliverability`
- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/legacy-quiz-email-deliverability`
- Durable artifacts to commit: this plan and the rendered HTML mockup
- Transient screenshots/reviewer output: discard or retain outside the repository as explicitly recorded
- Counterpart plan review: Opus/high completed 2026-08-02; valid findings C1–C7 incorporated, C8 intentionally rejected as out of scope
- Counterpart code review: Opus/high completed 2026-08-02; fixture/coverage findings C9–C10 incorporated and affected checks rerun
- GitHub review: result-email side-effect finding C11 incorporated before merge
- Mockup review: confirmed 2026-08-02
- User-journey sign-off: confirmed 2026-08-02
- Implementation gate: satisfied; execute through `implementation-loop`
- Publication, merge, deployment, and production Sentry alert mutation: not authorized by planning alone
