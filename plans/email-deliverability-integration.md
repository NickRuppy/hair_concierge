# Email deliverability integration

## Outcome and source context

Integrate the validated parts of Jonas's GitHub PR #302 onto a fresh `origin/main` branch: prevent known provider-domain typos from reaching the Personal Plan lead pipeline, preserve legitimate/custom domains through RFC-compatible DNS handling, and give users a clear recovery path when the server rejects an undeliverable address.

Source context:

- Jonas PR #302, reviewed heads `ec7da250` and `cc337e4b`
- Codex review: keep the server-side pre-save gate, fail-open behavior, narrow typo map, null-MX handling, A/AAAA fallback, and deterministic tests; exclude disposable-address policy

## Chosen direction

Port the corrected PR behavior onto `codex/email-deliverability-integration`, preserve Jonas's commit authorship where practical, and add the remaining client-state guard so a server suggestion disappears when the user manually edits the address. Keep Jonas's live, non-blocking typo suggestion instead of adding a second decision gate before consent. Keep the UX within the existing email-capture layout.

The authoritative DNS check remains at final lead submission, after the optional-consent screen. This preserves the current single lead-save request and avoids adding a second validation endpoint or an earlier duplicate DNS call. A rejected address therefore returns the user to email and requires them to confirm consent again. On return, focus the email field and associate the inline error with it so the recovery is visible and announced accessibly.

Emit a privacy-safe client event when a `422` is received, containing only the closed failure reason and whether a suggestion was present. Never include the address or custom domain. PostHog remains the product/funnel source; the server additionally emits a low-noise Sentry counter for completed checks with only bounded outcome attributes (`known_good`, `mx`, `implicit_mx`, `fail_open`, or `rejected`) so operational rejection ratios and resolver instability remain visible when client analytics is unavailable. Expected rejections must not create Sentry errors or issues.

Use one shared three-second deadline across the complete MX plus A/AAAA sequence. If that total deadline expires, or the resolver behaves unexpectedly, accept the address fail-open. Rollback is deliberately revert/deployment-rollback based. Do not add a dedicated validation switch, and do not treat the broader `PERSONAL_PLAN_QUIZ_V1_ENABLED` journey flag as this feature's rollback control.

## Scope and non-goals

In scope:

- shared explicit provider-typo corrections based on evidenced cases
- server-side MX, null-MX, A/AAAA fallback, timeout, and fail-open handling
- typed `422` handling that returns the user to the editable email step
- accessible return focus and field-associated error semantics
- privacy-safe `422` rejection observability without email/domain data
- privacy-safe server-side Sentry outcome counters without one issue per rejection
- deterministic DNS tests without live-network dependency
- rendered mobile verification of error, suggestion, manual edit, and recovery

Non-goals:

- disposable-email blocking
- general fuzzy or TLD-wide correction
- DMARC, SPF, DKIM, Customer.io, or Vercel production changes
- live Sentry dashboard/alert mutation before a production baseline exists
- the separate legacy `/quiz` lead route and its recovery UX; extending validation there requires its own journey and conversion review
- historical lead cleanup
- merge or deployment

## Target map

- `src/lib/email-deliverability-shared.ts` — client-safe typo map and known-good domains
- `src/lib/email-deliverability.ts` — server DNS resolver contract and fail-open logic
- `src/app/api/quiz/personal-plan-lead/route.ts` — pre-save deliverability gate and typed response
- `src/components/personal-plan-quiz/personal-plan-quiz.tsx` — editable 422 recovery state
- `src/lib/analytics/events.ts` — typed client rejection event
- `src/lib/analytics/routes.ts` — PostHog-only product analytics routing
- `src/lib/analytics/destinations/posthog.ts` — privacy-safe PostHog property mapping
- `tests/email-deliverability.test.ts` — deterministic resolver and typo coverage
- `tests/personal-plan-lead-persistence.test.ts` — pre-persistence ordering and server metric contract
- `tests/analytics-tracking.test.ts` — PostHog routing and payload privacy contract
- focused Playwright coverage — end-to-end recovery contract

## Designed user journey

1. A user reaches the existing email-capture screen after completing and preparing the Personal Plan.
2. While they type, a documented provider-domain typo appears as Jonas's existing clickable suggestion. It remains non-blocking: the user can apply it or continue with the entered address.
3. They continue to the optional marketing-consent step.
4. If the server confirms the domain can receive mail, saving and navigation continue unchanged.
5. If the server definitively rejects the domain, the interface returns to the email screen, keeps the entered address visible, marks it invalid, focuses the field, and exposes the German reachability error through the field's accessible description.
6. If the address matches an evidenced provider typo, the corrected address appears as the first clickable suggestion.
7. Clicking the suggestion replaces the address and clears the error. Manually editing the address also clears both the error and the stale server suggestion.
8. The user continues through consent again and reaches the result reveal after a successful save.
9. The complete MX plus A/AAAA sequence has one shared three-second deadline. Timeout or unexpected resolver failure remains fail-open, so infrastructure instability never strands the user.
10. PostHog records a rejection's closed reason and whether a correction existed. Sentry records a bounded server outcome counter that distinguishes normal acceptance, fail-open acceptance, and rejection, plus the closed reason for rejections. Neither receives an address or domain.

Meaningful variants:

- known-good provider domain: no DNS round trip
- valid custom MX domain: accepted
- no MX but valid A/AAAA: accepted as implicit MX
- null MX or no MX/A/AAAA: rejected with recoverable UI
- resolver timeout/error: accepted fail-open
- rollback: deployment rollback/revert; no independent deliverability flag
- observability: expected rejection is a metric outcome, not a Sentry error/issue

## Mockup evidence

- Current rendered surface: `/Users/nick/.codex/visualizations/2026/08/01/019fbe24-9a82-7740-8456-8461242e08a9/email-capture-current.png`
- Proposed rendered recovery state: `plans/mockups/email-deliverability-recovery.html`
- Selected direction: retain Jonas's live clickable typo suggestion; on a definitive server rejection, return to the same mobile layout with field focus, associated inline error, and the server correction directly beneath it.
- Feedback incorporated: do not add the extra post-Continue correction choice shown in the exploratory variant; keep Jonas's simpler non-blocking suggestion behavior.
- Mockup review: confirmed by Nick on 2026-08-02
- User-journey sign-off: confirmed by Nick on 2026-08-02
- Browser note: the in-app browser runtime could not initialize, so the current surface and mockup were rendered with the repository's local Playwright installation.

## Counterpart findings ledger

| ID  | Type                   | Evidence                                                                                                                    | Decision | Plan change                                                                                                                                                                     | Revalidation                                  |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| C1  | scope/product decision | Check currently runs only inside final `submit()` after consent                                                             | accepted | Keep post-consent validation to preserve the single lead-save request; journey now states consent is revisited after recovery                                                   | Playwright recovery journey                   |
| C2  | defect                 | A conversion gate without a rejection signal would be operationally invisible                                               | accepted | Add privacy-safe `422` event with reason and suggestion presence only                                                                                                           | analytics contract/source test plus review    |
| C3  | tradeoff               | Logic false negatives require rollback even though DNS failures fail open                                                   | accepted | Use revert/deployment rollback; do not add a dedicated flag, and do not present the broader journey flag as a validator-specific rollback control                               | final review                                  |
| C4  | defect                 | `serverSuggestion` remains after manual editing                                                                             | accepted | Clear it in the input change handler                                                                                                                                            | real Playwright route-interception test       |
| C5  | tradeoff               | Review suggested source-text, render-harness, or Playwright coverage                                                        | accepted | Use Playwright with seeded draft and intercepted `422`; no real lead write                                                                                                      | focused Playwright run                        |
| C6  | tradeoff               | Unknown-provider DNS can add latency before lead persistence                                                                | accepted | Known-good providers skip DNS; enforce one shared three-second deadline across MX and A/AAAA, then fail open                                                                    | deterministic total-deadline tests and review |
| C7  | defect                 | Reviewer claimed repo review commands were non-canonical                                                                    | rejected | `AGENTS.md` and the selected personal skills explicitly require `ready-check`, `request-code-review`, `ship-it`, and one Claude lane; retain them                               | final receipt                                 |
| C8  | defect                 | Accessibility guidance requires an identified field error and a concrete correction suggestion                              | accepted | Focus the email field after a `422`, set `aria-invalid`, and associate the visible error through `aria-describedby`/alert semantics                                             | Playwright focus and accessibility assertions |
| C9  | defect                 | Final code review found no route-level guard proving the deliverability gate remains before persistence                     | accepted | Add a deterministic route contract test for ordering and the typed `422` payload                                                                                                | focused persistence contract test             |
| C10 | scope/product decision | Final code review noted that a known typo domain with working MX remains acceptable if the user ignores the live suggestion | rejected | Preserve the explicitly approved non-blocking suggestion; the server rejects only definitive undeliverability                                                                   | browser journey and final review              |
| C11 | tradeoff               | Final code review repeated the up-to-three-second custom-domain latency risk                                                | accepted | No new change; this is already the bounded fail-open tradeoff recorded in C6                                                                                                    | deterministic timeout tests                   |
| C12 | defect                 | Claude found that separate three-second wrappers could make the MX plus A/AAAA sequence take about six seconds              | accepted | Replace per-phase ceilings with one monotonic three-second deadline shared by the complete resolver sequence                                                                    | elapsed-time deadline regression test         |
| C13 | defect                 | Claude found that the target map and verification list omitted the implemented analytics files and focused analytics test   | accepted | Name the analytics contracts, PostHog mapper, persistence contract, and canonical focused commands explicitly                                                                   | plan review plus focused tests                |
| C14 | product/operations     | Client-only PostHog can undercount because analytics may be unavailable or unconsented                                      | accepted | Keep PostHog for funnel analysis and add a privacy-safe Sentry outcome counter for normal acceptance, fail-open, and rejection; never capture an expected rejection as an error | metric contract and payload privacy tests     |
| C15 | scope/product decision | A dedicated validation kill switch would provide faster isolation than deployment rollback                                  | rejected | Nick confirmed deployment rollback is sufficient; add no independent flag and record the slower rollback boundary                                                               | final plan review                             |
| C16 | scope/product decision | Claude found that the separate legacy `/quiz` lead route remains outside this Personal Plan validation journey              | deferred | Keep this PR scoped to Jonas's Personal Plan route and record legacy `/quiz` validation as a separate journey/rollout follow-up                                                 | plan scope and final handoff                  |
| C17 | defect                 | Claude found that source-regex tests did not execute the server rejection gate                                              | accepted | Add an injected route-handler seam; execute a valid request through the handler and assert the real typed `422` before persistence                                              | focused route behavior test                   |
| C18 | defect                 | Claude found that one working A/AAAA result plus one transient sibling failure was mislabeled `fail_open`                   | accepted | Use `Promise.allSettled`; classify as `implicit_mx` when either family proves reachability and reserve `fail_open` for no proven record                                         | partial DNS regression test                   |
| C19 | defect                 | Claude found that the shared-deadline regression depended on wall-clock timing                                              | accepted | Replace elapsed-time thresholds with Node's controlled Date/timer clock and assert completion at the exact shared deadline                                                      | deterministic deadline test                   |
| C20 | defect                 | Final Claude refresh found that resolving the default Sentry metric function happened before its protective `try` block     | accepted | Resolve the optional Sentry metric function inside the guard so an unavailable SDK surface cannot turn an accepted address into a `500`                                         | metric failure test and review                |
| C21 | defect                 | Final Claude refresh found no accepted-address route test proving the gate continues into persistence                       | accepted | Inject the request-context and admin-client seams; assert an accepted normalized address reaches the persistence RPC                                                            | positive route behavior test                  |
| C22 | coverage gap           | Final Claude refresh found independent stringly typed server and Playwright `422` fixtures                                  | accepted | Share the rejection response contract, parser, fallback message, and typed Playwright fixture across the route and client                                                       | typecheck, focused tests, Playwright          |
| C23 | efficiency             | Final Claude refresh found that MX `ENOTFOUND` unnecessarily triggered A/AAAA lookups                                       | accepted | Treat MX NXDOMAIN as definitive `no_mx`; retain A/AAAA fallback for `ENODATA`                                                                                                   | DNS short-circuit regression test             |
| C24 | maintainability        | Final Claude refresh found the client duplicated the shared email-format pattern                                            | accepted | Reuse `EMAIL_ADDRESS_PATTERN` from the client-safe shared module                                                                                                                | typecheck and focused tests                   |
| C25 | invariant              | Final Claude refresh found that the checked normalized address was discarded before persistence                             | accepted | Persist and forward the successful deliverability result's normalized address so checked and stored values cannot drift                                                         | positive route behavior test                  |

## Ordered tasks

1. Import Jonas's corrected head onto the fresh task branch and reconcile it with current `origin/main` without changing unrelated files.
   - Complete when Jonas's intended deliverability source/tests match the reviewed behavior and authorship is retained in history or attribution.
2. Add the client-state and accessible-recovery guards after a server suggestion.
   - Complete when a `422` returns focus to the email field, exposes the associated error, and manual input clears `serverSuggestion`; a Playwright test with an intercepted `422` covers the recovery contract without writing a lead.
3. Enforce the conversion-safe resolver deadline.
   - Complete when MX and A/AAAA share one three-second total budget, and deterministic tests prove that timeout or unexpected resolver failure accepts fail-open without starting a second full budget.
4. Add privacy-safe rejection observability.
   - Complete when PostHog records only the closed failure reason and suggestion presence, while `Sentry.metrics.count` records each completed server check with bounded `outcome`, `reason`, and `suggestion_present` attributes only. The outcomes distinguish `known_good`, `mx`, `implicit_mx`, `fail_open`, and `rejected`, enabling rejection-ratio and resolver-health monitoring; no email/domain is passed and no expected rejection creates an issue.
5. Run focused tests after each coherent slice.
   - Complete when deliverability, lead persistence, and quiz-entry tests pass.
6. Verify the rendered journey at narrow-mobile width, including error, suggestion click, manual edit, and successful retry semantics without a real lead write.
   - Complete when screenshots/Playwright assertions match the approved mockup and no overflow or inaccessible dead end remains.
7. Run `ready-check`, `request-code-review`, and the required read-only Claude whole-branch review on the exact tree; fix supported findings and refresh receipts if content changes.
   - Complete when no blocking verified finding remains and receipts share one fingerprint.
8. Commit, push, and open a draft PR under `ship-it` authorization.
   - Complete when the draft PR contains only the reviewed plan, mockup, source, and tests. Stop before merge or deployment.

## Verification

Automated:

- `node --import tsx --test tests/email-deliverability.test.ts tests/personal-plan-lead-persistence.test.ts tests/personal-plan-quiz-funnel-entry.test.ts tests/analytics-tracking.test.ts`
- `npm run test:contracts`
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
- no PostHog event or Sentry metric contains an email or domain
- an expected `422` rejection creates no Sentry error/issue

Live-state/migrations:

- no migration or production write
- optional real DNS probes are diagnostic only; deterministic tests use an injected resolver
- unknown-provider validation may add up to the accepted three-second total fail-open deadline; known-good providers skip DNS
- deployment rollback is the accepted emergency disable path; no dedicated kill switch exists
- the PR emits the Sentry metric after deployment; selecting a live alert threshold waits for a small production baseline and separate operational authorization

Evidence-sensitive review:

- exact-head normal correctness review
- structural lens because DNS behavior, client/server error flow, and a large shared quiz component change
- one read-only Claude counterpart review at high effort

### Implementation evidence (2026-08-02)

- Focused deliverability, persistence, quiz-entry, and analytics suite: 88/88 passed.
- Shared-deadline regression proves MX plus A/AAAA consume one total budget and return `fail_open` on expiry.
- Sentry contract records only bounded outcome/reason/suggestion attributes, distinguishes resolver fail-open, and catches metric failures so observability cannot block conversion.
- The actual Personal Plan route handler is executed with injected rate-limit and deliverability seams; a definitive failure returns the typed `422` before any persistence dependency is reached.
- Partial A/AAAA success is classified as `implicit_mx`, and the shared-deadline regression uses controlled timers instead of wall-clock thresholds.
- `npm run build`, `npm run typecheck`, changed-source ESLint, Prettier, and `git diff --check`: passed.
- Narrow-mobile Playwright recovery journey at 390x844 with the existing personal-plan flag enabled: 2/2 passed.
- Repository `test:node` (2520/2520) and `test:playwright:contracts`: passed. The aggregate `test:contracts` remains red only because `test:agent` does not load `.env.local`; current `main` reproduces the same 26 `supabaseUrl is required` failures. The affected product-selection file passes 91/91 when invoked with `.env.local` loaded. No agent code is in this PR.

## Review and handoff

- Branch: `codex/email-deliverability-integration`
- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/email-deliverability-integration`
- Publication stop: draft PR only
- Merge/deployment: not authorized
- Durable artifacts to commit: this plan and the HTML mockup
- Transient screenshots/reviewer output: discard or retain outside the repository as explicitly recorded
- Mockup review: confirmed on 2026-08-02; exploratory extra-choice state removed
- User-journey sign-off: confirmed on 2026-08-02
- Final decision record: one shared three-second deadline, fail-open on uncertainty, PostHog plus low-noise Sentry outcome metrics, and deployment rollback without a dedicated kill switch; confirmed by Nick on 2026-08-02
- Follow-up boundary: the live legacy `/quiz` capture path remains unchanged and needs a separate recovery-journey/conversion decision before applying the same blocking gate there
