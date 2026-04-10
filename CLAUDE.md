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

## Project Conventions

- All UI text is in German
- Vocabulary: `hair_texture` = pattern (straight/wavy/curly/coily), `thickness` = diameter (fine/normal/coarse)
- No over-engineering — only build what's requested, no speculative abstractions
- Supabase project ID: `pqdkhefxsxkyeqelqegq`
- Use TDD (test-first) for deterministic logic in `src/lib/routines/`, `src/lib/rag/router/`, `src/lib/quiz/`

## Ship Workflow

Standard finish command: use the `/ship` agent when implementation is done.
- Runs: type check → build → simplify → review → **confirm with user** → commit & push
- Pre-commit hooks catch lint/type errors on every commit
- CI runs on every PR as a required check before merge
- PRs use squash-merge to keep main history clean
- Override confirmation with `--yes` flag when needed
- Before calling `/ship`, verify your changes work end-to-end (run the app, test the flow manually or via Playwright)
