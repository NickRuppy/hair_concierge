# Agent V2 Validator Diet Implementation Plan

Date: 2026-07-03  
Status: implementation handoff, pending new worktree  
Source record: `plans/2026-07-03-agent-v2-validator-diet-audit-findings.md`  
Claude review: `plans/2026-07-03-agent-v2-validator-diet-audit-findings.claude-review.md`

## Goal

Reduce Agent V2 validator kill power for recoverable hidden metadata/state drift so Chaarlie gives useful, truthful German answers instead of generic clarification, while preserving hard guardrails for:

- product truth and product facts;
- unresolved exact product assessment;
- invented product IDs or routine step IDs;
- schema/UI integrity;
- safety, scalp, medical, privacy, and internal leakage boundaries;
- wrong tool/action side effects.

## Working Rules

- Do this in a new repo-local worktree/directory, not in `selected-product-facts-card-polish`.
- Do not stage, commit, push, open PRs, run migrations, or clean worktrees without explicit approval.
- Preserve existing dirty changes in all worktrees.
- This plan intentionally does **not** add a runtime kill-switch. The change will be isolated in a new branch/worktree and should merge only after broad verification. If verification is poor, do not merge.
- Do not include style/closing validators in the first implementation unless they directly cause generic fallback for otherwise useful answers. Style validators in `src/lib/agent-v2/validation/user-facing-language.ts` are useful and can stay as-is for now.

## Starting Point

The current audit worktree already contains an uncommitted first prototype slice:

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`

For the new implementation worktree, do not blindly inherit the dirty stack. Start from a clean base and intentionally re-apply or re-implement only the approved behavior:

- safe hidden interpretation metadata can become warnings only when no truth/safety/UI/product blocker remains;
- hidden pending action without visible offer is stripped if the visible answer is otherwise safe;
- current routine product identity acknowledgement works for current-shampoo questions;
- active resolved product fit follow-up avoids generic clarification and does not invent a fit verdict without product facts.

## What "Live Trace First" Means

The synthetic regression for `Hast du sonst Alternativen zu diesem Shampoo?` already passes in `tests/agent-v2-responses-runtime.spec.ts`, so it does not explain the manual app failure.

Before changing alternatives-specific routing, reproduce the local app behavior and inspect the actual Agent V2 trace:

- prompt sequence around the active product;
- selected product / active product context available to runtime;
- tool calls made or skipped;
- final-answer validator errors and warnings;
- repair state and fallback reason;
- final user-visible German answer.

This is not a separate product decision. It is the diagnostic step that tells us which layer is actually failing before changing validator logic for that prompt.

## PR Slice 1: State/Metadata Recovery Backbone

Purpose: reduce generic fallback from safe hidden metadata/state drift without touching product truth rules.

### Task 1.1 - Reproduce and capture live traces

Files likely involved:

- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/production/chat-pipeline.ts`
- local trace/log tooling already used by Agent V2 tests or app traces

Capture traces for:

- `Hast du sonst Alternativen zu diesem Shampoo?`
- `Okay ja kannst du mir kurz sagen ob das zu mir passt?`
- `Du kennst ja das Shampoo, das ich gerade benutze, oder?`
- at least one short-confirmation flow: visible offer -> `Ja bitte`

Acceptance criteria:

- There is an explicit note in the implementation PR description or plan update saying which validators/repair gates fired for the real alternatives failure, or that it could not be reproduced.
- Do not add alternatives-specific logic until this trace is understood.

### Task 1.2 - Re-apply the approved first slice cleanly

Files:

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`

Behavior:

- Soften only safe hidden interpretation metadata when it is the only blocker.
- Strip hidden `pending_followup_action` when it has no visible offer and the answer is otherwise safe.
- Keep hard blockers for mixed failures, product truth, unresolved lookup, product facts, UI contract, safety, and wrong action side effects.
- Add/keep useful fallback for current-routine product identity and active resolved product fit/no-facts context.

Acceptance criteria:

- Hidden metadata softening produces warnings, not errors, only when no hard blocker remains.
- Hidden pending action is removed from `sanitized_answer`.
- Hidden pending action mixed with product truth failure still blocks.
- Current shampoo identity and active product fit follow-ups do not use generic clarification.

### Task 1.3 - Expand evidence quote sanitization cautiously

Files:

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`

Behavior:

- Treat `request_interpretation.evidence_quote` as observability-first.
- Sanitize or warn for harmless quote drift when visible answer and tool grounding are safe.
- Keep hard when evidence drift changes product identity, product lookup scope, user intent, or consequential claim.

Acceptance criteria:

- Harmless evidence quote drift no longer kills a safe answer.
- Wrong-product evidence still blocks.
- Unresolved exact product assessment still blocks.

### Task 1.4 - Pending action fill/normalize refinement

Files:

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`

Behavior:

- Pending actions stay strong: short confirmations execute only a matching pending action.
- Clear direct questions and clear `Ich kann ...` offers create/fill pending state when action and category are clear.
- Vague offers do not create pending state.
- Hidden action with no visible offer is stripped.
- Wrong action/category blocks unless normalization is obvious.

Examples:

- `Soll ich dir 2-3 passende Shampoo-Alternativen empfehlen?` -> `product_recommendation / shampoo`
- `Ich kann dir auch 2-3 leichtere Shampoo-Alternativen nennen.` -> `product_recommendation / shampoo`
- `Ich kann dir mehr dazu sagen.` -> no pending action unless action/category is clear

Acceptance criteria:

- Visible clear offer + missing pending action is filled deterministically.
- `Ja bitte` after a clear offer executes the promised action.
- `Ja bitte` without pending action clarifies instead of guessing.
- Wrong routine/product side effect cannot be authorized by repair.

### Slice 1 verification

Run:

```bash
./node_modules/.bin/tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts
npm run typecheck
```

Also run any focused trace/smoke command used for the live app reproduction.

## PR Slice 2: Tool Args, Count Flexibility, and Payload Recomposition

Purpose: make remaining validators less router-like while keeping visible answer quality and UI integrity strong.

### Task 2.1 - Split `request_interpretation_tool_args_match`

Files:

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`

Target validator shape:

- `tool_args_truth_mismatch` = hard
- `tool_args_side_effect_mismatch` = hard
- `tool_args_metadata_drift` = warning or sanitizer
- `tool_args_evidence_quote_drift` = sanitizer or trace warning

Keep hard:

- wrong product/category tool result;
- wrong routine mutation side effect;
- missing semantic fields that make tool result untrustworthy;
- count mismatch that changes an explicit visible promise.

Soften:

- harmless evidence quote wording drift;
- request-kind label drift when answer is grounded and truthful;
- close category phrasing drift that does not change product/routine action.

Acceptance criteria:

- Tool/action safety mismatches still block.
- Metadata-only drift does not force generic fallback.
- Repair hints name the concrete mismatch rather than asking for a full rewrite.

### Task 2.2 - Flexible count handling

Files:

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`

Behavior:

- Keep explicit counts hard: `ein Shampoo`, `zwei Alternativen`.
- Keep caps hard to avoid UI overload.
- Treat vague alternatives flexibly: `Alternativen`, `ein paar`, `sonst was`, `andere Marken`.
- Default vague alternatives with known context to 2-3 options.
- Ask a follow-up only if category/product context is genuinely missing or product truth requires it.

Acceptance criteria:

- Explicit count mismatch still blocks.
- Vague alternatives can return 2-3 options without count validator repair.
- Product recommendation quality remains grounded in selected products.

### Task 2.3 - Targeted agent recomposition for `visible_payload_not_rendered`

Files:

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`

Behavior:

- Keep `visible_payload_not_rendered` hard as a detection rule.
- Do **not** use hard German prose templates as the main recovery path.
- On failure, give one targeted recomposition instruction to the agent:
  - the payload is valid;
  - the visible German answer failed to render specific required elements;
  - compose natural, concise German prose;
  - include exact required payload elements;
  - do not invent claims, products, or steps.
- If recomposition fails once, use a specific known-context fallback. Generic fallback is last resort only.

Mode-specific recomposition requirements:

- Product recommendations: mention each product name, fit reason/caveat where present, count alignment, next-step offer if present.
- Product assessment: name assessed product, state only grounded assessment, include caveat or missing-facts limit, no invented properties.
- Routine answer: preserve step order, mention each visible step label, frequency/reason where present, next/return offer if present.
- Constraint-blocked: explain concrete blocker and safe alternative/next step if available.
- Clarification: render the specific question/options, not generic `Was meinst du?`.
- Pending follow-up offer: visible prose must include the confirmable offer that creates the pending action.

Acceptance criteria:

- Valid payload with incomplete prose gets one targeted recomposition attempt.
- Recomposition prompt is specific and does not invite new claims.
- If recomposition succeeds, user receives natural German answer rather than generic fallback.
- If recomposition fails, fallback is specific to known context whenever possible.

### Slice 2 verification

Run:

```bash
./node_modules/.bin/tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts
npm run typecheck
```

Add compare/scripted chat coverage for answer quality:

- alternatives follow-up after selected/active product;
- product fit follow-up after selected product;
- current shampoo identity acknowledgement;
- visible offer -> `Ja bitte`;
- payload recomposition failure/success path;
- vague alternatives count.

## Non-Goals

- Do not remove all validators.
- Do not soften safety/scalp/medical validators.
- Do not soften unresolved exact product assessment.
- Do not let `select_products` alone support product fit/property assessments that require `load_product_facts`.
- Do not add hard German prose templates as the primary recomposition strategy.
- Do not include broad style/closing validator rewrites in the first pass.

## Final Readiness Criteria

Before any PR is considered ready:

- Unit/runtime tests pass.
- Typecheck passes.
- Real or scripted chat traces show no regression for the three motivating German follow-ups.
- Short-confirmation flows still execute the visible pending action and clarify when no pending action exists.
- No validator diet change allows invented product IDs, unresolved exact product assessment, unsupported product facts, unsafe advice, or hidden wrong side effects.
