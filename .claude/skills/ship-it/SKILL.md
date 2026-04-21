---
name: ship-it
description: Use when a verified Hair Concierge task branch is ready for repo-specific handoff, commit, push, draft PR creation, and safe worktree cleanup while keeping merge and deployment as explicit decisions.
---

# Hair Concierge Ship

Wrap the final branch-finishing steps with Hair Concierge defaults.

## Preconditions

- `ready-check` is complete when applicable
- `superpowers:verification-before-completion` has fresh evidence for any success claim

## Default Path

1. stage the intended changes
2. create a concise conventional commit
3. push the branch
4. open a draft PR by default
5. clean up the repo-local task worktree after the push and draft PR succeed, unless the user asked to keep it

## Merge And Deploy Rules

- Always ask before any merge
- Treat merge and deployment as separate decisions
- Never assume a production rollout from a push, PR, or merge
- If the user asks to merge and the target is ambiguous, clarify whether they mean local merge, GitHub merge, or a separate deploy step

## Cleanup Rules

- Do not remove a worktree with uncommitted changes
- If cleanup is blocked, report why and leave it intact
- If the branch must stay open for immediate follow-up work, keep the worktree only when the user asks
