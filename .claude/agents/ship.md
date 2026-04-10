---
name: ship
description: Adaptive ship-to-production pipeline with type check, build, simplify, review, chat eval, codex review, optional E2E, branch protection, and post-deploy verification.
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
Save the list of changed file paths for use in tier classification and later steps.

## Tier Classification

Check for a manual override first, then auto-classify.

### Manual override
If the user's prompt starts with `--light`, `--standard`, or `--full`, use that tier.
If the user's prompt contains `--yes`, set AUTO_CONFIRM = true. Otherwise AUTO_CONFIRM = false.
Strip all flags; the remainder becomes the commit message.

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
Pipeline: Type Check > Build > Confirm > Commit & Push
```
```
TIER: STANDARD (6 files changed, 210 lines)
Pipeline: Type Check > Build > Simplify > Re-verify > Chat Eval > Code Review > Codex Review > Confirm > Commit & Push
```
```
TIER: FULL (18 files changed, 920 lines, includes .sql)
Pipeline: Type Check > Build > Simplify > Re-verify > Chat Eval > Code Review > Codex Review > E2E > Confirm > Commit & Push > Post-Deploy Verification > UX Audit
```

## Pipeline Steps

### Step 1: Type Check [ALL TIERS]
Run `npm run typecheck`.
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

Otherwise re-run `npm run typecheck`. If new type errors were introduced by simplification,
stop and report them. Do NOT proceed.
Report [PASS] or [FAIL].

### Step 3c: Chat Eval [STANDARD, FULL only]
If tier is LIGHT, report [SKIP] and move on.

Check whether any changed file matches:
- `src/lib/rag/**`
- `src/app/api/chat/**`
- `scripts/eval-chat/**`
- `src/lib/routines/**`

If NO changed files match these paths, report [SKIP] and move on.

If any match:

**Prerequisite check:** Before running the eval, verify the dev server is reachable:
```bash
curl -sf http://localhost:3000 > /dev/null
```
If the curl check fails, report: "Chat eval requires the dev server on localhost:3000. Start it with `npm run dev` and re-run /ship." and report [FAIL]. Do NOT proceed.

If the dev server is reachable, run `npm run test:chat`.

If chat eval fails, stop and report the failures. Do NOT proceed.
Report [PASS], [SKIP], or [FAIL].

### Step 4: Code Review [STANDARD, FULL only]
If tier is LIGHT, report [SKIP] and move on.

Launch the code-reviewer agent (subagent_type: `code-reviewer`). Tell it to review all
uncommitted changes (including any simplifications from Step 3).

A CRITICAL issue is one that would cause runtime errors, data loss, or security vulnerabilities.
If the reviewer reports any CRITICAL issues, stop and report them. Do NOT proceed.
Report [PASS] or [FAIL].

### Step 4b: Codex Review [STANDARD, FULL only]
If tier is LIGHT, report [SKIP] and move on.

Check whether any changed file matches:
- `src/lib/rag/**`
- `src/lib/routines/**`
- `src/lib/quiz/**`

If NO changed files match these paths, report [SKIP] and move on.

If any match, dispatch the `/codex` skill for a structural review of the changed files.
This step is **non-blocking**: report findings as advisory but do NOT stop the pipeline
on issues. Report [ADVISORY] with a summary of findings, or [SKIP] if no matching files.

### Step 5: E2E Browser Test [FULL only]
If tier is LIGHT or STANDARD, report [SKIP] and move on.

Note: this tests the *currently deployed* version at the production URL as a smoke check.
The current changes have not been deployed yet — this verifies the deploy target is healthy
before pushing.

Launch the e2e-browser-tester agent (subagent_type: `e2e-browser-tester`). Tell it to test
https://hair-concierge.vercel.app — core flows: navigation, chat, sign-out, profile page.

If it reports failures, stop and explain what failed. Report [PASS] or [FAIL].

### Step 6: Confirm [ALL TIERS]
If all previous steps passed (or were skipped):
1. Re-run `git status --short` to get the current list of changed files (may differ from pre-flight if the simplifier made changes).
2. Stage changed files by name (never use `git add -A` or `git add .`).
3. If the user provided a commit message, use that. Otherwise, generate a clear commit message summarizing the changes.
4. Show the user a preview:
   - Current branch name
   - `git diff --cached --stat` output
   - The proposed commit message
   - If the current branch is `main`, print a notice: "Branch is main — will create a ship/<slug> branch and open a PR."
5. If AUTO_CONFIRM is true, report [PASS] and proceed to Step 7.
   Otherwise, ask the user: "Proceed with commit and push? (yes/no)"
   - Only an explicit "yes" continues. Report [PASS].
   - "no" stops the pipeline. Report [ABORT].

### Step 7: Commit & Push [ALL TIERS]
1. Determine the current branch.
2. **If current branch is `main`:** Do NOT commit on main. Instead:
   a. Derive a slug from the commit message (lowercase, hyphens, max 40 chars). Example: "feat: add chat eval step" becomes `ship/add-chat-eval-step`.
   b. Create and checkout a new branch BEFORE committing: `git checkout -b ship/<slug>`.
   c. Commit with the confirmed message on the new branch.
   d. Push the new branch: `git push -u origin ship/<slug>`.
   e. Create a PR via `gh pr create --base main --head ship/<slug>` with the commit message as the title and a brief body.
   f. Report the PR URL.
3. **If current branch is NOT main:**
   a. Commit with the confirmed message.
   b. Push to the current branch's remote as usual: `git push`.

Report [PASS] or [FAIL].

### Step 8: Post-Deploy Verification [FULL only, optional]
If tier is not FULL, report [SKIP] and move on.
If Step 7 did NOT create a PR (i.e., was a direct branch push, not the main flow), report [SKIP] and move on.

Otherwise:
1. Wait 90 seconds for Vercel to deploy the preview.
2. Retrieve the Vercel preview URL from the PR (check the PR's deployment status or comments).
3. Launch the e2e-browser-tester agent (subagent_type: `e2e-browser-tester`). Tell it to test the Vercel preview URL — core flows: navigation, chat, sign-out, profile page.

This step is **optional** — if the preview URL is not available or the tester fails, report findings but do NOT fail the pipeline.
Report [PASS], [SKIP], or [WARN].

### Step 8b: UX Audit [FULL only, optional]
If tier is not FULL, report [SKIP] and move on.
If Step 8 was skipped (no preview URL available), report [SKIP] and move on.

Otherwise, run the `ux-check` skill against the Vercel preview URL from Step 8.
This step is **non-blocking**: report findings as advisory but do NOT fail the pipeline.
Report [ADVISORY] with a summary of findings, or [SKIP].

## Final Report

Print a summary table:

```
| Step                     | Status   |
|--------------------------|----------|
| Type Check               | PASS     |
| Build                    | PASS     |
| Simplify                 | PASS     |
| Re-verify                | SKIP     |
| Chat Eval                | SKIP     |
| Code Review              | PASS     |
| Codex Review             | ADVISORY |
| E2E                      | SKIP     |
| Confirm                  | PASS     |
| Commit & Push            | PASS     |
| Post-Deploy Verification | SKIP     |
| UX Audit                 | SKIP     |
```

Then a final line:
```
SHIPPED (STANDARD) — 6 files, 210 lines
```
or
```
BLOCKED (STANDARD) — Step 2 Build failed
```
or
```
ABORTED (STANDARD) — User declined at Step 6 Confirm
```

Do not skip mandatory steps. Do not proceed past a failure.
