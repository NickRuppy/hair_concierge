# Tooling static candidates: independent C2 reassessment

## Scope and read limit

This corrects only the prior C2 cardinality blocker. I reread the complete `createFixture` helper and the APPLY-related operator paths in `scripts/worktree-finish.mjs`; no runner or mutation was invoked.

## C2 — supported conditional transfer

`tests/worktree-finish.test.ts:71-113` defaults `createFixture` to two linear feature commits. The donor at `:213-229` explicitly uses three; the retained detached-worktree keeper at `:403-418` uses the default two. Both fixture variants then produce a separate squash commit on `main` (`:108-113`) and bind the case-specific `headSha` and `mergeSha` into the test environment.

The APPLY path has no commit-cardinality, parent-traversal, changed-tree, or feature-file predicate. Its relevant reads are:

- `scripts/worktree-finish.mjs:282-293`: supplied `mergeSha` must be an ancestor of `origin/main`.
- `:296-343`: select an unlocked, clean worktree only where `entry.branch === branch`, and require its exact `headSha`.
- `:423-446,458-460`: decide and perform only a clean-root `merge --ff-only origin/main`.
- `:555-589`: re-read exact local `headSha`, delete the remote ref with an exact `--force-with-lease`, remove/prune the selected worktree, require no selected branch checkout, and delete the local ref with the exact expected SHA.

A detached checkout is excluded by the branch selector (`entry.branch` is absent), so the retained keeper additionally proves unrelated-detached preservation. There is no source path that distinguishes the two-commit from the three-commit fixture after each supplies its own exact hashes. The raw fixture byte difference is therefore outside the owner readset.

The retained keeper must receive the donor union unchanged: successful exit, `FINISHED`, local and remote refs absent, primary-root `HEAD === mergeSha`, and absence of the selected task worktree. It already observes success and both ref absences; its detached-preservation assertion remains. This is a conditional C, pending main-owned static application and native fault proof. It is not execution evidence.

## Limits

This does not establish behavior for non-linear histories, failed squashes, or arbitrary extra worktrees; neither candidate supplies those inputs. The existing proposed controls for suppressed root sync and missing `FINISHED` are meaningful only after they are run by the parent.
