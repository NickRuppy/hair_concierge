# Email deliverability integration

## Outcome and source context

Integrate the validated parts of Jonas's GitHub PR #302 onto a fresh `origin/main` branch: prevent known provider-domain typos from reaching the lead pipeline, preserve legitimate/custom domains through RFC-compatible DNS handling, and give users a clear recovery path when the server rejects an undeliverable address.

Source context:

- Jonas PR #302, reviewed heads `ec7da250` and `cc337e4b`
- Codex review: keep the server-side pre-save gate, fail-open behavior, narrow typo map, null-MX handling, A/AAAA fallback, and deterministic tests; exclude disposable-address policy

## Chosen direction

Port the corrected PR behavior onto `codex/email-deliverability-integration`, preserve Jonas's commit authorship where practical, and add the remaining client-state guard so a server suggestion disappears when the user manually edits the address. Keep Jonas's live, non-blocking typo suggestion instead of adding a second decision gate before consent. Keep the UX within the existing email-capture layout.

The authoritative DNS check remains at final lead submission, after the optional-consent screen. This preserves the current single lead-save request and avoids adding a second validation endpoint or an earlier duplicate DNS call. A rejected address therefore returns the user to email and requires them to confirm consent again. On return, focus the email field and associate the inline error with it so the recovery is visible and announced accessibly.

Emit a privacy-safe client event when a `422` is received, containing only the closed failure reason and whether a suggestion was present. Never include the address or custom domain. Rollback is deliberately revert/deployment-rollback based; no second runtime flag is added because the whole route remains behind `PERSONAL_PLAN_QUIZ_V1_ENABLED`, DNS infrastructure failures already fail open, and another product flag would add rollout state for this narrow gate.

## Scope and non-goals

In scope:

- shared explicit provider-typo corrections based on evidenced cases
- server-side MX, null-MX, A/AAAA fallback, timeout, and fail-open handling
- typed `422` handling that returns the user to the editable email step
- accessible return focus and field-associated error semantics
- privacy-safe `422` rejection observability without email/domain data
- deterministic DNS tests without live-network dependency
- rendered mobile verification of error, suggestion, manual edit, and recovery

Non-goals:

- disposable-email blocking
- general fuzzy or TLD-wide correction
- DMARC, SPF, DKIM, Customer.io, or Vercel production changes
- historical lead cleanup
- merge or deployment

## Target map

- `src/lib/email-deliverability-shared.ts` — client-safe typo map and known-good domains
- `src/lib/email-deliverability.ts` — server DNS resolver contract and fail-open logic
- `src/app/api/quiz/personal-plan-lead/route.ts` — pre-save deliverability gate and typed response
- `src/components/personal-plan-quiz/personal-plan-quiz.tsx` — editable 422 recovery state
- `tests/email-deliverability.test.ts` — deterministic resolver and typo coverage
- focused quiz test or Playwright coverage — end-to-end recovery contract

## Designed user journey

1. A user reaches the existing email-capture screen after completing and preparing the Personal Plan.
2. While they type, a documented provider-domain typo appears as Jonas's existing clickable suggestion. It remains non-blocking: the user can apply it or continue with the entered address.
3. They continue to the optional marketing-consent step.
4. If the server confirms the domain can receive mail, saving and navigation continue unchanged.
5. If the server definitively rejects the domain, the interface returns to the email screen, keeps the entered address visible, marks it invalid, focuses the field, and exposes the German reachability error through the field's accessible description.
6. If the address matches an evidenced provider typo, the corrected address appears as the first clickable suggestion.
7. Clicking the suggestion replaces the address and clears the error. Manually editing the address also clears both the error and the stale server suggestion.
8. The user continues through consent again and reaches the result reveal after a successful save.
9. DNS timeout or unexpected resolver failure remains fail-open, so infrastructure instability never strands the user.
10. A rejection records only its closed reason and whether a correction existed; no address or domain enters analytics.

Meaningful variants:

- known-good provider domain: no DNS round trip
- valid custom MX domain: accepted
- no MX but valid A/AAAA: accepted as implicit MX
- null MX or no MX/A/AAAA: rejected with recoverable UI
- resolver timeout/error: accepted fail-open
- rollback: deployment rollback/revert; no independent deliverability flag

## Mockup evidence

- Current rendered surface: `/Users/nick/.codex/visualizations/2026/08/01/019fbe24-9a82-7740-8456-8461242e08a9/email-capture-current.png`
- Proposed rendered recovery state: `plans/mockups/email-deliverability-recovery.html`
- Selected direction: retain Jonas's live clickable typo suggestion; on a definitive server rejection, return to the same mobile layout with field focus, associated inline error, and the server correction directly beneath it.
- Feedback incorporated: do not add the extra post-Continue correction choice shown in the exploratory variant; keep Jonas's simpler non-blocking suggestion behavior.
- Mockup review: confirmed by Nick on 2026-08-02
- User-journey sign-off: confirmed by Nick on 2026-08-02
- Browser note: the in-app browser runtime could not initialize, so the current surface and mockup were rendered with the repository's local Playwright installation.

## Counterpart findings ledger

| ID  | Type                   | Evidence                                                                                                                    | Decision | Plan change                                                                                                                                       | Revalidation                                  |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| C1  | scope/product decision | Check currently runs only inside final `submit()` after consent                                                             | accepted | Keep post-consent validation to preserve the single lead-save request; journey now states consent is revisited after recovery                     | Playwright recovery journey                   |
| C2  | defect                 | A conversion gate without a rejection signal would be operationally invisible                                               | accepted | Add privacy-safe `422` event with reason and suggestion presence only                                                                             | analytics contract/source test plus review    |
| C3  | tradeoff               | Logic false negatives require rollback even though DNS failures fail open                                                   | accepted | Use revert/deployment rollback; do not add a second runtime flag; record route-level flag and residual risk                                       | final review                                  |
| C4  | defect                 | `serverSuggestion` remains after manual editing                                                                             | accepted | Clear it in the input change handler                                                                                                              | real Playwright route-interception test       |
| C5  | tradeoff               | Review suggested source-text, render-harness, or Playwright coverage                                                        | accepted | Use Playwright with seeded draft and intercepted `422`; no real lead write                                                                        | focused Playwright run                        |
| C6  | tradeoff               | Unknown-provider DNS can add up to the 3-second timeout                                                                     | accepted | Known-good providers skip DNS; retain the 3-second fail-open ceiling and document it as residual latency                                          | deterministic timeout tests and review        |
| C7  | defect                 | Reviewer claimed repo review commands were non-canonical                                                                    | rejected | `AGENTS.md` and the selected personal skills explicitly require `ready-check`, `request-code-review`, `ship-it`, and one Claude lane; retain them | final receipt                                 |
| C8  | defect                 | Accessibility guidance requires an identified field error and a concrete correction suggestion                              | accepted | Focus the email field after a `422`, set `aria-invalid`, and associate the visible error through `aria-describedby`/alert semantics               | Playwright focus and accessibility assertions |
| C9  | defect                 | Final code review found no route-level guard proving the deliverability gate remains before persistence                     | accepted | Add a deterministic route contract test for ordering and the typed `422` payload                                                                  | focused persistence contract test             |
| C10 | scope/product decision | Final code review noted that a known typo domain with working MX remains acceptable if the user ignores the live suggestion | rejected | Preserve the explicitly approved non-blocking suggestion; the server rejects only definitive undeliverability                                     | browser journey and final review              |
| C11 | tradeoff               | Final code review repeated the up-to-three-second custom-domain latency risk                                                | accepted | No new change; this is already the bounded fail-open tradeoff recorded in C6                                                                      | deterministic timeout tests                   |

## Ordered tasks

1. Import Jonas's corrected head onto the fresh task branch and reconcile it with current `origin/main` without changing unrelated files.
   - Complete when the five intended source/test files match the reviewed behavior and authorship is retained in history or attribution.
2. Add the client-state and accessible-recovery guards after a server suggestion.
   - Complete when a `422` returns focus to the email field, exposes the associated error, and manual input clears `serverSuggestion`; a Playwright test with an intercepted `422` covers the recovery contract without writing a lead.
3. Add privacy-safe rejection observability.
   - Complete when the client records only the closed failure reason and suggestion presence, with no email or domain payload.
4. Run focused tests after each coherent slice.
   - Complete when deliverability, lead persistence, and quiz-entry tests pass.
5. Verify the rendered journey at narrow-mobile width, including error, suggestion click, manual edit, and successful retry semantics without a real lead write.
   - Complete when screenshots/Playwright assertions match the approved mockup and no overflow or inaccessible dead end remains.
6. Run `ready-check`, `request-code-review`, and the required read-only Claude whole-branch review on the exact tree; fix supported findings and refresh receipts if content changes.
   - Complete when no blocking verified finding remains and receipts share one fingerprint.
7. Commit, push, and open a draft PR under `ship-it` authorization.
   - Complete when the draft PR contains only the reviewed plan, mockup, source, and tests. Stop before merge or deployment.

## Verification

Automated:

- `node --import tsx --test tests/email-deliverability.test.ts tests/personal-plan-lead-persistence.test.ts tests/personal-plan-quiz-funnel-entry.test.ts`
- focused Playwright UI/recovery regression with an intercepted `422` and seeded prepared-plan state
- `npm run typecheck` with unchanged-main failures classified explicitly
- changed-file ESLint and Prettier
- `npm run ci:verify` when the baseline permits

Manual/browser:

- 390x844 email error/recovery state
- suggestion click clears the error and replaces the address
- manual edit clears the stale server suggestion
- a definitive `422` focuses the email field and exposes its error through associated accessibility semantics
- consent step is re-entered and never becomes a dead end
- no rejection event contains an email or domain

Live-state/migrations:

- no migration or production write
- optional real DNS probes are diagnostic only; deterministic tests use an injected resolver
- unknown-provider validation may add up to the accepted 3-second fail-open timeout; known-good providers skip DNS

Evidence-sensitive review:

- exact-head normal correctness review
- structural lens because DNS behavior, client/server error flow, and a large shared quiz component change
- one read-only Claude counterpart review at high effort

## Review and handoff

- Branch: `codex/email-deliverability-integration`
- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/email-deliverability-integration`
- Publication stop: draft PR only
- Merge/deployment: not authorized
- Durable artifacts to commit: this plan and the HTML mockup
- Transient screenshots/reviewer output: discard or retain outside the repository as explicitly recorded
- Mockup review: confirmed on 2026-08-02; exploratory extra-choice state removed
- User-journey sign-off: confirmed on 2026-08-02
