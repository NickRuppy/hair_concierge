# Billing operational/public receipts125 — complete per-site ledger

Current exact13files125 AST declarations: {'R': 114, 'F': 5, 'C': 4, 'D': 2}. Full test bodies/helpers/tables read; no runtime/test or repository mutation. Marks are conditional audit judgments; zero removals applied.

## tests/admin-user-billing-summary.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|60|R|no subscription row summarizes as none|Null row returns the entire public none summary with all null fields; a fabricated active/default date fails deepEqual.|
|69|R|active trial reports trial status with the trial end date|Real trial projection maps active trial to trial and original trial deadline; treating authorization as paid or using billing period fails.|
|75|R|trial canceled before its end reports trial_canceled and keeps the end date|Trial cancellation changes badge but retains original deadline; mapping to expired immediately fails.|
|81|R|converted trial reports active with paid-through as period end|Converted trial uses paidThroughAt and clears trial end; prioritizing expired trial deadline over paid facts fails.|
|95|R|converted trial with pending cancellation reports canceled_at_period_end|Paid trial cancellation maps to canceled_at_period_end instead of trial_canceled; distinct paid-phase output.|
|108|R|trial in renewal grace reports past_due|Valid renewal grace maps to past_due; returning active for all access-holding trials fails.|
|123|R|trial that ran out without payment and was canceled reports expired|Canceled unpaid expired trial maps locked phase to expired; treating cancellation as perpetual trial fails.|
|135|R|plain active subscription reports active|Nontrial future active row delivers active and exact period date through actual hasCurrentBillingAccess; primary C3 keeper.|
|144|R|legacy active subscription without period end reports active|Nontrial null-period active row preserves legacy access via actual helper; primary C4 keeper.|
|148|R|past_due entitlement reports past_due|Nontrial null-period past_due maps to past_due rather than active; separate status presentation branch.|
|155|R|canceled subscription with remaining access reports canceled_at_period_end|Canceled row with remaining time maps to canceled_at_period_end and exact end. Admin implements this independently, so it cannot replace canceled helper tests.|
|168|R|canceled subscription past its period end reports expired|Canceled row past end maps expired, using separate canceled branch without active grace. Do not subsume with active expiration.|
|180|D|active entitlement with lapsed period end reports expired|Same nontrial active false-access mapping as nearer 36-hour keeper; D1. No unique date-format, returned-date or output assertion.|
|188|R|active entitlement within the 24h expiry grace still reports active|Active row exactly 12 hours overdue stays active through real policy; primary C2 keeper detects removing grace.|
|197|R|active entitlement just beyond the 24h expiry grace reports expired|Active row 36 hours overdue maps false access to expired; primary C1/D1 keeper catches wrongly granting old open entitlements.|
|205|R|past_due beyond the expiry grace reports expired instead of pending payment|Past_due pairs 12-hour grace and 60-hour expiration; catches unconditional past_due badge and incorrect past_due access membership.|
|225|R|reserved trial admission reports trial_pending, not an active trial|Reserved enrollment is trial_pending even with syntactically valid trial facts; no authorized trial access claim.|
|236|R|row pick prefers an active subscription over a later-ending canceled row|Current active row outranks canceled later period in both array orders; catches first-row and period-only selection.|
|253|R|row pick prefers any access-holding row over lapsed rows|Access-holding canceled row outranks newer lapsed row; catches recency-before-access priority.|
|273|R|row pick falls back to the most recently updated lapsed row|Equal lapsed entitlement/period uses updated_at recency and empty list returns null; catches null initialization/tie fallback.|

## tests/billing-subscriptions-access-grace.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|39|R|EXPIRED_ENTITLEMENT_GRACE_MS is exactly 1 day, matching the SQL grace window|Independent literal 86,400,000ms matches SQL 1-day contract. Imported value is compared to independently defined ONE_DAY_MS; retain exact config guard.|
|43|C|hasCurrentBillingAccess: active row with period end 2 days past has no access|C1: false active-row access is already delivered by nearer expired admin keeper through same canonical helper; relative-time and metadata proof in candidate.|
|51|C|hasCurrentBillingAccess: active row 12 hours past is within the grace window|C2: exact 12-hour relative timestamp predicate true is delivered by existing admin keeper; provider/month/identity fields not read.|
|59|C|hasCurrentBillingAccess: active row with period end in the future has access|C3: nontrial active finite future-date true is delivered by existing admin keeper and exact public period output; no distinct provider branch.|
|67|R|hasCurrentBillingAccess: past_due row exactly at the grace boundary has access|Past_due at exactly minus one day grants access; catches >= becoming >. No admin case reaches exact equality.|
|75|R|hasCurrentBillingAccess: past_due row just past the grace boundary has no access|Past_due one millisecond outside boundary denies; catches rounding/truncation or added slack. No admin case uses millisecond edge.|
|83|R|hasCurrentBillingAccess: canceled row with cancel_at_period_end until a future period end has access|Canceled helper requires scheduled cancellation and future date. Admin duplicates its own canceled logic rather than calling this helper there, so retain.|
|92|R|hasCurrentBillingAccess: canceled row past its period end has no access (existing behavior preserved)|Canceled helper denies one millisecond after period, without open-entitlement grace; independent helper branch vs admin canceled presentation.|
|101|R|hasCurrentBillingAccess: canceled row without cancel_at_period_end has no access regardless of period end|Canceled without cancel_at_period_end denies despite future date; catches removal of boolean gate, absent from admin current canceled inputs.|
|110|C|hasCurrentBillingAccess: active row with null current_period_end keeps existing (grantsaccess) behavior|C4: null active-row fallback covered through actual helper by existing admin legacy keeper, same absence of trial projection.|
|123|R|hasCurrentLegacyProfileAccess: active profile 2 days past period end has no access|Legacy profile 48-hour overdue denial: separate subscription_status adapter branch, not billing-row function; removing profile grace enforcement fails.|
|131|R|hasCurrentLegacyProfileAccess: active profile 12 hours past period end is within grace|Legacy profile 12-hour grace: separate profile branch; premature profile denial fails.|
|139|R|hasCurrentLegacyProfileAccess: active profile with null period end keeps existing (grants access) behavior|Legacy profile null period fallback: independent profile-null branch; null becoming denial fails.|
|144|R|hasCurrentLegacyProfileAccess: canceled profile past period end has no access (existing behavior preserved)|Legacy canceled profile one millisecond expired denies without grace; separate profile code and no cancel flag.|
|149|R|hasCurrentLegacyProfileAccess: canceled profile before a future period end has access|Legacy canceled future profile grants access without billing cancel flag; catches applying billing-row gate to legacy profile.|

## tests/billing-reconcile-analytics.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|55|R|billing reconcile declares a 60 second maximum duration|Next route maxDuration literal60 independently constrains platform timeout; handler-only keepers cannot observe route config.|
|59|R|billing reconcile reports bounded browser recovery cleanup without changing payment health|Handler passes500 cleanup bound and forwards mixed cleanup outcomes without making payment health fail; removing cleanup/including cleanup.ok in HTTP health fails.|
|82|R|browser recovery cleanup calls both purges once with the 500-row bound and isolates errors|Actual purge adapter emits two distinct RPC names/p_limit500 and isolates resolved database error. Handler test stubs the entire adapter, so retain protocol owner.|
|106|R|billing reconcile keeps retry disabled by default and still runs integrity first|Undefined retry defaults disabled; actual integrity branch gets fixed now,20s daily deadline and ordered in_progress/ok check-ins, no dispatch and exact body.|
|156|R|billing reconcile runs one-time fulfillment retry only behind its dedicated flag|Enabled fulfillment passes both default provider dispatchers and emits exact provider-partitioned stats; neither fixture creates the orchestration flag/call.|
|187|R|billing reconcile runs paid-access monitor after one-time fulfillment retry|Fulfillment precedes paid-access evaluation, which reports missing receipt and flushes once; exact paidAccess safe output retained.|
|253|R|billing reconcile does not start unattended branches before one-time fulfillment finishes|Awaited asynchronous fulfillment completes before all four branches; sync order test alone cannot detect omitted await. Each branch asserts finished and presence.|
|311|R|default one-time fulfillment dispatchers pass quiz linking to both provider processors|Default dispatcher actually loads separate Stripe/PayPal processors and forwards quiz-link function; fake processors only observe passed dependency, do not manufacture forwarding.|
|343|R|billing reconcile drains all destinations with a limit of ten when enabled|Enabled retries call exact five destinations at10 each and preserve distinct per-destination counters. Promise/map omission, misassociation or Slack inclusion fails.|
|385|R|billing reconcile isolates and sanitizes one analytics destination rejection|One rejected PostHog destination leaves all other four running, sanitized error shape and HTTP500; catches Promise.all abort/raw-error leakage.|
|419|R|billing reconcile authenticates before entitlement, integrity, analytics, and one-time retry work|Wrong secret denies before entitlement/integrity/analytics/fulfillment/check-in; true flags make early-denial proof meaningful.|
|461|R|billing reconcile isolates entitlement failure from integrity, analytics, and one-time retry|Entitlement throw preserves integrity, five analytics deliveries and fulfillment, reports sanitized classified reason/down0; cross-branch isolation distinct from local catch reporter.|
|513|R|billing reconcile captures the entitlement branch failure to Sentry instead of swallowing it|Actual entitlement catch forwards the original Error to Sentry dependency and yields classified body/down0 without raw text; isolation keeper does not observe reporter.|
|539|R|billing reconcile isolates one-time fulfillment failure from other branches|Fulfillment rejection still runs all other branches and emits statuserror; distinct awaited pre-branch catch.|
|574|R|billing reconcile isolates integrity failure and marks the daily check-in error|Integrity rejection marks daily check-in error, reports one safe incident, preserves entitlement/analytics counters and safe body; daily composition distinct from local route.|
|693|R|OpenAI cleanup reports deletion and isolates database failures|Cleanup success count and rejection classified into analyticsRetry while entitlement remains2; catches raw-error leakage and cleanup poisoning unrelated result.|

## tests/billing-slack-supabase-ownership.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|6|R|Vercel cannot query or claim Slack deliveries even when explicitly requested|Explicit Slack destination must return all-zero stats without any database from call. Actual outbox guard, independently of reconcile destination list; removing early guard fails.|

## tests/payment-integrity.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|46|R|settlement grace skips recent provider success without local lookup|59-minute succeeded candidate skips before local lookup, increments grace count, no finding. Invalid identity is deliberately reached only after grace; removing grace changes skipped counter.|
|74|F|subscription provider success requires billing success and active entitlement|F: two mismatch findings are real, but healthy ID is seven characters and synthetic digest invalid; normalizeCandidate removes both identities, so healthy never reaches getState/evaluateCandidate. Keep mismatch proof; repair healthy negative control separately.|
|113|R|duplicate provider representations produce one finding per subscription invariant|Two valid representations with one digest yield exactly one invariant/reporter call while candidatesChecked2; catches dedupe key/no-dedupe error.|
|150|R|local funnel classification promotes historical provider findings to internal tests|Local isInternalTest true promotes resulting historical finding; provider false alone must not override local QA classification.|
|170|R|one-time provider success depends only on its paid purchase record|PayPal one-time success checks purchase record rather than active subscription; valid IDs exercise missing purchase and healthy purchase distinct from subscription branch.|
|215|R|provider failure conflicts only with same-commerce billing success, not retained access|Failed subscription with billingSucceeded false retains access without conflict, true billing success conflicts once; catches using entitlement instead of same-commerce money fact.|
|251|R|provider lookup errors become monitor failures, not payment findings|Provider rejection creates classified provider_error monitor failure and zero findings with no provider error text; actual catch path.|
|280|F|incomplete pagination and cap overflow are monitor failures and only the hard cap is checked|F: real pagination/cap execution exists, but candidates and expected checked count derive from the same production cap. Changing100 to200 keeps test green; retain and pin independent literal bound before claiming hard100 proof.|
|312|R|deadline exhaustion stops remaining checks and reports monitor failure|Injected clock crosses deadline after first valid candidate, stops second and records exactly one deadline failure; catches checking deadline only before provider.|
|343|F|candidate checks are bounded to concurrency four by default|F: concurrency is measured with real unresolved promises, but expected maximum and release threshold reuse production constant. Changing4 to5 remains green. Keep scheduling proof; independent4 oracle needed.|
|384|R|reporter throws are contained and do not abort the scan|Actual reporter throw is swallowed and healthy second candidate is checked; removal of safeCall containment rejects/aborts.|
|419|R|result and reporter payloads expose only aggregates and bounded opaque descriptors|Actual normalization strips raw provider extras and absent ID; two total findings with retained max1 and valid digest, reporter and returned payload tested independently of raw fixture.|

## tests/payment-monitor-route.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|39|R|payment monitor reserves response time around its 40 second work deadline|Next platform maxDuration60 retains response headroom around40s; behavior tests cannot inspect deploy export.|
|43|R|paid-access finding live tag follows the finding provider only|Mixed live/sandbox provider pairings exercise both branches of real resolvePaidAccessFindingLive; OR-combining flags fails. Caller reportPaidAccessFinding live.|
|62|R|payment monitor uses fixed-size constant-time auth comparison input|Unequal token/secret lengths still pass two32-byte digests into comparison; actual authDigest called, comparator observes independent timing-safe input contract.|
|73|R|payment monitor rejects auth failures before rate limit, work, or check-in|Wrong token stops rate limit, payment runner and check-in with exact401; actual auth, unlike mocked receipt.|
|99|R|payment monitor rate limits before payment work or Sentry check-in|Authorized rate denial gets first forwarded IP and429 with no runner/check-in; distinct denial boundary.|
|122|R|payment monitor runs with a 40 second deadline and returns aggregate-only counters|Actual local branch sets40s deadline, current time, safe aggregate body and ordered paired check-in. Absent must_not_leak sentinel is weak extra assertion, not claimed privacy proof alone.|
|162|R|production monitor mode requires start and finish check-in receipts plus a flushed transport|Required production check-in receipts: valid start/finish+flush succeeds, missing receipts yields classified failure. Local defaultfalse cases cannot own requiredtrue.|
|207|R|payment monitor contains runner and Sentry failures without exposing errors|Runner throws and check-in throws are both contained; safe incident, HTTP500/error emptycounters, two attempted check-ins and raw-error absence.|
|263|R|payment monitor returns safe failure categories and flushes telemetry before responding|Monitor failure with valid receipt retries false flush once before success; exact safe failure projection and flush2 catches removing retry.|
|314|R|payment monitor fails closed when an emitted incident has no Sentry receipt|Missing incident receipt appends telemetry_delivery_failed, increments monitorFailures andHTTP500 despite successful flush; catches accepting transport success alone.|
|364|D|payment monitor flushes completed integrity findings before returning success|D2: response200/flush1 subset owned by uncapped-counter keeper; actual confirmTelemetryDelivery never reads findings array and summary omits it.|
|406|R|payment monitor uses uncapped incident counters when requiring Sentry receipts|Incident counter1 requires flush even when materialized findings[] is capped away; existing receipt→flush1 and200 owns D2 plus counters-versus-array regression.|
|431|R|payment monitor runs paid-access branch with aggregate-only output|Paid-access branch with existing receipt emits only provider/reason+aggregates, drops purchase/user/lead IDs and flushes1; distinct privacy boundary.|
|494|R|payment monitor branch emits paid-access findings when runner returns no receipt|Absent receipt property triggers actual branch-level reporting once, valid new receipt→flush1 and safe paidAccess projection; input fixture does not implement reporting.|
|552|R|payment monitor fails closed on partial paid-access receipts without duplicate reporting|Partial defined receipt array is not re-reported, fails closed for missing count and classified failure; distinguishes absent from partial property.|
|610|R|payment monitor fails closed when paid-access finding has no Sentry receipt|No paid-access reporter/receipt leads500 plus safe finding and incremented monitorFailure; independent paid-access receipt verifier.|
|669|R|payment monitor preserves a canonical paid-access conflict category|Canonical access conflict retains exact provider/reason/family while dropping purchase ID; specific accepted category absent generic localerror tests.|
|723|R|payment monitor omits unexpected runtime failure categories from its response|Unexpected runtime provider/reason/family values are omitted, not echoed; literal secret values reach actual summarizer, making negative meaningful.|

## tests/payment-monitor-trigger.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|23|R|local trigger encloses the server monitor deadline|Independent literal50s timeout contract encloses40s server budget; default trigger duration not observed by injected fast fetch.|
|27|F|runs the HTTPS monitor with a Keychain secret that never enters argv or logs|F: actual endpoint/method/header/redirect and main privacy assertions have value, but mock itself constructs Keychain argv; assert.deepEqual does not observe readKeychainSecret execFile. Preserve all real assertions and repair/narrow argv claim separately.|
|63|R|rejects non-HTTPS endpoints before Keychain access|HTTP endpoint rejected before Keychain with exact configuration_failure; distinct scheme gate.|
|81|R|rejects every HTTPS host, path, query, or fragment except the production monitor route|Five HTTPS endpoint variants exercise exact host/www/path/query/fragment rejection before Keychain; cannot remove on same error title.|
|108|R|returns a nonzero, secret-free result for Keychain, network, and HTTP failures|Three failures map Keychain/network/HTTP to safe nonzero logs, without secret; actual exception classification and safe response body read boundary.|
|153|R|logs only privacy-safe monitor failure categories from the authenticated endpoint|HTTP500 JSON failure projection whitelists category tuple and drops raw reference/email; actual parse/sanitizer receives sentinel fields.|
|189|R|logs paid-access monitor failures with stable dedupe|Paid-access and integrity failure arrays merge/dedupe stable tuples including canonical conflict; catches one-lane-only parsing or duplicate logs.|
|241|R|requires the endpoint argument and does not place a Keychain value in process arguments|No endpoint args yields configuration_failure and unchanged argv; retain missing-required-argument CLI contract, not a claim that real Keychain invocation was observed.|

## tests/payment-monitor-paypal-test-classification.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|24|R|PayPal test classification dry-run is PII-safe and does not write|Dry-run finds one eligible historical row, emits exact PII-free summary and performs zero updates; active supported operator safety.|
|50|R|PayPal test classification apply requires every production gate|Missing internal-test flag, project confirmation or env gate each reject with other tested gates valid; distinct AND guard branches. Does not claim mismatched URL case covered.|
|80|R|PayPal test classification applies a metadata-only optimistic update|Apply passes exactid, metadata merge/time/reason and expectedupdated_at to adapter once; real owner constructs metadata, mock records only. Does not prove PostgREST CAS implementation.|
|117|R|PayPal test classification refuses ambiguous, post-cutover, or non-PayPal rows|Empty/multiple/provider/status/entitlement/cutover cases independently reject eligible row gate; avoids classifying live customers or ambiguous inventory.|

## tests/billing-public-contract-declaration-resolution.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|106|R|trusted match validates owner and freezes original submitted time and verification reference|Real SQL rejects wrong owner/empty verification, freezes submittedtime/reference, permits same replay, rejects changed reference and authenticated access; actual table grants/trigger.|
|130|R|late processing of timely unpaid trial cancellation preserves original declaration time and queues provider work once|Late processing preserves original timely timestamp/end, queuesoneoperation idempotently, keeps receipt immutable/in_review and requires providerconfirmed before completion; resolved sameevidence replay only.|
|165|R|charge winning before apply never creates unpaid cancellation; paid and withdrawal require external completion/refund evidence|Preexisting successful collection yields payment_review_required and no unpaid declaration; refund evidence required beforepaid completion.|
|184|R|withdrawal and extraordinary declarations never enter ordinary-trial cancellation queue or resolve from email state|Withdrawal/extraordinary kind uses external review path, requires provider evidence/termination and remainsin_review beforehand; not ordinary queue authority.|
|196|R|a successful in-flight charge after accepted cancellation prevents resolution until refund evidence exists|Positive late ledger payment after accepted cancellation requires refund even if enrollmentfirstpayment remainsnull; independent event-ledger lookup.|
|219|R|null/queued-mail evidence cannot resolve, and direct status updates still require match/completion records|Direct review-status updates require match/completion records; null/extra email evidence rejected; genuine SQL guard/unknown semantics, not fake receipt.|
|242|R|operator commands validate exact scope and require a complete evidence file; they never dispatch providers|Real CLI and resolution adapters validate exactargs beforeRPC, forward trustedowner and complete evidence, emit fixed resolved result onlyaftertrue; no provider dependency exists in command closure.|

## tests/billing-public-contract-declaration-route.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|29|R|no-cookie public request returns only its own durable receipt after both limits pass|No-cookie request passes twohashed budgets before submit and emits no-store200 onlywith ownreturnedreceipt, queuedstatus. Does not claim durableDBproof, which is separateSQLkeeper.|
|49|R|database failure cannot report a received declaration or reveal internal account data|Submission throw yields503 classifiederror with no accounttext; receipt cannot be falsely acknowledged.|
|60|R|rate limits and unavailable rate storage stop persistence; address budget is shared across kinds|Both budgets denied/unavailable yield429/503 beforepersistence, retry-afterpositive; sameemail acrosskindsshares key. Distinct limiter and storagefailure branches.|
|89|F|rejects cross-site requests, oversized bodies and account-authority fields before persistence|F: crosssite/authority/content-type controls meaningful, but oversized contract20k independently violates500char parserbound; deleting MAX_BYTES stream guard stillreturnsaccepted400, so wholebody-budget claim is falsegreen. Keep othersecurityproof; repair bounded-body fixture separately.|
|107|R|public legal pages and exact submission API bypass auth, including during auth outages|Exact publiclegal/API routes pass actual middleware without auth initialization duringoutage; siblingprivate/cancellation stayprotected. No blanket prefix carveout.|

## tests/billing-public-contract-declaration.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|15|R|accepts a cancellation without authentication and normalizes only surrounding whitespace/email|Parser trims boundary whitespace and lowercasesemail while preservingcontractbody and allfields; routefixturealreadyclean cannotdetect normalizationregression.|
|24|R|keeps withdrawal separate; rejects cancellation timing/reason and unknown account-authority fields|Exactkeys reject forgedauthority/end fields; withdrawal disallows timing/reason; ordinaryreason rejected; withdrawal/extraordinary positive variants. SQLallowsdifferentvalidationand cannotreplacefrontendparser.|
|45|R|bounds untrusted text, requires usable contact/contract, and rejects control characters|Malformedemail/headerinjection/controlchar,emptyname/contract/end,501charcontract,invalidUUID reject; route20kbody doesnotcoverthese lexical boundaries.|

## tests/billing-public-contract-declarations-postgres.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|58|R|durably saves unmatched declaration and receipt atomically; identical replay keeps original timestamp|Real submit adapter+SQL atomicallypersist declaration/receipt, timestamp fromDB, replayimmutable andpayloadmismatchreject; independently authoredreceipttext omits falseeffective/refund/sendclaims.|
|85|R|receipt enqueue failure rolls back acceptance; retry can then succeed|Actual outboxconstraintfailure rollsback declarationinsert and sameinput succeedsafterconstraintremoved; no mock-owned persistence.|
|101|R|unprivileged roles cannot read or submit; service can submit but cannot rewrite immutable snapshots|Anon/authenticated cannotread/submit; service caninsert butcannotrewrite originalsnapshot/time. TestsACL independently from TS/API authentication.|
|123|R|withdrawal and extraordinary declarations keep their distinct text without asserting refund/effective date|Distinctwithdrawal/extraordinary text andrequesteddate viaactual submit+renderer. Middle rejection reuses existingrequestId with differentpayload; it does not prove extraordinaryreason isrequired (currentparser/SQLallow null).|
|148|R|operator review queue stays pending after receipt delivery and exposes details only to service-role exact reads|Afterreceiptmarked sent reviewremains pending; service listsPII-freekeys andexactdetail, anon/authdenied, no arbitraryresolvedupdate. Delivery isnot cancellationresolution.|
|196|R|read-only operator CLI rejects mutation arguments without calling the database|Read-onlyCLIsyntax rejects mutation/invalidid/emptyargs beforeRPC androutes list/exactread toseparate functions; genuineoperatorboundary.|

## tests/public-contract-declaration-receipt-delivery.test.ts

|Line|Mark|Declaration|Independent contract / actual faulty owner|
|---|---|---|---|
|65|R|the durable declaration starts locally queued and only a later matching provider confirmation can mark it sent|ActualSQLqueued→claimed→providerACK stillqueued→wrongconfirmationfalse→matchingconfirmedsent plusretryablefailedtime andanonclaimdenial. Distinctstorage/attempt/confirmationcontract.|
|171|R|a Customer.io acknowledgement records queued, never sent, and uses the declared recipient|Realdispatcherusesdeclaredemail, message, generatedreceipt/notice/contact andnormalizesseconds toISO; providerACKsettlesqueuedonly with exactaggregate counts.|
|224|R|missing receipt-template configuration fails closed before a declaration is claimed|Missingtemplate blocksbeforeclaim/send/settle withexactallzero blockedstats; independentconfigurationinput.|
|250|R|missing Customer.io credentials fail closed before a declaration is claimed|MissingAPIcredential blocksbeforeclaim despitevalidtemplate; separateORinput cannotcollapse into missingtemplate.|
|270|R|ambiguous Customer.io outcomes are parked for support and are never blindly retried|Ambiguousproviderclass maps support_required/customerio_delivery_ambiguous, neverblind retry; realerrorclass discriminator.|
|289|R|Customer.io HTTP failures are parked without retaining provider text because acceptance is unconfirmed|HTTP503class maps support_required/customerio_http_unconfirmed withoutPII; independentclasscode fromambiguous/network.|
|308|R|a malformed claim aborts the whole invocation before any receipt can be sent|Validfirstclaim+malformedsecond prevalidatedaswholearray: noearliersend; detects movingvalidation inside deliveryloop.|
|327|R|a settlement failure after a queue acknowledgement aborts without a second settlement|AcknowledgedproviderthenDBsettlethrow propagates once, no catch/re-settle; protects duplicate delivery/unknownoutcome.|
|346|R|the worker uses one bounded active claim and a lease longer than its route budget|Independentlimit1andlease>60 protectworkerbudget; injectedclaimcallbackdoesnotobserveactualdefaultRPCargs, so staticconfigguard stillcheapestindependent.|
|351|R|the cron route requires its secret and exposes aggregates only|Cronrequiressecret, authorizeddispatchreturns exactaggregates; separate HTTPorchestration fromdispatcher policy.|
