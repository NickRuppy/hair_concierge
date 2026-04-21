---
name: build-plan
description: Use when Hair Concierge has an approved design direction or feature spec and needs a repo-specific implementation plan in `plans/` with scope boundaries, file mapping, verification notes, and the correct execution handoff.
---

# Hair Concierge Plan Writing

Wrap `superpowers:writing-plans` with repo-specific output rules.

## Use This When

- `plan-grill` already settled the important unknowns
- a non-trivial feature has an approved design direction or spec
- the next step is a plan that another agent can execute cleanly

## Required Output

- Write design specs to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- Write implementation plans to `plans/YYYY-MM-DD-<topic>.md`
- Keep the standard `writing-plans` header and checkbox task format
- Treat the approved spec as the single source of product intent
- If the spec is missing a scoping table, reader line, or promised end-state, tighten the spec before planning

## Plan Rules

- Start with the spec link, the user situation being solved, and the promised end-state
- Include a target file map before the task list
- Call out explicit scope boundaries and non-goals
- Plan one chosen path only; do not carry multiple parallel implementation tracks into the plan
- Keep steps concrete, lean, and executable
- Split verification into automated checks and manual/browser checks
- Make the first verification steps prove the promised end-state, not just low-level mechanics
- If the work touches UI, onboarding, recommendations, copy, or trust, note that `ready-check` is required before shipping
- If external evidence mattered, reference `hair-care-expert` output separately from internal product logic

## Handoff

After the plan is written:

1. run `branch-gate`
2. create a repo-local worktree
3. use `superpowers:subagent-driven-development` by default
4. use `superpowers:executing-plans` only when the task sequence is tightly coupled

End by naming the next skill explicitly so the workflow continues cleanly.
