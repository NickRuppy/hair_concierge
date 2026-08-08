# Personal Plan return routing

## Outcome and source context

Returning visitors who open the generic Personal Plan route, `/lp/haarplan`, continue without an entry chooser:

- an unfinished quiz opens on the exact saved screen with its answer history and Back navigation intact;
- a completed, unpaid quiz opens its existing result for 30 days on the same browser;
- a visitor whose ownership is proven by the existing authenticated access check sees the existing paid-plan continuation instead of the offer;
- a deliberate retake starts from a new quiz only after the visitor uses the approved result-page action.

This plan builds on the shipped Personal Plan server-draft recovery in:

- `src/app/lp/[slug]/page.tsx`
- `src/lib/personal-plan-quiz/server-draft.ts`
- `src/app/api/quiz/personal-plan-draft/**`
- `supabase/migrations/20260731124000_add_personal_plan_quiz_drafts.sql`

Approved planning evidence:

- [return-flow HTML](evidence/personal-plan-return-routing/mockup.html)
- [desktop return-flow mockup](evidence/personal-plan-return-routing/mockup-desktop.png)
- [mobile return-flow mockup](evidence/personal-plan-return-routing/mockup-mobile.png)

## Chosen direction

Use two independent server-side browser capabilities and one landing coordinator:

1. Keep the existing unfinished-draft mechanism as the source of truth for exact quiz resume.
2. Add a private `personal_plan_result_returns` table for completed-result return. The browser receives a random opaque HttpOnly token; Supabase stores only its SHA-256 hash and the associated `lead_id`. This is the chosen architecture after comparing opaque, signed, and encrypted self-contained cookies against OWASP, NIST, MDN, and OAuth revocation guidance.
3. Resolve completed-result state on `/lp/haarplan` before `LandingTracking` or quiz UI mounts. A valid result wins over an explicit resume token and an existing draft. When no valid result exists, preserve the current resume-token exchange and exact draft bootstrap.
4. Redirect a completed visitor directly to `/result/<leadId>?entry=quiz_return`. Do not replay the result reveal.
5. Let the existing result route make the live access decision. Authenticated owners render `PersonalPlanPaidContinuation`; an opaque result-return cookie never grants paid access by itself.
6. Add the approved low-emphasis `Haar-Check neu starten` action below the final result CTA. Its client handler calls a same-origin reset endpoint, waits for successful server capability revocation, clears local draft/prepared state, and then replaces the page with clean `/lp/haarplan`.
7. Gate completed-result issuance, resolution, and the retake action behind `PERSONAL_PLAN_RESULT_RETURN_ENABLED === "true"`. Existing unfinished resume remains independently controlled by `PERSONAL_PLAN_QUIZ_CROSS_BROWSER_RESUME_ENABLED`.

### Exact state, precedence, and security contract

- Result-return lifetime is fixed at 30 days from quiz completion and is never extended by a return visit.
- The result-return cookie contains no lead ID, name, email address, answers, payment state, or raw database ID.
- Cookie settings: an `__Host-`-prefixed name, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain, and Max-Age=2,592,000 seconds. `Secure` is unconditional, deliberately differing from the adjacent draft-cookie helper so browsers never reject the prefixed credential; local/preview/browser verification must prove the cookie is actually stored. The credential must not be readable from browser JavaScript.
- The database stores `token_hash`, `lead_id`, `created_at`, `expires_at`, and `revoked_at`. It does not store duplicated quiz or customer data.
- The table is service-role-only: RLS enabled, all access revoked from `PUBLIC`, `anon`, and `authenticated`, and only the server uses the admin client. Do not add `FORCE ROW LEVEL SECURITY`; this intentionally matches the working service-role prior art and avoids a policy-less table blocking its security-definer owner.
- `resolve_personal_plan_result_return(p_token_hash text)` is the only read path. It is a service-role-only `SECURITY DEFINER` function with an empty fixed `search_path`, fully qualified object names, and one joined query that returns only `lead_id` when the row is live and `leads.quiz_kind = 'personal_plan'`.
- A missing, invalid, expired, or revoked result capability is normal absence and falls through to explicit resume token, existing draft, or fresh quiz in that order.
- A connection-level/transient transport failure is retried once inside the same server resolution, as Nick explicitly chose. Do not retry rate limits, permission/schema errors, or general application failures. If the retry also fails, render a fresh quiz silently, preserve the browser token for a later visit, and emit a privacy-safe operational warning containing only a bounded failure category.
- Newest intent is enforced through lifecycle transitions instead of timestamp comparison: successful completion revokes/clears the draft, and a deliberate retake revokes/clears the result before a new draft can start.
- Unexpected conflicts use one fixed precedence: valid completed result, then explicit `resume_token`, then existing draft, then fresh quiz. Nick explicitly chose the completed result over an explicit resume link during the 30-day window.
- A result-return token is routing capability only. Paid content remains behind the existing authenticated ownership/access checks.
- Do not authorize by email lookup, PostHog identity, funnel events, Customer.io state, or `checkout_started`.

### Decisions confirmed by Nick on 2026-08-08

| Decision                       | Chosen behavior                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry UX                       | Silent direct routing; no chooser or resume banner                                                                                                            |
| Unfinished quiz                | Restore exact saved screen and existing Back history                                                                                                          |
| Completed result window        | 30 days from completion                                                                                                                                       |
| Conflicting states             | Lifecycle cleanup plus fixed precedence: result, explicit resume token, draft, fresh                                                                          |
| Paid visitor                   | Existing owned-plan continuation when ownership is proven                                                                                                     |
| Retake escape hatch            | Low-emphasis result-page link below the final CTA                                                                                                             |
| Cookie class                   | Essential first-party capability, independent of analytics consent                                                                                            |
| Repeated lookup failure        | Retry once invisibly, then render a fresh quiz without deleting the old token                                                                                 |
| Cookie/privacy copy            | No consent UI or Datenschutz copy change in this task                                                                                                         |
| Repeat attributed ad click     | Saved result still wins; accept no new landing/funnel touch for that repeat click                                                                             |
| Explicit resume link conflict  | Valid completed result wins during its 30-day window                                                                                                          |
| Missing result artifact        | Recovery screen also offers the subdued retake action                                                                                                         |
| Return credential architecture | Opaque random cookie token; hash, expiry, revocation, and lead mapping remain server-side                                                                     |
| Signed-out purchaser           | May see the public saved result/offer; purchase ownership is recognized only after authentication                                                             |
| Personal Plan sign-in link     | Separate follow-up; the regular Chaarlie header already provides sign-in                                                                                      |
| Return analytics               | Classify PostHog exposure as `quiz_return`; preserve the funnel envelope but do not append another server funnel milestone or replay Meta completion tracking |

### External security research basis

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): keep the browser identifier meaningless and store business meaning, expiry, and invalidation server-side.
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html): browser cookies should contain opaque strings rather than cleartext personal information and should use Secure, HttpOnly, narrow scope, and SameSite protection.
- [MDN cookie security guidance](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies) and [`Set-Cookie` reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie): use the `__Host-` prefix with Secure, Path=/, and no Domain.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) and [RFC 6819](https://datatracker.ietf.org/doc/html/rfc6819): self-contained signed credentials need additional revocation state, whereas opaque handles support direct server-side revocation.
- [EDPB pseudonymisation guidance](https://www.edpb.europa.eu/news/edpb-adopts-pseudonymisation-guidelines-and-paves-the-way-to-improve-cooperation-with_en): an opaque or hashed identifier remains protected personal data when it can be linked back to a person; database access, retention, and logging controls still apply.

Conclusion: use a high-entropy opaque cookie token, store only its SHA-256 hash, bind it server-side to one Personal Plan lead, expire it absolutely after 30 days, allow individual revocation, and never log either raw token or hash.

## Scope and non-goals

### In scope

- private completed-result return persistence and expiry;
- result-return cookie issuance after successful Personal Plan lead completion;
- one landing state coordinator for draft/result/fresh routing;
- exact-resume regression coverage, including Back navigation;
- live paid-state rendering through the existing result access boundary;
- retake revocation and fresh-start action;
- a distinct `quiz_return` offer entry context;
- privacy-safe operational failure signals;
- feature flag, cleanup job, tests, preview verification, and rollback proof.

### Non-goals

- a chooser, resume confirmation, shared-device warning, or visible return banner;
- cross-device recovery, account creation, email lookup, or magic-link work;
- changing the existing draft TTL, local-draft policy, answer schema, or cross-browser resume-link flow;
- changing result URL authorization or making result URLs shareable;
- changing checkout, payment, entitlement, or purchase activation logic;
- granting paid access from the result-return capability;
- changing Cookie Settings, the cookie banner, or `src/app/datenschutz/page.tsx`;
- changing the old `/quiz` journey;
- adding a sign-in link/header to the Personal Plan quiz; this is a separate user-facing follow-up;
- using analytics storage as recovery state;
- extending the completed-result window when it is reopened.
- capturing a new landing/funnel touch for a completed visitor redirected from a repeat UTM/fbclid ad click.

## Target map

| Surface                                                                                                                                   | Planned responsibility                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/<generated>_add_personal_plan_result_returns.sql`                                                                    | Create the private capability table, constraints, FK/cleanup indexes, one-round-trip read function, service-role-only grants, and bounded purge function. Generate the filename with `supabase migration new add_personal_plan_result_returns`.                                                                                          |
| `src/lib/personal-plan-quiz/result-return.ts` (new)                                                                                       | Token creation/hash, `__Host-` cookie contract, strict result RPC parsing, retryable-error classification, fixed precedence decision, and server-only issuance/revocation helpers. Keep the pure decision seam in this file rather than adding a second routing helper.                                                                  |
| `src/lib/personal-plan-quiz/server-draft.ts`                                                                                              | Preserve the current exact draft resume and resume-token exchange. No RPC return-shape or draft-table migration is required.                                                                                                                                                                                                             |
| `src/lib/personal-plan-quiz/draft.ts` and its barrel export                                                                               | Move the prepared-plan storage key/clear helper out of the quiz component beside `clearPersonalPlanQuizDraft`, so restart cleanup never duplicates a private versioned key.                                                                                                                                                              |
| `src/lib/funnel/flags.ts`                                                                                                                 | Add exact-true `PERSONAL_PLAN_RESULT_RETURN_ENABLED`.                                                                                                                                                                                                                                                                                    |
| `src/app/lp/[slug]/page.tsx`                                                                                                              | Mark the shared page force-dynamic; resolve Personal Plan browser state before `LandingTracking`, redirect result returns with `entry=quiz_return`, or pass the exact draft snapshot/render fresh. The other landing packages accept the modest dynamic-rendering cost for this shared correctness boundary.                             |
| `src/app/api/quiz/personal-plan-lead/route.ts`                                                                                            | After a lead is successfully saved, create the result-return row and set its cookie. Result-return persistence is fail-open and must not turn a valid lead completion into an error.                                                                                                                                                     |
| `src/app/api/quiz/personal-plan-result-return/reset/route.ts` (new)                                                                       | Same-origin, rate-limited fetch-only POST that revokes/clears result and draft server cookies and returns a private no-store success response; navigation remains client-owned.                                                                                                                                                          |
| `src/app/api/billing/reconcile/route.ts`, `src/lib/personal-plan-quiz/result-return.ts`, and `src/lib/personal-plan-quiz/server-draft.ts` | Add one independently reported browser-recovery cleanup branch to the existing daily maintenance run, invoking both the existing draft purge and the new result-return purge. Do not add a third Vercel cron or let cleanup change payment-health status.                                                                                |
| `src/app/result/[leadId]/page.tsx`                                                                                                        | Parse `entry=quiz_return`, evaluate the server-only feature flag, retain the existing authenticated paid-access decision, and preserve the funnel session/package envelope without appending another server funnel milestone.                                                                                                            |
| `src/app/result/[leadId]/result-client.tsx`                                                                                               | Forward the new entry context, recovery reload context, funnel envelope, and server-evaluated restart permission into the Personal Plan branch only, without changing paid or legacy behavior.                                                                                                                                           |
| `src/components/personal-plan-offer/personal-plan-offer.tsx` and its recovery component                                                   | Add optional `showQuizRestart?: boolean` and `entryContext` inputs, both defaulting to current behavior. Render the approved restart action below the final CTA and on Personal Plan artifact recovery only when explicitly enabled. Keep the legacy result and Labs consumers false by default; do not add it to paid continuation.     |
| `src/lib/analytics/events.ts`, `src/lib/customerio/offer-engagement.ts`, and `src/lib/analytics/page-url.ts`                              | Add `quiz_return` to bounded entry-context consumers and the safe result-query allowlist. Suppress the server funnel `offer_viewed` insertion while retaining consented PostHog/engagement context; regression-test the existing Meta completion-only restriction. Do not add token, answers, lead lookup data, or a new identity event. |
| `tests/personal-plan-quiz-resume-entry.test.ts`, focused `*.test.ts(x)` files, and `tests/personal-plan-result-return.spec.ts`            | Update the pinned landing source-order contract and cover schema security, routing matrix, failure fallback, cookie issuance, reset route, maintenance cleanup, result entry semantics, restart success/failure UI, browser routing, and no secret/answer leakage.                                                                       |

## Designed user journey

### A. No saved browser state

1. A visitor opens `/lp/haarplan`.
2. The server finds no valid unfinished draft and no valid completed-result capability.
3. The first Personal Plan question renders as today.
4. No extra loading, choice, or notice appears.

### B. Unfinished quiz on the same browser

1. A visitor answers at least one durable quiz question and leaves.
2. Existing local/server draft persistence keeps the saved screen, answer subset, history stack, and server activity timestamp.
3. On a later generic-link visit, the landing coordinator resolves the draft before mounting tracking or quiz UI.
4. The quiz renders directly on the exact saved screen.
5. The selected answer is still visible. The in-app Back button and browser Back gesture traverse the restored history as they do today.
6. If the visitor changes an earlier answer and continues, normal draft saving updates the active state.

### C. Completed and unpaid within 30 days

1. The visitor completes lead capture successfully.
2. The server saves the lead/artifact, creates a 30-day opaque result-return capability, and sets its HttpOnly cookie without exposing the lead ID in that cookie.
3. Existing completion cleanup clears/revokes the unfinished draft and opens the normal reveal/result flow.
4. On a later generic-link visit, the server recognizes the valid result capability and redirects directly to `/result/<leadId>?entry=quiz_return`.
5. The reveal animation does not replay. The existing result/offer renders with `quiz_return` entry attribution.
6. The final result CTA remains primary. Beneath it, the visitor sees: `Du möchtest deine Angaben ändern? Haar-Check neu starten`.

### D. Deliberate retake

1. The visitor presses `Haar-Check neu starten` on the unpaid result.
2. The action enters a disabled/loading state and sends a credentialed same-origin POST. The endpoint revokes the current result-return row, clears its cookie, and clears/revokes any browser draft capability.
3. Only after a successful response, the client clears the local quiz draft and prepared-plan claim and replaces the page with `/lp/haarplan`.
4. The quiz opens from the first question. Because the normal `{ enabled, snapshot: null }` bootstrap remains active, the first new answer creates a resumable server draft as usual.
5. If the reset request or local cleanup fails, navigation does not occur. The visitor remains on the result and sees a short inline retry message; their saved result remains available.

### E. Paid-access variant

1. A valid result-return capability still routes through the canonical result page.
2. The result page checks live authenticated access exactly as it does today.
3. If ownership is proven, the existing `PersonalPlanPaidContinuation` renders and leads into onboarding/routine.
4. If the browser capability exists but authenticated ownership is not proven, it may reopen the public result/offer but must not unlock paid content; existing sign-in/access recovery remains authoritative.
5. A purchaser who enters through regular Chaarlie and signs in is recognized from their authenticated account access. Purchase activation has already linked the Personal Plan diagnostics to that profile, so middleware routes them to pending activation, unfinished onboarding, or the app—not through the quiz again.

### F. Conflict, expiry, and failure recovery

- A valid completed-result capability wins over an explicit `resume_token` and any existing draft for its 30-day window. After a deliberate retake revokes the result, explicit resume-token exchange wins over an existing draft, then the existing draft wins over fresh.
- After 30 days, the result capability is ignored and the generic link opens a fresh quiz. The old result may still be reached through its existing email URL while underlying retention permits; this feature does not extend that retention.
- If the result token is revoked or malformed, the generic link opens a fresh quiz.
- If a lookup returns a classified connection-level/transient transport error, the coordinator retries it once invisibly. A second failure opens a fresh quiz, keeps the token for a later visit, and records only a bounded operational failure category. Rate limits and application/schema/permission failures are not retried.
- If completed-result persistence fails during lead capture, completion still succeeds and the visitor reaches the result; only future generic-link return is unavailable for that completion.
- If the lead exists but its prepared artifact is unavailable, the existing recovery screen keeps `Ergebnis erneut laden` and also renders the same subdued retake action so the visitor is not trapped. This action is passed only by the Personal Plan result route; the shared legacy result recovery remains unchanged.
- A completed visitor arriving through a new UTM/fbclid ad click is still redirected before `LandingTracking`. That repeat click intentionally does not create a new landing milestone, funnel touch, or campaign attribution. Its saved-result render keeps the original funnel envelope and is classified in PostHog as `quiz_return`, but it does not append another server funnel milestone or replay Meta completion tracking.

User-journey sign-off: **approved by Nick on 2026-08-08 after the final walkthrough**.

## Planning evidence

Question answered: Can the route stay completely silent while preserving exact unfinished resume and still offer an intentional way out of the completed-result redirect?

Selected direction:

- no chooser or return banner;
- exact restored quiz screen with Back history;
- direct existing-result redirect;
- one low-emphasis retake action below the final result CTA.

Evidence review: **all four panels, including artifact recovery and restart failure, approved by Nick on 2026-08-08 during the final walkthrough**.

Feedback incorporated:

- shared-device choice was removed;
- the 30-day window replaced the initially recommended 90 days;
- the main result retake action placement and copy were approved as shown;
- the artifact-recovery panel was added after counterpart review; Nick confirmed the product decision to add the action and requested clarification of the trigger, but its final visual confirmation remains pending;
- the restart-failure panel was added after the final review simplified the mechanism to a client-owned reset; it proves that failed revocation does not discard state or navigate;
- a proposed Cookie Settings/Datenschutz copy artifact was rejected and discarded, and those surfaces are explicit non-goals;
- the opaque database-backed return token was selected after a focused security and privacy comparison; the signed-cookie and encrypted self-contained-cookie alternatives were rejected because they retain replay/revocation limitations.

Artifact disposition: commit the approved HTML and desktop/mobile PNGs with the plan. Discard all temporary localhost screenshots and the rejected privacy-copy artifact.

## Ordered tasks

### Task 1 — Add the private completed-result capability and cleanup contract

Consumes:

- existing `leads(id, quiz_kind)` identity;
- fixed 30-day product decision;
- service-role-only pattern from `personal_plan_quiz_drafts`.

Work:

1. Use `supabase migration new add_personal_plan_result_returns` to create the migration filename.
2. Add `public.personal_plan_result_returns` with:
   - UUID primary key;
   - unique 64-character lowercase hex `token_hash`;
   - unique `lead_id` foreign key with `ON DELETE CASCADE`, bounding storage to one browser-return credential per lead;
   - `created_at`, `expires_at`, nullable `revoked_at`;
   - checks that timestamps are ordered and `expires_at <= created_at + interval '30 days'`.
3. Add lookup and cleanup indexes.
4. Index `lead_id` explicitly for joins and `ON DELETE CASCADE`; use a partial cleanup index only if its predicate exactly matches the purge query.
5. Enable RLS; revoke table access from `PUBLIC`, `anon`, and `authenticated`; grant only the minimum operations to `service_role`. Deliberately do not force RLS, matching the existing service-role table pattern.
6. Add `resolve_personal_plan_result_return(p_token_hash text)` as a `SECURITY DEFINER` function. Set `search_path = ''`, fully qualify every referenced object, join to `public.leads`, require `quiz_kind = 'personal_plan'`, `revoked_at is null`, and `expires_at > now()`, and return only the matching `lead_id`. Revoke execute from `PUBLIC`, `anon`, and `authenticated`; grant only `service_role`.
7. Add a bounded purge function for expired rows and rows revoked long enough to no longer support diagnosis. Give it the same fixed-search-path, fully-qualified, service-role-only contract.
8. Run the Supabase security checklist and advisors during implementation before retaining the migration.

Produces:

- a revocable, expiring mapping from a hashed browser capability to one Personal Plan lead;
- a bounded server cleanup primitive.

Tests/completion criterion:

- migration contract tests assert hash/expiry checks, unique-per-lead/FK deletion behavior, RLS, explicit revokes/grants, fixed function search paths, indexes, purge bound, and absence of name/email/answers/payment columns;
- local migration apply succeeds; service role can create/resolve/revoke/purge; anon/authenticated cannot read the table or execute either function;
- the resolver rejects a valid token mapped to a non-Personal-Plan lead and performs token validation plus quiz-kind validation in one RPC call.

### Task 2 — Implement typed capability and fixed-precedence routing logic

Consumes:

- Task 1 table contract;
- existing draft cookie and server draft parser;
- exact decision matrix in this plan.

Work:

1. Add server-only result token generation and SHA-256 hashing using the existing `createPersonalPlanClaimCredential` primitive.
2. Reuse `createPersonalPlanClaimCredential` for the 43-character high-entropy value. Define the cookie constant/options and validate the exact base64url length/shape before hashing or making any RPC; malformed attacker-controlled cookies must cause zero database calls.
3. Keep current draft resolution unchanged. Resolve the result cookie first only when it is present; a valid result returns immediately without reading or exchanging resume-token/draft state.
4. Add result-return read/revocation helpers. The read helper calls the single resolver RPC, strictly parses its UUID-or-null result, and never fetches customer fields.
5. Add a pure decision function with exact precedence: valid result, explicit resume token, existing draft, fresh.
6. Add one immediate retry only for classified connection-level/transient transport errors. Never retry rate-limit, schema, permission, validation, or general 5xx/application errors. Repeated transport failure or any non-retryable infrastructure failure returns `fresh_due_to_error` without clearing tokens.
7. Emit one bounded server warning for the repeated-failure outcome; never log cookie values, hashes, lead IDs, answers, names, emails, or full Supabase errors.
8. Keep the normal no-cookie landing path at zero new database calls and the normal cookie path at one RPC; the retry path may make two calls with no sleep/backoff. Verify these call counts in tests and in one preview browser trace rather than asserting an uninstrumented latency target.

Produces:

- `fresh | draft(snapshot) | result(leadId)` landing decision without changing the draft RPC;
- fixed 30-day result lookup with no sliding activity write.

Tests/completion criterion:

- table-driven unit tests cover fixed precedence, fixed expiry, malformed tokens, revoked rows, mismatched quiz kind, one retry, repeated failure, and token preservation;
- malformed-token tests assert the resolver RPC is never invoked;
- cookie tests assert the `__Host-` name, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain, 30-day Max-Age, and no client-readable/identity payload;
- existing draft-resume tests remain green and prove exact screen/history restoration is unchanged.

### Task 3 — Issue the result capability without weakening completion

Consumes:

- Task 1 persistence;
- Task 2 credential/cookie helpers;
- successful `save_personal_plan_lead_with_artifact` result.

Work:

1. Add `PERSONAL_PLAN_RESULT_RETURN_ENABLED` as an exact-true server flag.
2. After a Personal Plan lead saves successfully, create one new result-return credential for this browser and upsert only its hash with the returned `leadId`. Conflict on unique `lead_id` rotates the previous credential and resets the fixed 30-day window, so a deduplicated lead cannot accumulate live rows.
3. Set the HttpOnly result-return cookie only after persistence succeeds.
4. Treat result-return persistence as auxiliary: on failure, log the bounded category and return the existing successful `{ leadId, attributionAttached }` response without a cookie.
5. Preserve the current client completion cleanup: strip resume query token, revoke server draft, clear local draft/prepared claim, and push the reveal route.

Produces:

- a successful completion response carrying the optional 30-day result-return cookie;
- unchanged lead/result success semantics when the new subsystem is disabled or unavailable.

Tests/completion criterion:

- handler tests prove successful issuance, no raw token/hash/customer data in JSON, no issuance while disabled, and lead completion still succeeds when capability persistence throws;
- deduplicated lead reuse rotates the single stored browser capability and does not create another lead or another result-return row;
- existing lead persistence, Customer.io, Meta, attribution, and reveal-entry tests remain green.

### Task 4 — Route the generic landing before tracking or paint

Consumes:

- Task 2 coordinator;
- Task 3 feature flag;
- current Personal Plan landing draft bootstrap.

Work:

1. Mark the shared landing page `dynamic = "force-dynamic"`; keep all result/draft resolution request-bound. Rely on Next.js dynamic rendering for private/no-store behavior and verify the actual render and redirect headers in preview. Do not require a `Vary: Cookie` header that the Server Component cannot produce and which is redundant when the response is not cacheable.
2. On the `meta_personal_plan_v1` landing only, evaluate `PERSONAL_PLAN_RESULT_RETURN_ENABLED` independently of `resumeEnabled`. Place result-cookie resolution before the existing `if (!resumeEnabled && resumeToken)` redirect and outside the existing `if (resumeEnabled)` block, so the completed-result feature cannot become silently coupled to cross-browser draft resume. A valid result intentionally wins over `resume_token`; if no valid result exists, preserve existing exchange behavior.
3. Redirect a result decision to `/result/<encodedLeadId>?entry=quiz_return`.
4. Pass a draft decision into the existing `PersonalPlanQuiz` bootstrap unchanged. No result cookie means the existing `{ enabled, snapshot }` path behaves exactly as it does in production.
5. Render fresh on normal absence, `fresh_due_to_error`, invalid/expired/revoked state, or when the new feature flag is disabled.
6. Update `tests/personal-plan-quiz-resume-entry.test.ts`, which pins the current source order. Its new contract must assert: result resolution precedes resume-token exchange; resume exchange precedes landing render; render precedes `LandingTracking`; and the existing draft snapshot is still passed through.
7. Add `quiz_return` to the bounded offer entry-context type, result parser, Customer.io strict engagement schema, and safe result-query analytics allowlist. For this entry, do not call `recordFunnelEvent("offer_viewed")`; instead build `FunnelAnalyticsEnvelope` from the already-resolved funnel context with `funnelEventId: null`, `funnelSessionId`, and `funnelPackageKey`. This preserves attribution for PostHog `offer_viewed`, engagement, pricing, and checkout events while preventing another server funnel milestone. The existing Meta client/API restriction to `quiz_completion` is regression-tested, not reimplemented.

Produces:

- zero-chooser server routing with no flash of the wrong screen;
- separate return attribution without a new lead or funnel identity.

Tests/completion criterion:

- route/source tests prove resolution and redirects occur before `LandingTracking`;
- response tests assert force-dynamic behavior and preview confirms private/no-store behavior on both render and redirect paths;
- the generic route matrix covers fresh, draft, result, result-over-resume/draft conflicts, paid authenticated rendering, expired state, and repeated lookup failure;
- the updated source-order regression test runs in `npm run test:node` and proves the new coordinator remains ahead of resume exchange, render, and tracking; the browser fixture—not this string-position test—proves exact resume remains intact;
- `quiz_return` produces the existing consented PostHog `offer_viewed` with `entryContext=quiz_return` and the original funnel session/package envelope, but cannot append a server funnel `offer_viewed`, trigger the existing Meta completion-only path, or replay reveal events;
- no token, hash, answer, email, name, or new raw lead identifier is added to analytics payloads.

### Task 5 — Add the approved retake action and revocation endpoint

Consumes:

- Task 2 cookie/revocation helpers;
- approved result-page mockup.

Work:

1. The server result page reads `isPersonalPlanResultReturnEnabled()` and passes `showQuizRestart` through `ResultPageClient`. Add optional `showQuizRestart?: boolean` (default `false`) and recovery-entry inputs to the shared offer/recovery surface. Only the `quizKind === "personal_plan"` branch forwards the server value into `PersonalPlanOffer` and `PersonalPlanOfferRecovery`; the legacy branch and Labs offer consumer retain the false default.
2. Add the retake action below the final Personal Plan result CTA and above the footer using the exact approved copy: `Du möchtest deine Angaben ändern? Haar-Check neu starten`.
3. Use a semantic button styled as a low-emphasis link. In its client handler, disable repeated presses, send a same-origin credentialed POST, and wait for an explicit success response before changing local or visible state.
4. In the reset handler, require an Origin exactly matching `new URL(request.url).origin`; when `Sec-Fetch-Site` is present require `same-origin`. Apply the existing IP rate-limit pattern, revoke the result row identified by the cookie when present, clear the result cookie, revoke/clear any current server draft capability, and return a 204 response using the existing `noStoreHeaders()` helper.
5. Extract the prepared-plan storage key and clear helper from `personal-plan-quiz.tsx` into `src/lib/personal-plan-quiz/draft.ts` and export it through the existing barrel. After the 204 response, call that helper and `clearPersonalPlanQuizDraft()`, then use `window.location.replace("/lp/haarplan")` for a hard server navigation that cannot reuse a pre-reset Router Cache payload. Do not add a `fresh=1` query contract or modify the landing/bootstrap types.
6. If the request or local cleanup fails, remain on the saved result, restore the button, and show concise German inline recovery copy with a retry action. Never clear local state before server success.
7. Make reset idempotent: missing, expired, or already revoked server state still clears cookies and returns success.
8. Hide the action when the feature flag is disabled. Render it on the Personal Plan unpaid offer and its artifact-recovery state, but not the paid continuation or shared legacy recovery. Give `PersonalPlanOfferRecovery` an explicit reload-entry prop: the Personal Plan `quiz_return` branch preserves `entry=quiz_return`, while legacy/current callers retain their existing completion/default behavior.

Produces:

- one deliberate escape hatch that restores a clean new-attempt state.

Tests/completion criterion:

- component/client tests assert server flag threading, exact copy and placement, disabled/loading behavior, server-success-before-shared-local-helper ordering, hard navigation to clean `/lp/haarplan`, inline failure/retry behavior, recovery entry preservation, and disabled/paid/legacy/Labs absence;
- route tests cover Origin and Fetch-Metadata enforcement, IP rate limiting, idempotency, both server cookie clears/revocations, private no-store 204 success, and bounded errors;
- `tests/personal-plan-result-return.spec.ts` uses the real client action and proves the browser's credentialed fetch is accepted, cookies/local draft are cleared only on success, clean navigation completes, the first question renders, and an injected reset failure remains on the result with retry recovery;
- desktop and mobile browser review match the approved mockup and confirm the result CTA remains visually primary.

### Task 6 — Add browser-recovery cleanup to the existing daily maintenance run and verify rollback

Consumes:

- Task 1 purge function;
- existing daily billing reconcile and CRON_SECRET route pattern;
- new feature flag.

Work:

1. Add one independently reported `browserRecoveryCleanup` branch to the existing billing reconcile route. Invoke both the existing `purge_expired_personal_plan_quiz_drafts` function and the new bounded result-return purge through the existing service-role client.
2. Invoke each purge once with the existing maximum batch size of 500. Report only the two deleted counts; a count of 500 is the operational signal to investigate capacity, without adding an unproven drain loop or new backlog state in this task.
3. Run that branch in parallel with the current reconciliation branches and include only bounded counts/status in the response. Its failure must be captured and reported but explicitly excluded from the existing payment reconcile 200/500 calculation so browser-retention maintenance cannot create a false payment-health incident. Do not add or change a Vercel cron schedule.
4. Add route tests for both single bounded purge calls, the 500-row cap, partial/full cleanup failure, independent reporting, and unchanged status calculation, authorization, and payment branches.
5. Add three explicit kill-switch assertions: flag false causes the lead handler to make no result-return write/set no cookie; the landing makes no result resolver call/redirect; and the result page passes `showQuizRestart=false`. Cleanup may continue while disabled.
6. Document deployment order in the PR: migration readiness, deploy code with flag false, enable in preview, verify, then enable production. Rollback disables the code flag; it does not drop the additive table/functions, so existing valid rows remain available if the feature is re-enabled within 30 days.

Produces:

- enforceable 30-day browser-capability retention;
- a rollback that leaves existing unfinished draft resume untouched.

Tests/completion criterion:

- `vercel.json` remains byte-for-byte unchanged and still contains only the existing two jobs;
- seeded expired result-return and draft rows are purged while valid unexpired rows remain; a >500-row fixture deletes no more than 500 per store in one run;
- an injected browser-recovery cleanup failure is visible in the bounded response/telemetry but does not change an otherwise healthy reconcile response from 200 to 500;
- with the flag false, Personal Plan behavior matches current production and no new cookie is issued;
- re-enabling within 30 days can reuse still-valid capability rows/cookies.

## Verification

### Automated

- Add/run `tests/personal-plan-result-return-migration.test.ts`, `tests/personal-plan-result-return.test.ts`, `tests/personal-plan-result-return-reset.test.ts`, and `tests/personal-plan-result-return-landing.test.ts`. Extend the existing `tests/personal-plan-quiz-resume-entry.test.ts`, `tests/personal-plan-quiz-server-draft.test.ts`, `tests/personal-plan-quiz-server-draft-client.test.ts`, `tests/personal-plan-lead-persistence.test.ts`, `tests/result-page-client.test.tsx`, `tests/offer-engagement.test.ts`, `tests/meta-offer-view-client.test.ts`, `tests/analytics-runtime.test.ts`, and `tests/billing-reconcile-analytics.test.ts` at their existing ownership seams.
- Name new Node tests `*.test.ts` or `*.test.tsx` so `npm run test:node` actually includes them; do not add an unlisted `*.spec.ts` test to that suite.
- Run `npm run test:node`.
- Start local Supabase with `npm exec -- supabase start`, run the full migration chain with `npm exec -- supabase db reset --local --no-seed`, and run `npm exec -- supabase db lint --local`. Refuse any browser exercise unless the resolved Supabase URL is `127.0.0.1:54321`.
- Add a focused local exercise SQL/script that proves service-role resolve/revoke/purge and anon/authenticated denial against the migrated local database; regex migration tests are not accepted as RPC proof.
- Map the local API URL, anon key, and service-role key into the worktree server without overwriting shared `.env.local`. After `npm run build`, run `tests/personal-plan-result-return.spec.ts` with all three flags true through `start-server-and-test` against that local stack.
- Do not mark the database-dependent spec `@ci` and do not change job-wide CI flags before a migrated CI database exists. Existing GitHub smoke continues with the new feature disabled; `npm run ci:verify` and existing `@ci` smoke remain regression checks, not result-return behavior proof.
- Run Supabase migration verification, migration list, security advisors, and explicit service-role versus anon/authenticated access probes.

### Manual/browser

At mobile and desktop viewports:

1. Fresh browser → `/lp/haarplan` starts at the first question.
2. Answer through a mid-quiz screen, leave, revisit generic route → exact screen/selection/history restores; Back reaches the preceding saved screen.
3. Complete an unpaid quiz, revisit generic route → canonical result opens directly without reveal replay.
4. Confirm the restart link matches approved hierarchy; activate it → loading state → first quiz question; revisit after answering → new draft resumes. Inject reset failure → remain on result with retry copy and no local-state loss.
5. Create result/resume/draft conflict fixtures → valid result wins; after result revocation, explicit resume wins over the draft.
6. Expired/revoked/malformed result state → fresh quiz.
7. Inject one connection-level read failure → automatic recovery with no visible state; inject two → fresh quiz, cookie preserved, bounded warning only. Rate-limit/schema/permission errors make exactly one call.
8. Authenticated entitled visitor with the result capability → existing paid continuation; unauthenticated browser capability alone never unlocks paid content.
9. Open a repeat UTM/fbclid link while the result cookie is valid → saved result opens and no new landing/funnel touch is created.
10. Disable the new feature flag → current generic-route behavior and existing unfinished resume remain intact.
11. From the Personal Plan missing-artifact recovery state, verify reload retains `entry=quiz_return` and retake is available; verify the shared legacy recovery and Labs offer do not gain the action.
12. Inspect the generic route and redirect response headers in preview: both are request-dynamic and private/no-store. Confirm no shared-cache hit can reuse a cookie-derived decision.
13. In Playwright, assert `context.cookies()` contains the Secure/HttpOnly `__Host-` credential on localhost while `document.cookie` cannot read it.

### Migration/live-state checks

- Preview database contains the table, constraints, indexes, RLS, revokes/grants, resolver, and purge function from the exact reviewed migration. Live draft-table grants/RLS are checked before copying its pattern because this planning session verified migration files, not live Supabase state.
- Cookie inspection proves no lead ID or personal data and confirms 30-day fixed expiry/security attributes.
- Preview logs show no token/hash/lead/customer data on success or injected failure.
- Browser-recovery cleanup removes up to 500 expired result-return rows and 500 expired draft rows without touching either table's valid rows; cleanup failure or a cap-sized deletion count is independently visible and cannot alter payment-health status.

### Evidence-sensitive review

- Recheck the implemented result-page action against both approved screenshots.
- Verify there is no chooser or return banner. For completed-result return, verify no quiz screen paints before the server redirect. Existing client-side local-draft restoration may still paint its current initial shell and is not redesigned by this task.
- Verify the retake action does not compete visually with `Plan sichern`.

## Review and handoff

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-return-routing-plan`
- Branch: `codex/personal-plan-return-routing-plan`
- Plan review: four Claude counterpart passes completed; final execution-seam findings reconciled locally. No further counterpart pass is planned unless the product direction changes.
- Evidence review: all four desktop/mobile panels confirmed by Nick.
- Designed user-journey sign-off: approved by Nick on 2026-08-08.
- Implementation stop point: planning is complete and the plan is ready for a separately authorized `implementation-loop`; no implementation has started in this task.
- Publication: implementation, commit, push, PR, merge, deployment, feature activation, and production database changes are not authorized by this planning task.

### Rollout and residual risks

- Rollout order is migration first, then code with `PERSONAL_PLAN_RESULT_RETURN_ENABLED=false`, preview verification, and separately authorized activation.
- The feature flag is the behavioral rollback; disabling it must not disable existing unfinished-draft resume.
- A result URL remains bearer-like under the current result-page authorization model. This plan avoids placing it in the new cookie but does not redesign result URL access.
- A signed-out purchaser cannot be recognized from the result-return cookie and may see the public result/offer. Nick accepted this boundary: ownership is recognized only from authenticated account access, and regular Chaarlie already provides sign-in.
- The Personal Plan campaign quiz still has no sign-in link. Nick chose to keep that visible enhancement as a separate follow-up because it is not required for the paid return path.
- Nick explicitly excluded Cookie Settings and Datenschutz copy updates. The implementation therefore adds an essential 30-day capability without changing those disclosures; any later disclosure/legal review is a separate task.
- Repeated lookup failure intentionally falls back to a fresh quiz, so a temporary valid result may be hidden for that visit. The old token is preserved for later recovery and the failure is operationally visible.
- Completed visitors redirected from repeat attributed ad links intentionally lose that click's new landing milestone, funnel touch, and UTM/fbclid attribution. Their PostHog exposure is classified separately and does not append another server funnel milestone.
- Unique `lead_id` bounds result-return storage and rotates the credential if the same deduplicated lead completes again on another browser. The earlier browser then loses automatic generic-link return; cross-device return is explicitly outside this same-device feature.
- `dynamic = "force-dynamic"` applies to the shared `/lp/[slug]` page, including its other landing packages. This modest rendering cost is accepted to make the cookie-derived routing boundary explicit and non-cacheable.
- The one immediate retry is an explicit product choice and a deliberate deviation from backoff-based incident retries. It is restricted to connection-level transport failures and never retries rate limiting or application errors.

### Findings ledger

| ID  | Type                   | Evidence                                                                                                                                                                         | Decision                     | Plan change                                                                                                                                                                  | Revalidation                                                 |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| P01 | scope/product decision | Nick rejected the proposed Cookie Settings and Datenschutz copy mockup                                                                                                           | accepted                     | Marked both surfaces as non-goals and recorded residual disclosure risk                                                                                                      | Confirm diff contains no edits to either surface             |
| P02 | scope/product decision | Regular Chaarlie already exposes sign-in; the Personal Plan campaign route does not                                                                                              | accepted by Nick             | Keep Personal Plan quiz sign-in UI as a separate follow-up                                                                                                                   | Confirm no header/auth UI changes in this task               |
| P03 | access boundary        | Purchase ownership is only proven from an authenticated Supabase user and current access records                                                                                 | accepted by Nick             | Signed-in buyers route to pending activation/onboarding/app; signed-out buyers may see the public offer                                                                      | Authenticated/unauthenticated paid fixtures                  |
| P04 | analytics decision     | Automatic returns need measurement without adding another server funnel milestone                                                                                                | accepted after clarification | Keep PostHog `offer_viewed` segmented by `quiz_return` and preserve its funnel envelope; suppress only server milestone insertion; regression-test existing Meta restriction | Event assertions for completion, email, and quiz return      |
| C01 | defect                 | Draft RPC omits `updated_at`; changing `RETURNS TABLE` needs a drop/recreate migration                                                                                           | accepted                     | Removed timestamp comparison and all draft RPC/table changes; lifecycle transitions plus fixed precedence enforce the behavior                                               | Focused routing tests and migration diff review              |
| C02 | defect                 | Customer.io offer engagement uses a strict entry-context enum                                                                                                                    | accepted                     | Added `src/lib/customerio/offer-engagement.ts` to the target map and Task 4                                                                                                  | Customer.io schema/route test accepts `quiz_return`          |
| C03 | defect                 | Server-only reset cannot clear localStorage                                                                                                                                      | accepted                     | Result client waits for reset success, clears local draft/prepared claim, then replaces to clean landing                                                                     | Client ordering/failure tests                                |
| C04 | defect                 | Local-only drafts are invisible to server routing                                                                                                                                | accepted                     | Removed server comparison dependency; a valid result has explicit precedence, while retake revokes it before local draft creation                                            | Conflict and retake browser tests                            |
| C05 | defect                 | `npm run test:ci` is not a package script and generic `*.spec.ts` is not in `test:node`                                                                                          | accepted                     | Named real commands and test filename requirements                                                                                                                           | Run exact listed commands                                    |
| C06 | tradeoff               | Redirect before `LandingTracking` drops repeat-ad attribution                                                                                                                    | accepted by Nick             | Kept result-first redirect and documented attribution as non-goal/residual risk                                                                                              | Repeat attributed-link browser/event check                   |
| C07 | scope/product decision | Resume-token versus passive result-cookie precedence was unspecified                                                                                                             | accepted by Nick             | Valid completed result now explicitly wins                                                                                                                                   | Conflict routing test                                        |
| C08 | defect                 | Personal Plan artifact recovery had no escape hatch                                                                                                                              | accepted by Nick             | Reuse the approved restart action only when the Personal Plan result route opts in                                                                                           | Recovery markup/browser test                                 |
| C09 | tradeoff               | A third Vercel cron can exceed the existing two-job plan limit and duplicates maintenance                                                                                        | accepted                     | Folded bounded purge into existing daily billing reconcile; `vercel.json` remains unchanged                                                                                  | Reconcile branch tests and config fingerprint                |
| C10 | defect                 | Reset route omitted the repository's rate-limit pattern                                                                                                                          | accepted                     | Added IP rate limiting to Task 5                                                                                                                                             | Route rate-limit tests                                       |
| C11 | defect                 | `quiz_return` would be removed from safe result analytics URLs                                                                                                                   | accepted                     | Added safe allowlist update without broadening sensitive query capture                                                                                                       | Page URL sanitizer tests                                     |
| C12 | defect                 | “No intermediate paint” was false for current client-side local-draft restore                                                                                                    | accepted                     | Narrowed the zero-wrong-paint criterion to server result redirect and left draft render timing unchanged                                                                     | Browser checks match actual boundary                         |
| C13 | architecture           | OWASP/NIST/MDN guidance prefers meaningless opaque browser identifiers with server-side state; signed/self-contained cookies retain replay and individual-revocation limitations | accepted by Nick             | Locked random opaque cookie plus hash-only private DB mapping                                                                                                                | Schema/cookie/security tests and preview inspection          |
| C14 | defect                 | The Labs offer constructs the shared offer directly and shared recovery must not inherit Personal Plan behavior accidentally                                                     | accepted                     | Added optional default-false `showQuizRestart`; only Personal Plan result route opts in                                                                                      | Personal Plan, legacy, paid, and Labs component tests        |
| C15 | defect                 | Cookie-conditional landing redirects must never be statically or publicly cached, but a Server Component cannot set the proposed `Vary` header                                   | accepted                     | Require force-dynamic/private-no-store behavior and preview proof; dropped impossible/redundant Cookie-varying requirement                                                   | Route/source tests and preview header inspection             |
| C16 | defect                 | Token-table lookup alone did not prove the mapped lead is a Personal Plan lead in one round trip                                                                                 | accepted                     | Added service-role-only fixed-search-path resolver RPC joined to `leads.quiz_kind`                                                                                           | Migration/RPC privilege and mismatch tests                   |
| C17 | simplification         | Native form plus `fresh=1` added a landing bypass, prop threading, and browser-specific form-Origin risk                                                                         | accepted                     | Client fetch waits for 204, clears local state, and navigates cleanly; failure remains on result                                                                             | Client/route/focused browser tests                           |
| C18 | defect                 | Fresh-start bootstrap could accidentally disable new server-draft creation                                                                                                       | eliminated with C17          | No special landing bootstrap exists; normal enabled/null snapshot creates the new draft                                                                                      | Exact restart/resume browser fixture                         |
| C19 | defect                 | Cleanup failure could contaminate payment-reconcile health, while the existing draft purge had no caller                                                                         | accepted                     | One independently reported browser-recovery cleanup invokes both purges and is excluded from payment status                                                                  | Success/partial-failure/status route tests                   |
| C20 | defect                 | An arbitrary 400 ms p95 target had no defined measurement path                                                                                                                   | accepted                     | Replaced with deterministic DB-call budgets plus a preview browser trace                                                                                                     | Unit call-count assertions and retained trace summary        |
| C21 | defect                 | Existing source-shape test pins resume/exchange/render/tracking order                                                                                                            | accepted                     | Task 4 explicitly owns and rewrites that test for result-first precedence                                                                                                    | Run named test through `npm run test:node`                   |
| C22 | defect                 | Focused Playwright command had no server harness, while live CI lacks the unapplied resolver migration                                                                           | accepted                     | Run the database-dependent spec against a reset local Supabase stack; keep job-wide CI feature flag off until a migrated CI target exists                                    | Local migrated focused run plus existing CI regression suite |
| C23 | capacity               | One 500-row daily purge may reach its cap, but no intake evidence justifies a drain loop                                                                                         | narrowed                     | One bounded call per store; a returned count of 500 is the operator signal                                                                                                   | Bound/count route tests                                      |
| C24 | live-state             | Production journey existence depended on cross-browser resume flag                                                                                                               | verified read-only           | Vercel production has both quiz and cross-browser resume flags set to true as of 2026-08-08                                                                                  | Recheck deployment env during implementation ready-check     |
| C25 | defect                 | Skipping `recordLeadOfferView` also removed the funnel envelope used by downstream offer and checkout analytics                                                                  | accepted                     | Build an envelope from resolved session/package context with null event ID, without inserting a server milestone                                                             | Result-route and provider payload tests                      |
| C26 | defect                 | Prepared-plan storage key/helper was private to the quiz component                                                                                                               | accepted                     | Extract/export shared helper beside existing draft cleanup                                                                                                                   | Helper and restart ordering tests                            |
| C27 | defect                 | Server-only feature flag had no explicit path into client restart UI                                                                                                             | accepted                     | Result server reads flag; Personal Plan branch threads optional default-false prop                                                                                           | Flag-on/off plus legacy/Labs tests                           |
| C28 | defect                 | Result resolution could be accidentally nested under the independent draft-resume flag                                                                                           | accepted                     | Resolve result under its own flag before the current disabled-resume redirect/block                                                                                          | Four-way flag matrix tests                                   |
| C29 | defect                 | Client router cache could reuse a pre-reset landing payload                                                                                                                      | accepted                     | Hard `window.location.replace` only after 204 and shared local cleanup                                                                                                       | Browser restart test                                         |
| C30 | security/test          | `__Host-` Secure cookie behavior must be proven rather than inferred on local HTTP                                                                                               | accepted                     | Assert presence in Playwright context and absence from `document.cookie`                                                                                                     | Focused browser cookie inspection                            |
| C31 | tradeoff               | Unique per-lead storage rotates the first browser if the deduplicated lead completes elsewhere                                                                                   | accepted within scope        | Documented one-device consequence; cross-device return stays a non-goal                                                                                                      | Rotation unit test and residual-risk receipt                 |
| C32 | architecture           | Final review re-proposed the adjacent HMAC cookie to remove SQL/cleanup                                                                                                          | rejected                     | Nick had already selected opaque storage after external research; central revocation, server-side expiry, and FK deletion remain intentional                                 | Retain Task 1 security contract                              |
