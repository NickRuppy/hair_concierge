# OpenAI Ads39 complete semantic ledger

**34 R / 5 held F / 0 C / 0 D** for the 39 census declarations in eight files. Nine nested t.test bodies also individually reviewed: eight R, one held F. Parent Chromium registration carries F because its first child has the specific bootstrap-order gap; these are not two census F credits. All 48 callbacks and all 1,599 test lines remain unchanged.

Each row names actual observation and credible regression or unproved claim. F is retained, no repair/deletion credit. Extracted assertion text and callback hashes are in judgments.json.

## tests/openai-ads-browser-integration.test.ts

| Line | Count scope | Mark | Existing declaration and evidence |
|---:|---|:---:|---|
| 130 | census | F | **actual Chromium exercises OpenAI browser consent, navigation and checkout attribution** — retain actual Chromium/actual compiled browser-helper contract and all three nested cases. First child has a bootstrap-order false green: findIndex=-1 is less than a valid context index. SDK and context endpoint are local stubs, not actual provider/SQL behavior. Optional execution gate remains unchanged. |
| 137 | nested, census-excluded | F | **allowed landing initializes once, measures once with opt-out, and captures a safe source before checkout** — actual Chromium init/count/opt-out, source redaction, no client identity fields, checkout synchronization and private-route denial remain valuable. At lines 167–170 a missing /api/funnel/session request yields -1 and passes the ordering comparison. No required presence or response-completion observation. Retain unchanged; the fake context endpoint accepts context without validating a signed funnel session. |
| 197 | nested, census-excluded | R | **denied landing and initially private route never load the SDK or measure** — three distinct local-consent/public-private initial states observe no SDK request/event; private path creates no context POST and denial choices persist. Real DOM/request routing and no unexpected/error guards complement fake-browser tests. |
| 236 | nested, census-excluded | R | **real saved-consent event during delayed SDK load prevents late init or events** — actual saveConsent event while SDK is delayed changes local storage and server-stub denial, then observes no init/effective measured event or unexpected request. It protects DOM/event-to-helper integration; stub SDK filtering is not live SDK/provider verification. |

## tests/openai-ads-browser.test.ts

| Line | Count scope | Mark | Existing declaration and evidence |
|---:|---|:---:|---|
| 65 | census | R | **fails closed when context GET fails** — consent true plus thrown context GET leaves script list empty; context outage cannot load Pixel. Transport throw differs from denial state and timeout. |
| 79 | census | R | **does not load before consent and sends a denial without source URL** — absent local consent on public path sends marketing=false without sourceUrl and loads no script. Existing private-path denial has different URL branch; do not merge inputs. |
| 98 | census | R | **explicit choice can regrant while a background refresh cannot** — acknowledged revision-one denial does not regrant on background refresh, while explicit consent-change produces one grant and script. Distinct revision/state transition absent from optional rev-zero browser fixture. |
| 123 | census | R | **late GET cannot resurrect the Pixel after a denial** — late granted GET after local denial never loads SDK. Controlled deferred response establishes asynchronous denial race independent of late script load. |
| 140 | census | F | **SDK completion after denial never initializes or measures** — delayed SDK completion after denial asserts absence of init only (lines 159–161); queued measure commands promised by title are not inspected. Actual lifecycle setup and no-init contract remain. No repair or deletion credit. |
| 164 | census | R | **initializes once and does not Pixel-measure private routes** — one init, no measurement on /profile, and a second measurement when returning to landing; protects lastMeasuredPath reset and private transition, distinct from merely initial private route. |
| 198 | census | R | **checkout context capture stays bounded when context fetch hangs** — hanging context fetch cannot hold checkout beyond 1100ms and never loads script on result path; outer one-second bound remains independent of CAPI timeout. |
| 210 | census | R | **cross-tab refusal revokes an already initialized Pixel** — storage event for exact consent key revokes initialized SDK with final consent=false; cross-tab event differs from explicit same-tab choice. |
| 232 | census | R | **private-route denial persists without leaking its URL** — initially private /profile denial still persists choice and never forwards sourceUrl or loads script; public-only early-return regression would lose this. |

## tests/openai-ads-capi.test.ts

| Line | Count scope | Mark | Existing declaration and evidence |
|---:|---|:---:|---|
| 47 | census | R | **disabled sending never reads consent context or calls the network** — disabled result is exact and resolver/network fail sentinels enforce no work. Release flag does not imply consent. |
| 65 | census | R | **missing or mismatched pixel/key configuration never calls the network** — missing key, mismatched IDs and missing server Pixel all skip without network; distinct configuration cases, no input packing added. |
| 86 | census | R | **denied context prevents transmission even when release configuration is enabled** — null current consent produces consent_denied despite valid release config, with no network call. |
| 101 | census | R | **successful request uses CAPI schema and stable ID without private query or profile fields** — actual CAPI calls actual payload builder then fake fetch; exact endpoint/method/redirect/auth/envelope/event, one call and accepted202 observed. Fixture lacks obref, unlike direct EUR payload; cannot absorb its full union without new input. |
| 138 | census | R | **retries keep the identical conversion ID** — two existing sends retain byte-identical bodies/ID; success singleton cannot establish across-call determinism. |
| 152 | census | F | **renewals and malformed events do not produce HTTP requests** — invalid_event/no-request contract is real for payment_completed, zero value and malformed date, but title promises renewals and no row sets attempt_phase=renewal. Direct payload renewal proof cannot establish CAPI delivery suppression for that input; keep unchanged. |
| 172 | census | R | **HTTP errors classify retryability without exposing response text** — six HTTP status inputs establish permanent400/401/403 versus retryable408/429/500 and exact sanitized result without response body. |
| 191 | census | R | **throwing context and network calls are contained and sanitized** — resolver throw and network throw return same sanitized retryable context_or_transport_error, guarding both distinct failure sites. |
| 212 | census | R | **slow consent resolution times out and cannot send after returning** — delayed consent resolver times out, then is explicitly released; later transport counter stays zero. Proves late completion cannot transmit after timeout. |
| 238 | census | R | **unresponsive HTTP transport is bounded even if a test double ignores abort** — fetch that never settles and ignores abort still yields timeout. Separate transport-hang phase cannot be replaced by slow resolver test. |

## tests/openai-ads-consent-cookie.test.ts

| Line | Count scope | Mark | Existing declaration and evidence |
|---:|---|:---:|---|
| 11 | census | R | **signed consent identity rejects tampering, expiry, future issue and a different purpose** — valid signed identity, altered signature, exact expiry, future issuance and wrong key are observed. Purpose-specific forgery is separately covered by sibling; no consolidation adds its calls to an existing callback. |
| 20 | census | R | **same signing key cannot authenticate a token without the OpenAI purpose** — independent HMAC using same key but no OpenAI purpose is rejected. This exact signed adversarial input is absent from route initialization and ordinary signature tamper tests. |

## tests/openai-ads-context-postgres.test.ts

| Line | Count scope | Mark | Existing declaration and evidence |
|---:|---|:---:|---|
| 44 | census | R | **grant/revoke/regrant cannot revive history; stale grant conflicts and stale denial wins; refs cleared** — actual migrations establish idempotent exact retry, original reference preservation, stale-grant conflict, stale-denial precedence, null reference after revoke and event-history isolation after regrant. Single PGlite session is not lock-contention proof. |
| 75 | census | R | **wrong signed visitor and competing consent identity cannot steal exact session attribution** — wrong signed visitor refuses association; subsequent eligible context binds C; competing consent V cannot steal existing session. Distinct sequential visitor validation and ownership readback, not replaced by concurrent-only live test. |
| 87 | census | R | **public roles cannot read or execute; service role allowed; expiry denies and cleanup removes** — actual anon/authenticated denied operations, allowed service operation, expired marketing=false/choice conflict/read null and bounded cleanup count. Public-role outcome is valid; it is not a complete independent audit of every ACL/RLS grant. |
| 118 | census | R | **canonical noncommercial classification suppresses context even when purchase payload omits markers** — positive commercial context then internal/field-test/partner canonical updates suppress actual SQL read without relying on purchase payload markers. Optional live test has additional enqueue/race behavior, different execution gate and state. |

## tests/openai-ads-context-route.test.ts

| Line | Count scope | Mark | Existing declaration and evidence |
|---:|---|:---:|---|
| 61 | census | R | **route initializes signed identity, never grants without existing cookie, and disables without DB access** — real handler initializes HttpOnly/no-store signed identity; cookie-less POST409 permits only get actions; disabled path does not construct DB client. Fake RPC returns states, not actual persistence. |
| 85 | census | R | **route rejects cross-origin, invalid fields, content type and unbounded body before database** — cross-origin, wrong content type, extra consentId, malformed context action, foreign source and >4096-byte body reject with exact status before zero RPC calls. Independent HTTP validation from SQL types. |
| 98 | census | F | **route propagates conflict state and denial never reads or forwards reference cookies** — conflict409/revision2 propagation is real, but denial fixture supplies only consent cookie, no oppref/obref/funnel cookie or sourceUrl. Null p_oppref/session_id survives a wrongly permissive read/forward guard; no counter observes forbidden reads. Keep assertion and contract pending separate authorized repair. |
| 125 | census | R | **raw references remain byte-identical, ambiguous cookies are dropped, source excludes query and private paths** — direct raw-cookie parser preserves encoded bytes, drops duplicate/oversize refs; URL sanitizer strips query/hash and rejects private admin while accepting LP. Actual route positive fixture does not carry those cookies, so no equivalent keeper. |
| 142 | census | R | **resolver has no latest-user fallback and transient DB errors remain retryable** — no exact session means null and zero RPC; valid session DB error throws fixed sanitized message. Prevents latest-user fallback and swallowed retryable storage error. |

## tests/openai-ads-event-payload.test.ts

| Line | Count scope | Mark | Existing declaration and evidence |
|---:|---|:---:|---|
| 36 | census | R | **maps a first paid EUR conversion into the documented OpenAI order event** — exact EUR schema includes both oppref and nested user.obref plus opt_out=true and sanitized welcome URL. Actual CAPI success fixture omits obref; input/readset and complete union are not equivalent. |
| 50 | census | R | **keeps an explicit JPY minor-unit amount without assuming two decimal places** — explicit JPY amount_minor=1200 wins over inconsistent value12 and opt_out=false survives; no existing CAPI/browser input reaches this monetary/optional boolean combination. |
| 65 | census | R | **maps only a verified zero-value trial activation** — exact zero-value verified trial schema plus version2, invalid authorized date and nonzero-value rejection. Existing CAPI success is purchase, not trial; adding a send would violate no-call expansion. |
| 99 | census | R | **rejects unsupported, internal, test, renewal, and zero-value paid conversions** — unsupported event, renewal, zero paid, internal, field_test, partner and invalid currency are independently enumerated existing inputs. CAPI subset omits several filters; SQL excludes canonical state but does not replace wire monetary validation. |
| 131 | census | F | **accepts only safe canonical source URLs and never copies contact fields** — canonical URL/redaction and top-level wire-key allowlist are real. Contact-rich input includes email/external_id/quiz_answers but only top-level keys are asserted; nesting those values under existing user or data would escape. Retain safe-path negative inputs and partial privacy guard unchanged. |
| 170 | census | R | **rejects timestamps outside the documented seven-day and ten-minute window** — three timestamp inputs just outside seven-day/ten-minute limits and invalid date reject. CAPI malformed-date subset cannot preserve boundary values without new input. |
| 176 | census | R | **does not guess monetary units for non-two-decimal or malformed stored amounts** — versioned and legacy JPY fallback amounts, string amount_minor and explicit null amount_minor are rejected; protects authoritative-unit and malformed-field distinction. |

## tests/openai-ads-live-postgres.test.ts

| Line | Count scope | Mark | Existing declaration and evidence |
|---:|---|:---:|---|
| 70 | census | R | **real PostgreSQL consent races, privileges, expiry and optional billing delivery** — retain opt-in parent and six nested actual multi-connection PostgreSQL/role/trigger contracts. Exact loopback URL validated; Docker context/container are separately fixed. Synthetic schema and locally injected fault do not prove current production/provider state. |
| 113 | nested, census-excluded | R | **grant and withdrawal interleave across locked sessions in both orders** — both grant/revoke lock orderings reach pg_stat_activity Lock wait, then stale grant conflicts and stale denial wins to revision5:false. Sequential PGlite cannot replace actual competing sessions. |
| 160 | nested, census-excluded | R | **concurrent different identities cannot steal a session association** — two concurrent consent identities contend on the same session; second conflicts and persisted owner remains first. Actual conflict wait/readback protects ON CONFLICT ownership fence. |
| 182 | nested, census-excluded | R | **public roles denied, service role allowed, and expiry removes context** — both public roles cannot read consent table/cleanup/event context; service role grants, expiry denies read and cleanup removes contexts. Distinct live backend protocol and cross-test context set; optional gate must remain. |
| 219 | nested, census-excluded | R | **only fresh eligible billing events enqueue; duplicate, renewal, exclusions and history do not** — only fresh trial/first-paid enqueue, exact sorted keys exclude duplicate/history/renewal/test/no-session; skipped status accepts and manual invalid insertion is rejected by trigger. Actual SQL trigger boundary absent from payload/CAPI tests. |
| 246 | nested, census-excluded | R | **canonical test sessions block unmarked purchases and late classifications suppress queued context** — unmarked purchases consult canonical session classification at enqueue and send; commercial control positive, SQL eligibility STABLE, late field-test update suppresses context while queued row remains. Distinct dispatch-time classification contract. |
| 299 | nested, census-excluded | R | **optional trigger failure does not roll back the canonical billing insert** — actual failing delivery trigger does not roll back canonical outbox event and does not add delivery rows. Proves optional bookkeeping failure isolation at database transaction boundary. |

