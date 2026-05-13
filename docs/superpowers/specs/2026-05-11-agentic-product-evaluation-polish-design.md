# Agentic Product-Evaluation Polish Design

## Source

This spec comes from the latest Compare Lab Product-Evaluation runs saved in
`tmp/agent-compare-runs.jsonl`, especially runs `#40` through `#48`.

## User Situation

The Product-Evaluation tool loop now usually understands the user intent better
than classic, especially in multi-turn threads. The remaining quality gap is the
final advice experience: some answers are correct but too terse, product
recommendations can feel under-explained, routine answers do not always anchor
on what the user already does, and one internal term leaked into user-facing
copy.

## Promised End State

In Compare Lab, Product-Evaluation remains the candidate variant and keeps its
multi-turn intent advantage, while answers become more structured,
knowledgeable, and naturally helpful without adding a Composer LLM call.

## Architecture Decision

Keep the split of responsibility:

- Tools own facts, product order, product claims, routine steps, and profile
  overlays.
- The answer-context layer owns the stable editorial contract and answer shape.
- The LLM owns natural German rendering within those constraints.

Do not fix the issues by adding another final LLM call or by making the whole
answer deterministic. The sustainable fix is to clean and enrich the structured
context the one-loop agent already receives.

## Requirements

1. Advisor guidance must not load profile overlays that contradict the stored
   profile or the current-turn signal.
2. Internal vocabulary such as "Fallback" must not reach the agent-facing tool
   payload or final user copy.
3. Product recommendations must expose enough structured comparison material for
   a useful explanation: best fit, tradeoff, weight/balance/intensity where
   supported, price only as a secondary differentiator.
4. Product-plus-usage turns must answer both parts: which product and how to use
   it.
5. Broad routine answers must acknowledge existing routine steps before
   proposing additions.
6. Conceptual add-on turns, such as "and a mask too?", should explain the role
   first and offer product picks as the next step.
7. The final answer should usually end with exactly one useful next step or
   offer, unless the user asked for a closed factual answer.
8. Compare Lab should remain production-comparison oriented: classic/current
   versus Product-Evaluation. Production chat wiring remains out of scope.

## Non-Goals

- Do not wire Product-Evaluation into production chat in this pass.
- Do not reintroduce Composer as the default candidate.
- Do not change authoritative product ranking logic unless a test shows the
  ranking payload is internally inconsistent.
- Do not solve all overlay-document quality differences here; this plan assumes
  the separate overlay harmonization work continues independently.

## Verification Signal

The next Compare Lab run should show Product-Evaluation answers that are still
better at intent carry, while the feedback no longer repeats these themes:

- "good intent but too short"
- "needs more product context"
- "should mention what I already do"
- "why does it say fallback?"
- "loaded weird overlays"
