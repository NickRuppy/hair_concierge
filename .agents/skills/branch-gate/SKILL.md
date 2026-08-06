---
name: branch-gate
description: Git branch and worktree safety gate. Use before Codex makes code edits, commits, rebases, merges, cleanup commits, or starts a new implementation task in a Git repository; use when the user asks whether to use a branch or worktree; use when a repo has dirty state, multiple local branches, stale worktrees, or PR/merge prep.
---

# Branch Gate

## Purpose

Prevent accidental mixing of unrelated work. Before mutating a Git repo, inspect the current branch, dirty state, upstream, worktrees, stashes, and likely base branch; then choose whether to continue, create a branch, create a worktree, or pause for user intent.

## Quick Check

From the repository root, run the bundled read-only snapshot first:

```bash
./.agents/skills/branch-gate/scripts/git-state.sh
```

`git-dir != git-common-dir` identifies a linked worktree. `--show-superproject-working-tree` separately identifies submodule context and repository ownership. Treat detached HEAD as externally managed unless branch creation is authorized.

If the script is unavailable, run the equivalent read-only checks:

```bash
git status --short --branch
git branch -vv --all
git worktree list
git stash list
```

Use `git fetch --all --prune` before merge/rebase/PR decisions or when remote freshness matters. Fetch mutates Git metadata, so mention it as the first write-like step.

If the repo uses a root `main` checkout plus feature worktrees, treat the root checkout as the stable base:

- keep root `main` clean;
- fast-forward it before starting new work;
- branch/worktree creation should prefer fresh `origin/main`, not a stale local base.

Typical root-base refresh:

```bash
git fetch --all --prune
git switch main
git pull --ff-only
```

## Decision Rules

- **Current branch is `main` or another protected/base branch:** create or switch to a feature branch before edits unless the user explicitly asked to work on that branch.
- **Current branch is root `main` and it is behind its upstream:** fast-forward it with `git pull --ff-only` before creating a branch or worktree, unless local uncommitted files would be overwritten.
- **Worktree is dirty:** classify changes before editing. Continue only if the dirty changes are clearly part of the same task; otherwise commit, stash, or move to a new worktree before starting.
- **User asks to start unrelated work while current branch has in-progress work:** prefer a new worktree over switching branches.
- **One active task, clean worktree, no parallel context needed:** a normal branch is enough.
- **Parallel feature streams, long-running experiments, PR review while preserving current state, or messy branch reconciliation:** prefer a worktree.
- **Existing branch already matches the task:** switch to it only if the current worktree is clean or the dirty changes are safely handled.
- **Untracked files exist:** inspect and classify them. Add ignores for repeatable local artifacts; preserve unique docs/data/code unless the user explicitly chooses deletion.
- **Stale worktrees appear:** run `git worktree prune --dry-run --verbose` before pruning. Prune only metadata for missing paths.
- **Branch deletion:** delete only branches confirmed merged (`git branch --merged <base>`) or patch-equivalent (`git cherry -v <base> <branch>` shows `-`). Never delete remote branches as part of routine cleanup unless explicitly requested.

## Branch vs Worktree Defaults

Prefer a **branch** when:

- the current worktree is clean;
- the task is the next linear piece of work;
- the user wants one PR or one focused commit stack.

Prefer a **worktree** when:

- the current branch has uncommitted or partially committed work;
- the user wants to switch to a different task without disturbing the current one;
- a PR/review/fix should be isolated from a long-running branch;
- you need to compare or integrate separate branches side by side.

Use repo-local ignored worktrees when available:

```bash
git check-ignore -q .worktrees
git worktree add .worktrees/<slug> -b codex/<slug> origin/main
```

If the ignore check fails, use a sibling directory instead:

```bash
git worktree add ../worktrees/<repo>-<slug> -b codex/<slug> origin/main
```

Remove finished worktrees cleanly:

```bash
git worktree remove <path>
git worktree prune
```

## Sync Habit

When a repository follows a "root `main` + feature worktrees" model:

- Before new implementation work: refresh root `main`, then branch from `origin/main`.
- After a PR merge: refresh root `main` again with `git pull --ff-only`.
- Only clean up merged worktrees or branches after the base checkout is current, so merged-vs-unmerged decisions are based on fresh remote state.

## Response Habit

Before edits, state the gate decision in one short update:

- current branch and cleanliness;
- chosen path: continue, new branch, new worktree, or pause;
- reason, especially if preserving unrelated user work.

After cleanup or integration, finish with:

```bash
git status --short --branch
git branch -vv --all
git worktree list
```
