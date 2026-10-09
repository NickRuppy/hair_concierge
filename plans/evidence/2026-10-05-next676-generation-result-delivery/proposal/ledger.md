# Initial Plan production and durable artifact/result return: full case ledger

27 current files, 157 AST declarations. {'R': 139, 'F': 11, 'C': 4, 'D': 3}. F declarations stay byte-identical, zero credit. Candidate deletions are conditional; no repository changes or test execution.

## tests/personal-plan-email-precheck.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 19 | R | precheck accepts a deliverable address without touching persistence | Successful deliverability maps normalized email and suggestion without persistence; a changed successful lookup projection or normalization fails exact response/calls. |
| 47 | R | precheck rejects an undeliverable address in the lead route's rejection shape | Undeliverable lookup must preserve lead-compatible rejection reason, original email and suggestion; returning accepted or losing the correction fails. |
| 72 | R | precheck rejects malformed bodies before any deliverability lookup | Malformed body matrix must return 400 before deliverability invocation; a permissive schema or lookup-before-parse fails lookup counter. |
| 97 | R | precheck fails with 500 when the lookup throws so the client can fail open | Thrown DNS/deliverability exception maps 500 for fail-open client handling; swallowed success or wrong rejection shape fails. |
| 113 | R | precheck throttles on its own budget before resolving any domain | Dedicated precheck budget rejects before DNS and carries bounded retry metadata; borrowing lead budget or performing lookup after denial fails. |
| 146 | R | precheck answers 503 when the rate limiter itself is unavailable | Limiter unavailable is 503 rather than ordinary 429; wrong operational failure mapping fails. |

## tests/personal-plan-preparation-client.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 32 | R | preparation credentials use a Web Crypto UUID and 32-byte claim token | Crypto-derived UUID version/variant plus 32-byte opaque claim token; weak length/bit masking or non-random credential construction fails independent byte-derived checks. |
| 47 | R | pending preparation survives a lost response only for the same fresh answers | Stored preparation identity survives only identical fresh answer key; expiry, malformed storage and differing answers invalidate it. This is browser persistence, not server replay duplication. |
| 82 | R | preparation Retry-After accepts only the bounded short-window contract | Retry-After accepts only integer short waits in its explicit bound; accepting fractional, excessive or malformed headers violates independently tested parser boundary. |
| 105 | R | one 429 waits for the short server boundary and retries exactly once | One 429 schedules exact server wait then retries once with unchanged body/credential; off-by-one retry or wrong wait/request receipt fails. |
| 133 | R | preparation detaches an injected browser fetch before calling it | Injected native-like browser fetch must be detached; binding it to helper input makes this fixture throw. This tests a real invocation ABI, not fabricated response policy. |
| 150 | R | credential conflicts and mismatched success receipts discard only the poisoned credential | 409 and successful mismatched artifact/token receipts discard poisoned identity; ordinary successful receipt does not. Wrong discard flag or trusting foreign receipt fails. |
| 176 | R | a second 429 or invalid wait contract stops without a third request | Second 429 and invalid wait stop without request three; unbounded retry or honoring invalid delay fails observed invocation count. |
| 201 | R | non-rate failures retain one bounded retry but ordinary 4xx stops | Network/5xx retain one bounded retry while ordinary 4xx stop; these consume different response/throw branches, not redundant raw strings. |

## tests/personal-plan-prepare-idempotency-migration.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 104 | R | preparation RPC inserts once and returns the exact replay receipt | Actual PGlite RPC insert and same-identity replay preserve original expiry and one row; changing replay branch to insert/update expiry fails database output. |
| 131 | F | preparation RPC fails closed for mismatched replay authority | Different answer hash, token hash and user replay rejection plus a second-ID reused claim token are meaningful SQL authority. Generic rejects does not assert SQLSTATE or intended mismatch reason; hold unchanged until narrow negative-oracle repair, no cut. |
| 148 | R | preparation RPC replays attached success but rejects an expired unclaimed artifact | Attached successful artifact remains replayable despite age while expired prepared artifact rejects; status/expiry conjunction is distinct from new insert validation. |
| 169 | F | preparation RPC rejects a new artifact whose requested expiry is not in the future | New expired preparation must reject, but generic rejection does not identify expiry guard. Retain this input; repair oracle separately rather than delete. |
| 174 | R | preparation RPC stays service-only and expired limiter windows are cleaned every five minutes | Service-only RPC signature/revocations plus actual cron schedule five-minute retention are independent deployment/ACL contracts absent from fake application tests. Static identifier syntax is executable SQL identity. |

## tests/personal-plan-prepare-route.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 87 | C | prepare protection has dedicated short-window journey and IP budgets | C3: both constants and namespace exclusions transfer onto configs already consumed by the actual preparation handler. |
| 102 | R | prepare preserves disabled and unavailable context boundaries | Disabled handler is 404 without rate call; unavailable verified context is 503 without preparation. Ordering/access branches differ from successful keeper. |
| 116 | R | prepare maps an unexpected context throw to its structured server error | Unexpected context throw produces structured500 and one log; typed unavailable alone cannot catch outer exception response regression. |
| 135 | R | prepare applies the IP ceiling before journey resolution and persists the browser replay identity | Primary C3 keeper: actual IP-before-context-before-journey invocation, client replay identity, receipt and hashed claim. Transferred config literals prevent producer-correlated budget oracle. |
| 160 | R | prepare skips the journey bucket when no verified identity resolves | Absent verified journey skips only journey bucket; preserving emergency IP call/order independently catches invented anonymous journey key. |
| 172 | R | prepare returns Retry-After only for a real rejected limiter | Actual rejected vs unavailable limiter must differ Retry-After/error statuses; synthetic handler default-success cannot prove rejection behavior. |
| 196 | R | prepare gives already-open legacy pages a server replay credential | Legacy already-open page lacking both replay fields gets server credential and exact returned identity; partial credentials follow different reject path. |
| 212 | R | prepare rejects a partial replay credential before persistence | Partial credential rejected before persistence; accepting one browser-owned authority field would break replay ownership. |
| 224 | R | prepare returns a stable conflict response for mismatched replay credentials | Typed replay conflict maps409 stable code, not500 or success; storage mock supplies exception but route owns mapping. |
| 235 | R | production persistence maps conflicts, validates receipts, and purges only after inserts | Production RPC adapter binds exact payload, maps22023/23505, rejects malformed receipts and purges only newly inserted rows; this executes actual adapter, not mock receipt validation. |

## tests/personal-plan-prepared-plan.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 55 | R | V2 adapter uses the fixed taxonomy, diagnostic priority, and required elasticity answer | V2 adapter taxonomy, ranked diagnosis and mandatory elasticity conversion asserted independently; mapping old fields to wrong current vocabulary fails. |
| 78 | R | multiple scalp concerns retain the safest supported shampoo direction | Multiple scalp concerns select conservative supported direction; permissive severe-scalp recommendation is detectable. |
| 89 | R | volume balance follows factual hair signals instead of selection order | Volume goal follows factual hair signals and is invariant to selection order; first-selected shortcut fails opposite ordering. |
| 117 | R | new damage concern is retained without merging it into Frizz | Hair damage remains its own concern rather than merged into frizz; dropping that mapped concern fails. |
| 126 | R | combined hair-loss concern appends profile compatibility without displacing routine concerns | Combined hair-loss compatibility does not evict routine concerns and preserves limited scope; cap/order regressions fail. |
| 153 | R | prepared artifact contains three public dimensions but keeps products and routine locked | Prepared artifact exposes three public dimensions while products/routine remain locked; accidental public disclosure or dimension loss fails. |
| 174 | R | prepared artifact keeps email priority separate from the offer assessment | Email central priority and offer assessment remain separate; copying row-one assessment to email source fails independently specified values. |
| 198 | R | straight, wavy, curly, and coily complete profiles all prepare deterministic plans | Complete straight/wavy/curly/coily inputs build deterministic artifacts; distinct texture/category paths are not covered by one neutral profile. |
| 225 | R | canonical answer hash ignores selection order but changes with durable answers | Canonical answer hash ignores order but changes with durable factual changes; versioned content identity is a storage contract, not self-comparison. |

## tests/personal-plan-production-client.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 65 | R | optional inventory entry is a POST separate from baseline draft loading | Stage3 optional inventory POST endpoint/body is distinct from baseline GET; fake response does not own request construction or real bootstrap validation. |
| 96 | R | optional Stage 2 entry uses a separate POST and returns the prepared successor revision | Stage2 optional module POST body and returned revision plus ordinary GET; wrong endpoint/method/module projection fails. |
| 117 | R | the browser Stage 2 gateway maps a failed load to a typed error and retries with a fresh request | 503 typed error then a new successful load must issue request two; helper caching failure or untyped exception fails. |
| 136 | R | the browser Stage 2 gateway saves and completes the final page in one request | Final answer combines PATCH and completeAfterSave with expected revision and returns handoff; splitting/lossy serialization fails observed request and result. |
| 172 | R | the browser Stage 2 gateway preserves the durable final page on completion failure | Completion503 retains savedSession on typed error so durable answer survives recovery; dropping nested receipt fails. |
| 200 | R | the browser Stage 2 gateway passes through a present recompute outcome from a module completion | Module completion passes through present recompute; stripping the optional field fails. Distinct from absent property behavior. |
| 229 | R | the browser Stage 2 gateway leaves an absent recompute field undefined, never invents one | Absent module recompute stays absent as own key, not merely undefined; synthesizing a field fails key assertion. |
| 258 | R | the browser intake client posts a stable UUID idempotency key with valid manual input | Intake stable UUID is sent as idempotency header and omitted from body while input/revision retained; transport contract owned by actual gateway. |

## tests/personal-plan-ready-server-first.test.tsx

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 16 | R | email recovery renders only the current missing group with an honest remaining count | Multiple missing facts display only current question, honest remaining count, checkbox and no scanner link; rendering all questions/early scanner CTA fails SSR. |
| 52 | R | a ready email return buyer gets the scanner destination for Personal Plan sources too | Ready authenticated email-return package uses scanner destination even with personal-plan source; source-kind-only routing fails. |
| 70 | R | server-first pending envelope renders approved static copy and no-JS recovery | C4 checking keeper: approved pending copy/loading marker and no-JS reload/support links; additionally retains header absence/wordmark for same checking input. |
| 101 | R | server-first ready envelope renders the signed-off arrival screen (Variante B) | Ready envelope literal approved copy, retired-stage absence, correct href and no-JS ready state; distinct ready branch retained. |
| 157 | R | missing source facts ask for the fact without claiming no action is needed | C4 missing-fact keeper: exact question and actionable copy, additionally same input header invariants; falsely passive wording fails. |
| 186 | R | forbidden and invalid states show support without waiting or payment claims | C4 support keeper: forbidden/invalid states do not promise waiting/payment and retain support CTA plus header invariants; both input rows unchanged. |
| 210 | R | timeout and transient states lead with a retry state instead of a live check | C4 retry keeper: timeout/transient render retry not live-check copy plus header invariants; legacy initialStatus and envelope inputs remain. |
| 236 | F | client honors none, link, and poll initial actions instead of always posting | Source matching helper names and method spelling is refactor-sensitive and does not execute poll effects. Meaningful none/link/poll/security/copy constraints remain; no complete interactive keeper union established, hold unchanged. |
| 248 | C | non-ready /plan-bereit states also retire the 5-stage bar (same relic as the arrival screen, founder field test 27.08.2026) | C4: donor four SSR invocations are already present in four existing keepers, including actual default nextHref equivalence. |
| 313 | F | page passes the server-first readiness envelope into the client | Page source helper/name regex does not execute auth/admission or initial envelope propagation. Contract is real; retain pending behavior-level oracle, no automatic static deletion. |

## tests/personal-plan-ready-transition.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 15 | R | backend readiness enables the CTA on the first successful poll | CTA only ready: enum-state truth table catches enabling pending/error or delaying ready. |
| 23 | R | readiness polling remains bounded to thirty seconds | Polling interval*limit bound30s is independent user wait-budget contract; source scheduler uses both constants, same bound not asserted by request-state test. |
| 29 | R | read-only polling escalates to one authoritative link request when the server signals it | State machine sends one POST per link instruction, then GET, and re-arms when server asks; losing re-arm or perpetual POST fails sequential states. |
| 44 | R | an active buyer waits for exact subscription correlation instead of entering onboarding | Access surface distinguishes exact correlation pending/unavailable from genuine no-source onboarding; preserving active access does not imply source readiness. |
| 66 | F | readiness failures are recoverable and the ready CTA stays explicit | Mixed source/UI checks cover real retry/auth/payment boundaries but private spellings and no execution of client effect leave false-green paths. Hold entire callback unchanged; no full existing keeper union. |

## tests/personal-plan-result-artifact-email.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 54 | R | builds the hard-paywall payload from only the stored public analysis | Stored public-only payload asserts exact message shape, URL, default identifier and excludes locked/private/free-text fields; getter-numeric keeper cannot replace projection/privacy/default checks. |
| 95 | R | derives a controlled primary message for compatible stored artifacts | Compatible artifact missing primaryMessage derives from stored priorities; expected helper result checks delegation while branch parse/compatibility remains meaningful. Do not claim independent copy correctness. |
| 119 | R | rejects a corrupted compatibility artifact whose central priority differs from row one | Corrupt legacy central priority disagreeing with first diagnostic row rejects; valid stored-v2 priority distinction cannot cover this compatibility guard. |
| 142 | D | supports a numeric personal-plan transactional message id | D2: exact numeric42 assertion already observes actual common getter through retained regular route delivery; unrelated quiz fields are outside getter readset. |
| 196 | R | claims and sends the personal-plan email only once | Service claims once under an atomic store port and marks sent only after success; fake provides atomicity, test proves orchestration, not database locking. |
| 224 | R | marks a sanitized failure without throwing into the result journey | Provider failure is sanitized/marked and returned without leaking into journey; actual catch/sanitizer control independently valuable. |

## tests/personal-plan-result-artifact-route.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 31 | R | validates configuration before claiming a personal-plan email | Missing transactional config503 precedes claim; disabled delivery cannot consume a lead. |
| 45 | R | returns the 200 send result for a valid personal-plan lead and attached public artifact | Personal-plan route executes actual service with attached public artifact and returns sent200; different store/adaptor from regular email route. |
| 91 | R | uses the recoverable copy when lead rate limiting is unavailable | Unavailable lead limiter surfaces recoverable copy/status; distinct pre-claim error response. |
| 100 | F | the reveal requests the dedicated email endpoint with keepalive without awaiting it | Source grep for dedicated endpoint/keepalive/non-await protects valid journey isolation but void/private call spelling is not executed effect proof. Hold0credit. |

## tests/personal-plan-result-return-migration.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 15 | R | result-return migration keeps a private, bounded, service-role capability mapping | Private hash-only unique capability table, owner-independent lead mapping TTL/RLS/ACL/search_path, bounded SKIP LOCKED purge and no PII are executable deployment contracts. No runtime migration replay in this lane subsumes them. |

## tests/personal-plan-result-return-reset.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 31 | R | result-return reset rejects requests without same-origin Fetch Metadata | Reset requires same-origin Fetch Metadata; cross-site/missing headers reject before capability writes. Preserve CSRF boundary. |
| 48 | R | result-return reset returns private no-store 204 only after both capabilities reset | HTTP204 private no-store/Vary only after both async capabilities complete; fire-and-forget reset would fail ordering/headers. |
| 67 | R | result-return reset fails closed when rate limiting or server reset fails | Rate denial and thrown server reset fail closed rather than204; distinct errors retained. |
| 84 | R | server reset revokes both valid capabilities and clears both cookies | Valid result/draft revocation RPC arguments plus both cookie names are observed. Exact Max-Age for both is not asserted here; preserve real orchestration/authority proof without overclaiming cookie-options coverage. |
| 147 | R | server reset treats a malformed or missing result cookie as idempotent success | Malformed/missing result token with revoked=false is idempotent; actual isValidToken && !revoked condition differs from valid-token successful revocation. Do not cut as fake-only. |

## tests/personal-plan-result-return.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 21 | R | result-return credentials are opaque 32-byte values and cookies have the host-only contract | 32-byte opaque token/hash and host-only HttpOnly/Secure/Lax expiry cookie prevent guessable credentials/domain leakage; exact boundary independent. |
| 39 | R | malformed cookies fail closed without invoking the resolver | Invalid token shapes return invalid without resolver call; permissive regex/prematureDB request fails counter. |
| 51 | R | result lookup returns only a lead id and retries exactly once for a transport failure | Thrown transport error retried once; returns only lead UUID, not full row; wrong count or projection fails. |
| 66 | R | lookup neither retries application errors nor clears the capability | Application errors are not retried and capability not cleared; retry-all/clear-on-error breaks recoverability. |
| 83 | R | returned transport errors retry once, then warn without disclosing capability data | Returned transport envelopes retry once then warn without token disclosure; not same throw branch as earlier test. |
| 108 | R | a resolved PostgREST transport envelope retries before succeeding | Returned PostgREST transport error then valid second response succeeds; failure-only warning keeper cannot prove success projection. |
| 132 | R | issue rotates the single lead capability and revoke clears the host-only cookie | Issue upsert rotates one lead token and revoke clears cookie/hash-bound mapping; ownership/rotation differs from lookup. |
| 180 | R | valid result has fixed precedence over an explicit resume token and an existing draft | Resolved result wins over resume/draft; unavailable is preserved, explicit resume then draft then fresh precedence; wrong state ordering fails. |
| 215 | R | return-entry trust requires a resolved capability for the requested lead | Return-entry trust requires valid resolved capability matching requested lead; client entry flag alone cannot grant trust. |

## tests/personal-plan-result-reveal.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 14 | R | result reveal uses dynamic one-week and four-week dates with certain outcome copy | Date-key relative week/four-week German copy uses deterministic dates; wrong offsets/timezone text fails. |
| 37 | R | result reveal exposes all three messages before navigating | Timer schedule exposes each message and cancels handles before completion/navigation; ordering/drop/extra completion fails owned timer callbacks. |
| 72 | R | result reveal completion records exact trigger and configured timing | Completion event literal trigger, duration, step and lead shape is independent analytics protocol; dropping field/mislabeling trigger fails. |
| 112 | R | result reveal completion normalizes numeric boundaries | Negative/nonfinite/oversized elapsed and visible-step boundaries normalize independently; raw fixture variations hit distinct numeric predicates. |
| 165 | R | result reveal completion can only be claimed once | Completion claim changes ref once and rejects second claim; duplicate telemetry/navigation prevention, not same timer schedule proof. |
| 171 | R | result reveal does not emit a generic page view before the actual offer | Page-view exclusion for reveal route protects event ownership before offer; public path config contract retained. |
| 179 | F | the exit line is held as a real state and the result shell continues it (Follow-up B) | Exit hold constant plus source shell/timer spellings do not prove elapsed real mounted state. Meaningful transition and cleanup contract retained, require interactive oracle before narrowing. |

## tests/personal-plan-return-artifact-repair-postgres.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 33 | R | real PostgreSQL serializes parallel repairs and rejects a concurrent source change | Actual PostgreSQL two-session barriers test parallel repair single winner and concurrent source-change/Stage1 insertion serialization; PGlite sequential tests cannot replace locks. Environment-dependent skip remains unchanged. |

## tests/personal-plan-return-artifact-repair.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 37 | R | repair builds server artifact and preserves exact v2/v3 envelope without migration | Actual repair adapter builds server artifact yet preserves exact v2/v3 captured envelope/hash in CAS; auto-migration of source would violate provenance. |
| 53 | R | repair refuses missing context and ambiguous historical concerns without a write | Missing context/ambiguous historical concerns fail before RPC; legitimate missing fact repair cannot replace this no-write boundary. |
| 70 | R | repair preserves conflict, forbidden, and unavailable outcomes | RPC repaired/already-present/conflict/forbidden/unavailable map typed results; fake returns receipts but real owner validates and maps them. |
| 104 | R | SQL repair is service-only, CAS guarded, immutable, and idempotent | Actual PGlite SQL replay covers ACL, exact CAS, immutable valid facts, idempotent predecessor retention and guard trigger; sequential-only limits stated, no concurrency overclaim. |

## tests/quiz-result-artifact-email.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 30 | R | projects current and legacy concern ids to the same email diagnosis | Current and legacy concern vocabularies yield same diagnosis through actual adapter; metamorphic compatibility compares distinct normalization inputs, not fabricated fixture identity. |
| 45 | R | encodes the lead id in the attributed result URL | Arbitrary lead ID is URL-encoded with public attribution; normal UUID keeper cannot catch slash/query injection encoding regression. |

## tests/quiz-result-artifact-route.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 95 | R | resolves the latest persisted scanner package without an analytics flag | Actual kind resolver selects latest persisted scanner package with exact query ordering and absent analytics gating; trusting stale first row fails query contract. |
| 132 | R | the production claim excludes moderator-owned legacy leads | Actual production claim query excludes moderator and demands null status; retains real common filter policy after D3, without claiming SQL execution. |
| 163 | R | claims, sends, and marks the result artifact email sent | D2 strongest keeper actual route/service/common serializer delivers numeric42 with exact diagnostics/public fields/privacy and markSent; all originals retained. |
| 219 | R | does not claim or mutate when Customer.io transactional config is missing | Organic missing config returns503 without claim or mutation; scanner-specific missing key follows separate branch. |
| 249 | R | does not claim a scanner lead when its dedicated Customer.io config is missing | Scanner missing dedicated config returns503 without consuming lead; organic configuration must not authorize this stream. |
| 277 | R | does not claim when persisted funnel attribution is unavailable | Attribution lookup failure returns502 before claim; failure must not be silently treated as organic. |
| 307 | R | scanner attribution sends the scanner email for an existing lead without a consent gate | Persisted scanner attribution produces minimal scanner payload without marketing consent gate; preserves transaction-vs-marketing contract. |
| 334 | R | skips personal-plan rows before parsing or sending a legacy result email | Personal-plan row cannot enter regular legacy parser/sender; different quiz-kind early guard retained. |
| 352 | D | skips when the result artifact email was already sent or is sending | D3: statuses are read only by fake non-null predicate; actual production sees identical null. Retained failed-status keeper contains all donor assertions and real claim-query guard remains. |
| 372 | R | skips a failed result artifact email until manual retry resets it | D3 primary keeper null claim returns skipped200/no send/no markSent. Failed is not read by service; no claim of SQL status-specific proof. |
| 391 | R | the harmonized result email does not require a first name | Missing first name is permitted and not leaked as bogus copy; actual payload schema should not make optional name mandatory. |
| 411 | R | two calls only send once with an atomic store claim | Organic concurrent invocations use same atomic port, one send/mark; detects moving send outside claimed result. Port atomicity is fixture premise, not DB proof. |
| 438 | R | two scanner requests only send once with the existing atomic claim | Scanner concurrent delivery has distinct minimal serializer/config and no consent gate; retain branch-specific same-service orchestration, no C proof proposed. |
| 466 | R | send failure marks failed and redacts secret-ish tokens | Send failure invokes real sanitizer and failed state with no sent mark; secret-like input must be redacted. |
| 494 | R | incomplete quiz answers fail before sending | Incomplete stored answers fail before actual serializer/send and mark diagnostic failure; generic null-claim keeper never parses answers. |
| 514 | R | persisted attribution distinguishes absent or organic rows from lookup failure | Attribution absence/organic rows resolve organic while lookup error throws; missing is not unavailable, preserve three states. |

## tests/quiz-result-artifact-trigger.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 6 | R | result artifact email trigger waits for a completed lead and access check | No lead or access still checking blocks trigger; independent early predicates in actual mounted caller. |
| 27 | R | result artifact email trigger sends for active subscriber routine path | Existing active subscriber can still receive result email; canGoStraightToRoutine deliberately not gating delivery, catches reintroduced early bypass. |
| 39 | R | result artifact email trigger does not resend for the same lead | Same prior lead prevents resend, different lead permits it; ref-key idempotency differs from store claim. |

## tests/personal-plan-api-stage1.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 42 | F | Stage 1 API derives identity server-side and never accepts a browser user id | Title claims server identity, but fixture reaches activation-pending with null artifact and never asserts propagated user. Keep actual409 mapping; strengthen identity/read observations separately. |
| 54 | F | Stage 1 rejects an unreachable owner before constructing persistence | Pending owner expected no persistence construction, but constructed flag is only set by eventual write and loadArtifact=null already blocks it. Removing journey gate can false-pass. Keep pending contract, repair counter later. |
| 72 | R | Stage 1 API preserves typed release and availability responses | Disabled404 and unauthenticated401 remain distinct typed API responses; no completed plan fixture can substitute. |

## tests/personal-plan-stage1-source.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 10 | R | legacy quiz sources retain their exact lead provenance and canonicalize unordered answers | Legacy source exact lead provenance, current vocabulary and sorted multi-select arrays; wrong mapping/hash input affects durable identity. |
| 47 | R | legacy Stage-1 parsing rejects unsupported values instead of trusting TypeScript casts | Unsupported legacy texture despite TypeScript cast fails real parser with typed version1 error; V3 missing thickness is different schema/branch. |
| 69 | R | legacy source migration brackets its one-time backfill with the immutable trigger | Migration must disable immutable trigger before historical provenance backfill and restore afterward. Exact SQL trigger name is live database identity; ordering needed for migration safety. |

## tests/personal-plan/input.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 11 | R | INITIAL-01: a valid V3 paid quiz becomes a quiz-faithful initial profile | C2 keeper parse validV3 and build quiz-faithful profile, now exact default routine delivered. Field mapping/default exposure assertions preserved. |
| 30 | R | INITIAL-12: V2 concerns normalize once without inventing breakage | V2 dry/damage/scalp aliases normalize once without invented breakage and unknown recurrence; V3 profile cannot cover old envelope semantics. |
| 58 | D | malformed mandatory quiz facts return a typed incomplete input | D1 exact thickness-undefined envelope/parser/typed error already in retained loop thickness iteration; no new row. |
| 71 | R | `mask-missing-${field}: required Mask target input fails closed at the shared parser` | D1 keeper existing thickness and elasticResponse missing fields reject currentV3 schema independently; loop remains one AST registration. |
| 83 | R | supported envelope hashing is stable across object key order | Envelope hash stable across object key insertion order; persisted idempotency key must not depend on JavaScript construction order. |

## tests/personal-plan/needs.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 28 | R | INITIAL-02: quiz-led Shampoo cadence keeps current behavior unknown | C1 keeper preserves quiz-led cadence with unknown actual behavior, adds exact unknown heat result on same assessment. |
| 41 | R | INITIAL-04: oily scalp contributes one Reset point while product load stays deferred | Oily scalp gives one Reset point while load/frequency/scalp buildup remain unknown; inventing product knowledge fails. |
| 52 | R | known Shampoo frequency is preserved as known within the partial Reset assessment | Known shampoo frequency removes only that missing input and records fact; unknown currentProductLoad remains, so blanket known/unknown mapping fails. |
| 66 | C | INITIAL-05: absent Hair Tools input is unknown rather than no Heat exposure | C1 same assess() result already computed by first keeper; move full unknown heat object. |
| 76 | R | lightened hair preserves the quiz fact and drives high shared repair priority | Lightened chemical fact independently raises high shared repair priority even smooth/no-concern baseline; surface-only heuristic fails. |
| 88 | R | shared damage lanes distinguish rare from material Heat and keep elasticity contextual | Rare vs frequent heat frequencies give different damage priorities, while elasticity remains contextual; treating snaps as damage-alone fails. |
| 135 | R | ordinary airflow retains its route and frequency as a distinct Mask exposure fact | Ordinary airflow remains separate route/frequency fact while all heat events remain complete; indiscriminate filter or loss of eventmetadata fails. |
| 185 | R | refined mechanical exposure maps rough rubbing to moderate and adds nothing otherwise | Rough rubbing contributes moderate mechanical risk/medium repair; empty gentle signals contribute none. Refined routine input distinct. |
| 215 | R | INITIAL-13: hair loss is isolated from repair and exposes the limited-evidence boundary | Hair-loss boundary present/limited-evidence/unassessed remains excluded from structural damage; medical-cosmetic overreach detectable. |

## tests/personal-plan/portfolio.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 52 | R | portfolio non-coily Leave-in owns persistent damp smoothing and demotes damp Oil | Noncoily leave-in basis owns persistent damp smoothing and demotes overlapping oil; failing allocation produces duplicate basis job. |
| 75 | R | portfolio preserves the coily two-layer damp smoothing exception | Coily supports two-layer damp smoothing exception; blanket oil demotion fails distinct texture predicate. |
| 93 | R | portfolio keeps Conditioner baseline while repair categories share distinct jobs | Conditioner baseline remains while bondbuilder/mask keep distinct repair roles; broad duplicate suppression loses valid care. |
| 113 | R | portfolio keeps wet-wash ownership and defers Heat carrier allocation | Wet-wash owner and deferred heat carrier allocations retain source coverage without invented exposure; distinct protocol jobs. |
| 146 | R | portfolio preserves Dry Shampoo as a bridge inside Shampoo's wet-wash budget | Dry Shampoo stays bridge within shampoo cadence budget; competing wash-owner rewrite fails coverage/oracle. |
| 162 | R | portfolio records Shampoo/Scalp Care and Deep Cleansing/exfoliant duplicate coverage | Coverage identities distinguish scalp care support and reset overlap. Synthetic decisions isolate current normative scalp-care decision.md uncovered-job contract; no complete owner-output keeper established, no obsolete-source claim. |

## tests/personal-plan/reasons.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 14 | R | reason salience keeps no more than two primary facts without dropping detail | Salience keeps two primary facts and remaining secondary detail in order; truncating all reasons loses explanation. |
| 31 | R | reason normalization is stable and removes duplicate IDs | Stable dedup removes repeated IDs without reorder, repeated normalization idempotent; not same unique-reason input as first test. |

## tests/personal-plan/types.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 9 | R | Stage 1 keeps the approved stable category order | Canonical ten-category ordering is independent serialized configuration; compute facade constructs decisions separately and neutral output renders subset, so no complete keeper union. |
| 24 | C | the initial routine context represents later facts as typed unknowns | C2 literal default context asserted on actual delivered buildPlanProfile routine; no direct input/config distinction remains. |

## tests/personal-plan/persistence/stage1-service.test.ts

| Original line | Mark | Exact declaration | Contract and detectable failure / keeper |
|---:|:---:|---|---|
| 39 | F | Stage 1 persists only the authenticated user's active new-buyer artifact | Executes real computation/hash/persist mapping, but title owner binding not asserted on captured request user/source IDs. Preserve success proof; strengthen identity assertion separately. |
| 63 | F | Stage 1 keeps flag-off, non-cohort, and pending states outside all reads and writes | Flag-off/pending cases count artifact reads and writes, not entitlement read; title non-cohort/all reads broader than actual oracle. Retain tested deny outcomes; no cut. |
| 97 | R | Stage 1 rejects a paid purchase before the rollout cutoff without mutating | Pre-cutoff normal purchase denies without mutation when migration off; cutoff inclusive boundary is separate from paid-pending. |
| 124 | R | Stage 1 admits verified normal paid pre-cutoff sources only while migration is enabled | Verified paid pre-cutoff source admitted only migration flag on; no unpaid widening; current recovery contract. |
| 160 | R | Stage 1 admits a bound paid migration outside the launch cutoff without weakening access | Bound migration enrollment bypasses launch cutoff only with active access; rejecting valid migration or admitting inactive fails. |
| 193 | R | a returning migration resumes its persisted Plan without re-reading or recomputing the legacy quiz | Existing migration Plan resumes persisted result without source reread/recompute; durable recovery identity must survive stale/missing lead. |
| 226 | R | Stage 1 maps unavailable storage and invalid compute sources to typed safe outcomes | Unavailable storage and invalid quiz compute map typed safe outcomes; invalid input not mistaken for activation success. |
| 242 | R | Stage 1 loads and persists an exact legacy lead without a prepared artifact | Exact legacy lead path computes/persists source kind+lead provenance without artifact load; legacy vs artifact storage readsets are distinct. |

