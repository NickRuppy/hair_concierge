# Agent V2 Routine Action Contract Cleanup Implementation Plan

Required sub-skills: test-driven-development, systematic-debugging, verification-before-completion

## Goal

Patch the remaining Agent V2 follow-up-action rough edge without changing the generalized `pending_followup_action` architecture already implemented in this branch.

The invariant to preserve:

- Current-turn routine work belongs to `request_interpretation.routine_intent`, routine tool calls, routine payloads, and persisted routine context.
- Future confirmable work belongs to `next_step_offer_de` plus `pending_followup_action`.
- `pending_followup_action.routine_action` describes only a future routine mutation that a short next user turn can confirm.

## Architecture

Agent V2 has three distinct concepts:

1. Current action
   - The assistant creates or changes something now.
   - Source of truth: structured interpretation, tool calls, and resulting payloads.
   - `pending_followup_action` may be `null`.

2. Informational suggestion
   - The assistant names a useful next direction, such as "Nächster sinnvoller Zusatz: ein leichtes Leave-in."
   - Source of truth: visible answer text only.
   - It should not create `next_step_offer_de` or `pending_followup_action`.

3. Confirmable offer
   - The assistant visibly asks whether it should do something next, such as "Soll ich dir ein passendes Leave-in empfehlen?"
   - Source of truth: visible `next_step_offer_de` plus matching `pending_followup_action`.
   - Short replies such as "Ja bitte" can resolve this state.

Do not loosen the validator to allow `routine_action` under `advisor_response` or `product_recommendation`. That would make hidden state ambiguous.

## Scope

This is a small cleanup patch, not a schema redesign. Claude reviewed the plan against the feature worktree and found the generalized contract already exists; the remaining work is mainly sharper guidance, one diagnostic, and only genuinely missing tests.

## Implementation Steps

### 1. Audit Existing Coverage Before Adding Tests

Files:

- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`

First confirm existing coverage for:

- Current-turn routine creation with `pending_followup_action: null` passes.
- `routine_mutation` offers with non-null `routine_action` pass.
- Non-`routine_mutation` actions with non-null `routine_action` fail.
- `advisor_response` with `routine_action: null` passes.

Only add tests for missing coverage. Avoid duplicating passing tests just to make the plan look larger.

Likely useful missing test:

- `advisor_response` with `routine_action: "create"` fails with `pending_followup_action_invalid_fields`.

When testing `advisor_response`, use wording that does not accidentally trigger product or routine-mutation classification. Safe example:

> Wenn du magst, erkläre ich dir als Nächstes, wie du die Routine auf mehr Feuchtigkeit ausrichtest.

Avoid words such as "anpassen", "einbauen", "integrieren", "empfehlen", or "Produkte" in that specific test unless the expected kind is `routine_mutation` or `product_recommendation`.

### 2. Clarify Runtime Prompt Guidance

File:

- `src/lib/agent-v2/runtime/responses-agent.ts`

Add or sharpen one guidance bullet near the existing `pending_followup_action` instructions:

- Do not copy a routine action completed in the current answer into `pending_followup_action`.
- Set `pending_followup_action` only for a visible future offer the user can confirm.
- Plain next-step suggestions are not confirmable offers.

Keep this concise. The current guidance already covers most of the contract.

### 3. Improve Validator Diagnostic

File:

- `src/lib/agent-v2/validation/final-answer-validator.ts`

Reword the existing `pending_followup_action_invalid_fields` message for non-`routine_mutation` actions with `routine_action !== null`.

The message should explain:

- `pending_followup_action.routine_action` is future-confirmation state.
- Current-turn routine work belongs in `request_interpretation.routine_intent` and routine tool outputs.

Do not change the validation behavior.

### 4. Representative Conversation Check

Run the same local simulation path used for the previous Agent V2 conversation probes. If using the repo scripts, prefer naming the exact command in the handoff.

Threads to inspect:

1. Initial routine creation:
   - "Erstelle mir bitte eine einfache Routine für meine Haare."
   - Expected: visible routine answer; `pending_followup_action: null` unless a direct confirmable offer is visible.

2. Product follow-up:
   - Continue only after the assistant visibly offers product recommendations.
   - Then send "Ja bitte".
   - Expected: product recommendation fulfillment and pending action cleared unless a fresh visible offer appears.

3. Routine mutation follow-up:
   - Continue only after the assistant visibly offers to add/change something in the routine.
   - Then send "Ja bitte".
   - Expected: `build_or_fix_routine` authorized by `pending_followup_action.kind: "routine_mutation"` and pending action cleared unless a fresh visible offer appears.

For each run, record visible assistant replies and stored pending state after each turn.

## Verification

Run:

```bash
npm run test:agent
npm run ci:verify
git diff --check
```

If targeted iteration is needed before the full suite, use focused `npx tsx --test ...` commands, but do not treat those as the final gate.

## Handoff Criteria

The patch is ready for review when:

- No current-turn routine creation requires pending follow-up state.
- Non-routine pending actions still cannot carry `routine_action`.
- The prompt clearly distinguishes current actions, informational suggestions, and confirmable offers.
- Representative conversation traces show no hidden pending action unless the visible assistant reply actually offers a confirmable next action.
