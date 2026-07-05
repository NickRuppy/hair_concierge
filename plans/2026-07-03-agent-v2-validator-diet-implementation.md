# Agent V2 Validator Diet Implementation Plan

Date: 2026-07-03
Status: Implemented in branch; not staged or committed
Base: `codex/selected-product-facts-card-polish`

## Goal

Reduce Agent V2 validator kill power for recoverable hidden metadata/state drift so Chaarlie gives useful, truthful German answers instead of generic clarification, while preserving hard guardrails for:

- product truth and product facts;
- unresolved exact product assessment;
- invented product IDs or routine step IDs;
- schema/UI integrity;
- safety, scalp, medical, privacy, and internal leakage boundaries;
- wrong tool/action side effects.

## Working Rules

- Work in this isolated repo-local worktree, not in `selected-product-facts-card-polish`.
- Do not stage, commit, push, open PRs, run migrations, or clean worktrees without explicit approval.
- No runtime kill switch for this branch; if verification is poor, do not merge.
- Keep style/closing validators out of this first pass unless they directly cause generic fallback for otherwise useful answers.

## Implemented Scope

### State and Metadata Recovery

- Soften only safe hidden interpretation metadata when it is the only blocker and `safetyMode` is normal.
- Hidden metadata currently eligible:
  - `request_interpretation_confidence`
  - `request_interpretation_answer_mode` only for `request_interpretation.product_request_kind`
- Strip hidden `pending_followup_action` when the visible answer has no confirmable offer and the answer is otherwise safe.
- Fill missing `pending_followup_action` for clear visible product/advisor offers when this is the only blocker.
- Normalize mismatched product/advisor pending actions when the visible offer is clear and no truth/safety/UI blocker is present.
- Keep hard blockers for mixed failures, product truth, unresolved lookup, product facts, UI contract, safety, and wrong action side effects.

### Tool Args, Counts, and Composition

- Split `request_interpretation_tool_args_match` into:
  - hard truth mismatch;
  - hard side-effect mismatch;
  - warning-level metadata drift;
  - evidence-quote drift.
- Keep product request kind mismatch hard when it changes product truth.
- Treat harmless terminal evidence quote drift as sanitizable only when no product/routine/safety/tool side effect is involved.
- Allow vague alternatives requests to return fewer than the default count when catalog availability or wording makes that reasonable.
- Keep explicit counts and selection caps hard.
- Make `visible_payload_not_rendered` repair guidance ask the agent to recompose German prose from the existing payload only, not from a fixed template.

### Motivating Follow-Ups

- Answer current routine product identity questions from current routine inventory when possible.
- If only the category is known, say that the exact product name is not known.
- For active resolved product fit follow-ups, avoid generic clarification and do not invent a fit verdict without product facts.
- For ambiguous fit follow-ups after visible multi-product recommendations, ask which recent product the user means instead of returning the generic fallback.

## Live Trace Note

Before alternatives-specific routing changes, use the real `/api/chat` path and inspect `conversation_turn_traces.trace.agent_v2_trace`. Compare Lab is useful for validator and repair visibility but is not faithful for product-card flows because product lookup is stubbed there.

The final implementation uses the real `/api/chat` path for confirmation. The trace helper did not always return populated trace internals for the ad hoc probe before cleanup, so the live evidence below emphasizes observed final answer behavior plus the existing deterministic/runtime trace tests.

## Verification

Passed:

```bash
./node_modules/.bin/tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts
npm run typecheck
./node_modules/.bin/tsx --test tests/agent-v2-responses-runtime.spec.ts
npx tsx scripts/eval-chat/run.ts --scenario leave-in-offer-confirmation --skip-judge --base-url http://localhost:3541
```

Live `/api/chat` checks on `http://localhost:3541`:

- `Du kennst ja das Shampoo, das ich gerade benutze, oder?`
  - Answered: `Ja, ich sehe **Eval Shampoo** als dein aktuelles Shampoo in deiner Routine.`
  - No product cards, no generic fallback.
- `Hast du sonst Alternativen zu diesem Shampoo?` after a deep-cleansing recommendation:
  - Answered with three grounded alternatives.
  - No generic fallback.
- `Okay ja kannst du mir kurz sagen ob das zu mir passt?` after a multi-product recommendation:
  - Answered with a specific clarification naming the visible recent products.
  - Did not invent a yes/no fit verdict.
  - Did not return the generic fallback.
- Visible offer -> `Ja bitte`:
  - `leave-in-offer-confirmation` passed 1/1 scenario, 12/12 assertions.
  - Report: `test-results/chat-eval/chat-eval-2026-07-03T11-06-29.json`

## Follow-Up Before PR

- Re-run the combined validator/runtime/product-lookup test bundle after any further edits.
- Consider one reviewer pass focused on whether the new recent-product-name extractor should read only bold names or also product card metadata.
- Keep style/closing validators unchanged for this PR; they were not the current generic-fallback cause.
