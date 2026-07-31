import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const newWorktreeScript = resolve("scripts/worktree-new.mjs")

function command(cwd: string, executable: string, args: string[], allowFailure = false) {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
  })

  if (!allowFailure && result.status !== 0) {
    assert.fail(
      `Command failed (${result.status}): ${executable} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
    )
  }

  return result
}

function git(cwd: string, args: string[], allowFailure = false) {
  return command(cwd, "git", args, allowFailure)
}

function configureIdentity(repo: string) {
  git(repo, ["config", "user.email", "tests@chaarlie.local"])
  git(repo, ["config", "user.name", "Chaarlie Tests"])
}

function commitFile(repo: string, name: string, content: string, message: string) {
  writeFileSync(join(repo, name), content)
  git(repo, ["add", "--", name])
  git(repo, ["commit", "-m", message])
}

function createFixture(t: test.TestContext) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "chaarlie-worktree-new-"))
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }))

  const primary = join(fixtureRoot, "repo")
  const remote = join(fixtureRoot, "origin.git")
  const integrator = join(fixtureRoot, "integrator")

  mkdirSync(primary)
  git(fixtureRoot, ["init", "--bare", remote])
  git(fixtureRoot, ["init", primary])
  git(primary, ["checkout", "-b", "main"])
  configureIdentity(primary)
  commitFile(primary, "base.txt", "base\n", "chore: add base")
  const baseSha = git(primary, ["rev-parse", "HEAD"]).stdout.trim()
  git(primary, ["remote", "add", "origin", remote])
  git(primary, ["push", "-u", "origin", "main"])
  git(fixtureRoot, ["--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/main"])

  git(fixtureRoot, ["clone", remote, integrator])
  configureIdentity(integrator)
  commitFile(integrator, "fresh.txt", "fresh\n", "chore: advance main")
  const freshSha = git(integrator, ["rev-parse", "HEAD"]).stdout.trim()
  git(integrator, ["push", "origin", "main"])

  return { baseSha, freshSha, primary }
}

function runNew(primary: string, slug: string) {
  return command(primary, process.execPath, [newWorktreeScript, slug, "--no-install"], true)
}

test("fetches and fast-forwards clean root main before creating from fresh origin/main", (t) => {
  const fixture = createFixture(t)
  const result = runNew(fixture.primary, "fresh-task")
  const taskWorktree = join(fixture.primary, ".worktrees", "fresh-task")

  assert.equal(result.status, 0, result.stderr)
  assert.equal(git(fixture.primary, ["rev-parse", "HEAD"]).stdout.trim(), fixture.freshSha)
  assert.equal(git(taskWorktree, ["rev-parse", "HEAD"]).stdout.trim(), fixture.freshSha)
})

test("refuses a fully dirty root without creating task artifacts", (t) => {
  const fixture = createFixture(t)
  writeFileSync(join(fixture.primary, "local-plan.md"), "keep me\n")

  const result = runNew(fixture.primary, "dirty-root-task")

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Primary root main must be clean/)
  assert.match(result.stderr, /local-plan\.md/)
  assert.equal(existsSync(join(fixture.primary, ".worktrees", "dirty-root-task")), false)
  assert.equal(
    git(
      fixture.primary,
      ["show-ref", "--verify", "--quiet", "refs/heads/codex/dirty-root-task"],
      true,
    ).status,
    1,
  )
  assert.equal(git(fixture.primary, ["rev-parse", "HEAD"]).stdout.trim(), fixture.baseSha)
})

test("refuses when the primary root is not on main", (t) => {
  const fixture = createFixture(t)
  git(fixture.primary, ["checkout", "-b", "local-root-work"])

  const result = runNew(fixture.primary, "wrong-root-branch")

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Primary root must be on main/)
  assert.equal(existsSync(join(fixture.primary, ".worktrees", "wrong-root-branch")), false)
})

test("refuses when origin main is unavailable", (t) => {
  const fixture = createFixture(t)
  git(fixture.primary, ["remote", "remove", "origin"])

  const result = runNew(fixture.primary, "no-origin-main")

  assert.equal(result.status, 1)
  assert.match(result.stderr, /origin\/main is unavailable/)
  assert.equal(existsSync(join(fixture.primary, ".worktrees", "no-origin-main")), false)
})

test("refuses root main history that cannot fast-forward", (t) => {
  const fixture = createFixture(t)
  commitFile(fixture.primary, "local.txt", "local\n", "chore: add local commit")

  const result = runNew(fixture.primary, "diverged-root")

  assert.equal(result.status, 1)
  assert.match(result.stderr, /must fast-forward cleanly/)
  assert.equal(existsSync(join(fixture.primary, ".worktrees", "diverged-root")), false)
})
