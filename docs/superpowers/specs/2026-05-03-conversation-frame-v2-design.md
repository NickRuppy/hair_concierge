# Conversation Frame V2 Design

**Reader:** Product and engineering context for the next Hair Concierge chat-continuity iteration.

**Problem:** V1 made routine follow-ups more observable, but the assistant can still feel like it is starting over. The weak point is not only routing. The final answer often lacks a crisp, explicit sense of the current conversational move: "the user is narrowing the prior answer", "the user added a constraint", "the user wants the next practical step", or "the user changed topic".

**Product Goal:** A user should feel that Hair Concierge is present in the conversation. It should remember what was just discussed, answer the next message as part of that flow, and avoid making the user repeat themselves. This must work beyond five known test chains and beyond routine questions.

**Architecture Goal:** Use the model for semantic conversation understanding, not deterministic hair-issue branching. Use deterministic code for validation, persistence, traceability, budgets, and hard product/safety boundaries.

## Architecture Verdict

The right direction is **model-native conversation framing with deterministic guardrails**.

We should not build a bigger deterministic router. We should also not rely on raw history alone. Raw history gives the model words; a frame gives the model orientation. The frame is not the product brain. It is a compact, typed note saying where we are in the conversation and how the next answer should behave.

```text
user message
+ recent messages
+ hair profile / durable memory
+ previous conversation frame
    -> existing route-classification LLM call emits route + current frame
    -> deterministic validator/merger stores the frame and trace
    -> agent tools/recommendation packet run from route + product contracts
    -> final answer LLM sees exact wording, raw history, profile, frame, and tools
```

This adds **no extra interpreter model call**. It upgrades the existing classifier output from "route only" to "route plus conversation frame", then makes the final render honor that frame.

## Approaches Considered

| Approach | Complexity | Effort | Tradeoffs | Best when... |
| --- | --- | --- | --- | --- |
| A: Raw history only | Low | ~0.5 day | Most agentic and cheapest to build, but traces cannot explain why continuity failed and weak follow-ups still get misread. | Demos or prototypes where debugging does not matter. |
| B: General conversation frame | Medium | ~3-4 days | Gives the model rich context and a small typed orientation layer without hard-coding hair issues. Debuggable, future-proof enough for 100+ testers. | Current launch testing. |
| C: Full dialogue-state machine | High | 1-2 weeks+ | Maximum control, but brittle, slow to extend, and likely to recreate the recommendation engine as enums. | Only after evals prove model-native framing cannot meet quality targets. |

Chosen approach: **B: General conversation frame**.

## What The User Should Feel

For a three-message chat, the difference should be obvious:

1. User: "Meine Haare sind nach dem Waschen schnell platt."
2. Assistant: gives a focused explanation and a first adjustment.
3. User: "Und wenn ich danach Leave-in benutze?"

With raw-history-only, the answer may become a generic leave-in explanation. With a deterministic taxonomy, the answer may route to a product category too early. With the v2 frame, the assistant should answer as a continuation:

"Ja, aber dann sehr leicht dosieren: erst erbsengross in die Laengen, nicht an den Ansatz. In deinem Fall waere der Test: einmal ohne Leave-in am Ansatz waschen, nur Spitzen pflegen, und schauen ob das Volumen laenger haelt."

The user experiences this as: it heard me, it remembers the problem, and it gives the next useful step.

## Frame Principle

Keep closed enums only for **conversation mechanics**. Keep hair-care semantics open as short natural-language summaries.

Do not define enums like every possible issue, product situation, or routine branch. For 100+ testers, that becomes the exact deterministic trap we are trying to avoid.

## Conversation Frame Schema

```ts
type ConversationRelation =
  | "new_topic"
  | "continuation"
  | "constraint"
  | "clarification"
  | "next_step"
  | "topic_shift"

type AnswerStyle =
  | "direct_continuation"
  | "focused_answer"
  | "one_next_step"
  | "clarifying_question"
  | "full_answer"

interface ConversationThread {
  label: string
  summary: string
}

interface ReferencedContext {
  label: string
  evidence: "explicit" | "implicit"
}

interface ConversationFrame {
  version: 2
  is_followup: boolean
  relation_to_previous: ConversationRelation
  active_thread: ConversationThread | null
  user_move_summary: string
  referenced_context: ReferencedContext[]
  user_constraints: string[]
  unanswered_questions: string[]
  answer_style: AnswerStyle
  should_preserve_previous_thread: boolean
  confidence: number
  trace_note: string
}
```

### Field Intent

| Field | Why It Exists |
| --- | --- |
| `relation_to_previous` | Generic conversation move; stable across any hair-care category. |
| `active_thread` | Open semantic memory, e.g. "flat hair after washing", "routine order for fine wavy hair", "compare protein mask vs bondbuilder". |
| `user_move_summary` | One sentence the final answer can use as orientation. |
| `referenced_context` | What prior answer/product/routine step the user is pointing at. |
| `user_constraints` | Newly added constraints, e.g. "fine hair", "once per week", "colored lengths". |
| `unanswered_questions` | What still needs asking before a confident answer. |
| `answer_style` | The response-shape contract, without a separate duplicated `response_contract`. |
| `should_preserve_previous_thread` | LLM-owned judgment that prevents keyword heuristics. |
| `trace_note` | Human-readable reason for admin debugging. |

## Input Contract For Final Answering

The final answer agent must receive:

```ts
interface AgentTurnInput {
  user_message: string
  recent_messages: Array<{ role: "user" | "assistant"; content: string; created_at?: string }>
  hair_profile: HairProfile | null
  previous_conversation_frame: ConversationFrame | null
  current_conversation_frame: ConversationFrame
  recommendation_context: AgentRuntimePacket
}
```

Rules:

- `user_message` is always verbatim and always present.
- `recent_messages` carries exact prior wording and assistant promises.
- `previous_conversation_frame` tells the model what the app believed before this turn.
- `current_conversation_frame` tells the model how to answer this turn.
- `recommendation_context` remains the source of product/routine/tool truth.

## Answer Style Contract

`answer_style` is the key UX field:

| Answer Style | Final Answer Behavior |
| --- | --- |
| `direct_continuation` | Answer as a delta from the prior answer. Do not recap the whole plan. |
| `focused_answer` | Give a compact answer to the current question, grounded in prior context. |
| `one_next_step` | Give one practical next test/action and what to observe. |
| `clarifying_question` | Ask only the missing question needed to continue. |
| `full_answer` | Use when the user starts a fresh topic or explicitly asks for a complete overview. |

This replaces `avoid_full_restart`. The name should describe what great behavior looks like, not merely what bad behavior to avoid.

## Determinism Budget

Deterministic code should enforce boundaries, not interpret hair-care meaning.

Code owns:

1. Schema validation, defaults, clamping confidence to `0..1`, and dropping invalid fields.
2. Versioned persistence in `conversation_states`.
3. Merge rules between previous and current frame.
4. Trace visibility in `conversation_turn_traces` and admin conversation detail.
5. Token budgets and history trimming.
6. Hard recommendation invariants that already belong to tools/product logic: available products, category eligibility, safety disclaimers, subscription/billing, and no unsupported medical claims.

The model owns:

1. Whether the message is a follow-up.
2. What the user is referring to.
3. The active thread summary.
4. Whether a new product/tool route is needed.
5. Whether the answer should continue, narrow, ask, or fully reset.
6. Natural wording of the answer.

Code must not do:

- no issue-to-product mapping from `active_thread.summary`
- no keyword lists for every follow-up type
- no hard-coded "build-up means deep cleansing shampoo" path
- no category-specific conversation enum explosion

## Merge Rules

No vague "looks like a follow-up" heuristic in code. The LLM emits the relation and preservation intent. Code applies deterministic thresholds:

1. If `relation_to_previous = "topic_shift"` or `relation_to_previous = "new_topic"` and `confidence >= 0.75`, replace the previous active thread.
2. If `should_preserve_previous_thread = true` and `confidence >= 0.60`, preserve the previous `active_thread` unless the current frame supplies a more specific thread.
3. If confidence is below `0.60`, keep the current frame but add `merge_reason = "low_confidence_llm_frame"` and `needs_trace_review = true` to the trace.
4. If the schema is invalid, fall back to a safe frame:
   - `relation_to_previous = "new_topic"`
   - `answer_style = "focused_answer"`
   - `active_thread = null`
   - `confidence = 0.3`
   - trace `frame_validation_failed`

## Data Flow

```text
POST /api/chat
  load recent messages, profile, durable memory
  load previous conversation frame from conversation_states
  call existing classification LLM once with:
    user_message + recent_messages + previous frame + profile
  receive structured route + current frame
  validate route and frame
  merge previous/current frame
  run existing route/tool/recommendation pipeline
  render final answer from AgentTurnInput
  persist merged frame after assistant response
  write trace:
    previous frame
    current frame
    merged frame
    merge reason
    route/tool decisions
    final answer style
```

Important distinction: this is still a two-LLM-turn architecture today if the current system has classifier plus final synthesis. V2 does **not** add a third model call. A future larger redesign could collapse route + answer into one tool-using agent call, but that is not required to fix launch continuity.

## Prompt Changes Required

The frame only helps if final render actually obeys it.

Final render prompt must include a compact instruction block:

```text
Conversation behavior:
- Use the exact current user message for tone and wording.
- Use recent messages to preserve what was already promised or explained.
- Use current_conversation_frame.answer_style to decide shape.
- If answer_style is direct_continuation, answer only the new delta unless the user asks for a recap.
- If answer_style is one_next_step, give one practical test/action and the signal to watch.
- If relation_to_previous is constraint, say what changes and what stays.
- Do not restart a full routine/product overview on a narrow follow-up.
```

This is the concrete fix for "the assistant restarts the whole answer".

## Testing Strategy

The five known chains are seed regressions, not the system boundary.

### Seed Regression Chains

1. `Silikone?` -> `bei feinem Haar?` -> `woran merke ich Build-up?`
2. `Klebrige Haare` -> `Tiefenreinigung?` -> `was danach ändern?`
3. `Bondbuilder oder Proteinmaske?` -> `blondierte Längen` -> `wie oft?`
4. `Reihenfolge Shampoo/Maske/Conditioner` -> `einmal pro Woche?` -> `wo Hitzeschutz?`
5. `Routine` -> `kürzer` -> `was zuerst?`

### Generalization Eval

Add a fixture runner that samples prompts from the chat-test prompt corpus and generates two natural follow-ups per prompt. The assertions should not depend on a closed category enum. They should inspect generic behavior:

- follow-up frames preserve or shift thread correctly
- answer style is appropriate for the user move
- final answer references prior context when the user depends on it
- final answer does not ask the user to repeat information already present in recent messages or profile
- final answer does not restart a full overview for a narrow continuation
- topic shifts are accepted without clinging to stale context

### Test Surfaces

- `tests/conversation-frame.spec.ts`: schema validation, merge thresholds, fallback frames.
- `tests/agent-final-render-prompt.spec.ts`: prompt contract includes frame behavior.
- `tests/chat-debug-trace.spec.ts`: traces expose previous/current/merged frame and answer style.
- `tests/agent-production-chat-pipeline.spec.ts`: route + frame reaches the classifier context and final render packet.
- A small eval fixture file for multi-turn chains from `docs/chat-test-prompts.md` or the available prompt corpus.

## Success Criteria

This is shippable when:

1. Existing v1 routine continuity still passes.
2. Non-routine follow-ups produce visible v2 frames in traces.
3. The seed chains pass frame, trace, and final-answer continuation assertions.
4. A corpus-based multi-turn eval can add new failing chains without schema changes.
5. Debugging can answer which layer failed: interpretation, merge, tool route, or final render.
6. Added prompt/frame context stays under the token budget below.

## Token And Latency Budget

V2 should cost little because it adds structure, not another call.

- No additional model call.
- Frame target: under 500 tokens when serialized for final render.
- Classifier context: last 6 recent messages by default.
- If input grows too large, drop older recent messages before dropping:
  1. exact current user message
  2. previous/current frame
  3. product/tool packet required for correctness
- Store full frames in traces, but pass compact rendered summaries to prompts.

## Migration Strategy

Keep the existing `conversation_states` table. Store versioned JSON state.

- Existing v1 rows stay readable.
- On the first v2 turn, normalize v1 into `previous_conversation_frame` only when it has useful active context.
- Routine v1 maps to:
  - `active_thread.label = "routine"`
  - `active_thread.summary` from routine layer, pending offer, and answered slots
  - `answer_style = "focused_answer"`
- Non-routine v1 states map to `previous_conversation_frame = null` unless they contain a reliable `last_product_category`.
- Persist v2 frames going forward with `version = 2`.

No separate table migration is needed for v2 unless we later want indexed frame columns.

## Non-Goals

- Do not replace the recommendation engine.
- Do not build a full dialogue state machine.
- Do not define all future hair-care issue types upfront.
- Do not store durable user facts from this frame unless the existing memory extractor explicitly accepts them.
- Do not add a third LLM call for conversation interpretation.

## Implementation Decisions

1. Use a single combined structured output for route + conversation frame in the existing classification call.
2. Keep one frame object; do not add a separate response contract unless future traces prove the frame is overloaded.
3. Keep semantic content open-ended: labels and summaries instead of issue enums.
4. Keep answer-shape mechanics closed and small: relation + answer style.
5. Final render must receive both exact raw messages and the compact frame.
6. Admin UI shows a readable German summary first, expandable JSON second.
7. Evals define quality. If users still feel restarts, add failing conversations to the eval corpus before adding deterministic branches.
