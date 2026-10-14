# Final239 local coverage attribution

Read-only comparison of frozen final181 and final239 artifacts. No runner, mutation, hash, source, or test operation was performed here; the working tree can contain concurrent mutation work and was not used as proof.

## Inputs

- final181: `/tmp/test-audit-retirement-final181-proof/coverage-{summary,final}.json`
- final239: `/tmp/test-audit-retirement-final239-proof/coverage-{summary,final}.json`
- baseline comparisons: `/tmp/test-audit-retirement-final181-comparison.json`, `/tmp/test-audit-retirement-final239-comparison.json`
- prior attribution: `/tmp/test-audit-final172-local-diagnostic.md`, `/tmp/test-audit-final181-local-diagnostic.md`

The supplied frozen-run receipt reports 11,766 tests: 11,725 pass, 26 fail, 15 skip, 0 cancel, across 1,095 files. The comparison retains the same sorted 26 baseline failures. This report does not treat the raw-per-file check as passed: its baseline-to-final239 flag is false.

Final239 global map is 69.80% lines/statements (307,781/440,890), 83.22% functions (20,866/25,071), 81.54% branches (69,196/84,856). Versus baseline, global deltas are +0.0189pp lines/statements, +0.1508pp functions, -0.0017pp branches; conservative original-denominator deltas are -0.8872pp, -1.1659pp, -0.7897pp respectively. Both stated 2pp gates are true in the comparison.

## New raw per-path decreases relative to final181

Only two same-path metric declines exceed 2pp when comparing final181 directly to frozen final239:

| Path / metric | final181 | final239 | Attribution | Possible live gap |
|---|---:|---:|---|---|
| `src/lib/gated-preview/gate.ts` branches | 19/21, 90.47% | 14/16, 87.50% | Source removal. Final181 maps covered `shouldRenderGatedExample` at old :69 (6 calls) plus its five covered branch entries. Final239 contains only `resolveGatedPageMode` (:23, 7 calls); it deletes the obsolete two-valued predicate and its `loadAuthenticatedAppPageTier` alias. The active pages now use `resolveGatedPageMode`: `src/app/routine/page.tsx:300`, `anwendung/page.tsx:308`, `chat/page.tsx:30,37`. | No uncovered surviving source branch: all removed branch denominator/hits belong to removed source. This is a real loss of covered retired code, not a source-map getter artifact. |
| `src/lib/auth/free-registration.ts` functions | 30/36, 83.33% | 29/36, 80.55% | Only the generated line-1 export getter for `buildAddressRateLimitKey` changed 8 calls -> 0. The real function at :253 remains executed 52 -> 50 times. The direct alias unit cases were folded into the surviving `requestFreeRegistrationLink` flow in `tests/free-registration-contract.test.ts:322-351`, which checks the actual rate-limit identifier for plus and Gmail aliases while preserving sent address/no lead rewrite. | No real function became uncovered. All source functions remain hit, including live `resolveFreeRegistrationConfirmContext` (:143, 54 -> 51) and `resolveFreeRegistrationBind` (:309, 19 -> 16); production confirm route invokes both at `src/app/auth/confirm/route.ts:252,307`. |

## Existing attribution remains unchanged

The final172 import/module-evaluation losses stay present in baseline-to-final239 diagnostics but are not new after final181:

- `run-shadow-agent.ts`, `model-client.ts`, and `openai/chat.ts` remain legacy Compare eager-import/module-initialization losses. Prior map review established that their real factories, stream function and runner had zero original-function calls before removal of the adapter graph.
- `tool-loop-variants.ts` remains repaired since final181: `resolveAgentCompareToolLoopVariant` receives direct calls including the nullish fallback. No new >2pp final181-to-final239 loss is present there.
- Earlier source removals (loading timeline, field-test token) remain baseline-to-final diagnostics with the prior documented attribution; they did not change in this interval.

## Verdict and limits

The new two raw flags are attributable to (1) deleted covered gate code and (2) generated export-getter execution after a direct-helper assertion was moved to an actual request flow. I found no new surviving live consumer execution that changed from covered to uncovered between final181 and frozen final239.

This does not claim legacy production default model paths are covered: Compare's dynamic Classic/Tool Loop runners and their OpenAI factories remain callable but are not executed by the native suite, as recorded in the earlier diagnostics. PR 634 and current concurrent mutation source are deliberately excluded; frozen final239 source/test hashes are the supplied controlling pre-control evidence.