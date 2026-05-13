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

## Local Chat Testing

For manual chat testing behind the Stripe paywall, enable the local dev login
shortcut in `.env.local`:

```bash
LOCAL_DEV_LOGIN_ENABLED=1
```

Then restart the dev server and open:

```text
http://localhost:<port>/api/dev/login?next=/chat
```

The route only works on localhost in `next dev` when the flag is enabled. It
creates or refreshes a local Supabase test user, marks onboarding complete,
seeds a realistic hair profile, sets `subscription_status` to `active`, signs
the browser in, and redirects to `/chat`.

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
