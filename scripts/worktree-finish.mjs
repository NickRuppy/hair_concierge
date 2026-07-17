#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const ZERO_SHA = "0".repeat(40)
const SHA_PATTERN = /^[0-9a-f]{40}$/
const TASK_BRANCH_PATTERN = /^(codex|ship)\/[A-Za-z0-9._/-]+$/
const DISPOSABLE_IGNORED_PATHS = [".husky/_/", ".next/", "build/", "node_modules/", "out/"]

class RefusalError extends Error {}

function printUsage() {
  console.log(`Usage: npm run worktree:finish -- --pr <number> [--apply]

Safely finishes one merged Chaarlie pull request from the primary main worktree.

The default is a read-only dry run. --apply may fast-forward a clean root main,
lease-delete the exact remote task branch, remove its clean unlocked worktree,
prune stale worktree metadata, and delete the exact local task ref.

The command refuses dirty, locked, mismatched, forked, stacked, protected,
dependent-PR, or otherwise ambiguous state. It never stashes, resets, rebases,
or force-removes a worktree.
`)
}

function parseArgs(argv) {
  const options = { apply: false, pr: null }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === "--help" || argument === "-h") {
      printUsage()
      process.exit(0)
    }

    if (argument === "--apply") {
      options.apply = true
      continue
    }

    if (argument === "--pr") {
      const value = argv[index + 1]
      if (!value || !/^\d+$/.test(value) || Number(value) < 1) {
        throw new RefusalError("--pr requires a positive pull request number")
      }
      if (options.pr !== null) {
        throw new RefusalError("--pr may be specified only once")
      }
      options.pr = Number(value)
      index += 1
      continue
    }

    throw new RefusalError(`Unknown argument: ${argument}`)
  }

  if (!options.pr) {
    throw new RefusalError("A pull request number is required: --pr <number>")
  }

  return options
}

function run(command, args, { cwd = process.cwd(), allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`)
  }

  if (!allowFailure && result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim()
    throw new Error(
      `Command failed (${result.status}): ${command} ${args.join(" ")}${
        detail ? `\n${detail}` : ""
      }`,
    )
  }

  return result
}

function git(args, options = {}) {
  return run("git", args, options)
}

function gh(args, options = {}) {
  const override = process.env.WORKTREE_FINISH_GH_BIN
  if (override && process.env.WORKTREE_FINISH_TEST_MODE !== "1") {
    throw new Error("WORKTREE_FINISH_GH_BIN is available only in explicit test mode")
  }
  return run(override || "gh", args, options)
}

function parseWorktrees(output) {
  return output
    .trim()
    .split(/\r?\n\r?\n/)
    .filter(Boolean)
    .map((block) => {
      const entry = {
        branch: null,
        detached: false,
        head: null,
        locked: false,
        lockReason: "",
        path: null,
        prunable: false,
      }

      for (const line of block.split(/\r?\n/)) {
        const separator = line.indexOf(" ")
        const key = separator === -1 ? line : line.slice(0, separator)
        const value = separator === -1 ? "" : line.slice(separator + 1)

        if (key === "worktree") entry.path = value
        if (key === "HEAD") entry.head = value
        if (key === "branch") entry.branch = value.replace(/^refs\/heads\//, "")
        if (key === "detached") entry.detached = true
        if (key === "locked") {
          entry.locked = true
          entry.lockReason = value
        }
        if (key === "prunable") entry.prunable = true
      }

      return entry
    })
}

function listWorktrees(repoRoot) {
  return parseWorktrees(git(["worktree", "list", "--porcelain"], { cwd: repoRoot }).stdout)
}

function readLocalRef(repoRoot, branch) {
  const ref = `refs/heads/${branch}`
  const exists = git(["show-ref", "--verify", "--quiet", ref], {
    cwd: repoRoot,
    allowFailure: true,
  })

  if (exists.status === 1) return null
  if (exists.status !== 0) {
    throw new Error(`Could not inspect local branch ${branch}`)
  }

  return git(["rev-parse", ref], { cwd: repoRoot }).stdout.trim()
}

function readRemoteRef(repoRoot, branch) {
  const result = git(["ls-remote", "--heads", "origin", `refs/heads/${branch}`], { cwd: repoRoot })
  const line = result.stdout.trim()
  return line ? line.split(/\s+/)[0] : null
}

function requireValidSha(value, label) {
  if (!SHA_PATTERN.test(value || "") || value === ZERO_SHA) {
    throw new RefusalError(`${label} is not a non-zero 40-character Git SHA`)
  }
}

function requireCleanWorktree(worktreePath) {
  const status = git(["-C", worktreePath, "status", "--porcelain", "--untracked-files=all"], {
    allowFailure: true,
  })

  if (status.status !== 0) {
    throw new RefusalError(`Task worktree cannot be inspected: ${worktreePath}`)
  }

  if (status.stdout.trim()) {
    throw new RefusalError(`Task worktree has tracked or untracked changes: ${worktreePath}`)
  }
}

function loadIncludedPaths(repoRoot) {
  const includeFile = path.join(repoRoot, ".worktreeinclude")
  if (!existsSync(includeFile)) return []

  return readFileSync(includeFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
}

function isEmptyDirectory(candidatePath) {
  return statSync(candidatePath).isDirectory() && readdirSync(candidatePath).length === 0
}

function isDisposableIgnoredPath(relativePath) {
  if (relativePath === "next-env.d.ts" || relativePath.endsWith(".tsbuildinfo")) return true

  return DISPOSABLE_IGNORED_PATHS.some(
    (allowedPath) => relativePath === allowedPath || relativePath.startsWith(allowedPath),
  )
}

function isUnchangedIncludedPath(repoRoot, worktreePath, relativePath, includedPaths) {
  const normalizedPath = relativePath.replace(/\/$/, "")
  if (!includedPaths.includes(normalizedPath)) return false

  const rootPath = path.join(repoRoot, normalizedPath)
  const taskPath = path.join(worktreePath, normalizedPath)
  if (!existsSync(rootPath) || !existsSync(taskPath)) return false

  const comparison = git(["diff", "--no-index", "--quiet", "--", rootPath, taskPath], {
    allowFailure: true,
  })
  if (comparison.status === 0) return true
  if (comparison.status === 1) return false
  throw new RefusalError(`Ignored included path cannot be compared safely: ${relativePath}`)
}

function requireSafeIgnoredPaths(repoRoot, worktreePath) {
  const result = git(
    [
      "-C",
      worktreePath,
      "status",
      "--porcelain=v1",
      "-z",
      "--ignored=matching",
      "--untracked-files=all",
    ],
    { allowFailure: true },
  )

  if (result.status !== 0) {
    throw new RefusalError(`Task worktree ignored files cannot be inspected: ${worktreePath}`)
  }

  const ignoredPaths = result.stdout
    .split("\0")
    .filter((entry) => entry.startsWith("!! "))
    .map((entry) => entry.slice(3))
  const includedPaths = loadIncludedPaths(repoRoot)
  const ambiguousPaths = ignoredPaths.filter((relativePath) => {
    const candidatePath = path.join(worktreePath, relativePath)
    return !(
      isDisposableIgnoredPath(relativePath) ||
      (existsSync(candidatePath) && isEmptyDirectory(candidatePath)) ||
      isUnchangedIncludedPath(repoRoot, worktreePath, relativePath, includedPaths)
    )
  })

  if (ambiguousPaths.length > 0) {
    throw new RefusalError(
      `Task worktree has ignored local content that may be unique: ${ambiguousPaths.join(", ")}`,
    )
  }
}

function readWorktreeLock(worktreePath) {
  const result = git(["-C", worktreePath, "rev-parse", "--git-path", "locked"], {
    allowFailure: true,
  })

  if (result.status !== 0) {
    throw new RefusalError(`Task worktree lock state cannot be inspected: ${worktreePath}`)
  }

  const lockPath = result.stdout.trim()
  if (!lockPath || !existsSync(lockPath)) {
    return { locked: false, reason: "" }
  }

  return {
    locked: true,
    reason: readFileSync(lockPath, "utf8").trim(),
  }
}

function requireMergeOnMain(repoRoot, mergeSha) {
  const result = git(["merge-base", "--is-ancestor", mergeSha, "origin/main"], {
    cwd: repoRoot,
    allowFailure: true,
  })

  if (result.status === 1) {
    throw new RefusalError(`PR merge commit ${mergeSha} is not reachable from fresh origin/main`)
  }
  if (result.status !== 0) {
    throw new Error("Could not verify the PR merge commit on origin/main")
  }
}

function inspectTaskWorktree(repoRoot, branch, headSha) {
  const worktrees = listWorktrees(repoRoot)
  const branchWorktrees = worktrees.filter((entry) => entry.branch === branch)

  if (branchWorktrees.length > 1) {
    throw new RefusalError(
      `Task branch is checked out in multiple worktrees: ${branchWorktrees
        .map((entry) => entry.path)
        .join(", ")}`,
    )
  }

  const taskWorktree = branchWorktrees[0] || null
  if (!taskWorktree) return null

  // Older Git versions omit the porcelain `prunable` marker, so also prove the
  // registered path exists before relying on any worktree-local inspection.
  if (!existsSync(taskWorktree.path)) {
    throw new RefusalError(
      `Task worktree path is missing and metadata ownership is ambiguous: ${taskWorktree.path}`,
    )
  }
  if (taskWorktree.prunable) {
    throw new RefusalError(
      `Task worktree metadata is prunable and ownership is ambiguous: ${taskWorktree.path}`,
    )
  }
  if (taskWorktree.head !== headSha) {
    throw new RefusalError(
      `Task worktree HEAD ${taskWorktree.head} does not match PR head ${headSha}`,
    )
  }
  const lock = readWorktreeLock(taskWorktree.path)
  if (taskWorktree.locked || lock.locked) {
    const reason = taskWorktree.lockReason || lock.reason
    throw new RefusalError(
      `Task worktree is intentionally locked${reason ? ` (${reason})` : ""}: ${taskWorktree.path}`,
    )
  }

  requireCleanWorktree(taskWorktree.path)
  requireSafeIgnoredPaths(repoRoot, taskWorktree.path)
  return taskWorktree
}

function loadRepositoryIdentity() {
  const result = gh(["repo", "view", "--json", "nameWithOwner"])
  const parsed = JSON.parse(result.stdout)
  if (!parsed.nameWithOwner) {
    throw new Error("GitHub repository identity is missing nameWithOwner")
  }
  return parsed.nameWithOwner
}

function loadPullRequest(pr, repository) {
  const fields = [
    "number",
    "state",
    "baseRefName",
    "headRefName",
    "headRefOid",
    "mergeCommit",
    "isCrossRepository",
    "headRepository",
  ].join(",")
  const result = gh(["pr", "view", String(pr), "--repo", repository, "--json", fields])
  return JSON.parse(result.stdout)
}

function verifyPullRequest(pr, repository, expectedNumber) {
  if (Number(pr.number) !== expectedNumber) {
    throw new RefusalError(
      `GitHub returned PR #${pr.number || "unknown"}, expected #${expectedNumber}`,
    )
  }
  if (pr.state !== "MERGED") {
    throw new RefusalError(`PR is not merged (state: ${pr.state || "unknown"})`)
  }
  if (pr.baseRefName !== "main") {
    throw new RefusalError(`PR base must be main, not ${pr.baseRefName}`)
  }
  if (pr.isCrossRepository) {
    throw new RefusalError("Fork pull requests are outside this finisher's scope")
  }
  if (pr.headRepository?.nameWithOwner !== repository) {
    throw new RefusalError(
      `PR head repository ${pr.headRepository?.nameWithOwner || "unknown"} does not match ${repository}`,
    )
  }
  if (!TASK_BRANCH_PATTERN.test(pr.headRefName || "")) {
    throw new RefusalError(
      `PR head branch is not an allowed task branch: ${pr.headRefName || "unknown"}`,
    )
  }

  requireValidSha(pr.headRefOid, "PR headRefOid")
  requireValidSha(pr.mergeCommit?.oid, "PR mergeCommit.oid")
}

function requireNoDependentPullRequests(branch, repository) {
  const result = gh([
    "pr",
    "list",
    "--repo",
    repository,
    "--state",
    "open",
    "--base",
    branch,
    "--json",
    "number,url",
  ])
  const dependentPullRequests = JSON.parse(result.stdout)

  if (!Array.isArray(dependentPullRequests)) {
    throw new Error("GitHub returned an invalid dependent pull request response")
  }
  if (dependentPullRequests.length > 0) {
    throw new RefusalError(
      `Remote branch is the base of open dependent PR(s): ${dependentPullRequests
        .map((dependent) => `#${dependent.number}`)
        .join(", ")}`,
    )
  }
}

function planRootSync(repoRoot) {
  const status = git(["status", "--porcelain", "--untracked-files=all"], {
    cwd: repoRoot,
  }).stdout.trim()

  if (status) {
    return { action: "skip", reason: "root main is dirty" }
  }

  const ancestor = git(["merge-base", "--is-ancestor", "HEAD", "origin/main"], {
    cwd: repoRoot,
    allowFailure: true,
  })

  if (ancestor.status === 1) {
    return { action: "skip", reason: "root main has diverged from origin/main" }
  }
  if (ancestor.status !== 0) {
    throw new Error("Could not determine whether root main can fast-forward")
  }

  return { action: "fast-forward", reason: "root main is clean" }
}

function printPlan({ apply, branch, localSha, pr, remoteSha, rootSync, taskWorktree }) {
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`)
  console.log(`PR: #${pr.number}`)
  console.log(`Task branch: ${branch}`)
  console.log(
    `Root main: ${rootSync.action === "fast-forward" ? "fast-forward to origin/main" : `leave unchanged (${rootSync.reason})`}`,
  )
  console.log(`Remote branch: ${remoteSha ? "lease-delete exact PR head" : "already absent"}`)
  console.log(`Worktree: ${taskWorktree ? `remove ${taskWorktree.path}` : "already absent"}`)
  console.log(`Local branch: ${localSha ? "delete exact PR head" : "already absent"}`)
}

function applyRootSync(repoRoot, rootSync) {
  if (rootSync.action !== "fast-forward") return
  git(["merge", "--ff-only", "origin/main"], { cwd: repoRoot })
}

function deleteRemoteBranch(repoRoot, branch, expectedSha) {
  git(
    [
      "push",
      `--force-with-lease=refs/heads/${branch}:${expectedSha}`,
      "origin",
      `:refs/heads/${branch}`,
    ],
    { cwd: repoRoot },
  )
}

function verifyPostconditions(repoRoot, branch) {
  const remoteSha = readRemoteRef(repoRoot, branch)
  const localSha = readLocalRef(repoRoot, branch)
  const remaining = listWorktrees(repoRoot).filter((entry) => entry.branch === branch)

  const failures = []
  if (remoteSha) failures.push(`remote branch remains at ${remoteSha}`)
  if (localSha) failures.push(`local branch remains at ${localSha}`)
  if (remaining.length > 0) {
    failures.push(`worktree remains at ${remaining.map((entry) => entry.path).join(", ")}`)
  }

  if (failures.length > 0) {
    throw new Error(`Postcondition verification failed: ${failures.join("; ")}`)
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const currentTopLevel = git(["rev-parse", "--show-toplevel"]).stdout.trim()
  const worktrees = listWorktrees(currentTopLevel)
  const primaryWorktree = worktrees[0]

  if (!primaryWorktree?.path) {
    throw new RefusalError("Could not identify the primary Git worktree")
  }
  if (path.resolve(currentTopLevel) !== path.resolve(primaryWorktree.path)) {
    throw new RefusalError("worktree:finish must run from the repository's primary root checkout")
  }

  const repoRoot = primaryWorktree.path
  const currentBranch = git(["branch", "--show-current"], {
    cwd: repoRoot,
  }).stdout.trim()
  if (currentBranch !== "main") {
    throw new RefusalError(`Primary root must be on main, not ${currentBranch || "detached HEAD"}`)
  }

  git(["fetch", "--all", "--prune"], { cwd: repoRoot })

  const repository = loadRepositoryIdentity()
  const pr = loadPullRequest(options.pr, repository)
  verifyPullRequest(pr, repository, options.pr)
  requireMergeOnMain(repoRoot, pr.mergeCommit.oid)

  const branch = pr.headRefName
  const headSha = pr.headRefOid
  const localSha = readLocalRef(repoRoot, branch)
  const remoteSha = readRemoteRef(repoRoot, branch)

  if (localSha && localSha !== headSha) {
    throw new RefusalError(`Local branch tip ${localSha} does not match merged PR head ${headSha}`)
  }
  if (remoteSha && remoteSha !== headSha) {
    throw new RefusalError(
      `Remote branch tip ${remoteSha} does not match merged PR head ${headSha}`,
    )
  }
  if (remoteSha) {
    requireNoDependentPullRequests(branch, repository)
  }

  const taskWorktree = inspectTaskWorktree(repoRoot, branch, headSha)
  const rootSync = planRootSync(repoRoot)

  printPlan({
    apply: options.apply,
    branch,
    localSha,
    pr,
    remoteSha,
    rootSync,
    taskWorktree,
  })

  if (!options.apply) {
    console.log(`DRY RUN SAFE — PR #${options.pr} is eligible for guarded cleanup`)
    return
  }

  applyRootSync(repoRoot, rootSync)

  const freshLocalSha = readLocalRef(repoRoot, branch)
  if (freshLocalSha && freshLocalSha !== headSha) {
    throw new RefusalError(`Local branch changed during cleanup; preserved at ${freshLocalSha}`)
  }

  inspectTaskWorktree(repoRoot, branch, headSha)

  if (remoteSha) {
    requireNoDependentPullRequests(branch, repository)
    deleteRemoteBranch(repoRoot, branch, headSha)
  }

  const removableTaskWorktree = inspectTaskWorktree(repoRoot, branch, headSha)
  if (removableTaskWorktree) {
    git(["worktree", "remove", removableTaskWorktree.path], { cwd: repoRoot })
  }

  git(["worktree", "prune"], { cwd: repoRoot })

  const checkedOut = listWorktrees(repoRoot).filter((entry) => entry.branch === branch)
  if (checkedOut.length > 0) {
    throw new RefusalError(
      `Local branch is still checked out; preserved at ${checkedOut
        .map((entry) => entry.path)
        .join(", ")}`,
    )
  }

  if (freshLocalSha) {
    git(["update-ref", "-d", `refs/heads/${branch}`, headSha], { cwd: repoRoot })
  }

  verifyPostconditions(repoRoot, branch)
  console.log(`FINISHED — PR #${options.pr} merged-task artifacts are clean`)
}

try {
  main()
} catch (error) {
  if (error instanceof RefusalError) {
    console.error(`REFUSED: ${error.message}`)
    process.exitCode = 2
  } else {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
