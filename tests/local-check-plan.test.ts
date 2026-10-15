import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { recommendLocalChecks } from "../scripts/verification/local-checks.mjs"

test("known owner seams are merged into one focused Node command", () => {
  const plan = recommendLocalChecks([
    "src/lib/quiz/normalization.ts",
    "src/lib/quiz/primary-concern.ts",
  ])

  assert.equal(plan.status, "focused")
  assert.deepEqual(plan.nodeTests, [
    "tests/quiz-normalization.test.ts",
    "tests/quiz-primary-concern.test.ts",
  ])
  assert.deepEqual(plan.commands, [
    ["git", "diff", "--check"],
    ["npm", "run", "test:focused", "--", ...plan.nodeTests],
  ])
})

test("the mapped CI workflow keeps its focused contract despite its YAML extension", () => {
  const plan = recommendLocalChecks([".github/workflows/ci.yml"])
  assert.equal(plan.status, "focused")
  assert.deepEqual(plan.nodeTests, ["tests/ci-workflow-orchestration.test.ts"])
})

test("unknown paths stay owner-review while known checks remain focused", () => {
  const plan = recommendLocalChecks([
    "src/lib/analytics/checkout-attempt.ts",
    "src/app/unknown.ts",
    "scripts/verification/run.py",
  ])
  assert.equal(plan.status, "owner-review")
  assert.deepEqual(plan.nodeTests, ["tests/checkout-attempt.test.ts"])
  assert.deepEqual(plan.commands, [
    ["git", "diff", "--check"],
    ["npm", "run", "test:focused", "--", "tests/checkout-attempt.test.ts"],
    ["npm", "run", "test:verification-runner"],
  ])
  assert.deepEqual(plan.unmappedPaths, ["src/app/unknown.ts"])
})

test("guidance is docs-only and no paths are not a waiver", () => {
  assert.equal(recommendLocalChecks(["docs/coding-verification.md"]).status, "docs-only")
  assert.equal(recommendLocalChecks([".agents/skills/example/run.mjs"]).status, "owner-review")
  assert.equal(recommendLocalChecks(["tests/fixtures/example.md"]).status, "owner-review")
  const empty = recommendLocalChecks([])
  assert.equal(empty.status, "no-changes")
  assert.match(empty.notes[0], /not a verification waiver/)
})

test("only known Node specs and test files can recommend themselves", () => {
  assert.equal(
    recommendLocalChecks(["tests/stripe-checkout-session-params.spec.ts"]).status,
    "focused",
  )
  const unknownSpec = recommendLocalChecks(["tests/browser.spec.ts"])
  assert.equal(unknownSpec.status, "owner-review")
  assert.deepEqual(unknownSpec.unmappedPaths, ["tests/browser.spec.ts"])
})

test("missing mapped contracts fail closed to owner review", () => {
  const plan = recommendLocalChecks(["src/lib/analytics/checkout-attempt.ts"], {
    availableTests: new Set(),
  })
  assert.equal(plan.status, "owner-review")
  assert.deepEqual(plan.nodeTests, [])
  assert.deepEqual(plan.unmappedPaths, ["tests/checkout-attempt.test.ts (mapped test is missing)"])
})

test("verification Python inputs are focused and malformed paths fail closed", () => {
  const python = recommendLocalChecks(["scripts/verification/remote.py"])
  assert.equal(python.status, "focused")
  assert.deepEqual(python.commands, [
    ["git", "diff", "--check"],
    ["npm", "run", "test:verification-runner"],
  ])
  assert.equal(recommendLocalChecks(["../outside.ts"]).status, "owner-review")
})

test("CLI unions committed, staged, unstaged and untracked paths", () => {
  const root = mkdtempSync(join(tmpdir(), "local-check-plan-"))
  const plan = join(process.cwd(), "scripts/verification/plan.mjs")
  try {
    execFileSync("git", ["init", "-q"], { cwd: root })
    execFileSync("git", ["config", "user.name", "test"], { cwd: root })
    execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: root })
    writeFileSync(join(root, "base.txt"), "base\n")
    execFileSync("git", ["add", "."], { cwd: root })
    execFileSync("git", ["commit", "-qm", "base"], { cwd: root })
    writeFileSync(join(root, "committed.ts"), "x\n")
    execFileSync("git", ["add", "."], { cwd: root })
    execFileSync("git", ["commit", "-qm", "committed"], { cwd: root })
    writeFileSync(join(root, "staged.ts"), "x\n")
    execFileSync("git", ["add", "staged.ts"], { cwd: root })
    writeFileSync(join(root, "unstaged.ts"), "x\n")
    execFileSync("git", ["add", "unstaged.ts"], { cwd: root })
    writeFileSync(join(root, "unstaged.ts"), "changed\n")
    writeFileSync(join(root, "untracked.ts"), "x\n")
    const output = JSON.parse(
      execFileSync(process.execPath, [plan, "--base", "HEAD~1", "--json"], {
        cwd: root,
        encoding: "utf8",
      }),
    )
    assert.deepEqual(output.scope.files, [
      "committed.ts",
      "staged.ts",
      "unstaged.ts",
      "untracked.ts",
    ])
    assert.equal(output.status, "owner-review")
    const nested = join(root, "nested")
    mkdirSync(nested)
    const fromSubdirectory = JSON.parse(
      execFileSync(process.execPath, [plan, "--base", "HEAD~1", "--json"], {
        cwd: nested,
        encoding: "utf8",
      }),
    )
    assert.deepEqual(fromSubdirectory.scope.files, output.scope.files)
    const explicit = JSON.parse(
      execFileSync(process.execPath, [plan, "--files", "docs/example.md", "--json"], {
        cwd: root,
        encoding: "utf8",
      }),
    )
    assert.equal(explicit.status, "docs-only")
    const badBase = spawnSync(process.execPath, [plan, "--base", "not-a-commit"], { cwd: root })
    assert.notEqual(badBase.status, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("explicit exploration works outside Git and reports missing mapped tests", () => {
  const root = mkdtempSync(join(tmpdir(), "local-check-plan-outside-git-"))
  const plan = join(process.cwd(), "scripts/verification/plan.mjs")
  try {
    const docs = JSON.parse(
      execFileSync(process.execPath, [plan, "--files", "docs/example.md", "--json"], {
        cwd: root,
        encoding: "utf8",
      }),
    )
    assert.equal(docs.status, "docs-only")
    const missing = JSON.parse(
      execFileSync(
        process.execPath,
        [plan, "--files", "src/lib/analytics/checkout-attempt.ts", "--json"],
        { cwd: root, encoding: "utf8" },
      ),
    )
    assert.equal(missing.status, "owner-review")
    assert.match(missing.unmappedPaths[0], /mapped test is missing/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
