# Compare orphan-cutover preservation review — 2026-10-02

Read-only review of the planned seven test cuts in
`plans/evidence/2026-10-02-compare-orphan-cutover.md`, current source, tests,
docs, data, and deployed baseline `3abfe00a`. No test or provider runner was
started and no repository file was changed.

## Verdict and exact count

The proposed source closure is still deletion-ready: delete
`src/lib/agent/compare/run-compare.ts` (8 functions) and its only concrete
catalogue importer `scenarios.ts` (the one `AGENT_COMPARE_SCENARIOS` constant),
with **seven** exclusive declarations:

1. `tests/agent-compare-runner.spec.ts`: `:51`, `:93`, `:128`, `:170`, `:280`, `:316` (six).
2. `tests/agent-v2-compare-runner.spec.ts`: `:16` (one).

The one-sided-failure behavior needs an assertion transfer before the `:128`
adapter test is removed. Transfer it to the active route test at
`tests/agent-compare-api.spec.ts:185`; no extra test declaration is needed.

## Confirmed active route ownership

The reachable development route dynamically imports the individual live runners:
Classic at `src/app/api/labs/agent-compare/route.ts:51-54`, Tool Loop at `:55-58`,
and AgentV2/CareBalance at `:59-69`. It normalizes systems at `:101-105`, turns at
`:93-99`, runs each requested system independently at `:195-236`, converts a
single runner error to a result at `:222-234`, then applies blinding/order/labels
at `:237-253`.

The route uses selected-user snapshots, not static scenario catalogue entries.
`tests/agent-compare-api.spec.ts:39-49` explicitly prevents a static import of
`run-compare`; the same dynamic route implementation is present at `3abfe00a`.
The live runner/prompt assets must remain: `run-shadow-agent`,
`run-agentic-tool-loop`, AgentV2 runners, `tool-loop-variants`, prompt packs,
shared types, Lab UI, and judgment routes.

## Required one-sided-failure transfer into retained test `:185`

The planned wording that this keeper already exercises one-sided failure is
currently false. In its current form both stubs return success:

- Classic returns `"Classic Antwort"` at `tests/agent-compare-api.spec.ts:212-223`.
- Tool Loop returns `"Tool Loop Antwort"` at `:224-239`.

The throwing Classic stub in the default-CareBalance test at `:161-163` is not a
failure contract: that request omits `systems`, so route `:192-194` selects only
`agent_v2_care_balance` and never calls Classic.

Revise **the existing `:185` declaration** as follows:

1. Keep recording Classic `turns` and `toolLoopVariant` in `seenTurns` /
   `seenVariants`, then throw `new Error("Classic comparison failed")` instead
   of returning the success object.
2. Keep the existing Tool Loop success stub and every existing assertion for
   request turns/prompt, both runner invocations, variant propagation, blinded
   labels, normalized systems, and `consultation_brief` trace.
3. Find results by `system`, then assert the Classic fallback has
   `error === "Classic comparison failed"` and `answer === ""`; assert the Tool
   Loop result has `answer === "Tool Loop Antwort"` (and can retain `error ===
   null` alongside its existing trace assertion).

This preserves the original adapter contract: one requested runner can fail
without suppressing the other runner's answer, trace, turns, or blinded response.
There is **no existing meaningful successful-Classic assertion** to retain: the
current Classic payload's answer, latency, debug lines, and product fields are
never asserted. The existing normalized-system assertion must stay; the failure
result should still identify as `classic`.

Named mutation caught by the transferred keeper: remove the per-runner
`.catch(...normalizeFailure(...))` at route `:218-234` (or rethrow from it).
The request would become a 500 rather than the asserted 200 response containing
both a Classic error result and the Tool Loop answer.

## Scenario catalogue is not the remaining eval/operator authority

`AGENT_COMPARE_SCENARIOS` is imported only by `run-compare.ts` and the two
planned-deletion test declarations. It has no route, scripts, docs/runbook,
package, or dynamic import consumer. Its bytes are unchanged from `3abfe00a`
(SHA-1 `288c2a365728f22ae98cf473a3a01c4914c6d8da`), confirming it is not a newly
introduced operator entry point.

It is not safe to generalize this conclusion to the scenario *type* or current
eval assets. Keep:

- `src/lib/agent/compare/types.ts` — `AgentCompareScenario` remains used by the
  concrete runner APIs and `scripts/agent-v2/run-guidance-regression.ts`.
- `data/agent-v2/evals/agent-v2-scenarios.json`,
  `guidance-migration-regression.json`, `positive-reference-cases.json`, and
  `request-interpretation-regression.json` — real evaluation fixtures retained
  by AgentV2 tests/scripts.
- Prompt packs and tool-loop variants, which still drive current Lab choices and
  retained test declarations.

The catalogue's former care-balance/heat/relationship rows are a frozen local
adapter fixture, not the actual AgentV2 eval data or a documented manual golden
authority. Historical design documents mentioning Compare Lab scenarios do not
identify this module as an active command, route input, or operator runbook.

## Deletion scope and validation

Delete only the two orphan modules and seven listed declarations after applying
the `:185` assertion transfer. Do not delete the remaining four declarations in
`agent-compare-runner.spec.ts`, nineteen remaining in
`agent-v2-compare-runner.spec.ts`, active route tests, real eval fixtures, or
prompt packs. The integrating task should run the planned affected Node suite,
coverage comparison, typecheck, lint, build, and `git diff --check` after the
frozen full-144 proof completes.
