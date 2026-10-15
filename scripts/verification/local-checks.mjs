const OWNER_TESTS = new Map([
  [
    "src/lib/quiz/normalization.ts",
    ["tests/quiz-normalization.test.ts", "tests/quiz-primary-concern.test.ts"],
  ],
  [
    "src/lib/quiz/primary-concern.ts",
    ["tests/quiz-normalization.test.ts", "tests/quiz-primary-concern.test.ts"],
  ],
  [
    "src/lib/personal-plan/refinement/question-path.ts",
    [
      "tests/personal-plan-stage2-question-path.test.ts",
      "tests/personal-plan-stage2-question-path-modules.test.ts",
    ],
  ],
  [
    "src/lib/personal-plan/products/candidate-ranking.ts",
    ["tests/personal-plan/products/candidate-ranking.test.ts"],
  ],
  [
    "src/lib/personal-plan/products/category-capture-queue.ts",
    ["tests/personal-plan/products/category-capture-queue.test.ts"],
  ],
  ["src/lib/stripe/checkout-session-params.ts", ["tests/stripe-checkout-session-params.spec.ts"]],
  [
    "src/app/api/stripe/create-checkout-session/route.ts",
    ["tests/stripe-checkout-session-route-contract.test.ts"],
  ],
  ["src/lib/analytics/checkout-attempt.ts", ["tests/checkout-attempt.test.ts"]],
  ["scripts/ci/path-rules.mjs", ["tests/ci-path-rules.test.ts"]],
  [".github/workflows/ci.yml", ["tests/ci-workflow-orchestration.test.ts"]],
  ["scripts/verification/local-checks.mjs", ["tests/local-check-plan.test.ts"]],
  ["scripts/verification/plan.mjs", ["tests/local-check-plan.test.ts"]],
])

const KNOWN_NODE_SPECS = new Set(["tests/stripe-checkout-session-params.spec.ts"])
const VERIFICATION_PYTHON = new Set([
  "scripts/verification/install-local.py",
  "scripts/verification/remote.py",
  "scripts/verification/run.py",
  "scripts/verification/test_remote.py",
  "scripts/verification/test_runner.py",
])

function docsOnly(path) {
  if (path === "AGENTS.md" || path === "CLAUDE.md") return true
  return (
    path.endsWith(".md") &&
    (path.startsWith("docs/") || path.startsWith("plans/") || path.startsWith(".agents/skills/"))
  )
}

function malformed(path) {
  return (
    !path ||
    path.startsWith("-") ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").includes("..")
  )
}

function addTests(target, tests, availableTests) {
  for (const test of tests) {
    if (availableTests && !availableTests.has(test))
      target.unmappedPaths.push(test + " (mapped test is missing)")
    else target.nodeTests.add(test)
  }
}

/** Returns advice only. It never runs a command or treats an empty diff as a waiver. */
export function recommendLocalChecks(files, { availableTests } = {}) {
  const result = { nodeTests: new Set(), unmappedPaths: [], notes: [] }
  for (const path of [...new Set(files)].sort()) {
    if (malformed(path)) {
      result.unmappedPaths.push(path || "(empty path)")
      continue
    }
    if (path.startsWith("tests/fixtures/") || path.startsWith("supabase/migrations/")) {
      result.unmappedPaths.push(path)
      continue
    }
    if (docsOnly(path)) {
      result.notes.push(path + ": reference/format review")
      continue
    }
    if (OWNER_TESTS.has(path)) {
      addTests(result, OWNER_TESTS.get(path), availableTests)
      continue
    }
    if (
      path.startsWith("tests/") &&
      (path.endsWith(".test.ts") || path.endsWith(".test.tsx") || KNOWN_NODE_SPECS.has(path))
    ) {
      addTests(result, [path], availableTests)
      continue
    }
    if (VERIFICATION_PYTHON.has(path)) continue
    result.unmappedPaths.push(path)
  }

  const nodeTests = [...result.nodeTests].sort()
  const unmappedPaths = [...new Set(result.unmappedPaths)].sort()
  const commands = files.length ? [["git", "diff", "--check"]] : []
  if (nodeTests.length) commands.push(["npm", "run", "test:focused", "--", ...nodeTests])
  if (files.some((path) => VERIFICATION_PYTHON.has(path)))
    commands.push(["npm", "run", "test:verification-runner"])
  const status = !files.length
    ? "no-changes"
    : unmappedPaths.length
      ? "owner-review"
      : commands.length > 1
        ? "focused"
        : "docs-only"
  if (!files.length)
    result.notes.push(
      "No changed paths is not a verification waiver; choose checks with the owner.",
    )
  if (files.length)
    result.notes.push("Focused suggestions do not waive final CI or owner-required checks.")
  if (unmappedPaths.length)
    result.notes.push(
      "Unmapped paths require owner review; no broad suite is selected automatically.",
    )
  return { status, nodeTests, commands, unmappedPaths, notes: result.notes }
}
