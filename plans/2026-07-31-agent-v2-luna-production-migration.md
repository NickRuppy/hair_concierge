# AgentV2 GPT-5.6 Luna production migration

**Status:** Locally verified and review-ready; known live-regression risk accepted on 2026-07-31
**Planning source:** Fresh `origin/main` at `556f25c471bb7371e4abea3303aad5d006052e26`
**Implementation base:** Refreshed `origin/main` at `fbc0c69c` before final handoff
**Evaluation source:** 2026-07-31 five-prompt Compare Lab run in
`.local-audits/luna-compare/results.json`

## Outcome and source context

Change Chaarlie's production AgentV2 recommendation engine from
`gpt-5.4-mini-2026-03-17` to `gpt-5.6-luna`, preserving the currently shipped
Responses API tool loop, prompts, tool contracts, validation, answer verbosity,
reasoning effort, privacy behavior, and user-visible product experience.

The completed five-prompt comparison held the synthetic profile, Care Balance
context, tools, prompt, `reasoning_effort: low`, and `text.verbosity: low`
constant. All ten model runs completed successfully. Luna won two prompts,
GPT-5.4 mini narrowly won one, and two were ties with expected clarification
behavior caused by incomplete profile data. Across the five Luna runs:

- measured standard-API cost was `$0.1058`, versus `$0.3028` for GPT-5.4 mini;
- measured aggregate cost was 65.1% lower;
- measured aggregate latency was 7.4% lower;
- selected products were stable in the comparable recommendation cases;
- no validator failures occurred.

OpenAI's GPT-5.6 migration guidance says to preserve the current GPT-5.4
reasoning effort as the baseline, then evaluate one level lower on
representative tasks. It identifies Luna as the efficient, high-volume tier and
supports the existing Responses API, tools, `store: false`, encrypted reasoning
replay, `reasoning.effort: low`, and `text.verbosity: low` request shape.

External sources:

- <https://openai.com/index/advancing-the-price-performance-frontier-with-gpt-5-6/>
- <https://developers.openai.com/api/docs/models/gpt-5.6-luna>
- <https://developers.openai.com/api/docs/guides/latest-model>

## Chosen direction

Make Luna the source-controlled AgentV2 default:

```text
model: gpt-5.6-luna
reasoning.effort: low
text.verbosity: low
endpoint: Responses API
store: false
```

Use the model alias exposed by OpenAI because the Luna model page currently
does not expose a separately dated snapshot. Do not add a new model router,
feature flag, or per-user split for this small, reversible migration.

Keep reasoning at `low` for the initial migration:

| Option | Plain meaning | What gets easier | What gets harder | Decision |
| --- | --- | --- | --- | --- |
| `low` | Ship exactly the configuration tested in the Compare Lab | Preserves the measured quality, cost, and latency evidence; matches the current production baseline | Does not test whether `none` could be even cheaper | **Recommended; pending Nick confirmation** |
| `none` | Test Luna's next lower documented reasoning setting after the model switch | May reduce latency and reasoning tokens further | Changes two variables at once and has no Chaarlie quality evidence yet | Defer to a later isolated evaluation |
| `medium` | Increase reasoning for every AgentV2 turn | May help a subset of difficult turns | Untested here; likely adds latency and tokens to routine recommendations | Reject for the initial switch |

The internal schema still accepts the legacy value `minimal`, but OpenAI's
current GPT-5.6 guidance documents `none`, `low`, `medium`, `high`, `xhigh`,
and `max`. Do not pass `minimal` to Luna. No Vercel environment currently
overrides the production reasoning effort.

The recommended rollout posture is a direct 100% cutover after preview
verification, not a canary. This is proportionate to the low current chat
volume, the one-line source change, and the existing deployment rollback, but
it is an explicit owner decision rather than an invisible implementation
assumption.

The migration also consciously moves from a dated GPT-5.4-mini snapshot to the
currently available Luna alias. Accept that upstream behavior may evolve, and
revisit pinning if OpenAI later exposes a dated Luna snapshot.

### Accepted live-regression risk

Expanded implementation verification found one repeatable compatibility edge
outside the five-prompt review: for the broad prompt “Wie kann ich meine
Routine verbessern?”, Luna sometimes calls the correct routine tool with
`objective: fix_routine`, `routine_intent: modify`, and
`mutation_kind: none`. The existing validator rejects `modify + none`; its
terminal-only repair cannot change the already-executed tool arguments, so the
turn can fall back to a generic clarification.

The same replay passed 3/3 times on GPT-5.4 mini, 1/3 times on Luna at `low`,
and 2/3 times on Luna at `medium`. The exact GPT-5.4-mini trace passed by
mapping the broad request to the available approximation `simplify`; Luna's
failed trace used the more literal but validator-incompatible `none`.

Nick explicitly accepted this known risk on 2026-07-31 and directed the model
migration to continue without changing prompts, tool schemas, validators, or
repair behavior. The decision prioritizes the broader observed Luna quality,
latency, and price-performance improvement and keeps the architectural cleanup
of deterministic tool contracts separate from this narrow migration.

## Scope and non-goals

### In scope

- Change the source-controlled AgentV2 default model to `gpt-5.6-luna`.
- Keep and explicitly test the `low` reasoning default.
- Update model-policy contract tests and any exact default-model assertions.
- Correct development-only Compare Lab labels that otherwise continue to call
  the active AgentV2 runtime “GPT-5.4 mini” after the switch.
- Run the existing deterministic AgentV2 suites.
- Run live, synthetic Luna regression checks through the real AgentV2 Compare
  runner before handoff.
- Verify a preview deployment before any separately authorized production
  deployment.
- Verify the production trace reports `model: gpt-5.6-luna` and
  `reasoning_effort: low` after deployment.
- Preserve a concrete rollback path to GPT-5.4 mini.

### Non-goals

- No prompt, guidance, tool schema, validation, answer-format, or production
  user-interface changes.
- No change to clarification behavior; the incomplete-profile questions in the
  mini-review are expected.
- No migration of unrelated LLM clients such as conversation titles, memory
  extraction, ingestion, cleanup, or legacy orchestration.
- No Programmatic Tool Calling, pro mode, explicit prompt caching, new
  persisted-reasoning behavior, or dynamic model routing.
- No production environment mutation or deployment during implementation or PR
  review. Deployment remains a separate authorization.
- Do not rewrite historical GPT-5.4 design documents.

## Target map

### Source changes

- `src/lib/agent-v2/model-policy.ts`
  - Change `DEFAULT_AGENT_V2_MODEL` from
    `gpt-5.4-mini-2026-03-17` to `gpt-5.6-luna`.
  - Preserve the fallback reasoning effort of `low` and text verbosity of
    `low`.
  - Preserve the existing `AGENT_V2_MODEL` and
    `AGENT_V2_REASONING_EFFORT` override seams for controlled testing and
    rollback.

- `tests/agent-v2-contracts.spec.ts`
  - Update the exact default-model assertion and test name.
  - Assert the source default resolves to Luna with `low` reasoning, `low`
    verbosity, Responses, and `store: false`.
  - Keep the scoped environment-override coverage model-agnostic.

- Development-only Compare Lab labels
  - Update the page, client run-mode labels, API fallback labels, AgentV2
    compare-runner result label, legacy compare normalizer label, and exact
    label assertions from “GPT-5.4 mini” to “GPT-5.6 Luna”.
  - Do not change trace fixtures whose mock `model` values intentionally test
    model-agnostic trace behavior.
  - This is a truthfulness correction discovered during implementation scope
    audit; it does not change production routing or customer-facing UI.

### Verification-only surfaces

- `src/lib/agent-v2/runtime/responses-agent.ts`
  - No planned change. Verify it still sends `policy.model`,
    `{ effort: policy.reasoning_effort }`, encrypted reasoning content,
    `parallel_tool_calls: false`, and text verbosity unchanged.

- `tests/agent-v2-responses-runtime.spec.ts`
  - No change expected because it already verifies model and reasoning
    propagation using overrides. Add or change coverage only if implementation
    reveals that the default is not exercised through the request seam.

- AgentV2 Compare Lab and synthetic runner
  - Use the existing synthetic-user lifecycle; do not use customer data.
  - Re-run the five reviewed prompts plus the repository's representative
    dimensions for product grounding, routine, safety, constraint handling,
    tone, and follow-up state.

- Vercel production configuration
  - Current read-only inspection found no `AGENT_V2_MODEL` or
    `AGENT_V2_REASONING_EFFORT` override in any Vercel environment.
  - Therefore the production switch should come from the reviewed source
    default, not from a hidden environment-only override.
  - `AGENT_V2_TURN_GATE_ENABLED` remains untouched.

- Langfuse and AgentV2 trace
  - Existing AgentV2 traces include the effective model and reasoning effort.
  - Existing observed OpenAI calls capture generation latency and usage.
  - No new observability schema is required for the switch.

## Designed integration and operator journey

This is a backend-only model migration. There is no intended end-user journey,
layout, copy, loading, or interaction change.

1. An implementation branch is created from fresh `origin/main`.
2. The source default changes to Luna while `low` reasoning and all other
   AgentV2 policy values remain unchanged.
3. Deterministic tests and live synthetic Compare Lab checks verify the same
   tool contracts, product grounding, safety boundaries, and expected
   clarification behavior.
4. A preview deployment receives synthetic recommendation prompts. The operator
   verifies successful answers, expected product cards, no visible failure,
   `model: gpt-5.6-luna`, and `reasoning_effort: low` in the trace.
5. The branch is reviewed and delivered as a draft PR. No production state has
   changed at this point.
6. After separate merge and deployment authorization, the normal production
   deployment makes Luna the AgentV2 default for all new chat requests.
   Existing conversations need no migration because the model choice is
   resolved per request and persisted conversation state is model-independent.
   This is a 100% cutover; there is no canary or percentage router.
7. Immediately after deployment, the operator runs a bounded production smoke
   test using a controlled account and checks:
   - a grounded product recommendation;
   - an expected incomplete-profile clarification;
   - a routine response;
   - a safety-boundary response;
   - trace model, reasoning effort, error state, latency, and repair behavior.
8. If the smoke test fails or traces show a material regression, roll back the
   deployment to the previously verified GPT-5.4-mini release. If deployment
   rollback is unavailable, set
   `AGENT_V2_MODEL=gpt-5.4-mini-2026-03-17` for Production and redeploy, then
   verify the effective trace model.
9. Completion is a healthy Luna production smoke test with the prior
   GPT-5.4-mini deployment still identifiable for rollback.

**Integration-journey sign-off:** Confirmed by Nick on 2026-07-31 for `low`
effort, direct 100% cutover after preview verification, and the Luna-alias
posture.

## Mockup evidence

No mockup is required. This migration intentionally changes no user-facing
surface or designed behavior. The existing side-by-side Compare Lab is the
review artifact for output quality:

- live local review: `http://127.0.0.1:4173/`
- raw ignored audit artifact:
  `.local-audits/luna-compare/results.json`

## Ordered tasks

1. **Create the implementation worktree**
   - Use `npm run worktree:new -- agent-v2-luna` from fresh `origin/main`.
   - Confirm the root checkout and unrelated untracked plans remain untouched.
   - Complete when `.worktrees/agent-v2-luna` is on
     `codex/agent-v2-luna` at the planned base SHA.

2. **Lock the new default with a failing contract test**
   - Update the AgentV2 model-policy test to expect `gpt-5.6-luna` with
     `low` reasoning and otherwise unchanged policy.
   - Run the focused test and confirm it fails against the old source constant.
   - Complete when the failure specifically identifies the old GPT-5.4-mini
     default.

3. **Change only the AgentV2 source default**
   - Update `DEFAULT_AGENT_V2_MODEL`.
   - Do not modify prompts, tools, schemas, safety behavior, or environment
     configuration.
   - Complete when the focused policy and runtime tests pass and the diff is
     limited to the intended default and assertions.

4. **Keep the development Compare Lab truthful**
   - Replace its visible AgentV2 GPT-5.4-mini labels with GPT-5.6 Luna.
   - Update exact label assertions while preserving mock trace model fixtures.
   - Complete when the Compare Lab API/runner tests pass and no visible
     AgentV2 GPT-5.4-mini label remains.

5. **Run deterministic verification**
   - Run the focused contract/runtime tests first.
   - Run `npm run test:agent`, `npm run typecheck`, and `npm run lint`.
   - Run `npm run build` before the review-ready handoff.
   - Complete when all required checks pass or every unrelated failure is
     isolated with evidence.

6. **Run live synthetic Luna regression checks**
   - Use the real Responses API and AgentV2 Compare runner with Luna at
     `low`.
   - Re-run the five reviewed prompts.
   - Add representative existing cases for safety, constraint blocking,
     follow-up state, product grounding, routine state, and tone.
   - Capture answer quality, failure stage, validator errors/warnings, repairs,
     model steps, tool calls, latency, tokens, and standard-API cost in an
     ignored audit artifact.
   - Complete when safety, product grounding, and API compatibility cases
     succeed and any output difference is reviewed explicitly. The broad
     routine-improvement validator failure documented under Accepted
     live-regression risk is an owner-accepted residual risk, not a migration
     blocker.

7. **Verify a preview deployment**
   - Deploy only after the normal review/ship authorization.
   - Run controlled synthetic browser checks through the actual chat surface.
   - Verify rendered answers/cards and inspect trace evidence for Luna/low.
   - Complete when preview behavior matches the integration journey with no
     model-compatibility error.

8. **Run `ready-check` and `request-code-review`**
   - Review the complete branch, not only the constant change.
   - Confirm no hidden Vercel override, prompt drift, model mismatch, or
     unrelated LLM migration entered scope.
   - Complete when the branch is review-ready with explicit residual risks.

9. **Hand off for publication**
   - Stop before commit/push/PR unless Nick invokes the publication workflow.
   - A later `ship it` authorizes commit, push, and a draft PR.
   - Merge and production deployment remain separate authorizations.

## Verification

### Automated

- Focused `tests/agent-v2-contracts.spec.ts` policy assertions.
- Focused model/reasoning propagation coverage in
  `tests/agent-v2-responses-runtime.spec.ts`.
- `tests/agent-compare-api.spec.ts`
- `tests/agent-v2-compare-runner.spec.ts`
- `npm run test:agent`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

### Live synthetic model checks

- Five reviewed comparison prompts at Luna/low.
- Existing evaluation dimensions:
  product grounding, routine basics, routine-context product ask, general
  category advice, constraint blocked, safety boundary, and tone.
- Acceptance:
  no API compatibility failure, no unexpected visible failure, no product ID
  grounding regression, no new validation error, and no medically adjacent
  overreach.

### Manual/browser

- Preview chat renders normal German answers and product cards.
- Expected clarification remains a clarification when profile facts are
  genuinely missing.
- Trace reports Luna and low.
- No other user-visible behavior is intentionally changed.

### Production and rollback

- Before deployment, record the previous production deployment identifier.
- After deployment, run the four bounded smoke cases from the designed
  integration journey.
- Inspect early Langfuse generations for effective model, errors, repairs,
  latency, token usage, and cost.
- Roll back immediately on API incompatibility, elevated visible failures,
  product-grounding defects, or safety regression.
- Treat latency as a rollback signal when either:
  - three consecutive controlled production smoke turns exceed 30 seconds of
    model latency; or
  - after at least 20 eligible production turns, Luna p95 model latency is more
    than 50% above the immediately preceding GPT-5.4-mini baseline.
  Exclude tool and database latency from this comparison.
- After rollback, verify a new trace reports GPT-5.4 mini.

## Review and handoff

- Implementation uses the repo's `implementation-loop`; it invokes
  `ready-check` and `request-code-review`.
- Branch/worktree: `codex/agent-v2-luna` in
  `.worktrees/agent-v2-luna`, based on fresh `origin/main`.
- Mockup review: Not applicable; backend-only migration.
- Integration-journey sign-off: Confirmed on 2026-07-31.
- Reasoning-effort decision: Confirmed `low`.
- Cutover decision: Confirmed direct 100% activation after preview
  verification and separate production-deployment authorization.
- Model-version decision: Confirmed use of the Luna alias until a dated
  snapshot is available.
- Publication stop point: verified local branch before commit/push/PR.
- Deployment stop point: merged code before any production deployment.

### Local implementation receipt

- Branch: `codex/agent-v2-luna`
- Current base: `origin/main` at
  `fbc0c69c62b9b54706ab2c6c144941b89a94085a`
- The canonical ready-check and review fingerprint is issued in the final
  handoff receipt so the plan itself remains part of the fingerprint without
  becoming self-referential.
- Focused AgentV2 and Compare Lab tests: 198 passed, 0 failed.
- Full agent suite: 966 passed, 0 failed, with the initial build-artifact
  check skipped before build; the artifact check then passed 2/2 after the
  production build.
- `npm run typecheck`: passed.
- `npm run lint`: passed with four pre-existing warnings and no errors.
- `npm run build`: passed.
- Rendered worktree Compare Lab: verified “AgentV2 GPT-5.6 Luna +
  CareBalance” in the page description, selected mode, and production-path
  explanation; no browser console errors.
- Vercel production environment: fresh read-only listing still contains no
  `AGENT_V2_MODEL` or `AGENT_V2_REASONING_EFFORT` override.
- Live synthetic Luna checks: product grounding, expected clarification,
  deep cleansing, routine simplification, general advice, constraint handling,
  hard safety boundary, and tone checks completed; the broad routine-improvement
  failure remains the explicitly accepted residual risk above.
- Whole-branch review: normal correctness plus structural-maintainability
  review completed with no blocking findings.
- Non-blocking review notes:
  - Compare Lab model labels are duplicated across pre-existing surfaces.
  - Compare Lab labels are static and would continue to say Luna during a
    temporary `AGENT_V2_MODEL` rollback override.
  - Production default coverage is transitive through the shared policy
    function rather than a second production-pipeline assertion.
- Task-owned code, tests, and this durable migration plan are published in
  PR #278. Transient review reports remain outside the repository. Live audit
  scripts and results remain ignored local evidence and are not intended as
  PR content.

### Residual risks

- The Luna API currently exposes an alias rather than a separately dated
  snapshot, so upstream behavior may evolve.
- A five-prompt run is encouraging but too small to establish every
  conversation pattern; the broader synthetic regression is therefore a
  required implementation gate.
- Broad routine-improvement wording can still trigger the accepted
  `modify + mutation_kind:none` validator failure and a generic clarification.
  This migration intentionally does not expand scope into prompt, tool-schema,
  validator, or repair refactoring.
- Luna writes prompt-cache entries at 1.25× uncached-input price. The measured
  run still saved 65.1%, but production cache behavior should be observed after
  deployment rather than extrapolated blindly.
- Production traffic is low enough that early measurements may be noisy.
- Rolling back by environment override requires a redeploy; the preferred fast
  recovery is reverting to the previously verified Vercel deployment.

## Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | Tradeoff | There is no percentage router; the source-default deployment activates Luna for all AgentV2 traffic | Accepted as a user decision | Direct 100% cutover is explicit and pending sign-off | Confirm with Nick before implementation handoff |
| C2 | Tradeoff | GPT-5.4 mini is dated; the currently documented Luna target is an alias | Accepted as a user decision | Alias drift and future snapshot follow-up are explicit | Confirm with Nick and re-check the model page during implementation |
| C3 | Defect | The first draft used an undefined “sustained latency regression” rollback trigger | Accepted | Added concrete consecutive-smoke and 20-turn p95 thresholds | Verify required Langfuse model-latency fields during implementation |
| C4 | Defect | Reviewer proposed `minimal` as Luna's next lower effort because the internal schema contains it | Rejected | The plan keeps `none`; current OpenAI GPT-5.6 documentation does not list `minimal` | Re-check official GPT-5.6 guidance at implementation time |
| C5 | Defect | Reviewer claimed Codex's `implementation-loop`, `ready-check`, and `request-code-review` were unavailable | Rejected | No change | Verified against `AGENTS.md`, `.agents/skills/implementation-loop`, and the personal workflow skills |
| C6 | Defect | Reviewer applied Claude's `codex:codex-rescue` finishing gate to the Codex workflow | Rejected | No change | `AGENTS.md` selects exactly one counterpart lane: Claude when Codex orchestrates |
