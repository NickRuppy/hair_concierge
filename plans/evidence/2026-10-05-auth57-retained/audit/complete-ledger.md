# Auth replay / credential quiz-return57

Exact11 owned files,57 declaration sites:53R,4 heldF,0C,0D. No proposed declaration removal. Whole before/transfer/cut files are byte-identical. Result page first registration has two existing loop rows; declaration count is not runtime count. No test/runtime/source mutation was executed.

## A1 — tests/auth-confirm-replay.test.ts:13

"moderator return paths reject absolute, protocol-relative and ambiguous URLs"

**R** — Strict non-secret moderator destination canonicalization; valid UUID path, absolute/protocol-relative/malformed/fragment/duplicate/javascript inputs.

Detectable failure / gap: Permitting a protocol-relative or duplicate campaign path breaks false/null checks.

Owner: src/lib/auth/moderator-return.ts:13-23. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A2 — tests/auth-confirm-replay.test.ts:97

"fresh PKCE confirmation keeps verification and quiz linking exactly once"

**R** — Actual route adapter PKCE success: fresh-code exchange, getUser and one exact user/email/lead link; final ordinary next.

Detectable failure / gap: Duplicate or suppressed linking and reordered exchange/getUser fail exact calls.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A3 — tests/auth-confirm-replay.test.ts:114

"fresh OTP recovery still opens password setup after linking"

**R** — OTP recovery succeeds via verifyOtp, links the same lead once, then password setup. PKCE is a different verification branch.

Detectable failure / gap: Skipping OTP or recovery routing breaks exact calls/location.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A4 — tests/auth-confirm-replay.test.ts:131

"moderator confirmation preserves the non-secret campaign return and never relinks legacy quiz data"

**R** — Verified moderator PKCE preserves campaign return and suppresses lead linking despite supplied legacy lead.

Detectable failure / gap: Removing moderator linking exclusion breaks call log.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A5 — tests/auth-confirm-replay.test.ts:143

"moderator password recovery returns to the invitation without relinking legacy quiz data"

**R** — Verified moderator OTP recovery wraps campaign next in password setup and suppresses linking.

Detectable failure / gap: Dropping nested moderator next breaks exact redirect.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A6 — tests/auth-confirm-replay.test.ts:161

"the password recovery redirect marks a PKCE moderator return as recovery and suppresses legacy linking"

**R** — Actual AuthForm recovery URL builder stamps recovery type before real confirm route; successful PKCE must not adopt legacy lead.

Detectable failure / gap: Dropping builder type or recovery detection breaks type/location/calls.

Owner: src/components/auth/auth-form.tsx:65-76;src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A7 — tests/auth-confirm-replay.test.ts:180

"a failed PKCE moderator password-recovery code stays on recovery without replaying legacy linking"

**R** — Same real builder followed by failed PKCE: forced login with nested password/moderator next, no linking. Success prefix cannot cover this error arm.

Detectable failure / gap: Allowing consumed exchange through verified flow breaks recovery destination.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A8 — tests/auth-confirm-replay.test.ts:198

"consumed confirmation with a session keeps an unrelated destination on auth recovery without replaying side effects"

**R** — Consumed code with existing session and unrelated internal next stays on auth recovery; nested token/error removed, tab retained, no journey or linking.

Detectable failure / gap: Redirecting every authenticated replay directly to next breaks exact location.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A9 — tests/auth-confirm-replay.test.ts:214

"consumed confirmation without next resumes the canonical Personal Plan frontier"

**R** — No explicit next with consumed code loads owner journey for each existing stage frontier and preserves exact exchange/getUser/load order.

Detectable failure / gap: Removing fallback journey load or replacing nextHref breaks expected frontiers/calls.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A10 — tests/auth-confirm-replay.test.ts:228

"unsafe replay destinations are rejected in favor of the owner-scoped frontier"

**R** — Existing unsafe URL rows reject foreign/protocol-relative/backslash/confirm-loop next; owner-scoped frontier chosen with no link.

Detectable failure / gap: Accepting unsafe input bypasses expected journey fallback.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A11 — tests/auth-confirm-replay.test.ts:259

"unrelated same-origin destinations retain auth recovery while a foreign redirect falls back to the frontier"

**R** — Same-origin absolute next and nested redirect_to stay on recovery while foreign redirect_to uses frontier. Nested and direct inputs distinct.

Detectable failure / gap: Treating foreign redirect as an ordinary destination or dropping same-origin tab breaks assertions.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A12 — tests/auth-confirm-replay.test.ts:301

"consumed recovery link with a session remains password recovery and does not load or link"

**R** — Consumed OTP recovery with session remains password recovery and invokes neither link nor frontier.

Detectable failure / gap: Applying generic authenticated frontier fallback to recovery breaks calls/location.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A13 — tests/auth-confirm-replay.test.ts:320

"signed-out invalid links retain expired-link recovery"

**R** — Signed-out failed verification retains expired-link login with sanitized ordinary next.

Detectable failure / gap: Using signed-in frontier path despite null user breaks exact log/location.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A14 — tests/auth-confirm-replay.test.ts:335

"authenticated replay falls back to auth recovery when no Personal Plan frontier can be loaded"

**R** — Journey legacy/no frontier and thrown journey both retain safe auth fallback; warning is locally restored.

Detectable failure / gap: Failing to catch journey outage or treating legacy as Personal Plan breaks recovery.

Owner: src/app/auth/confirm/route.ts:111-437. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A15 — tests/auth-middleware-query-cleanup.test.ts:11

"authenticated /auth to /quiz clears the entire source query"

**R** — Actual canonical intake helper with NextRequest.nextUrl, auth→quiz clears entire error/next/lead query.

Detectable failure / gap: Failing auth-source search reset retains secret query.

Owner: src/lib/supabase/middleware.ts:333-358. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A16 — tests/auth-middleware-query-cleanup.test.ts:20

"authenticated /auth to /onboarding re-adds only lead"

**R** — Auth→onboarding preserves only allowed lead while dropping error/next/from; exact lead exception.

Detectable failure / gap: Removing re-add or preserving from breaks exact URL/search.

Owner: src/lib/supabase/middleware.ts:342-347. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A17 — tests/auth-middleware-query-cleanup.test.ts:29

"authenticated /auth to /chat clears the entire source query"

**R** — Auth→chat clears entire query including lead; different destination arm from onboarding.

Detectable failure / gap: Retaining lead outside onboarding breaks search equality.

Owner: src/lib/supabase/middleware.ts:342-347. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A18 — tests/auth-middleware-query-cleanup.test.ts:38

"non-auth quiz redirects keep their existing query handling"

**R** — Existing quiz retake URL preserves retake and returnTo, retains lead only for onboarding; two original calls.

Detectable failure / gap: Broad clear-all outside auth or failure to drop lead on chat breaks exact URLs.

Owner: src/lib/supabase/middleware.ts:350-358. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A19 — tests/auth-middleware-replay.test.ts:9

"authenticated auth routing strips auth-only error and token query material"

**R** — Forwarding wrapper reaches canonical owner on native URL with complete auth-only keys plus unrelated campaign. Exact clean chat URL.

Detectable failure / gap: Canonical auth-query reset removal fails line17. No complete same-input keeper in query-cleanup.

Owner: src/lib/supabase/middleware.ts:333-362. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A20 — tests/auth-middleware-replay.test.ts:20

"authenticated auth routing keeps the allowed onboarding lead while removing auth-only query material"

**R** — Native URL auth→onboarding retains lead and strips error/code; wrapper delegates requestUrl.pathname.

Detectable failure / gap: Changing canonical onboarding re-add fails line26. NextURL sibling is not identical input.

Owner: src/lib/supabase/middleware.ts:333-362. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A21 — tests/auth-middleware-replay.test.ts:29

"non-auth app routing does not silently strip ordinary route query parameters"

**R** — Native non-auth routine→quiz retains reason and next (not auth-only in this context).

Detectable failure / gap: Treating all source paths as auth fails line35. Quiz retake sibling has different path/query.

Owner: src/lib/supabase/middleware.ts:333-362. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A22 — tests/auth-middleware-replay.test.ts:38

"Personal Plan routine entitlement accepts active one-time access"

**R** — Active one-time receipt admits Personal Plan without guest metadata.

Detectable failure / gap: Removing oneTime active disjunct fails true equality.

Owner: src/lib/supabase/middleware.ts:291-310. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A23 — tests/auth-middleware-replay.test.ts:49

"Personal Plan routine entitlement accepts only active field-test access"

**R** — Field-test guest requires current access; positive and negative existing calls.

Detectable failure / gap: Ignoring current-access conjunct fails false equality.

Owner: src/lib/supabase/middleware.ts:291-310. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A24 — tests/auth-middleware-replay.test.ts:68

"Personal Plan routine entitlement accepts an active email-bound moderator without guest metadata"

**R** — Active email-bound moderator grants entitlement even without current app/guest metadata.

Detectable failure / gap: Removing moderator active disjunct fails line69.

Owner: src/lib/supabase/middleware.ts:291-310. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A25 — tests/auth-middleware-replay.test.ts:80

"ordinary app access does not become Personal Plan routine entitlement"

**R** — Ordinary current app access alone does not grant Personal Plan routine authority.

Detectable failure / gap: Generalizing current app access to routine grants fails false equality.

Owner: src/lib/supabase/middleware.ts:291-310. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A26 — tests/auth-middleware-replay.test.ts:91

"active partner accounts receive Personal Plan routine access"

**R** — Partner recognition from access kind or invitation metadata and current-access-gated routine authority, including nonpartner/expired controls.

Detectable failure / gap: Removing invitation metadata recognition or current-access conjunct breaks exact booleans.

Owner: src/lib/supabase/middleware.ts:245-251,291-310. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A27 — tests/auth-unauthenticated-redirect.test.ts:5

"sends unauthenticated app routes to login even without returning cookie"

**R** — All original protected app/API route rows without returning cookie lead to auth with exact next.

Detectable failure / gap: Omitting an app prefix routes to quiz and fails equality.

Owner: src/lib/auth/unauthenticated-redirect.ts:3-72. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A28 — tests/auth-unauthenticated-redirect.test.ts:36

"keeps first-time protected routes outside the app prefixes on the quiz funnel"

**R** — First-time protected billing outside app prefixes remains quiz funnel.

Detectable failure / gap: Making every protected path auth-first breaks quiz equality.

Owner: src/lib/auth/unauthenticated-redirect.ts:44-72. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A29 — tests/auth-unauthenticated-redirect.test.ts:40

"matches auth-first routes on segment boundaries"

**R** — Segment boundary siblings /chatty and /api/routines stay outside app-prefix auth handling.

Detectable failure / gap: Replacing boundary match with bare startsWith fails both existing assertions.

Owner: src/lib/auth/unauthenticated-redirect.ts:44-72;src/lib/auth/route-classification.ts:pathMatchesRoutePrefix. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A30 — tests/auth-unauthenticated-redirect.test.ts:45

"preserves session-expired copy for known returning users"

**R** — Returning cookie adds session_expired reason and exact original next/search.

Detectable failure / gap: Omitting reason or losing source query breaks URL equality.

Owner: src/lib/auth/unauthenticated-redirect.ts:56-72. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A31 — tests/quiz-email-return-browser.spec.ts:66

"recognized return stays on the ordinary quiz and Edit resumes prefilled answers"

**R** — Actual QuizPage shows prompt over ordinary first question; Edit request method/body, resulting URL and saved prefill draft/package/step observed. Context and choice HTTP responses mocked.

Detectable failure / gap: Failing Edit draft save/navigation or incorrectly restoring prior draft breaks DOM/storage assertions.

Owner: src/app/quiz/page.tsx:139-175,227-276;src/lib/quiz/draft.ts:93-109. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A32 — tests/quiz-email-return-browser.spec.ts:108

"the return prompt fits a small phone without hiding either decision"

**R** — Actual portal prompt in 390x844 browser: bounding rectangle inside viewport and both decision buttons visible.

Detectable failure / gap: Oversizing the live dialog width or hiding a decision breaks browser geometry; Node cannot replace it.

Owner: src/components/quiz/returning-lead-prompt.tsx:103-163. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A33 — tests/quiz-email-return-browser.spec.ts:127

"a link revoked while the prompt is open releases the ordinary quiz"

**R** — Prompt-open choice becomes revoked (HTTP410); actual UI releases modal, shows invalid explanation, retains ordinary question and safe URL.

Detectable failure / gap: Removing late-revocation arm traps modal and fails DOM/location.

Owner: src/app/quiz/page.tsx:239-246,380-406. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A34 — tests/quiz-email-return-browser.spec.ts:152

"Edit prefills the existing name and email screens and reuses same-address consent"

**R** — Actual lead-capture name/email prefill, same-address consent reuse; observes submitted API payload inherited/true and no consent sheet. API responses remain mocked.

Detectable failure / gap: Always prompting or losing identity/provenance breaks interaction/payload assertions.

Owner: src/components/quiz/quiz-lead-capture.tsx:236-280,318-339,406-434. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A35 — tests/quiz-email-return-browser.spec.ts:181

"Edit asks the existing consent question when the prefilled email changes"

**R** — Editing email after prefill opens normal consent and has not submitted a lead.

Detectable failure / gap: Inheriting consent without normalized identity match posts prematurely and fails.

Owner: src/lib/quiz/email-return-edit.ts:30-42;src/components/quiz/quiz-lead-capture.tsx:318-339. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A36 — tests/quiz-email-return-browser.spec.ts:202

"Edit remains completable through normal identity screens when prefill is unavailable"

**F** — Unavailable context only observes blank name and disabled Next; title promises completion but does not fill name/email or submit consent. Preserve those fallback assertions unchanged.

Detectable failure / gap: A regression enabling initial Next is caught; a later name/email/consent dead end survives this test. No equivalent completed unavailable-input keeper demonstrated.

Owner: src/components/quiz/quiz-lead-capture.tsx:255-279,306-339,692-806. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A37 — tests/quiz-email-return-choice.test.ts:11

"Continue binds the exact saved lead to a fresh email session, without quiz completion"

**R** — Actual POST Continue emits one landing_viewed event with exact bound lead/choice/package and responds result destination; signed funnel cookie session equals recorded session; edit cookie cleared.

Detectable failure / gap: Changing milestone/lead/choice/session linkage or destination breaks full existing oracle union. Mocks do not prove SQL attachment or prior-session freshness.

Owner: src/app/api/quiz/email-return/choose/route.ts:68-158. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A38 — tests/quiz-email-return-choice.test.ts:69

"Edit creates an unbound session and returns only prefilled quiz answers"

**R** — Actual POST Edit emits lead-null event, projects legacy stored answers (invalid hair length removed), returns answers and signed edit marker.

Detectable failure / gap: Binding old lead for Edit or copying invalid answers breaks event/body assertions. Continue executes different load/prefill branch.

Owner: src/app/api/quiz/email-return/choose/route.ts:96-158;src/lib/quiz/email-return-prefill.ts:7-15. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A39 — tests/quiz-email-return-credential.test.ts:20

"migration keeps the email-return capability service-only"

**R** — Full migration source contract: RLS, deny grants to PUBLIC/anon/authenticated, grant service role, security definer search-path. Independent breadth beyond PG subset.

Detectable failure / gap: Granting public table/function privilege breaks source forbidden-grant regex. This is architecture contract, not real DB proof.

Owner: supabase/migrations/20260918180721_quiz_email_return_links.sql:1-67. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A40 — tests/quiz-email-return-credential.test.ts:44

"email-return credentials are opaque 32-byte values and only their SHA-256 hash is persisted"

**R** — Real random token length/alphabet, SHA-256 shape and independently computed hash equality, format acceptance and malformed rejection.

Detectable failure / gap: Changing encoding/size/hash or permissive format breaks assertions. Persistence exercised separately in issuance.

Owner: src/lib/quiz/email-return-credential.ts:161-172. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A41 — tests/quiz-email-return-credential.test.ts:57

"resolution is read-only, fails closed for malformed, expired, and revoked credentials"

**R** — Malformed token returns exact invalid DTO without RPC; valid opaque token passes only hash to named RPC, empty row maps invalid, one call observed.

Detectable failure / gap: Forwarding plaintext/hash incorrectly or querying malformed input breaks counts/args. Expiry/revocation semantics are delegated SQL, not proved by mocked empty result.

Owner: src/lib/quiz/email-return-credential.ts:245-322. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A42 — tests/quiz-email-return-credential.test.ts:94

"token and signed-cookie link-id resolution both recheck the same live lifecycle"

**R** — Both token and link-id adapters invoke distinct named RPC with exact args and parse same resolved DTO.

Detectable failure / gap: Resolving link-id without lifecycle RPC or using wrong arg/name breaks call list. Mocked resolved row is not live revocation proof; PG is retained.

Owner: src/lib/quiz/email-return-credential.ts:273-322. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A43 — tests/quiz-email-return-credential.test.ts:138

"issuance persists the selected lead exactly once and does not reselect it on a later click"

**F** — Useful exact source lead/kind, normalized-email lookup, token hash-not-plaintext and deterministic30-day expiry assertions retained. Insert capture only stores last row; no count and no later resolution.

Detectable failure / gap: Duplicate insert or later-click reselection is unobserved despite title. Existing property assertions catch wrong binding/hash/TTL but cannot be credited for exactly-once/later lifecycle.

Owner: src/lib/quiz/email-return-credential.ts:174-236. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A44 — tests/quiz-email-return-credential.test.ts:175

"issuance refuses a package that the return entry cannot redeem"

**R** — Wrong package rejected before candidate loading; supplied loader throws if touched.

Detectable failure / gap: Removing package guard invokes forbidden loader and fails rather than returning unavailable.

Owner: src/lib/quiz/email-return-credential.ts:174-195. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A45 — tests/quiz-email-return-credential.test.ts:187

"revoke marks the stored hash and never handles the plaintext credential beyond hashing"

**R** — Token revocation computes expected stored hash and returns true for matched row.

Detectable failure / gap: Using plaintext token in equality filter breaks independent hash equality. Mock does not assert update payload/is-null column.

Owner: src/lib/quiz/email-return-credential.ts:324-374. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A46 — tests/quiz-email-return-credential.test.ts:213

"revocation by stored link ID reports no match rather than a false success"

**R** — ID revocation passes exact id filter and returns false for absent row.

Detectable failure / gap: Reporting true unconditionally or changing identity filter fails; distinct from token hash success.

Owner: src/lib/quiz/email-return-credential.ts:333-374. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A47 — tests/quiz-email-return-entry.test.ts:17

"valid email link strips the token and scopes a return cookie without opening a funnel"

**R** — Actual entry GET:303 token-free ready location/private no-store/no-referrer, actual signed context decodes only linkId and does not contain token; exact limiter/resolve counts.

Detectable failure / gap: Leaking token in redirect or cookie, dropping privacy headers, or repeating resolver breaks assertions. No actual funnel DB write proof asserted.

Owner: src/app/quiz/return/route.ts:22-97;src/lib/quiz/email-return-context.ts:14-70. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A48 — tests/quiz-email-return-entry.test.ts:59

"prefetch and disabled entry do not resolve a bearer credential"

**R** — Prefetch purpose gets204 even when disabled; ordinary disabled gets303 invalid; combined rate/resolver counter stayszero.

Detectable failure / gap: Moving disabled before prefetch changes204 to303; querying in either branch increments counter. Enabled-prefetch independence is not covered.

Owner: src/app/quiz/return/route.ts:55-70. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A49 — tests/quiz-email-return-postgres.test.ts:28

"real PostgreSQL enforces email-return link expiry, revocation and service-only access"

**R** — Opt-in real PG17 applies actual migration to explicit minimal roles/leads foundation; service hash/id read exactlead, anon/auth denials, revoked hash and expiredid both empty.

Detectable failure / gap: Removing SQL live lifecycle predicates or permissions yields forbidden row/access. Distinct from adapter/source checks. Default skip means native Node green is no DB evidence.

Owner: supabase/migrations/20260918180721_quiz_email_return_links.sql:1-67;tests/quiz-email-return-postgres.test.ts:8-98. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A50 — tests/quiz-email-return-selection.test.ts:18

"email matching is normalized and chooses the newest completed record across quiz kinds"

**R** — Normalized email selects newest completed saved record across legacy/Personal Plan, using original mixed rows.

Detectable failure / gap: Removing normalize or cross-kind ordering returns wrong id.

Owner: src/lib/quiz/email-return-credential.ts:85-143. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A51 — tests/quiz-email-return-selection.test.ts:35

"selection breaks equal submission timestamps by id and rejects drafts or unsupported records"

**R** — Equal timestamp sorts by id; newer null/empty answers, unsupported kind, foreign email do not win.

Detectable failure / gap: Trusting newest raw row or ascending tie order fails exact winner.

Owner: src/lib/quiz/email-return-credential.ts:100-143. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A52 — tests/quiz-email-return-selection.test.ts:72

"a supplied lead id remains bound even if a newer lead later exists"

**F** — Calls stateless selector twice with different arrays, asserts changed selection then old objectid remains. No credential issuance/store/redeem operation binds a lead.

Detectable failure / gap: A future resolver that reselects newest lead rather than stored source id survives; only sorting/reference immutability is observed. Hold unchanged, zero removal credit.

Owner: tests/quiz-email-return-selection.test.ts:72-86;src/lib/quiz/email-return-credential.ts:100-143;supabase/migrations/20260918180721_quiz_email_return_links.sql:31-62. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A53 — tests/result-email-return-page.test.ts:177

`exact lead-bound email session routes incomplete ${quizKind} to scanner`

**R** — One original AST callback expands legacy and PersonalPlan rows: actual server page executed in VM; mocked IO returns bound session. Exact lookup lead/session and resulting scanner/incomplete/variant/tracking/trialdays props.

Detectable failure / gap: Removing context-to-scanner path or wrong lookupargs fails assertions; distinct schema paths remain both rows. No DOM/DB integration claimed.

Owner: src/app/result/[leadId]/page.tsx:238-264,315-592. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A54 — tests/result-email-return-page.test.ts:193

"a complete legacy return retains its personalized diagnostic presentation"

**R** — Complete original legacy answers map returningProfileIncomplete false.

Detectable failure / gap: Marking every return incomplete breaks equality. Incomplete rows cannot absorb this different input.

Owner: src/app/result/[leadId]/page.tsx:376-387,584-586. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A55 — tests/result-email-return-page.test.ts:198

"missing, wrong-lead, wrong-package and wrong-visitor sessions cannot relax legacy parsing"

**F** — Existing five cases cover missing cookie/disabled flag/missing lookup/wrongpackage/wrongvisitor, each NOT_FOUND. No wrong-lead fixture exists; mocked lookup and admin eq ignore database filters.

Detectable failure / gap: Dropping actual funnel lead filter survives this test; preserve all five useful rejection cases. First positive tests only prove caller supplies lead argument, not actual lookup enforcement.

Owner: tests/result-email-return-page.test.ts:24-104,198-207;src/lib/funnel/server.ts:67-78;src/app/result/[leadId]/page.tsx:238-264. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A56 — tests/result-email-return-page.test.ts:210

"session database failure cannot silently select an ordinary offer"

**R** — Actual result page receives unavailable lookup and must throw exact recovery error rather than use ordinary offer.

Detectable failure / gap: Treating unavailable as absent or normal context breaks rejects regex.

Owner: src/app/result/[leadId]/page.tsx:250-253. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.

## A57 — tests/result-email-return-page.test.ts:214

"stopped trial or refinement rollout offers recovery without evaluating incomplete diagnostics"

**R** — Existing refinement-off/restricted-trial/disabled-trial rows return leaf recovery with exactlead and no children before incomplete diagnostics render.

Detectable failure / gap: Dropping recovery guard exposes children and fails; no claim UI contents or provider terms were browser tested.

Owner: src/app/result/[leadId]/page.tsx:498-512. Preservation: Unchanged whole registration, assertions, literals, fixtures and call topology.
