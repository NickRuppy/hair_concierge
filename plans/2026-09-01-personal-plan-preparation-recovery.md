# Personal Plan preparation resilience

## Outcome

Personal Plan preparation is replay-safe and protected without exposing healthy users to a shared-IP quota. A legitimate journey continues through the normal preparation screen, including one bounded self-healing retry when necessary. Stage 3 keeps its accessibility focus without showing a browser-default blue outline on the non-interactive heading.

## Confirmed root cause

- `/api/quiz/personal-plan-prepare` shares `quiz-lead` (20 requests per IP per hour) with lead submission.
- Repeated QA can exhaust that shared bucket; unrelated people behind one NAT could consume the same allowance.
- The client retries every non-success response immediately, including `429`, consuming more rejected attempts.
- A response lost after artifact creation can cause another artifact to be inserted because preparation has no server replay identity.
- Stage 3 deliberately focuses `main h1` after transitions, but Safari draws its default blue outline because this flow lacks the scoped focus rule used elsewhere.

## Chosen architecture

### Replay-safe preparation

- The browser creates a stable preparation credential before the request:
  - `preparationId`: UUID v4, used as the prepared artifact ID;
  - `claimToken`: 32 random Web Crypto bytes encoded as base64url;
  - `answersKey`: binds the credential to the exact answer set.
- Bind the pending credential to the quiz's existing `getAnswersKey` identity and store it in session storage before the first fetch; retain an in-memory fallback when storage is unavailable.
- Extend the strict prepare request schema with a paired `preparationId` and `claimToken`.
- During rollout, also accept requests with neither field so an already-open page from the previous deployment still completes through the former server-generated credential behavior. Reject partial pairs. Newly loaded pages always use the replay-safe browser credential.
- The server hashes the client-provided token exactly as lead claiming already does and writes the client UUID as the artifact primary key.
- Add an atomic `prepare_personal_plan_artifact` security-definer RPC that takes the already-built artifact plus the client credential. It locks by preparation ID, reuses an existing row only when answer hash, token hash, and moderator ownership match, or inserts once when absent.
- Exact `prepared`, `attached`, and `superseded` replays return the same artifact ID, token, and stored expiry; this preserves already-successful lead attachment. An expired unclaimed artifact, mismatched credential/answers/owner, or a token collision against another ID fails closed with `409`.
- On success, persist the existing ready claim before clearing the pending credential. A lost response or page reload can therefore safely repeat the same request.

### Layered abuse protection

- Do not reuse any lead bucket.
- Run the cheap IP backstop before moderator or journey resolution so abusive traffic cannot force those lookups first.
- Then resolve the strongest verified journey identity already available: authorized moderator user, signed Personal Plan draft, then signed funnel session.
- Apply `10 requests / 10 seconds` to that journey identity. A normal client uses one request and at most one retry.
- Apply a separate high IP backstop of `100 requests / 10 seconds`, using only the first trusted forwarded address. This is not the user identity; it is an emergency application-cost ceiling.
- Schedule the existing expired-rate-limit cleanup every five minutes so short-window rows and their request identifiers do not accumulate indefinitely.
- When no verified journey identity resolves, skip the journey bucket and retain only the IP backstop; never collapse anonymous requests onto one shared constant key.
- Return the real fixed-window `Retry-After` on `429`; keep rate-limit infrastructure failure as `503` without a wait promise.
- Keep Vercel platform DDoS protection as the outer perimeter. Any new WAF dashboard rule is a separate production configuration approval and is not part of this code change.
- Rollback uses an ordinary code redeploy. The RPC migration is additive and the current server-generated artifact path remains schema-compatible, so the previous application version can run unchanged after rollback; no separate runtime kill-switch is added.
- Release ordering is migration first, then application deployment. The previous application remains compatible during that interval; the new application must not be promoted before the RPC exists.

### Client recovery

- Keep the normal preparation UI; do not add rate-limit copy, a countdown, or a quota screen.
- On the first `429`, stop immediate retrying, parse the bounded `Retry-After` (maximum 10 seconds), remain in the ordinary loading state, and retry once at the boundary.
- Never make more than two total preparation attempts for one invocation.
- A repeated `429`, malformed/missing wait header, network failure after the existing retry, or server failure falls into the concise saved-answers recovery already used by the flow.
- A replay conflict or mismatched success receipt discards only the pending credential and automatically retries once with a fresh credential instead of repeating a guaranteed conflict.
- Record a privacy-safe server warning with only the rejected limiter scope (`journey` or `ip`), never its identifier.

### Stage 3 focus presentation

- Preserve programmatic `h1` focus.
- Reuse the existing `data-stage3-progress` shell attribute and mirror the existing transition-heading rule for `[tabindex="-1"]:focus { outline: none }`.
- Do not alter keyboard focus presentation for interactive controls or headings in other flows.

## Scope and non-goals

In scope: preparation credentials and replay contract, rollout-compatible request validation, route replay behavior, journey/IP rate configurations, bounded client retry behavior, privacy-safe warning, Stage 3 focus presentation, and regression tests.

Not in scope: changing lead limits, changing the shared database rate-limit primitive, a new quota/error screen, a global focus reset, recommendation behavior, Vercel dashboard writes, deployment, or production data writes.

## Designed journey

1. The user finishes the hair analysis. The browser persists one preparation credential and starts preparation.
2. The server verifies the journey, applies high-headroom protection, and creates the artifact once.
3. Success remains unchanged. The browser stores the ready claim and continues.
4. If the response is lost, the same credential replays the already-created artifact; no duplicate is inserted.
5. If an abnormal burst reaches a short-window ceiling, the user stays on the ordinary loading screen while one server-timed retry occurs within at most ten seconds.
6. If that one recovery attempt also fails, answers remain saved and the existing concise retry state appears. There is no rate-limit explanation or countdown.
7. Stage 3 transitions continue announcing the new heading to assistive technology without drawing a blue ring on static text.

## Target map

- `src/lib/personal-plan-quiz/persistence.ts`: strict preparation credential schema and shared token validation/hash contract.
- New small browser preparation helper under `src/lib/personal-plan-quiz/`: Web Crypto credential generation, session persistence, and bounded `Retry-After` parsing.
- New additive Supabase migration: atomic preparation insert/replay RPC with exact mismatch and state guards.
- `src/app/api/quiz/personal-plan-prepare/route.ts`: dependency-testable handler mirroring `createPersonalPlanLeadPostHandler`, IP-first protection, verified journey identity, RPC persistence, and privacy-safe warning.
- `src/lib/rate-limit.ts`: dedicated short-window journey and IP configurations.
- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`: stable pending credential and bounded retry orchestration; no new user-facing state.
- Existing `data-stage3-progress` shell seam plus the global stylesheet: scoped Stage 3 heading focus rule.
- Focused route, helper, quiz, and Stage 3 tests.

## Implementation tasks

1. Add red tests against the planned handler/helper/RPC seams proving repeated credentials create one artifact/return one claim, mismatches fail closed, journey and IP budgets are independent from leads, one `429` waits once without an error screen, a second stops, and Stage 3 remains focused without an outline.
2. Implement the browser credential and storage contract.
3. Add and exercise the atomic replay RPC, refactor the prepare route behind injectable dependencies, then implement layered protection and persistence through that RPC.
4. Update the quiz preparation loop without adding a rate-limit UI state.
5. Add the Stage-3-specific focus style.
6. Run focused checks, the local mobile journey, repository readiness, and whole-branch counterpart review.

## Verification

- SQL/route: exact replay returns the stored ID/expiry with one row; prepared/attached/superseded exact replays succeed; expired-unclaimed, answer/token/owner mismatch, and cross-ID token collision fail closed; concurrent duplicate recovery is serialized. Transitional requests from already-open pages receive a server credential, while partial client credentials are rejected.
- Rate limits: journey `10/10s` and IP `100/10s` use distinct prefixes and never touch `quiz-lead`; `429` alone includes numeric `Retry-After`; `503` does not.
- Client: stable pending credentials survive lost-response replay; successful claim is stored before pending state is cleared.
- Client/browser: the real Chromium and WebKit `window.fetch` path sends the request; a `409` self-heals once with a different credential; a reload after lost responses reuses the same pending credential.
- Client: the first valid `429` produces exactly one delayed retry of at most ten seconds; the second or an invalid header yields the existing recoverable error with no third request.
- Accessibility: Stage 3 `h1` remains `document.activeElement` and computes no browser-default outline; interactive focus styles remain unchanged.
- Focused automated command: `npm run test:personal-plan -- --test-name-pattern='preparation|Stage 3.*focus'` when supported by the runner, otherwise invoke the exact affected test files through the repository's Node server-only shim; never use bare `tsx --test`.
- Broader automated command: `npm run test:personal-plan` plus lint/type checks selected by `ready-check`.
- Browser: complete the normal preparation and no-heat-protection clarification flow locally at mobile width, with no console or network errors.
- CI: include the real-browser preparation/recovery and Stage 3 focus specs in the existing Personal Plan journey command.

## Planning evidence and gates

- Mockup: `plans/mockups/2026-09-01-personal-plan-preparation-recovery.html`, revised to show that preparation remains on its normal surface and the Stage 3 focus ring alone changes visually.
- Evidence decision: Nick rejected the proposed rate-limit wait screen and explicitly chose the invisible best-practice approach on 2026-09-01.
- Designed-journey sign-off: Nick explicitly authorized implementation of this best-practice approach on 2026-09-01.
- Counterpart plan review: Claude approved with revisions. The no-identity path, IP-first ordering, additive-RPC rollback, attached replay, atomic conflict verification, existing answers-key reuse, existing Stage 3 attribute reuse, and exact test harness are now pinned.
- Stop after implementation is review-ready. Commit, push, PR, merge, deployment, WAF configuration, and production writes remain separate approvals.
