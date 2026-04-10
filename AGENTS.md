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

- Keep this lane fully separate from Tom's expertise unless the user explicitly asks for a comparison
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

### Combined workflow

When a category or spec change needs both research and implementation logic, use:

1. `hair-care-expert` first for external evidence and conflicts
2. `category-specific-recommendation` second to convert the chosen direction into product logic

### Do not mix these lanes by default

- External evidence lane: consensus-first, non-Tom
- Tom methodology lane: based on Tom materials, product tables, and project sources
- Reconciliation lane: only when the user explicitly wants Tom's guidance compared against external evidence

If the task is about matching or preserving Tom's advice, do not route it through `hair-care-expert` unless the user explicitly wants a second opinion.

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
- Only add to `questions-for-tom.md` when the question is specifically for Tom and cannot be resolved from external evidence or local project context
