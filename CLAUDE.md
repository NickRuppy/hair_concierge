# Chaarlie — Project Instructions

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

## Branch Gate

Before invoking `executing-plans` or `subagent-driven-development`, always invoke the `branch-gate` skill first. This is mandatory — no exceptions.

## Multi-Model Orchestration

The main interactive session (intended: Fable 5) is the orchestrator: it decomposes work into small, independent, specifiable units and dispatches each to the cheapest model that can do it well. The main session stays lean — it plans, routes, integrates, and reviews; it does not personally do execution volume.

**Execution routing (Agent tool, `model` override):**
- **Sonnet** — default execution tier: mechanical/multi-file edits, boilerplate, well-scoped tasks with clear acceptance criteria, test-fixing to a known oracle.
- **Opus** — judgment tier: ambiguous scope, German UI copy, UX/taste calls, tricky deterministic logic in `src/lib/routines/`, `src/lib/rag/router/`, `src/lib/quiz/` (the main session owns the test-first design; Opus implements to green).
- Bias toward Sonnet; escalate to Opus only when the task needs judgment.

**Decomposition discipline:**
- Split only genuinely independent, specifiable units — dispatched subagents do NOT share the main session's conversation context, so each brief must be self-contained.
- Do not shatter tightly-coupled work into context-starved subagents; keep coupled logic in one unit.
- Use `superpowers:dispatching-parallel-agents` for 2+ independent tasks and `subagent-driven-development` when executing a written plan. Run `branch-gate` first (mandatory).

**The main session does these itself — never delegated:**
- Architecture, task decomposition, routing, final review/integration.
- Edits to `.claude/*`, `CLAUDE*.md`, and `AGENTS.md`.

**Codex (GPT) — reviewer & second-opinion lane:**
- Use the `codex:codex-rescue` agent (via the Agent tool with `subagent_type: "codex:codex-rescue"`), never the `/codex:rescue` skill (it stalls silently).
- Do not pin a model — it inherits the global Codex default from `~/.codex/config.toml`, so it tracks the configured default. Add `--effort xhigh` for these deeper passes.
- Use for: whole-branch review before push (see "Finishing a Feature Branch"), plan review on non-trivial plans, and any "stuck / want an independent second opinion" moment.
- Every review brief must explicitly say: `read-only, review only, do not edit files`; never pass `--write`.
- A session invoked as a reviewer is terminal: review and return the verdict; do not dispatch the other model for another review.

**Verify every delegated result — never rubber-stamp.** Read the full diff, run `npm run ci:verify` or the relevant tests, drive the affected flow. Reject false positives; keep only what checks out.

## Git Workflow

- Default to repo-local worktrees for new implementation work, fixes, and parallel investigations
- Treat the root checkout as the stable base checkout; do not switch branches in place for new tasks unless the user explicitly asks
- Create task worktrees under `.worktrees/<slug>` on branches `codex/<slug>`, based on `origin/main` when available
- Use `npm run worktree:new -- <slug>` to create a bootstrapped worktree
- Use `npm run dev:worktree` inside a worktree so parallel runs do not fight over the same port

## Project Conventions

- All UI text is in German
- Vocabulary: `hair_texture` = pattern (straight/wavy/curly/coily), `thickness` = diameter (fine/normal/coarse)
- No over-engineering — only build what's requested, no speculative abstractions
- Supabase project ID: `pqdkhefxsxkyeqelqegq`
- Use TDD (test-first) for deterministic logic in `src/lib/routines/`, `src/lib/rag/router/`, `src/lib/quiz/`

## Finishing a Feature Branch

When all tasks on a worktree/feature branch are complete, follow this order before pushing:

1. **Verify** — `npm run ci:verify` passes (typecheck + lint + build)
2. **Codex review** — Fetch the latest remote refs, then invoke the `codex:codex-rescue` agent (via the Agent tool with `subagent_type: "codex:codex-rescue"`) on the full branch diff (`git diff origin/main...HEAD`) with an explicit `read-only, review only, do not edit files` brief and no `--write`. Do NOT use the `/codex:rescue` skill — it has been observed stalling silently. This step catches integration-level issues (wrong API flags, outdated library patterns, cross-file problems) that per-task reviews miss.
3. **Fix findings** — Address any real issues Codex found. Skip false positives.
4. **Push + PR** — Only now push and create the PR. The PR should be the clean artifact, not the iteration ground.

## Ship Workflow

Standard finish command: use the `/ship` agent when implementation is done.
- Runs: type check → build → simplify → review → **confirm with user** → commit & push
- Pre-commit hooks catch lint/type errors on every commit
- CI runs on every PR as a required check before merge
- PRs use squash-merge to keep main history clean
- Override confirmation with `--yes` flag when needed
- Before calling `/ship`, verify your changes work end-to-end (run the app, test the flow manually or via Playwright)

## Session Start

- Run `/checkin` at the start of each session to review priorities and plan the day's work
- If the dev server is running, consider running `npm run test:chat` to catch any regressions early
