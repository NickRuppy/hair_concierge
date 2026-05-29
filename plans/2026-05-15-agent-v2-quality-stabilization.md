# AgentV2 Quality Stabilization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for parallelizable slices or `superpowers:executing-plans` if implementing sequentially in one session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize AgentV2 after initial Compare Lab testing so it behaves like a coherent routine/product advisor rather than a brittle terminal-contract prototype.

**Architecture:** Keep AgentV2 Compare Lab-only. Improve the existing Responses runtime, terminal contract enforcement, routine-context continuity, memory validation, guidance packages, validators, and quality-oriented payload/guidance. Do not touch the production V1 chat path.

**Tech Stack:** Next.js, TypeScript, OpenAI Responses API, GPT-5.4-mini, Zod, Node test runner, existing Compare Lab, existing deterministic product and routine tools.

---

**Spec:** `docs/superpowers/specs/2026-05-14-agent-v2-context-and-contracts-design.md`

**User situation:** Manual Compare Lab runs show AgentV2 now receives user profile context, but routine follow-ups and terminal enforcement are still brittle. It can drop routine context, reject useful answers because of invalid session memory writes, or fall back when the model writes plain text instead of calling `submit_final_answer`. The user also wants broader advisor quality improvements, not just narrow bug patches.

**Promised end-state:** AgentV2 can handle routine improvement flows, routine-context category explanations, product deep dives, and summaries without losing context or falling back unnecessarily. Every user-visible answer still passes through `submit_final_answer`. Invalid session memory writes are dropped instead of poisoning otherwise valid answers. Routine/product answers become more explanatory, profile-linked, and natural.

## Settled Decisions

- Use a **hybrid routine-followup gate**: code marks active routine context; the model still chooses answer mode within constraints.
- Use **conditional routine tooling**: explanatory category advice inside a routine thread may use guidance only, but routine changes require `build_or_fix_routine`.
- Invalid session memory writes are **non-blocking** in V0: drop them and trace the reason.
- `submit_final_answer` remains mandatory. Raw assistant text is never returned. If the model forgets the terminal tool, allow one repair turn and then fallback.
- Routine-context explanatory follow-ups may use `general_advice`, but must preserve `routine_context.active = true`.
- Verification must include running the exact failed prompt chain and returning the AgentV2 replies to the user for direct judgment.

## Target File Map

- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
  - Add routine follow-up context to model input.
  - Add missing-terminal repair behavior.
  - Split hard answer validation from non-blocking session-memory validation.
  - Strengthen terminal instructions.
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
  - Track active routine context across turns, not only current routine layer.
  - Pass routine follow-up hints to runtime.
  - Preserve enough turn metadata to verify continuity.
- Modify: `src/lib/agent-v2/contracts.ts`
  - Add trace fields for dropped session memory and missing-terminal repair.
  - Consider richer routine/product payload fields for profile-linked explanations.
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Enforce routine context continuity.
  - Enforce conditional tool requirements.
  - Keep product/routine/safety grounding hard.
  - Move session memory errors to a non-blocking sanitizer path.
- Modify: `src/lib/agent-v2/tools/guidance-tool.ts`
  - Ensure routine-context follow-ups load routine, general advice, and category guidance as needed.
- Modify: `data/agent-v2/guidance/base/routine-building.*`
- Modify: `data/agent-v2/guidance/base/product-recommendation.*`
- Modify: `data/agent-v2/guidance/base/general-advice.*`
- Modify: `data/agent-v2/guidance/base/answer-contract.*`
- Modify: `data/agent-v2/guidance/base/tone-and-format.*`
  - Make routine basics more explanatory.
  - Make product framing less winner-takes-all.
  - Clarify routine-context category advice.
  - Re-emphasize terminal tool requirements.
- Test: `tests/agent-v2-responses-runtime.spec.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`

## Scope Boundaries

In scope:

- Compare Lab AgentV2 only.
- Routine-context continuity across multi-turn tests.
- Conditional tool requirements for routine follow-ups.
- Missing-terminal repair turn.
- Non-blocking session-memory sanitization.
- Routine basics explanation quality.
- Product recommendation framing quality.
- Tests for the exact failed flows.
- Manual verification outputs returned to the user.

Out of scope:

- Production V1 chat path changes.
- New product ranking logic.
- New routine planner logic.
- Durable profile writes.
- Langfuse integration.
- Provider-neutral abstractions.
- New product/ingredient/inventory tools.

## Task 1: Add Routine Follow-Up Context

**Goal:** Make the runtime explicitly know when a turn belongs to an active routine thread.

- [ ] Add an `AgentV2RoutineThreadContext` type with:
  - `active`
  - `current_layer`
  - `last_answer_mode`
  - `last_routine_categories`
  - `last_user_goal`
  - `summary_de`
- [ ] In `run-agent-v2.ts`, maintain this context across Compare Lab turns.
- [ ] Pass the context into `runAgentV2ResponsesTurn`.
- [ ] Inject the routine thread context into the first Responses input.
- [ ] Add trace fields so Compare Lab shows whether a turn was treated as a routine follow-up.

## Task 2: Enforce Conditional Routine Tooling

**Goal:** Preserve routine continuity without overcalling routine tools for simple explanations.

- [ ] Add validator logic:
  - If `routineThreadContext.active === true`, final answer must keep `routine_context.active = true` unless the user explicitly leaves the routine topic.
  - If answer mode is `routine` or routine steps are added/removed/changed, require `build_or_fix_routine`.
  - If answer is explanatory `general_advice`, allow guidance-only as long as routine context remains active.
  - If answer is `routine_product_deep_dive`, require `select_products` and a return path to the routine.
- [ ] Add tests for:
  - “Maske oder Conditioner?” after routine simplification: guidance-only allowed, routine context active.
  - “Mach die Routine mit Maske statt Conditioner”: routine tool required.
  - “Welchen Conditioner konkret?” inside routine: product tool required.

## Task 3: Make Session Memory Non-Blocking

**Goal:** Stop invalid session memory from killing good answers.

- [ ] Split validation into:
  - hard terminal answer validation
  - session memory write validation/sanitization
- [ ] If memory writes fail scope/evidence checks, drop only the invalid writes.
- [ ] Add trace field `dropped_session_memory_writes` with validator IDs and reasons.
- [ ] Ensure no repair turn is triggered only because of invalid session memory.
- [ ] Add tests:
  - valid answer + invalid memory write returns answer and drops memory
  - invalid product grounding still fails
  - invalid safety boundary still fails

## Task 4: Repair Missing Terminal Tool Once

**Goal:** Keep `submit_final_answer` mandatory while avoiding immediate fallback when the model writes plain text.

- [ ] Strengthen initial runtime instruction:
  - never return plain assistant text
  - every user-visible answer must be submitted through `submit_final_answer`
  - if unsure, submit clarification through the terminal tool
- [ ] Strengthen `submit_final_answer` tool description.
- [ ] If a response has no function calls but contains assistant text:
  - do not return the text
  - append a repair instruction containing the previous text
  - require exactly one `submit_final_answer` call
- [ ] If repair fails, return safe fallback and trace `missing_terminal_failed`.
- [ ] Add tests:
  - assistant text gets repaired into terminal answer
  - repair failure falls back
  - raw assistant text is never returned directly

## Task 5: Improve Routine Basics Quality

**Goal:** Routine answers should be useful, not just structurally correct.

- [ ] Update routine guidance so basics answers explain:
  - shampoo role
  - shampoo type that fits the profile
  - conditioner role
  - conditioner type that fits the profile
  - the biggest lever or why no extra lever is needed
  - caveat for fine hair, dry scalp, oily scalp, curls, or damage when relevant
- [ ] Decide whether to add payload fields such as:
  - `product_type_de`
  - `profile_fit_de`
  - `caveat_de`
  - `why_this_is_enough_de`
- [ ] Add tests or fixture assertions that a routine basics answer includes profile-linked reasons, not only step names.
- [ ] Keep the answer concise enough for Compare Lab judgment.

## Task 6: Improve Product Recommendation Framing

**Goal:** Product recommendations should feel like advisory options, not a forced ranked winner.

- [ ] Update product guidance:
  - present ranked products as suitable options with tradeoffs
  - do not say “wenn du nur eins nimmst”
  - explain why the first option is the cleanest fit without sounding absolute
  - connect every product fit to profile/tool facts
  - keep usage caveats practical and brief
- [ ] Add a phrase guard or test fixture for disallowed winner-takes-all phrasing.
- [ ] Ensure product claims remain grounded in `select_products` projections.

## Task 7: Improve General Advice Inside Routine Context

**Goal:** Category explanations should answer the category question and guide back to the routine.

- [ ] Update general advice guidance:
  - answer the category distinction first
  - explain how it applies to the active routine
  - preserve routine context in the terminal contract
  - avoid product recommendations unless explicitly asked
  - offer a next step back to routine or product deep dive
- [ ] Add tests for:
  - conditioner vs mask inside routine
  - deep-cleansing vs regular shampoo inside routine
  - summary follow-up after category advice

## Task 8: Run Automated Verification

**Goal:** Prove the stabilization behavior before manual judging.

- [ ] Run focused tests:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-compare-runner.spec.ts
```

- [ ] Run AgentV2 + Compare Lab suite:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-tool-projections.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-compare-api.spec.ts tests/agent-compare-product-trace.spec.ts tests/agent-compare-runner.spec.ts
```

- [ ] Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

## Task 9: Run Manual Compare Lab Verification And Return Outputs

**Goal:** Let the user judge real AgentV2 output, not just tests.

- [ ] Restart the worktree dev server.
- [ ] In Compare Lab, run Tool Loop vs AgentV2 with AgentV2 enabled.
- [ ] Run this exact failed chain:

```text
Meine Routine ist zu viel, mach sie einfacher.
Brauche ich dann eher Maske oder Conditioner?
fass mir das bitte kurz zusammen
```

- [ ] Return the AgentV2 replies for all three turns to the user, plus trace summary:
  - answer mode
  - tools called
  - routine context active/layer
  - repair attempts
  - dropped memory writes
- [ ] Run this second chain:

```text
Kannst du mir meine Routine verbessern?
ok und welcges Shampoo insbesondere sollte ich verwenden
warum dann nicht Tiefenreinigung?
```

- [ ] Return the AgentV2 replies for all three turns to the user, plus the same trace summary.
- [ ] Run one product-deep-dive-in-routine smoke case:

```text
Ich will meine Routine verbessern.
Welchen Conditioner sollte ich dafür konkret nehmen?
Und wie passt der dann in die Routine?
```

- [ ] Return the AgentV2 replies and trace summary.

## Manual Acceptance Criteria

The stabilization is successful when:

- AgentV2 does not ask for profile data already present.
- Routine follow-ups preserve routine context.
- “Maske oder Conditioner?” answers directly and does not fallback.
- Summary follow-up does not fallback.
- Every delivered answer comes from `submit_final_answer`.
- Invalid memory writes do not kill valid answers.
- Product recommendations are framed as advisory options, not hard winner-take-all.
- Routine basics explain what type of shampoo/conditioner fits and why.
- The user can judge the returned AgentV2 replies directly from the final report.

## Handoff

Next skill: use `superpowers:subagent-driven-development` if splitting runtime/validator/guidance work, or `superpowers:executing-plans` if implementing sequentially in this same worktree.
