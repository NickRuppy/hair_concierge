# Actionable checkout activation errors

## Outcome and source context

Nick requested on 2026-09-15 that account-activation errors explain the problem and help the customer resolve it. The reported live Stripe checkout had `admission_denial_reason=trial_used` and `admission_status=released` after prior-paid card history denied it. `/welcome` still showed a success icon and two activation choices; both auth endpoints returned a generic 500 on terminal trial denial. No owner identifiers or provider payloads belong in this plan.

Authority: [trial-history-and-inclusive-tax](../free-trial-launch/trial-history-and-inclusive-tax.md) preserves once-only eligibility, prior-paid exclusion, and an explicitly selected paid/support path. User request authorizes preparing this repair; Nick confirmed the preview and journey on 2026-09-15 (“Okay yes, that’s good”), requesting a complete recovery-path audit and shorter copy before implementation.

## Chosen direction

Use structured, provider-neutral activation outcomes and German recovery messages, instead of interpreting generic exception strings. Show a terminal or pending panel only when verified server state supports it. Keep genuine transient errors inline with their retry action. Match the existing `/welcome` fonts, colors, width and outlined primary action.

A verified prior-use denial says: **Kein weiterer kostenloser Test**. Body: **Für dieses Konto oder die Zahlungsmethode gab es bereits einen Test oder ein Abo. Das stimmt nicht? Wir prüfen es für dich.** Offer primary `/kontakt` and secondary **Ich habe bereits ein Konto** to `/auth`. Do not show previous account details, raw identifiers, card fingerprints, provider exception messages or an accusation of abuse. Do not suggest changing cards or email addresses.

`/pricing` is not a direct anonymous paid-subscription recovery destination: without auth or a lead it redirects to `/quiz`. Do not add it as a misleading CTA. Login gives existing accounts their ordinary routing; a denied enrollment currently leads to support rather than self-service paid recovery. Support handles an unresolved identity association. Do not silently start a paid subscription.

## Scope and non-goals

Cover Stripe and PayPal subscription/trial returns, password setup, magic-link submission, direct return/reload, typed eligibility denial and its remaining provider cleanup, temporary service/network/send failures, invalid/expired activation references. Keep already-actionable rate-limit and network copy; do not add a countdown or new throttle mechanism. Preserve existing success, password validation, duplicate active membership and one-time access semantics. No new billing prices, provider resources, trial clocks, eligibility rules, new emails, analytics conversions, or live account mutations.

Repeated owner testing is parked out of scope: Nick said “I will find another way” on 2026-09-15. The earlier research remains in testing-options.md as a draft. No testing environment, live exception, or further testing research is part of this repair. This error-message repair does not add a test bypass or erase historical claims. Existing `TRIAL_QA_EMAILS` only limits enrollment rollout; it is not a repeat-trial exception. Existing historical `isTestMarkedBillingSubscriptionRow` exclusion does not cover new repeated trial claims. Do not misuse legal identity-rights tooling as a general testing bypass.

## Target map

- `src/lib/stripe/trial-account-admission.ts`: prepare/activate outcomes, persisted denial reason and cleanup result.
- `src/lib/paypal/trial-account-admission.ts`, `src/lib/paypal/checkout-activation.ts`, and consumed result types: separate prior-use denial from independent active access and provider pending state.
- `src/lib/auth/checkout-activation-outcome.ts` (new): shared serializable code/message/action contract; mapping accepts typed facts only.
- `src/app/api/auth/send-magic-link/route.ts` and `set-checkout-password/route.ts`: map outcomes before generic exception handling; OTP/password side effects remain gated by admission success.
- `src/app/welcome/page.tsx`: initial read-only display of already-recorded terminal Stripe denial using verified Checkout->enrollment ownership, and equivalent verified PayPal return handling. Run this check before the existing authenticated Stripe `ensureCheckoutAccount` call and short-circuit known denial, for both anonymous and signed-in returns. Remap the existing PayPal trial duplicate GET rendering using explicit reason; do not broaden the existing GET mutation behavior or change successful legacy returns.
- `src/app/welcome/welcome-client.tsx`: consume stable codes and safe actions, terminal panel, inline temporary feedback, semantic alerts and focus handling; preserve return-recovery logic.
- Existing auth-route, Stripe/PayPal trial, welcome and return-recovery tests, plus focused rendered/browser outcome tests.

## Decision coverage

Status: confirmed for the error-recovery scope; technical recovery audit is recorded in [recovery-audit.md](recovery-audit.md).

- Confirmed with Nick: actionable user-facing activation messages (request 2026-09-15); previous trial/paid eligibility policy remains in force.
- Inherited from contract: authorization and payment state remain provider-verified; no automatic paid conversion after denial, no granting access on a redirect, original accepted terms persist; German/current production design.
- Implementation defaults: shared discriminated types, allowlisted actions, no raw error leakage; focused behavioral regression tests.
- Open consequential assumptions affecting the approved flow: none. Nick approved the flow and requested shorter copy plus verification of every recovery path. Owner testing is parked out of scope per Nick’s “I will find another way” on 2026-09-15; no testing infrastructure or exceptions will be added.
- Coverage acknowledgement: 2026-09-15, “Okay yes, that’s good” in reply to the revised preview and final walkthrough, followed by explicit instructions to check every recovery action and reduce text. The approval covers the error flow; it is not a claim that backend implementation or end-to-end verification is complete.
- Internal revalidation: 2026-09-15 root main b4deccd8; independent code explorer plus orchestrator confirmed Stripe generic throw, PayPal conflated duplicate result, and anonymous `/pricing` redirect.
- Undiscussed consequential assumptions affecting this handoff: none. Owner testing remains parked. Support means human assistance, not an automated eligibility override.

## Designed user journey

1. Customer returns from a verified Stripe/PayPal authorization to `/welcome` or reopens its canonical activation link.
2. An already-recorded prior-use denial shows the **Kein weiterer kostenloser Test** panel immediately. No success checkmark, password form, or magic-link retry is shown. A denial first discovered on submission changes the same page into this panel.
3. **Support kontaktieren** opens `/kontakt`; the secondary **Ich habe bereits ein Konto** opens `/auth`. These actions do not create another checkout or charge. Existing login remains available; blocked/released trial accounts currently reach a support/uncertain reactivation state, so do not promise self-service paid checkout.
4. If provider/account processing is unfinished and retry of this same operation is actually supported, **Zugang wird vorbereitet** offers **Status prüfen** plus support. It never claims a charge or cancellation has succeeded without evidence.
5. A competing identity reservation (`claim_reserved`) is not permanent prior use. If this attempt has already been neutralized/released, it must not offer a retry of that dead attempt; show a separate explanatory support state. Preserve the competing attempt. Do not silently convert it to `trial_used`.
6. Invalid/expired subscription activation references on both GET and POST offer the login/support explanation (replace the current invalid-return `/pricing` redirect with this panel, including when no usable reference is supplied; preserve bare `/welcome` refresh recovery fallback) without telling the user to reopen that same expired link. An already-used password-setup claim that still permits ordinary login does not globally lock the account.
7. Network, service and email delivery errors remain inline; the customer can retry the relevant action. The current limiter exposes no retry timestamp; keep its existing wait-and-retry wording and do not introduce a timer. If OTP sending fails after account activation, describe a send failure, not an activation failure.
8. Successful password/OTP and redirects retain their existing behavior. Mobile and desktop use the same content and current responsive shell. Terminal/pending changes are announced to assistive technology; do not discard a password field during a recoverable error.

## Planning evidence

[preview.html](preview.html) recreates the production `WelcomeClient` layout, local brand fonts and current theme tokens. The user-supplied production screenshot is the current-surface evidence. Tabs compare current generic error, proposed terminal prior-use panel, real pending state, transient inline error, invalid reference and rate-limit feedback. `?width=390` shows a mobile-width version; omit for desktop. The preview uses a fictional email and its buttons cannot submit anything.

Question resolved by the artifact: can the customer distinguish a recoverable problem from a terminal checkout and see the next action without another ineffective retry? Selected proposal uses the same outlined primary action and a secondary support link. Evidence review and journey sign-off: confirmed by Nick on 2026-09-15, with the explicit refinement to use fewer sections and words. Technical corrections and verification are documented in recovery-audit.md. The competing-reservation and OTP-send failure tabs are included. Serve from the task worktree root with `python3 -m http.server 8771 --bind 127.0.0.1` to resolve the local font assets. Preview alert colors use current status tokens; the legacy Bisher tab preserves the actual destructive alert colors.

## Shared outcome contract

Use one trial-specific typed error/result union shared by both adapters, because the same trial policy and lifecycle states feed two provider flows, two auth routes and the return page. Retain the existing provider error classes for provider-specific validation. Do not match strings or expose exception text. Serializers and UI share this table; add no caller-selected redirect URL.

| Code | HTTP for POST | Verified source | Display/action |
| --- | --- | --- | --- |
| `trial_unavailable` | 403 | Persisted `trial_used`, or current admission result `trial_used`, with cleanup settled | Unavailable panel; `/kontakt`, optional self-selected existing-account `/auth` |
| `trial_checkout_conflict` | 409 | `claim_reserved`; this attempt has been neutralized/released | Other checkout panel; `/kontakt`, existing-account `/auth`; no retry of this attempt |
| `trial_checkout_closed` | 409 | Verified expired trial authorization/deadline or failed start alignment after successful neutralization; null reason on closed row does not imply prior use | Closed checkout panel; `/kontakt`, existing-account `/auth` |
| `trial_reconciliation_required` | 503 | Known denial with cleanup outstanding or cancellation/invoice/release reconciliation error | Support-required panel; `/kontakt`; no claim of successful cancellation/no charge |
| `checkout_existing_access` | 409 | Independent current access verified, duplicate agreement cleanup settled | Existing-access panel with `/auth` and `/kontakt` |
| `activation_link_invalid` | 400 | Invalid/expired provider return reference, not a transient provider lookup outage | Invalid-link panel; `/auth` for existing accounts, `/kontakt`; do not reveal email from unverified input |
| `activation_login_required` | 409 | Existing password/setup claim is consumed/expired | Existing login recovery; preserve allowed OTP semantics, never infer trial denial |
| `auth_link_send_failed` | 500 or existing upstream throttle classification | OTP fails after successful account activation | Inline send-specific message and support; preserve account and correct retry |

Normal provider pending retains existing `activation_pending`/PayPal polling behavior. The pending panel's manual **Status prüfen** reloads the same canonical return using the existing return recovery; it never POSTs auth or adds a new Stripe polling endpoint. PayPal keeps its current 15-attempt/2-second poll and timeout bound. A dead/neutralized attempt never enters that pending retry state.

For persisted blocked/released records, read **`admission_denial_reason` from the enrollment row**, plus `neutralization_required` and recorded cleanup evidence. The admission RPC deliberately returns `invalid_state` for released rows, so never use its replay return value to reconstruct their historical reason. Unknown/binding-mismatched states stay conservative support/unknown errors, not invented prior-use facts.

Explicit PayPal duplicate sources to cover: persisted blocked/released reason; expired original authorization/deadline; failed provisional-start reconciliation; independently verified existing access; new identity admission conflict; legacy duplicate-owner result. Only actual prior-use evidence becomes `trial_unavailable`. Preserve legacy duplicate semantics; the other newly differentiated trial cases use the table above.

UI sign-off explicitly covers support-first with self-selected existing-account login, invalid-reference panel in place of quiz redirect, and the clarified closed/support states. These were approved on 2026-09-15; preserve eligibility and successful activation behavior.

## Ordered tasks

1. Add a failing reproduction for persisted released `trial_used` plus first-use rejection in both auth routes; assert typed terminal response, no OTP/password side effects, no granted access. Preserve provider cleanup tests and reproduce the existing generic-500 failure. Complete when the regression fails against the old behavior.
2. Define typed outcomes at the provider/account boundaries and propagate through both auth endpoints and PayPal callers. Consumes verified provider/enrollment facts; produces the shared codes above. Preserve cleanup-before-release and classify cleanup failure as unresolved, not confirmed cancellation. Explicit fixtures cover cancellation-not-confirmed, nonzero/still-collectible or paginated invoice evidence, and claim-release failure. Completed when provider and route behavior tests distinguish prior use, current access, competing reservation, cleanup failure, and unknown exceptions.
3. Consumes the shared outcome codes and allowlisted actions. Add read-only initial return-state handling and render the approved panels/inline messages. Validate Checkout/token ownership before exposing any enrollment status or email. Handle newly surfaced denial after POST identically, preserve query recovery and existing success navigation. Complete when fresh load, submit, refresh and back navigation show consistent actions in mobile/desktop browsers.
4. Verify safe auth recovery and operational observability. Terminal expected denials should be tagged by structured reason, not logged as an undifferentiated unexpected 500. Unexpected defects retain server detail and monitoring while users receive actionable generic text. Complete when tests prove every action goes to its intended existing route, unknowns do not leak raw errors, and unrelated one-time/password-success cases still pass.

## Verification

Automated: Under Node 22, run focused `.test.ts` files with `node --import ./tests/server-only-register.cjs --import tsx --test ...`; run `tests/auth-post-checkout-routes.spec.ts` with `npx playwright test tests/auth-post-checkout-routes.spec.ts --project=chromium`. Include Stripe/PayPal trial activation, result/status consumers, welcome error rendering and welcome-return-recovery tests. `ci:verify` does not run these suites and is a separate typecheck/lint/build gate. Test response status/code, provider cleanup semantics, no auth side effects on terminal state, safe unknown fallback, and account activation followed by OTP failure. A real browser harness must exercise returned error codes through `WelcomeClient`, not only regex source checks. Verify no horizontal overflow at 390px, keyboard/focus/alert behavior and valid action destinations. Final `npm run ci:verify` under Node 22.

Live verification: only read-only return-page checks for an owner-provided canceled enrollment after deployment; do not submit OTP, password, authorization, new charge or cancellation as a test without the corresponding user authority. Static/browser rendering alone is not evidence of a successful auth submission.

## Review and handoff

Task worktree `codex/trial-activation-errors`. Plan counterpart review via local Claude Opus 5/high, read-only and terminal. Inspect findings, preserve genuine product choices for Nick. Final implementation uses implementation-loop and its ready-check/review gates. Publication authority is inherited from Nick’s earlier instructions in this same conversation: “Now we do a full deployment with Stripe and PayPal, now fully live in production” and subsequent requests to keep implementing; do not infer new account/payment/identity mutation authority from that. The UI journey is confirmed, with the shorter-copy and recovery-audit refinements recorded below. A missing self-service paid recovery path for denied enrollments is recorded as a separate product gap, not silently added to this message repair.

Artifacts: commit this plan and preview with the eventual PR; archive transient counterpart reports outside the repository; discard temporary local server only after preview review is complete. No migrations anticipated for error messages. Any testing environment or owner exception needs a separate concrete design before configuration or access/identity changes.

## Review findings and disposition

Opus 5/high read-only review completed 2026-09-15; report archived outside the repository at `/Users/nick/.codex/reviews/trial-activation-errors-2026-09-15/claude-plan-review.md`. Verdict was approve with revisions, not implementation approval.

| Finding | Disposition and verification |
| --- | --- |
| Released records lose reason through RPC | Accepted; row reason is explicitly required and released+trial_used fixture named. SQL/adapter path checked. |
| Authenticated Stripe GET can throw/mutate before panel | Accepted; read-only terminal preflight now explicitly precedes and short-circuits existing ensure call. |
| PayPal GET duplicate conflates six cases | Accepted; enumerate all causes and remap only verified trial cases, preserve legacy duplicate. |
| Missing wire contract / retry target | Accepted; code/status/fact/action table and canonical reload specified. |
| Login CTA may imply account exists | Accepted concern; proposed conditional-language link “Ich habe bereits ein Konto,” primary support, no account enumeration; Nick confirmed this support-first flow on 2026-09-15. First-time Stripe admission conflict actually occurs after identity creation, but some closed/replayed cases lack a usable account, so unconditional login remains inappropriate. |
| Invalid GET routing change was implicit | Accepted; explicitly proposed in scope/journey, confirmed with the preview on 2026-09-15. |
| Publication authority unsupported | Rejected after checking this conversation’s explicit live deployment/continuation authorization; source quotes recorded. No expansion to new identity/payment writes. |
| Test runner / stale preview instructions | Accepted; Playwright and Node commands separated, preview serving command documented. |
| Broad rate-limit rewording adds little | Accepted; preserve current network/throttle behavior, focus work on terminal reasons, recovery actions and true OTP-send failure. |

A network-disabled local route reproduction in `/tmp/trial-denial-error-repro.mjs` reproduced the reported generic 500 from the precise `Stripe trial admission denied` boundary; assertion expecting a terminal 403 failed as intended, with zero OTP calls. Convert it to durable behavior tests during implementation; discard this temporary harness afterwards.

Internal revalidation after counterpart review: the contract and task map incorporate verified technical findings; support/login and invalid-link routing were proposed at that stage and subsequently confirmed. No production mutation was made during planning.

## Copy refinement — 2026-09-15

Nick requested: “Okay then make the improved error messages better.” This resumes the error-message work; no new trial-testing setup is in scope. Reworked the existing preview using plain German, clearer next actions, and no unsupported payment assurances. Prior-use copy includes both previous trials and paid subscriptions. Closed-link copy no longer invents a timeout cause; an invalid link shows no email. Temporary failures preserve input and retry; OTP delivery failure explicitly says the account is already set up. Terminal panels keep support and conditional existing-account login instead of ineffective activation buttons. This is a copy refinement of the already reviewed technical plan, not a new provider or eligibility design.

Final walkthrough to confirm: a verified denied trial shows the reason and support/existing-login actions on load or after submission; a pending authorization allows a status recheck; a temporary failure retains the form for retry; an expired link offers login/support; successful activation and existing eligibility rules remain unchanged. This walkthrough was subsequently confirmed by “Okay yes, that’s good” and “good, works”; no further journey approval is pending.

Preview refinement checks: pending copy describes unfinished access setup without assuming the delay is specifically at the payment provider. Invalid-link preview omits the email. All preview actions remain inert. Browser checks cover the terminal panel, invalid-link panel and recoverable OTP-send failure; these do not prove production behavior.

## Recovery audit and shorter copy — confirmed refinement

Nick approved the reviewed error flow and requested all suggested actions be checked against code, with fewer sections and words. [recovery-audit.md](recovery-audit.md) now lists each state, actual recovery mechanism, evidence and remaining implementation requirements. The audit preceded implementation; current implementation evidence follows below.

The current preview is the copy source of truth, superseding earlier longer quotations above: terminal panels have one title, one short paragraph and actions, with no redundant eyebrow, email card or separate help paragraph. Recoverable forms retain required fields and password validation, with shortened choice labels, no explanatory paragraphs, and inline Help. Existing-access, activation-claim and saved-password/login-failure previews cover the previously missing account recovery cases. Retain the existing visual markers.

Accepted technical refinements from tracing the paths:
- The shared activation claim can be consumed, concurrently held, or left behind after failed cleanup. Do not infer that an email was sent from claim failure. Route to the ordinary login where a verified existing account can request a fresh link; preserve initial-password vs passwordless semantics.
- Only show inline retry after an email send failure when claim release succeeded. If claim release fails or the attempt is terminal, give login/support recovery instead of a doomed repeat submission.
- Classify PayPal activation-status responses, not only return-page and auth POSTs. Terminal outcomes must stop polling. Pending retry stays within the same verified attempt.
- Failed provider proof is not automatically an expired link: canceled/paid/mismatched agreements may fail the same proof. Only assert known facts; unknown persistent states go to support without another checkout.
- Existing login recovers authentication, not rejected trial eligibility. Support is the actual next step for that case; no new paid checkout is added.

Checks: 45 existing auth-route/confirmation Chromium tests, 37 Stripe/PayPal activation and return-recovery tests passed. Added blocked/released trial fixtures to the existing reactivation suite; all 5 tests passed. The delegated read-only auth/recovery audit also ran 22 tests across reactivation-routing, reactivation-trial-management and auth-confirm-replay (overlapping the final 5-test run). No provider requests, emails or production accounts were changed.

Artifacts: keep recovery-audit.md and the focused reactivation regression with the plan/preview. Test output is transient. No runtime source change is included in this audit/copy revision. Historical pending statements in earlier review notes describe their original review time; the current approval record above supersedes them.

## Implementation verification — 2026-09-15

Original acknowledgement preserved above; latest confirmation: Nick said **“good, works”** after the shortened preview and recovery audit. Internal revalidation: approved scope remains confirmed on task branch `codex/trial-activation-errors`, refreshed to base `9f1a3dc4`. No new product decisions or trial/testing exceptions were introduced.

Implemented provider-neutral outcomes, persistent denial reasons, read-only Stripe return preflight, PayPal return/status distinctions, both auth endpoints, and the real responsive recovery component. Persistent provider binding failures require support; unknown transport failures remain retryable. Claim-release failure sends users to ordinary login rather than an impossible repeated activation. Shared classification prevents GET, polling, and POST recovery messages diverging.

Red proof: the original seven browser regressions failed on the previous WelcomeClient; typed denial tests failed against the old generic catches; Stripe null-proof and uncanceled agreement tests failed before the corrective guards. Final tests exercise real handlers with injected offline provider/auth fixtures, and actual React components with intercepted local API responses. No emails, passwords, cards, provider subscriptions or customer records were changed by verification.

Browser evidence: actual development component at `/labs/activation-recovery?code=trial_unavailable`, 390×844 viewport, short single explanation, outlined support action and secondary login, no account details. Clicked support → `/kontakt` with the existing support mailbox; clicked existing-account login → `/auth` with password, login-link and password-reset choices. This verifies destinations, not delivery of an email or a human support resolution. The lab is development-only and performs no provider/account calls.

Current checks: 69 Node tests and 65 Chromium tests passed together. Typecheck/lint/build and final counterpart review are tracked in the final receipt. The retained `preview.html` is planning evidence; production components are the implemented behavior.

Production prerequisite: read-only information-schema query on project `pqdkhefxsxkyeqelqegq` confirmed `trial_enrollments.id`, `provider`, `provider_agreement_id`, `admission_status`, `admission_denial_reason`, and `neutralization_required`. No schema migration or customer-row read/write was needed.

Full `npm run ci:verify` passed (typecheck, lint, production build). Lint has five pre-existing warnings outside this task. Additional welcome/PayPal webhook regression suite: 76 passed; Stripe webhook suite: 27 passed. Three old source assertions expected the superseded pricing fallback/poll dependency list; updated to the approved behavior and complemented by actual welcome JSX tests.

## Final review disposition and base integration

The Opus 5/high whole-branch review requested changes. Accepted and fixed: CI copy assertions, @ci inclusion of the actual component harness, visible poll-timeout recovery, incomplete/unpaid checkout recovery, supported Next.js control-flow rethrow, explicit polling recovery status, structured recovery breadcrumbs, and conservative unexpected-admission handling. Unavailable initial-password setup now uses the accurate `activation_login_required` code; its already-approved ordinary login destination remains. We did not add a new inline account-choice flow or broaden this repair into a general auth-service refactor. The rendering contract documents that inline presentation applies only when an activation form exists.

A real app test reproduced an early click before hydration: the login-link button did nothing. Activation buttons now remain disabled until their handlers are ready; the same app test passes. This is readiness feedback, with no new account or billing behavior.

While reviewing, main advanced to `c3a61d3a` (#558), which qualifies trial authorizations for the existing legacy-quiz destination cutover. The task was fast-forwarded and the owned work restored. One PayPal helper-insertion conflict was resolved by preserving both functions; incoming eligibility behavior and its two regression tests remain intact. The orchestrator reviewed this integration and the counterpart-fix delta against the original review findings. No blocking finding remains in that delta.

New final states: `checkout_incomplete` directs the user to finish the existing open checkout and recheck this return; `activation_delayed` replaces the spinner after the bounded PayPal poll timeout with status retry and support. Both stay within the already-approved recovery journey. Internal decision coverage remains confirmed; no new consequential assumption was introduced.

Final focused server suite: 152 passed. Final browser/auth/webhook suite: 93 passed, plus the real Next.js activation-choice/send test passed. The latter uses an intercepted email response and sends no email. Production schema prerequisites were checked read-only. The external reviewer additionally reported all 7,389 Node tests passing on its pre-integration tree; that report is supplementary, not substituted for final-tree verification.

Artifact disposition: commit plan, static preview, historical audit/testing research, development-only real-component lab, production changes and regression tests. Archive counterpart reports and final verification/review manifests outside the repository. Discard only this task's generated test output and temporary base-refresh stash after restoration is verified. No production data mutation or provider authorization is part of these checks.
