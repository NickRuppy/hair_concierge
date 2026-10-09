# Public funnel66 complete original-site ledger

66 original declarations / 79 native registrations. Judgments: {'R': 54, 'F': 9, 'C': 3}. Conditional C only; zero removals executed or credited. All F remain byte-exact.

Each row has complete assertion/call inventory and callback hash in complete-ledger.json; original whole bodies are frozen under originals/. Read-depth exceptions for supporting source and dependencies are in read-scope.json.

## funnel-api:1 — R
`tests/funnel-api.test.ts:12–22` · "accepts a bounded browser milestone payload" · native multiplicity 1

Valid fixed UUID + quiz_completed + {step:10} yields the exact sanitized success DTO. Detects parser dropping properties/milestone or returning a different status envelope. Route rejection inputs cannot preserve this positive DTO.

Operative owner/readset: `src/lib/funnel/api.ts`, `src/lib/funnel/server.ts`, `src/app/api/funnel/session/route.ts`.

## funnel-api:2 — R
`tests/funnel-api.test.ts:24–39` · "does not accept a browser-supplied quiz variant" · native multiplicity 1

quiz_started with an untrusted top-level quizVariant returns only eventId/milestone/properties. Detects browser-controlled variant leaking into trusted output; valid simple payload lacks the hostile field.

Operative owner/readset: `src/lib/funnel/api.ts`, `src/lib/funnel/server.ts`, `src/app/api/funnel/session/route.ts`.

## funnel-api:3 — R
`tests/funnel-api.test.ts:41–58` · "rejects malformed IDs and server-confirmed milestones" · native multiplicity 1

Invalid JSON, malformed UUID and each existing lead_captured/purchase_completed/unknown row exercise separate validation branches. Exact invalid_json/invalid_milestone/400 unions retained; no positive parser input subsumes them.

Operative owner/readset: `src/lib/funnel/api.ts`, `src/lib/funnel/server.ts`, `src/app/api/funnel/session/route.ts`.

## funnel-api:4 — F
`tests/funnel-api.test.ts:60–73` · "enforces UTF-8 body and property byte limits" · native multiplicity 1

Existing ASCII x payloads detect excessive property/body length and exact 413/error codes, but do not distinguish UTF-8 bytes from UTF-16/code-point length. Title overstates UTF-8 coverage. Keep unchanged; no non-ASCII case or repair credit added.

Operative owner/readset: `src/lib/funnel/api.ts`, `src/lib/funnel/server.ts`, `src/app/api/funnel/session/route.ts`.

## funnel-client:1 — R
`tests/funnel-client.test.ts:18–37` · "funnel context only admits the allowlisted server envelope" · native multiplicity 1

Allowlisted context envelope parser separates trusted acquisition/journey fields from unsupported values and partial scanner metadata; exact DTO assertions retained. This is a public parsing contract independent of request retry delivery.

Operative owner/readset: `src/lib/funnel/client.ts`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx`.

## funnel-client:2 — R
`tests/funnel-client.test.ts:39–56` · "failed bounded bootstrap retries and a later caller can retry again" · native multiplicity 1

Bounded failed bootstrap attempts plus later fresh caller retry observe request count, null state and eventual context. Removing retry reset changes this existing failure/recovery schedule; successful first-response tests cannot absorb it.

Operative owner/readset: `src/lib/funnel/client.ts`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx`.

## funnel-client:3 — R
`tests/funnel-client.test.ts:58–74` · "a timed-out request is bounded and the following attempt can recover" · native multiplicity 1

Unresolved request crosses injected short timeout then next attempt recovers. Detects unbounded pending promise or poisoned in-flight state. This clock/scheduler prefix differs from explicit transport errors.

Operative owner/readset: `src/lib/funnel/client.ts`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx`.

## funnel-client:4 — R
`tests/funnel-client.test.ts:76–103` · "milestone identity retains acquisition fields and a slow older GET cannot replace a new journey" · native multiplicity 1

Acquisition identity is retained when milestone updates race an older GET across journeys. Detects stale request overwriting newer signed-session context; same-journey enrichment has a different revision guard.

Operative owner/readset: `src/lib/funnel/client.ts`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx`.

## funnel-client:5 — F
`tests/funnel-client.test.ts:105–115` · "a successful retry publishes its resolved context to subscribers" · native multiplicity 1

One successful first attempt notifies the already subscribed observer with exact session ID. Title says retry but maxAttempts is 1 and no failure occurs, so retry-delivery prefix is untested. Keep meaningful subscriber contract unchanged; no new failed attempt added.

Operative owner/readset: `src/lib/funnel/client.ts`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx`.

## funnel-client:6 — R
`tests/funnel-client.test.ts:117–134` · "a same-journey milestone arriving before GET does not discard acquisition enrichment" · native multiplicity 1

Same-journey milestone precedes GET; acquisition enrichment must survive. Detects over-broad revision rejection that treats an identity-compatible enrichment like an old foreign journey.

Operative owner/readset: `src/lib/funnel/client.ts`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx`.

## funnel-client:7 — R
`tests/funnel-client.test.ts:136–148` · "an identity-only milestone before bootstrap still permits the acquisition GET" · native multiplicity 1

Identity-only pre-bootstrap milestone still permits acquisition GET. Detects marking the context ready before landing/quiz metadata has arrived; no existing complete envelope has this readiness prefix.

Operative owner/readset: `src/lib/funnel/client.ts`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx`.

## funnel-client:8 — R
`tests/funnel-client.test.ts:150–166` · "a successful HTTP response with incomplete scanner metadata is retried and never cached as ready" · native multiplicity 1

HTTP 200 with incomplete scanner context is retried and never cached ready. Detects treating status success as schema completeness. Distinct from non-OK, timeout and parse-only envelopes.

Operative owner/readset: `src/lib/funnel/client.ts`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx`.

## funnel-cookie:1 — R
`tests/funnel-cookie.test.ts:21–24` · "round trips a signed funnel context" · native multiplicity 1

Signed complete visitor/session/package/issuedAt round-trip under fixed secret. Detects encode/decode field loss or signature incompatibility. Route rejection fixtures do not observe complete decoded value.

Operative owner/readset: `src/lib/funnel/cookie.ts`, `src/proxy.ts`, `src/lib/funnel/packages.ts`.

## funnel-cookie:2 — R
`tests/funnel-cookie.test.ts:26–37` · "preserves campaign touch through same-session quiz navigation" · native multiplicity 1

Campaign touch replacement predicate covers same-session quiz navigation, explicit entry and changed-session cases with original path values. Detects campaign attribution replacement during navigation. HMAC validity does not subsume retention policy.

Operative owner/readset: `src/lib/funnel/cookie.ts`, `src/proxy.ts`, `src/lib/funnel/packages.ts`.

## funnel-cookie:3 — R
`tests/funnel-cookie.test.ts:39–47` · "rejects tampering, unknown packages, and expired contexts" · native multiplicity 1

Tampering, unknown package and expired context are rejected separately. Detects signature bypass, package allowlist bypass and max-age bypass. These are distinct consumed bytes/times; no stronger same-input keeper.

Operative owner/readset: `src/lib/funnel/cookie.ts`, `src/proxy.ts`, `src/lib/funnel/packages.ts`.

## funnel-cookie:4 — R
`tests/funnel-cookie.test.ts:49–60` · "touch cookies expire independently" · native multiplicity 1

Touch cookie has its own expiry independent of session lifetime. Detects accepting stale touch through the long-lived session duration. Keep separate from session-expiry test.

Operative owner/readset: `src/lib/funnel/cookie.ts`, `src/proxy.ts`, `src/lib/funnel/packages.ts`.

## funnel-migration:1 — R
`tests/funnel-migration.test.ts:14–21` · "migration creates private summary and append-only event tables" · native multiplicity 1

Actual migration text pins private summary/event table and RLS definitions. Independent database architecture contract: fake RPC mapping and HTTP responses cannot prove DDL/privacy.

Operative owner/readset: `supabase/migrations/20260711120000_funnel_attribution.sql`, `supabase/migrations/20260730120000_add_funnel_session_quiz_variant.sql`, `src/lib/funnel/server.ts`.

## funnel-migration:2 — R
`tests/funnel-migration.test.ts:23–40` · "atomic recorder serializes event IDs and keeps first milestones" · native multiplicity 1

Actual SQL recorder contains event lock/idempotency and first-milestone preservation clauses. Detects removal of serialized event IDs/COALESCE-first logic text. No DB execution or transaction correctness claim; retain separately from copied/mock persistence.

Operative owner/readset: `supabase/migrations/20260711120000_funnel_attribution.sql`, `supabase/migrations/20260730120000_add_funnel_session_quiz_variant.sql`, `src/lib/funnel/server.ts`.

## funnel-migration:3 — R
`tests/funnel-migration.test.ts:42–52` · "atomic recorder is service-role only" · native multiplicity 1

Actual SQL function privileges are service-role only, with revokes. Detects textual public/anon/authenticated grant regression. Browser predicate alone is not the SQL security boundary.

Operative owner/readset: `supabase/migrations/20260711120000_funnel_attribution.sql`, `supabase/migrations/20260730120000_add_funnel_session_quiz_variant.sql`, `src/lib/funnel/server.ts`.

## funnel-migration:4 — R
`tests/funnel-migration.test.ts:54–78` · "quiz variant migration validates known sessions before mutation and makes the snapshot immutable" · native multiplicity 1

Quiz variant SQL validates known inputs before mutation and preserves existing snapshot on conflict, including required backfill/allowlist literals. Detects loss of guard ordering or immutability expression in shipped migration; mapping fake does not execute this.

Operative owner/readset: `supabase/migrations/20260711120000_funnel_attribution.sql`, `supabase/migrations/20260730120000_add_funnel_session_quiz_variant.sql`, `src/lib/funnel/server.ts`.

## funnel-migration:5 — R
`tests/funnel-migration.test.ts:80–94` · "quiz variant RPC migration supports old named callers while granting only the new signature" · native multiplicity 1

RPC signature/default-null and old-signature removal/new-signature grants preserve existing named callers. Detects signature/grant contract drift; storage-state tests do not cover the generated/public callable surface.

Operative owner/readset: `supabase/migrations/20260711120000_funnel_attribution.sql`, `supabase/migrations/20260730120000_add_funnel_session_quiz_variant.sql`, `src/lib/funnel/server.ts`.

## funnel-rate-limit:1 — R
`tests/funnel-rate-limit.test.ts:6–22` · "funnel limiter uses normalized signed-session keys" · native multiplicity 1

Injected limiter observes normalized signed-session key and configured max/window. Detects replacing session identity with untrusted/raw key or wrong limits. No route rejection fixture reaches a successful signed quota call.

Operative owner/readset: `src/lib/rate-limit.ts`, `src/app/api/funnel/session/route.ts`.

## funnel-rate-limit:2 — R
`tests/funnel-rate-limit.test.ts:24–36` · "funnel limiter fails closed when its service is unavailable" · native multiplicity 1

Unavailable limiter service returns fail-closed result. Detects exception/unavailable admission. Existing exhausted-quota result has a different failure cause.

Operative owner/readset: `src/lib/rate-limit.ts`, `src/app/api/funnel/session/route.ts`.

## funnel-rate-limit:3 — R
`tests/funnel-rate-limit.test.ts:38–44` · "funnel limiter returns an ordinary rejection when quota is exhausted" · native multiplicity 1

Exhausted quota preserves ordinary rejected result rather than service failure. Detects conflating abuse rejection and infrastructure fault; independent response semantics.

Operative owner/readset: `src/lib/rate-limit.ts`, `src/app/api/funnel/session/route.ts`.

## funnel-route:1 — F
`tests/funnel-route.test.ts:43–50` · "funnel route rejects browser-spoofed purchases before database access" · native multiplicity 1

Actual POST with signed context and purchase_completed rejects 400 invalid_milestone. This covers transport admission, not a directly observed zero-database-call counter: an ignored read could occur and preserve response. Keep rejection contract unchanged; no DB-order proof claimed.

Operative owner/readset: `src/app/api/funnel/session/route.ts`, `src/lib/funnel/cookie.ts`, `src/lib/funnel/server.ts`.

## funnel-route:2 — F
`tests/funnel-route.test.ts:52–59` · "funnel route rejects tampered context without database access" · native multiplicity 1

Actual POST with tampered cookie returns 202 {enabled:false}. Real signature/context boundary exercised; fixture does not directly spy on every database entrypoint. An ignored read can remain invisible. Hold unchanged, no cleanup credit.

Operative owner/readset: `src/app/api/funnel/session/route.ts`, `src/lib/funnel/cookie.ts`, `src/lib/funnel/server.ts`.

## funnel-route:3 — F
`tests/funnel-route.test.ts:61–77` · "funnel route rejects oversized declared bodies before reading them" · native multiplicity 1

Declared content-length 9000 with harmless {} returns 413 payload_too_large. Does not observe request.text invocation/bodyUsed, so early-body-read claim is weaker than title. Keep exact admission response contract; no new request traps added.

Operative owner/readset: `src/app/api/funnel/session/route.ts`, `src/lib/funnel/cookie.ts`, `src/lib/funnel/server.ts`.

## funnel-server:1 — R
`tests/funnel-server.test.ts:11–17` · "browser funnel writes cannot claim server-confirmed conversions" · native multiplicity 1

Existing browser milestone predicate positive/negative values pin delivery authority below parser. API parser only uses selected examples; helper callers and server-confirmed conversions make this independent defense.

Operative owner/readset: `src/lib/funnel/server.ts`, `src/lib/funnel/packages.ts`, `src/lib/billing/analytics-destinations/funnel.ts`.

## funnel-server:2 — R
`tests/funnel-server.test.ts:19–59` · "record helper maps signed context and touch into the atomic RPC contract" · native multiplicity 1

Actual recordFunnelEventWithRpc consumes signed scalp package, PayPal reference, supplied occurrence/properties/touch and calls injected RPC with package/quiz/landing/provider/reference/time/first-touch assertions plus exact returned data identity. Detects adapter field mapping loss. No real SQL storage claim.

Operative owner/readset: `src/lib/funnel/server.ts`, `src/lib/funnel/packages.ts`, `src/lib/billing/analytics-destinations/funnel.ts`.

## funnel-server:3 — R
`tests/funnel-server.test.ts:61–76` · "record helper surfaces RPC failures" · native multiplicity 1

Injected RPC error object must reject through actual recorder. Detects swallowed DB failure or wrong error/message; successful mapping cannot replace error branch.

Operative owner/readset: `src/lib/funnel/server.ts`, `src/lib/funnel/packages.ts`, `src/lib/billing/analytics-destinations/funnel.ts`.

## funnel-server:4 — F
`tests/funnel-server.test.ts:78–98` · "result-only trusted offer context preserves a stored arm while browser events use packages" · native multiplicity 1

Trusted offer_viewed override guided-story-founder-letter is observed in p_offer_variant. Title also claims browser events use packages, but this callback only supplies trusted override; no negative override input. Keep positive provenance contract unchanged, do not invent missing browser case.

Operative owner/readset: `src/lib/funnel/server.ts`, `src/lib/funnel/packages.ts`, `src/lib/billing/analytics-destinations/funnel.ts`.

## funnel-server:5 — R
`tests/funnel-server.test.ts:100–123` · "browser funnel helper retains wall-clock occurrence when none is supplied" · native multiplicity 1

No occurredAt supplied: resulting RPC timestamp is between before/after wall-clock bounds. Detects constant/context-issuedAt replacement. Explicit occurrence mapping uses a different optional-argument branch.

Operative owner/readset: `src/lib/funnel/server.ts`, `src/lib/funnel/packages.ts`, `src/lib/billing/analytics-destinations/funnel.ts`.

## funnel-server:6 — R
`tests/funnel-server.test.ts:125–173` · "purchase helper returns typed permanent and transient outcomes" · native multiplicity 1

Missing row yields exact permanent not-found; valid mocked row plus RPC error yields transient failure/error text. Query builder select/eq are inert stubs so no table/filter identity proof. Typed outcomes remain credible and cannot be moved into positive adapter fixture.

Operative owner/readset: `src/lib/funnel/server.ts`, `src/lib/funnel/packages.ts`, `src/lib/billing/analytics-destinations/funnel.ts`.

## gated-example-pages:1 — R
`tests/gated-example-pages.test.tsx:23–40` · "with the freemium flag off the tier resolves premium without any lookup" · native multiplicity 1

Flag removed under finally restoration: real page-tier, app-access-state and gated-mode entrypoints all return premium without request context. Independent default short-circuit, not Boolean wrapper; prior removed helper tests are not counted again.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-example-pages:2 — F
`tests/gated-example-pages.test.tsx:52–66` · `${route} gates on the server tier before it renders the real page` · native multiplicity 4

Four existing route source rows require real server mode call and nearby example return. A return in wrong branch or nearby keepsake fallback can satisfy 1500-character window; no free/premium semantic execution. Hold architecture signal unchanged, no permission to remove real route/tier coverage.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-example-pages:3 — R
`tests/gated-example-pages.test.tsx:77–110` · "routine and anwendung resolve the tier concurrently with their own page data (F2)" · native multiplicity 1

Routine/application source locates Promise.all around gate and named page resolver. Detects named sequential-await regression and preserves latency architecture. It is a bounded structural guard, not timing/concurrency runtime proof; SSR copy does not subsume it.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-example-pages:4 — R
`tests/gated-example-pages.test.tsx:120–157` · "/chat streams the tier check behind Suspense only when the flag is on; flag off stays branch-free (X2)" · native multiplicity 1

Chat source pins separate flag-off literal return, later Suspense segment and sync exported page. Detects moving tier await to unconditional page branch. Unique streaming/default architecture; retained independently of rendered static example.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-example-pages:5 — R
`tests/gated-example-pages.test.tsx:161–174` · "each page has its own benefit line, never the sheet's own copy and never a generic pitch" · native multiplicity 1

Every existing page copy has distinct benefit, differs from sheet copy, retains own CTA rather than generic pitch. Exact table content read; detects copy homogenization independently of one rendered composition.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-example-pages:6 — R
`tests/gated-example-pages.test.tsx:176–185` · "the sheet context is the page's own" · native multiplicity 1

Existing copy contexts map routine/anwendung/chat to their own feature/source. Detects wrong opener attribution on one page. Hook-state CTA test uses chat override and cannot prove all registry rows.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-example-pages:7 — R
`tests/gated-example-pages.test.tsx:226–248` · "the Routine example is the real Routine page, filled with real catalog products" · native multiplicity 1

Real Routine SSR uses real four catalog fixtures and populated categories, no empty/gap/preview actions; whole product URL/image/copy assertions retained. Application/chat fixtures exercise different visual owners.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-example-pages:8 — R
`tests/gated-example-pages.test.tsx:250–269` · "the Anwendung example shows populated days, not empty ones" · native multiplicity 1

Real Anwendung SSR has populated confirmed shelf slots, rest visual and no partial/open states. Exact existing day fixture union retained; Routine markup is not same input/renderer.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-example-pages:9 — R
`tests/gated-example-pages.test.tsx:271–292` · "the Chat example is a short, capability-true transcript through the real bubbles" · native multiplicity 1

C2 keeper: existing Chat SSR + four-message/two-user fixture and capability bans/no feedback/product affordances. Gains donor empty timestamps and timestamp-markup absence using same html. Existing fixture/content assertions remain exact.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-example-pages:10 — C
`tests/gated-example-pages.test.tsx:294–299` · "no example message carries a timestamp — a formatted one would mismatch on hydration" · native multiplicity 1

C2: same GatedChatExample, router/pathname and initial hook state as immediately preceding stronger keeper. Transfer whole fixture timestamp loop and exact markup regex to existing html. No new render, messages or date inputs; preserve both raw field and rendered absence contracts.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-example-pages:11 — R
`tests/gated-example-pages.test.tsx:301–320` · "every example is framed by GatedPreview with its own label, benefit and one CTA" · native multiplicity 1

Original three-page render loop pins each feature/label/benefit/CTA and exactly one CTA block. Those existing composition inputs differ from isolated GatedPreview hook fixture. Retain all rows/calls; no table packing.

Operative owner/readset: `src/lib/gated-preview/gate.ts`, `src/lib/auth/authenticated-app-route-access.ts`, `src/components/gated-preview/gated-routine-example.tsx`, `src/components/gated-preview/gated-anwendung-example.tsx`, `src/components/gated-preview/gated-chat-example.tsx`.

## gated-pages-zero-mutation:1 — R
`tests/gated-pages-zero-mutation.test.tsx:127–135` · `gated ${name} renders without touching the network` · native multiplicity 3

C3 keeper: original routine/anwendung/chat loop traps fetch/XHR/beacon, restores globals and uses throwing router with /routine pathname. Each existing render result gains donor form/submit/formaction absence. Network and nonempty assertions remain exact; no mount-effect proof.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/gated-preview/inert-example.tsx`, `src/components/routine/personal-plan/routine-page.tsx`, `src/components/application/application-page.tsx`, `src/components/chat/chat-message.tsx`.

## gated-pages-zero-mutation:2 — C
`tests/gated-pages-zero-mutation.test.tsx:137–143` · `gated ${name} renders no form and no submit control` · native multiplicity 3

C3: identical renderComposition(Composition) under identical trap/router for same three existing rows. Transfer three complete negative markup assertions to prior existing result; delete duplicate registration only. Three native renders removed, no new cases/rows/calls.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/gated-preview/inert-example.tsx`, `src/components/routine/personal-plan/routine-page.tsx`, `src/components/application/application-page.tsx`, `src/components/chat/chat-message.tsx`.

## gated-pages-zero-mutation:3 — R
`tests/gated-pages-zero-mutation.test.tsx:212–232` · "the import-graph walker actually reaches the real page components" · native multiplicity 1

Positive graph control reaches actual Routine card, Anwendung day card and Chat bubble. Prevents completely inert resolver/walker from making exclusions vacuous. Independent architecture support, no duplicate with rendered output.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/gated-preview/inert-example.tsx`, `src/components/routine/personal-plan/routine-page.tsx`, `src/components/application/application-page.tsx`, `src/components/chat/chat-message.tsx`.

## gated-pages-zero-mutation:4 — F
`tests/gated-pages-zero-mutation.test.tsx:235–244` · `gated ${name} never reaches a module that writes` · native multiplicity 3

Existing per-composition graph excludes seven named write modules but regex follows double-quoted static from imports/exports only. Dynamic, side-effect or single-quoted imports can evade it; PremiumSheet also has live writes outside denylist but closed in preview. Retain bounded static exclusion defense unchanged; no universal no-write claim.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/gated-preview/inert-example.tsx`, `src/components/routine/personal-plan/routine-page.tsx`, `src/components/application/application-page.tsx`, `src/components/chat/chat-message.tsx`.

## gated-pages-zero-mutation:5 — R
`tests/gated-pages-zero-mutation.test.tsx:246–263` · `gated ${name} contains no request call of its own` · native multiplicity 3

Existing per-entry graph checks only gated component/fixture/copy sources for fetch/beacon/API route literals. Direct request insertion there is independently caught even in unmounted effect. This is lexical scope, not entire reachable UI/provider closure.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/gated-preview/inert-example.tsx`, `src/components/routine/personal-plan/routine-page.tsx`, `src/components/application/application-page.tsx`, `src/components/chat/chat-message.tsx`.

## gated-pages-zero-mutation:6 — F
`tests/gated-pages-zero-mutation.test.tsx:269–279` · `gated ${name}: every example link sits inside the inert wrapper` · native multiplicity 3

Each composition checks no anchor before inert marker or after CTA marker. It does not locate the actual closing inert div, so an anchor between that closing tag and CTA can escape yet pass. Hold unchanged; event cancellation tests and zero-network render do not fix ancestry gap.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/gated-preview/inert-example.tsx`, `src/components/routine/personal-plan/routine-page.tsx`, `src/components/application/application-page.tsx`, `src/components/chat/chat-message.tsx`.

## gated-pages-zero-mutation:7 — R
`tests/gated-pages-zero-mutation.test.tsx:282–300` · "InertExample cancels activation before the wrapped component's own handler runs" · native multiplicity 1

Actual InertExample capture handlers synchronously preventDefault and stopPropagation for click/auxclick/submit original event rows. Detects missing suppression and retains concrete dispatch props; SSR cannot execute events.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/gated-preview/inert-example.tsx`, `src/components/routine/personal-plan/routine-page.tsx`, `src/components/application/application-page.tsx`, `src/components/chat/chat-message.tsx`.

## gated-pages-zero-mutation:8 — R
`tests/gated-pages-zero-mutation.test.tsx:302–317` · "InertExample also cancels keyboard activation" · native multiplicity 1

Actual keydown capture cancels Enter/Space but leaves Tab untouched with exact ordered recorder array. Detects keyboard escape or accidental focus-navigation suppression; mouse capture is distinct input.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/gated-preview/inert-example.tsx`, `src/components/routine/personal-plan/routine-page.tsx`, `src/components/application/application-page.tsx`, `src/components/chat/chat-message.tsx`.

## gated-preview-component:1 — R
`tests/gated-preview-component.test.tsx:117–139` · "renders the frame, the Beispiel band, the benefit line and exactly one CTA" · native multiplicity 1

C1 keeper: real GatedPreview single-useState dispatcher initial false, routine defaults and existing child. Frame/label/benefit/single CTA/viewport assertions retained, gains scroll union against same returned tree; no PremiumSheet child invocation.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/premium-sheet/premium-sheet.tsx`, `src/components/ui/button.tsx`.

## gated-preview-component:2 — C
`tests/gated-preview-component.test.tsx:141–169` · "the example content sits inside the one in-frame scroll container" · native multiplicity 1

C1: identical renderPreview().render() fixture and initial dispatcher. Move full scroll/role/ARIA/nonempty-ID/tabstop/child/exact-one-scroller union into prior keeper. Reuse keeper existing identical label query (including helper uniqueness assertion); remove second component render, no new input.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/premium-sheet/premium-sheet.tsx`, `src/components/ui/button.tsx`.

## gated-preview-component:3 — R
`tests/gated-preview-component.test.tsx:171–191` · "the CTA opens the Premium sheet with the exact page context" · native multiplicity 1

Chat override follows closed→CTA click→open context→onClose→closed in same harness. Detects broken opener/closer state or wrong feature/source. Snapshot/default routine keeper has no interaction prefix; retain.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/premium-sheet/premium-sheet.tsx`, `src/components/ui/button.tsx`.

## gated-preview-component:4 — R
`tests/gated-preview-component.test.tsx:193–209` · "every user-facing string comes from the caller — the component hard-codes no copy" · native multiplicity 1

Application override propagates all three supplied strings and rejects routine/generic defaults. Detects caller copy loss/hardcoding. Different consumed feature/source/copy input, no default-fixture equivalence.

Operative owner/readset: `src/components/gated-preview/gated-preview.tsx`, `src/components/premium-sheet/premium-sheet.tsx`, `src/components/ui/button.tsx`.

## editorial-pages:1 — R
`tests/editorial-pages.test.tsx:31–47` · "Methodik shows the required trust, commercial, ownership, and medical boundaries" · native multiplicity 1

Actual MethodikContent SSR asserts cosmetic/self-report/uncertainty/source/affiliate/ownership/medical referral/quiz link and bans validation overclaim. Protected public content union retained; source occurrence checks are not same renderer/input.

Operative owner/readset: `src/app/methodik/page.tsx`, `src/components/editorial/editorial-shell.tsx`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/app/not-found.tsx`, `src/app/agb/page.tsx`, `src/app/widerruf/page.tsx`, `src/app/datenschutz/page.tsx`.

## editorial-pages:2 — R
`tests/editorial-pages.test.tsx:49–60` · "the Methodik shell keeps the shared frame without exposing a premature Ratgeber" · native multiplicity 1

Editorial shell source composes header/main/footer; actual footer SSR has legal imprint and no Methodik/Ratgeber links. Independent frame/footer visibility constraint, not entire Methodik copy equivalence.

Operative owner/readset: `src/app/methodik/page.tsx`, `src/components/editorial/editorial-shell.tsx`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/app/not-found.tsx`, `src/app/agb/page.tsx`, `src/app/widerruf/page.tsx`, `src/app/datenschutz/page.tsx`.

## editorial-pages:3 — R
`tests/editorial-pages.test.tsx:62–77` · "Methodik bootstraps first-party funnel context without editorial vendor tracking" · native multiplicity 1

Methodik explicitly opts in to first-party bootstrap, default shell off, public bootstrap exact effect and no vendor/auth/milestone dependencies. Architecture/privacy contract absent from SSR because effects do not execute.

Operative owner/readset: `src/app/methodik/page.tsx`, `src/components/editorial/editorial-shell.tsx`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/app/not-found.tsx`, `src/app/agb/page.tsx`, `src/app/widerruf/page.tsx`, `src/app/datenschutz/page.tsx`.

## editorial-pages:4 — R
`tests/editorial-pages.test.tsx:79–86` · "unknown routes render a branded German recovery page" · native multiplicity 1

Actual NotFound SSR has branded German copy and home/quiz recovery links, bans framework English fallback. Separate page identity and output.

Operative owner/readset: `src/app/methodik/page.tsx`, `src/components/editorial/editorial-shell.tsx`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/app/not-found.tsx`, `src/app/agb/page.tsx`, `src/app/widerruf/page.tsx`, `src/app/datenschutz/page.tsx`.

## editorial-pages:5 — R
`tests/editorial-pages.test.tsx:88–93` · "unknown routes keep the default tracking-free editorial shell" · native multiplicity 1

NotFound source opts into default tracking-free shell and excludes bootstrap/session/vendor references. Distinct privacy dependency contract; a clean SSR cannot prove mount-time privacy.

Operative owner/readset: `src/app/methodik/page.tsx`, `src/components/editorial/editorial-shell.tsx`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/app/not-found.tsx`, `src/app/agb/page.tsx`, `src/app/widerruf/page.tsx`, `src/app/datenschutz/page.tsx`.

## editorial-pages:6 — R
`tests/editorial-pages.test.tsx:95–149` · "approved public copy uses serious, non-medical product framing" · native multiplicity 1

Existing multi-file source literals pin approved serious non-medical public framing and ban old risk/diagnosis/time claims. Keep all literals/files. Limited to source occurrence/absence, not proof each branch displays it or legal correctness. Active default variant still registered; no retirement inferred.

Operative owner/readset: `src/app/methodik/page.tsx`, `src/components/editorial/editorial-shell.tsx`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/app/not-found.tsx`, `src/app/agb/page.tsx`, `src/app/widerruf/page.tsx`, `src/app/datenschutz/page.tsx`.

## editorial-pages:7 — R
`tests/editorial-pages.test.tsx:158–183` · "legal pages preserve existing one-time purchases without offering new ones in the trial launch" · native multiplicity 1

Actual AGB/Widerruf/Datenschutz SSR normalized text protects legacy one-time promises, no new quarter/one-time offering, guarantee/refund/access and privacy wording. Membership fixture has only AGB, so cannot absorb complete multi-page union without additional calls/packing.

Operative owner/readset: `src/app/methodik/page.tsx`, `src/components/editorial/editorial-shell.tsx`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/app/not-found.tsx`, `src/app/agb/page.tsx`, `src/app/widerruf/page.tsx`, `src/app/datenschutz/page.tsx`.

## editorial-pages:8 — R
`tests/editorial-pages.test.tsx:185–217` · "rendered membership terms disclose approved trial prices and preserve legacy price promises" · native multiplicity 1

Actual AGB SSR pins 7-day trial/prices/authorization start/paid-period start/legacy promises/no quarter plan/year renewal/refund/withdrawal. Different domain contract from legacy multi-page test; avoid unrelated legal assertion packing despite repeated AGB render.

Operative owner/readset: `src/app/methodik/page.tsx`, `src/components/editorial/editorial-shell.tsx`, `src/providers/public-funnel-context-bootstrap.tsx`, `src/app/not-found.tsx`, `src/app/agb/page.tsx`, `src/app/widerruf/page.tsx`, `src/app/datenschutz/page.tsx`.

## landing-client-import-boundary:1 — R
`tests/landing-client-import-boundary.test.ts:17–50` · "landing client dependency graphs contain no static Sentry SDK import" · native multiplicity 1

AST static-value graph from five existing entries tracks client boundary and rejects @sentry/nextjs; type-only imports excluded. Detects static SDK edge reintroduced before deferred runtime. Source graph intentionally ignores dynamic imports; SSR cannot prove bundle deferral.

Operative owner/readset: `instrumentation-client.ts`, `src/app/global-error.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/lp/[slug]/page.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-continuation.ts`.

## landing-client-import-boundary:2 — R
`tests/landing-client-import-boundary.test.ts:52–92` · "fresh personal-plan entry keeps the full quiz behind a dynamic import boundary" · native multiplicity 1

AST static-value graph from fresh quiz entry excludes four deferred heavy modules while requiring continuation module and dynamic full-quiz import text. Detects lost split or fake empty graph. No browser chunk/timing proof; current async continuation and fresh-entry caller read.

Operative owner/readset: `instrumentation-client.ts`, `src/app/global-error.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/lp/[slug]/page.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx`, `src/components/personal-plan-quiz/personal-plan-quiz-continuation.ts`.
