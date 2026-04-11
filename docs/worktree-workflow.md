# Worktree Workflow

This repo defaults to one task per Git worktree.

That means we still use Git branches, but we stop switching branches inside one
shared checkout. Each task gets:

- its own worktree under `.worktrees/<slug>`
- its own branch named `codex/<slug>`
- its own dependency install
- its own local dev port

## Create a Task Worktree

From the repo root or from any existing worktree:

```bash
npm run worktree:new -- shampoo-logic
```

What this does:

- creates `.worktrees/shampoo-logic`
- creates branch `codex/shampoo-logic`
- bases it on `origin/main` when available
- copies ignored local files listed in `.worktreeinclude`
- runs `npm ci`

## Run the App in Parallel

Inside the new worktree:

```bash
cd .worktrees/shampoo-logic
npm run dev:worktree
```

`dev:worktree` picks a stable worktree-specific port so multiple worktrees can
run at the same time without fighting over `3000`.

If you only need the chosen port:

```bash
node scripts/worktree-dev.mjs --print-port
```

## Local Files

Fresh worktrees do not include ignored files like `.env.local`.

This repo copies the exact relative paths listed in `.worktreeinclude`, but
only when those files already exist in the main checkout and are ignored by
Git. That keeps local secrets convenient without duplicating tracked files.

## Cleanup

When a task is finished:

```bash
git worktree remove .worktrees/shampoo-logic
git worktree prune
```

## Team Rule

Use the main checkout as the stable base checkout.

For new implementation work, bug fixes, or parallel agent runs, create a new
worktree instead of switching branches in place.
