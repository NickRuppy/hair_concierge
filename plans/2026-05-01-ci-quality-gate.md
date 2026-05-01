# CI Quality Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec source:** Current thread alignment on 2026-05-01. Chosen approach: B, a tiered quality gate.

**User situation being solved:** GitHub currently has one `quality` job, but it only partially reflects the app's current AI, recommendation, retrieval, and security risk profile.

**Promised end-state:** Normal PRs stay reasonably fast and mostly deterministic, while AI/RAG/recommendation changes automatically run a small live chat smoke eval, retrieval changes run metric gates, and full judged AI evals remain manual or scheduled.

**Goal:** Update CI so it catches important regressions without spending model/database budget on every PR.

**Architecture:** Keep `quality` as the required PR gate, but split its checks into deterministic checks, Playwright smoke, path-filtered live chat smoke, and path-filtered retrieval metrics. Add a separate security workflow for dependency review, CodeQL, and scheduled analysis. Keep the full judged Langfuse quality loop manual/scheduled rather than required on every PR.

**Tech Stack:** GitHub Actions, Node 20, npm, Next.js, TypeScript, Playwright, Node test runner via `tsx --test`, Supabase, OpenAI, Langfuse.

---

## Scope Boundaries

In scope:

- Add package scripts for deterministic Node tests, Playwright contract tests, small CI chat evals, and retrieval CI metrics.
- Add a first-party path filter script so CI does not need another third-party action for changed-file gating.
- Update `.github/workflows/ci.yml` with permissions, concurrency, timeouts, clearer steps, and conditional AI/retrieval checks.
- Add a security workflow and Dependabot config.
- Update docs so future PR authors know when live AI checks run.

Out of scope:

- Rewriting the chat eval harness into OpenAI Evals or another external framework.
- Making full judged evals block all PRs.
- Changing recommendation behavior, prompts, product logic, or retrieval algorithms.
- Fixing existing flaky tests unless they directly block the CI redesign.
- Changing production secrets or GitHub branch protection settings. The implementation can document required settings, but repo admins must apply them.

## Target File Map

- Modify: `.github/workflows/ci.yml`
  - Required PR quality gate with deterministic checks and conditional live evals.
- Create: `.github/workflows/security.yml`
  - Dependency review, CodeQL, scheduled security scan.
- Create: `.github/dependabot.yml`
  - Weekly npm and GitHub Actions update PRs.
- Modify: `package.json`
  - Add explicit CI scripts.
- Create: `scripts/ci/changed-paths.mjs`
  - Computes `chat_eval`, `retrieval_eval`, and `security_scan` outputs from changed files.
- Modify: `scripts/eval-chat/types.ts`
  - Add a `ci_smoke` flag to eval scenarios.
- Modify: `scripts/eval-chat/fixtures.ts`
  - Mark a small representative scenario set for PR CI.
- Modify: `scripts/eval-chat/run.ts`
  - Add `--ci-smoke` filtering and fail when no CI smoke scenarios exist.
- Modify: `scripts/eval-retrieval.ts`
  - Add CI thresholds and non-zero exit on metric failures.
- Modify: `docs/langfuse-quality-loop.md`
  - Document PR vs manual/nightly eval policy.

---

## Task 1: Add Stable CI Test Scripts

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add deterministic test scripts**

Edit the `scripts` block to keep existing scripts and add these entries:

```json
"test:node": "tsx --test tests/*.test.ts",
"test:playwright:contracts": "playwright test tests/chat-debug-trace.spec.ts tests/conditioner-reranker.spec.ts tests/leave-in-decision.spec.ts tests/mask-flow.spec.ts tests/oil-flow.spec.ts tests/routine-planner.spec.ts tests/shampoo-flow.spec.ts tests/stripe-gating.spec.ts tests/stripe-intervals.spec.ts tests/stripe-webhook-handlers.spec.ts tests/user-memory.spec.ts --project=chromium",
"test:contracts": "npm run test:node && npm run test:agent && npm run test:playwright:contracts",
"test:chat:ci": "tsx scripts/eval-chat/run.ts --skip-judge --ci-smoke",
"test:retrieval:ci": "tsx scripts/eval-retrieval.ts --hybrid-only --min-hybrid-ndcg10 0.72 --min-hybrid-recall20 0.88"
```

Keep the existing `test:chat`, `test:chat:judge`, and `test:chat:langfuse` scripts unchanged.

- [ ] **Step 2: Verify JSON is valid**

Run:

```bash
node -e "JSON.parse(require('node:fs').readFileSync('package.json', 'utf8')); console.log('package.json ok')"
```

Expected:

```text
package.json ok
```

- [ ] **Step 3: Run the deterministic scripts locally**

Run:

```bash
npm run test:node
npm run test:playwright:contracts
```

Expected: both commands exit `0`. If any existing test fails, capture the failing test name and decide whether the CI script should exclude it or the test should be fixed before the workflow is updated.

---

## Task 2: Add First-Party Changed-Path Detection

**Files:**

- Create: `scripts/ci/changed-paths.mjs`

- [ ] **Step 1: Create the path filter script**

Create `scripts/ci/changed-paths.mjs` with:

```js
#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"

const baseRef = process.env.CI_BASE_REF || process.env.GITHUB_BASE_REF || "origin/main"
const headRef = process.env.CI_HEAD_REF || "HEAD"
const diffBase = process.env.GITHUB_BASE_REF ? `origin/${baseRef}` : baseRef

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

const chatPrefixes = [
  "src/lib/agent/",
  "src/lib/langfuse/",
  "src/lib/openai/",
  "src/lib/recommendation-engine/",
  "src/lib/rag/",
  "src/lib/routines/",
  "src/app/api/chat/",
  "scripts/eval-chat/",
]

const chatExact = ["package.json", "package-lock.json", "docs/langfuse-quality-loop.md"]

const retrievalPrefixes = [
  "src/lib/rag/retrieval/",
  "src/lib/rag/retriever.ts",
  "src/lib/rag/product-list-chunks.ts",
  "src/lib/rag/retrieval-telemetry.ts",
  "scripts/ingest-",
  "scripts/eval-retrieval.ts",
  "supabase/migrations/",
]

const retrievalExact = ["tests/fixtures/retrieval-gold-set.json", "package.json", "package-lock.json"]

const securityPrefixes = [".github/workflows/", "supabase/migrations/"]
const securityExact = ["package.json", "package-lock.json", ".github/dependabot.yml"]

function matches(file, prefixes, exact) {
  return exact.includes(file) || prefixes.some((prefix) => file.startsWith(prefix))
}

const outputs = {
  chat_eval: files.some((file) => matches(file, chatPrefixes, chatExact)),
  retrieval_eval: files.some((file) => matches(file, retrievalPrefixes, retrievalExact)),
  security_scan: files.some((file) => matches(file, securityPrefixes, securityExact)),
}

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

- [ ] **Step 2: Verify local output with no special env**

Run:

```bash
node scripts/ci/changed-paths.mjs
```

Expected: the script prints `chat_eval=...`, `retrieval_eval=...`, and `security_scan=...` without throwing.

- [ ] **Step 3: Verify output-file mode**

Run:

```bash
tmpfile="$(mktemp)"
GITHUB_OUTPUT="$tmpfile" node scripts/ci/changed-paths.mjs
cat "$tmpfile"
```

Expected: the temp file contains the three output keys.

---

## Task 3: Add a Small CI Chat Eval Suite

**Files:**

- Modify: `scripts/eval-chat/types.ts`
- Modify: `scripts/eval-chat/fixtures.ts`
- Modify: `scripts/eval-chat/run.ts`

- [ ] **Step 1: Add the scenario flag type**

In `scripts/eval-chat/types.ts`, update `EvalScenario`:

```ts
export interface EvalScenario {
  id: string
  name: string
  description: string
  ci_smoke?: boolean
  hair_profile: HairProfileOverrides
  routine_inventory?: RoutineInventorySeed[]
  turns: EvalTurn[]
}
```

- [ ] **Step 2: Mark the CI smoke scenarios**

In `scripts/eval-chat/fixtures.ts`, add `ci_smoke: true` to these scenario objects:

```text
owc-followup
shampoo-missing-profile
medical-redirect
shampoo-recommend-and-refine
clarification-cap
```

Do not mark every scenario. The PR suite should remain a small live smoke check.

- [ ] **Step 3: Add the `--ci-smoke` CLI option**

In `scripts/eval-chat/run.ts`, extend `parseArgs()`:

```ts
let ciSmoke = false
```

Handle the flag in the loop:

```ts
} else if (args[i] === "--ci-smoke") {
  ciSmoke = true
}
```

Return it:

```ts
return {
  baseUrl,
  scenarioFilter,
  skipJudge,
  ciSmoke,
  langfusePublish,
  langfuseRunName,
  langfuseExperimentName,
}
```

Then destructure it in `main()`:

```ts
const {
  baseUrl,
  scenarioFilter,
  skipJudge,
  ciSmoke,
  langfusePublish,
  langfuseRunName,
  langfuseExperimentName,
} = parseArgs()
```

Replace scenario selection with:

```ts
const scenarios = scenarioFilter
  ? SCENARIOS.filter((s) => s.id === scenarioFilter)
  : ciSmoke
    ? SCENARIOS.filter((s) => s.ci_smoke)
    : SCENARIOS
```

Keep the existing no-scenario guard. It should fail if no scenarios are marked.

- [ ] **Step 4: Verify smoke filtering without starting the app**

Run:

```bash
npm run typecheck
```

Expected: TypeScript accepts the new `ci_smoke` field and run arguments.

---

## Task 4: Make Retrieval Metrics CI-Gatable

**Files:**

- Modify: `scripts/eval-retrieval.ts`

- [ ] **Step 1: Add numeric argument parsing**

Near the top of `main()`, after reading `args`, add:

```ts
function readNumberArg(args: string[], name: string): number | null {
  const index = args.indexOf(name)
  if (index === -1) return null
  const value = Number(args[index + 1])
  if (!Number.isFinite(value)) {
    throw new Error(`Expected numeric value after ${name}`)
  }
  return value
}
```

Then inside `main()`:

```ts
const minHybridNdcg10 = readNumberArg(args, "--min-hybrid-ndcg10")
const minHybridRecall20 = readNumberArg(args, "--min-hybrid-recall20")
const minHybridMrr10 = readNumberArg(args, "--min-hybrid-mrr10")
```

- [ ] **Step 2: Fail on missing env before clients are used**

Replace top-level client creation with guarded creation:

```ts
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") })
const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
)
```

- [ ] **Step 3: Add threshold checks after hybrid metrics are printed**

Before the existing metric-printing blocks, add:

```ts
let hybridNdcg = 0
let hybridRecall = 0
let hybridMrr = 0
```

Inside the existing hybrid block, assign those variables instead of declaring new `const` values:

```ts
hybridNdcg = avg(results.map((r) => r.hybrid?.ndcg10 ?? 0))
hybridRecall = avg(results.map((r) => r.hybrid?.recall20 ?? 0))
hybridMrr = avg(results.map((r) => r.hybrid?.mrr10 ?? 0))
```

After report writing, add:

```ts
const failures: string[] = []

if (minHybridNdcg10 !== null && hybridNdcg < minHybridNdcg10) {
  failures.push(`Hybrid nDCG@10 ${hybridNdcg.toFixed(4)} < ${minHybridNdcg10}`)
}

if (minHybridRecall20 !== null && hybridRecall < minHybridRecall20) {
  failures.push(`Hybrid Recall@20 ${hybridRecall.toFixed(4)} < ${minHybridRecall20}`)
}

if (minHybridMrr10 !== null && hybridMrr < minHybridMrr10) {
  failures.push(`Hybrid MRR@10 ${hybridMrr.toFixed(4)} < ${minHybridMrr10}`)
}

if (failures.length > 0) {
  console.error("")
  console.error("Retrieval CI thresholds failed:")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
```

- [ ] **Step 4: Make fatal errors exit non-zero**

Replace the final line:

```ts
main().catch(console.error)
```

with:

```ts
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
```

- [ ] **Step 5: Verify typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

---

## Task 5: Update the Required CI Workflow

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add workflow-level permissions and concurrency**

At the top of `.github/workflows/ci.yml`, after `on`, add:

```yaml
permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

- [ ] **Step 2: Add a timeout to the quality job**

Under `runs-on: ubuntu-latest`, add:

```yaml
    timeout-minutes: 35
```

- [ ] **Step 3: Add changed-path detection**

After checkout, add:

```yaml
      - name: Detect changed paths
        id: changes
        run: node scripts/ci/changed-paths.mjs
```

- [ ] **Step 4: Replace scattered deterministic test steps**

Keep `npm ci`, Linux native binding install, typecheck, lint, and build. Replace the current agent/recommendation test steps with:

```yaml
      - name: Run deterministic contract tests
        run: npm run test:contracts
```

- [ ] **Step 5: Keep Playwright smoke required**

Keep the existing browser install and smoke command:

```yaml
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Run Playwright smoke tests
        run: npx start-server-and-test 'npm run start' http://localhost:3000 'npx playwright test --grep @ci --project=chromium'
```

- [ ] **Step 6: Replace inline chat diff logic with path-filter output**

Replace the existing `Chat evaluation (if RAG files changed)` shell block with:

```yaml
      - name: Run live chat smoke eval
        if: steps.changes.outputs.chat_eval == 'true'
        run: npx start-server-and-test 'npm run start' http://localhost:3000 'npm run test:chat:ci'

      - name: Skip live chat smoke eval
        if: steps.changes.outputs.chat_eval != 'true'
        run: echo "No AI/chat/recommendation paths changed; skipping live chat smoke eval"
```

- [ ] **Step 7: Add retrieval metrics gate**

After the chat eval step, add:

```yaml
      - name: Run retrieval metrics gate
        if: steps.changes.outputs.retrieval_eval == 'true'
        run: npm run test:retrieval:ci

      - name: Skip retrieval metrics gate
        if: steps.changes.outputs.retrieval_eval != 'true'
        run: echo "No retrieval/indexing paths changed; skipping retrieval metrics gate"
```

- [ ] **Step 8: Verify workflow syntax locally as text**

Run:

```bash
npm run typecheck
node scripts/ci/changed-paths.mjs
```

Expected: both commands exit `0`.

---

## Task 6: Add Security Workflow and Dependabot

**Files:**

- Create: `.github/workflows/security.yml`
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Add security workflow**

Create `.github/workflows/security.yml`:

```yaml
name: Security

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: "17 3 * * 1"
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  dependency-review:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      pull-requests: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: moderate

  codeql:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      security-events: write
      packages: read
      actions: read
      contents: read
    strategy:
      fail-fast: false
      matrix:
        language: [javascript-typescript, actions]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v4
      - uses: github/codeql-action/analyze@v4
        with:
          category: "/language:${{ matrix.language }}"
```

- [ ] **Step 2: Add Dependabot config**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
      day: monday
      time: "04:00"
      timezone: Europe/Berlin
    open-pull-requests-limit: 5
    groups:
      production-dependencies:
        dependency-type: production
      development-dependencies:
        dependency-type: development

  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
      day: monday
      time: "04:30"
      timezone: Europe/Berlin
    open-pull-requests-limit: 5
```

- [ ] **Step 3: Verify YAML has no whitespace errors**

Run:

```bash
git diff --check .github/workflows/security.yml .github/dependabot.yml
```

Expected: no whitespace errors.

---

## Task 7: Document the CI Policy

**Files:**

- Modify: `docs/langfuse-quality-loop.md`

- [ ] **Step 1: Add a CI policy section**

After the "Eval workflow" section, add:

````markdown
## CI quality policy

Pull requests use a tiered quality gate:

- deterministic checks always run: typecheck, lint, build, Node contract tests, Playwright contract tests, and `@ci` smoke tests
- live chat smoke eval runs only when AI, chat, RAG, routine, recommendation, prompt, or eval-harness paths change
- retrieval metrics run only when retrieval, ingestion, source chunking, Supabase match functions, or retrieval gold-set paths change
- full judged chat evals are manual or scheduled, not required on every PR

Use this before a quality-critical merge, launch, prompt/model/provider change, or when production feedback suggests regression:

```bash
npm run test:chat:judge
```

Publish the judged run into Langfuse when comparing prompt or behavior changes:

```bash
npm run test:chat:langfuse
```

The PR chat smoke suite intentionally stays small to control external API cost and flake risk. Add a scenario to the PR smoke suite only when it protects a high-value regression, safety redirect, or routing contract.
````

- [ ] **Step 2: Add admin note for GitHub settings**

Add:

```markdown
## GitHub repository settings to confirm

- Require the `CI / quality` check before merging to `main`.
- Require the `Security / dependency-review` check for PRs that change dependency manifests when available on the repository plan.
- Enable secret scanning in GitHub settings.
- Keep full judged Langfuse evals manual or scheduled until the score threshold has enough history to be reliable.
```

---

## Task 8: Verification

**Files:**

- No new files.

- [ ] **Step 1: Verify changed-path script**

Run:

```bash
node scripts/ci/changed-paths.mjs
```

Expected: prints all three boolean outputs.

- [ ] **Step 2: Verify static checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both pass.

- [ ] **Step 3: Verify deterministic tests**

Run:

```bash
npm run test:contracts
```

Expected: all Node and Playwright contract tests pass.

- [ ] **Step 4: Verify build**

Run:

```bash
npm run build
```

Expected: Next.js production build passes.

- [ ] **Step 5: Verify live chat smoke only if local env is available**

Run only if `.env.local` has working Supabase/OpenAI/Cohere credentials:

```bash
npx start-server-and-test 'npm run start' http://localhost:3000 'npm run test:chat:ci'
```

Expected: only `ci_smoke` scenarios run, with `skip judge` shown in output.

- [ ] **Step 6: Verify retrieval gate only if local env is available**

Run only if `.env.local` has working Supabase/OpenAI credentials and the gold set matches the target database:

```bash
npm run test:retrieval:ci
```

Expected: hybrid nDCG@10 and Recall@20 meet thresholds, or the command fails with the metric that regressed.

- [ ] **Step 7: Review GitHub Actions result after pushing**

Push the branch and open a PR. Confirm:

- `quality` runs on the PR.
- live chat smoke is skipped for docs-only changes.
- retrieval metrics are skipped for docs-only changes.
- security workflow runs dependency review on PRs.
- CodeQL runs on PR/main/schedule without missing-permission errors.

---

## Execution Handoff

Recommended next skill: `superpowers:subagent-driven-development`.

Implementation should happen in the existing worktree:

```bash
/Users/nick/AI_work/hair_conscierge/.worktrees/ci-quality-gate
```

Use branch:

```bash
codex/ci-quality-gate
```

Suggested task split:

1. Worker A owns package scripts, changed-path script, and CI workflow.
2. Worker B owns chat eval smoke filtering and retrieval threshold gating.
3. Worker C owns security workflow, Dependabot, and docs.

Workers are not alone in the codebase. They must not revert edits made by others and should adjust their implementation to accommodate concurrent changes.
