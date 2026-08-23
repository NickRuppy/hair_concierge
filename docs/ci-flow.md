# CI Flow

This repo uses CI to keep deterministic product behavior strict while avoiding live, flaky, or path-irrelevant gates on every pull request.

## Required Checks

Use these checks as required branch-protection checks:

- `quality-core`
- `playwright-smoke`
- `chat-live-smoke`
- `retrieval-gate`

Do not keep the old `quality` check required after this workflow lands. GitHub branch protection matches job names, so keeping `quality` required would block merges because that job no longer exists.

## Job Policy

`quality-core` runs on every pull request and push. It is the non-negotiable gate for typecheck, lint, production build, and deterministic contract tests.

`playwright-smoke` runs only when frontend, app route, auth, middleware, Supabase client, or smoke-test paths changed and live Supabase secrets are available. It still appears as a job on every pull request and prints why it skipped.

`chat-live-smoke` runs only when chat, agent, recommendation, prompt, eval, Langfuse, or relevant config paths changed and live AI/Supabase secrets are available. In CI smoke mode, hard failures fail the job; soft heuristic failures are reported but do not fail the job.

`retrieval-gate` runs only when retrieval, product-chunk ingestion, index, product data, or retrieval eval paths changed.

## Path Overrides

Add `[ci full]`, `[full ci]`, `[run all ci]`, or `[ci:full]` to the PR title or body to run all path-aware gates.

The path classifier lives in `scripts/ci/path-rules.mjs`; its behavior is covered by `tests/ci-path-rules.test.ts`.

## Dependency Patches

`patches/` holds `patch-package` patches applied by `npm install` / `npm ci` (`postinstall`). Keep them minimal and documented in the patched source.

- `patches/next+*.patch` — serializes the watchpack `aggregated` handler in Next's dev bundler (`next/dist/server/lib/router-utils/setup-dev-bundler.js`). Upstream runs the handler concurrently; on a slow filesystem the initial scan emits a storm of partial route snapshots, the invocations race, and if a partial snapshot assigns `fsChecker.dynamicRoutes` last, dynamic routes missing from it (for example `/labs/personal-plan-application/[dayType]`) 404 for the rest of the `next dev` process. This surfaced as the intermittent `quality-personal-plan-journey` failure on the deep-link test (`GET .../wash_day 404` in the dev-server log). Static routes are unaffected because the dev router has an `ensure` fallback for them. `next start` is unaffected.
  - On a Next bump, `postinstall` runs `patch-package --error-on-fail`, so `npm ci` / `npm install` fail if a hunk no longer applies; a version mismatch that still applies only prints a warning — re-read the patched region in the new Next version to confirm it still serializes the handler. Re-apply the edit and run `npx patch-package next` to regenerate, or drop the patch once upstream serializes the handler. Startup still resolves on the first watcher pass (upstream behaviour), so a partial table can be current for a moment while the queue drains — instead of for the rest of the process.

## Cutover Checklist

1. Merge the workflow change.
2. Update branch protection required checks from `quality` to the required checks above.
3. Open a low-risk docs-only PR and confirm path-aware jobs appear and skip with clear explanations.
4. Open or re-run a frontend/chat/retrieval PR and confirm the relevant live gate runs.

## Local Verification

Before changing CI policy, run:

```sh
npm run typecheck
npm run lint
npm run build
npm run test:contracts
npx tsx --test tests/ci-path-rules.test.ts tests/eval-chat-client.test.ts tests/eval-chat-report.test.ts
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/ci.yml'); YAML.load_file('.github/dependabot.yml')"
```
