# Telemetry preservation review — revised C1 / D1 only

**Verdict: CONDITIONAL PASS for C1 and D1; REJECT removal of C2 / RETAIN.** The author and main operator accepted the C2 finding. The revised proposal is 44 → 44 → 42, with one C and one D; all three held F cases remain unchanged. This is an independent static preservation review of these candidates, not approval of every one of the author's 44 classifications.

Review root: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Repository remained read-only. No runner, compiler, source mutation, provider, environment or database operation occurred. Only these two independent reports were written under `/tmp`.

## C1 — conditional PASS

Donor `tests/analytics-runtime.test.ts:22–36` pushes 1, 2, 3 into the actual FIFO at limit 2 and asserts drain `[2,3]` and one warning. Keeper `tests/sentry-client-runtime.test.ts:162–183` already starts the actual runtime, sends three existing unhandled-rejection events at queue limit 2, resolves its deferred client, and asserts two delivered exceptions in the surviving order and both mechanisms. The transfer adds only the count of recorded warnings at prospective line 175. It adds no input, dispatched event, test row or production operation.

The input equivalence is limited but sufficient: `src/lib/analytics/runtime/bounded-fifo.ts:11–28` reads length and limit, shifts the oldest item on overflow, warns, and pushes the new item. It never reads item type or fields. Both inputs therefore exercise lengths 0, 1, 2, then the same overflow and drain. The label changes only unasserted warning text. Donor `[2,3]` maps to keeper's second exception and third synthesized fallback exception; the existing capture count, ordered message assertions, and transferred warning count preserve its entire assertion union. Neither donor nor keeper proves an additional second drain is empty; no such claim is credited.

This is actual owner execution through injected external boundaries. `FakeEventSource` at test lines 13–33 delivers registered listeners; it does not implement overflow. Harness lines 53–97 supplies the deferred loader and records warnings/client calls. `src/lib/observability/sentry-client-runtime.ts:42–46` creates the shared FIFO; lines 117–128 normalize rejections and enqueue; lines 102–107 push while the client is absent. First release starts one deferred load (lines 74–100); all three synchronous events reach the real queue before resolution. Successful initialization then drains and dispatches (lines 80–85, 61–71). No other warning path is activated by this successful harness, so exactly one recorded warning is attributable to overflow. Client method invocation is demonstrated; vendor network receipt is not claimed or required by the donor.

Required actual controls, currently descriptors only:

- `C1-drop-newest`: shared `items.shift()` → `items.pop()`. Two captures and one warning remain; first delivered message becomes `first` rather than `second`. The keeper must fail its existing first-message assertion, preserving the donor's oldest-drop/order contract.
- `C1-no-warning`: replace the actual optional warning call with `void warn`. Delivery count remains two; the transferred assertion must fail with 0 versus 1 and message `one overflow warning`. A setup/import/timeout failure earns no credit.

Retaining the direct numeric fixture would preserve a separate unit-level observation, but no distinct operative predicate or asserted contract was found that requires it. Removing the entire callback and its now-unused import is supported only after these proof gates.

## C2 — REJECT deletion; retain unchanged

The original donor at `tests/analytics-runtime.test.ts:273–295` calls `tracker.page("/quiz")` with properties omitted, then verifies delivered `{}` within its complete page/identify/track/reset FIFO assertion. The proposed keeper at `tests/customerio-tracking.test.ts:30–65` supplies `{ referrer: undefined }` to the public page wrapper. These reach different branches of `cleanCustomerIoProperties`, `src/lib/customerio-tracking.ts:63–69`: the donor takes `if (!properties) return {}`, while the keeper executes `Object.entries(...).filter(...)`.

Equal present-day output is not readset equivalence. The live caller `src/providers/customerio-provider.tsx:21` invokes `trackCustomerIoPage(url)` with omitted properties, so the donor protects a supported delivery path. A hypothetical change of only the absent-properties return to `{ unexpected: "bad" }` would fail the donor's delivered payload assertion but survive the proposed keeper. The disabled public-helper test at `tests/customerio-tracking.test.ts:67–77` does not close this gap: it verifies rejection/no delivery, not the admitted payload. Tracker cleanup occurs before the admission check (`customerio-tracking.ts:183–189`, `157–161`). The remaining page-call search found no other omitted-properties delivery assertion.

This counterexample was reasoned from source; it was not applied or run. Common-path dispatch faults cannot disprove it. Do not add a new call or alter keeper inputs to manufacture equivalence under this cut's constraints. The revised phases retain the whole donor byte-for-byte, body SHA-256 `6b059605f529ca54bbf54b45d391633156dcae0c42fee5d1f08d9cf501d04aee`; the public-helper file is entirely unchanged. No C2 count credit or fault descriptor remains.

## D1 — conditional PASS

Donor `tests/app-performance-telemetry.test.ts:131–143` calls the actual event creator once with valid `routine`, `proxy_access`, `success`, duration 1 and invalid `request-correlation-id`, expecting `/correlationId/`. Keeper lines 37–71 already includes a third independent call with valid `routine`, `proxy_auth`, `success`, duration 1 and invalid `lead_123@example.com`, expecting the same error.

The owner `src/lib/observability/app-performance.ts:1–25` admits both operation enum values. Its creator at lines 71–97 checks route, operation and outcome first (80–82), then calls the same correlation validator (83), before later duration/region/trip processing. `assertCorrelationId` lines 62–64 uses the single UUID regex at 51–52. Both strings fail this same predicate, with no intervening branch based on their spelling or valid operation. The first two keeper calls deliberately fail different enum guards, but the third has valid enums and independently reaches the correlation guard.

The donor title overstates its proof: its body does not test generation, randomness, or a UUID-shaped wrong-version identifier. No such contract may be credited as lost or preserved. The existing positive event case at lines 15–34 uses a valid v4 literal. The current production caller `src/proxy.ts:170–212` creates correlation IDs with `crypto.randomUUID` and calls the helper; this establishes live use, not a generation test in the donor.

Required control `D1-accept-invalid-correlation` bypasses only the actual correlation check. The first two keeper assertions still pass, and the third must fail with missing expected exception. An unrelated enum failure or alternate exception is insufficient. No keeper assertion, input or call changes in this D cut.

## Revision integrity, held cases and scope

Independent byte/hash validation passed against the revised artifacts: all 31 manifest readset hashes match live files; all 21 snapshots match declared hashes; all seven live test files equal the before snapshots. Starting from before bytes, substituting only C1's keeper body reconstructs transfer exactly. Removing only C1 and D1 donor bodies, associated blank lines, and the unused FIFO import reconstructs cut exactly. Every supplied ledger body/hash matches the before source. This verifies no additional call/input/row packing or collateral edits in the proposed phase changes. Counts 44/44/42 are reconciled manifest/declaration inventory, not independently executed tests or a new compiler parse.

All three F callbacks are identical across phases: environment source-position gate, dynamic Sentry import spelling check, and root Speed Insights component check. Their source-based false-positive/false-negative limitations remain; no repair, deletion or reduction credit is assigned. In particular a removed environment early return can evade position-only assertions; local aliases can break spelling checks; the Speed Insights check does not actually count root instances.

Human review covered complete analytics-runtime, sentry-client-runtime, customerio-tracking and app-performance test files and their relevant support; the complete environment test and held-F slices in the other two files; complete FIFO, Sentry runtime, Customer.io tracking/runtime and app-performance operative owners; current provider, instrumentation and proxy caller slices. History read included #454's buffered Sentry test/owner rationale and #388's original app-performance donor. The package Node test route and CI invocation were checked. The server-only test register stubs the marker, not these owners. No SDK implementation claim is needed for these C1/D1 contracts; installed Customer.io export declarations alone do not establish vendor delivery. Author hashes for other files do not enlarge this independent human-read scope.

Pinned revised layer-plan SHA-256: `3175adcdae904c462a0e3d69ab14eb9a58f66c387134001a5a634d0b4af187c2`.
Pinned manifest: `c6956d0bc89dff115fd25e43c2c1ad24bf5388f582fb1f10e5810db7ad49cc54`.
Pinned controls: `6a1bdc1269bbc503c2735aa077992d38c2abfda35f82138f76e52bf655c5d508`.
Exact artifact, source and phase pins plus check results are in `/tmp/test-audit-telemetry44-independent-static.json`.

Remaining acceptance work belongs to the main operator: clean native baseline and transfer proof, serial source controls failing the intended selected assertions with restoration verified, cut/native proof and applicable campaign coverage limits. These static verdicts do not assert any fault is red, any native suite is green, or broader campaign readiness.
