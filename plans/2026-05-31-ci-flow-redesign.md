# CI Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Hair Concierge CI into truthful, path-aware checks that keep deterministic failures blocking, classify live smoke failures by confidence, require security checks, and reduce stale dependency-update noise.

**Architecture:** Keep one GitHub Actions CI workflow, but split the single `quality` job into named jobs with separate check identities: `quality-core`, `playwright-smoke`, `chat-live-smoke`, and `retrieval-gate`. Move path and `[full-ci]` detection into a small tested Node module so workflow conditions stay readable. Convert live chat smoke output into a CI verdict that hard-fails only on deterministic/hard product failures and reports soft LLM wording heuristics as advisory.

**Tech Stack:** GitHub Actions, Node 22, npm, Next.js, TypeScript, Playwright, Supabase-backed test users, existing `tsx --test` / Playwright contracts, GitHub branch protection.

---

**Spec / Alignment Source:** Current thread CI grill on May 31, 2026.

**User Situation:** PRs are failing in CI, and the goal is not to make CI easier to pass blindly. Good failures should stay blocking; stale, brittle, or poorly classified failures should become clearer and less noisy.

**Promised End State:**
- A red CI check tells reviewers what kind of risk failed.
- Deterministic app correctness remains a hard merge gate.
- Live chat and Playwright checks still protect product behavior, but are path-aware and distinguish environment/fixture/soft heuristic failures from hard regressions.
- Security checks are intended branch-protection requirements.
- Node runtime policy is aligned to Node 22 if verification passes.
- Dependabot grouping keeps high-risk vendors separate.

## Settled Decisions

- Live chat smoke is a **hybrid gate**.
- CI uses **multiple named checks**, not one overloaded `quality`.
- Playwright smoke is a **hybrid, path-aware gate**.
- Path rules are selective by default, with optional `[full-ci]` marker in the PR title/body to force broader checks.
- Security checks should be required in branch protection.
- Dependabot should keep high-risk dependency families split; broad catch-all production groups should not swallow Stripe/Next/React/Supabase/AI-observability.
- Move repo CI/local runtime to Node 22 if clean verification passes; otherwise keep app CI on Node 20 and isolate Clawpatch on Node 22.
- Implement from a plan file first, then step by step.

## Explicit Non-Goals

- Do not weaken TypeScript, lint, build, deterministic contracts, security, or dependency-review standards.
- Do not remove live chat or Playwright coverage.
- Do not rewrite product recommendation logic as part of CI work.
- Do not make CI pass by ignoring failures globally.
- Do not change production Supabase data schema for this task.
- Do not change GitHub branch protection until the new check names have run at least once on a PR branch.

## Target File Map

- Modify: `.github/workflows/ci.yml`
  - Split `quality` into `detect-ci-scope`, `quality-core`, `playwright-smoke`, `chat-live-smoke`, `retrieval-gate`.
  - Use always-present jobs so branch protection can require stable check names.
  - Remove stale Linux native-binding install if verification confirms `npm ci` is enough.
- Modify: `.github/workflows/security.yml`
  - Keep existing dependency review and CodeQL jobs; document/verify required check names.
- Modify: `.github/workflows/clawpatch.yml`
  - Keep Node 22 and align cache/runtime style with repo policy if needed.
- Modify: `scripts/ci/changed-paths.mjs`
  - Delegate path classification to a pure module and keep GitHub output writing.
- Create: `scripts/ci/path-rules.mjs`
  - Pure path and marker classifier for `chat_eval`, `retrieval_eval`, `playwright_smoke`, `full_ci`, `security_scan`.
- Create: `tests/ci-path-rules.test.ts`
  - Unit tests for path-classification behavior.
- Modify: `scripts/eval-chat/assertions.ts`
  - Mark the existing `must_be_german` substring heuristic as a soft CI assertion while leaving metadata, DB, product-count, policy, and judge failures hard.
- Modify: `scripts/eval-chat/report.ts`
  - Compute/report hard vs soft failures.
- Modify: `scripts/eval-chat/run.ts`
  - Exit non-zero only when CI hard failures are present; keep local/full eval strict enough outside `--ci-smoke`.
- Modify: `scripts/eval-chat/client.ts`
  - Confirm active billing entitlement seeding remains present and surfaces setup errors clearly.
- Modify: `package.json`
  - Add CI-focused scripts if needed, add Node engines if Node 22 verification passes.
- Modify: `.nvmrc`
  - Change from `20` to `22` only after local verification.
- Modify: `.github/dependabot.yml`
  - Tighten broad grouping only if it can still group high-risk packages accidentally.
- Optional create: `docs/ci-flow.md`
  - Only if implementation needs a durable branch-protection checklist or check-name policy.

## Task 1: Extract And Test CI Path Classification

**Files:**
- Create: `scripts/ci/path-rules.mjs`
- Modify: `scripts/ci/changed-paths.mjs`
- Create: `tests/ci-path-rules.test.ts`

- [ ] **Step 1: Add the pure classifier**

Create `scripts/ci/path-rules.mjs`:

```js
const CHAT_PREFIXES = [
  "src/lib/agent/",
  "src/lib/agent-v2/",
  "src/lib/langfuse/",
  "src/lib/openai/",
  "src/lib/recommendation-engine/",
  "src/lib/rag/",
  "src/lib/routines/",
  "src/app/api/chat/",
  "data/agent-guidance/",
  "data/agent-v2/",
  "scripts/eval-chat/",
]

const CHAT_EXACT = ["docs/langfuse-quality-loop.md"]

const RETRIEVAL_PREFIXES = [
  "src/lib/rag/retrieval/",
  "src/lib/rag/retriever.ts",
  "src/lib/rag/product-list-chunks.ts",
  "src/lib/rag/retrieval-telemetry.ts",
  "scripts/ingest-",
  "scripts/eval-retrieval.ts",
  "supabase/migrations/",
]

const RETRIEVAL_EXACT = ["tests/fixtures/retrieval-gold-set.json"]

const PLAYWRIGHT_PREFIXES = [
  "src/app/",
  "src/components/",
  "src/providers/",
  "src/lib/auth/",
  "src/lib/stripe/",
  "src/lib/paypal/",
  "src/lib/supabase/",
  "playwright.config.",
]

const PLAYWRIGHT_EXACT = [
  "src/middleware.ts",
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "tests/e2e-smoke.spec.ts",
  "tests/profile-editorial-v3.spec.ts",
  "tests/profile-page-smoke.spec.ts",
  "tests/helpers/auth.ts",
]

const SECURITY_PREFIXES = [".github/workflows/", "supabase/migrations/"]
const SECURITY_EXACT = ["package.json", "package-lock.json", ".github/dependabot.yml"]

function matches(file, prefixes, exact) {
  return exact.includes(file) || prefixes.some((prefix) => file.startsWith(prefix))
}

export function hasFullCiMarker({ prTitle = "", prBody = "" } = {}) {
  return /\[full-ci\]/i.test(`${prTitle}\n${prBody}`)
}

export function classifyCiScope(files, prContext = {}) {
  const fullCi = hasFullCiMarker(prContext)
  return {
    chat_eval: fullCi || files.some((file) => matches(file, CHAT_PREFIXES, CHAT_EXACT)),
    retrieval_eval: fullCi || files.some((file) => matches(file, RETRIEVAL_PREFIXES, RETRIEVAL_EXACT)),
    playwright_smoke:
      fullCi || files.some((file) => matches(file, PLAYWRIGHT_PREFIXES, PLAYWRIGHT_EXACT)),
    security_scan:
      fullCi || files.some((file) => matches(file, SECURITY_PREFIXES, SECURITY_EXACT)),
    full_ci: fullCi,
  }
}
```

- [ ] **Step 2: Update `changed-paths.mjs` to use the classifier**

Replace the hardcoded prefix arrays in `scripts/ci/changed-paths.mjs` with:

```js
#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { classifyCiScope } from "./path-rules.mjs"

const ciBaseRef = process.env.CI_BASE_REF?.trim()
const githubBaseRef = process.env.GITHUB_BASE_REF?.trim()

const baseRef = ciBaseRef || (githubBaseRef ? `origin/${githubBaseRef}` : "origin/main")
const headRef = process.env.CI_HEAD_REF?.trim() || "HEAD"
const diffBase = baseRef

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim()
}

function changedFiles() {
  try {
    return git(["diff", "--name-only", `${diffBase}...${headRef}`])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return git(["diff", "--name-only", "HEAD~1...HEAD"])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  }
}

const files = changedFiles()
const outputs = classifyCiScope(files, {
  prTitle: process.env.PR_TITLE ?? "",
  prBody: process.env.PR_BODY ?? "",
})

for (const [key, value] of Object.entries(outputs)) {
  const line = `${key}=${value ? "true" : "false"}`
  console.log(line)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`)
}

if (files.length > 0) {
  console.log("")
  console.log("Changed files:")
  for (const file of files) console.log(`- ${file}`)
}
```

- [ ] **Step 3: Add unit tests**

Create `tests/ci-path-rules.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import { classifyCiScope, hasFullCiMarker } from "../scripts/ci/path-rules.mjs"

test("full CI marker in PR title forces all path-aware gates", () => {
  assert.equal(hasFullCiMarker({ prTitle: "Update docs [full-ci]" }), true)
  assert.deepEqual(classifyCiScope(["docs/readme.md"], { prTitle: "[full-ci] docs" }), {
    chat_eval: true,
    retrieval_eval: true,
    playwright_smoke: true,
    security_scan: true,
    full_ci: true,
  })
})

test("frontend route changes run Playwright but not chat or retrieval evals", () => {
  const scope = classifyCiScope(["src/app/profile/page.tsx"])
  assert.equal(scope.playwright_smoke, true)
  assert.equal(scope.chat_eval, false)
  assert.equal(scope.retrieval_eval, false)
})

test("chat engine changes run chat eval and Playwright when user flow may be affected", () => {
  const scope = classifyCiScope(["src/app/api/chat/route.ts"])
  assert.equal(scope.chat_eval, true)
  assert.equal(scope.playwright_smoke, true)
})

test("retrieval fixture changes run retrieval gate only", () => {
  const scope = classifyCiScope(["tests/fixtures/retrieval-gold-set.json"])
  assert.equal(scope.retrieval_eval, true)
  assert.equal(scope.chat_eval, false)
  assert.equal(scope.playwright_smoke, false)
})

test("workflow and dependency changes mark security scan relevant", () => {
  assert.equal(classifyCiScope([".github/workflows/ci.yml"]).security_scan, true)
  assert.equal(classifyCiScope(["package-lock.json"]).security_scan, true)
})
```

- [ ] **Step 4: Run classifier tests**

Run:

```bash
npx tsx --test tests/ci-path-rules.test.ts
```

Expected: all five tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add scripts/ci/path-rules.mjs scripts/ci/changed-paths.mjs tests/ci-path-rules.test.ts
git commit -m "test(ci): cover path-aware gate selection"
```

## Task 2: Split The CI Workflow Into Truthful Checks

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace the monolithic job with named jobs**

Rewrite `.github/workflows/ci.yml` so the job names are stable:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co' }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder' }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY || 'placeholder' }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY || 'sk-placeholder' }}
  COHERE_API_KEY: ${{ secrets.COHERE_API_KEY || 'placeholder' }}
  HAS_LIVE_SUPABASE_SECRETS: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL != '' && secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY != '' && secrets.SUPABASE_SERVICE_ROLE_KEY != '' }}
  HAS_LIVE_AI_SECRETS: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL != '' && secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY != '' && secrets.SUPABASE_SERVICE_ROLE_KEY != '' && secrets.OPENAI_API_KEY != '' && secrets.COHERE_API_KEY != '' }}

jobs:
  detect-ci-scope:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      chat_eval: ${{ steps.changes.outputs.chat_eval }}
      retrieval_eval: ${{ steps.changes.outputs.retrieval_eval }}
      playwright_smoke: ${{ steps.changes.outputs.playwright_smoke }}
      security_scan: ${{ steps.changes.outputs.security_scan }}
      full_ci: ${{ steps.changes.outputs.full_ci }}
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - name: Detect changed paths
        id: changes
        env:
          CI_BASE_REF: ${{ github.event_name == 'push' && github.event.before || '' }}
          CI_HEAD_REF: ${{ github.sha }}
          PR_TITLE: ${{ github.event.pull_request.title || '' }}
          PR_BODY: ${{ github.event.pull_request.body || '' }}
        run: node scripts/ci/changed-paths.mjs

  quality-core:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Typecheck
        run: npm run typecheck
      - name: Lint
        run: npm run lint
      - name: Build
        run: npm run build
      - name: Run deterministic contract tests
        run: npm run test:contracts

  playwright-smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: [detect-ci-scope, quality-core]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: npm
      - name: Explain skip
        if: needs.detect-ci-scope.outputs.playwright_smoke != 'true' || env.HAS_LIVE_SUPABASE_SECRETS != 'true'
        run: |
          echo "Playwright smoke skipped."
          echo "playwright_smoke=${{ needs.detect-ci-scope.outputs.playwright_smoke }}"
          echo "HAS_LIVE_SUPABASE_SECRETS=$HAS_LIVE_SUPABASE_SECRETS"
      - name: Install dependencies
        if: needs.detect-ci-scope.outputs.playwright_smoke == 'true' && env.HAS_LIVE_SUPABASE_SECRETS == 'true'
        run: npm ci
      - name: Build app for smoke server
        if: needs.detect-ci-scope.outputs.playwright_smoke == 'true' && env.HAS_LIVE_SUPABASE_SECRETS == 'true'
        run: npm run build
      - name: Install Playwright browsers
        if: needs.detect-ci-scope.outputs.playwright_smoke == 'true' && env.HAS_LIVE_SUPABASE_SECRETS == 'true'
        run: npx playwright install --with-deps chromium
      - name: Run Playwright smoke tests
        if: needs.detect-ci-scope.outputs.playwright_smoke == 'true' && env.HAS_LIVE_SUPABASE_SECRETS == 'true'
        run: npx start-server-and-test 'npm run start' http://localhost:3000 'npx playwright test --grep @ci --project=chromium'
      - name: Upload Playwright artifacts
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: playwright-smoke-${{ github.run_id }}
          path: |
            test-results/
            tests/results/
            tests/screenshots/
          if-no-files-found: ignore
          retention-days: 7

  chat-live-smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: [detect-ci-scope, quality-core]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: npm
      - name: Explain skip
        if: needs.detect-ci-scope.outputs.chat_eval != 'true' || env.HAS_LIVE_AI_SECRETS != 'true'
        run: |
          echo "Live chat smoke skipped."
          echo "chat_eval=${{ needs.detect-ci-scope.outputs.chat_eval }}"
          echo "HAS_LIVE_AI_SECRETS=$HAS_LIVE_AI_SECRETS"
      - name: Install dependencies
        if: needs.detect-ci-scope.outputs.chat_eval == 'true' && env.HAS_LIVE_AI_SECRETS == 'true'
        run: npm ci
      - name: Build app for smoke server
        if: needs.detect-ci-scope.outputs.chat_eval == 'true' && env.HAS_LIVE_AI_SECRETS == 'true'
        run: npm run build
      - name: Run live chat smoke eval
        if: needs.detect-ci-scope.outputs.chat_eval == 'true' && env.HAS_LIVE_AI_SECRETS == 'true'
        run: npx start-server-and-test 'npm run start' http://localhost:3000 'npm run test:chat:ci'
      - name: Upload chat artifacts
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: chat-live-smoke-${{ github.run_id }}
          path: test-results/chat-eval/
          if-no-files-found: ignore
          retention-days: 7

  retrieval-gate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [detect-ci-scope, quality-core]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: npm
      - name: Explain skip
        if: needs.detect-ci-scope.outputs.retrieval_eval != 'true'
        run: echo "No retrieval/indexing paths changed; retrieval gate skipped."
      - name: Install dependencies
        if: needs.detect-ci-scope.outputs.retrieval_eval == 'true'
        run: npm ci
      - name: Run retrieval metrics gate
        if: needs.detect-ci-scope.outputs.retrieval_eval == 'true'
        run: npm run test:retrieval:ci
```

- [ ] **Step 2: Run workflow syntax validation locally**

Run:

```bash
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/ci.yml'); puts 'ci yaml ok'"
```

Expected: `ci yaml ok`.

- [ ] **Step 3: Run core verification locally**

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:contracts
```

Expected: all pass.

- [ ] **Step 4: Commit Task 2**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: split quality gates by risk type"
```

## Task 3: Make Chat Live Smoke Hybrid Instead Of Brittle-All-Or-Nothing

**Files:**
- Modify: `scripts/eval-chat/types.ts`
- Modify: `scripts/eval-chat/assertions.ts`
- Modify: `scripts/eval-chat/report.ts`
- Modify: `scripts/eval-chat/run.ts`
- Verify: `scripts/eval-chat/client.ts`

- [ ] **Step 1: Ground the hard/soft split in the recent failing run**

Before editing, inspect the latest `chat-eval` artifact from PR `#138` or a newer failing `chat-live-smoke` run:

```bash
gh run download 26710571335 -n test-results -D /tmp/hair-chat-eval-review || true
node -e "const fs=require('fs'); const p='/tmp/hair-chat-eval-review/test-results/chat-eval/chat-eval-2026-05-31T11-17-28.json'; if (fs.existsSync(p)) { const r=require(p); for (const s of r.scenarios.filter(x=>!x.passed)) console.log(JSON.stringify(s.turns.map(t=>({turn:t.turn_index,message:t.message,content:t.sse_result.content,done:t.sse_result.done_data,assertions:t.assertions.filter(a=>!a.passed)})), null, 2)); }"
```

Expected: the OWC failure includes a hard intent mismatch (`general_chat`) plus a soft German-marker miss. The intent mismatch should still block; the German marker should not be the reason a PR fails.

- [ ] **Step 2: Add assertion severity to types**

In `scripts/eval-chat/types.ts`, extend `AssertionResult`:

```ts
export interface AssertionResult {
  tier: "metadata" | "content" | "db" | "judge"
  name: string
  passed: boolean
  expected: string
  actual: string
  severity?: "hard" | "soft"
}
```

- [ ] **Step 3: Mark language-marker heuristic as soft**

In `scripts/eval-chat/assertions.ts`, update only the `must_be_german` result:

```ts
results.push({
  tier: "content",
  name: "must_be_german",
  passed: germanHits.length >= 3,
  expected: ">=3 German markers",
  actual: `${germanHits.length} markers (${germanHits.slice(0, 5).join(", ")})`,
  severity: "soft",
})
```

Leave metadata checks, `product_count_min`, policy overrides, DB persistence, `required_keywords`, `forbidden_keywords`, and explicit judge failures hard unless a later reviewed failing run proves one of those is a soft-only heuristic. CI currently runs `test:chat:ci` with `--skip-judge`, so judge failures are not expected in the CI path.

- [ ] **Step 4: Add report helpers for hard failures**

In `scripts/eval-chat/report.ts`, add:

```ts
function isHardAssertionFailure(assertion: { passed: boolean; severity?: "hard" | "soft" }) {
  return !assertion.passed && assertion.severity !== "soft"
}

export function countHardAssertionFailures(scenarios: ScenarioResult[]): number {
  return scenarios.reduce(
    (sum, scenario) =>
      sum +
      scenario.turns.reduce(
        (turnSum, turn) => turnSum + turn.assertions.filter(isHardAssertionFailure).length,
        0,
      ),
    0,
  )
}
```

In `printSummary`, add hard/soft counts:

```ts
const hardFailures = countHardAssertionFailures(scenarios)
const softFailures = summary.assertion_failures - hardFailures
console.log(`  Hard assertion failures: ${hardFailures}`)
console.log(`  Soft assertion failures: ${softFailures}`)
```

- [ ] **Step 5: Replace the final process exit with hard-failure-aware logic**

In `scripts/eval-chat/run.ts`, import `countHardAssertionFailures` and replace the current final hard exit:

```ts
process.exit(report.summary.failed > 0 ? 1 : 0)
```

with:

```ts
const hardFailures = countHardAssertionFailures(results)

if (ciSmoke) {
  process.exit(hardFailures > 0 ? 1 : 0)
} else if (report.summary.failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
```

Use the existing `ciSmoke` variable from `run.ts`; do not introduce an `options` object. This replacement is required because leaving the old `process.exit(report.summary.failed > 0 ? 1 : 0)` in place would still fail on soft-only scenarios.

- [ ] **Step 6: Confirm entitlement seeding is current**

Open `scripts/eval-chat/client.ts` and verify it still upserts both:

```ts
subscription_status: "active"
```

and a `billing_subscriptions` row with:

```ts
provider_status: "active",
entitlement_status: "active",
```

This is a confirm-only step if the current branch already contains both writes. If missing, add the billing upsert used by the recent `chat-ci-billing-seed` fix before sign-in.

- [ ] **Step 7: Run chat harness unit-level tests**

Run:

```bash
npx tsx --test tests/eval-chat-client.test.ts
```

Expected: pass.

- [ ] **Step 8: Commit Task 3**

```bash
git add scripts/eval-chat/types.ts scripts/eval-chat/assertions.ts scripts/eval-chat/report.ts scripts/eval-chat/run.ts scripts/eval-chat/client.ts tests/eval-chat-client.test.ts
git commit -m "ci: classify live chat smoke failures by severity"
```

## Task 4: Validate Or Remove The Linux Native-Binding Install Workaround

**Files:**
- Modify: `.github/workflows/ci.yml` only if verification proves the workaround is no longer needed.

- [ ] **Step 1: Verify lockfile contains Linux native packages**

Run:

```bash
rg -n "@tailwindcss/oxide-linux-x64-gnu|lightningcss-linux-x64-gnu" package-lock.json
```

Expected: both packages appear in `package-lock.json`.

- [ ] **Step 2: Treat lockfile + GitHub Actions as the load-bearing Linux proof**

This decision cannot be proven by a macOS local build alone. The local worktree can confirm the app still builds, but Linux optional native dependency coverage is proven by:
- the lockfile containing `@tailwindcss/oxide-linux-x64-gnu` and `lightningcss-linux-x64-gnu`
- the first GitHub Actions run after removing the workaround passing `quality-core` on `ubuntu-latest`

- [ ] **Step 3: Verify clean local install/build as a secondary check**

Run:

```bash
rm -rf node_modules .next
npm ci
npm run build
```

Expected: build passes without manually running `npm install --no-save @tailwindcss/oxide-linux-x64-gnu lightningcss-linux-x64-gnu`.

- [ ] **Step 4: Keep or remove**

If Step 1 passes, ensure `.github/workflows/ci.yml` does not include the old `Install Linux-only native bindings` step. The final proof is the PR's `quality-core` run on Ubuntu.

If the PR's Ubuntu `quality-core` fails specifically because native optional packages are missing, restore the workaround in `quality-core` with a comment that says verification failed on this date.

- [ ] **Step 5: Commit Task 4 if there is a workflow change**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: rely on lockfile native bindings"
```

If there is no diff, do not commit.

## Task 5: Align Node Runtime To Node 22 If Verification Passes

**Files:**
- Modify: `.nvmrc`
- Modify: `package.json`
- Modify: `package-lock.json`
- Review: `.github/workflows/clawpatch.yml`

- [ ] **Step 1: Change `.nvmrc`**

Replace `.nvmrc` contents:

```text
22
```

- [ ] **Step 2: Add package engines**

In `package.json`, add below `"private": true`:

```json
"engines": {
  "node": ">=22 <23"
},
```

- [ ] **Step 3: Align Node type package if needed**

If `package.json` still has `@types/node` pinned to a Node 20 range, update it to Node 22:

```json
"@types/node": "^22"
```

- [ ] **Step 4: Regenerate lockfile metadata**

Run:

```bash
npm install --package-lock-only
```

Expected: `package-lock.json` updates only if npm needs to record engine metadata.

- [ ] **Step 5: Verify on Node 22**

Run:

```bash
node --version
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:contracts
```

Expected: Node reports v22.x and all commands pass.

- [ ] **Step 6: Roll back Node 22 if verification fails for runtime reasons**

If Node 22 fails because an app dependency is incompatible, revert `.nvmrc`, `package.json` engines, and lockfile changes for this task only:

```bash
git checkout -- .nvmrc package.json package-lock.json
```

Then add a note to this plan's execution log that app CI stays Node 20 while Clawpatch remains Node 22.

- [ ] **Step 7: Commit Task 5 only if Node 22 verification passes**

```bash
git add .nvmrc package.json package-lock.json .github/workflows/clawpatch.yml
git commit -m "ci: align project runtime on Node 22"
```

## Task 6: Tighten Dependabot Grouping Review

**Files:**
- Modify: `.github/dependabot.yml` only if current groups can still create broad high-risk production PRs.

- [ ] **Step 1: Inspect current group overlap**

Run:

```bash
sed -n '1,140p' .github/dependabot.yml
```

Expected: high-risk families have explicit groups:
- `stripe-dependencies`
- `next-react-dependencies`
- `supabase-dependencies`
- `ai-observability-dependencies`

- [ ] **Step 2: Keep low-risk catch-all excluded from high-risk families**

Ensure `production-patch-minor.exclude-patterns` contains:

```yaml
          - "stripe"
          - "@stripe/*"
          - "next"
          - "react"
          - "react-dom"
          - "@supabase/*"
          - "openai"
          - "cohere-ai"
          - "@langfuse/*"
          - "@opentelemetry/*"
          - "@sentry/*"
```

- [ ] **Step 3: Decide whether to add PayPal as high-risk**

If payment-gateway updates should behave like Stripe, add:

```yaml
      paypal-dependencies:
        dependency-type: production
        patterns:
          - "@paypal/*"
```

and exclude `@paypal/*` from `production-patch-minor`.

Default implementation choice: add PayPal to high-risk grouping, because checkout/subscription changes are product-critical like Stripe.

- [ ] **Step 4: Validate Dependabot YAML**

Run:

```bash
ruby -e "require 'yaml'; YAML.load_file('.github/dependabot.yml'); puts 'dependabot yaml ok'"
```

Expected: `dependabot yaml ok`.

- [ ] **Step 5: Commit Task 6 if changed**

```bash
git add .github/dependabot.yml
git commit -m "ci: keep high-risk dependency updates separate"
```

## Task 7: Document Branch-Protection Cutover

**Files:**
- Optional create: `docs/ci-flow.md`

- [ ] **Step 1: Create a small durable CI policy doc only if useful**

Create `docs/ci-flow.md` if the team needs a branch-protection checklist:

```md
# CI Flow

Required checks for `main` after the CI split has run once:

- `quality-core`
- `playwright-smoke`
- `chat-live-smoke`
- `retrieval-gate`
- `dependency-review`
- `codeql (javascript-typescript)`
- `codeql (actions)`

`chat-live-smoke` is a hybrid gate: hard assertion failures and judge failures block; soft wording heuristics are reported but do not block.

`playwright-smoke` is path-aware. Add `[full-ci]` to the PR title or body to force all path-aware gates.
```

- [ ] **Step 2: Plan the branch-protection cutover before expecting the PR to merge**

The introducing PR cannot merge while branch protection still requires the old `quality` check if the new workflow no longer emits a job named `quality`. Coordinate an admin/settings cutover after the first PR run creates the new check names.

Current required check observed during audit:

```text
quality
```

Target required checks:

```text
quality-core
playwright-smoke
chat-live-smoke
retrieval-gate
dependency-review
codeql (javascript-typescript)
codeql (actions)
```

Cutover order:
1. Open the draft PR and let the new workflow run once so GitHub knows the replacement check names.
2. Inspect the first run and fix any workflow syntax/server-build issues.
3. Update branch protection in one settings/API change: remove `quality`, add the target checks above.
4. Re-run the PR checks after branch protection is updated.
5. Merge only after the target checks are green or intentionally classified.

If the repository cannot temporarily update branch protection during the PR, use an admin merge or a two-PR rollout where PR 1 keeps a compatibility `quality` aggregator job and PR 2 removes it after branch protection is changed.

- [ ] **Step 3: Commit docs if created**

```bash
git add docs/ci-flow.md
git commit -m "docs: record CI gate policy"
```

## Task 8: End-To-End Verification And PR Readiness

**Files:**
- All changed files.

- [ ] **Step 1: Run local deterministic verification**

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:contracts
npx tsx --test tests/ci-path-rules.test.ts
npx tsx --test tests/eval-chat-client.test.ts
```

Expected: all pass.

- [ ] **Step 2: Open a draft PR and inspect checks**

Push the branch and open a draft PR.

Expected check names:

```text
quality-core
playwright-smoke
chat-live-smoke
retrieval-gate
dependency-review
codeql (javascript-typescript)
codeql (actions)
review
```

- [ ] **Step 3: Confirm path-aware behavior on this PR**

Because this PR touches `.github/workflows/ci.yml`, `scripts/ci/`, `.nvmrc`, `package.json`, and tests, expected path outputs are:

```text
chat_eval=false unless eval-chat files changed in Task 3
retrieval_eval=false
playwright_smoke=true if package/runtime or workflow changes are classified as browser-impacting
security_scan=true
full_ci=false unless [full-ci] was added
```

If Task 3 changes `scripts/eval-chat/`, `chat_eval=true` is expected.

- [ ] **Step 4: Inspect CI logs for skip clarity**

Each skipped job should be green and explain why it skipped. A skipped path-aware job must not leave branch protection pending.

- [ ] **Step 5: Classify any red check**

Use this policy:
- `quality-core` red: fix before merge.
- `dependency-review` / `codeql` red: fix or explicitly decide a security exception.
- `chat-live-smoke` red: inspect report; hard failures block, soft-only language marker failures should not fail the job.
- `playwright-smoke` red: inspect whether it is app-flow breakage or live fixture/environment setup. App-flow breakage blocks; obvious fixture drift should be fixed in test setup.
- `retrieval-gate` red: fix retrieval behavior or intentionally update thresholds/fixtures in a separate review.

- [ ] **Step 6: Final implementation handoff**

After CI passes or remaining failures are intentionally classified, request code review before merging because this changes merge policy and branch-protection semantics.

## Verification Summary

Automated checks:
- `npx tsx --test tests/ci-path-rules.test.ts`
- `npx tsx --test tests/eval-chat-client.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:contracts`
- GitHub Actions draft PR run for all new check names.

Manual / GitHub checks:
- Confirm branch protection still blocks deterministic failures.
- Confirm skipped path-aware jobs complete green with clear summaries.
- Confirm Security checks are added as required checks after the new CI run exists.
- Confirm `[full-ci]` in PR title/body forces path-aware gates.
- Confirm Node 22 is either fully adopted with passing verification or explicitly deferred.

## Open Risks

- Branch protection changes are outside the repo and need a GitHub settings/API follow-up.
- Node 22 can reveal dependency/runtime issues; adopt only if verification passes.
- Live Supabase-backed tests can still fail when shared remote data or secrets drift; this plan narrows classification but does not eliminate the need to maintain test fixtures.
- Job splitting increases total install time because jobs run in separate runners. This is acceptable for clearer merge policy; later optimization can add caches or split contracts further.

## Execution Handoff

Next skill: use `superpowers:subagent-driven-development` for the implementation, with one subagent per task and review between tasks. If the workflow edits turn out tightly coupled, switch to `superpowers:executing-plans` and checkpoint after Tasks 1, 3, 5, and 8.
