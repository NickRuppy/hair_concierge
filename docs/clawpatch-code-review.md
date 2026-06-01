# Clawpatch Code Review Workflow

Clawpatch is adopted as an additional review tool for implementation branches where a semantic feature map is useful. It does not replace `$code-reviewer`, local tests, product review, or domain review.

Use `docs/codex-review-map.md` as the repo-specific lens for deciding which functional slice to review and which checks prove the finding or fix.

## When To Use It

Use Clawpatch for:

- cross-cutting chat, recommendation, trace, Supabase, or prompt changes
- branches with enough files that a plain diff review is likely to miss contracts
- pre-PR review when the change needs explicit finding tracking
- revalidation after fixing a material review finding

Skip it for:

- tiny copy-only changes
- single-file mechanical fixes
- research-only or plan-only work
- domain evidence review, where `hair-care-expert` is the right lane

## First Run In A Worktree

Run Clawpatch inside the task worktree:

```bash
npm run clawpatch:init
npm run clawpatch:doctor
npm run clawpatch:map
npm run clawpatch:status
```

The generated `.clawpatch/` directory is local state and is ignored by git. It may contain feature maps, findings, reports, locks, runs, and patch attempts.

## Review Loop

Review in small batches:

```bash
npm run clawpatch:review -- --limit 5
npm run clawpatch:report
npm run clawpatch:next
```

For a specific finding:

```bash
npm run clawpatch:next
npm run clawpatch:revalidate -- --finding <finding-id>
```

Use `npm run clawpatch:fix -- --finding <finding-id>` only when you intentionally want the tool to attempt one explicit patch. Keep the worktree clean before running a fix, then inspect `git diff` manually.

After a fix:

```bash
npm run clawpatch:revalidate -- --finding <finding-id>
git diff
```

Then run the relevant checks from the review map before treating the patch as ready.

## Hair Concierge Review Lens

Clawpatch findings should be reconciled against the product-specific risks this repo cares about:

- German user-facing copy and UI behavior
- `hair_texture` as pattern and `thickness` as diameter
- deterministic recommendation logic and conservative fallbacks
- product `recommendation_meta` consistency
- prompt-managed behavior and Langfuse trace shape
- Supabase migration and persistence safety
- medically adjacent scalp or hair-loss caveats

If Clawpatch finds a plausible issue but the evidence is weak, mark it as uncertain or false positive after checking the relevant code and tests.

## Validation

The shared config gives Clawpatch these default commands:

```bash
npm run typecheck
npm run lint
npm run test:node
```

The shared format command is intentionally unset because the historical repo is not globally Prettier-clean. Use changed-file formatting where relevant.

For chat, recommendation, and trace work, add the relevant contract, Playwright, or eval commands from `package.json` before considering a branch ready.
Use the current review-map slice names: `Chat memory, state, and traces` for runtime state/debug trace work, and `Product matching and catalog chunks` for catalog chunk ingestion or retrieval-eval changes.

## GitHub Automation

The `Clawpatch` workflow runs on pull requests, weekly on `main`, and by manual dispatch.

It always:

- installs dependencies with Node 22 because Clawpatch requires Node 22+
- installs `@openai/codex` when the `OPENAI_API_KEY` GitHub secret is available
- runs `npm run clawpatch:init` to create local `.clawpatch/` state from `clawpatch.config.json`
- runs `npm run clawpatch:map`
- generates `clawpatch-summary.md` from `.clawpatch/features`
- uploads feature-map artifacts
- writes the summary to the GitHub job summary

It runs provider-backed review only when the runner has both `OPENAI_API_KEY` and `codex` available:

```bash
npm run clawpatch:review -- --since origin/main --limit 10
npm run clawpatch:report -- --output clawpatch-report.md
```

If Codex CLI or the secret is unavailable, the workflow still succeeds with a map-only report. Keep this job non-blocking until CI provider auth is proven stable and the false-positive rate is understood.
