# [Feature Name] — Design Spec

**Date:** YYYY-MM-DD  
**Status:** Draft | Approved  
**Owner:** [Name or team]  
**Written for:** A fresh Codex or Claude Code session with no prior context on this feature.

## 1. Scope At A Glance

| Field | Answer |
| --- | --- |
| Applies to | [User segment, flow, or business situation] |
| Trigger | [What event or user need causes this work to matter] |
| In scope | [What this spec covers] |
| Out of scope | [What this spec explicitly does not cover] |
| Not for | [Nearby situations that should use a different path] |

## 2. Promised End-State

One sentence, concrete and falsifiable.

Example: `A signed-in user can upgrade in checkout and immediately sees the new entitlement in their account.`

## 3. Situation

Describe the real user or business situation this resolves.

- What is happening today?
- Why is that not good enough?
- Why is this the right moment to solve it?

Keep this grounded in the observable problem, not internal implementation language.

## 4. Chosen Path

State the one canonical path this spec chooses.

- Decision: [Chosen approach]
- Why this path: [Short rationale]
- Key constraints: [Important limits or assumptions]

If there are alternatives, summarize them briefly in `Rejected approaches` instead of branching the main body.

## 5. User Flow Or System Behavior

Describe the primary path end to end.

1. [Starting point]
2. [Main interaction or state change]
3. [Result]
4. [Follow-up states, if needed]

Add failure or edge paths only when they change the product behavior or implementation shape.

## 6. Implementation Shape

Give the execute-complete details an engineer or LLM needs.

### Architecture

[2-4 short paragraphs on the chosen structure]

### Files Or Surfaces Likely To Change

- Create: `path/to/new-file`
- Modify: `path/to/existing-file`
- Verify: `path/to/test-or-flow`

### Data, State, Or Contracts

- Source of truth: [Where the authoritative state lives]
- Derived state: [What is computed]
- External dependencies: [Services, APIs, jobs, webhooks, etc.]

## 7. Verification

Define what proves the promised end-state is real.

- Automated: [Tests, lint, typecheck, build, evals]
- Manual: [User flow, browser pass, QA path]
- Failure signals: [What would tell us this is wrong]

## 8. Reference Notes

Only include what helps execution or review.

- Edge cases: [If relevant]
- Rollback or fallback: [If relevant]
- Telemetry or logging: [If relevant]
- Follow-ups: [If relevant]

## 9. Rejected Approaches

- [Alternative] — [Why it was not chosen]
- [Alternative] — [Why it was not chosen]
