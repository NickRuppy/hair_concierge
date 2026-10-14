# Stage-3 leaf integration preservation check

Read-only check after the two accepted deletions. I inspected the complete diff for the two changed files, the retained line-339 declaration, the source callers, and supplied control receipts. No runner, provider, database, environment, or mutation action was performed in this pass.

## Scope and exact result

The diff removes exactly two test declarations from `tests/personal-plan-stage3-gateway.test.ts` and removes the coupled fixture-only `now?: () => string` option from `src/lib/personal-plan/products/fixture-gateway.ts:119`. The remaining gateway AST inventory is reported as 209 (from 207 under the campaign parser); the executed test count changes 106 -> 104 exactly because the two removed declarations are absent. `tests.tap` reports 106/106 before and 104/104 after, with the retained “desired-state classification recognises an already-open category and completed draft” passing in both (before #93, after #92).

### Deleted error echo

The removed declaration at former line 76 only constructed `Stage3ProductsGatewayError` for three literals and read `.name/.code`. It did not reach a route or recover from a failure. There is no standalone name contract: consumers use `instanceof Stage3ProductsGatewayError` and `.code`, for example the retained HTTP keeper (`tests/personal-plan-stage3-gateway.test.ts:74-95`).

The supplied focused control is meaningful for the actual owner. Its command targets that HTTP keeper. Before: 1/1 pass. Its intentional red changed the real constructor so the stale-refined error no longer kept its code; the keeper then failed because its predicate received a `Stage3ProductsGatewayError: stale_refined_source` whose `.code` was no longer `stale_refined_source` (`red.log`). Restoring the source byte hash `bff434c8…690b1f59` returned 1/1 pass. That proves the retained owner detects the type/code failure which the removed echo only restated.

### Deleted fixture-clock seam

The diff removes all five same-file `now: () => now` / injected-clock setups (helper plus direct fixture construction) and the sole assertion of the synthetic `mutated` timestamp. Targeted search finds no remaining `createFixtureStage3Gateway({ … now: … })` consumer outside or inside the worktree; the option is gone from its exported type. The fixture still stamps each state transition with `new Date().toISOString()` at its existing sites: stale invalidation (211-222), creation (223), mutate (269-289), explicit invalidation (296-305), completion portfolio/draft (323-349), and decision mutation (452-460). This is the same default behavior the old `options.now ?? (() => new Date().toISOString())` supplied to every non-test caller.

Actual Labs use the default fixture, including `src/app/labs/personal-plan/stage-3/lab-client.tsx:28`, the Stage1-2 journey client:22, and Feinschliff journey:83. Their development/preview/CI access boundary remains independently retained in `tests/personal-plan-stage3-release.test.ts:181-206`; browser recovery preview remains in `tests/personal-plan-start.spec.ts:612-650`. Thus there is no lost public clock, route, storage, or recovery contract.

### Retained desired-state leaf

The former line 339 is now `tests/personal-plan-stage3-gateway.test.ts:325-344` and is unchanged: an active already-open `reopen_capture_category` yields `satisfied`; the same draft with status `completed` yields `completed`. It remains a distinct direct-helper assertion. It maps to the production authority path (`src/lib/personal-plan/products/production-persistence-gateway.ts:1159-1173`) and mutation recovery path (`src/components/personal-plan-products/stage3-products-flow.tsx:2598-2619`). The nearby pending-recovery test proves a different replacement-fingerprint `different` result, so it cannot replace these two inputs.

## Verdict

The applied change preserves meaningful owner coverage. There is no remaining test-only clock-option consumer, no standalone error-name contract, and no lost recovery classification proof. The retained line-339 declaration remains correctly held.

