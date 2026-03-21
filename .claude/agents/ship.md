---
name: ship
description: Adaptive ship-to-production pipeline with type check, build, simplify, review, and optional E2E.
---

Run the adaptive ship-to-production pipeline. Stop immediately if any step fails.

## Pre-flight

Run these commands to gather context:

```bash
git status --short
git branch --show-current
git diff --stat
git diff --numstat
```

If `git status --short` produces no output (no uncommitted changes), report "Nothing to ship" and stop.

Compute `total_changed_lines` as the sum of all additions + deletions from `git diff --numstat`.
Compute `changed_file_count` from the number of lines in `git diff --numstat`.
Save the list of changed file paths for use in tier classification and Step 6.

## Tier Classification

Check for a manual override first, then auto-classify.

### Manual override
If the user's prompt starts with `--light`, `--standard`, or `--full`, use that tier.
Strip the flag; the remainder becomes the commit message.

### Auto-classification rules (apply in order, first match wins)

**FULL** — any of:
- 15+ changed files
- 800+ total changed lines
- Any changed file matches: root `middleware.ts`, `next.config.ts`, `package.json`, `tsconfig.json`, any `.sql` file, or a NEW file under `src/app/` (new route)

**STANDARD** — any of:
- 4+ changed files
- 150+ total changed lines
- Any changed file matches: `src/app/api/**`, `src/lib/rag/**`, `src/providers/auth-provider.tsx`, `src/app/auth/**`, `src/lib/supabase/middleware.ts`

**LIGHT** — everything else (≤3 files, ≤150 lines, no sensitive paths)

### Announce
Print the tier, the reason, and the pipeline steps that will run. Examples:
```
TIER: LIGHT (2 files changed, 45 lines)
Pipeline: Type Check > Build > Commit & Push
```
```
TIER: STANDARD (6 files changed, 210 lines)
Pipeline: Type Check > Build > Simplify > Re-verify > Code Review > Commit & Push
```
```
TIER: FULL (18 files changed, 920 lines, includes .sql)
Pipeline: Type Check > Build > Simplify > Re-verify > Code Review > E2E > Commit & Push
```

## Pipeline Steps

### Step 1: Type Check [ALL TIERS]
Run `npx tsc --noEmit`.
If there are errors, stop and report them. Do NOT proceed.
Report [PASS] or [FAIL].

### Step 2: Build [ALL TIERS]
Run `npm run build`.
If the build fails, stop and report the errors. Do NOT proceed.
Report [PASS] or [FAIL].

### Step 3: Simplify [STANDARD, FULL only]
If tier is LIGHT, report [SKIP] and move on.

Launch the code-simplifier agent (subagent_type: `code-simplifier`). Tell it to review
the changed files for reuse opportunities, clarity, consistency, and maintainability,
and to apply fixes directly.

This step [PASS]es if the agent completes (whether or not it made changes).
It only [FAIL]s if the agent errors out or cannot complete.

### Step 3b: Re-verify [STANDARD, FULL only — runs only if Step 3 made changes]
If Step 3 was skipped or made no changes, report [SKIP].

Otherwise re-run `npx tsc --noEmit`. If new type errors were introduced by simplification,
stop and report them. Do NOT proceed.
Report [PASS] or [FAIL].

### Step 4: Code Review [STANDARD, FULL only]
If tier is LIGHT, report [SKIP] and move on.

Launch the code-reviewer agent (subagent_type: `code-reviewer`). Tell it to review all
uncommitted changes (including any simplifications from Step 3).

A CRITICAL issue is one that would cause runtime errors, data loss, or security vulnerabilities.
If the reviewer reports any CRITICAL issues, stop and report them. Do NOT proceed.
Report [PASS] or [FAIL].

### Step 5: E2E Browser Test [FULL only]
If tier is LIGHT or STANDARD, report [SKIP] and move on.

Note: this tests the *currently deployed* version at the production URL as a smoke check.
The current changes have not been deployed yet — this verifies the deploy target is healthy
before pushing.

Launch the e2e-browser-tester agent (subagent_type: `e2e-browser-tester`). Tell it to test
https://hair-concierge.vercel.app — core flows: navigation, chat, sign-out, profile page.

If it reports failures, stop and explain what failed. Report [PASS] or [FAIL].

### Step 6: Commit & Push [ALL TIERS]
If all previous steps passed (or were skipped):
1. Re-run `git status --short` to get the current list of changed files (may differ from pre-flight if the simplifier made changes).
2. Stage changed files by name (never use `git add -A` or `git add .`).
3. If the user provided a commit message, use that. Otherwise, generate a clear commit message summarizing the changes.
4. Commit, then push to the current branch's remote.

Report [PASS] or [FAIL].

## Final Report

Print a summary table:

```
| Step         | Status |
|--------------|--------|
| Type Check   | PASS   |
| Build        | PASS   |
| Simplify     | PASS   |
| Re-verify    | SKIP   |
| Code Review  | PASS   |
| E2E          | SKIP   |
| Commit & Push| PASS   |
```

Then a final line:
```
SHIPPED (STANDARD) — 6 files, 210 lines
```
or
```
BLOCKED (STANDARD) — Step 2 Build failed
```

Do not skip mandatory steps. Do not proceed past a failure.
