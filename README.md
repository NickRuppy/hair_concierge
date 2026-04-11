# Hair Concierge

## Recommended Dev Workflow

This repo defaults to one task per Git worktree.

Create a fresh task worktree with dependencies and local env files:

```bash
npm run worktree:new -- shampoo-logic
cd .worktrees/shampoo-logic
```

Start the app for that worktree:

```bash
npm run dev:worktree
```

`dev:worktree` picks a stable worktree-specific port so multiple agents or
parallel tasks can run side by side.

## Standard Commands

```bash
npm run dev
npm run dev:worktree
npm run lint
npm run typecheck
npm run build
npm run ci:verify
```

## Worktree Helpers

```bash
npm run worktree:new -- <slug>
npm run worktree:list
npm run worktree:prune
```

More detail lives in `docs/worktree-workflow.md`.
