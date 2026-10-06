# Client telemetry utility boundary — complete semantic pass

Read-only task at `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, HEAD21e0e41fa996ec6a725c258ab3766971f0edb94d.44 AST sites across7 complete test files: analytics-runtime16, analytics-runtime-environment2, sentry-client-runtime9, instrumentation-client3, app-performance-telemetry6, speed-insights-integration5, customerio-tracking3. Last file added as an actual public-helper keeper, fully read. **38R/3F/2conditionalC/1conditionalD;44→44→41**. No test/source/runtime/provider/browser/DB/environment action. Existing failures not reclassified.

## Why this is new

Current complete-read map and earlier `/tmp/test-audit-*.md`/durable evidence search had no exact-file complete ledger for these seven files. Earlier orphan reports retained setActiveSentryClientRuntime because instrumentation uses it; that was reachability evidence, not callback review. Prior dashboard/payment analytics cohorts are different owners and were excluded. Complete 44-site machine ledger contains every title/line/full body/hash and specific credible failure. This is a bounded new semantic pass, not a whole-repo claim.

## Read boundaries and support

Full tests, all tables/helpers. Full production files: analytics runtime bounded-fifo,post-paint,environment,customerio,posthog; customerio-tracking,page-url; observability sentry-client-runtime,sentry-client-filter,sentry-scrubbing,app-performance,speed-insights; instrumentation-client; analytics-runtime-coordinator,tracking-providers,posthog-provider,customerio-provider; rootlayout,globalerror and privacy-safe-speed-insights wrapper. Actual proxy `measureProxyAccess` full function :170-212 read; rest of proxy navigation only. Datenschutz SpeedInsights disclosure section :183-197 read; no full legal-page review. Funnel client subscription implementation and publication caller read as dependency context; no new verdict on funnel bootstrap lifecycle. Native CI top-level Node route package49/workflow158 applies unchanged.

Installed Customer.io AnalyticsBrowser/AnalyticsBuffered declarations confirm PromiseLike<[Analytics,Context]>, rather than client directly. Installed page-enrichment actual function :60-99 confirms context.page overrides page defaults, and page properties overlay defaults. This supports retaining the SDK-like fake as a transport oracle while retaining independent secret-negative checks. Installed SpeedInsights next types confirm beforeSend may return null to drop. No external SDK/provider execution or complete library audit; exact readsets/hashes are drift guards, not full-read claims for the entire dependency package.

Current entry/caller closure: framework instrumentation installs runtime/error listeners and dynamic Sentry import; GlobalError calls actual shared capture facade. Rootlayout mounts PrivacySafeSpeedInsights. TrackingProviders mounts actual coordinator; its effect guards local hosts before deferred vendor starts. CustomerIo/PostHog providers call public tracking facades; CustomerIo module exports singleton wrappers. Shared FIFO consumed by three production owners (PostHog, Customer.io, Sentry). AppPerformance used by live proxy measureProxyAccess with crypto.randomUUID, response outcome, private Sentry/log attributes and public ServerTiming. All remain supported. No disconnected seam or retired feature identified.

History: `37319140` (#454) intentionally moved Sentry after first paint and buffered early errors; `cf72e68e` (#565) changed settled navigation attribution; `0cb9cdc4` (#388) introduced app latency baseline; `357f1731` (#519) updated public legal disclosure; `0d72bb53` (#584) retained mobile/SpeedInsights integration. Current docs/funnel-attribution.md:70-76 explicitly describes first-paint FIFO loading. Analytics loading plan151-163 specifically retains order, SDK-failure and bootstrap-success/failure contracts. These explain current intentions; history alone is not authority to retain a dead function. We found actual current callers too.

## C1 — shared FIFO observed at real Sentry delivery

Donor analytics-runtime:22 `bounded FIFO drops the oldest item and warns when full` creates limit2, pushes1,2,3; asserts drain[2,3],warninglength1.
Keeper sentry-client-runtime:162 `bounded FIFO drops the oldest exception and preserves rejection order` starts actual runtime, dispatches three existing unhandled rejections before deferred SDK resolution, at same limit2. Real runtime invokes same FIFO push3 times and real drain. It already asserts capturecount2, second Error then synthesized fallback Error, and both exact mechanisms. Only missing assertion: exactlyone recorded warn; add `assert.equal(harness.calls.filter(([name]) => name === "warn").length, 1, "one overflow warning")` after capturecount.

Input equivalence is operative, not literal: FIFO never reads item fields/type, only currentlength vs limit; items opaque. Both fill0→1→2 thenoverflow3, same drain invocation. Label only formats warningtext; donor never asserted text. Keeper additionally owns runtime sequencing/error normalization and actual delivery. Full donor/keeper before/after strings in candidatesJSON. No newdispatch/input/call/row; filtering existing call recorder is an assertion projection only. After cut remove now-unused direct FIFO test import. Production FIFO remains used by all3 owners.

Controls planned: actual shared items.shift→items.pop fails keeper firstdeliveredmessage, suppress warn fails newexactcount. Static unique anchors/prospective TypeScript parse only; main must establish actual intendedred.

## C2 — direct Customer.io factory replay subsumed by public wrappers

Donor analytics-runtime:273 `Customer.io bridges page, identify, track, and reset in FIFO order` uses actual tracker factory,queues4 before setClient,then asserts exact4clientcalls.
Keeper customerio-tracking:30 `browser helpers queue before readiness and flush clean payloads in order` calls actual exported page/identify/event/reset wrappers on singleton factorytracker, asserts each admissiontrue, empty clientcalls before set,thenexact4calls including argumentpositions and independently literal full payloads.

Union mapping: donor page('/quiz',undefined)→keeper page('/quiz?step=goals',{referrer:undefined}) both realcleanproperties produce{} and browsercontextundefined; current source forwards path without inspecting/queryparsing here. identify user1/email→user123/email+name+unusedundefined: ID opaque, properties cleaned only by undefined predicate, literals independently assert unchanged values. track quiz_started/step_number2→quiz_lead_captured/leadid+consent+skippedundefined: eventname forwarded with no event-specific runtime switch, all retained defined values opaque. reset exactemptyarguments in both. Four queued operation tags sameordered vector. Limits10 vsdefault100 neverreached by4 queueditems. No input changes or newcalls proposed. Keeper already owns complete genericdispatch contract and additionally wrapper binding/propertycleanup. String substitutions themselves are not credited as unique coverage. No assertions transferred and no new table row.

Controls planned at actual dispatch: wrong page argumentposition, wrong identify ID, wrong track name, omittedreset,reverse shareddrainorder. Existing keeper literal completecalls must fail. Allvalid/sourceunique staticparse only. No claim of real SDK/provider delivery.

## D1 — duplicate invalid-correlation predicate

Donor app-performance-telemetry:131 `accepts only generated UUID v4 correlation identifiers` makes one call with routine/proxy_access/success/duration1 and correlationId request-correlation-id; asserts /correlationId/ throw.
Keeper :37 `rejects invalid enum values and identifiers from the telemetry envelope` already makes a thirdcall with validroutine/proxy_auth/success/duration1 and lead_123@example.com; asserts same /correlationId/ throw. Both valid operations are included in exactenum before same independent assertCorrelationId. Both correlation strings fail same single UUIDregex without any internal branches; rejected before region/duration/trip processing. Donor does not provide a UUID-shapedwrongversion or generatedrandomUUID input despite title. Existing positiveevent validates actualv4 literal separately. No independent UUIDversion contract is lost because donor never proved it. No input/call/assertion added. Actual source control bypassing correlationguard must make keeper's thirdassertion fail for Missing expected exception. Production helper remains called.

## F held — no count credit, no proposed edits

1. Environment source-position guard only ensures release spellings come after an if-string. Removing its return leaves a falsegreen localvendor-suppression proof. Retain policy; repair at actual effect boundary or binding/control-flow-aware static guard. Current directhost predicate tests remain.
2. Dynamic Sentry SDK architecture check protects real loading/privacy/error capture, but localidentifier/type-import/capture-call spellings fail benign aliases. Retain architecture contract with AST/modulegraph or built boundary assertion; no orphanbasedcut.
3. SpeedInsights root/wrapper source check does not actually count rootinstances, onlywrappercomponent occurrence; unrelated aliases falsefail. Retain singleungatedsanitized delivery contract; repair structural/renderedboundary. No current equivalent input-complete executing layout keeper was demonstrated.

Reject broader consolidation: PostHog stalecontext cases have genuinely different promise settlement ordering; SDKfailed vs initfailed Sentry cases differ; actualframeprimitive vs injectedSentryframes cannot substitute; sessionreplay.name and automaticproperties are separate SDK callbacks; routegroupnegative routine-private is not in SpeedInsights fixtures; previeworigin/port independent of publichostmapping; published privacy text is independent disclosure, not arbitrary private source spelling.

## Reviewable artifacts / main verification

Prefix `/tmp/test-audit-telemetry44`: ledger.md/json, candidates.json, manifest.json, controls.json (8recipes), transfer.diff,cut.diff; complete sevenfile snapshots in -before/,-transfer/,-cut/. Exact original assertions/fixtures outside C1 keeper remain byte-identical; same7declaration inventory44→44→41. No repository-writing driver supplied until main accepts proofs. No blanket cutrecommendation or quota guarantee. Main must inspect allcandidate unions, baseline+transfer,serialactualsourcecontrols restoring bytes,cut+focused and campaign coverage <=2pp.

From task root, use same native focused command in each phase:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/analytics-runtime.test.ts tests/analytics-runtime-environment.test.ts tests/sentry-client-runtime.test.ts tests/instrumentation-client.test.ts tests/app-performance-telemetry.test.ts tests/speed-insights-integration.test.ts tests/customerio-tracking.test.ts
```

Selected controls use this runner with anchored `--test-name-pattern` and the exact keeper titles in controlsJSON. Accept exactselected1 intendedassertionred, not import/setup/timeouts. No current baseline/fault outcome is claimed. Static generation/parse and declaration reconciliation only.
