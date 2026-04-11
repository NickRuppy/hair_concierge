# Hair Concierge — Project Instructions

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
2. **Codex review** — Run `/codex:rescue` on the full branch diff (`git diff main...HEAD`). This catches integration-level issues (wrong API flags, outdated library patterns, cross-file problems) that per-task reviews miss.
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
