# Client telemetry utility44 complete ledger

38R /3F /2conditionalC /1conditionalD.44→44→41.

## tests/analytics-runtime.test.ts (16)

SHA 480aa5a6dd1368db7708a1c45eae71163e073172bbdb6fbb877605bb8089374b

|Line|Mark|Title|Evidence|
|---:|---|---|---|
|22|C|bounded FIFO drops the oldest item and warns when full|C1 actual Sentry FIFO overflow keeper receives three pushes at limit2,drains last two in order; transfer warncount1. Numeric labels are opaque to queue.|
|38|R|post-paint scheduling releases only after two animation frames|Two animation-frame callbacks must precede release, cancellation gets both handles; Sentry scheduler injects fake frames and cannot prove real two-frame primitive.|
|75|R|PostHog registers settled funnel context before one FIFO flush|Settled context register before capture/identify and sessionid forwarding; dropping register or flushing first fails.|
|97|R|PostHog registers a later successful context after an initial bootstrap failure|Initial rejected context must not poison later successful registration; distinct failed bootstrap lifecycle.|
|119|R|PostHog ignores a stale context that settles after a newer navigation|Old context settles before SDK while newer pending; only newer navigation may register after release.|
|151|R|PostHog registers the newest context that settles before its client and preserves explicit events|Latest context settles before delayed SDK, old promise later; must register latest first and retain explicit event session; different race from preceding.|
|188|R|PostHog preserves identify and reset ordering before readiness|Queued identify/reset ordering and explicit undefined traits; reversing identity operations fails.|
|202|R|PostHog loader failure is isolated and stops accepting new calls|Rejected SDK isolates release and flips admission true→false; queue failure path independent from context rejection.|
|216|R|PostHog removes sensitive queries and fragments from automatic URL properties|Automatic URL keys plus nested set_once and ordinary property preservation; skipping any targeted key or nested recursion fails.|
|243|R|PostHog preserves the allowlisted quiz-return result context|Allowlisted quiz_return entry retained while utm/resume secret removed; distinct allowlist member from completion.|
|253|R|PostHog removes sensitive queries from session replay URLs|Replay request.name sanitization and entryType preservation are separate SDK callback input shape.|
|266|R|PostHog masks replay inputs unless unmasking is explicitly enabled|Strict lowercase true opt-in unmasks; undefined,false,uppercase remain masked.|
|273|C|Customer.io bridges page, identify, track, and reset in FIFO order|C2 public Customer.io helper keeper already flushes page/identify/track/reset exact full array, plus clean undefined props. All differing strings are forwarded opaquely, queue10/100 both below overflow with4 items.|
|297|R|Customer.io browser loader unwraps the SDK tuple before flushing queued calls|Actual browser SDK thenable tuple unwrap, EU CDN/writekey forwarding and onReady queue connection; returning tuple instead ofclient fails.|
|353|R|Customer.io loader is single-flight and connects the client once|Promise identity and one load/onReady; facade FIFO does not call runtime.start twice.|
|380|R|Customer.io loader failure is isolated and disables its queue|Rejected SDK one-shot unavailable/warn and repeatfalse; retrying or failing queue disable notification fails.|

## tests/analytics-runtime-environment.test.ts (2)

SHA 3c2bb3baaf0c80a9b74e1d1f72815c895dadb0897c92ce9d7a819a747b67e488

|Line|Mark|Title|Evidence|
|---:|---|---|---|
|7|R|browser vendor analytics stay disabled on local hosts unless explicitly enabled|Local host spellings and explicitoverride/publichost branch; runtime source-position guard does not execute this predicate.|
|16|F|analytics coordinator applies the environment gate to all vendor releases|F1 gate index/order text passes if return deleted and breaks aliases; retain actual local-vendor suppression contract, replace with executed coordinator guard test or binding-aware control-flow proof. No deletion proposed.|

## tests/sentry-client-runtime.test.ts (9)

SHA 393457ec09ed80c08b3cb94d1e05115784786670e36ccb01cb29cfdd7022820d

|Line|Mark|Title|Evidence|
|---:|---|---|---|
|99|R|exact landing routes wait for post-paint while every other route starts immediately|Exact deferred landing vs immediate other routes; fake scheduler records actual chosen branch.|
|117|R|the first early browser error force-loads and flushes once with its mechanism|Early browser error cancels schedule,loadonce,removes listeners before init and flushes originalError/onerror unhandled; ordering owner is real.|
|143|R|fallback browser errors retain source location without serializing event objects|Fallback error constructed from message/location rather than serialized event; source-position mutation fails.|
|162|R|bounded FIFO drops the oldest exception and preserves rejection order|Primary C1 keeper: real runtime→sharedFIFO limit2 drops first, preserves last2 error/mechanism order. Add exactlyonewarning assertion; no new dispatch/input.|
|185|R|React-boundary capture uses the shared facade and force-starts loading|Registered public facade force-loads and delivers handledReact mechanism; direct runtime tests miss wrapper registration.|
|202|R|the shared facade warns in development when no runtime is registered|Unregistered facade false+developmentwarning; independent no-runtime boundary.|
|216|R|concurrent releases share one load and later router transitions forward|Concurrentrelease single-flight plus post-ready router forwarding; falsepass loadCount caught under earlycapture.|
|231|R|loader failure removes listeners, clears queued errors, and never throws|Rejected loader listenercleanup/latefalse/no capture,warningonly; initfailure does not exercise rejectedload promise.|
|248|R|initialization failure is isolated after temporary listeners are removed|Throwing initializeClient after listener removal must disable later capture; distinct lifecycle branch.|

## tests/instrumentation-client.test.ts (3)

SHA 55fc6486e5cd56d3ef2c082a6ea06fff91dd628e73c097159b60d4859f8fb580

|Line|Mark|Title|Evidence|
|---:|---|---|---|
|8|R|client beforeSend filters Meta bridge noise before scrubbing retained events|Actual registered beforeSend hook composes exact Meta-noise filter and retained-event token scrubbing; callbackcaptured from init not mock-owned sanitizer.|
|53|F|landing client entry points keep Sentry behind a dynamic import boundary|F2 dynamic SDK/loading architecture meaningful but exact local Sentry identifier/import/capture spelling fails benign aliases; preserve package graph/lazy loading and global error delivery via binding-aware or built graph oracle.|
|64|R|Sentry starts in a task after the post-paint frame boundary|Extra task after frame scheduler,one callback and taskcancel7; real primitive frame-count keeper lacks extra task wrapper.|

## tests/app-performance-telemetry.test.ts (6)

SHA 77f285379b680c59829c0884cfd915401c9720dd22a2ec5173088548f9a81a0a

|Line|Mark|Title|Evidence|
|---:|---|---|---|
|15|R|accepts only the bounded performance vocabulary and falls back to unknown region|Bounded positive event envelope,regionfallback,durationrounding,tripcount and fields; default/normalizer faults fail.|
|37|R|rejects invalid enum values and identifiers from the telemetry envelope|Primary D1 keeper: invalid route,operation and correlation each fail intended field guard, with valid other fields.|
|73|R|keeps correlation IDs out of Server-Timing and public-safe sink payloads|Correlation private sink preserved but omittedfrom public ServerTiming; append and enum envelope keys exact; leaking data/header or dropping correlation fails.|
|105|R|maps only the seven approved routes to performance groups|Seven exact route groups plus unknown and routine-private denial; SpeedInsights lacks routine-private input and asserts mappedcanonical outputs rather than rawgroup.|
|122|R|maps response status to the bounded outcome without free-form details|Response status ranges distinguish redirect,denied,notfound,transient vs success; path sanitizers cannot catch.|
|131|D|accepts only generated UUID v4 correlation identifiers|D1 duplicate invalid correlation predicate: request-correlation-id and keeper lead_123@example.com both fail same UUID regex after valid enums. No UUID-shapedwrongversion input here despite title; no distinct contract lost.|

## tests/speed-insights-integration.test.ts (5)

SHA ea4147956e141ed43ebffec305996f081f4cfed8e5237f462e82d13b09ed638f

|Line|Mark|Title|Evidence|
|---:|---|---|---|
|6|F|root layout renders exactly one ungated Speed Insights component|F3 independent ungatedsingleintegration+sanitizerbinding matters; regex counts wrapper but not rootinstances and fails localidentifieraliases. Repair structural boundary insteadofdrop; sourceclassnamedimport alone notretirement.|
|23|R|Speed Insights keeps only canonical URLs for public pages and measured app areas|Canonical public and7measuredapp routes,query/hash/identifier removal and suppliedrouteoverride; fixedliteral expected URL tests owner.|
|47|R|Speed Insights retains the page origin for preview deployments|Previeworigin and HTTP localhostport preserved; publichostkeeper cannot guard originhardcoding.|
|62|R|Speed Insights drops auth, payment-return, result, nested public paths, and unknown URLs|Auth/payment/result/nestedpublic/unknown/protocol/relativeinvalid URLs refused; meaningful privacy input matrix remains.|
|85|R|privacy notice accurately describes anonymous Speed Insights measurement|Publicprivacycopy contract independently describes delivered measurements; source text is current published disclosure, not arbitrary private shape.|

## tests/customerio-tracking.test.ts (3)

SHA f2cd43232a741e37751bc6111f30a15bcfe4d54aa52fe1a3c2201f057e758106

|Line|Mark|Title|Evidence|
|---:|---|---|---|
|30|R|browser helpers queue before readiness and flush clean payloads in order|Primary C2 keeper: actual public helpers→singletontracker→sharedFIFO→client;4operations exactly asserted, admissiontrue/emptybeforeflush and undefinedpropertycleaning extra.|
|67|R|browser helpers stop accepting calls after loader failure disables the runtime|Public wrapper disable path rejects all4 methods, unlike factory loaderonUnavailable callback recorder.|
|79|R|Customer.io calls override production SDK page enrichment with a credential-free context|Actual tracker overlays safe context on SDK-like enrichment; independent serialized-negative secret assertions guard leak despite expectedcontext derived helper. Installed SDK enrichment was checked for merge precedence; no real provider call.|

