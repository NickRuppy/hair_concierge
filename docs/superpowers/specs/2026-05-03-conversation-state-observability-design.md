# Conversation State Observability Design

**Status:** Superseded by Conversation Frame V2 for the next implementation step.

**Current v1 Outcome:** Hair Concierge now has explicit persisted short-term state for routine continuity. This improved routine debugging, but it is too narrow for the next user-testing phase.

**V2 Direction:** Use a general `conversation_frame` instead of expanding deterministic topic state. The frame captures conversation mechanics with small stable fields, and captures hair-care semantics as open summaries. The model interprets the user move; deterministic code validates, merges, persists, traces, and enforces product/safety boundaries.

Canonical next spec:

`/Users/nick/AI_work/hair_conscierge/.worktrees/conversation-state-observability/docs/superpowers/specs/2026-05-03-conversation-frame-v2-design.md`

Canonical implementation plan:

`/Users/nick/AI_work/hair_conscierge/.worktrees/conversation-state-observability/plans/2026-05-03-conversation-state-observability.md`

## Why V1 Is Not Enough

V1 knows routine/product categories, but testers will ask unpredictable follow-ups:

- adding a constraint
- asking for the next practical step
- asking whether advice changes for their hair type
- comparing two products or methods
- shifting topic after several messages
- referring to a previous assistant recommendation without naming it again

Predefining all of those as deterministic category paths would recreate a brittle state machine. V2 keeps the architecture elegant: model-owned semantic understanding plus deterministic observability and guardrails.
