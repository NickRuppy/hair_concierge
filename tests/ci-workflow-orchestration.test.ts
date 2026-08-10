import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
const packageManifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> }

const JOBS_KEY = /^jobs:[ \t]*(?:#.*)?$/
const TOP_LEVEL_KEY = /^[A-Za-z0-9_-]+:[ \t]*(?:#.*)?$/
const TOP_LEVEL_JOB = /^  ([A-Za-z0-9_-]+):[ \t]*(?:#.*)?$/
const PLAYWRIGHT_GUARD =
  "needs.detect-ci-scope.outputs.playwright_smoke == 'true' && env.HAS_LIVE_SUPABASE_SECRETS == 'true'"
const PLAYWRIGHT_SKIP_GUARD =
  "needs.detect-ci-scope.outputs.playwright_smoke != 'true' || env.HAS_LIVE_SUPABASE_SECRETS != 'true'"

function jobSource(workflowSource: string, jobName: string) {
  const lines = workflowSource.split(/\r?\n/)
  const jobsStart = lines.findIndex((line) => JOBS_KEY.test(line))

  assert.notEqual(jobsStart, -1, "missing jobs declaration")

  const jobsEndOffset = lines.slice(jobsStart + 1).findIndex((line) => TOP_LEVEL_KEY.test(line))
  const jobsEnd = jobsEndOffset === -1 ? lines.length : jobsStart + 1 + jobsEndOffset
  const jobLines = lines.slice(jobsStart + 1, jobsEnd)
  const start = jobLines.findIndex((line) => line.match(TOP_LEVEL_JOB)?.[1] === jobName)

  assert.notEqual(start, -1, `missing ${jobName} job`)

  const nextJobOffset = jobLines.slice(start + 1).findIndex((line) => TOP_LEVEL_JOB.test(line))
  const end = nextJobOffset === -1 ? jobLines.length : start + 1 + nextJobOffset

  return jobLines.slice(start, end).join("\n")
}

function jobDependencyNames(workflowSource: string, jobName: string) {
  const lines = jobSource(workflowSource, jobName).split(/\r?\n/)
  const needsIndex = lines.findIndex((line) => /^    needs:/.test(line))

  assert.notEqual(needsIndex, -1, `missing needs declaration for ${jobName}`)

  const inlineNeeds = lines[needsIndex]
    .match(/^    needs:[ \t]*([^#]+?)[ \t]*(?:#.*)?$/)?.[1]
    ?.trim()
  const dependencies = inlineNeeds
    ? (inlineNeeds.match(/^\[(.*)\]$/)?.[1] ?? inlineNeeds).split(",")
    : []

  if (!inlineNeeds) {
    for (const line of lines.slice(needsIndex + 1)) {
      if (/^[ \t]*(?:#.*)?$/.test(line)) continue

      const dependency = line.match(/^      -[ \t]+([^#]+?)[ \t]*(?:#.*)?$/)?.[1]

      if (dependency) {
        dependencies.push(dependency)
        continue
      }

      if (/^ {0,4}\S/.test(line)) break

      assert.fail(`unsupported needs entry for ${jobName}: ${line.trim()}`)
    }
  }

  const normalizedDependencies = dependencies
    .map((dependency) => dependency.trim())
    .filter(Boolean)
    .sort()

  assert.ok(normalizedDependencies.length > 0, `missing dependencies for ${jobName}`)
  return normalizedDependencies
}

function workflowSteps(job: string) {
  const lines = job.split(/\r?\n/)
  const starts = lines
    .map((line, index) => (/^      - /.test(line) ? index : -1))
    .filter((index) => index !== -1)

  return starts.map((start, index) => lines.slice(start, starts[index + 1] ?? lines.length))
}

function guardedRunCommands(job: string) {
  const runSteps = workflowSteps(job).filter((step) =>
    step.some((line) => /^ {6,8}-? ?run:/.test(line)),
  )

  return runSteps.flatMap((step) => {
    const runLine = step.find((line) => /^ {6,8}-? ?run:/.test(line))

    assert.ok(runLine, "missing run command")

    if (step[0] === "      - name: Explain skip") {
      assert.ok(step.includes(`        if: ${PLAYWRIGHT_SKIP_GUARD}`))
      assert.equal(runLine, "        run: |")
      return []
    }

    assert.ok(step.includes(`        if: ${PLAYWRIGHT_GUARD}`), `unguarded command: ${runLine}`)
    return [runLine.replace(/^ {6,8}-? ?run:[ \t]*/, "")]
  })
}

test("workflow job extraction respects top-level boundaries and the final job", () => {
  const fixture = `on:
  push:
jobs:
  first-job:
    needs: [scope]
    run: |
        inserted-job:
    first-only: true
  inserted-job: # valid trailing comment
    needs: [scope, quality]
    inserted-only: true
  last-job: # final job
    needs: [quality]
    last-only: true
`

  assert.match(jobSource(fixture, "first-job"), /first-only/)
  assert.doesNotMatch(jobSource(fixture, "first-job"), /inserted-only|last-only/)
  assert.throws(() => jobSource(fixture, "push"), /missing push job/)
  assert.deepEqual(jobDependencyNames(fixture, "inserted-job"), ["quality", "scope"])
  assert.doesNotMatch(jobSource(fixture, "inserted-job"), /last-only/)
  assert.match(jobSource(fixture, "last-job"), /last-only/)

  assert.deepEqual(
    jobDependencyNames("jobs:\n  spaced-job:  \n    needs: [scope]\n", "spaced-job"),
    ["scope"],
  )
})

test("job dependencies support block declarations without crossing into later fields", () => {
  const fixture = `jobs:
  block-needs:
    needs:
      - detect-ci-scope

      # Comments and spacing are valid inside a YAML sequence.
      - quality-core # retained gate
    runs-on: ubuntu-latest
`

  assert.deepEqual(jobDependencyNames(fixture, "block-needs"), ["detect-ci-scope", "quality-core"])
})

test("Playwright smoke starts after scope detection without waiting for core quality", () => {
  const detectScope = jobSource(ciWorkflow, "detect-ci-scope")
  const playwrightSmoke = jobSource(ciWorkflow, "playwright-smoke")

  assert.deepEqual(jobDependencyNames(ciWorkflow, "playwright-smoke"), ["detect-ci-scope"])
  assert.doesNotMatch(playwrightSmoke, /needs\.quality-core/)
  assert.match(
    detectScope,
    /^      playwright_smoke: \$\{\{ steps\.changes\.outputs\.playwright_smoke \}\}$/m,
  )
  assert.match(
    playwrightSmoke,
    /^      - uses: actions\/setup-node@\S+(?:[ \t]+#.*)?\n        with:\n          node-version-file: \.nvmrc\n          cache: npm$/m,
  )

  assert.deepEqual(guardedRunCommands(playwrightSmoke), [
    "npm ci",
    "npm run build",
    "npx playwright install --with-deps chromium",
    "npx start-server-and-test 'npm run start' http://localhost:3000 \"npx playwright test --grep '@ci|@payment-feedback-v2' --project=chromium\"",
  ])
  assert.match(playwrightSmoke, /^      NEXT_PUBLIC_PAYMENT_FEEDBACK_V2_ENABLED: "true"$/m)
  assert.throws(
    () => jobSource(ciWorkflow, "playwright-payment-feedback-v2"),
    /missing playwright-payment-feedback-v2 job/,
  )
  assert.match(
    playwrightSmoke,
    /^      - name: Upload Playwright artifacts\n        if: always\(\)\n        uses: actions\/upload-artifact@\S+(?:[ \t]+#.*)?$/m,
  )

  const unguardedInlineRun = playwrightSmoke.replace(
    "      - name: Install dependencies",
    "      - run: echo unguarded-injected\n      - name: Install dependencies",
  )

  assert.throws(() => guardedRunCommands(unguardedInlineRun), /unguarded command/)
})

test("quality core preserves its required name as a fail-closed parallel aggregate", () => {
  const qualityCore = jobSource(ciWorkflow, "quality-core")
  const expectedChildren = [
    "detect-ci-scope",
    "quality-browser-contracts",
    "quality-node",
    "quality-personal-plan-browser",
    "quality-static",
  ]

  assert.deepEqual(jobDependencyNames(ciWorkflow, "quality-core"), expectedChildren)
  assert.match(qualityCore, /^    if: \$\{\{ always\(\) \}\}$/m)
  assert.match(
    qualityCore,
    /node scripts\/ci\/require-job-results\.mjs[\s\S]*--allow-skipped=quality-personal-plan-browser[\s\S]*detect-ci-scope=\$\{\{ needs\.detect-ci-scope\.result \}\}[\s\S]*quality-static=\$\{\{ needs\.quality-static\.result \}\}[\s\S]*quality-node=\$\{\{ needs\.quality-node\.result \}\}[\s\S]*quality-browser-contracts=\$\{\{ needs\.quality-browser-contracts\.result \}\}[\s\S]*quality-personal-plan-browser=\$\{\{ needs\.quality-personal-plan-browser\.result \}\}/m,
  )
  assert.doesNotMatch(qualityCore, /npm ci|npm run build|playwright install|test:contracts/)
})

test("quality work is divided into independently scheduled lanes", () => {
  const qualityStatic = jobSource(ciWorkflow, "quality-static")
  const qualityNode = jobSource(ciWorkflow, "quality-node")
  const qualityBrowser = jobSource(ciWorkflow, "quality-browser-contracts")
  const qualityPersonalPlan = jobSource(ciWorkflow, "quality-personal-plan-browser")

  assert.match(qualityStatic, /run: npm run typecheck/)
  assert.match(qualityStatic, /run: npm run lint/)
  assert.match(qualityStatic, /run: npm run build/)
  assert.match(qualityStatic, /run: npm run funnel:check/)

  assert.match(qualityNode, /run: npm run test:node/)
  assert.match(qualityNode, /run: npm run test:personal-plan:nested/)
  assert.match(qualityNode, /run: npm run test:agent/)

  assert.match(qualityBrowser, /run: npx playwright install --with-deps chromium/)
  assert.match(qualityBrowser, /run: npm run test:playwright:contracts/)

  assert.deepEqual(jobDependencyNames(ciWorkflow, "quality-personal-plan-browser"), [
    "detect-ci-scope",
  ])
  assert.match(
    qualityPersonalPlan,
    /^    if: needs\.detect-ci-scope\.outputs\.personal_plan_journey == 'true'$/m,
  )
  assert.match(qualityPersonalPlan, /run: npm run test:playwright:personal-plan-stage3/)
  assert.match(qualityPersonalPlan, /run: npm run test:playwright:personal-plan-stage4/)
  assert.match(qualityPersonalPlan, /run: npm run test:playwright:personal-plan-stage5/)
})

test("aggregate contracts keep focused Personal Plan coverage without duplicate top-level tests", () => {
  assert.equal(
    packageManifest.scripts["test:personal-plan:nested"],
    "node scripts/ci/run-personal-plan-nested.mjs",
  )
  assert.match(
    packageManifest.scripts["test:contracts"],
    /(?:^| && )npm run test:personal-plan:nested(?: &&|$)/,
  )
  assert.doesNotMatch(
    packageManifest.scripts["test:contracts"],
    /npm run test:personal-plan(?: &&|$)/,
  )
  assert.match(
    packageManifest.scripts["test:contracts"],
    /(?:^| && )npm run test:playwright:personal-plan-stage3 && npm run test:playwright:personal-plan-stage4 && npm run test:playwright:personal-plan-stage5$/,
  )
})

test("Personal Plan database contract is path-scoped, local, SQL-only, and time-bounded", () => {
  const detectScope = jobSource(ciWorkflow, "detect-ci-scope")
  const databaseContracts = jobSource(ciWorkflow, "personal-plan-db-contract")

  assert.match(
    detectScope,
    /^      personal_plan_db: \$\{\{ steps\.changes\.outputs\.personal_plan_db \}\}$/m,
  )
  assert.deepEqual(jobDependencyNames(ciWorkflow, "personal-plan-db-contract"), ["detect-ci-scope"])
  assert.match(databaseContracts, /^    timeout-minutes: 15$/m)
  assert.match(
    databaseContracts,
    /if: needs\.detect-ci-scope\.outputs\.personal_plan_db == 'true'[\s\S]*?run: time npm run test:personal-plan-db/m,
  )
  assert.doesNotMatch(databaseContracts, /playwright|stage1-5/i)
  assert.equal(
    packageManifest.scripts["test:personal-plan-db"],
    "bash scripts/test-personal-plan-db.sh",
  )
})

test("persisted Personal Plan journey is separately scoped and uploads failure evidence", () => {
  const detectScope = jobSource(ciWorkflow, "detect-ci-scope")
  const journey = jobSource(ciWorkflow, "personal-plan-persisted-journey")

  assert.match(
    detectScope,
    /^      personal_plan_journey: \$\{\{ steps\.changes\.outputs\.personal_plan_journey \}\}$/m,
  )
  assert.deepEqual(jobDependencyNames(ciWorkflow, "personal-plan-persisted-journey"), [
    "detect-ci-scope",
  ])
  assert.match(journey, /^    timeout-minutes: 20$/m)
  assert.match(journey, /run: npx playwright install --with-deps chromium/)
  assert.match(journey, /run: time npm run test:playwright:personal-plan-stage1-5/)
  assert.match(
    journey,
    /^      - name: Upload persisted journey artifacts\n        if: always\(\)\n        uses: actions\/upload-artifact@\S+/m,
  )
  assert.match(journey, /test-results\/personal-plan-stage1-5\*\//)
  assert.equal(
    packageManifest.scripts["test:playwright:personal-plan-stage1-5"],
    "bash scripts/test-personal-plan-stage1-5-browser.sh",
  )
})

test("scheduled CI explicitly forces every path-aware gate", () => {
  const detectScope = jobSource(ciWorkflow, "detect-ci-scope")

  assert.match(ciWorkflow, /^  schedule:\n    - cron: "[^\n]+"$/m)
  assert.match(
    detectScope,
    /^          FORCE_FULL_CI: \$\{\{ github\.event_name == 'schedule' \}\}$/m,
  )
})

test("chat and retrieval gates retain their core-quality dependency", () => {
  const expectedDependencies = ["detect-ci-scope", "quality-core"]

  assert.deepEqual(jobDependencyNames(ciWorkflow, "chat-live-smoke"), expectedDependencies)
  assert.deepEqual(jobDependencyNames(ciWorkflow, "retrieval-gate"), expectedDependencies)
})
