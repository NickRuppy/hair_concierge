# Restore the Personal Plan handoff for trial members

## Outcome and chosen direction

After the base and optional recommendations are accepted, an eligible trial member reaches their saved routine/application flow without legacy onboarding. Production investigation on 2026-09-16 reproduced this for both Stripe and PayPal: billing and auth are active, a routine exists, and the old onboarding flag is false. The old middleware checks a separate hard-coded list of Personal Plan entitlement kinds and misses trials.

Reuse the existing authenticated Personal Plan routing frontier, which already resolves enrollment provenance and rollout eligibility for trials and other supported plan sources. Once that lookup succeeds with `kind: personal_plan`, combine it with independently verified current billing/one-time access to admit the existing Personal Plan onboarding bypass. Preserve the existing route-specific pending/active routine prerequisites. Do not infer permission from trial history, user metadata, a routine pointer alone, or a legacy profile flag. Do not create a second trial-only billing/provenance resolver.

## Scope and target map

- `src/lib/supabase/middleware.ts`: carry the verified frontier into the onboarding admission decision, keeping billing enforcement and failure behavior intact.
- `src/lib/auth/intake-state.ts`: clarify the existing admission contract if needed; retain the route-specific prerequisites and legacy behavior.
- Existing `tests/auth-middleware-personal-plan-routine.test.ts`: retain and run the legacy/special-access regression coverage without modification.
- `tests/auth-middleware-trial-plan-handoff.test.ts` and shared `.fixtures.ts`: exercise real trial billing policy, real frontier loader, and real middleware with read-only deterministic database doubles for Stripe and PayPal. Cover expired/revoked/malformed trial access, valid activation and route handoff, ordinary subscription isolation.
- Existing source eligibility/Postgres suites continue to verify trial provenance. No schema or billing policy changes.
- `tests/trial-plan-browser-handoff.spec.ts`: browser acceptance, reload and application navigation through the real middleware boundary for both providers.

Non-goals: changing payment amounts or lifecycle, broad retirement of legacy onboarding, changing UI/copy, rewriting account flags, touching production accounts, commit/push/PR/merge/deploy.

## Decision coverage

Decision coverage: confirmed.
Confirmed with Nick: legacy onboarding must not appear after the base and optional Personal Plan steps; sustainably fix the shared Stripe/PayPal failure.
Inherited from evidence or contract: current app access remains required; supported Personal Plan enrollment and rollout eligibility come from the existing frontier loader and source RPC; routine/application readiness remains route-specific. Ordinary subscriptions without a qualifying plan source retain legacy routing. Expired/revoked access cannot gain rights from stored plan data.
Implementation defaults: reuse the existing frontier result in the same request; reuse `hasCurrentPaidAppAccess` only on a qualifying bypass request; do not add provider branches; fail closed on lookup failure.
Open consequential assumptions: none.
Undiscussed consequential assumptions affecting this handoff: none.
Coverage acknowledgement: user reported the exact base -> optional -> onboarding defect and requested a sustainable fix on 2026-09-16.
Internal revalidation: implementation and reviewer revisions preserve the authorized post-accept journey; initial plan checked against main 22af7e23 and current production account/route evidence. The proposed change restores the explicitly requested existing journey; it does not introduce a new flow requiring a mockup.

## Journey and verification

Authenticated active trial -> existing base/optional plan presentation -> accept -> saved pending/active routine -> `/routine` -> `/anwendung` when active; `/chat` also uses the existing routine prerequisite. Direct login/reload must reach the same allowed state. Incomplete plan continues through existing frontier destinations. Missing/expired/revoked access retains current paywall/keepsake behavior. Lookup failures must not fall through to permissive access.

1. Add regression tests and run them on unchanged production code; observe an actual 307 onboarding redirect where routine/application access is expected.
2. Reuse the successfully resolved frontier in the existing middleware admission decision and clarify comments. Run new tests green plus existing auth, trial access and Personal Plan routing suites.
3. Verify consumer route outputs and the accept-plan handoff without account mutations; use local browser QA if the existing harness can faithfully represent the trial flow. Run typecheck, lint, build and applicable source/SQL tests under Node 22. Focused runner: `node --import ./tests/server-only-register.cjs --import tsx --test tests/auth-middleware-trial-plan-handoff.test.ts tests/auth-middleware-personal-plan-routine.test.ts tests/auth-intake-state.test.ts tests/personal-plan-enrollment.test.ts`.

Browser boundary coverage: `tests/trial-plan-browser-handoff.spec.ts` drives the production base/optional components in the existing lab, fixtures the accept response, and passes destination requests through the real middleware with real billing policy/frontier logic and in-memory data. Destination HTML is an explicit marker, not the server-rendered routine. It checks acceptance, reload, and application navigation for both providers without a Supabase write. Full live authenticated browser verification remains a post-deploy check; the existing intake E2E creates production users and is not used here.
4. Run ready-check and one read-only counterpart whole-branch review, address verified findings, and record final evidence and limitations.

## Review and handoff

Plan review: Claude approved with specification revisions. Accepted: name the exact middleware seam, test runner, and inherited eligibility prerequisite. The repair runs after the existing frontier redirect and before legacy intake; it sets the existing entitlement boolean only after `hasCurrentPaidAppAccess` succeeds. The existing `personal_plans` read and route-specific pointer checks remain unchanged. A focused extra billing read is necessary because the general app-access composite includes manual grants; those must not acquire new rights.

Reviewer suggested asking about early-stage `/chat` without a routine. This is not a new decision in the authorized repair: preserve the existing route-specific readiness rule and explicitly keep broader onboarding retirement out of scope. No requested post-accept behavior is deferred. Frontier `legacy`/`recovery` and rollout-ineligible sources do not acquire eligibility from this repair. No new user decision is required.
Artifact disposition: this plan, implementation and regression guards are for commit; temporary review/test logs stay outside the repository and are discarded or archived explicitly. Stop at a verified review-ready worktree unless publication is separately authorized.

## Final verification

- Red proof: unchanged middleware returned 307 for both providers' successful routine handoffs; the new guards now pass 38/38.
- Relevant auth, enrollment, frontier, trial billing/source and acceptance suites: 213/213 passed. Final rerun of the new suite after fixture extraction: 38/38 passed.
- Chromium mobile-width boundary journeys: Stripe and PayPal both passed acceptance, routine reload and application navigation (2/2). A fixture-only UTF-8 response-header correction resolved the initial browser assertion failure.
- Typecheck, lint and production build passed. Lint reports five pre-existing unrelated warnings and zero errors.
- Claude whole-change review: approved, no hard defects. Main-session review agrees. Non-blocking extra reads on `/scan` and ended-moderator requests remain a bounded efficiency tradeoff; the fix does not change those routes' access outcomes. A new billing-read failure returns the existing retryable failure response rather than granting access.
- Decision coverage revalidated: no change to the authorized journey, billing policy, route readiness, or publication boundaries. Source and test review includes all three new test files. The final documentation reconciliation and test response charset change do not alter reviewed product behavior.
- Verification/review receipt and transient logs archived outside the repository at `/tmp/trial-personal-plan-access-verification/`. This is review-ready local work, not a deployed fix. Full authenticated live checkout/login/SSR verification remains a post-deployment check; no production accounts were modified.

## Pre-merge review correction

GitHub review identified a valid billing-outage edge case: `/chat` is not redirected by the recovery frontier, so an exception in the new paid-access recheck fell through to legacy onboarding. Track whether that recheck was attempted and use the existing retryable 503 response when it throws on any affected route. This leaves unrelated frontier-failure and authorization behavior unchanged. The expanded regression first reproduced `/chat` returning 307, then verifies 503 without a redirect for Stripe and PayPal on routine, application and chat with freemium both on and off. This is recovery handling within the already authorized journey, with no new access-policy decision.
