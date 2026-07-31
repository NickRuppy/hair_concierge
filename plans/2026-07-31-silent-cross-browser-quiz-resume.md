# Silent cross-browser quiz resume

## Outcome and source context

Personal-plan quiz progress survives an Instagram/Facebook in-app-browser to Safari/Chrome handoff without asking or encouraging the user to switch browsers. The quiz remains visually and behaviorally unchanged for users who stay in one browser.

This plan incorporates the product correction that continuity should be passive infrastructure, not another quiz decision. It is grounded in the current personal-plan draft implementation in `src/lib/personal-plan-quiz/draft.ts`, the personal-plan quiz client in `src/components/personal-plan-quiz/personal-plan-quiz.tsx`, first-party funnel attribution under `src/lib/funnel/`, and the existing prepared-artifact claim pattern under `src/lib/personal-plan-quiz/persistence.ts`.

Nick confirmed the passive designed journey and accepted its documented trade-offs on 2026-07-31. The first rollout is limited to feature-flagged Meta personal-plan traffic; expansion to other entry paths requires evidence from that cohort and separate approval.

That confirmation explicitly accepts a short-lived opaque query credential being visible in the native browser address bar and confirms the 24-hour sliding lifetime with a seven-day absolute cap. Both remain privacy-review and infrastructure-log gates before rollout; acceptance of the product trade-off does not waive those technical gates.

The implementation was finalized and rebased onto `origin/main` at `cbdeb066` after the personal-plan screen-transition and mobile CTA-motion work landed. Resume hydration treats restored state as initial state, not as an animated forward/back transition, and preserves the reduced-motion, synthetic outgoing-layer, and fixed mobile action behavior.

External pattern evidence:

- Shopify and BigCommerce persist cart intent outside one browser session.
- Jotform exposes server-backed save-and-continue session links for long forms.
- Stripe documents limited express-payment support in in-app webviews.
- OWASP permits carefully controlled URL-token flows but requires strong randomness, expiry, secure storage, rotation or invalidation, rate limiting, and leakage controls.

## Chosen direction

Add a best-effort server-backed personal-plan quiz draft alongside the existing local draft. After the first committed answer, create the server draft asynchronously and place only a short-lived opaque handoff token in the current quiz URL. Do not render a prompt, banner, button, toast, or explanatory copy.

Normal autosaves use a scoped HttpOnly browser cookie, not the URL token. The URL token is a one-time cross-browser exchange credential. When the same quiz URL opens in a browser without the matching current draft cookie, the server atomically validates and rotates the token, issues a new scoped cookie and replacement handoff token, restores the latest saved draft, and rebinds the original funnel-session context. The replacement token remains silently present so a later browser handoff can work again.

The exchange must complete through a server redirect before `/lp/haarplan` renders and before `LandingTracking`, PostHog, Customer.io, or Meta providers mount. `src/proxy.ts` may mint a temporary destination-browser funnel cookie on the first request; the exchange response then overwrites it with the validated original funnel context and redirects to the clean landing render with the replacement resume token. The final request therefore enters the existing proxy and client bootstrap with the original funnel cookie already authoritative.

This path is chosen over:

- account or email-based syncing, because identity is intentionally captured only at the end of the quiz;
- self-contained answers in the URL, because hair and scalp answers must not appear in URLs, analytics, logs, browser history, or referrers;
- a visible “open in browser” control, because it introduces a decision and suggests that the current browser is inadequate;
- reusing the prepared-plan claim, because it is a higher-value late-funnel credential with different lifetime and attachment semantics.

## Scope and non-goals

In scope:

- silent server-draft creation after the first committed durable answer;
- best-effort autosave after each subsequent committed answer or screen transition;
- one-time token exchange and rotation on cross-browser resume;
- scoped HttpOnly cookie authentication for draft reads and writes;
- restoring durable answers, current screen, restorable history, quiz version, revision, and original funnel-session reference;
- preserving existing local-draft behavior as the immediate and offline fallback;
- expiry, revocation, purging, rate limiting, conflict control, privacy protections, and operational telemetry;
- feature-flagged rollout limited initially to Meta personal-plan traffic and an actual Instagram/Facebook-to-Safari/Chrome device matrix.
- a dedicated `PERSONAL_PLAN_QUIZ_DRAFT_COOKIE_SECRET` must be configured before the server flag can be enabled; missing secret configuration fails closed without creating or rotating drafts.

Non-goals:

- no new visible UI, German copy, browser detection message, modal, banner, or browser-switch CTA;
- no account creation, email capture, SMS, magic-link email, or abandoned-quiz campaign;
- no cross-device discovery when the resume URL is not transferred;
- no persistence of email, consent, checkout state, payment data, loading animation progress, or conversion-admission/microcommitment state;
- no change to quiz questions, ordering, branching, progress, result generation, pricing, checkout, Meta delivery, or payment provider behavior;
- no reuse or broadening of `/result/<leadId>` or prepared-plan bearer capabilities.

Confirmed concurrent-browser v1 behavior:

- **Destination browser wins.** A successful cross-browser exchange increments the active generation and makes the destination authoritative for server autosaves. A stale source browser may continue using its existing local draft, but it cannot overwrite or fork the resumed server draft. Nick confirmed this lean rule on 2026-07-31 after counterpart review.

## Target map

Likely new surfaces:

- a migration for a service-role-only `personal_plan_quiz_drafts` table with token hash, browser generation/revision, sanitized draft JSON, funnel-session reference, status, timestamps, and expiry;
- `src/app/api/quiz/personal-plan-draft/route.ts` or narrowly separated create/update/resume handlers, including a pre-render exchange-and-redirect entry point;
- `src/lib/personal-plan-quiz/server-draft.ts` for a new partial-safe strict schema, cookie encoding, expiry, state validation, and conflict rules;
- focused API, persistence, security, and browser tests under `tests/`.

Likely existing surfaces:

- `src/components/personal-plan-quiz/personal-plan-quiz.tsx` for non-blocking creation, autosave, resume bootstrap, token URL replacement, page-hide flush, and cleanup;
- `src/lib/personal-plan-quiz/draft.ts` to reuse the canonical answer sanitizer and restorable draft shape;
- `src/lib/personal-plan-quiz/index.ts` for exports where needed;
- `src/proxy.ts`, `src/lib/funnel/cookie.ts`, and `src/lib/funnel/server.ts` to order the pre-render exchange and reissue the original first-party funnel context without trusting client-supplied attribution;
- `src/lib/analytics/page-url.ts`, PostHog runtime tests, and Sentry configuration to classify and redact the resume parameter everywhere;
- personal-plan lead completion handling to revoke the server draft and remove the resume token before result navigation;
- funnel/feature flags for staged exposure.

Implementation must locate and test the actual Vercel/Sentry request-URL logging seams before finalizing the URL parameter name. Do not assume application-level analytics sanitization covers infrastructure access logs.

## Designed user journey

### Entry and ordinary completion

1. A person taps a Meta ad and starts `/lp/haarplan` inside Instagram or Facebook.
2. The first screen, every question, navigation control, loading state, and transition look exactly as they do today.
3. After the first committed durable answer, Chaarlie creates a recoverable server draft in the background. Quiz interaction never waits for this request.
4. Each later committed answer updates both the immediate local draft and, best effort, the server draft. The current URL silently gains an opaque handoff parameter; it contains no answer or identity data.
5. If the person stays in the in-app browser, nothing new is shown. They complete the quiz normally.
6. On successful lead creation, Chaarlie revokes the server draft, clears its cookie and URL token, and continues to the existing result journey.

### Independent browser switch

1. At any point after the first server-draft creation, the person independently uses Instagram/Facebook’s own “open in browser” action.
2. The operating system opens the exact current quiz URL in Safari or Chrome.
3. Before the quiz page or its tracking providers render, Chaarlie exchanges and rotates the one-time handoff token, restores the latest successfully saved durable answers and restorable screen/history, issues a new scoped browser cookie, restores the original funnel cookie, and redirects into the normal landing render with a replacement handoff token.
4. The person sees the same quiz screen with prior durable selections present. There is no “welcome back” prompt and no resume decision.
5. The original Meta funnel session remains the attribution authority even though browser-local analytics identifiers may differ.
6. Further answers autosave from the new browser, and its replacement handoff token supports another later switch.

### Same-browser reload or return

1. The current browser’s matching scoped cookie and local draft identify it as the active browser generation.
2. Chaarlie restores through the existing local path immediately and reconciles with the newer valid server revision if necessary.
3. No token rotation, prompt, or visible recovery screen occurs unless existing preparation recovery already requires it.

### Failure and recovery

- If server-draft creation or autosave fails, the current quiz remains fully usable and retains today’s local-draft behavior. A later answer retries silently with bounded backoff.
- If the user switches before a server draft exists, the destination browser starts fresh; no misleading restoration claim appears.
- A `pagehide`/visibility flush uses a best-effort keepalive request, but the plan does not promise that the final in-flight answer always reaches the destination.
- An expired, malformed, replayed, revoked, or rate-limited token reveals no draft existence or answer data. The destination falls back to a fresh quiz while the original browser’s local draft remains intact.
- On concurrent use, a successful exchange makes the destination browser authoritative. Stale-generation writes cannot overwrite or fork the newer server draft; the stale source browser remains usable with local-only persistence.
- At `plan_loading` or `email_capture`, the destination may recreate the existing short-lived prepared artifact from the restored durable answers; the cross-browser draft does not transport or weaken the prepared-plan claim.

User-journey sign-off: **confirmed by Nick on 2026-07-31 after the passive journey and trade-offs walkthrough**.

## Mockup evidence

No mockup is required because the chosen direction explicitly adds no user-facing surface, copy, prompt, timing dependency, or feedback state. The acceptance condition is visual equivalence to the current quiz in ordinary, autosave-failure, and resumed states. Browser screenshots before and after implementation will be used as regression evidence, not as a new design artifact.

Mockup review status: **not applicable — zero-surface infrastructure change**.

## Ordered tasks

### 1. Lock the persistence and privacy contract with failing tests

- Define a new partial-safe strict server-draft schema from `PersonalPlanQuizDraft`; every durable answer field remains optional mid-quiz, while unknown fields, email, consent, ephemeral admissions, microcommitments, prepared claims, payment data, and unsupported quiz versions are rejected.
- Do not call the completed-submission `durableAnswersSchema` or `canonicalizePersonalPlanAnswers`: they require all final fields and would throw or reject valid partial drafts. After strict validation, reuse `sanitizePersonalPlanQuizAnswers` for the allow-listed partial shape and make the reject-versus-drop contract explicit in tests.
- Specify a 256-bit random handoff token stored only as a SHA-256 hash, a separate signed/scoped HttpOnly browser cookie, a 24-hour sliding expiry capped at seven days from creation, and explicit `active`, `completed`, and `expired` semantics.
- Extract or reuse the existing tested random-token and SHA-256 helpers from `src/lib/personal-plan-quiz/persistence.ts`; do not introduce a second crypto implementation with different entropy or encoding.
- Prove that invalid, expired, replayed, wrong-generation, or brute-forced credentials return uniform responses and no state.
- Extend the existing personal-plan draft, prepared-plan, lead-persistence, funnel-cookie, funnel-migration, and analytics-runtime test precedents.
- Completion criterion: contract tests fail for the absent implementation and cover partial canonicalization, strict unknown-field rejection, expiry, rotation, revision conflicts, and forbidden data.

### 2. Add the service-role-only server draft store

- Add the minimal table, indexes, RLS lock-down, purge function, and atomic create/update/resume/revoke functions or equivalent transactional server logic.
- Follow the existing prepared-artifact token/hash/RLS/purge pattern rather than creating parallel security semantics. The repository uses forward-only migrations; rollback is the feature flag plus safe expiry/purge, not a destructive down migration.
- Link the draft to the existing `funnel_sessions` row only after resolving it from the trusted signed funnel cookie; never accept an arbitrary client session ID as attribution authority.
- Make resume rotation and browser-generation increment atomic.
- Completion criterion: migration tests prove no anon/authenticated table access, unique token hashes, bounded retention, safe purge behavior, monotonic revisions, and atomic replay rejection.

### 3. Add bounded draft APIs and cookies

- Create non-blocking create/update/resume/revoke endpoints behind a dedicated flag.
- Enforce request-size limits, schemas, origin/CSRF posture appropriate to same-site cookie writes, per-IP plus credential-aware rate limits, uniform failure responses, and no-store responses.
- Make a resume URL request enter a server exchange-and-redirect path before the landing component and analytics providers render. The exchange validates the stored `funnel_sessions` reference, reconstructs the original `{ visitorId, sessionId, packageKey }`, rotates the handoff token, issues the new draft cookie, overwrites any temporary destination cookie minted by `src/proxy.ts`, and redirects to the normal landing URL with the replacement token.
- After a successful exchange, reject stale-generation server writes uniformly while leaving the stale browser's existing local draft untouched; do not create server-side recovery forks in v1.
- Completion criterion: API tests cover success, same-browser reload, absent/invalid cookies, token replay, destination-wins exchange, stale local-only source behavior, redirect ordering, rate limits, flag-off behavior, and attribution rebinding without accepting client-forged context or recording a spurious destination funnel session.

### 4. Add silent client orchestration without changing quiz behavior

- Keep localStorage writes synchronous with current state behavior.
- Create the server draft only after the first committed durable answer and never block selection or navigation on it.
- Put the opaque handoff token in the current URL with `window.history.replaceState`, preserving the current `{ ppq }` state and supplying the URL argument without router navigation or pageview duplication. Existing no-URL `pushState` quiz entries must inherit the token through forward navigation and remain compatible with the current `popstate` back handler.
- Autosave only the same durable `answers`, `screen`, and restorable `history` snapshot used by the existing local-draft effect. Never persist `PersonalPlanQuizEphemeralState`. Coalesce rapid changes, preserve update ordering, retry boundedly, and attempt a keepalive flush on page hide.
- On bootstrap, prefer the local draft for immediate paint, then accept only a newer valid server revision; on a foreign-browser token exchange, restore before recording the resumed screen view.
- Hydrate the restored screen/history before `draftReady` and without calling the forward/back transition capture. Clear any outgoing-layer state so resume never snapshots or animates stale DOM; retain the current reduced-motion behavior from PR #280.
- On lead completion, strip the resume token with ordered `replaceState`, revoke the server draft, clear the local draft and prepared claim, and only then call the existing result `router.push`.
- Completion criterion: component/integration tests prove identical screen progression, no added rendered elements or copy, no navigation delay, deterministic restore precedence, non-animated initial resume hydration, unchanged subsequent motion/reduced-motion behavior, and cleanup on completion.

### 5. Close URL, telemetry, and logging leaks

- Verify rather than rebuild the existing owned-analytics protection: `buildSafeAnalyticsPath` already drops all query parameters outside `/result`, and PostHog pageviews and Replay already pass through that sanitizer. Add the exact handoff parameter to `SENSITIVE_BROWSER_QUERY_KEYS` and sentinel regression tests as defense in depth.
- Confirm PostHog pageviews and Replay, Customer.io, Meta events, browser referrers, application logs, error reports, API payload logs, Sentry request URLs, and infrastructure request logs never retain the raw token. Confirm the deployed `Referrer-Policy` is not looser than the current `strict-origin-when-cross-origin` policy.
- Preserve the canonical Meta event-source URL and original funnel-session attribution; do not merge browser identities merely because the quiz resumed.
- Completion criterion: unit/contract tests contain sentinel tokens and assert their absence from every owned telemetry payload; inability to prove or configure Sentry/Vercel infrastructure-log protection is a hard rollout blocker, not a documented residual risk.

### 6. Verify real browser handoff behavior before exposure

- Test actual paid-social-style entry and “open in browser” handoff on current Instagram and Facebook apps for iOS Safari and Android Chrome, including fragments/query preservation, back behavior, private browsing, content blockers, slow network, backgrounding, and killed-app recovery.
- Confirm the exact current URL, token, and latest saved revision reach the destination without a visible prompt from Chaarlie.
- Completion criterion: the supported device matrix has captured evidence for successful restore; any platform that strips or rewrites the credential remains flag-disabled rather than receiving an unproven fallback.

### 7. Roll out as an evidence-producing capability

- Expose only to a small Meta personal-plan cohort while retaining local-only control traffic; do not broaden eligibility without a separate evidence-backed decision.
- Record operational events for draft creation outcome, autosave outcome, cross-browser resume success/failure reason, stale conflict, expiry, and completion after resume. Never put tokens or raw answers in event properties.
- Compare quiz completion, lead capture, offer view, and purchase outcomes while monitoring latency, write volume, error rates, purge health, and suspicious resume attempts.
- Completion criterion: rollout has a named owner, kill switch, dashboard/query, retention check, and decision threshold for expansion or rollback.

## Verification

Automated checks:

- deterministic unit tests for draft sanitization, token hashing/rotation, cookie verification, expiry, revision/generation conflict rules, and URL sanitization;
- migration/RPC contract tests for RLS, transactional exchange, purge bounds, completion revocation, and replay behavior;
- API tests for flags, rate limits, uniform errors, request limits, CSRF/origin handling, no-store responses, and attribution rebinding;
- component tests proving no additional DOM/copy and unchanged progression while create/save requests are slow, rejected, or unavailable;
- analytics and Sentry sentinel-token tests;
- existing personal-plan quiz, funnel attribution, PostHog, prepared-artifact, lead-persistence, mobile UX, and checkout contract suites.
- `npm run ci:verify` after focused suites pass.

Manual/browser checks:

- current personal-plan quiz at representative mobile and desktop sizes with pixel/screenshot comparison showing no ordinary-journey UI change;
- Instagram iOS to Safari, Instagram Android to Chrome, Facebook iOS to Safari, and Facebook Android to Chrome using current production-like app versions;
- same-browser reload, browser back, duplicate-tab, concurrent old/new browser, offline/reconnect, slow save, expired token, replayed URL, private mode, and completion cleanup;
- verify result and checkout URLs contain no resume credential and the original funnel session still joins lead/offer/checkout events.

Migration/live-state checks:

- linked migration status before enabling the flag;
- RLS and grants from anon/authenticated/service-role perspectives;
- expiry/purge job health and bounded row growth;
- sampled production telemetry and infrastructure logs checked for a known sentinel token before cohort expansion.

Evidence-sensitive review:

- security/privacy review of the bearer-style handoff capability and retained hair/scalp answers;
- reconciled counterpart-model plan review before implementation;
- `implementation-loop` must run `ready-check` and `request-code-review` on the completed branch before review-ready handoff.

## Review and handoff

- Worktree: `.worktrees/silent-cross-browser-quiz-resume`
- Branch: `codex/silent-cross-browser-quiz-resume`
- Plan artifact: **commit with the eventual implementation PR**.
- No mockup artifact is created because there is intentionally no new surface.
- Counterpart review: completed on 2026-07-31 with an “approve with revisions” verdict; verified technical findings are incorporated, one funnel claim was corrected against `src/proxy.ts`, and the transient report will be discarded after reconciliation.
- Whole-tree counterpart code review: completed read-only on 2026-07-31 against fingerprint `c88ac41c80e2e00557bae375a911aa8706c97a5c3e5f88c5cf90a146224d03f1`. Its one blocking bfcache finding was fixed and regression-tested; the fail-open landing-read hardening and proportional handler tests were also added. The transient report remains outside the repository.
- User-journey sign-off: confirmed on 2026-07-31; the confirmed behavior is silent background continuity with no browser-switch nudge or resume decision.
- Publication, migration application, flag enablement, production testing, and cohort expansion each remain separately approval-gated.
- Stop point: implementation is published in PR #287 for exact-head merge after final review gates. Migration application, flag enablement, production testing, and cohort expansion remain separately approval-gated.

### Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | Completed-submission schema requires every answer; partial drafts do not | accepted | Added a new partial-safe strict schema and prohibited completed canonicalizer reuse | Focused schema tests plus existing draft/lead suites |
| C2 | defect | Query credentials can reach Sentry or infrastructure logs beyond app sanitizers | accepted | Made Sentry/Vercel evidence a hard rollout stop; narrowed owned analytics work to verification | Sentinel-token tests and deployed-log preflight |
| C3 | defect | Funnel attribution must be authoritative before tracking providers mount | accepted with corrected evidence | Specified pre-render exchange/redirect; recognized existing `src/proxy.ts` cookie minting | Redirect/cookie-order integration tests and browser inspection |
| C4 | defect | Quiz uses synthetic History API entries and ordered completion cleanup | accepted | Specified state-preserving `replaceState`, inherited token URLs, and cleanup before result navigation | Browser Back/Forward and completion tests |
| C5 | defect | Server autosave could accidentally include intentionally ephemeral conversion state | accepted | Bound server snapshot to the existing durable local-draft shape | Payload contract tests |
| C6 | tradeoff | Full stale-browser fork recovery adds complexity for a rare initial-cohort case | accepted by Nick | Chose destination-wins/local-only v1 and prohibited server-side draft forks | Generation and stale-write integration tests |
| C7 | scope/product decision | Opaque token is visible in the native address bar | accepted by Nick | Recorded explicit acceptance while retaining privacy/logging gates | Privacy review and real-device inspection |
| C8 | scope/product decision | 24-hour sliding expiry with seven-day cap exceeds prepared artifact's one-hour TTL | accepted by Nick | Recorded explicit retention choice; no prepared-claim reuse | Expiry/purge tests and privacy review |
| C9 | tradeoff | Reviewer suggested Claude-oriented `codex:codex-rescue` finish gate | rejected | Retained current Codex workflow: `implementation-loop` -> `ready-check` -> `request-code-review` | Repository `AGENTS.md` workflow |

### Whole-tree code-review findings ledger

| ID | Severity/type | Evidence | Decision | Implementation change or residual control | Revalidation |
| --- | --- | --- | --- | --- | --- |
| R1 | high defect | A revision-advancing `pagehide` keepalive could make a bfcache-restored JS heap permanently stale | accepted and fixed | Skip keepalive when `PageTransitionEvent.persisted` is true; retain best-effort keepalive for real unloads and process delivered responses | Deterministic bfcache/non-persisted lifecycle tests, focused suite, typecheck, full build |
| R2 | low-medium availability | A thrown landing read RPC could fail the returning-user render | accepted and fixed | Landing resolution now fails open to no snapshot and proceeds through the clean resume exchange/fallback path | Thrown-read regression plus direct handler gate tests |
| R3 | low security/product tradeoff | A holder can induce another browser to adopt the holder's draft/funnel context | accepted residual | This is inherent to a transferable bearer resume capability; the attacker receives no victim data and atomic rotation prevents replay. Monitor suspicious exchanges and keep cohort flag-limited | Security review, rate limits, token rotation, rollout telemetry |
| R4 | low attribution edge | Clearing the touch cookie can mint a new pending touch on redirect | accepted residual | Database first-touch remains immutable once recorded; live rollout must verify original-session joins | Source contract test plus device-matrix attribution check |
| R5 | low operations | Purge RPC exists but no in-repository schedule is installed | deferred to release gate | Confirm or install the production scheduler before enabling the flag; monitor bounded row growth | Linked migration status and purge-job health |
| R6 | medium test gap | Atomic SQL concurrency is source-tested but not executed against a linked database in this worktree | deferred to release gate | Added proportional direct handler tests; require transactional replay/generation checks against the linked database before enablement | Supabase-linked migration/RPC preflight |
| R7 | high defect | A real-unload keepalive could race one in-flight autosave at the same expected revision and lose the newest state | accepted and fixed | Make the first real-unload flush the terminal write for that JS heap, mark only that keepalive for a same-generation catch-up bounded to exactly one missed revision, and sequence responses so an older 409 cannot latch stale | Deterministic tests for both response orders including a queued latest draft, payload/RPC contract checks, focused suite, typecheck, full build |
| R8 | medium defect | A replayed token fallback cleared the stale source cookie, allowing its next write to create a second active draft | accepted and fixed | Preserve a valid signed stale cookie on failed exchange so the next write follows the generation-guarded update path and becomes local-only on 409; invalid and absent cookies are still cleared | Direct valid/invalid fallback regression tests plus focused server suite |
