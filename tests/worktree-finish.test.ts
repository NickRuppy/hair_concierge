import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"

const finishScript = resolve("scripts/worktree-finish.mjs")
const repository = "NickRuppy/hair_concierge"

type PullRequestFixture = {
  number: number
  state: string
  baseRefName: string
  headRefName: string
  headRefOid: string
  mergeCommit: { oid: string }
  isCrossRepository: boolean
  headRepository: { nameWithOwner: string }
}

type Fixture = {
  baseSha: string
  branch: string
  fakeGh: string
  headSha: string
  mergeSha: string
  pr: PullRequestFixture
  primary: string
  remote: string
  root: string
  taskWorktree: string
}

function command(
  cwd: string,
  executable: string,
  args: string[],
  options: { allowFailure?: boolean; env?: NodeJS.ProcessEnv } = {},
) {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
  })

  if (!options.allowFailure && result.status !== 0) {
    assert.fail(
      `Command failed (${result.status}): ${executable} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
    )
  }

  return result
}

function git(cwd: string, args: string[], allowFailure = false) {
  return command(cwd, "git", args, { allowFailure })
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

function createFixture(t: test.TestContext, commitCount = 2): Fixture {
  const root = mkdtempSync(join(tmpdir(), "chaarlie-worktree-finish-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  const primary = join(root, "repo")
  const remote = join(root, "origin.git")
  const taskWorktree = join(root, "task-worktree")
  const integrator = join(root, "integrator")
  const fakeGh = join(root, "fake-gh.mjs")
  const branch = "codex/finish-fixture"

  mkdirSync(primary)
  git(root, ["init", "--bare", remote])
  git(root, ["init", primary])
  git(primary, ["checkout", "-b", "main"])
  configureIdentity(primary)
  commitFile(primary, "base.txt", "base\n", "chore: add base")
  const baseSha = git(primary, ["rev-parse", "HEAD"]).stdout.trim()
  git(primary, ["remote", "add", "origin", remote])
  git(primary, ["push", "-u", "origin", "main"])
  git(root, ["--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/main"])

  git(primary, ["worktree", "add", "-b", branch, taskWorktree, "main"])
  configureIdentity(taskWorktree)

  for (let index = 1; index <= commitCount; index += 1) {
    commitFile(
      taskWorktree,
      `feature-${index}.txt`,
      `feature ${index}\n`,
      `feat: add fixture ${index}`,
    )
  }

  const headSha = git(taskWorktree, ["rev-parse", "HEAD"]).stdout.trim()
  git(taskWorktree, ["push", "-u", "origin", branch])

  git(root, ["clone", remote, integrator])
  configureIdentity(integrator)
  git(integrator, ["merge", "--squash", `origin/${branch}`])
  git(integrator, ["commit", "-m", "feat: squash fixture"])
  const mergeSha = git(integrator, ["rev-parse", "HEAD"]).stdout.trim()
  git(integrator, ["push", "origin", "main"])

  writeFileSync(
    fakeGh,
    `#!/usr/bin/env node
const args = process.argv.slice(2)
if (args[0] === "repo" && args[1] === "view") {
  process.stdout.write(process.env.WORKTREE_FINISH_REPO_JSON || "")
} else if (args[0] === "pr" && args[1] === "view") {
  process.stdout.write(process.env.WORKTREE_FINISH_PR_JSON || "")
} else if (args[0] === "pr" && args[1] === "list") {
  process.stdout.write(process.env.WORKTREE_FINISH_DEPENDENT_PRS || "[]")
} else {
  process.stderr.write("unexpected fake gh arguments: " + args.join(" "))
  process.exitCode = 1
}
`,
  )
  chmodSync(fakeGh, 0o755)

  const pr = {
    number: 42,
    state: "MERGED",
    baseRefName: "main",
    headRefName: branch,
    headRefOid: headSha,
    mergeCommit: { oid: mergeSha },
    isCrossRepository: false,
    headRepository: { nameWithOwner: repository },
  }

  return {
    baseSha,
    branch,
    fakeGh,
    headSha,
    mergeSha,
    pr,
    primary,
    remote,
    root,
    taskWorktree,
  }
}

function runFinish(
  fixture: Fixture,
  options: {
    apply?: boolean
    cwd?: string
    pr?: PullRequestFixture
  } = {},
) {
  const args = [finishScript, "--pr", "42"]
  if (options.apply) args.push("--apply")

  return command(options.cwd ?? fixture.primary, process.execPath, args, {
    allowFailure: true,
    env: {
      ...process.env,
      WORKTREE_FINISH_GH_BIN: fixture.fakeGh,
      WORKTREE_FINISH_TEST_MODE: "1",
      WORKTREE_FINISH_DEPENDENT_PRS: "[]",
      WORKTREE_FINISH_REPO_JSON: JSON.stringify({ nameWithOwner: repository }),
      WORKTREE_FINISH_PR_JSON: JSON.stringify(options.pr ?? fixture.pr),
    },
  })
}

function localRef(fixture: Fixture) {
  const result = git(
    fixture.primary,
    ["show-ref", "--verify", "--hash", `refs/heads/${fixture.branch}`],
    true,
  )
  return result.status === 0 ? result.stdout.trim() : null
}

function remoteRef(fixture: Fixture) {
  const output = git(fixture.primary, [
    "ls-remote",
    "--heads",
    "origin",
    `refs/heads/${fixture.branch}`,
  ]).stdout.trim()
  return output ? output.split(/\s+/)[0] : null
}

test("dry-run proves a multi-commit squash merge without mutation", (t) => {
  const fixture = createFixture(t, 3)
  const result = runFinish(fixture)

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Mode: DRY RUN/)
  assert.match(result.stdout, /DRY RUN SAFE/)
  assert.equal(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
  assert.equal(git(fixture.primary, ["rev-parse", "HEAD"]).stdout.trim(), fixture.baseSha)
})

test("apply fast-forwards root and removes exact task artifacts", (t) => {
  const fixture = createFixture(t, 3)
  const result = runFinish(fixture, { apply: true })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /FINISHED/)
  assert.equal(localRef(fixture), null)
  assert.equal(remoteRef(fixture), null)
  assert.equal(git(fixture.primary, ["rev-parse", "HEAD"]).stdout.trim(), fixture.mergeSha)
  assert.equal(
    git(fixture.primary, ["worktree", "list", "--porcelain"]).stdout.includes(fixture.taskWorktree),
    false,
  )
})

test("a completed cleanup is idempotent", (t) => {
  const fixture = createFixture(t)
  const first = runFinish(fixture, { apply: true })
  const second = runFinish(fixture, { apply: true })

  assert.equal(first.status, 0, first.stderr)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /already absent/)
  assert.match(second.stdout, /FINISHED/)
})

test("dirty task worktrees are preserved", (t) => {
  const fixture = createFixture(t)
  writeFileSync(join(fixture.taskWorktree, "untracked.txt"), "keep me\n")

  const result = runFinish(fixture, { apply: true })

  assert.equal(result.status, 2)
  assert.match(result.stderr, /tracked or untracked changes/)
  assert.equal(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
})

test("unique ignored files are preserved", (t) => {
  const fixture = createFixture(t)
  const excludeFile = resolve(
    fixture.primary,
    git(fixture.primary, ["rev-parse", "--git-path", "info/exclude"]).stdout.trim(),
  )
  writeFileSync(excludeFile, ".env.local\n")
  writeFileSync(join(fixture.taskWorktree, ".env.local"), "TASK_ONLY_SECRET=keep-me\n")

  const result = runFinish(fixture, { apply: true })

  assert.equal(result.status, 2)
  assert.match(result.stderr, /ignored local content that may be unique: \.env\.local/)
  assert.equal(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
})

test("unchanged worktree include copies are disposable", (t) => {
  const fixture = createFixture(t)
  const excludeFile = resolve(
    fixture.primary,
    git(fixture.primary, ["rev-parse", "--git-path", "info/exclude"]).stdout.trim(),
  )
  writeFileSync(excludeFile, ".env.local\n")
  writeFileSync(join(fixture.primary, ".worktreeinclude"), ".env.local\n")
  writeFileSync(join(fixture.primary, ".env.local"), "SHARED_LOCAL_ENV=1\n")
  writeFileSync(join(fixture.taskWorktree, ".env.local"), "SHARED_LOCAL_ENV=1\n")

  const result = runFinish(fixture, { apply: true })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(localRef(fixture), null)
  assert.equal(remoteRef(fixture), null)
})

test("locked task worktrees are intentional retention", (t) => {
  const fixture = createFixture(t)
  git(fixture.primary, [
    "worktree",
    "lock",
    "--reason",
    "post-merge verification",
    fixture.taskWorktree,
  ])

  const result = runFinish(fixture, { apply: true })

  assert.equal(result.status, 2, result.stderr)
  assert.match(result.stderr, /intentionally locked.*post-merge verification/)
  assert.equal(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
})

test("local commits added after the merged PR are preserved", (t) => {
  const fixture = createFixture(t)
  commitFile(fixture.taskWorktree, "later.txt", "later\n", "feat: later work")

  const result = runFinish(fixture, { apply: true })

  assert.equal(result.status, 2)
  assert.match(result.stderr, /Local branch tip .* does not match merged PR head/)
  assert.notEqual(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
})

test("malformed and all-zero PR head SHAs are refused", async (t) => {
  const fixture = createFixture(t)

  for (const headRefOid of ["not-a-sha", "0".repeat(40)]) {
    await t.test(headRefOid, () => {
      const result = runFinish(fixture, {
        apply: true,
        pr: { ...fixture.pr, headRefOid },
      })

      assert.equal(result.status, 2)
      assert.match(result.stderr, /not a non-zero 40-character Git SHA/)
      assert.equal(localRef(fixture), fixture.headSha)
      assert.equal(remoteRef(fixture), fixture.headSha)
    })
  }
})

test("GitHub must return the exact requested pull request", (t) => {
  const fixture = createFixture(t)
  const result = runFinish(fixture, {
    apply: true,
    pr: { ...fixture.pr, number: 43 },
  })

  assert.equal(result.status, 2)
  assert.match(result.stderr, /returned PR #43, expected #42/)
  assert.equal(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
})

test("duplicate pull request arguments fail closed", (t) => {
  const fixture = createFixture(t)
  const result = command(
    fixture.primary,
    process.execPath,
    [finishScript, "--pr", "42", "--pr", "43"],
    { allowFailure: true },
  )

  assert.equal(result.status, 2)
  assert.match(result.stderr, /--pr may be specified only once/)
  assert.equal(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
})

test("forked, stacked, unmerged, and protected PRs fail closed", async (t) => {
  const fixture = createFixture(t)
  const cases: Array<[string, PullRequestFixture, RegExp]> = [
    [
      "fork",
      {
        ...fixture.pr,
        isCrossRepository: true,
        headRepository: { nameWithOwner: "someone/fork" },
      },
      /Fork pull requests/,
    ],
    ["stacked", { ...fixture.pr, baseRefName: "codex/parent" }, /base must be main/],
    ["unmerged", { ...fixture.pr, state: "OPEN" }, /PR is not merged/],
    ["protected", { ...fixture.pr, headRefName: "main" }, /not an allowed task branch/],
  ]

  for (const [name, pr, message] of cases) {
    await t.test(name, () => {
      const result = runFinish(fixture, { apply: true, pr })
      assert.equal(result.status, 2)
      assert.match(result.stderr, message)
      assert.equal(localRef(fixture), fixture.headSha)
      assert.equal(remoteRef(fixture), fixture.headSha)
    })
  }
})

test("the finisher refuses invocation from a linked task worktree", (t) => {
  const fixture = createFixture(t)
  const result = runFinish(fixture, {
    apply: true,
    cwd: fixture.taskWorktree,
  })

  assert.equal(result.status, 2)
  assert.match(result.stderr, /must run from the repository's primary root checkout/)
  assert.equal(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
})

test("an unrelated detached worktree is preserved without blocking exact cleanup", (t) => {
  const fixture = createFixture(t)
  const detached = join(fixture.root, "detached")
  git(fixture.primary, ["worktree", "add", "--detach", detached, fixture.headSha])

  const result = runFinish(fixture, { apply: true })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(localRef(fixture), null)
  assert.equal(remoteRef(fixture), null)
  assert.equal(
    git(fixture.primary, ["worktree", "list", "--porcelain"]).stdout.includes(detached),
    true,
  )
})

test("dirty root main is preserved while exact task cleanup continues", (t) => {
  const fixture = createFixture(t)
  writeFileSync(join(fixture.primary, "root-notes.txt"), "keep root dirty\n")

  const result = runFinish(fixture, { apply: true })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /leave unchanged \(root main is dirty\)/)
  assert.equal(git(fixture.primary, ["rev-parse", "HEAD"]).stdout.trim(), fixture.baseSha)
  assert.equal(localRef(fixture), null)
  assert.equal(remoteRef(fixture), null)
  assert.match(git(fixture.primary, ["status", "--short"]).stdout, /root-notes\.txt/)
})

test("remote deletion failure preserves local retry artifacts", (t) => {
  const fixture = createFixture(t)
  const hook = join(fixture.remote, "hooks", "pre-receive")
  writeFileSync(hook, "#!/bin/sh\nexit 1\n")
  chmodSync(hook, 0o755)

  const result = runFinish(fixture, { apply: true })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Command failed[\s\S]*git push/)
  assert.equal(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
  assert.equal(
    git(fixture.primary, ["worktree", "list", "--porcelain"]).stdout.includes(fixture.taskWorktree),
    true,
  )
})

test("merge commit must be reachable from fresh origin main", (t) => {
  const fixture = createFixture(t)
  const result = runFinish(fixture, {
    apply: true,
    pr: {
      ...fixture.pr,
      mergeCommit: { oid: fixture.headSha },
    },
  })

  assert.equal(result.status, 2)
  assert.match(result.stderr, /merge commit .* is not reachable from fresh origin\/main/)
  assert.equal(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
})

test("open dependent PRs preserve the remote and local task branch", (t) => {
  const fixture = createFixture(t)
  const result = command(
    fixture.primary,
    process.execPath,
    [finishScript, "--pr", "42", "--apply"],
    {
      allowFailure: true,
      env: {
        ...process.env,
        WORKTREE_FINISH_GH_BIN: fixture.fakeGh,
        WORKTREE_FINISH_TEST_MODE: "1",
        WORKTREE_FINISH_REPO_JSON: JSON.stringify({ nameWithOwner: repository }),
        WORKTREE_FINISH_PR_JSON: JSON.stringify(fixture.pr),
        WORKTREE_FINISH_DEPENDENT_PRS: JSON.stringify([
          { number: 43, url: "https://github.com/NickRuppy/hair_concierge/pull/43" },
        ]),
      },
    },
  )

  assert.equal(result.status, 2, result.stderr)
  assert.match(result.stderr, /base of open dependent PR\(s\): #43/)
  assert.equal(localRef(fixture), fixture.headSha)
  assert.equal(remoteRef(fixture), fixture.headSha)
})
