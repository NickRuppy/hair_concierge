# Compare scenario-adapter transitive closure — read-only

## Newly orphaned by the deleted scenario adapter

* `src/lib/agent/compare/run-shadow-agent.ts:runShadowAgentComparison` and alias `runClassicAgentComparison` at `:363`: its sole purpose is `AgentCompareScenario` -> `createTestSession` -> `upsertHairProfile` -> `runShadowAgentComparisonForUser`. Search finds only plan text plus deleted scenario runner references. Keep `runClassicAgentComparisonForUser`: Lab route dynamically loads it at `src/app/api/labs/agent-compare/route.ts:53`. Future mutation: delete scenario wrapper, alias, `AgentCompareScenario`, `createTestSession`, and `upsertHairProfile` imports if exclusively local.

* `src/lib/agent/compare/run-agentic-tool-loop.ts:runToolLoopComparison` at `:557`: same scenario-created test-user wrapper, delegating to `runToolLoopComparisonForUser` at `:531`; no live caller besides removed scenario lane/plans. Keep `runToolLoopComparisonForUser` (Lab dynamic load at route `:57`) and `runToolLoopTurnsForUser`. Future mutation: delete wrapper plus now-exclusive `AgentCompareScenario`, `createTestSession`, and `upsertHairProfile` imports.

## Retained modules and helpers

Do not delete either module: both `*ForUser` runners retain callable Lab/operator contracts. Keep shared normalizers, `loadRuntime`, `projectFullCareBalanceContextForCompare`, tool factories and default variant resolution: the Lab request may omit a variant and still needs default behavior. Keep comparison result types, golden fixtures, Lab routes, and dynamic imports.

## History and validation

Lab route imports ForUser runners dynamically at `src/app/api/labs/agent-compare/route.ts:51-68`. Historical plans document scenario wrappers but are not runtime callers. Relevant history: Compare Lab `03669a9c`, tool-loop migration `4383accd`, AgentV2 compare `148f7c09`. This is source closure only, no additional test-count credit. Future validation: `node --import ./tests/server-only-register.cjs --import tsx --test tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts`.
