# Hair Concierge — Project Instructions

## Role of This File

`AGENTS.md` is the project-level orchestration layer.

- Skills live at user level under `~/.codex/skills`
- This file tells Codex when to use those skills in this repo
- Prefer the minimal skill set that covers the task
- State the chosen skill(s) and the order when it matters

## Skill Orchestration

### `hair-care-expert`

Use for:

- external best-practice research for any hair-care topic
- defining or critiquing recommendation rules based on evidence
- auditing chat answers for overreach, myths, weak claims, or missing caveats
- reviewing rough feature specs before implementation
- medically adjacent or evidence-sensitive hair-care questions

Rules:

- Keep this lane fully separate from internal methodology unless the user explicitly asks for a comparison
- Prefer scientific evidence, consensus, regulatory guidance, and reputable professional practice
- It is valid to conclude that evidence is weak or inconclusive
- Default output shape:
  - Research summary
  - Conflicts
  - Implementation proposal
  - Open risks

### `category-specific-recommendation`

Use for:

- redesigning or implementing one product category at a time
- turning a noisy recommendation flow into explicit user-facing questions
- defining deterministic mappings, fallback rules, response metadata, and tests

### `build-plan`

Use for:

- turning an approved design direction into a Hair Concierge implementation plan
- keeping plan files in `plans/`
- enforcing file maps, scope boundaries, and verification notes without extra ceremony

### `ready-check`

Use for:

- repo-specific verification before claiming a change is ready
- deciding when a local dev server, browser pass, `simulated-user-review`, and code review are required

### `ship-it`

Use for:

- repo-specific finishing flow after a branch is verified
- defaulting to commit, push, draft PR, and task-worktree cleanup
- keeping merge and deployment as explicit follow-up decisions

### Combined workflow

When a category or spec change needs both research and implementation logic, use:

1. `hair-care-expert` first for external evidence and conflicts
2. `category-specific-recommendation` second to convert the chosen direction into product logic

### Do not mix these lanes by default

- External evidence lane: consensus-first, independent of internal guidance
- Internal guidance lane: based on internal source materials, product tables, and project sources
- Reconciliation lane: only when the user explicitly wants internal guidance compared against external evidence

If the task is about matching or preserving current internal recommendation logic, do not route it through `hair-care-expert` unless the user explicitly wants a second opinion.

## Feature Delivery Workflow

For non-trivial feature work or behavior changes, use this order:

1. `plan-grill` first to settle outcome, non-goals, constraints, and verification
2. `superpowers:brainstorming` second to turn the aligned direction into an approved design spec
3. `build-plan` third to write the implementation plan in `plans/`
4. `branch-gate`, then a repo-local worktree via `npm run worktree:new -- <slug>`
5. `superpowers:subagent-driven-development` by default; use `superpowers:executing-plans` only when the work is tightly coupled
6. `ready-check` before claiming the branch is ready
7. `ship-it` to finish the branch

For trivial tasks, keep the flow lighter and skip the design/spec stages when they would add no real value.

## Plan Mode

When entering plan mode for any non-trivial task:

1. **Use `plan-grill` first** to resolve the unknowns that actually change scope, architecture, UX, or verification
2. **Options first** — Before writing a detailed plan, present 2-3 distinct implementation approaches as a comparison table:

   | Approach | Complexity | Effort | Tradeoffs | Best when... |
   |----------|-----------|--------|-----------|--------------|
   | A: Name  | Low/Med/High | ~X hrs | Pro / Con | condition |
   | B: Name  | ...       | ...    | ...       | ...          |

3. **Let the user choose** — Use `AskUserQuestion` with the approaches as options. Include a short recommendation if one approach is clearly better.
4. **Then plan** — Only after the user picks an approach, use `build-plan` to write the implementation plan. Do not include rejected approaches in the final plan.

For trivial tasks (single file, under ~20 lines changed), skip the options table and plan directly if there are no meaningful unresolved decisions.

## Execution Discipline

- Route before you explain; start by identifying the user situation and the decision or path that applies
- Think before coding; surface uncertainty, tradeoffs, and simpler options before implementation
- Prefer the minimum viable change; no speculative abstractions, no parallel tracks unless explicitly requested
- Make surgical edits; every changed line should trace back to the requested outcome
- Define one concrete success state and verify against it, not just against activity or effort

## Spec Writing Rules

Design specs in `docs/superpowers/specs/` should be written for a fresh Codex or Claude Code session with no prior context on the feature.

- Open with a scoping table, not a long preamble
- Frame the problem in the user or business situation being resolved, not in internal module names
- State one concrete promised end-state near the top
- Choose one canonical implementation path; alternatives belong in `Rejected approaches`, not inline
- Keep the top skim-complete, the middle execute-complete, and the bottom reference-complete
- Make the spec self-contained enough to paste into a fresh session without requiring several other files to make sense
- Prefer markdown-first structure with clear headings and no essential information hidden in screenshots, tabs, or visual-only artifacts

## QA Rules

- `ready-check` is required for UI, onboarding, recommendation, copy, and trust-facing changes
- Those changes should be checked in a task worktree with `npm run dev:worktree`, a browser/manual pass on the changed flow, `simulated-user-review`, and code review
- Backend-only or internal changes still need fresh automated verification and code review, but `simulated-user-review` is optional
- If a user-facing change crosses into medically adjacent or evidence-sensitive territory, use `hair-care-expert` for a second pass

## Shipping Policy

- Default finish path: verify, stage, commit, push, open a draft PR
- After a successful push and draft PR, clean up the repo-local task worktree unless the user explicitly wants to keep it
- Merge always asks
- Merge and deployment are separate decisions; never assume a production rollout from a push, PR, or merge
- If merge is requested, clarify only if needed whether the user means a local merge, GitHub merge, or a separate deploy/release step

## Project Conventions

- All UI text is in German
- Vocabulary: `hair_texture` = pattern (straight/wavy/curly/coily), `thickness` = diameter (fine/normal/coarse)
- No over-engineering — only build what's requested, no speculative abstractions
- Keep recommendation logic as deterministic as the evidence allows
- Do not present weak evidence as a hard rule
- Separate cosmetic hair-care guidance from medically adjacent scalp or hair-loss guidance
- When evidence is mixed, keep the product behavior conservative and explicit about uncertainty
- Supabase project ID: `pqdkhefxsxkyeqelqegq`

## Git Workflow

- Default to repo-local worktrees for new implementation work, fixes, and parallel investigations
- Treat the root checkout as the stable base checkout; do not switch branches in place for new tasks unless the user explicitly asks
- Create task worktrees under `.worktrees/<slug>` on branches `codex/<slug>`, based on `origin/main` when available
- Use `npm run worktree:new -- <slug>` to create a bootstrapped worktree
- Use `npm run dev:worktree` inside a worktree so parallel runs do not fight over the same port

## Working Outputs

- Put design specs in `docs/superpowers/specs/`
- Use `docs/superpowers/specs/_template.md` as the default spec shape unless a task clearly needs a leaner variant
- Version repo-local copies of reusable workflow skills in `.claude/skills/` and keep local runtime copies in `~/.codex/skills/` aligned
- Put implementation plans in `plans/`
- Put reusable project docs in `docs/` when they should outlive the current task
- Only add to `questions-for-domain-review.md` when the question requires internal domain review and cannot be resolved from external evidence or local project context
