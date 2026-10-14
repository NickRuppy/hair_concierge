# Auth/runtime test-value ledger — read-only, 2026-10-02

Task checkout: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, parent-pinned base/HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Other workers' existing edits were observed and untouched. No repository edits, tests, compiler, mutation, browser, provider/network/DB calls or environment-file reads in this lane. This is a proposal, not a validation receipt.

## Scope and accounting

All declarations, fixtures and helper bodies in the four assigned suites were read: auth-post-checkout-routes.spec.ts (1,676 lines/54 declarations), auth-middleware-personal-plan-routine.test.ts (1,075/47), checkout-activation.spec.ts (987/32), authenticated-app-route-access.test.ts (179/15): **148 declaration sites total**. No whole-tree completeness claim. Loop rows remain one declaration each.

Proposed classification: **140 R, 3 F, 2 C, 3 D**. C/D would remove **5 original declaration sites**, conditional on transfers and native verification; **4** if the UI consolidation C2 is deferred. Zero executed removals in this lane, zero coverage claims. No new declaration required for these transfers/repairs. Keep execution-count changes distinct from declaration counts.

Fully read supporting tests: welcome-activation-outcomes.spec.ts and welcome-plan-opening-bridge.test.ts. welcome-return-recovery.spec.ts was partially read; its first harness renders a synthetic activation heading and is not a WelcomeClient keeper. Discovery participant routing was read only around handoff routing/sanitizer callers. Other matching suites were inventory/search only and are not asserted to be stronger keepers.

Fully read production modules: both auth submission route modules, deprecated send-setup-link route, authenticated-app-route-access.ts. Auth confirm, middleware, checkout activation and WelcomeClient were read in the relevant named functions/branches; checkout activation is 1,572 lines and was not fully read. Actual caller excerpts read in welcome/page.tsx, tracker/layout.tsx and scan/page.tsx. This ledger does not claim all provider/trial implementation internals were reviewed.

## Owner and reachability evidence

- `src/app/auth/confirm/route.ts`: actual GET -> handleAuthConfirmGet -> handleAuthConfirm. Redirect sanitization is private sanitizeAuthIntendedPath; exported sanitizeAuthRedirectPath is a test wrapper but also serves discovery credential-fragment tests. Auth redirect/recovery logic is live and distinct from middleware cleanup. Do not delete sanitizer cases just because wrapper is test-only.
- `src/app/api/auth/set-checkout-password/route.ts` and `send-magic-link/route.ts`: actual POST builds live dependencies and calls separately implemented handlers. Each has its own Stripe/PayPal, subscription/one-time dispatch, claim, error and side-effect sequencing. Similar assertions across these files do not imply same owner execution.
- `src/lib/stripe/checkout-activation.ts`: verifyCheckoutSessionForActivation -> retrieveCheckoutSessionForActivation -> assertCheckoutSessionActivatable. The subscription verifier checks shape/payment/preparation directly and never retrieves a subscription. ensureCheckoutAccount separately checks actual subscription ownership/current period, auth metadata and reset cutoff, then profile/billing writes. Actual callers include welcome/page.tsx, both auth submission routes, webhook-handlers.ts (fulfillment paths), one-time activation-status and freemium purchase completion. No claim of obsolete subscription paths.
- `src/lib/supabase/middleware.ts`: actual createUpdateSession owns current access, trial history, ended/unavailable moderator recomputation and frontier/intake routing. Lines583-598 recompute active from independently paid or partner access for ended/unavailable moderator. Tracker excludes intake reads, chat has special frontier behavior, scan has its own shell exception; same responses on different routes need not be redundant.
- `src/lib/auth/authenticated-app-route-access.ts`: tracker/layout.tsx uses loadTrackerRouteAccess; scan/page.tsx uses loadScanRouteAccess and loadScanPageTier. resolveScanPageTier aliases the real route-agnostic tier owner, which passes user id/email/guest into access composite. Profile layout and gated-preview also consume generic loader. No alias/public contract deletion inferred from identifier age.
- send-setup-link POST remains a compatibility410 route and is explicitly allowlisted by middleware/route-classification and listed in seo-metadata-routes.test.ts. Only handleSendSetupLink is test-only duplication; preserve route and allowlists.

History inspected: auth fixes `8a5e42c2` (#559), email-bound moderator/reset `69f1651d` (#472), post-payment `f2eb7cfa` (#354); middleware trial launch `318cf157` (#549), partner robust `5a3e33f1` (#537), scanner funnel `f8c28328` (#534); tier history `f3790784` (#526), scan MVP `96f9e71c` (#455), tracker optimization `db320bd6` (#390); checkout one-time recovery `0d29b871` (#293), prewarm `ae323f72` (#260). The specific diff `252fc185` (sunset SEPA checkout sessions) introduced the unpaid SEPA/card/offered cases and moved payment authorization into a direct session predicate. History supports preserving paid recovery and SEPA input regressions, not treating legacy as retired.

CI: package.json:49 test:node includes both assigned .test.ts suites. package.json:69 test:playwright:contracts explicitly includes auth-post-checkout-routes.spec.ts; CI calls these at .github/workflows/ci.yml:158 and180. checkout-activation.spec.ts is **not** in that contracts script: its four @ci cases are reached by full browser CI's --grep @ci at311; the other 28 need explicit native focused invocation. welcome-activation-outcomes is enclosed in @ci describe, so proposed DOM keeper participates there. None of this was rerun.

## Removal/repair details

### D1 — bare allowed tier (access:120, keeper:134)
Delete only `scan page tier: a paid-access composite of 'allowed' is premium`. Keeper `an email-only manual/moderator grant is premium ...` executes the same resolveScanPageTier -> resolveAuthenticatedAppPageTier -> getEntitlements branch and asserts premium plus exact [user-1, grant@example.com, false] composite arguments. The fake paid composite returns allowed only for correct email. Lost assertions: none; bare premium equality retained. No transfer/source/support cleanup. Changing allowed handling to free should fail keeper; no mutation run here.

### C1 — denied tracker duplicate (middleware:279 ->301)
Keeper is explicit `flag off: FREEMIUM_SCANNER_FIRST_ENABLED unset still redirects tracker to reactivate (byte-identical)`. Both use currentAccess=false, userAppMetadata={}, GET /tracker and same307/exact reactivate location. Move observedTables=[] and frontierCalls={count:0} into existing301, pass into createMiddleware, and append the three assertions excluding profiles/hair_profiles and requiring zero frontier calls. Preserve keeper's flag save/delete/restore. Then delete279. This strengthens the already identical response scenario, not a table-row merge. No production/source cleanup. Validation must detect an introduced tracker intake/frontier read even while response stays correct; restored keeper must pass afterward.

### D2 — weaker ended moderator (middleware:596, keeper:657)
Both assert307 /test/haarplan/beendet for GET /routine with empty metadata and ended moderator.596 starts currentAccess=false and defaults paid/partner false.657 starts stale currentAccess=true, explicitly paid=false/partner=false; real middleware583-598 overwrites current access with independent evidence before the same ended branch. Keeper catches mistakenly trusting still-active tester grants that weaker case would miss. Lost assertions none; no transfer/support/source cleanup. Keep607 (/chat),619 outage,630 paid,645 partner and734 partner-metadata-only: distinct branches. Mutation omitting independent recomputation should fail657; not run.

### D3 — unpaid card fixture duplicate (checkout:923, keeper:913)
Delete only complete-unpaid/default-card declaration. Both verifier calls retrieve the same complete subscription Session shape/payment_status=unpaid (different id only) and expect checkout_session_unpaid. default_payment_method differs inside subscriptions.retrieve, which this actual verifier never calls.913 is the canonical SEPA sunset guard;933 separately supplies payment_method_types on the actual retrieved Session and stays. No lost effective input/assertion, transfer or production cleanup. Keep helper subscription stub because913/933 deliberately document rejected historical bypass options; no unsupported provider call needed. An actual-owner mutation admitting unpaid sessions must be killed by913/933. No mutation run.

### C2 — source inventory into real activation DOM (auth-post:1656 -> welcome-activation-outcomes:113)
Keeper `email send failure keeps password input and allows a successful resend` mounts actual WelcomeClient via esbuild; only external effects are stubbed. Before its existing actions, assert visible Konto aktivieren heading, Chaarlie-E-Mail input value alex@example.com and readonly attribute, Mit Passwort and Mit Login-Link headings, Passwort wiederholen input, Passwort erstellen button and Login-Link senden button. Existing case then exercises login-link endpoint, visible send failure, preserved password and successful retry. No new declaration, synthetic replacement markup or provider interaction. No need to change isTrialCheckout: actual activation controls are the same.

Exact lost/retired assertions: source `readOnly` becomes DOM readonly; activation text/controls become rendered checks. `not.toContain('send-setup-link')` becomes positive observed /api/auth/send-magic-link request plus request count; arbitrary source text occurrence is not a consumer contract. `not.toContain('zuruecksetzen')` is only ASCII source spelling and does not prove no password-reset flow; retain activation choice DOM/button assertions, do not invent a new prohibition on all reset copy. `Zahlung erfolgreich` appears only in unrelated generic redirect branch WelcomeClient:509, not activation UI. Retire that exact copy inventory assertion explicitly; generic confirmation behavior is independently pinned by existing welcome-plan-opening-bridge.test.ts third test (Weiterleitung/no-JS link), but that static sibling is **not** claimed to prove this exact caption. If exact caption is considered a settled product contract by parent, defer C2 or transfer it to an actual generic redirect render before counting removal. I found no need to treat incidental static caption spelling as architecture authority.

After transfers remove1656; readFileSync remains needed by342 and1671. No source component edits. Relevant controls: change actual email readonly to editable; remove actual login-link choice; each must fail retained browser keeper. Native browser run required; Node suite alone cannot validate C2.

### F1 — missing-profile duplicate Auth repair (checkout:602)
stubDeps createUser duplicateEmails branch at94-107 inserts profiles[id] before returning422. Thus602 never reaches createCheckoutUser's findAuthUserIdByEmail fallback (owner1380+ /1555+); asserted profile was already supplied by the test. Override createUser in this case only to return email_exists/422 **without inserting a profile**; seed only Auth user, add admin.listUsers returning it, count call/arguments and assert profile absent at lookup, then assert actual fulfillment creates expected profile/subscription and denies initial password. Preserve575 (profile appears in race) and635 (matching marker cannot turn duplicate creation into password permission). No permanent production change. An actual-owner mutation bypassing listUsers fallback or returning null should fail repaired602 while original falsely passes. No declaration reduction.

### F2 — deprecated actual route repair (auth-post:1645)
Import actual POST as a named alias and call it; assert status410 and await response.json() exact German error. Current helper returns a separate plain object, so changing actual POST status would leave old test green. Remove handleSendSetupLink export and RouteResult type from route after verifying callers remain test-only (search found sole import here). Keep DEPRECATED_SETUP_LINK_ERROR, actual POST and route allowlists. Remove old test import. Exact title should describe410 response; no injected dependencies are needed because POST has no side effects. Actual POST status200 mutation is the meaningful control. No declaration reduction.

### F3 — invalid-body ordering oracle (auth-post:354)
Current calls[] only observes Supabase operations; checkRateLimit and verifyCheckoutSessionForActivation stubs do not append to it. Preserve400/session error and add independently counted limiter and checkout-verifier dependencies with zero assertions. An output-preserving early limiter or verifier call before body rejection must fail. This repairs the existing explicit before-rate-limit-or-Stripe claim without inferring every dependency is public contract. No declaration reduction.

## Native verification and remaining limits

These commands are plans, not executed evidence; parent controls frozen compiler/test windows and environment policy:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/auth-middleware-personal-plan-routine.test.ts tests/authenticated-app-route-access.test.ts
npx playwright test tests/auth-post-checkout-routes.spec.ts tests/checkout-activation.spec.ts tests/welcome-activation-outcomes.spec.ts --project=chromium --workers=1
```

Before/after deletion, run candidate native cases including old assertions before transfer, then keeper controls against actual owner changes, restoring source after each. Parent must include Node and Playwright owner coverage in its fixed full coverage comparison; running Node alone misses54+32 assigned PW declarations and DOM keeper. The checkout suite has no required browser/provider fixture, whereas auth-post history and welcome DOM do require local Chromium. Existing config/environment handling remains parent-owned; this lane did not load .env or invoke runners.

No production obsolescence was proved in this scope. The low deletion yield is grounded in live security/recovery branches, not a blanket assertion that internal identifiers are contracts. Pending risks: C2 deliberately retires exact unrelated caption inventory; F1 changes exercised branch and may reveal a real fallback defect; whole-suite coverage and mutations have not run. No changes made to assigned files.

## Per-declaration decisions

Each row names the existing declaration and concrete observed value; R means retained at current evidence, not a claim that its mock boundary fully integrates production dependencies.


### tests/auth-post-checkout-routes.spec.ts — 54 declarations

| Line / declaration | Verdict | Evidence / disposition |
|---|---|---|
| 102 — auth confirm keeps only same-origin relative next paths | R | Seven concrete sanitizer cases cover relative destinations, auth-query scrubbing, confirm-loop rejection, protocol-relative URLs, backslashes and external origins. The expired-confirm route sibling covers only two inputs; no complete stronger keeper. Test-only wrapper also serves discovery handoff tests, so deletion is not unlocked here. |
| 116 — auth confirm resolves Supabase redirect_to without overriding ordinary login links | R | Nested Supabase redirect_to, ordinary login fallback and foreign-origin rejection are distinct from direct next parsing and actual PKCE success. |
| 133 — auth confirm allows password recovery links to land on password setup | R | Nested redirect_to preserves /auth/update-password. Recovery route tests use direct next; no identical nesting coverage demonstrated. |
| 141 — authenticated auth cleanup cannot resurrect an expired-link screen through Back or Forward | R | Real browser Back/Forward against local HTTP redirects invokes actual buildAuthenticatedAppRedirectUrl. Platform history regression cannot be replaced by helper return-value checks; harness is not a complete middleware integration. |
| 221 — authenticated consumed Personal Plan confirmation replays its sanitized destination | R | Consumed authenticated code replays allowed /plan-start and does not relink quiz. Different from successful verification. |
| 236 — authenticated consumed plan-bereit confirmation preserves its safe query | R | Consumed /plan-bereit retains safe lead query, a separate allowlisted destination from /plan-start. |
| 250 — signed-out expired confirmation retains only its sanitized next destination | R | Expired signed-out flow exposes login error with sanitized next and rejects external destination. Different signed-in recovery path at221. |
| 271 — authenticated failed confirmation cannot replay an unallowlisted internal path | R | Authenticated failed code rejects an internal path outside the explicit replay allowlist; same-origin alone is insufficient. |
| 295 — verified PKCE recovery reaches password setup even without a recovery type | R | Successful PKCE recovery reaches password setup without type=recovery. Distinct from normal signup and failed exchange. |
| 307 — failed PKCE recovery stays on the forced recovery surface | R | Failed PKCE stays forced recovery; cannot inherit successful PKCE proof. |
| 323 — verified and failed OTP recovery preserve password recovery semantics | R | Both verified and failed OTP recovery preserve recovery semantics; OTP verifier differs from PKCE exchange. |
| 342 — password-reset emails stamp the explicit PKCE recovery destination | R | Checks real recovery URL builder and source callsite passes it to resetPasswordForEmail. No fully inspected real auth-form submit keeper replaces callsite evidence; static layer retained pending stronger boundary. |
| 354 — rejects missing request body before rate limiting or Stripe work | F | Missing-body response is real but calls[] records only Supabase, not checkRateLimit/verifyCheckoutSessionForActivation. Add counters for those dependencies and assert zero; see F3. |
| 364 — rejects weak passwords before changing anything | R | Weak password returns400 and no observed Supabase mutation. Do not claim its calls[] proves all provider work was skipped; invalid-body ordering repair F3 is separate. |
| 377 — returns 429 when the checkout session is rate limited | R | 429 includes checkout-session rate-limit identity and monitoring context with no Supabase writes. |
| 410 — returns 503 when the rate-limit service is unavailable | R | Rate-limit backend outage maps503, distinct from a verified429 denial. |
| 424 — returns the consumed-claim recovery when the checkout account cannot set an initial password | R | Verified account cannot set initial password maps consumed-claim recovery409 without credential mutation. |
| 442 — merges app metadata, clears activation hash, and confirms email on success | R | Successful password update merges existing metadata, clears marker, writes initialization timestamp and confirms email using verified identity. |
| 473 — rejects password creation when the checkout activation was already claimed | R | Claim contention blocks credential mutation409, before the later marker reread protection. |
| 488 — releases the checkout activation claim if password creation fails | R | Failed password update releases claim and returns retryable503. Distinct successful release state from stuck claim. |
| 509 — password update failure with a stuck claim returns login recovery | R | Update plus release failure maps login recovery409 and monitoring, avoiding promise of retry. |
| 535 — rejects when the activation marker no longer matches immediately before update | R | Marker changed after claim blocks update; this race is not equivalent to initial canSetInitialPassword=false. |
| 552 — does not trust client email when verifying or updating checkout activation | R | Client email is rejected in favor of server-verified checkout email, preserving account ownership. |
| 585 — password activation uses the verified Stripe one-time account path | R | Password route dispatches verified Stripe one-time session to one-time account owner, not subscription owner. |
| 618 — password activation accepts PayPal intent tokens and uses provider-owned email | R | Password PayPal subscription intent uses provider-owned email and token-specific limiter/metadata, distinct dispatcher branch. |
| 664 — password activation fallback links quiz metadata when fulfilling checkout | R | Tests password-route forwarding of quiz-link callback into fulfillment; mock invokes callback so this is wiring proof only, not actual link persistence. No stronger route keeper inspected. |
| 706 — password activation returns the server-resolved personal-plan transition | R | Password route derives personal-plan transition from server lead instead of client destination. |
| 755 — terminal trial denial returns a typed recovery without password or OTP side effects | R | Typed terminal trial denial excludes both credential-update and OTP effects across two separately implemented handlers. |
| 788 — invalid provider references are safe and do not start auth side effects | R | Typed invalid provider reference maps safe response without private details or auth effects. |
| 805 — Stripe resource-missing errors are treated as invalid activation references | R | Raw Stripe resource_missing converts to invalid activation recovery; provider error differs from typed domain error. |
| 821 — persistent provider validation maps to reconciliation instead of a retry loop | R | Persistent validation maps reconciliation503 instead of retry loop, preserving paid recovery. |
| 839 — PayPal subscription pending returns status-retry recovery before auth side effects | R | PayPal pending subscription remains recoverable without auth effects across both handlers. |
| 868 — inactive PayPal subscriptions return support recovery on both auth submissions | R | Inactive PayPal subscriptions map support recovery and telemetry for both submissions; differs from pending and Stripe errors. |
| 909 — typed reconciliation causes are retained in checkout monitoring | R | Typed reconciliation retains original monitoring cause while response stays safe. |
| 941 — send magic link derives email from checkout activation and consumes matching password marker | R | Magic route verifies email, forbids account creation, sends OTP and consumes matching password marker. Separate owner from password update. |
| 1036 — magic-link activation uses the verified Stripe one-time account path | R | Magic route independently dispatches Stripe one-time fulfillment; password dispatcher success cannot prove it. |
| 1084 — Stripe one-time password setup refuses paid-pending activation without setting credentials | R | Paid-pending Stripe one-time blocks password credentials; fulfilled one-time is separate state. |
| 1113 — Stripe one-time magic link refuses paid-pending activation before OTP send | R | Paid-pending Stripe one-time blocks OTP in independently implemented magic handler. |
| 1159 — PayPal one-time auth recovery uses the canonical order activation, not subscriptions | R | PayPal one-time password recovery uses canonical order activation rather than subscription path. |
| 1193 — PayPal one-time password setup refuses paid-pending activation | R | Paid-pending PayPal order blocks credentials, distinct from subscription pending and Stripe one-time. |
| 1229 — PayPal one-time magic-link recovery uses the canonical order activation | R | PayPal one-time magic handler independently dispatches canonical order activation. |
| 1273 — magic-link activation derives the personal-plan destination server-side | R | Magic route server-owned personal-plan lead becomes OTP redirect destination, distinct output channel from password response. |
| 1335 — send magic link accepts PayPal intent tokens and consumes the provider marker | R | PayPal magic path uses provider marker/intent identity and consumes marker after sending. |
| 1400 — send magic link stays successful if activation marker cleanup fails after OTP send | R | Successful OTP followed by cleanup failure remains success and reports failure, preventing duplicate sends. |
| 1437 — magic-link activation fallback links quiz metadata when fulfilling checkout | R | Magic handler forwards quiz-link callback; mock invokes it. Retain wiring only, do not credit as persistence integration or duplicate password owner. |
| 1486 — send magic link rejects when the checkout activation was already claimed | R | Already-claimed magic link returns409. Removing claim guard would send OTP or hit unstubbed auth path, not preserve response. |
| 1506 — send magic link reports app rate limits to checkout Sentry context | R | Application magic-link rate limit maps429 and reports the correct source/context. |
| 1535 — send magic link releases the checkout activation claim if email sending fails | R | OTP send failure releases claim and returns500, distinct from post-send cleanup failure. |
| 1563 — magic-link send failure with failed claim release does not promise a resend | R | OTP failure plus release failure maps login recovery409 without promising resend or exposing private message. |
| 1589 — send magic link reports Supabase Auth email-send rate limits to checkout Sentry context | R | Supabase email throttle maps429 and distinguishes provider rate-limit telemetry from application limiter. |
| 1627 — send magic link requires only session_id and reports non-leaky German errors | R | Empty magic-link input yields exact safe German400; route has independent parsing from password. |
| 1645 — deprecated setup link route returns 410 without side effects | F | Tests duplicate handleSendSetupLink return object, not actual POST. Retarget same declaration to POST.status and POST.json; remove unused test-only export/type, preserve410 route. See F2. |
| 1656 — welcome activation UI renders password and login-link choices with a read-only email | C | Move meaningful activation DOM assertions to real WelcomeClient retry browser keeper113; retire unrelated/unowned text/source inventory assertions explicitly. Conditional C2, not covered today. |
| 1671 — magic link template keeps Supabase redirect target instead of hardcoding onboarding | R | Deployed Supabase email HTML forwards RedirectTo instead of hardcoded onboarding; browser mocks bypass the external template, so their success does not replace this contract. |

### tests/auth-middleware-personal-plan-routine.test.ts — 47 declarations

| Line / declaration | Verdict | Evidence / disposition |
|---|---|---|
| 192 — released routing ignores obsolete internal rollout environment | R | Actual default frontier path ignores obsolete rollout environment and routes307 /plan-start. Environment-name coverage is intentional release compatibility, not evidence route is dead. |
| 254 — field-test user with current access and a pending proposal reaches /routine | R | Field-test guest with current access and pending proposal reaches routine; differs from ordinary paid onboarding gate. |
| 266 — tracker skips proxy intake and Personal Plan frontier reads | R | Admitted tracker avoids profiles/hair_profiles/frontier reads. Denied tracker sibling owns a different branch. |
| 279 — tracker still redirects an authenticated user without current access to reactivate | C | Same no-access tracker scenario as explicit flag-off301; transfer two observedTables exclusions and frontierCalls=0 to301 then remove. See C1. |
| 301 — flag off: FREEMIUM_SCANNER_FIRST_ENABLED unset still redirects tracker to reactivate (byte-identical) | R | Primary keeper for279: explicitly saves/deletes/restores freemium flag and asserts exact307 location. Receives no-read assertions. |
| 321 — flag on: a free authenticated user (no current access) reaches /tracker instead of being sent to reactivate | R | Enabled flag admits free tracker; inverse of explicit disabled flag and not the same effective branch. |
| 338 — flag on: a free authenticated user without current access is still gated on a non-admitted route (POST /api/chat stays subscription_required) | R | Enabled flag denies non-read/non-admitted API methods including mutations; preserves authorization despite free shells. |
| 365 — expired trial cannot fall back to free pages or keepsake APIs; recovery stays reachable | R | Expired trial never falls into free/keepsake access while recovery remains reachable; distinct historical access state. |
| 393 — verified current access takes precedence over trial history and unavailable history never opens previews | R | Current paid access overrides historical trial, while unavailable trial lookup fails closed503 for inactive user. |
| 425 — flag on: GET /api/chat and GET /api/chat/[id] are admitted for keepsake reads (T17) | R | Enabled free GET chat list/detail remains readable; mutation denial cannot prove read exceptions. |
| 444 — flag off: GET /api/chat is still subscription_required (byte-identical) | R | Disabled flag still denies GET chat; independently protects rollout-off contract. |
| 461 — flag on: a free authenticated user reaches the /scan page shell without being bounced to onboarding | R | Enabled free scan shell bypasses intake/frontier reads; tracker path does not exercise scan-specific handling. |
| 483 — flag on: needs_onboarding + no paid access reaches /anwendung without being bounced to onboarding | R | Enabled free Anwendung bypasses onboarding for preview; separate route from scan/tracker. |
| 505 — flag on: a one-time-access owner (active, but hasCurrentAppAccess false) at needs_onboarding is still redirected to /onboarding from /anwendung (I1 regression) | R | Enabled one-time owner still requires onboarding despite currentAccess=false; prevents classifying paid one-time as free preview. |
| 528 — flag off: a one-time-access owner at needs_onboarding is redirected to /onboarding from /anwendung (baseline) | R | Disabled one-time owner retains onboarding baseline; flag branch differs from505. |
| 547 — chat retains proxy intake and preserves redirect query parameters | R | Chat retains intake and preserves lead/tab query when redirected; tracker intentionally skips these reads. |
| 569 — a pending proposal does not grant /anwendung before an active routine exists | R | Pending proposal without active routine does not grant Anwendung;254 routine admission is intentionally different. |
| 576 — field-test access fails closed when the app-access check is false | R | Synthetic field guest with denied app access routes ended; moderator lookup is intentionally skipped for guest. |
| 585 — email-bound moderator access reaches gated app routes without a synthetic guest marker | R | Email-bound active moderator without synthetic marker gets tracker access; grant path distinct from ordinary currentAccess. |
| 596 — an ended moderator account receives the field-test end state unless paid access is valid | D | Routine ended moderator denial is subsumed by657 with stale currentAccess=true and explicit denied paid/partner; owner overwrites active from independent evidence before same ended branch. See D2. |
| 607 — an ended moderator cannot retain access through its still-active tester grant | R | Ended tester grant cannot retain /chat access;657 covers /routine, not chat's special frontier bypass. |
| 619 — an unavailable moderator lookup with only its tester grant returns unavailable | R | Unavailable moderator with only tester grant yields503, not ended redirect or free view. |
| 630 — an ended moderator with independently verified paid access remains admitted | R | Independent paid entitlement rescues ended moderator, unlike stale tester grant. |
| 645 — an ended moderator with an active partner grant remains admitted | R | Independent active partner entitlement rescues ended moderator without paid access; separate dependency from630. |
| 657 — an ended moderator without paid or partner access is still routed to the ended screen | R | Primary keeper596: stale currentAccess=true is overwritten by independent paid=false/partner=false; exact routine ended redirect. |
| 676 — a partner grant with a fresh-start profile is routed from /chat to /quiz, not /reactivate or /onboarding | R | Partner fresh-start no hair profile routes chat to quiz, not stale onboarding or reactivate. |
| 697 — a currently paying account that also carries partner metadata keeps ordinary /chat access | R | Current ordinary access plus partner metadata keeps chat; metadata must not route established paid customer into moderator flow. |
| 715 — an ended moderator with independently verified paid access and partner metadata passes through /chat unredirected | R | Ended moderator with independent paid access and partner metadata passes chat; currentAccess=false forces independent recovery. |
| 734 — an ended moderator with partner metadata but no independently verified access is still routed to the ended screen | R | Partner metadata without independently verified access cannot rescue ended moderator; metadata is not entitlement. |
| 748 — a moderator access lookup outage is unavailable rather than an expiry or paywall | R | Moderator outage preserves503 text/page and503 JSON/API semantics, rather than expiry redirects. |
| 766 — a personal-plan lookup error preserves legacy onboarding protection | R | Returned personal-plan lookup error falls back to legacy onboarding gate; catch/returned-error handling differs from thrown failure. |
| 775 — a thrown personal-plan lookup preserves legacy onboarding protection | R | Thrown personal-plan lookup falls back safely; error-object test cannot exercise exception catch. |
| 784 — an eligible new buyer follows the Personal Plan frontier instead of legacy onboarding | R | Eligible buyer follows stage1 frontier to plan-start rather than legacy onboarding. |
| 796 — a Stage 1 frontier no longer bounces chat into the Personal Plan flow | R | Ordinary stage1 chat remains reachable; special moderator branch intentionally differs. |
| 808 — an activated moderator returns to the saved plan instead of legacy onboarding | R | Activated moderator chat returns to saved stage1 plan;796 ordinary buyer cannot replace this identity branch. |
| 822 — an activated moderator return stays in recovery while its plan is not ready | R | Moderator unreadiness stays plan-bereit recovery rather than empty app/legacy onboarding. |
| 835 — an activated moderator return cannot fall through to legacy onboarding on a routing outage | R | Moderator routing outage returns unavailable, distinct from ordinary chat fallback. |
| 846 — an eligible buyer with an unready source stays in readiness recovery | R | Buyer unready source routes readiness recovery;822 uses special moderator path. |
| 858 — a routing-frontier outage cannot silently fall through to legacy onboarding | R | Routine frontier outage gives503 with headers/body instead of silently choosing legacy onboarding. |
| 872 — a routing-frontier outage leaves chat to the intake gate | R | Chat frontier outage deliberately defers to intake, both with and without active routine; not interchangeable with858. |
| 895 — chat stays reachable across the Personal Plan frontier | R | Existing loop covers multiple real frontier states and guest/moderator/recovery cohorts; one declaration, no row regrouping credit. |
| 959 — chat without a routine pointer, quiz or entitlement keeps the intake gate | R | Chat lacking routine pointer, quiz or entitlement preserves distinct onboarding/quiz intake outcomes; one declaration. |
| 986 — explicit legacy onboarding edits are not intercepted by the Personal Plan frontier | R | Explicit legacy onboarding editing bypasses frontier takeover. Reachable supported edit workflow, not obsolete merely named legacy. |
| 1002 — synthetic guest access does not depend on the unrelated moderator membership lookup | R | Synthetic guest does not depend on unrelated moderator outage; guest is explicit short-circuit. |
| 1009 — flag off: a subscription buyer at needs_onboarding reaches /scan without a personal_plans lookup | R | Disabled-flag subscription scan avoids personal_plans read even needs_onboarding; enabled free shell has different caller/state. |
| 1035 — flag off: the same subscription buyer is still sent to /onboarding from /chat and /anwendung | R | Same disabled subscription still requires onboarding on chat/Anwendung, unlike scan route exclusion. |
| 1056 — flag off: a user without any paid access is still bounced off /scan by the paywall | R | Disabled no-access scan still paywalls;1009 only admitted subscription branch. |

### tests/checkout-activation.spec.ts — 32 declarations

| Line / declaration | Verdict | Evidence / disposition |
|---|---|---|
| 219 — ensureCheckoutAccount creates a fresh paid user with hashed checkout activation metadata | R | Fresh paid account hashes activation marker, writes profile/subscription and allows initial password. Actual ensureCheckoutAccount, not mocked route callback. |
| 252 — ensureCheckoutAccount reuses an existing email and denies initial password setup | R | Existing email cannot reset initial password; account ownership differs from fresh creation. |
| 288 — ensureCheckoutAccount allows password setup for an existing checkout-created user with matching activation metadata | R | Matching unconsumed checkout marker enables initial password for existing checkout-created account. |
| 322 — ensureCheckoutAccount denies password setup when the matching activation marker is consumed | R | Consumed matching marker cannot re-enable password, independent initialization timestamp guard. |
| 355 — ensureCheckoutAccount reuses an existing Stripe customer and does not create duplicates | R | Existing Stripe customer wins over changed email, preventing duplicate accounts. |
| 388 — ensureCheckoutAccount rejects conflicting email and Stripe customer profiles before writes | R | Conflicting email/customer ownership fails before writes; distinct conflict from absence. |
| 409 — ensureCheckoutAccount pins an existing Stripe subscription to its billing owner | R | Billing subscription ownership pins account even if profile identity differs; entitlement authority is security relevant. |
| 433 — ensureCheckoutAccount rejects marked owner callbacks at or before the reset cutoff | R | Moderator reset cutoff rejects stale session/subscription callbacks, preserving reset revocation. |
| 473 — ensureCheckoutAccount permits a marked owner only for fresh session and subscription timestamps | R | Both provider timestamps after cutoff allow marked owner, necessary positive boundary. |
| 513 — ensureCheckoutAccount fails closed for marked owners with missing Stripe creation timestamps | R | Missing creation timestamps fail closed for reset-marked owner; null security case not equal old timestamp. |
| 539 — ensureCheckoutAccount fails closed when current Auth metadata cannot be read | R | Unreadable current Auth metadata fails closed; cannot safely infer reset/activation state from profile. |
| 562 — ensureCheckoutAccount is idempotent on repeated fulfillment | R | Repeated fulfillment is idempotent; one-shot fresh account does not prove replay writes. |
| 575 — ensureCheckoutAccount treats duplicate createUser races as an existing account | R | Duplicate createUser race with profile now visible resolves existing account;602 needs repair to restore missing-profile branch, not deletion of575. |
| 602 — ensureCheckoutAccount creates a missing profile for duplicate auth users | F | Shared duplicateEmails stub inserts profile before duplicate error, so asserted missing-profile recovery never runs. Test-specific no-profile duplicate + listUsers stub needed. See F1. |
| 635 — ensureCheckoutAccount denies password setup for duplicate createUser races even with matching activation metadata | R | Duplicate createUser race with matching metadata still denies password setup, stronger than plain no-marker race and distinct from ordinary existing matching marker. |
| 664 — ensureCheckoutAccount still resolves when linkQuizToProfile rejects | R | Actual owner tolerates quiz-link failure and still fulfills paid account. Route forwarding tests cannot prove this catch behavior. |
| 677 — ensureCheckoutAccount can defer quiz profile linking until after the account is active | R | Owner defers quiz linking until activated when requested; separate scheduling contract from best-effort failure. |
| 704 — ensureCheckoutAccount rejects inactive checkout subscriptions | R | Inactive subscription statuses rejected by ensure owner before entitlement writes; paid session alone is insufficient. |
| 726 — ensureCheckoutAccount rejects expired checkout subscriptions | R | Expired subscription rejected despite active status, time boundary distinct from status704. |
| 749 — @ci ensureCheckoutAccount rejects an unclaimed prepared checkout before activation | R | Unclaimed prepared checkout cannot activate through ensure owner, even if browser/session verification were bypassed. |
| 768 — @ci ensureCheckoutAccount activates a claimed prepared checkout with valid identifiers | R | Claimed valid identifiers activate successfully; positive preparation admission. |
| 778 — @ci ensureCheckoutAccount rejects a claimed prepared checkout with an invalid identifier | R | Claimed malformed identifier denied, distinct shape from unclaimed preparation status. |
| 791 — verifyCheckoutSessionForActivation returns complete paid sessions | R | Verifier retrieves and returns complete paid session; ensure receives session object and cannot replace retrieval boundary. |
| 808 — verifyCheckoutSessionForActivation accepts a server-retrieved paid one-time session without a Stripe customer | R | Paid one-time verifier accepts no customer/subscription, using different one-time contract from subscription session. |
| 855 — @ci verifyCheckoutSessionForActivation rejects an unclaimed prepared checkout | R | Verifier itself rejects unclaimed prepared session before activation; ensure749 is a distinct public caller boundary. |
| 877 — verifyCheckoutSessionForActivation accepts complete sessions with no payment required | R | no_payment_required is allowed explicitly; paid positive alone would not detect accidental narrowing. |
| 897 — verifyCheckoutSessionForActivation rejects incomplete sessions | R | Open/incomplete session rejected despite paid status; independent completion condition. |
| 913 — verifyCheckoutSessionForActivation rejects complete unpaid sessions even if subscription default payment method is SEPA | R | Primary unpaid keeper: real verifier rejects complete unpaid session even with SEPA subscription stub. History252fc185 sunset. Different subscription method is never read on this boundary. |
| 923 — verifyCheckoutSessionForActivation rejects complete unpaid sessions even if subscription default payment method is card | D | Same real retrieved session shape/payment as913 (id differs only diagnostic), card data lives in never-called subscriptions.retrieve. No unique assertion; retain913 and933. See D3. |
| 933 — verifyCheckoutSessionForActivation rejects complete unpaid sessions even if SEPA was offered | R | Actual retrieved Session lists SEPA among offered methods; protects against historical offered-method bypass independently from913's subscription fixture. |
| 946 — verifyCheckoutSessionForActivation rejects missing session id input | R | Missing session id fails before dynamic live Stripe client import/retrieval; distinct precondition. |
| 952 — verifyCheckoutSessionForActivation rejects returned sessions missing required fields | R | One declaration checks missing id/email/customer/subscription; each required field has a distinct owner validation, no count inflation by rows. |

### tests/authenticated-app-route-access.test.ts — 15 declarations

| Line / declaration | Verdict | Evidence / disposition |
|---|---|---|
| 41 — tracker boundary only checks the authenticated user | R | Actual tracker resolver allows authenticated user without quiz/intake deps; production tracker layout calls loader. |
| 46 — tracker boundary fails closed without an authenticated user | R | Null user closes tracker to quiz; null differs from thrown read. |
| 51 — tracker boundary fails closed when the authenticated-user read is unavailable | R | Thrown auth read closes tracker to quiz, catches service error. |
| 62 — scan boundary allows an authenticated user with a completed quiz | R | Actual scan resolver accepts complete quiz, unlike tracker auth-only boundary. |
| 67 — scan boundary redirects without an authenticated user | R | Null user closes scan before profile read; tracker is separate implementation. |
| 72 — scan boundary redirects when the quiz diagnostics are incomplete | R | Incomplete/null diagnostics close scan; security prerequisite differs from authentication. |
| 79 — scan boundary redirects when a single quiz field is missing | R | Single missing field closes scan despite mostly valid profile, guarding incomplete projection acceptance. |
| 88 — scan boundary fails closed when the authenticated-user read is unavailable | R | Thrown scan auth read closes safely; independent scan owner catch. |
| 99 — scan boundary fails closed when the hair-profile read is unavailable | R | Thrown hair-profile read closes safely after auth; distinct dependency position. |
| 120 — scan page tier: a paid-access composite of 'allowed' is premium | D | Bare allowed=>premium is strictly subsumed by134 email-grant scenario which returns allowed and additionally asserts exact composite args. See D1. |
| 127 — scan page tier: a paid-access composite of 'denied' is free | R | Denied=>free branch is independent from allowed/unavailable, actual tier algorithm. |
| 134 — scan page tier: an email-only manual/moderator grant is premium (C1 repro) — the nav classification's id-only lookup would have called this user free | R | Primary keeper120: only correct email passthrough makes access allowed, then premium; asserts user id, grant email and false guest. |
| 151 — scan page tier: a field-test guest is passed through to the paid-access composite | R | Field-test metadata yields true guest argument;134 explicitly nonguest. |
| 169 — scan page tier: fails closed to premium (never free) when the paid-access composite is unavailable | R | Unavailable entitlement lookup fails closed to premium, distinct allowed branch. |
| 176 — scan page tier: no authenticated user is premium (never free) | R | No auth user returns premium before paid access lookup; protects never-free signed-out default. |
