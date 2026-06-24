# Chaarlie — Project Instructions

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

### `plan-hardening-loop`

Use for:

- creating, hardening, or reviewing non-trivial implementation plans
- "grill me" planning sessions that should end in a plan
- running Claude review on a plan and revising until implementation handoff is clean
- implementing a written plan or starting subagent-driven implementation from a finalized plan
- planning frontend or visual work where HTML mockups should be compared before choosing a direction

Rules:

- Treat it as a skill that contains a loop: grill, compare options, write/update plan, run Claude review, revise accepted findings, and repeat only when blockers changed materially.
- If the kickoff is rough, first interview the user for goal, context, constraints, non-goals, and "done when" before starting the autonomous loop.
- Before implementing a plan, establish an Implementation Goal Contract before file edits. If Goal mode is available, set it; otherwise print the contract and treat it as the controlling objective.
- Short approvals like "good, implement", "go", or "do subagent-driven implementation" must not skip the goal contract. They only authorize the implementation kickoff.
- Present 2-3 options for meaningful design forks, not every factual clarification question.
- Prefer comparing similarly scoped architecture or UX directions over defaulting to "small vs medium vs large".
- Explain tradeoffs in simple language: what gets easier, what gets harder, and what risk remains.
- For frontend or visual decisions, create lightweight HTML mockups before asking the user to choose when layout, hierarchy, copy density, or interaction shape matters.
- Stop for user input only when a product decision, risk acceptance, or scope choice cannot be made from local context.

### Combined workflow

When a category or spec change needs both research and implementation logic, use:

1. `hair-care-expert` first for external evidence and conflicts
2. `category-specific-recommendation` second to convert the chosen direction into product logic

### Do not mix these lanes by default

- External evidence lane: consensus-first, independent of internal guidance
- Internal guidance lane: based on internal source materials, product tables, and project sources
- Reconciliation lane: only when the user explicitly wants internal guidance compared against external evidence

If the task is about matching or preserving current internal recommendation logic, do not route it through `hair-care-expert` unless the user explicitly wants a second opinion.

## Plan Mode

When entering plan mode for any task:

1. **Options first** — Before writing a detailed plan, present 2-3 distinct implementation approaches as a comparison table:

   | Approach | Complexity | Effort | Tradeoffs | Best when... |
   |----------|-----------|--------|-----------|--------------|
   | A: Name  | Low/Med/High | ~X hrs | Pro / Con | condition |
   | B: Name  | ...       | ...    | ...       | ...          |

2. **Let the user choose** — Use `AskUserQuestion` with the approaches as options. Include a short recommendation if one approach is clearly better.

3. **Then plan** — Only after the user picks an approach, write the detailed plan file with implementation steps, file paths, and verification criteria. Do not include specs from rejected approaches.

For trivial tasks (single file, <20 lines changed), skip the options table and plan directly.

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

- Put implementation plans in `plans/` when a written plan is needed
- Put reusable project docs in `docs/` when they should outlive the current task
- Only add to `questions-for-domain-review.md` when the question requires internal domain review and cannot be resolved from external evidence or local project context
