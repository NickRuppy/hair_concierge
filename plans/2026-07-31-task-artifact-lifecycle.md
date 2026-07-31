# Task artifact lifecycle

## Outcome and source context

Keep root `main` clean and current by moving persistent planning into the task worktree and requiring every task-owned artifact to be committed, archived, or explicitly discarded before merge.

## Chosen direction

Extend the existing workflow. Require a fully clean root, including untracked
files, before `worktree:new`. Do not add a new loop or silently archive files.

## Scope and non-goals

- Start persistent planning in a fresh task worktree.
- Reuse that worktree through planning, implementation, review, ship, merge, and guarded finish.
- Fetch first, require the primary root on clean `main`, fast-forward it, and
  then create the task worktree.
- Require a clean task worktree before ship and merge.
- Keep `worktree:finish` conservative.
- Do not classify or remove the existing root artifacts in this change.
- Do not change product behavior.

## Target map

- `AGENTS.md` and `CLAUDE.md`
- `.agents/skills/plan-hardening-loop/**`
- `.agents/skills/implementation-loop/SKILL.md`
- `scripts/worktree-new.mjs`
- `tests/worktree-new.test.ts`
- concise local companion updates in applicable personal workflow skills,
  including the review wrapper, reported separately because they are outside
  the PR

## Designed operator journey

1. Before writing a persistent plan or mockup, the agent checks root state.
2. `worktree:new` fetches remote refs. A root on clean `main` fast-forwards to
   `origin/main`; a dirty or non-`main` root stops with concise recovery guidance.
3. Planning and implementation reuse that worktree.
4. Before ship, task artifacts are classified as commit, external archive, or explicit discard.
5. Ship and merge stop while any disposition is unresolved.
6. After merge, `worktree:finish` removes only the exact task artifacts and fast-forwards a clean root.
7. Dirty or ambiguous content is preserved and reported.

Nick confirmed this operator journey on 2026-07-31.

Activation dependency: the current root has 20 pre-existing untracked artifacts.
After this workflow change merges, those files need a separate disposition audit
before the next `worktree:new` run.

## Mockup evidence

No mockup is required because this changes only repository workflow.

## Ordered tasks

1. Main session: add concise lifecycle ownership to `AGENTS.md`, `CLAUDE.md`,
   the plan format, and the loop handoffs.
2. Add failing tests for clean-root creation, dirty-root refusal, non-`main`
   refusal, fetch-before-branching, and fresh base selection.
3. Make `worktree:new` reuse the proven full-clean and fast-forward semantics
   from `worktree:finish`, then pass the focused tests.
4. Main session: align applicable local companion skills without duplicating
   the repository policy; keep these edits outside the PR receipt.

## Verification

- `npx tsx --test tests/worktree-new.test.ts tests/worktree-finish.test.ts`.
- `npm run ci:verify`.
- `git diff --check`.
- Final ready-check and whole-branch review on one content fingerprint.

## Review and handoff

- Counterpart plan and branch reviews are read-only and stored outside the repository unless intentionally retained.
- Claude findings accepted: define full-clean semantics, require root `main`,
  fetch before branching, add the activation dependency, keep personal edits
  outside the PR, and cut speculative finish diagnostics/tests.
- Branch review: no blockers; added explicit missing-origin and non-fast-forward
  coverage, removed the obsolete base fallback, retained fetch-first ordering,
  and deferred the preserved root-artifact audit.
- User-journey sign-off: confirmed.
- Artifact disposition: commit the listed repository files; discard
  system-temporary review reports after handoff; no archive or unresolved task
  artifact.
- Stop before commit, push, merge, deployment, or cleanup.
