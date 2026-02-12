Run the full ship-to-production pipeline. Stop immediately if any step fails.

## Pre-flight context
- Git status: !`git status --short`
- Branch: !`git branch --show-current`
- Changes: !`git diff --stat`

If there are no uncommitted changes, inform the user and stop.

## Step 1: Type Check
Run `npx tsc --noEmit`. If there are TypeScript errors, stop and report them.
Do NOT proceed if this fails.

## Step 2: Build Verification
Run `npm run build`. If the build fails, stop and report the errors.
Do NOT proceed if this fails.

## Step 3: Code Review
Launch the code-reviewer agent (via Task tool) to review all uncommitted changes.
Wait for it to complete. If it reports any CRITICAL issues, stop and report them.
Do NOT proceed to testing or pushing.

## Step 4: E2E Browser Test
Launch the e2e-browser-tester agent (via Task tool) to test the deployed app
at https://hair-concierge.vercel.app. Test core user flows:
navigation, chat, sign-out, profile page.
Wait for it to complete. If it reports failures, stop and explain what failed.

## Step 5: Commit & Push
If all previous steps passed:
1. Stage changed files (use specific file names, not `git add -A`)
2. If the user provided $ARGUMENTS, use that as the commit message. Otherwise, generate a clear commit message summarizing the changes.
3. Push to origin/main.

## Reporting
Report each step as [PASS] or [FAIL].
Final summary: SHIPPED or BLOCKED.
Do not skip steps. Do not proceed past a failure.
