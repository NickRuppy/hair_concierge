#!/usr/bin/env bash
set -u

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a Git worktree."
  exit 0
fi

echo "== repo =="
git rev-parse --show-toplevel

echo
echo "== workspace identity =="
git_dir_raw=$(git rev-parse --git-dir)
git_common_raw=$(git rev-parse --git-common-dir)
git_dir=$(cd "$git_dir_raw" 2>/dev/null && pwd -P)
git_common=$(cd "$git_common_raw" 2>/dev/null && pwd -P)
echo "git-dir: $git_dir"
echo "git-common-dir: $git_common"
superproject=$(git rev-parse --show-superproject-working-tree 2>/dev/null || true)
echo "superproject: ${superproject:-none}"

echo
echo "== status =="
git status --short --branch

echo
echo "== current branch =="
branch=$(git branch --show-current || true)
echo "${branch:-detached HEAD}"

echo
echo "== branches =="
git branch -vv --all

echo
echo "== worktrees =="
git worktree list

echo
echo "== stashes =="
git stash list

echo
echo "== untracked =="
git ls-files --others --exclude-standard
