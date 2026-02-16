Run the adaptive ship-to-production pipeline. Stop immediately if any step fails.

## Pre-flight context
- Git status: !`git status --short`
- Branch: !`git branch --show-current`
- Diff stats: !`git diff --stat`
- Diff numstat: !`git diff --numstat`

If there are no uncommitted changes, inform the user and stop.

## Tier Classification

Classify the change into one of three tiers. Check for a manual override first, then auto-classify.

### Manual override
If `$ARGUMENTS` starts with `--light`, `--standard`, or `--full`, use that tier. Strip the flag from the arguments; the remainder becomes the commit message.

### Auto-classification rules (apply in order, first match wins)

**FULL** — any of:
- 15+ changed files
- 800+ total changed lines (sum of additions + deletions from numstat)
- Any changed file matches: root `middleware.ts`, `next.config.ts`, `package.json`, `tsconfig.json`, any `.sql` file, or a NEW file under `src/app/` (new route)

**STANDARD** — any of:
- 4+ changed files
- 150+ total changed lines
- Any changed file matches a sensitive path: `src/app/api/**`, `src/lib/rag/**`, `src/providers/auth-provider.tsx`, `src/app/auth/**`, `src/lib/supabase/middleware.ts`

**LIGHT** — everything else (≤3 files, ≤150 lines, no sensitive paths)

### Announce
Print the tier and the reason before starting. Example:
```
TIER: STANDARD (6 files changed, 210 lines)
Pipeline: Type Check > Build > Code Review > Commit & Push
```

## Pipeline Steps

### Step 1: Type Check [ALL TIERS]
Run `npx tsc --noEmit`. If there are TypeScript errors, stop and report them.
Do NOT proceed if this fails. Report [PASS] or [FAIL].

### Step 2: Build Verification [ALL TIERS]
Run `npm run build`. If the build fails, stop and report the errors.
Do NOT proceed if this fails. Report [PASS] or [FAIL].

### Step 3: Code Review [STANDARD, FULL only]
If tier is LIGHT, report [SKIP] and move on.
Otherwise: Launch the code-reviewer agent (via Task tool) to review all uncommitted changes.
Wait for it to complete. If it reports any CRITICAL issues, stop and report them.
Do NOT proceed to testing or pushing. Report [PASS] or [FAIL].

### Step 4: E2E Browser Test [FULL only]
If tier is LIGHT or STANDARD, report [SKIP] and move on.
Otherwise: Launch the e2e-browser-tester agent (via Task tool) to test the deployed app
at https://hair-concierge.vercel.app. Test core user flows:
navigation, chat, sign-out, profile page.
Wait for it to complete. If it reports failures, stop and explain what failed.
Report [PASS] or [FAIL].

### Step 5: Commit & Push [ALL TIERS]
If all previous steps passed (or were skipped):
1. Stage changed files (use specific file names, not `git add -A`)
2. If the user provided a commit message (from `$ARGUMENTS` after stripping any tier flag), use that. Otherwise, generate a clear commit message summarizing the changes.
3. Push to origin/main.
Report [PASS] or [FAIL].

## Final Report
Print a summary table of all steps with their status, then a final line:
```
SHIPPED (LIGHT) — 2 files, 12 lines
```
or
```
BLOCKED (STANDARD) — Step 2 Build failed
```
Do not skip mandatory steps. Do not proceed past a failure.
