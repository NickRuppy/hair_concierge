# Customer.io / email delivery94 — complete declaration ledger

Current AST denominator94 across17 files. Marks: {'R': 82, 'F': 8, 'C': 4, 'D': 0}. All Fs remain byte-identical; no repair or cut credit. Default proposal4C, noD; PP raw-shape comparison held separately.

Each entry names actual assertion sensitivity and its non-equivalent neighboring proof; full original bodies and callback SHA are in ledger.json. Owners/callers/read-depth/history are in layer-plan.md.

## tests/customerio-funnel-attribution.test.ts (1)

- **R :11 — Customer.io enriches cold funnel events and isolates queued dispatch failures**
  Cold pricing/quiz events must wait for SDK/context, then deliver exact snake-case attribution in order despite first SDK track throwing. Existing facade tests do not combine both cold queues and this throw; fixture supplies raw context only, actual mapper/queue own sequence.

## tests/customerio-page-view.test.ts (7)

- **F :11 — Customer.io page paths preserve the canonical result identifier and entry context**
  Two identical calls/assertions duplicate the canonical path oracle within this declaration. Keep its exact result identifier and permitted entry/focus projection; remove duplicate only as later zero-credit maintenance. Credential cases use other predicates.
- **R :24 — Customer.io page paths omit a trailing question mark without query parameters**
  Empty URLSearchParams and null must both omit trailing ?. Credential case contains a query and cannot expose the empty/null construction defect.
- **R :29 — Customer.io page paths remove credentials, identifiers, and nested return URLs**
  Recovery code/email/nested next/session/token must disappear on result and non-result paths while allowed entry/focus survive. Invalid safe-value case lacks these secret keys and cannot detect pass-through leakage.
- **R :47 — Customer.io page paths reject arbitrary values under otherwise safe keys**
  Safe KEY with unsafe VALUE must be rejected (email entry and nested auth focus). A key-only allowlist would pass previous credential case and fail this one.
- **R :56 — shared analytics URL sanitization removes sensitive queries and fragments**
  Absolute URL sanitization must remove fragment credentials and retain only allowed result query values; path-only builder cannot catch a wrapper retaining original URL hash.
- **R :71 — Meta page tracking recognizes credential-bearing browser locations**
  Credential detection covers query and fragment/hash-router paths, with pricing and UTM negatives. Sanitization output does not establish whether Meta is suppressed before tracking.
- **C :92 — Meta offer CAPI uses a verified aggregate URL without the lead identifier**
  C4: aggregate constant exact value already reaches actual deliverMetaOfferView conversion at the existing canonical-event keeper. Literal exact result URL subsumes includes(lead-123) false; constant is input-independent in current owner.

## tests/customerio-quiz-traits.test.ts (3)

- **R :6 — builds rich Customer.io quiz traits with labels when consent is true**
  Consent-true legacy snapshot verifies normalized email/name plus exact low-density, scalp, all four treatment German labels and no raw text/customer flag. Existing HTTP quiz-sync fixture uses other hair/treatment labels, so complete union cannot move without changing inputs.
- **R :74 — keeps inherited consent time separate from the fresh quiz completion**
  Inherited consent date must stay old while quiz completion is fresh. Neither consent-true initial capture nor PP revision tests supplies two different dates.
- **R :101 — builds rich Customer.io quiz traits when marketing consent is false**
  Consent-false still identifies/tracks full coarse/curly/high/rough/snaps profile, omits consent date, and retains false event property. Existing HTTP sync does not assert this complete exact label set on the same input.

## tests/customerio-server.test.ts (3)

- **R :20 — server identify uses Customer.io EU Pipelines strict mode**
  Actual identify request asserts EU URL, POST, Basic auth, strict header, one request, exact body. Higher PP sync captures URL/body only and would miss missing strict-mode/header credentials.
- **R :56 — server track returns a failed result instead of throwing**
  HTTP500 track returns failed result with status in error rather than throwing. Identify-failed PP test only observes identify branch; same shared post helper does not remove wrapper-specific rejection behavior.
- **F :76 — server helper no-ops when CUSTOMERIO_SERVER_WRITE_KEY is missing**
  Missing-key result is skipped/false, but fetch is neither stubbed nor counted; an accidental request followed by skipped result could pass or contact network. Hold unchanged, propose future zero-request observer repair without deletion.

## tests/customerio-stripe-lifecycle.test.ts (4)

- **R :10 — builds purchase and subscription events from a completed checkout**
  Paid monthly checkout produces two named events with stable checkout/subscription IDs, amount14.99, uppercase EUR, timestamp and customer traits. Billing-outbox adapters have different producer inputs and cannot prove this legacy webhook fallback projector.
- **R :48 — does not build paid Customer.io lifecycle events for a verified trial**
  Verified trial input produces no paid lifecycle events/customer purchase timestamps and no instrument-key text. Paid snapshot does not reach trial suppression; webhook still has legacy dispatch fallback and preserved history.
- **R :73 — builds payment_failed from an invoice**
  Invoice amount749 minor becomes7.49 with attempt2, invoice-scoped ID and source/time. Checkout conversion does not consume invoice amount_due/attempt_count.
- **R :98 — builds subscription cancellation with event-id-scoped dedupe**
  Quarter cancelled subscription sets is_customer false and includes Stripe event ID in dedupe key. Purchase event IDs cannot expose cross-event cancellation dedupe loss.

## tests/customerio-transactional.test.ts (8)

- **R :13 — builds Customer.io App API transactional request with privacy flags**
  Numeric message ID7, first_name/CTA dictionary, recipient identity/path and true privacy flags. Actual send keeper has STRING message ID and lacks first_name: a numeric-to-string transport-builder change would escape it.
- **R :31 — sends Customer.io transactional email through the App API**
  Actual App API POST observes custom base URL, bearer auth, exact serialized payload including string message ID and privacy flags; pure builder cannot catch transport dropping fields.
- **R :65 — throws with status and response text for non-ok responses**
  Void send API propagates exact422 and provider text. Receipt API error type alone does not exercise this public wrapper on same string-ID request.
- **R :81 — returns the documented Customer.io delivery receipt**
  Receipt API decodes delivery_id and numeric queued_at into exact camel-case result. Void sender intentionally discards receipt and cannot catch malformed decoding.
- **R :101 — classifies non-2xx responses as definitive HTTP failures**
  Receipt API422 becomes CustomerIoHttpError with exact status and provider text, distinct from ambiguous exception. Existing void API only matches message.
- **R :117 — treats network failures and malformed success receipts as ambiguous**
  Network TypeError and successful body missing delivery_id become ambiguous errors; definitive422 never enters either path. Parameter rows remain independently meaningful and unchanged.
- **R :143 — inline required receipts preserve safe flags and provide complete per-send content without altering old callers**
  Inline content preserves from/subject/html/plain/autocreate=true/tracked=false/privacy. Reminder uses autoCreate=false and templated HTML, so input/options contract is distinct.
- **R :167 — sends the attachment dictionary alongside content and rejects oversized attachments before fetch**
  Actual wire attachment dictionary plus cumulative2MB rejection before a second fetch. No other suite observes byte bound or attachment wire delivery.

## tests/customerio-trial-reminder.test.ts (2)

- **R :29 — builds the stored Customer.io transactional message with privacy-preserving flags**
  PayPal full-price template15 observes config keys, provider Liquid subject/body, identity/privacy/autocreate flags, styling/legal links, one html/body and template-render equality. Dispatcher capture does not execute this transport builder; local Liquid helper is not Customer.io inbox proof.
- **R :71 — rejects CRLF injection at the transport boundary**
  Sender newline injection throws at actual transport builder. Dispatcher config validates separate sender input before work; direct builder is also called by default sender and must independently reject.

## tests/email-deliverability.test.ts (17)

- **R :51 — korrigiert belegte Provider-Tippfehler aus den Bounce-Logs**
  Explicit historical typo map returns five exact corrections. DNS denial fixture only uses gmail.vom and cannot protect gmx.den/gmial/web.d/hotmial mappings.
- **R :59 — schlaegt nichts vor bei real existierenden Domains**
  Legitimate near-spelling domains have NO suggestion. Typo positives do not catch heuristic overcorrection; all existing rows preserved.
- **R :71 — verkraftet unvollstaendige Eingaben ohne zu werfen**
  Empty/missing-local/missing-domain/missing-at suggestion inputs return null; normal domains do not exercise parser boundaries.
- **F :80 — nimmt Grossanbieter ohne DNS-Abfrage an**
  Known-good domain returns known_good and MX count0, but A/AAAA callbacks are not counted; forbidden auxiliary lookup could pass. Keep branch result; future counter repair only.
- **R :96 — nimmt Domains mit gueltigem MX an**
  Valid MX under DEFAULT timeout must yield mx. Timer-cleanup keeper sets60000 explicitly; default0 would fail this outcome but escape cleanup case.
- **R :103 — lehnt Null MX nach RFC 7505 ab**
  Both empty and dot Null MX reject with null_mx. ENOTFOUND and fallback cases cannot catch treating intentional no-mail as implicit MX.
- **R :112 — nimmt Domains ohne MX an, wenn ein A-Eintrag existiert (RFC 5321)**
  ENODATA plus A record yields implicit_mx. AAAA-only case has different fulfilled family; each protocol branch must survive.
- **R :119 — nimmt Domains ohne MX an, wenn ein AAAA-Eintrag existiert**
  ENODATA plus AAAA-only record accepted. A-only success cannot catch ignored IPv6 result.
- **R :125 — nimmt einen gueltigen A-Eintrag trotz transientem AAAA-Fehler als impliziten MX an**
  Successful A despite transient AAAA rejection yields implicit_mx. All-fulfilled fallback does not test Promise.allSettled partial success.
- **R :141 — lehnt Domains ohne MX und ohne A/AAAA ab und liefert den Vorschlag mit**
  NXDOMAIN produces no_mx with exact suggestion and zero A/AAAA fallback calls. ENODATA branch must query fallback and cannot substitute.
- **F :165 — lehnt ungueltiges Format ab, ohne DNS zu fragen**
  Malformed address returns format with MX0, but A/AAAA not counted. Future repair observe all resolver methods; no deletion or fresh fixtures now.
- **R :183 — laesst bei DNS-Zeitueberschreitung durch**
  Hanging MX with explicit20ms returns fail_open. Immediate resolver error cannot establish deadline completion.
- **R :197 — laesst bei unerwartetem Resolver-Fehler durch**
  SERVFAIL immediate MX rejection yields fail_open instead of permanent no_mx. Timeout does not catch errno misclassification.
- **R :206 — laesst durch, wenn der A/AAAA-Fallback in einen Timeout laeuft**
  Fallback A/AAAA timeout after absent MX yields allowed fail-open. MX timeout terminates before fallback path.
- **R :219 — teilt ein einziges Zeitbudget zwischen MX und A/AAAA**
  Controlled clock verifies one shared budget across MX+fallback, including deadlines observed by timers. Individual timeout cases allow restarted budget.
- **R :253 — raeumt den Timeout nach erfolgreichem Lookup ab**
  Long60000ms timer is cleared on successful lookup, with timer mock observation. Outcome-only MX case would pass leaked-resource fault.
- **R :263 — normalisiert die Adresse auf Kleinschreibung ohne Leerzeichen**
  Whitespace/mixed-case gmail address normalizes exact lowercase without spaces. Other positive Gmail fixture is already lowercase and cannot expose normalizer loss.

## tests/personal-plan-customerio-backfill.test.ts (5)

- **R :55 — live backfill requires an explicit campaign-safety preflight**
  CLI safety triad permits dry-run and confirmed-live, rejects unconfirmed-live flag. Runtime backfill unit function does not enforce outer CLI invocation guard; actual main calls it before client construction.
- **R :68 — historical backfill explicitly requests profile-only work**
  Actual backfill requests profile-only RPC exact lead then dispatches existing lead and counts delivered/queued. Sync fixture bypasses operator request path; no real SQL existence/order claim from stub.
- **R :92 — dry-run backfill performs no database writes or Customer.io dispatch**
  Dry run observes selected1, zero RPC writes, zero dispatch. Live keeper only establishes positive work and cannot catch accidental dry-run side effects.
- **R :111 — backfill reports queued retries separately from delivered profiles**
  Failed delivery result counts queued1/delivered0. Thrown dispatch enters separate catch; both branches retained.
- **R :124 — backfill continues when immediate dispatch throws because the durable row already exists**
  Thrown first dispatch still attempts second lead and counts one retry/one delivery. Fixture does not create a durable row; durability comes from actual RPC owner/SQL, not this receipt. Loop continuation remains unique.

## tests/personal-plan-customerio-outbox-migration.test.ts (3)

- **R :7 — Customer.io profile outbox migration keeps payload in source tables and private delivery state**
  Independent migration declaration contract: FK, revision/event state/defaults, no profile payload duplication, RLS/revoked public roles/service grant. Mock adapter cannot catch altered migration authority; greps remain bounded, not executable RLS proof.
- **R :22 — Customer.io profile outbox makes only newly inserted consented leads event eligible**
  Migration trigger must scope personal-plan INSERT/UPDATE, new consent eligibility, historical profile-only path and revision increment. Comment/string clauses are implementation-coupled maintenance risk but no equivalent actual SQL suite found in this cohort; do not delete security/history contract.
- **R :40 — profile-only backfill request cannot create or downgrade event eligibility**
  Scoped request RPC signature, revision increment, and absence of eligibility assignments prevent backfill promotion/demotion. Operator fake records RPC name only and cannot inspect SQL body.

## tests/personal-plan-customerio-outbox.test.ts (6)

- **F :119 — new lead delivery identifies current Supabase truth before the completion event**
  Assertions prove actual dispatcher revision3/event flag/funnel/mark-delivered, but mock deliver itself decides identify-before-event; title claims an order this test cannot observe. Retain unique dispatcher projection, narrow claim/repair later; HTTP sync independently owns actual order.
- **R :134 — historical profile-only outbox row can never request the completion event**
  Persisted send_completion_event=false stays false and marks non-event delivery. HTTP profile-only test receives already-derived false and cannot catch bad outbox derivation.
- **R :145 — field-test profile sync never emits the commercial completion event**
  Funnel field_test overrides otherwise true event request and passes testKind; HTTP keeper has commercial input. Actual suppression predicate exercised here.
- **F :157 — moderator lead remains non-commercial after its funnel moves to a newer result**
  Durable moderator marker with missing funnel maps testKind field_test, but send_completion_event already false masks independent moderator suppression. Preserve marker assertion; future positive-eligible fixture repair no quota.
- **R :175 — profile updates do not resend an already delivered completion event**
  Delivered timestamp suppresses another completion event despite row send flag true, and marks only profile. Historical false-flag test cannot catch ignoring delivered marker.
- **R :187 — transient Customer.io failures are recorded for retry instead of reported as delivered**
  503 identify failure yields failed/nonpermanent record and no delivered mark. HTTP sync error does not exercise outbox persistence classification.

## tests/personal-plan-customerio-reconcile-route.test.ts (3)

- **R :15 — Customer.io fallback retry uses a Vercel Hobby-compatible daily schedule**
  Exact daily cron path/schedule is deployment/operator contract independent of handler response, because handler can work while scheduler absent/wrong.
- **R :29 — Customer.io profile reconcile is bounded and authenticates before retry work**
  Wrong bearer returns401/error and zero dispatch; maxDuration60 explicit platform contract. Injected supabase means no default client-construction ordering proof.
- **R :46 — Customer.io profile reconcile drains a bounded retry batch**
  Authorized route passes limit25 and returns exact processed/delivered/failed totals. Auth-negative case never reaches batch limit or successful response projection.

## tests/personal-plan-customerio-sync.test.ts (7)

- **R :41 — historical profile parsing is total over malformed v2 concern data**
  Malformed v2 currentConcerns string produces null without throw. Legacy valid array and v3 producer do not reach invalid historical parser shape.
- **R :59 — historical profile parsing preserves the exact v2 concern vocabulary and labels**
  Valid v2 three historical tokens survive parser and project exact older German labels. Current v3 vocabulary differs; cannot replace without changing saved input.
- **R :95 — personal-plan traits keep shared primitives canonical and namespace divergent answers**
  HELD-PP: same v3 input exists in HTTP keeper; positive values and emitted privacy absence can transfer, but raw `in` forbids undefined-only own properties that JSON cleaning removes. Default plan retains this declaration pending root judgment on non-public raw shape. See conditional-pp.md; no credit.
- **R :144 — every structured Personal Plan concern has a readable Customer.io label**
  All current diagnostic concern tokens map to non-token readable labels; fixed three-concern request keeper cannot catch missing label for another current token. Expected set uses normative enum but assertion independently rejects raw fallback.
- **R :168 — personal-plan live sync identifies first and emits one dedicated stable completion event**
  Actual HTTP identify-before-track sequence, stable revision/event IDs and exact event properties; projector alone cannot prove request order, identity or source at server boundary.
- **R :216 — personal-plan profile-only sync cannot emit a completion event**
  sendCompletionEvent=false performs only actual identify request. Outbox fake derives false but cannot prove downstream sync honors it.
- **R :247 — personal-plan sync does not emit the completion event when identify failed**
  Failed actual identify503 suppresses track with exact fetch1; positive identify and profile-only negative reach different guard branches.

## tests/trial-reminders-delivery.test.ts (7)

- **R :69 — enabled reminder enqueues cutoff and revalidates just before sending once to verified owner**
  Canonical keeper: actual enqueue→claim→recipient→fresh prepare→send→settle ordering, queued count and normalized ACK. Absorbs C1-C3 exact annual message union at existing send; recipient/SQL remain injected, no default Supabase or inbox proof.
- **R :78 — off switch and missing configuration cannot enqueue, claim or send**
  Explicit off/missing/bad-date/key/message/sender configuration yields no enqueue/claim/send and disabled/blocked. Authorized keeper alone misses early gate regressions; all original rows unchanged.
- **R :94 — cancellation or expiry after claim suppresses send at the fresh database gate**
  Fresh prepare null produces skipped1 and no send/settle. Claim was valid; catches use of stale claimed snapshot bypassing fresh gate.
- **R :101 — fresh current terms are rendered, not stale terms claimed earlier**
  Changed monthly fresh snapshot must render9.99 instead of stale69.99 and send once. Same-snapshot annual keeper cannot establish fresh-over-stale data precedence.
- **R :120 — missing verified owner and malformed or swapped fresh claims send nothing**
  Missing recipient, malformed fresh snapshot and swapped user each avoid send and require support. SQL dispatchable gate cannot prove JS fresh-claim identity equality.
- **F :132 — ambiguous delivery, malformed ACK and HTTP rejection park with no retry**
  Errors/malformed ACKs prove sends once and supportRequired count, but settle outcome is not asserted; skip settlement could pass while queue remains dispatching. Keep all inputs, flag missing durable-park observer for future repair only.
- **R :159 — post-send settlement failure propagates and never repeats provider send**
  Post-send settle rejection propagates and count send1 stays one; catch-and-retry provider would be dangerous and absent from happy/ambiguous classification proof.

## tests/trial-reminders-route.test.ts (2)

- **R :19 — reminder cron authenticates before all work and exposes aggregate state only**
  No/wrong/basic auth cause0 dispatch; authorized aggregates, blocked503, thrown storage500 sanitized. Client email builder cannot protect server cron authorization or error privacy.
- **R :58 — configured five-minute cron reaches server-auth handler without browser login**
  Exact5min scheduler/max60s plus real middleware factory on cron path avoids browser auth factory and redirect. Handler injection alone cannot catch middleware intercepting cron.

## tests/trial-reminders-sql.test.ts (10)

- **R :70 — queues each eligible Stripe and PayPal new trial exactly once using the frozen required-notice contract shape**
  Actual PGlite migrations enqueue Stripe/year and PayPal/month only once and return stored frozen snapshot shape. JS fixture returns handcrafted rows and cannot prove insert/unique/mapping.
- **R :93 — does not queue before the immutable trial end is within 48 hours**
  Trial end outside48h queues0 despite active enrollment; due predicate distinct from rollout authorization cutoff.
- **R :107 — rollout cutoff excludes earlier trials and cancellation suppresses an already queued reminder**
  Rollout excludes older authorization and cancellation suppresses already queued row; current valid-year snapshot renderer does not execute eligibility SQL.
- **R :128 — paid, revoked, expired, and provider-unresolved trials never queue**
  Paid/revoked/expired/provider-unresolved rows never persist reminders. All independent state inputs retained, no grouping/removal.
- **F :145 — fresh prepare fences cancellation and repeated workers before a provider call**
  Actual SQL proves one prepare permission and no re-claim after completion; title also says cancellation but no cancellation written in this callback. Narrow title later; next callback owns cancellation. No declaration removal.
- **R :187 — cancellation after claim is a fresh no-send fence, while an undispatched failure can be parked**
  Cancellation AFTER claim denies fresh send and undispatched failure can park; previous repeated-prepare keeper only writes successful queued outcome.
- **R :236 — a temporary management change holds a claimed reminder and releases it after reconciliation**
  Pending management change temporarily holds claimed reminder, then reconciled change releases it with current contract. Terminal cancellation and snapshot-invalid cases do not cover recovery.
- **R :296 — expired leases park for support and stale completion cannot overwrite the outcome**
  Expired leases park support and stale completion cannot overwrite terminal outcome. Successful sequential claim/prepare does not test expired fenced attempt.
- **R :331 — private rows and RPCs remain service-only**
  Actual database permission errors for private rows/RPCs protect service-only access. Source migration greps are weaker and for a different outbox.
- **R :344 — the dispatcher consumes the actual SQL RPC shape and records a fake Customer.io acknowledgement**
  Real dispatcher consumes actual RPC row fields, settles actual SQL row queued and returns exactstats. Pure injected fixture cannot expose SQL/TS protocol drift; provider ACK/recipient are still fake.

## tests/trial-reminders.test.ts (6)

- **C :20 — builds a concise, truthful annual reminder using accepted contract facts**
  C1: exact annual snapshot (all12 fields) already rendered by canonical dispatcher keeper. Transfer all12 fixed subject/text/data/html assertions onto captured existing send message; no extra render or input.
- **R :37 — supports the accepted monthly and annual price contracts without inventing amounts**
  Monthly999+999 and annual full-price9999 verify alternate legitimate accepted prices/labels. Annual discounted6999 dispatcher input cannot catch wrong monthly or full-price handling.
- **R :54 — rejects malformed accepted terms rather than creating a reminder with fallback billing facts**
  Wrong seven-day trial end and unsupported renewal6999 must reject rather than default. Valid dispatcher snapshot cannot establish malformed snapshot parser denial.
- **C :65 — escapes all rendered data and keeps its trusted links fixed**
  C2: same annual fixture with identical contractId override adds no operative input. Transfer all4 negative HTML/template, exact ordered5href list and Berlin-date assertions to existing send capture. Original never injected hostile data, so no adversarial escaping claim.
- **R :85 — PayPal reminder states the day-after first-charge date while the trial end stays exact**
  PayPal provider changes first charge to next day while retaining trial end and subject date; Stripe snapshot cannot catch provider calendar offset.
- **C :92 — Stripe reminder keeps the trial-end date as the first-charge date**
  C3: same annual input; exact first-charge date and messageData subject move into canonical captured message. Keep distinct PayPal callback and actual transport template tests.
