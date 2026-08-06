---
name: ship-it
description: Use when a verified Hair Concierge task branch is ready for explicitly authorized commit, push, and draft PR creation while merge, deployment, production writes, and cleanup remain separate decisions.
---

# Hair Concierge Ship

Publish an already verified, reviewed branch. Do not duplicate verification or review without evidence that the tree changed.

## Preconditions

- The user has explicitly authorized the requested publication actions.
- A fresh `ready-check` receipt and `request-code-review` receipt identify the same canonical content fingerprint.
- No verified blocking finding remains.
- Every task-owned artifact is classified as commit, archive, or discard.
- If content changed after either receipt, refresh the affected receipt before proceeding. Staging or committing byte-identical reviewed content does not invalidate a receipt.
- If `supabase/migrations/**` changed, identify the migration IDs and check the target project migration state before merge.

## Default path

1. Confirm intended files, current branch/base, receipts, residual risk, and authorized stop point.
2. Stage only the intended changes.
3. Create one concise conventional commit for the logical change.
4. Recompute the content fingerprint and prove the commit contains exactly the reviewed content.
5. Require a clean task worktree.
6. Push the task branch.
7. Open a draft PR by default.

## Boundaries

- “Ship it” authorizes commit, push, and draft PR creation only. Merge, deployment, production writes, and cleanup are distinct actions; do only those explicitly authorized.
- Before merge, refresh GitHub PR/CI state and ensure review covers the final diff.
- Never waive final review for migrations, auth, billing, payments, privacy/security, incidents, or broad user-facing behavior.
- Never infer deployment from push, PR, or merge.

## Separately authorized merge

When the user explicitly asks to merge:

1. refresh GitHub PR and CI state;
2. confirm the final PR content fingerprint matches the verified/reviewed receipt and no task-owned artifact remains unresolved;
3. apply the migration-ordering rules below;
4. merge using the repository's accepted strategy;
5. verify the remote PR/branch state.

Deployment, production writes, and cleanup remain separate authorizations.

## Separately authorized cleanup

Remove the worktree only when the user explicitly asks, the publication action succeeded, and the worktree has no uncommitted or untracked state that would be lost. Otherwise leave it intact and report its path.

## Supabase migrations

- Production project: `pqdkhefxsxkyeqelqegq`.
- Report whether each changed migration is applied, applied during shipping, or unapplied.
- If application code would deploy before an unapplied required migration, stop before merge unless the user explicitly chooses the safe migration-first sequence.
- If migration history is divergent, do not run a blind `supabase db push`; report the state and use a surgical migration plan.

Completion criterion: every authorized action succeeded, no broader action was inferred, and cleanup did not discard state.
