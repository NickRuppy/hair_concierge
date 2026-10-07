---
name: implementation-loop
description: Use for Hair Concierge when an approved implementation plan or clearly bounded non-trivial non-user-facing change should be executed through decision-coverage intake, branch setup, implementation, verification, final review, and a review-ready handoff. Use after plan-hardening-loop; do not use for brainstorming or plan creation.
---

# Implementation Loop

Execute one approved outcome to a verified, review-ready branch without letting process steps replace the objective.

## Goal, plan, and loop

- **Goal** is the durable outcome: what must become true.
- **Plan** is the current set of steps: it may change as evidence appears.
- **Loop** is this repeatable procedure: orient, implement, verify, review, and hand off.

A Goal can contain this loop. The loop does not require formal Goal mode.

## 1. Anchor the outcome

Read the requested outcome and approved plan or contract when one exists. Apply **Working together and planning decisions** in `AGENTS.md`: carry existing authorization forward and resolve only actual open consequential choices. For plan-backed work, record current confirmed decision coverage, original authorization and scope, and internal revalidation. Repair missing or stale documentation from the available evidence yourself; ask only when the intended behavior or authorization is genuinely unclear.

For new flows or material UX changes, confirm the concrete evidence and journey were approved together or in an earlier review. Exact routine changes and faithful execution of an approved design do not require another sign-off. If a prototype settled a decision, record its finding and disposition and implement retained behavior through the normal test and safeguard workflow.

Keep the implementation contract brief; link existing decision coverage instead of repeating it. A bounded explicit request with no unresolved consequential choice is sufficient authorization.

Use formal Goal mode only when the user explicitly asks for it and the work is likely to span multiple turns, resumptions, or a long implementation sequence. If formal Goal mode is requested, first inspect the existing goal to avoid replacing unrelated active work.

On resume, continue a matching active goal without replacement. Reconcile plan status with `git log`, the current diff, and receipts; trust durable artifacts over chat and do not repeat completed slices after compaction. If the goal is paused, wait for the user or system to resume it. If an existing goal is unrelated or cannot be reconciled safely, ask before replacing it.

State the outcome, scope, verification, and last authorized action. Record any actual open decision with its affected work. For non-trivial work, keep the decision coverage in the plan or a compact inline record using `plan-hardening-loop`'s fields; routine bounded work skips this loop unless a consequential choice appears.

Completion criterion: the controlling outcome is stable, authorization is clear, and process details are subordinate to it.

## 2. Establish a safe branch

Use `branch-gate`. Reuse the planning worktree; if no persistent planning artifact exists, create a repo-local worktree on `codex/<slug>` from fresh `origin/main`. Preserve unrelated state and record the plan path and execution mode.

Choose sequential execution for tightly coupled work, bounded delegation for independent scopes, or mixed execution when both apply. Keep product decisions, architecture, integration, and readiness in the main session.

Delegation uses the roles and brief contract in `AGENTS.md`. Require `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`; every non-`DONE` status must change the context, scope, model, plan, or stop decision before retry or review.

Completion criterion: the write location, base, dirty-state ownership, and execution scopes are unambiguous.

## 3. Implement in bounded slices

Follow the plan in dependency order. For each slice:

1. establish or update the regression guard when the behavior is deterministic;
2. make the smallest coherent change;
3. run focused verification;
4. update the working plan and record deviations with evidence.

When changing deterministic behavior or regression guards, read `references/test-first-quality.md` and record the red proof.

Return to planning only when evidence reveals a product decision, material architecture change, scope expansion, or risk acceptance that the approved plan did not settle. Mark dependent work's decision coverage `pending`; continue independent authorized work, but do not continue the affected work until `plan-hardening-loop` has resolved or explicitly parked the choice and restored current confirmed coverage.

Completion criterion: every in-scope plan item is implemented or explicitly blocked, with no unrelated edits absorbed and every task-owned artifact classified as commit, archive, or discard.

## 4. Verify the final tree

Use `ready-check` on the complete tree. Run repository checks plus the risk-specific checks named by the plan. For user-facing behavior, include browser or simulated-user evidence when useful.

Create a verification receipt containing:

- branch and base
- the canonical content fingerprint from `ready-check`
- revalidated decision-coverage status, original acknowledgement, and internal revalidation
- commands and outcomes
- manual or browser evidence
- artifact disposition and unresolved task-owned files
- skipped checks and residual risk

Completion criterion: the receipt matches the exact content proposed for review.

## 5. Review once, at the right boundary

Use `request-code-review` as the single repository review router. Run the configured counterpart whole-branch review only when `AGENTS.md` requires it. Verify findings locally, fix supported defects, and rerun affected checks.

If content changes after either receipt, refresh the stale receipt; do not blindly rerun unrelated review lanes. Staging or committing byte-identical content does not stale a receipt.

Before handoff, revalidate decision coverage against the final tree. A material implementation deviation or review finding that introduces a consequential choice returns coverage to `pending` and the affected work to `plan-hardening-loop`.

Completion criterion: no blocking verified findings remain and verification/review receipts identify the same canonical content fingerprint.

## 6. Hand off

Continue into the next workflow stage when it is already authorized. Otherwise report the completed outcome, verification/review, residual risks, branch/worktree, artifact disposition, and a concrete recommended next action. If blocked, state the missing decision, access, or evidence and what would resolve it; finish independent authorized work first.

Stop before commit, push, PR, merge, deploy, production write, or cleanup unless the user explicitly authorized that action. Use `ship-it` when publication is authorized; do not ask again for actions already included in that request.
