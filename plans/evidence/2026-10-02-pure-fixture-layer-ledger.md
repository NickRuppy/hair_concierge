# Current pure-fixture callback challenge

Read-only checkout: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; original campaign base `21e0e41f`. Parent is sole repository writer/operator. This lane created only `/tmp` navigation/report files and read source/history. No tests, compiler, owner execution, source mutation, browser, provider, DB, env-file read or counterpart invocation occurred. Current baseline failures remain untouched.

## Verdict

**5 high-confidence D declarations and 1 conditional C declaration.** The five D sites are a coherent obsolete mock-router block in `tests/e2e-smoke.spec.ts`; the C site is one analytics fixture self-comparison whose meaningful imported-type acceptance can be carried into the existing actual serializer keeper. No grouping-only or table-row credit. Six is a proposal count, not a verified campaign removal increment.

The C is separable from the five D sites: take the five-only batch if the analytics transfer would expand current editing scope. No need to invent an actual router replacement test to justify dropping the five local-literal assertions.

## Navigation denominator and limits

`/tmp/test-audit-pure-fixture-navigation.cjs` parsed current `tests/**` test/spec files without executing them and found **11,613 AST declaration sites**, matching the parent inventory. `/tmp/test-audit-pure-fixture-navigation.json` records runtime imported bindings, dynamic import/require strings, recursive local variable/function dependencies, calls, selected globals and side-effect imports. The walk tracks block/function lexical declarations, follows local initializer/helper chains, omits erased type nodes from runtime dependency discovery, and conservatively records imports through relative test-support files. It does not run a typechecker, fully resolve every module export, model hooks/dynamic property writes, or prove assertion dataflow. An imported owner anywhere in the callback/helper graph excludes a test from the strict zero-import shortlist even when its result might be unused. Thus this is deliberately conservative navigation, not proof that all remaining callbacks observe an owner.

226 sites in 41 files had no discovered non-runner runtime import/side-effect dependency. 215 of those had direct browser/page/context/request interactions and were excluded from this pure-fixture lane as actual delivery tests. The remaining **11 callback bodies** were read completely, with relevant local fixtures/helpers and the imports/type contracts they reference. `/tmp/test-audit-pure-fixture-shortlist.json` records those 11. Final marks within this bounded shortlist: **5 D, 1 C, 5 R**. Three R are already-reviewed checker support and are not new proposals.

Supplemental full test-file reads: `e2e-smoke.spec.ts` (10 declarations), `personal-plan-stage3-analytics.test.ts` (7), and `ogx-search-identities-catalog-repair-artifact.test.ts` (2). These are context reads, not an all-R full-owner audit of their other tests. The remaining large files were read at exact candidate, fixture and relevant sibling bodies only. No all-suite semantic-audit claim follows from the 11,613-site AST count.

## D1–D5: router callbacks disconnected from every owner

File imports only `{test, expect}` from `@playwright/test`. The enclosing Phase 2 describe has no fixture, hook, page, script, source read, dynamic import, config read, dependency contract or production value. Every claimed router artifact is constructed locally inside its callback. Removing or changing all current router/types/question implementation cannot affect these assertions. `tsconfig.json` does include test TS files, but the first test's aliases are declared locally, so compiling it checks only the locally invented type.

| ID / exact site | What the complete callback actually observes | Failure it can detect; why no product proof is lost |
|---|---|---|
| D1 `tests/e2e-smoke.spec.ts:142` — `4. Router types compile correctly` | Local RetrievalMode and ResponseMode aliases, local RouterDecision structural type, and a local object with retrieval_mode `agent_engine`, response_mode `answer_direct`, confidence .85 and empty overrides. Four comparisons read that object. | It fails only if its own literal/locally declared type/assertion changes. It never imports `src/lib/types.ts` RouterDecision. Current real RetrievalMode additionally admits `agentic_tool_loop` and `agent_v2_responses`, already demonstrating the local list can drift silently. No keeper/transfer is needed for a local imitation of the type. |
| D2 `tests/e2e-smoke.spec.ts:175` — `5. Router constants are within expected ranges` | Local constants .72, 2, 2 and a local five-element slot array; comparisons against .5/1/1/5 and local length. | It can detect editing those test literals, not a real threshold/limit/slot change. `ROUTER_CONFIDENCE_THRESHOLD` and `ROUTER_MIN_SLOTS_PRODUCT` have no current production definition found under `src`; the five-slot list exists in `recommendation-engine/chat.ts` but is never referenced. No keeper/transfer needed. |
| D3 `tests/e2e-smoke.spec.ts:197` — `6. Clarification question templates are German and non-empty` | Five locally copied German question strings tested for length>10 and a broad umlaut/common-word regex. | It catches damaging copied fixture strings only. The live engine's `SLOT_QUESTIONS` already differs (`Beschreib mir` vs `Beschreib mir mal`, different product wording and special circumstances), while this test stays green. It provides no public prompt-byte/config guard. No keeper/transfer needed. |
| D4 `tests/e2e-smoke.spec.ts:215` — `7. Router policy rules — vague message triggers clarification (contract)` | Local object preassigns `needs_clarification:true`, confidence .55 and five null filters; callback counts its own null fields and compares those assigned literals. | No classification/router is invoked and no message input is submitted. It can detect editing its fixture true/.55/nulls; it cannot detect any production clarification regression. No keeper/transfer needed. |
| D5 `tests/e2e-smoke.spec.ts:246` — `8. Router policy rules — detailed message skips clarification (contract)` | Local object preassigns `needs_clarification:false`, confidence .92 and four non-null strings; callback counts those fields and compares assigned values. | No policy consumes these values. It tests local counting/literals, not recommendation-vs-clarification decisions. No keeper/transfer needed. |

### History, actual entry/callers, and retirement evidence

* `git log -S '4. Router types compile correctly'` identifies **1d32ff52** (`Phase 2: Intent router with confidence-aware clarification gating`, 2026-03-03). The original source snapshot already contains copied constants, questions and preassigned clarification decisions; this was never a runtime owner test. Original titles had different numbering because a separate SSE shape test later disappeared.
* **dccff6f7** (`Refactor chat runtime away from legacy RAG`, 2026-06-01) deleted `src/lib/rag/router.ts` (319 lines) and `src/lib/rag/clarification.ts` (103), alongside retired orchestration. The current tree contains neither path. This is concrete retirement corroboration, not inference from an internal name.
* Current `src/lib/agent-v2/production/product-output.ts` was fully read (210 lines): `buildAgentV2RouterDecision` derives response mode from terminal answer/visible failure, emits `agent_v2_responses`, and `buildAgentV2Classification` derives needs_clarification from that decision. Caller `production/chat-pipeline.ts:1561` and real API invocation at `src/app/api/chat/route.ts:318` were read at relevant call sites. Those large callers were not fully audited here.
* Current `src/lib/recommendation-engine/chat.ts` was fully read (446 lines). It owns live question construction and category-specific missing-profile questions, rather than the copied local templates. Its imported runtime/adapters were not traversed for this D decision, because none of the five callbacks references the module at all. No current source deletion is unlocked.
* No current production owner is being retired by these cuts. The obsolete test-only artifacts are all callback-local; deleting the empty Phase 2 describe removes five real declarations and all copied constants/types/questions/objects. Leave the five Core user-flow browser declarations intact, and retain the file's test/expect imports used by them.
* The previously audited assertion-free QA/manual probes are not part of this recommendation. These five have assertions; their complete disconnection from production is the new evidence.

### Risk and native validation

There is no independent meaningful product contract in these five callbacks to transfer or deliberately break in production. A fixture mutation would only prove the tautology and should not count as a preservation control. There is no source-under-test coverage claim to preserve, and no predicted numerical coverage delta is claimed before the canonical gate.

These five are native **Playwright** declarations and inherit `@ci` from their enclosing describe. `.github/workflows/ci.yml:311` runs the `@ci` smoke cohort with a real server only when scope and live-secret guards allow it; they are not part of `test:node`. `playwright.config.ts` loads `.env.local`, so do not invoke that config in this no-env lane. Parent can create a new minimal `/tmp` config following the already-read `/tmp/test-audit-invoice-playwright.config.cjs` pattern, changing testMatch to `e2e-smoke.spec.ts`, with no env loading/server/browser fixtures. Then the pre-cut focused native invocation is:

```sh
node node_modules/@playwright/test/cli.js test --config=/tmp/test-audit-pure-fixture-playwright.config.cjs --project=chromium --grep 'Phase 2'
```

That config is **not created by this lane**. These selected callbacks request no browser/page and need no server/provider. After deletion, use the same native list/discovery path to confirm exactly the five retained Core flow declarations remain; run the actual Core browser cohort only within the parent's existing authorized environment/window. Preserve the campaign's normal typecheck/diff/native inventory/coverage gates. No rerun evidence is supplied here.

## C1: preserve the imported analytics type at the actual serializer

**Donor:** `tests/personal-plan-stage3-analytics.test.ts:100`, `Stage 3 handoff outcomes keep pending products and gaps non-blocking`.

Complete body declares:

```ts
const outcomes: AppEventMap["personal_plan_stage3_handoff"]["outcome"][] = [
  "ready_for_routine", "ready_with_pending", "ready_with_gap",
]
assert.deepEqual(outcomes, ["ready_for_routine", "ready_with_pending", "ready_with_gap"])
```

The runtime assertion is literal-versus-literal, but the imported `AppEventMap` annotation has a real compile-time compatibility contract: the three existing analytics outcomes must remain legal. `npm run typecheck` runs `tsc --noEmit`, includes tests, and runs in CI `quality-static` (:138). Unlike D1, this type is imported from production. **Do not direct-D the declaration and lose the two extra outcome witnesses.** The title also overclaims: the callback never attempts a handoff or checks blocking.

**Existing primary keeper:** same file **:110**, `Stage 3 structural analytics maps only its bounded privacy-safe contract`. It calls actual `postHogDestination.track`, which calls real `toPostHogPayload` and `cleanAnalyticsPayload`, and captures only the external runtime's `.capture` port. The port does not supply mapping/allowlisting. This keeper already sends `ready_for_routine` in its verbose-event loop and independently asserts the exact outgoing event/property array.

**Exact transfer before deletion:** Inside that existing keeper's capture try block, after the existing verbose-event loop, add two typed real calls:

```ts
postHogDestination.track("personal_plan_stage3_handoff", { outcome: "ready_with_pending" })
postHogDestination.track("personal_plan_stage3_handoff", { outcome: "ready_with_gap" })
```

Append these two literal expected captures to the existing `assert.deepEqual(calls, ...)` array:

```ts
["personal_plan_stage3_handoff", { outcome: "ready_with_pending" }],
["personal_plan_stage3_handoff", { outcome: "ready_with_gap" }],
```

Preserve every existing mapped event and forbidden-key assertion. The track generic `track<E extends AppEventName>(eventName:E,payload:AppEventMap[E])` keeps type acceptance of both added outcomes, while the existing ready_for_routine literal keeps the third. No `as` casts, expected-from-owner values, local behavior copier or new test declaration. This transfers a lower type-only contract into actual serializer delivery; it is not merely moving the tautological assertion or regrouping cases for quota. One declaration removed, two additional real execution cases; count those separately.

**Actual owner/call DAG and read scope:** Full 604-line `src/lib/analytics/destinations/posthog.ts`, full `stage3-analytics.ts`, `stage3-development-analytics.ts`, `track-app-event.ts` and runtime `posthog.ts` were read. `events.ts` type/declaration excerpts at :245 and :564 define the handoff payload. `stage3-products-flow.tsx:3364–3372` reads pending products/gaps and emits the three outcomes; the larger flow was read only at that call site. The default consent-aware baseline intentionally suppresses verbose events including handoff, while the Labs adapter calls real `trackAppEvent` and the route map permits PostHog. Therefore the keeper proves supported structural event serialization, **not production baseline emission, non-blocking finalization, or live SDK/provider delivery**. All flow/persistence/null/security cases remain out of scope.

**History:** `git log -S` identifies **12619247**, `feat(personal-plan): integrate complete five-stage journey (#344)`, as introduction of this donor. It belongs to the typed Stage 3 event contract rather than the retired router. Latest file history includes **9a81a7b8** thumbnail analytics; this proposal preserves its baseline thumbnail events unchanged.

**Actual-owner mutation controls for parent:** In the real `toPostHogPayload` handoff case, replacing `return { outcome: data.outcome }` with `return { outcome: "ready_for_routine" }` must fail on the newly appended pending/gap capture while the old ready-only mapping would have passed. A second selective regression, mapping `ready_with_gap` to `ready_with_pending` and leaving other outcomes untouched, must fail the final gap capture. Use the full unique case block as the anchor because other event cases contain the same return statement. Separately, under the normal typecheck gate, removing either non-default member from `PersonalPlanStage3HandoffOutcome` must reject the corresponding typed track call; runtime transpilation cannot prove that compile-time control. No mutations/typechecks ran in this lane.

**Cleanup:** Delete only donor declaration. `AppEventMap` import remains required by the primary keeper and other tests. No source export/seam/support file becomes unused. Native focused command, after the parent runner window ends:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage3-analytics.test.ts
```

Before/transfer-only/after native counts are 7 / 7 / 6 declarations for this file; do not credit the two additional calls as new declarations. Parent still owns typecheck, exact-restoration controls and canonical <=2pp coverage verification.

## Complete disposition of the other five shortlisted callbacks

| Site | Disposition and concrete distinction |
|---|---|
| `tests/agent-select-products-tool.spec.ts:3787`, `selectProducts tool only accepts engine-backed categories` | **R.** Earlier generic runtime-integration reasoning was inaccurate for this body: its assertions are literals, but it derives ToolParams from the actual createSelectProductsTool return signature and has `@ts-expect-error` witnesses rejecting routine and null. Widening actual `params.category` to ProductCategory makes those directives unused under the real CI typecheck. Actual category signature at source :3552 and contracts tuple/type were inspected. Keep this compile-time API restriction; do not call it runtime behavior. Full surrounding 3,800-line suite was not re-audited. History 3c396bd3 (#57). |
| `tests/discovery-runsheet.test.ts:508`, `verdict mapping covers every DiscoveryVerdictStatus` | **R.** Imported `Record<DiscoveryVerdictStatus,true>` and `Record<ScanVerdict,true>` enforce exhaustive production union membership; runtime assertions then connect those members to VERDICT_CASES that drive the adjacent actual runsheetVerdictFit/deriveBuckets test. Adding a new source union member requires extending the Record and then a real execution fixture. Complete candidate, VERDICT_CASES and adjacent owner-calling test body read; not the full runsheet subsystem. History 3a774a20 (#619). This is checker coverage, not a bare copied inventory. |
| `tests/ci-workflow-orchestration.test.ts:107`, `workflow job extraction respects top-level boundaries and the final job` | **R / prior disposition unchanged.** Complete helper and candidate fixtures guard the local parser used by live CI source assertions: nested fake job names, final job, trailing comments and exact top-level boundaries. A parser regression can make later gate tests inspect the wrong job. Prior `/tmp/test-audit-source-layer-next.md` and static ledger already justify it; no stronger new evidence to reopen. |
| `tests/ci-workflow-orchestration.test.ts:137`, `job dependencies support block declarations without crossing into later fields` | **R / prior disposition unchanged.** Block-needs parsing handles comments/blank lines and stops at runs-on. These inputs test the actual checker helper, which is then used to enforce CI dependencies. No deletion based on absence of a production import. |
| `tests/ogx-search-identities-catalog-repair-artifact.test.ts:46`, `escapeRegExp escapes every JavaScript regular-expression metacharacter` | **R.** The helper is test-local but supports the next guard's exact SQL/README identity matching; literal product lines include `+` and image fingerprints include `.`. The full two-test file was read. Its anchored RegExp round-trip detects unescaped metacharacters that could weaken the guarded repair artifact test. This is support-checker reliability, not a production self-copy. History b88268e0 (#368). Repair SQL execution/DB safety is not audited in this lane, and no artifact guard is cut. |

## Final accounting and unresolved limits

11,613 AST sites navigated; 226 zero non-runner runtime-import leads; 11 non-browser callback candidates completely read; **5D + 1C + 5R** within that shortlist. Five D need no contract transfer; one C requires exact serializer/type transfer and owner controls. No new assertion-free coverage-probe cuts, source/config/document blanket cuts, unknown provider behavior cuts or prior already-retired declarations included. Native execution, proposed control results, source coverage preservation and final integrated diff remain the parent's work after its active runner completes.
