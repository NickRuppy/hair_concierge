# Stage-3 gateway leaves — second-pass evidence

Read-only at `21e0e41f`; no runner, provider/network, DB, environment operation, mutation, or repository edit. Owned supplemental sites only: three AST declaration sites in `tests/personal-plan-stage3-gateway.test.ts` (lines 76, 339, 452).

## Execution path and surrounding evidence

`Stage3ProductsGatewayError` is a typed Error carrier in `src/lib/personal-plan/products/gateway.ts:18-46`. Its constructor assigns only the TypeScript-declared arguments, calls `super(message)`, and sets the fixed name. Production constructors use `temporarily_unavailable` at the HTTP gateway (`http-gateway.ts:112,140,198`), flow (`stage3-products-flow.tsx:1622+`) and plan-start fallback (`plan-start-flow.tsx:671`). Existing higher-value keepers execute the HTTP/consumer boundary: gateway tests at lines 88-109 preserve stale-refined mapping; lines 169-189 preserve malformed revision-conflict fail-closed conversion; lines 191-240 preserve status/Retry-After. Flow/resume tests inject a real `Stage3ProductsGatewayError` and observe recovery behavior (`tests/personal-plan-stage3-flow.test.tsx:2735+`, `tests/personal-plan-start-resume.test.tsx:365-371,801-828`). The two snapshot codes are type members but have no current Stage-3 constructor/caller outside the echo test; separate persistence decoding covers the actual unsupported-snapshot contract (`tests/personal-plan/persistence/contracts.test.ts:86-96`) and routine staging covers `snapshot_too_large` result parsing (`routine-proposal-stager.test.ts:143-146`).

Fixture gateway is explicitly a Labs-only adapter (`fixture-gateway.ts:161-165`), instantiated by Labs clients (`src/app/labs/personal-plan/stage-3/lab-client.tsx:28`, `personal-plan-stage-1-2/journey-client.tsx:22`, `feinschliff-journey/journey-client.tsx:83`). Its optional `now` injection exists at `fixture-gateway.ts:119-130,189-193` and stamps a mutation at `:269-289`. Targeted search found no non-test `createFixtureStage3Gateway({ ... now: ... })` caller. Labs readers use default wall-clock behavior; their access control is independently covered by `tests/personal-plan-stage3-release.test.ts:181-206` and browser recovery preview by `tests/personal-plan-start.spec.ts:612-650`.

`classifyStage3DesiredState` is called on the real server authority mutation path (`production-persistence-gateway.ts:1159-1173`) and client recovery path (`stage3-products-flow.tsx:2598-2619`). The helper has distinct completed, reopen-capture, single/batched decision, mismatch and missing paths (`recovery-desired-state.ts:8-99`). The stronger pending-recovery test at `tests/personal-plan/products/pending-recovery.test.ts:162-198` executes persisted intent decode plus replacement-fingerprint mismatch to `different`; it does **not** execute this declaration's exact reopen-category `satisfied` and completed inputs. Existing `tests/personal-plan-stage3-contracts.test.ts:241-261` covers three distinct replacement classifications.

CI: `package.json:49` includes the file in `test:node`; `.github/workflows/ci.yml:158` runs it. Relevant history: `9bc8a49f` durable Stage-3 recovery; `12619247` initial five-stage journey; `e36187f9/a7282c43` reconciliation preview; later `f7afb35c` bootstrap/replay repair.

## Exact dispositions

| Site | Mark | Actual observation / keeper or cleanup |
|---|---|---|
| `personal-plan-stage3-gateway.test.ts:76` “production product failures share the frozen unavailable and snapshot codes” | **D** | Only echoes `new Error(code).name/code` for three literals. It neither reaches HTTP parsing, recovery UI, persistence decoding, nor a Labs route. Constructor behavior for the live temporary-unavailable path is exercised by the named HTTP and flow/resume keepers above; snapshot literals are not live Stage-3 constructor outputs. **Source/support cleanup unlocked:** remove this declaration; no source class cleanup follows from deleting only the test. |
| `personal-plan-stage3-gateway.test.ts:339` “desired-state classification recognises an already-open category and completed draft” | **R / held** | Directly observes the reopen mutation's two precise outcomes: active draft whose cursor already targets the category => `satisfied`, same draft completed => `completed`. The closest actual recovery keeper tests a persisted replacement decision changing from one fact fingerprint to another => `different` (`pending-recovery.test.ts:162-198`); it does not observe either input. Moving assertions to an adjacent direct-helper declaration would only regroup the same boundary. No transfer/cut supported. |
| `personal-plan-stage3-gateway.test.ts:452` “successful mutations stamp updatedAt from the injected clock” | **D, conditional coupled cleanup** | It only proves a fixture test seam: an option callback returns `created` then `mutated`, and fixture mutation echoes `mutated`. No Labs caller supplies `now`; all real Labs use the default. **Coupled cleanup unlocked if D is applied:** remove `FixtureStage3GatewayOptions.now` and local `const now = options.now ?? ...` in `fixture-gateway.ts:119-193`; use the default wall-clock expression at its internal state-machine timestamps (`:216,222,276,299,320,327,451`); remove all same-file test setup `now: () => now` arguments/helper. This is safe only as one change set because those test-only call sites otherwise no longer type-check. No production or Labs support deletion is implied. |

Result: **2 D (76, 452), 1 R-held (339), 0 F/C**. The two deletions are independent of the temporary middleware runner. No broader candidate file was audited.

Native evidence commands (not run as test commands):
```sh
rg -n -C 7 'Stage3ProductsGatewayError|classifyStage3DesiredState|updatedAt|now\(' src/lib/personal-plan/products tests/personal-plan-stage3-gateway.test.ts
rg -n -U 'createFixtureStage3Gateway\(\{[\s\S]{0,240}now\s*:' src tests
rg -n 'test:node|personal-plan-stage3' package.json .github/workflows/ci.yml
git log --oneline --follow -- tests/personal-plan-stage3-gateway.test.ts
```


## Main cutover decision

Apply only the two D declarations together with the unused fixture clock option cleanup. Keep desired-state classification: the proposed direct-helper move has no stronger boundary and receives zero quota credit. Main verified every current constructor call and clock injection; only this test file injects the fixture clock, and remaining fixture/flow assertions do not assert its timestamps. Use wall-clock expressions internally, preserving default Labs behavior. No production HTTP/persistence or user-facing behavior changes. This is a small, fully bounded seam cleanup under the invoked skill; final whole-branch counterpart review covers it rather than another standalone plan review. Run gateway and actual flow suites before/after; retain all error conversion, CAS, replay and semantic recovery tests. Mutation of the live HTTP error carrier code must still fail a retained conversion keeper; restore byte hash and green. Global original coverage/failure gates remain mandatory. No publication authorized.
