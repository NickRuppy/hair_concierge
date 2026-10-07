# Barrel-aware orphan-layer audit — 2026-10-02

**Scope:** read-only inspection in `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, current source and deployed baseline `3abfe00a`. No source/test edits or test execution. Existing 23 whole-source deletions and 13 previously recorded source-only follow-ups are deliberately excluded from the proposed count.

## Corrected graph method and raw output

`/tmp/test-audit-barrel-graph.json` is the raw graph result. It parses literal TS/TSX imports (alias and relative resolution) and marks as roots: all `src/app/**` framework files, all `scripts/**`, `apps/**`, and `packages/**` modules, root `instrumentation-client.ts`/instrumentation/config candidates, and verified literal targets for the variable dynamic billing and agent tool-loop imports. It deliberately **does not root `index.ts` or registry-like files merely by name**. The resulting graph is 1,914 source modules, 654 conservative roots, and 1,893 reachable modules.

The newly useful closure is `src/lib/agent/compare/run-compare.ts -> scenarios.ts`. Both are disconnected after removing barrel roots; more importantly, direct source inspection establishes that the currently reachable Compare Lab route duplicates their orchestration and dynamically imports the live individual runners instead.

Static graph limitations: literal imports cannot prove constructed module paths, external package imports, or human runbooks. Each deletion candidate below was therefore additionally searched across source, scripts, apps, packages, tests, docs, plans, and `3abfe00a`. The known variable dynamic tool-loop and payment paths were explicitly rooted. The graph's other unreachable results were manually screened rather than treated as deletion evidence.

## Deletion-ready whole closure (D)

### `src/lib/agent/compare/run-compare.ts` — delete whole module (222 LOC)

**Declaration ledger (8/8 D):**

| Line | declaration | D/C/R | evidence |
|---:|---|:---:|---|
| 15 | `normalizeCompareSystem` | D | only current consumer is the exclusive test at `tests/agent-v2-compare-runner.spec.ts:16`; the reachable route has its own private normalization at `src/app/api/labs/agent-compare/route.ts:101`. |
| 21 | `normalizeCompareRunResult` | D | private to this orphan module; reachable route duplicates it at `route.ts:107`. |
| 32 | `shouldSwapBlindedResults` | D | private to this orphan module; reachable route duplicates it at `route.ts:119`. |
| 42 | `formatBlindedVariantLabel` | D | private to this orphan module; reachable route duplicates it at `route.ts:129`. |
| 46 | `normalizeFailure` | D | private to this orphan module; reachable route has its own implementation at `route.ts:77`. |
| 59 | `normalizeTurns` | D | private to this orphan module; reachable route has its own implementation at `route.ts:91`. |
| 67 | `runCompareWithAdapters` | D | only current consumer is four exclusive tests below; the live dev-only route directly executes its own runner map at `route.ts:195-237`. |
| 195 | `runCompare` | D | no non-test import/call or string path; its only dependency on `scenarios.ts` is within this closure. |

AST source parse found 5 exported and 3 private function declarations, all within the removable file.

**Exclusive AST test declarations to delete (5):**

| File:line | exact title |
|---|---|
| `tests/agent-compare-runner.spec.ts:51` | `runCompareWithAdapters uses the override prompt for both systems` |
| `tests/agent-compare-runner.spec.ts:93` | `runCompareWithAdapters resolves omitted tool-loop variant to product evaluation` |
| `tests/agent-compare-runner.spec.ts:128` | `runCompareWithAdapters tolerates one-sided failures` |
| `tests/agent-compare-runner.spec.ts:170` | `runCompareWithAdapters can run Tool Loop against AgentV2 without Classic` |
| `tests/agent-v2-compare-runner.spec.ts:16` | `Compare Lab accepts agent_v2 system` |

`tests/agent-compare-runner.spec.ts` has 10 AST `test(...)` declarations and is **not** a whole-file deletion: its other six cover the still-reachable prompt packs/tool-loop variants. `tests/agent-v2-compare-runner.spec.ts` has 20, and only line 16 is exclusive.

### `src/lib/agent/compare/scenarios.ts` — delete with its only caller (669 LOC)

**Declaration ledger (1/1 D):** `AGENT_COMPARE_SCENARIOS` at line 3. Its sole source importer is the above `run-compare.ts`; no live route imports it. The current agent Compare Lab route relies on per-user snapshot data and dynamic runners, not this fixed scenario list.

**Exclusive AST test declarations to delete (2):**

| File:line | exact title |
|---|---|
| `tests/agent-compare-runner.spec.ts:280` | `compare scenarios include leave-in heat and relationship cases with required profile signals` |
| `tests/agent-compare-runner.spec.ts:316` | `compare scenarios include care balance golden eval coverage` |

**Exact removable test-declaration count: 7.** No mixed declaration is counted. Source deletion removes **891 LOC** across the two orphan modules.

**Why this is not an active-Lab retirement:** `src/app/api/labs/agent-compare/route.ts:51-69` dynamically loads `run-shadow-agent`, `run-agentic-tool-loop`, and AgentV2 directly; `route.ts:101-237` owns the currently used normalizing/blinding/running behavior. `tests/agent-compare-api.spec.ts:38-47` explicitly asserts the route must *not* statically import `run-compare`. The same separation exists in deployed `3abfe00a` (route lines 51-69 and 101-237). The closure was introduced with the older local comparison work, while `fa358862` (2026-07-31, “Switch AgentV2 default to GPT-5.6 Luna”) retained only a small edit to this now-disconnected module and confirms the newer route is the deployed path.

**Integration/validation risk:** remove only the seven named test declarations and the two source modules; retain `run-shadow-agent`, `run-agentic-tool-loop`, `tool-loop-variants`, prompt packs, types, and the API route. Check `rg` has no remaining imports of either deleted module and run the affected agent suite/typecheck in the integrating task. A concurrent modification already exists in `tests/agent-compare-runner.spec.ts`, so apply against its final integrated content rather than overwriting the file.

## Barrel forwarding result (no test-count credit)

### `src/lib/personal-plan/products/index.ts` — 10-line internal forwarding barrel

All ten statements (`index.ts:1-10`) are `export * from ...` forwarding declarations. There is no source/script/app/package import of the barrel; all production consumers import concrete product modules. Current consumers are only test imports:

- `tests/personal-plan-stage3-state-machine.test.ts:24` (36 AST test declarations)
- `tests/personal-plan-stage3-contracts.test.ts:15` (12)
- `tests/personal-plan-stage3-portfolio.test.ts:10` (10)

This satisfies the corrected “definition + barrel is not a runtime consumer” rule, but it is **source-only hygiene, not deletion-ready test pruning**: those broad state-machine/contract/portfolio suites prove live concrete exports and must remain. If desired, delete the barrel and redirect the three test imports to their direct modules; **D=10 forwarding declarations, C/R test declarations=58, removed tests=0**. It existed unchanged in `3abfe00a` and originated in `12619247` (complete five-stage journey). There is no public package/bin/config contract, but its low size and test import churn make it non-substantive for the 20% goal.

## Screened graph false positives — keep / excluded

| Graph lead | outcome | concrete keeper / risk |
|---|---|---|
| `src/lib/app-store/reconcile.ts` | R | `docs/ios-app-store-subscriptions.md:56-62` names it as the unscheduled manual reconciliation helper and specifies Apple Server API credentials. Its 4 tests prove signed-data re-verification/write safety. No route/cron is intentional operational availability, not dead code. |
| `src/lib/quiz/email-return-url.ts` | R | Earlier ledger already preserves Customer.io/email-return token recovery operator contract. |
| `src/lib/account-deletion/inventory.ts` | R | Inventory/source-of-truth migration and deletion contract; caller absence cannot retire it. |
| `src/lib/paypal/trial-plan-shape.ts` | R | Existing billing/launch preflight contract; do not remove dormant payment recovery/validation seams. |
| `src/lib/leave-in-research/care-direction-t20.ts` | excluded | Research material; task explicitly forbids normative research retirement. |
| `src/lib/routines/product-attachments.ts`, nine UI files, and the three quiz files | excluded | The prior 13 source-only follow-up ledger already accounts for these; no duplicate credit here. |

## Final count and limits

- **Deletion-ready test declarations: 7** (all exclusive, listed above).
- **Deletion-ready source: 2 modules / 891 LOC / 9 declarations** (8 functions plus one exported scenario constant).
- **Optional source-only barrel: 10 forwarding export declarations / 0 test declarations.**
- No test runner, provider, or repository file was changed.
