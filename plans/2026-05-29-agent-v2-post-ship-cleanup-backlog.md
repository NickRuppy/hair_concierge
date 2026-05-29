# AgentV2 Post-Ship Cleanup Backlog

Purpose: capture non-blocking cleanup found during the final AgentV2 GPT-5.4-mini + CareBalance production-switch review.

This file is intentionally separate from the production-switch review plan. The review should block only on production correctness, grounding, privacy, state, and serious maintainability risks. Cleanup that is useful but not required for this ship belongs here.

## How To Add Items

Use this shape:

```markdown
## Item Title

- Source: reviewer / command / manual run
- Area: production adapter / legacy tool-loop / Compare Lab / guidance / tests / build / other
- Severity: cleanup / maintainability / follow-up-risk
- Why it matters:
- Suggested direction:
- Blocks current ship: no
```

If an item blocks the current ship, do not put it only here. Report it in the main review findings first.

## Backlog Items

_Add review-discovered cleanup items below._

## Current Progress

- Done: AgentV2 production trace visibility now includes runtime, model, and tool latency fields.
- Done: the Turbopack NFT tracing warning from AgentV2 guidance compiler imports is resolved; `npm run build` no longer reports it.
- Done: final production-switch review blockers found in the first focused pass were fixed before commit: failure-stage gating, prior-product card mismatch, low-content confirmation authorization, direct `zu` product asks, and CareBalance first-add-on projection.
- Still backlog: post-stabilization adapter extraction, if the production-switch review finds the current split still too heavy.
- Still backlog: define and monitor p50/p95 latency budgets after real/manual production traffic exists.

## Add Route-Level AgentV2 Persistence And SSE Regression Coverage

- Source: final production-switch review, Task -1B
- Area: tests / production adapter
- Severity: follow-up-risk
- Why it matters: the new AgentV2 production pipeline has focused pipeline-level tests, but the deleted legacy route tests previously covered route-level SSE ordering, assistant message persistence, state persistence failure behavior, visible failure persistence, and turn-trace inserts. The blocker from this review was fixed in the adapter, but the route harness should eventually prove the full `/api/chat` contract directly.
- Suggested direction: port the old `createChatPostHandler`-style route harness to AgentV2 for success, visible failure, stream error, and state-persistence-failure turns. Keep this as route-contract coverage, not Compare Lab coverage.
- Blocks current ship: no

## Clarify Visible-Failure Trace State Semantics

- Source: final integration review
- Area: production adapter / debug trace
- Severity: cleanup
- Why it matters: visible-failure turns correctly skip persistence in `/api/chat`, but the pipeline can still build an internal `conversationStateTransition` object for debug trace assembly. That is not state corruption, yet the trace could confuse future reviewers if they read it as persisted state.
- Suggested direction: either annotate the trace/status field to make non-persisted failure transitions explicit, or adjust the debug trace shape for visible failures so it cannot be mistaken for a committed state mutation.
- Blocks current ship: no

## Map Supported Current-Turn Context Signals Into CareBalance

- Source: final production-switch review, Task 2
- Area: CareBalance / effective context
- Severity: follow-up-risk
- Why it matters: `context_signal` facts are accepted by the effective-context layer, but broad signals such as flatness/load pressure are not yet translated into evaluator inputs. That can make the trace look like the current turn influenced CareBalance when the evaluator actually ignored the signal.
- Suggested direction: either map supported `context_signal` values into normalized evaluator inputs, or narrow the accepted signal contract so unsupported signals are not presented as decision facts. Start with flat/load pressure because it affects conditioner/oil frequency decisions.
- Blocks current ship: no

## Continue AgentV2 Production Adapter Extraction After Stabilization

- Source: final production-switch review planning
- Area: production adapter
- Severity: maintainability
- Why it matters: the adapter has already been split into `chat-pipeline.ts`, `conversation-history.ts`, `persisted-session-state.ts`, `session-state.ts`, and `product-output.ts`. That is a healthier ship shape, but the production entrypoint still owns context loading, tool wrapper construction, result mapping, and trace assembly. It should stay only if review confirms the current boundaries are coherent.
- Suggested direction: after the switch is stable, consider extracting context loading, AgentV2 tool wrappers, and trace construction behind tests if the current split still feels heavy in real maintenance.
- Blocks current ship: no

## Extract Shared AgentV2 Turn Context For Production And Compare Lab

- Source: final production-switch review, Task 6
- Area: production adapter / Compare Lab
- Severity: maintainability
- Why it matters: production and Compare Lab now intentionally exercise the same AgentV2 + CareBalance architecture, but some adapter/state assembly remains duplicated. Compare Lab is not a production blocker, yet duplication can make future tests misleading if one path drifts.
- Suggested direction: after this ship, extract a persistence-free AgentV2 turn-context/state core used by both production and Compare Lab. Keep production persistence and lab UI concerns outside that core.
- Blocks current ship: no

## Split AgentV2 Runtime Policy Layers After Production Stabilizes

- Source: final production-switch review, Task 6
- Area: AgentV2 runtime
- Severity: maintainability
- Why it matters: `responses-agent.ts` owns tool execution, permission policy, repair planning, fallback composition, and trace assembly. That concentration is acceptable for this ship only while the review/fix surface stays controlled; longer-term it makes policy changes harder to reason about.
- Suggested direction: split typed tool execution, repair/fallback policy, and trace construction into tested modules once the production switch has settled.
- Blocks current ship: no

## Add Latency Budget And Measurement For AgentV2 Production Chat

- Source: final production-switch review planning
- Area: production adapter
- Severity: follow-up-risk
- Why it matters: AgentV2 GPT-5.4-mini Responses runtime may have different latency from the old tool-loop path. Correctness is the current ship blocker; p50/p95 tracking should follow.
- Suggested direction: define expected local/manual latency thresholds, add trace visibility for model/tool durations, and compare a small prompt pack after deployment.
- Status: implemented on 2026-05-29 for trace visibility. Production traces now expose AgentV2 runtime, model, and tool latency fields; separate p50/p95 thresholding remains a post-deploy measurement task.
- Blocks current ship: no

## Resolve Or Document Turbopack NFT Tracing Warning

- Source: `npm run build`
- Area: build
- Severity: cleanup
- Why it matters: the build currently warns about Turbopack tracing around AgentV2 guidance compiler imports. It appears non-blocking, but should be made intentional or reduced so future reviewers do not rediscover it.
- Suggested direction: inspect whether Compare Lab/dev-only imports can be lazy-loaded after the development guard or annotate/document the dynamic filesystem trace as intentional.
- Status: implemented on 2026-05-29. The Compare Lab API route now lazy-loads compare runners and test-user helpers behind the development-only request path, and the AgentV2 guidance compiler marks the repo-root file join as an intentional Turbopack trace boundary. Confirmed by `npm run build`: the NFT tracing warning is gone.
- Blocks current ship: no
