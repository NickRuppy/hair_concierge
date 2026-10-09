# Final172 local coverage diagnostic

Evidence read only; no test command was run here.

## Inputs and timing

- `/tmp/test-audit-retirement-final144-proof/coverage-final.json`, mtime 2026-10-02 12:03:11 Europe/Berlin.
- `/tmp/test-audit-retirement-final172-proof/coverage-final.json`, mtime 2026-10-02 12:36:24 Europe/Berlin.
- `/tmp/test-audit-retirement-final172-comparison.json`, mtime 2026-10-02 12:36:45 Europe/Berlin.
- The comparison's global final delta is +0.00525pp lines/statements, +0.14017pp functions, and -0.00349pp branches. Its conservative original-denominator delta is -0.87617pp lines, -1.15019pp functions, and -0.78208pp branches. This report assesses only the four newly flagged local files; the other fifteen attributed declines were not reassessed.

## What the maps actually show

| Source | final144 -> final172 | Execution interpretation |
|---|---|---|
| src/lib/agent/compare/run-shadow-agent.ts | 52/364 -> 0/364 lines/statements; 4/24 -> 0/1 functions; 6/8 -> 0/1 branches | The 52 positive final144 statement spans are top-level imports, declarations, and exported aliases (source lines 2-36, 50, 61, 69, 116, 124, 128, 134, 148, 152, 158, 162, 188, 216, 255, 362-364). Every original source function, including runShadowAgentComparisonForUser, had zero calls in both maps. The apparent four function and six branch hits are generated CommonJS/module helper instrumentation at line 1, not an original runtime branch. |
| src/lib/agent/orchestrator/model-client.ts | 154/430 -> 0/430 lines/statements; 4/16 -> 0/1 functions; 6/8 -> 0/1 branches | All final144 positives are imports/type-export and top-level declaration spans through line 276 and 355. Both real factories createOpenAIToolModelClient and createOpenAIAgenticToolLoopModelClient had zero original-function calls in final144; the four function/six branch hits again belong to generated module helpers. |
| src/lib/openai/chat.ts | 20/51 -> 0/51 lines/statements; 4/9 -> 0/1 functions; 6/8 -> 0/1 branches | Final144 covered imports and module declarations only (lines 1-20). streamChatCompletion and its stream start callback had zero original-function calls before and after. No stream/default-parameter runtime branch was lost. |
| src/lib/agent/compare/tool-loop-variants.ts | 40/40 -> 36/40 lines/statements; 15/15 -> 13/15 functions; 23/25 -> 20/22 branches | A real source function is no longer exercised: resolveAgentCompareToolLoopVariant at lines 18-22. Its four statements and the nullish fallback branch disappeared. The remaining composition-mode, advisor-guidance, and consultation-brief resolvers still execute. |

Thus three full-file declines are not a real source-function or source-branch regression. They are still an honest local loss of executable module-evaluation/import-graph coverage: final144 loaded the legacy run-compare graph, which eagerly imported run-shadow-agent, model-client, and chat. Final172 no longer does. It is inaccurate to call this merely an export-getter artifact, but also inaccurate to say the run-shadow/model/OpenAI runtime functions were covered and then lost.

## Execution path and current reachability

The deleted legacy adapter src/lib/agent/compare/run-compare.ts eagerly imported run-agentic-tool-loop and run-shadow-agent, so its former direct test import caused the three module-evaluation entries. Its test-only adapter cases were removed from tests/agent-compare-runner.spec.ts.

Current operator paths remain real but are not executed by those adapter fixtures:

- The development Compare route installs dynamic default runners in src/app/api/labs/agent-compare/route.ts:51-57. Classic dynamically loads run-shadow-agent and calls runClassicAgentComparisonForUser; tool-loop dynamically loads run-agentic-tool-loop and calls runToolLoopComparisonForUser.
- The Classic path creates its model client at src/lib/agent/compare/run-shadow-agent.ts:256-280. That reaches createOpenAIToolModelClient in src/lib/agent/orchestrator/model-client.ts:276-340, whose methods use DEFAULT_CHAT_COMPLETION_MODEL at lines 293 and 321.
- The Tool Loop path dynamically imports model-client and creates the agentic model client at src/lib/agent/compare/run-agentic-tool-loop.ts:101-127; it uses DEFAULT_CHAT_COMPLETION_MODEL at model-client.ts:372 and 414.
- The default route test does prove that the route supplies guidance_tool (tests/agent-compare-api.spec.ts:175-182), but it injects runners and therefore does not load either production runner. The current default system is agent_v2_care_balance at route.ts:191-199, so it does not independently exercise Classic or legacy Tool Loop.

## Unique removed assertion versus retained proof

The removed legacy test named "runCompareWithAdapters resolves omitted tool-loop variant to product evaluation" asserted that an omitted variant was normalized to guidance_tool and passed to both adapter callbacks (former tests/agent-compare-runner.spec.ts:94-127). That exact adapter function was removed with run-compare, so it is not a lost contract for a surviving adapter.

But the same fallback remains a live source contract at src/lib/agent/compare/tool-loop-variants.ts:18-22. It is used by the surviving Tool Loop runtime before its turn loop (run-agentic-tool-loop.ts:418) and again when building the result trace (line 544); the scenario wrapper at lines 557-581 is now orphaned after run-compare deletion. The currently retained variant test does not import or assert resolveAgentCompareToolLoopVariant (tests/agent-compare-runner.spec.ts:7-37). The API assertion covers a separate route-level nullish default (route.ts:191), with injected callbacks, so it does not execute the helper.

Conclusion: report a real, localized source coverage decrease: lost legacy module evaluation for the retired adapter import graph, plus lost execution of the surviving undefined-variant resolver. There is no evidence in the maps of lost execution of streamChatCompletion, either OpenAI model-client factory, runShadowAgentComparisonForUser, or their source branches. There is also no retained direct proof of the live Tool Loop helper's undefined fallback; route-level default coverage is related but not an equivalent execution path.

