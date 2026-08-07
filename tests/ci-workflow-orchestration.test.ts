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
    "npx start-server-and-test 'npm run start' http://localhost:3000 'npx playwright test --grep @ci --project=chromium'",
  ])
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

test("quality core installs Chromium before the Stage 3 self-hosted browser contract", () => {
  const qualityCore = jobSource(ciWorkflow, "quality-core")
  const stage3BrowserScript = packageManifest.scripts["test:playwright:personal-plan-stage3"]

  assert.match(
    qualityCore,
    /      - name: Install Playwright browsers\n        run: npx playwright install --with-deps chromium\n      - name: Run deterministic contract tests\n        run: npm run test:contracts/m,
  )
  assert.equal(
    stage3BrowserScript,
    "CI=true CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED=true PLAYWRIGHT_BASE_URL=http://127.0.0.1:3217 start-server-and-test 'npm run dev -- --hostname 127.0.0.1 --port 3217' http://127.0.0.1:3217 'playwright test tests/personal-plan-stage3.spec.ts --project=chromium'",
  )
  assert.match(
    packageManifest.scripts["test:contracts"],
    /(?:^| && )npm run test:playwright:personal-plan-stage3$/,
  )
})

test("chat and retrieval gates retain their core-quality dependency", () => {
  const expectedDependencies = ["detect-ci-scope", "quality-core"]

  assert.deepEqual(jobDependencyNames(ciWorkflow, "chat-live-smoke"), expectedDependencies)
  assert.deepEqual(jobDependencyNames(ciWorkflow, "retrieval-gate"), expectedDependencies)
})
