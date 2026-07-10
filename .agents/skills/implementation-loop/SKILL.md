---
name: implementation-loop
description: Use for Hair Concierge when an approved implementation plan or clearly bounded non-trivial change should be executed through branch setup, implementation, verification, final review, and a review-ready handoff. Use after plan-hardening-loop; do not use for brainstorming or plan creation.
---

# Implementation Loop

Execute one approved outcome to a verified, review-ready branch without letting process steps replace the objective.

## Goal, plan, and loop

- **Goal** is the durable outcome: what must become true.
- **Plan** is the current set of steps: it may change as evidence appears.
- **Loop** is this repeatable procedure: orient, implement, verify, review, and hand off.

A Goal can contain this loop. The loop does not require formal Goal mode.

## 1. Anchor the outcome

Read the approved plan and inspect any active goal before editing.

For user-facing work, confirm the plan contains **Mockup evidence**, confirmed mockup review, a **Designed user journey**, and explicit user-journey sign-off. If any is missing or pending, return to `plan-hardening-loop`; do not implement. A prose-only visual description or general plan approval is not a substitute. For backend-only work, accept an explicitly confirmed operator/integration journey plus an explicit statement that no user-facing mockup is required because no surface, copy, timing, or feedback changes.

Use formal Goal mode only when the user explicitly asks for it and the work is likely to span multiple turns, resumptions, or a long implementation sequence. If formal Goal mode is requested, first inspect the existing goal to avoid replacing unrelated active work.

On resume, continue a matching active goal without creating a replacement. If the matching goal is paused, do not replace it or continue implementation until the user or system resumes it. If an existing goal is unrelated, or its status cannot be safely reconciled, stop and ask before closing or replacing it.

In every implementation-loop run, state a compact implementation contract. Formal Goal mode supplements this contract; it does not replace it:

```text
Outcome: <user-visible or repository state that must become true>
Scope: <plan path and boundaries>
Verification: <proof required>
Stop: <last authorized external action>
```

Quick audits, questions, queue/status passes, tiny non-user-facing fixes, and routine automation runs do not trigger this skill and do not require an implementation contract or formal Goal. A tiny user-facing fix still returns to `plan-hardening-loop` for contextual mockup review and journey sign-off.

Completion criterion: the controlling outcome is stable, authorization is clear, and process details are subordinate to it.

## 2. Establish a safe branch

Use `branch-gate`. Default to a repo-local worktree on `codex/<slug>` from fresh `origin/main`, preserve unrelated state, and record the plan path and execution mode.

Choose sequential execution for tightly coupled work, bounded delegation for independent scopes, or mixed execution when both apply. Keep product decisions, architecture, integration, and readiness in the main session.

Completion criterion: the write location, base, dirty-state ownership, and execution scopes are unambiguous.

## 3. Implement in bounded slices

Follow the plan in dependency order. For each slice:

1. establish or update the regression guard when the behavior is deterministic;
2. make the smallest coherent change;
3. run focused verification;
4. update the working plan and record deviations with evidence.

Return to planning only when evidence reveals a product decision, material architecture change, scope expansion, or risk acceptance that the approved plan did not settle.

Completion criterion: every in-scope plan item is implemented or explicitly blocked, with no unrelated edits absorbed.

## 4. Verify the final tree

Use `ready-check` on the complete tree. Run repository checks plus the risk-specific checks named by the plan. For user-facing behavior, include browser or simulated-user evidence when useful.

Create a verification receipt containing:

- branch and base
- the canonical content fingerprint from `ready-check`
- commands and outcomes
- manual or browser evidence
- skipped checks and residual risk

Completion criterion: the receipt matches the exact content proposed for review.

## 5. Review once, at the right boundary

Use `request-code-review` as the single local review router. Run the configured counterpart whole-branch review only when `AGENTS.md` requires it. Verify findings locally, fix supported defects, and rerun affected checks.

If content changes after either receipt, refresh the stale receipt; do not blindly rerun unrelated review lanes. Staging or committing byte-identical content does not stale a receipt.

Completion criterion: no blocking verified findings remain and verification/review receipts identify the same canonical content fingerprint.

## 6. Hand off

Report outcome, changed behavior, verification, review findings, residual risk, branch/worktree, and the next authorized action. Stop before commit, push, PR, merge, deploy, production write, or cleanup unless the user explicitly authorized that action.

Use `ship-it` only after the user asks to publish the verified branch.
