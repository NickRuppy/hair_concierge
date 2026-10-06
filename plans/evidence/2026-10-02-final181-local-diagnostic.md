# Final181 local coverage diagnostic

Read-only comparison. No test, mutation, or edit was run.

## Inputs

- final172 map: /tmp/test-audit-retirement-final172-proof/coverage-final.json.
- final181 map: /tmp/test-audit-retirement-final181-proof/coverage-final.json, mtime 2026-10-02 13:14:54 Europe/Berlin.
- final181 comparison: /tmp/test-audit-retirement-final181-comparison.json, mtime 2026-10-02 13:15:51 Europe/Berlin.

The completed native run reports the same 26 baseline failures, 11,840 cases with 11,799 pass and 15 skip. Global coverage is 69.81 lines/statements, 83.23 functions, and 81.54 branches. This report does not independently rerun or validate those commands.

## Raw final172 -> final181 result

I compared statement, function, and branch hit maps for every path present in both final172 and final181. There is no surviving-path decrease greater than two percentage points.

The >2pp paths listed in final181-comparison.json are baseline-to-final diagnostics, chiefly the already-recorded legacy Compare import/module-evaluation losses. They are not new final172-to-final181 execution losses.

## Compare source changes

- src/lib/agent/compare/run-shadow-agent.ts remains uncovered as an executable runtime path in the full suite. The final181 denominator falls from 364 to 314 statements because the obsolete scenario wrapper and getRequiredCompareEnv closure were removed. Both had no surviving non-test caller after run-compare was retired. This is source removal with zero covered original source functions in final172; final181 therefore introduces no new lost execution.
- src/lib/agent/orchestrator/model-client.ts and src/lib/openai/chat.ts remain at zero original runtime calls, as documented in the final172 diagnostic. Their visible baseline-to-final decreases remain import/module-evaluation loss from retiring the eager run-compare import graph, not a new final181 change.
- src/lib/agent/compare/tool-loop-variants.ts improved: tests/agent-compare-runner.spec.ts now imports resolveAgentCompareToolLoopVariant and asserts undefined -> guidance_tool plus an explicit baseline input. The raw final181 map records two calls to the original resolver at lines 18-22, including the nullish fallback branch. This repairs the only live helper execution gap identified in final172.

## Runtime reachability and limits

The Classic Compare default remains dynamically reachable through src/app/api/labs/agent-compare/route.ts, which imports run-shadow-agent and calls runClassicAgentComparisonForUser. That function creates createOpenAIToolModelClient. Tool Loop dynamically imports model-client in run-agentic-tool-loop. The full native suite does not execute those real OpenAI/default-runner paths; no claim is made that they are covered.

No new test assertion contract was removed in final181. The deleted classic/scenario wrappers were private legacy support for deleted run-compare; the live variant fallback has direct source-level proof again.
