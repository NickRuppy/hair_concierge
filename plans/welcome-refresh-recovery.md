# Preserve checkout activation on refresh

## Contract and decision coverage

Status: confirmed. Scope: repair the already approved post-authorization account activation journey; no new billing, access, pricing, UI design, copy, or provider decisions. Nick's existing instruction authorizes implementation and full live deployment; on 14 September he reported that refreshing the activation screen sent him to the landing page. The approved free-trial journey and account activation design remain the planning evidence and journey sign-off. This patch restores that journey rather than redesigning it.

Internal revalidation: production /welcome with the original Stripe session still renders Konto aktivieren. CheckoutReturnAnalytics removes the query with history.replaceState; the server redirects bare /welcome to /. Both evidence lanes identify the same lost-context bug. Decision buckets: product/UX/access/payment unchanged; data is temporary per-tab browser recovery only; existing server verification and expiry remain authoritative; deployment is the authorized guarded main release. Undiscussed consequential assumptions affecting this handoff: none.

## Implementation defaults

- Before sanitizing /welcome's address for analytics, save only a canonical Stripe session_id or PayPal provider/token/purchase/return_state return path in sessionStorage.
- Expire the hint after 24 hours without returning to the activation page, scoped to the tab, not localStorage or cookies. This is a navigation hint, never authorization. Do not persist passwords, email, or provider payment details.
- Bare /welcome runs an invisible client recovery component, with a no-JavaScript landing redirect. No new interstitial or copy is introduced. It consumes valid recovery data and replaces the location with the canonical original return path. Missing, malformed, expired, or unavailable data retains the existing landing fallback. Only /welcome with recognized parameters is recoverable; no arbitrary redirect destinations.
- Legacy PayPal subscription hints are additionally capped at the server-provided original checkout-intent expiry; the verified trial lane keeps its existing separate clock. Never renew a legacy intent deadline through a browser reload.
- Save before URL cleanup. If saving fails, preserve the original URL and skip return analytics. Keep current sensitive-URL suppression in global analytics.
- Starting authenticated navigation clears recovery state; errors and email-link request state remain refreshable. Restoration does not create another checkout, change trial dates, submit auth, or send email.
- Existing server provider/account checks run again on the restored request; no backend billing or authorization changes.

## Verification and release

Add a red-capable browser/component regression for return -> query cleanup -> document reload -> original activation route, for Stripe and PayPal; cover blocked storage, malformed/expired state, arbitrary URLs, repeated refresh and privacy order. Run surrounding analytics and activation checks, Node22 typecheck/lint/build, independent Opus5/high read-only review, applicable CI, guarded merge and verify the production alias. Do not click owner auth/payment controls or send a login email. The owner retries the same existing trial.

Commit this plan and regression evidence as code/tests. Archive transient review/verification receipts outside the repository. Preserve unrelated worktrees.

## Target map and ordered tasks

1. `src/app/welcome/return-recovery.ts`: canonical provider return paths and per-tab hint save/consume/clear; reject arbitrary destinations and expired state. Acceptance: focused unit cases and browser round trips.
2. `src/app/welcome/checkout-return-analytics.tsx`, `page.tsx`, `return-recovery-client.tsx`, `welcome-client.tsx`: persist before scrub; restore on bare reload; clear on authenticated navigation. Acceptance: original provider reference on repeated reload, unchanged server authorization and activation form.
3. `src/providers/meta-pixel-provider.tsx`: delegate /welcome PageViews to its existing return component, skipping the invisible recovery document. Acceptance: exactly one sanitized PageView per displayed activation document, not two per refresh.
4. `tests/welcome-return-recovery.test.ts`, `tests/welcome-return-recovery.spec.ts`, `playwright.config.ts`: real analytics/recovery components in browser navigation fixture; Chromium CI and local mobile WebKit coverage. Acceptance: regression fails with original analytics component and passes with fix, including blocked storage and completion cleanup.
5. Review, verify, publish and guarded main deployment. Commit all listed files and this plan; archive `/tmp/welcome-refresh-*` review/verification receipts outside Git. No migration or provider configuration mutation.

## Preserved designed journey and evidence

Nick reviewed the actual activation form, and his screenshot shows the unchanged Konto aktivieren surface. The initial checkout URL loads that form, analytics clean the address, a reload now restores the same provider proof and same form, and the user completes the previously approved password or login-link flow. Failed auth stays retryable. Bare welcome without a hint keeps the landing fallback; JavaScript-disabled original returns were never scrubbed. Recovery creates no new user-visible screen. Existing authenticated destinations are retained.

## Verification, risks and rollback

Commands: `node --import ./tests/server-only-register.cjs --import tsx --test tests/welcome-return-recovery.test.ts tests/acquisition-funnel-tracking.test.ts tests/welcome-email-display.test.tsx tests/analytics-runtime.test.ts tests/sentry-client-filter.test.ts tests/stripe-trial-account-activation.test.ts tests/meta-pixel.test.ts`; `npx playwright test tests/welcome-return-recovery.spec.ts --project=chromium --project=webkit-mobile-action`; Node22 `npm run ci:verify`. Browser tests carry @ci, included by existing Chromium smoke CI. No chat/retrieval change.

Residual limits: no recovery for an already-scrubbed old page until the owner reopens the original return URL, unavailable tab storage falls back to retaining the URL, and a bare URL alone carries no recovery proof. Provider rejection keeps existing failure handling; the consumed hint is removed before retry so it cannot create an automatic loop. Actual owner email delivery remains unverified until the owner acts.

Rollback: revert this isolated merge through a guarded main deployment, or restore the immediately previous known deployment for an incident. Billing state/configuration and existing trial dates are untouched. Verify production alias plus bare welcome route and scoped runtime errors after deployment; no optional emails or production authorization calls.

## Plan review rulings

Opus5/high agreed with the lost-query diagnosis. Its proposed duplicate-revenue blocker is false for the current routing: purchase_completed and subscription_started route only to Meta (`src/lib/analytics/routes.ts`), whose purchase/subscribe functions deduplicate by sessionStorage keys (`src/lib/meta-pixel.ts`). Re-run those existing tests rather than add a second competing deduplication layer. Reopening the original checkout URL was already supported; provider/account idempotency is unchanged and existing activation regression tests are included.

The review's new-interstitial concern is removed by the invisible recovery component. The recovery hint is consumed before server re-verification, so server failure cannot retain a looping hint. SessionStorage avoids proxy/cookie changes and cross-tab overwriting; it persists only credentials already present in this same tab's URL/props and never becomes new server authority. Suppressing all welcome analytics, adding server state, new flags or reopening approved billing choices would expand this repair and are rejected. The counterpart is Claude because Codex is orchestrator, per AGENTS.md and Nick's explicit Opus5/high instruction; Claude-specific instructions to invoke Codex are inapplicable here.

Open consequential assumptions: none. Original approval is Nick's continuing full implementation/deployment instruction and the approved post-authorization activation flow. Current internal revalidation is this bounded repair; no new acknowledgement is invented.

## Whole-branch review resolution

Opus5/high completed a read-only whole-branch review. Codex verified and resolved its material findings:

- Legacy PayPal intent expiry is now passed from the already-read server intent into the browser hint; reload never extends that deadline. Trial admission bypasses that legacy TTL in the existing provider code and remains unchanged.
- The serialized hint uses the same size bound on write and read; a value that cannot be recovered never permits URL cleanup.
- The global Meta provider skips bare /welcome; the existing return component owns the sanitized PageView. Browser assertions collect events across document reloads to catch the extra-pageview regression.
- The actual built Next bare route and JavaScript-disabled fallback are now committed @ci browser tests, replacing the brittle source-regex guard. The local fixture remains for deterministic provider navigation and storage failures.
- The blocked-storage fixture now enables both paid conversion branches; the lab pathname's deliberate no-cleanup behavior is documented and covered.

The review's older next/link/interstitial comments refer to a superseded intermediate version; the final component only navigates and supplies a no-JavaScript meta redirect. Its restoring ref is retained because React StrictMode repeats passive effects; consume-once without that guard can send the second effect to the landing fallback. The already-clean URL branch preserves same-page activation state and does not establish server authority. No new commercial or access decision is introduced by these repairs. Final delta verification and readiness are owned by Codex.
