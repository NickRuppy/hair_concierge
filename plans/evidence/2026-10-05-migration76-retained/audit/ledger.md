# Migration/admission/prefill/frontier76 semantic ledger

75 R, 1 F held unchanged, 0 C, 0 D. All 76 callbacks/helpers/literal rows were read. No removal credit. Exact full bodies, assertion texts/lines and all lexical nonassert calls are in sites.json; snapshots preserve all support bytes. These lexical calls are evidence, not runtime counts.

- **R tests/personal-plan-frontier-routing.test.ts:10** — a qualifying source routes recovery and pre-Routine stages without legacy onboarding
  Contract: Recovery, Stage 1 and Stage 2 are distinct narrow-frontier outputs for missing source, initial and refined pointers.
  Credible regression / independent boundary: Changing sourceReady precedence or treating missing initial as Stage 2 loses a literal output. Other narrow fixtures do not contain all three input/output pairs.

- **R tests/personal-plan-frontier-routing.test.ts:34** — the narrow frontier routes Routine and Anwendung from durable pointers
  Contract: Pending proposal routes Stage 4; accepted routine routes Stage 5, with routine/application redirect exemptions.
  Credible regression / independent boundary: Treating pending as accepted or redirecting the routine owner despite its durable pointer fails. Loader stage4 fixture lacks accepted and redirect invocations.

- **R tests/personal-plan-frontier-routing.test.ts:72** — legacy users and explicit old-flow edits remain untouched
  Contract: Legacy users and explicit old onboarding edits stay unchanged; auth/routine requests use canonical unfinished destination.
  Credible regression / independent boundary: Applying frontier redirects to legacy/onboarding or failing auth redirection fails. No existing keeper calls the same route union.

- **R tests/personal-plan-frontier-routing.test.ts:92** — chat is never frontier-redirected for personal-plan users
  Contract: Chat root and nested chat paths remain exempt across Stage 1/3/5 and recovery.
  Credible regression / independent boundary: Adding chat to controlled paths fails. Stage derivation tests never call this path union.

- **R tests/personal-plan-frontier-routing.test.ts:129** — the owner-only routing source keeps a new legacy buyer in readiness until Stage 1 exists
  Contract: Owner RPC legacy purchase on cutoff enters recovery without private-table queries when initial pointer is absent.
  Credible regression / independent boundary: Routing directly to Stage 1 based on a lead alone or adding private from reads fails. Pure reducer cannot catch RPC wiring.

- **R tests/personal-plan-frontier-routing.test.ts:151** — an explicit regular-quiz field test reaches readiness without opening the customer cutover
  Contract: Regular-quiz field-test owner bypasses customer cutover/cutoff but waits for initial source readiness.
  Credible regression / independent boundary: Applying customer cutover to field-test owners fails. Paid and partner rows enter different source branches.

- **R tests/personal-plan-frontier-routing.test.ts:174** — partner routing falls back to its additive owner-only source
  Contract: Null primary source invokes additive partner owner RPC in order and routes partner recovery.
  Credible regression / independent boundary: Dropping fallback, wrong RPC, or premature legacy result fails. Missing-function keeper intentionally returns no partner source.

- **R tests/personal-plan-frontier-routing.test.ts:207** — code deployed before the additive partner RPC preserves ordinary legacy routing
  Contract: Exact absent partner-function deployment fallback tolerates matching PGRST202; unrelated 42883 propagates.
  Credible regression / independent boundary: Swallowing arbitrary database errors fails; successful fallback cannot establish failure discrimination.

- **R tests/personal-plan-frontier-routing.test.ts:256** — a paid legacy source still requires the customer cutover
  Contract: Paid legacy source with customer cutover disabled stays legacy.
  Credible regression / independent boundary: Treating all paid legacy leads as eligible fails. Migration-enabled historical source exercises a different explicit release exception.

- **R tests/personal-plan-frontier-routing.test.ts:279** — the narrow owner source routes from durable plan pointers and fails closed on cutoff
  Contract: Owner-source durable pointers yield Stage 4, while a cutoff one millisecond later rejects the same row.
  Credible regression / independent boundary: Ignoring cutoff or plan pointers fails. Pure reducer does not consume qualified_at or source_kind.

- **R tests/personal-plan-frontier-routing.test.ts:309** — moderator application entry routes recovery and unfinished setup safely
  Contract: Moderator application entry redirects recovery and unfinished Stage 1 using two literal source-readiness rows.
  Credible regression / independent boundary: Leaving application open without readiness/initial facts fails. Earlier pure frontier test does not invoke application redirects for both rows.

- **R tests/personal-plan-frontier-routing.test.ts:327** — migration candidates require rollout while bound Plans resume without the launch cutoff
  Contract: Candidate requires migration gate; ready bound enrollment resumes despite gate/cutoff; invented status fails closed.
  Credible regression / independent boundary: Applying candidate gate to ready bindings, or accepting arbitrary status, fails. Historical paid row is not a bound migration row.

- **R tests/personal-plan-frontier-routing.test.ts:372** — a valid historical paid source enters preparation when migration is enabled despite the old cutoff
  Contract: Historical paid source predating cutoff reaches preparation under migration release.
  Credible regression / independent boundary: Applying old cutoff unconditionally fails. Explicit migration candidate tests do not exercise source_kind paid.

- **R tests/personal-plan-journey-access.test.ts:26** — the server-derived frontier admits only contiguous persisted Personal Plan stages
  Contract: Full journey output exposes contiguous allowed stages and persisted plan/routine identifiers.
  Credible regression / independent boundary: Dropping a stage, pointer or pending indicator fails deep equality; narrow routing lacks the full admission payload.

- **R tests/personal-plan-journey-access.test.ts:40** — the frontier fails closed when a required fact or downstream release is absent
  Contract: Missing Stage 2/3/4 gates, current authority and routine facts stop the respective downstream admission.
  Credible regression / independent boundary: Admitting a later stage despite a missing prerequisite fails. Happy-path test cannot cover the five negative inputs.

- **R tests/personal-plan-journey-access.test.ts:96** — a prepared source without an aggregate is an explicit Stage 1 admission, never an empty id
  Contract: Prepared source with no aggregate returns explicit Stage 1 start without an empty plan id.
  Credible regression / independent boundary: Manufacturing empty aggregate identity fails. Existing plan fixtures never enter the null-plan branch.

- **R tests/personal-plan-journey-access.test.ts:105** — legacy, provisioning, and globally disabled cohorts never receive a Personal Plan route
  Contract: Legacy cohort, provisioning and disabled app choose their distinct route contracts.
  Credible regression / independent boundary: Conflating paid_pending recovery with active admission or losing global gate fails. Narrow routing lacks access-state semantics.

- **R tests/personal-plan-journey-access.test.ts:124** — none and revoked access remain legacy, while accepted Routines survive later Stage 3 staleness only with all downstream gates
  Contract: None/revoked remain legacy; accepted immutable routine survives stale Stage 3 authority only with downstream gates.
  Credible regression / independent boundary: Reviving revoked access or suppressing an accepted routine due to later draft staleness fails. Pending proposal is not equivalent authority.

- **R tests/personal-plan-legacy-cutover-eligibility.test.ts:22** — only an exact owned post-cutoff legacy lead receives cutover eligibility
  Contract: Exact owned lead at cutoff passes; foreign returned owner and one-millisecond pre-cutoff purchase reject.
  Credible regression / independent boundary: Removing returned-row ownership or inclusive cutoff validation fails. Fake builder ignores eq so returned-row guard is operative.

- **R tests/personal-plan-legacy-cutover-eligibility.test.ts:64** — the legacy cutover remains inert when its independent switch or app rollout is off
  Contract: Independent cutover disabled and injected app exclusion deny eligibility.
  Credible regression / independent boundary: Ignoring either dependency result fails. Public app currently returns true, but cutover remains configurable and owner contract still accepts the dependency.

- **F tests/personal-plan-legacy-cutover-eligibility.test.ts:88** — eligible and excluded legacy activations emit only aggregate transition dimensions
  Contract: Eligible PayPal activation emits exact aggregate dimensions and no raw user/lead identifiers; title additionally promises excluded events.
  Credible regression / independent boundary: Adding identifiers or wrong eligible dimensions fails; an excluded-only telemetry leak can survive because no excluded input is invoked. Hold unchanged; no repair/removal credit.

- **R tests/personal-plan-legacy-prefill.test.ts:6** — submitted but unrecognized night protection never becomes an explicit none answer
  Contract: Unknown submitted night value remains unanswered rather than explicit none.
  Credible regression / independent boundary: Normalizing unknown nonempty input to confirmed empty fails. Historical empty fixture has different submitted evidence.

- **R tests/personal-plan-legacy-prefill.test.ts:16** — maps only canonical saved profile facts and supported visible usage categories
  Contract: Canonical profile vocabulary and supported visible usage categories map; sentinel shampoo and unsupported category do not become answers.
  Credible regression / independent boundary: Including sentinel/unsupported category or wrong towel/drying/heat/night mapping fails. Other fixtures lack this canonical union.

- **R tests/personal-plan-legacy-prefill.test.ts:54** — keeps partial and ambiguous legacy facts unanswered and only permits empty arrays with submitted evidence
  Contract: Partial/ambiguous profile values remain omitted while independently submitted empty night is accepted.
  Credible regression / independent boundary: Guessing invalid frequency/towel/drying/tool facts or ignoring submitted evidence fails. No same-input keeper has all clauses.

- **R tests/personal-plan-legacy-prefill.test.ts:75** — does not map historical empty defaults without independent submitted evidence
  Contract: Historical empty arrays without submitted evidence remain absent.
  Credible regression / independent boundary: Treating old default arrays as explicit none fails. Submitted empty and unknown nonempty branches are distinct.

- **R tests/personal-plan-legacy-prefill.test.ts:84** — maps a confirmed empty styling-tools answer but not a mixed unknown array
  Contract: Confirmed empty styling tools map to empty; mixed known/unknown input preserves the recognized straightener.
  Credible regression / independent boundary: Discarding known tools or turning unconfirmed unknown data into none fails. No other callback supplies these two inputs.

- **R tests/personal-plan-legacy-prefill.test.ts:98** — separates verified exact inventory from frequency-repair and name hints
  Contract: Current eligible exact catalog inventory is distinct from invalid-frequency repair and retired/unmatched name hints.
  Credible regression / independent boundary: Promoting ineligible catalog rows or losing repair/name hints fails. Boolean matched status alone is not current publication authority.

- **R tests/personal-plan-legacy-prefill.test.ts:174** — never trusts a mismatched catalog category and has a stable source fingerprint
  Contract: Category-mismatched catalog identity is rejected; repeated same input yields a stable versioned fingerprint.
  Credible regression / independent boundary: Trusting mismatched catalog category fails even if fingerprint equality survives. Order-invariance keeper has different match input.

- **R tests/personal-plan-legacy-prefill.test.ts:203** — fingerprints equivalent input independently of property and row order
  Contract: Semantically equivalent objects and reversed usage rows yield equal versioned fingerprint.
  Credible regression / independent boundary: Hashing raw insertion/row order fails. Repeating identical input elsewhere does not establish canonicalization.

- **R tests/personal-plan-legacy-prefill.test.ts:223** — conflicting duplicate frequencies become a repair hint instead of an arbitrary exact seed
  Contract: Conflicting frequencies for one product produce repair hint instead of arbitrary exact seed.
  Credible regression / independent boundary: First-row-wins exact inventory fails. Single invalid frequency does not exercise conflicting duplicate grouping.

- **R tests/personal-plan-migration-admission-migration.test.ts:30** — resolve is read-only and admits current paid sources without manual grants
  Contract: Real SQL resolver admits active paid authority, excludes manual-only grants and writes no enrollment.
  Credible regression / independent boundary: Manual grant as payment or resolver INSERT fails. Route fakes supply authority and do not execute SQL.

- **R tests/personal-plan-migration-admission-migration.test.ts:61** — begin binds a unique owned legacy source and Stage 1 accepts only that ready migration
  Contract: Real begin binding replacement before Stage 1, routing identity, idempotent initial need and frozen source after Stage 1; forged lead/enrollment rejected.
  Credible regression / independent boundary: Changing bound source after initial plan or accepting foreign enrollment fails. Entire stateful sequence is not reproduced by DTO tests.

- **R tests/personal-plan-migration-admission-migration.test.ts:163** — paid parity covers one-time access and legacy profile fallback
  Contract: Real one-time delivered purchase admits and routes; legacy profile fallback admits; canceled non-renewing subscription rejects.
  Credible regression / independent boundary: Removing fallback or accepting non-current canceled authority fails. Other subscriptions never execute one-time join or profile authority branch.

- **R tests/personal-plan-migration-admission-migration.test.ts:203** — migration Stage 1 accepts a bound personal-plan artifact source
  Contract: Bound personal-plan artifact is accepted as migration Stage 1 source.
  Credible regression / independent boundary: Rejecting attached artifact source fails. Legacy quiz-source keeper takes the alternate source-kind clause.

- **R tests/personal-plan-migration-admission-migration.test.ts:234** — begin does not guess between ambiguous owned legacy leads and accepts explicit owned leads
  Contract: Ambiguous two owned leads stay pending; explicit owned choice binds; explicit captured lead is accepted.
  Credible regression / independent boundary: Guessing latest lead or requiring linked status for explicit choice fails. Single exact paid-lead fixture lacks ambiguity.

- **R tests/personal-plan-migration-admission-migration.test.ts:270** — existing field-test routing still wins over a migration candidate
  Contract: Existing eligible moderator field-test routing outranks unbound migration candidate and creates no migration ledger.
  Credible regression / independent boundary: Choosing candidate before field-test fails. Ready binding precedence in another sequence is materially different.

- **R tests/personal-plan-migration-admission-migration.test.ts:314** — begin rejects wrong-owner leads and readmits a stale enrollment to the current paid authority
  Contract: Wrong-owner requested lead cannot bind; expired previous authority is replaced by current subscription in resolve and begin.
  Credible regression / independent boundary: Trusting requested foreign id or stale authority fails. Stage 1 forged enrollment tests exercise a later RPC, not begin/resolve.

- **R tests/personal-plan-migration-admission-migration.test.ts:356** — begin does not create a migration ledger for an existing non-migration Plan
  Contract: Existing non-migration initial plan prevents creating a migration enrollment.
  Credible regression / independent boundary: Creating a migration ledger for an existing non-migration plan fails. Bound migration retry does not enter this guard.

- **R tests/personal-plan-migration-admission-migration.test.ts:383** — new admission functions and table remain service-only
  Contract: Actual installed function/table privileges exclude anon/authenticated and allow service-role begin/save.
  Credible regression / independent boundary: Granting authenticated execution or anon insert fails SQL privilege introspection. Service-client route fakes cannot observe grants.

- **R tests/personal-plan-migration-admission-migration.test.ts:414** — save migration quiz creates a fresh bound legacy lead and reuses exact retries
  Contract: Fresh save binds legacy lead, exact retry reuses identity, persists all fields and creates only one lead.
  Credible regression / independent boundary: Duplicate lead on retry or dropping persisted consent/name/answers fails. TypeScript wrappers cannot prove database writes.

- **R tests/personal-plan-migration-admission-migration.test.ts:483** — save migration quiz can replace an incomplete ready source without mutating the old lead
  Contract: Changed ready legacy source gets a fresh lead while original answers/status remain unchanged.
  Credible regression / independent boundary: Mutating old lead in place fails. Exact-retry case deliberately reuses identity; personal-plan source has distinct quiz_kind.

- **R tests/personal-plan-migration-admission-migration.test.ts:521** — save migration quiz can recover from a bound unused personal-plan source
  Contract: Unused bound personal-plan source can recover into a fresh legacy lead, preserving original kind/answers.
  Credible regression / independent boundary: Rejecting personal-plan recovery or overwriting old source fails. Legacy-source replacement does not enter quiz-kind difference.

- **R tests/personal-plan-migration-admission-migration.test.ts:561** — save migration quiz rejects other owners, expired access, email mismatch, and after Stage 1
  Contract: Save rejects foreign enrollment, email mismatch, expired paid authority and post-Stage-1 edits.
  Credible regression / independent boundary: Bypassing each explicit guard makes its literal invalid_context oracle fail. Independent sequence returns to valid access before Stage 1 check.

- **R tests/personal-plan-migration-admission-migration.test.ts:656** — pending migration enrollments cannot carry a quiz source
  Contract: Table check forbids pending enrollment with nonnull quiz source.
  Credible regression / independent boundary: Removing database ready/pending structural CHECK admits invalid row. RPC fakes and normal valid writes cannot catch direct invalid insert.

- **R tests/personal-plan-migration-admission.test.ts:30** — legacy migration admission is default-off for new candidate starts
  Contract: Migration new starts default off and exact true switch only; candidate is resolved then suppressed without writes.
  Credible regression / independent boundary: Treating missing/other truthy strings as enabled or returning candidate when off fails. SQL has no release environment gate.

- **R tests/personal-plan-migration-admission.test.ts:63** — resolve normalizes SQL snake_case admission rows when the gate is enabled
  Contract: Enabled resolve converts complete snake_case ready SQL row into canonical typed result.
  Credible regression / independent boundary: Losing admission/time/source fields fails full DTO equality. SQL parser spot status assertions are not full DTO union.

- **R tests/personal-plan-migration-admission.test.ts:95** — existing migration bindings remain readable while new starts are paused
  Contract: Gate-off begin uses resolver and retains existing pending binding.
  Credible regression / independent boundary: Calling write RPC while paused or hiding existing binding fails. Candidate default-off test has no enrollment.

- **R tests/personal-plan-migration-admission.test.ts:129** — enabled begin binds only user and optional lead through the database RPC
  Contract: Enabled begin sends only server-owned user and requested owned lead to exact RPC, then returns normalized ready row.
  Credible regression / independent boundary: Forwarding authority fields or wrong RPC/arguments fails. Raw SQL calls bypass wrapper argument construction.

- **R tests/personal-plan-migration-admission.test.ts:174** — begin sends a null lead when the user still needs source recovery
  Contract: Missing requested source is sent as explicit null and pending row is normalized.
  Credible regression / independent boundary: Omitting/null-default error or forcing ready fails. Explicit-lead keeper uses a different consumed argument.

- **R tests/personal-plan-migration-admission.test.ts:210** — malformed RPC payloads fail loudly instead of silently changing admission
  Contract: Malformed ready RPC row throws rather than inventing an admission.
  Credible regression / independent boundary: Fail-open parser accepting malformed authority/date fails. Fixture has multiple invalid fields, so it proves aggregate rejection only, not each validation independently.

- **R tests/personal-plan-migration-quiz-context.test.ts:17** — migration quiz context is signed, short-lived, and bound to user plus enrollment
  Contract: Signed context roundtrip binds enrollment/user, rejects other user, tamper and expired time.
  Credible regression / independent boundary: Accepting wrong signature/user or expiration fails. Route fixtures use valid signatures without this complete crypto/time union.

- **R tests/personal-plan-migration-quiz-context.test.ts:42** — migration quiz context refuses missing secrets and malformed identities
  Contract: Missing secret and malformed identity cannot issue valid recovery context.
  Credible regression / independent boundary: Issuing cookie with absent key or invalid IDs fails. Valid-cookie consumers cannot cover issuance rejection.

- **R tests/personal-plan-migration-quiz-context.test.ts:55** — migration quiz navigation and cookie options are server-owned
  Contract: Canonical recovery href and HTTP-only same-site path/age cookie options are fixed server-owned values.
  Credible regression / independent boundary: Changing destination, privacy flags or lifetime fails. No route fixture asserts complete serialized/constant option union.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:139** — migration quiz context route recovers missing recovery cookie without admin lookup
  Contract: Missing recovery cookie returns recover without auth/admin creation.
  Credible regression / independent boundary: Creating session or admin for ordinary cookie-free request fails. Signed-user mismatch crosses session auth first.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:161** — migration quiz context route returns canonical legacy answers only for the signed user's bound unused source
  Contract: Valid signed unused bound legacy source returns exact canonical answers, private cache and RPC/plan/lead read categories.
  Credible regression / independent boundary: Losing canonical normalization or cache privacy fails. Fake query builder does not prove SQL eq ownership filtering; retain actual positive output only.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:201** — migration quiz context route uses a fresh blank quiz for pending source without guessing another draft
  Contract: Pending same enrollment returns fresh_blank and never queries a lead.
  Credible regression / independent boundary: Guessing another draft from pending binding fails. Ready personal-plan source additionally checks consumed-plan guard.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:221** — migration quiz context route uses a fresh blank quiz for a ready personal-plan source
  Contract: Ready personal-plan source returns fresh_blank without reading legacy lead.
  Credible regression / independent boundary: Trying legacy prefill for personal-plan artifact fails. Pending-source keeper exits before source-consumption/kind branches.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:241** — migration quiz context route recovers when pending source belongs to a different enrollment
  Contract: Signed context for different enrollment cannot use a pending binding.
  Credible regression / independent boundary: Ignoring pending enrollment identity fails. Wrong-user cookie fails before admission, so it cannot replace this guard.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:262** — migration quiz context route does not prefill after an existing plan has consumed the source
  Contract: Already-consumed initial source returns recover.
  Credible regression / independent boundary: Reusing source after Stage 1 fails. All other route plan rows are null; SQL source freezing does not cover HTTP prefill.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:286** — migration quiz context route recovers mismatched signed context without leaking data
  Contract: Other signed user context returns recover before admin creation.
  Credible regression / independent boundary: Using a valid signature for wrong session owner fails. Missing cookie does not exercise decode identity binding.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:308** — migration quiz context route reports unavailable for transient authoritative lookup failures
  Contract: Authoritative admission failure returns unavailable rather than blank/recover and must not continue table lookups.
  Credible regression / independent boundary: Swallowing outage as empty quiz fails. Valid no-data paths are not outages.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:333** — migration quiz init helper resumes at the first missing prefilled question and ignores active work
  Contract: Parsed prefill resumes first missing question, preserves active answers, and gives recover/unavailable precedence; fresh blank remains explicit.
  Credible regression / independent boundary: Overwriting active work or wrong first missing step fails. Page retry covers only active-work ignore, not full union.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:389** — migration quiz init helper fails fresh-blank only for the exact server-issued recovery URL
  Contract: Only exact recovery query mode/destination activates migration; fallback failures distinguish recovery from ordinary starts; null payload unavailable.
  Credible regression / independent boundary: Broad returnTo or wrong mode acceptance fails. Direct nextHref helper uses response data, not URL intent.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:402** — lead capture only accepts the exact server-approved migration completion href
  Contract: Only exact relative server nextHref accepted; recovery redirect requires non-ok 403, not 503.
  Credible regression / independent boundary: Open redirect or sending outage to recovery fails. Page uses context response, not lead completion response.

- **R tests/personal-plan-migration-quiz-prefill.test.ts:427** — migration quiz page retry rechecks context in place without losing live answers
  Contract: Real QuizPage callback retries unavailable context in place, retaining live Zustand answers/step without reload/navigation.
  Credible regression / independent boundary: Retry calling reload, stale captured state overwriting answers, or no retry fetch fails. Custom dispatcher is not DOM/browser event propagation or React scheduler proof.

- **R tests/personal-plan-migration-ready-route.test.ts:89** — readiness GET only discovers migration; POST binds the validated source before projection
  Contract: HTTP GET is read-only discovery; POST binds before canonical source projection and returns readiness.
  Credible regression / independent boundary: GET writing binding or POST projecting before bind fails captured order. Dependencies inject readiness, so this is sequencing not SQL persistence proof.

- **R tests/personal-plan-migration-ready-route.test.ts:104** — migration preparation rejects cross-origin and expired-access requests before source writes
  Contract: Cross-origin POST and inactive access reject before migration/source calls.
  Credible regression / independent boundary: Moving writes before origin/access checks fails. Paid_pending is a distinct 200 recovery response.

- **R tests/personal-plan-migration-ready-route.test.ts:121** — paid-pending access returns its recovery status before migration discovery
  Contract: Paid_pending returns private recovery response before migration lookup.
  Credible regression / independent boundary: Treating provisioning as forbidden/ready or reading migration early fails. Expired access fixture has none, not paid_pending.

- **R tests/personal-plan-migration-ready-route.test.ts:135** — the app rollout cannot be bypassed by posting migration preparation directly
  Contract: POST obeys injected app admission gate before any source work.
  Credible regression / independent boundary: Ignoring appAllowed dependency fails. Default release is all, but handler dependency contract remains until separate owner cleanup.

- **R tests/personal-plan-migration-ready-route.test.ts:147** — both status payloads carry the package the readiness resolved
  Contract: GET and POST preserve package resolved by readiness in HTTP JSON.
  Credible regression / independent boundary: Dropping/replacing scan_v1 package fails. Basic ready fixture omits package and cannot catch transport loss.

- **R tests/personal-plan-migration-ready-route.test.ts:186** — a readiness that could not resolve the package reports transient_error, not organic ready
  Contract: Package-resolution failures produce transient_error for GET/POST instead of fabricated organic ready.
  Credible regression / independent boundary: Turning an authoritative exception into ready output fails. Success package forwarding keeper does not throw.

- **R tests/personal-plan-rollout-access.test.ts:68** — released Personal Plan access no longer reads internal rollout state
  Contract: Released app admission returns true without reading profile/internal state.
  Credible regression / independent boundary: Reintroducing internal DB lookup fails throwing fixture. This is current released default behavior, not a dormant branch.

- **R tests/personal-plan-rollout-access.test.ts:77** — an active tester grant admits a field-test owner without an email allowlist
  Contract: Dormant helper validates personal-plan tester enrollment/grant and admits without email allowlist.
  Credible regression / independent boundary: Removing positive enrollment/grant path fails direct helper test. Hold until cross-scope retired-seam cleanup accepted; no claim default loader reaches it.

- **R tests/personal-plan-rollout-access.test.ts:127** — an active regular-quiz tester grant is also an internal field-test owner
  Contract: Dormant helper falls through to regular-quiz enrollment and validates active tester grant in exact table order.
  Credible regression / independent boundary: Omitting fallback or querying wrong table fails. Separate SQL field-test owner remains live and is not a substitute for this helper contract.

- **R tests/personal-plan-rollout-access.test.ts:184** — an unapplied field-test relation is not an internal-owner signal
  Contract: Dormant helper treats exact missing field-test relations as no owner signal.
  Credible regression / independent boundary: Propagating known pre-migration absence or treating it as authority fails. Hold with dormant seam; unrelated error takes distinct branch.

- **R tests/personal-plan-rollout-access.test.ts:216** — field-test owner reads still fail closed on unrelated database errors
  Contract: Dormant helper propagates unrelated database error rather than declaring absence.
  Credible regression / independent boundary: Swallowing XX000 fails rejection. Hold with cross-scope seam rather than delete isolated failure guard.
