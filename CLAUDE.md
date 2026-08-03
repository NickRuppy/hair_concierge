# Chaarlie — Project Instructions

## Plan Mode

When entering plan mode for any task:

1. **Options first** — Before writing a detailed plan, present 2-3 distinct implementation approaches as a comparison table:

   | Approach | Complexity   | Effort | Tradeoffs | Best when... |
   | -------- | ------------ | ------ | --------- | ------------ |
   | A: Name  | Low/Med/High | ~X hrs | Pro / Con | condition    |
   | B: Name  | ...          | ...    | ...       | ...          |

2. **Let the user choose** — Use `AskUserQuestion` with the approaches as options. Include a short recommendation if one approach is clearly better.

3. **Then plan** — Create or reuse the task worktree, then write the chosen plan under `plans/`. Do not include rejected approaches.

For trivial non-user-facing tasks (single file, <20 lines changed), skip the options table and plan directly. User-facing work still requires the mockup and journey gates below even when the eventual code diff is small.

## User-Facing Planning Gates

Before any user-facing implementation:

1. Inspect the current product surface and create at least one reviewable mockup during planning. Use an annotated current/proposed screenshot for a small existing-surface change, a wireframe for a new flow, or rendered lightweight HTML for layout and responsive behavior. For copy-only work, show the before/after copy inside the real component layout. Markdown, ASCII, detached copy samples, and prose-only descriptions do not count as mockups for an existing surface.
2. Show 2-3 variants for a meaningful visual fork, use realistic German copy, and include responsive or critical loading/error/recovery states when they materially affect the experience.
3. If interaction, changing state, or a logic model cannot be judged from static evidence, first name the question and decision criterion, then invoke the repo's `prototype` skill as a higher-fidelity branch of this mockup step. Record what it proved and rewrite retained behavior through the normal production implementation and test workflow.
4. Present the relevant evidence to Nick, incorporate feedback, and record evidence review as confirmed in the implementation plan.
5. Translate the final design into a concrete user journey: entry state, ordered user actions and system responses, meaningful variants, error/recovery states, and completion.
6. Walk Nick through that journey and obtain explicit sign-off. Earlier general plan approval does not satisfy the evidence or journey gate.

Do not invoke `executing-plans` or `subagent-driven-development` while evidence review or user-journey sign-off is missing or pending. Purely backend work may skip user-facing evidence only when the plan explicitly states that no surface, copy, timing, or user-visible feedback changes.

## Branch Gate

Before writing a persistent plan or invoking `executing-plans` or `subagent-driven-development`, invoke `branch-gate` first.

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
- Keep the root checkout on a clean `main`; `worktree:new` fetches and fast-forwards it
- Create or reuse `.worktrees/<slug>` on `codex/<slug>` before writing persistent plans or implementation changes
- Use `npm run worktree:new -- <slug>` to create a bootstrapped worktree
- Use `npm run dev:worktree` inside a worktree so parallel runs do not fight over the same port
- Include the chosen plan and durable mockup or prototype evidence in the PR; keep transient review output outside the repo and explicitly archive or discard it

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
4. **Resolve artifacts** — Commit, archive, or discard every task-owned artifact.
5. **Push + PR** — Push only a clean task worktree. The PR is the durable record.

## Ship Workflow

Standard finish command: use the `/ship` agent when implementation is done.

- Runs: type check → build → simplify → review → **confirm with user** → commit & push
- Pre-commit hooks catch lint/type errors on every commit
- CI runs on every PR as a required check before merge
- PRs use squash-merge to keep main history clean
- Override confirmation with `--yes` flag when needed
- Before calling `/ship`, verify your changes work end-to-end (run the app, test the flow manually or via Playwright)

`/ship` remains publish-only. After it returns a PR, a later explicit **“merge it”** authorizes verified-head squash merge plus guarded cleanup of that exact task:

1. Refresh final PR, check, review, migration, and content-fingerprint state. Refuse admin bypasses and merge only the reviewed head with `gh pr merge <number> --squash --match-head-commit <reviewed-head-sha>`.
2. Verify GitHub reports the PR merged and record the merge SHA.
3. From the primary root checkout on `main`, run `npm run worktree:finish -- --pr <number>`; when the dry run passes, run it again with `--apply` without asking for another confirmation.
4. Report root sync, remote branch, worktree, local branch, and any preserved blocker. Deployment and production writes remain separate.

**“Merge but keep the worktree until <condition>”** is the rare opt-out: perform the same verified-head merge, lock the retained worktree with `git worktree lock --reason`, retain its local branch, and record the release condition. Delete the remote branch only when no dependent PR or collaborator needs it. Do not run the finisher until the worktree is intentionally released and unlocked.

## Session Start

- Run `/checkin` at the start of each session to review priorities and plan the day's work
- If the dev server is running, consider running `npm run test:chat` to catch any regressions early
