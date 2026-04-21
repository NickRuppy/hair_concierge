---
name: ready-check
description: Use when a Hair Concierge change has been implemented and needs repo-specific verification before claiming readiness, especially for UI, onboarding, recommendation, copy, or trust-facing work.
---

# Hair Concierge QA Gate

Wrap verification with the checks this product needs before a branch is treated as ready.

## Always

- Start by checking the promised end-state from the approved spec or plan, not just the diff
- Follow `superpowers:verification-before-completion`
- Run fresh automated checks that match the risk of the change
- Report evidence, not confidence
- Request code review before shipping
- If the promised end-state is not observable yet, stop and report what is still missing

## If The Change Is UI, Onboarding, Recommendation, Copy, Or Trust-Facing

1. run the app from the task worktree with `npm run dev:worktree`
2. do a browser/manual pass on one meaningful changed flow
3. use `simulated-user-review`
4. then use `superpowers:requesting-code-review`

## If The Change Is Backend-Only Or Internal

- run targeted automated checks
- add broader checks when risk justifies them
- `simulated-user-review` is optional

## Escalate When Needed

- If the change affects medically adjacent or evidence-sensitive guidance, run `hair-care-expert` as a second pass
- If a user-visible flow is blocked in local review, report the blocker instead of papering over it

## Output

Summarize:

- promised end-state status
- automated verification run
- manual/browser evidence
- review findings or remaining risks
