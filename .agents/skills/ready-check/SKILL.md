---
name: ready-check
description: Use when a Hair Concierge change has been implemented and needs repo-specific verification before claiming readiness, especially for UI, onboarding, recommendation, copy, data, migration, or trust-facing work.
---

# Hair Concierge Ready Check

Verify the promised end-state on the exact tree that will be reviewed. This skill owns verification, not code review or publication.

## 1. Define the proof

Read the approved plan/spec and the final diff. Map each promised outcome and risk to observable evidence. If the intended end-state is unclear or unobservable, stop and name the missing contract.

## 2. Run fresh checks

- Run focused tests at each changed seam, then the repository's broader relevant checks.
- For deterministic logic, prove the regression guard fails on old behavior and passes on the proposed tree. In Hair Concierge, use `.agents/skills/implementation-loop/references/test-first-quality.md` when present.
- For UI, onboarding, recommendation, copy, or trust-facing work, run the task worktree and inspect at least one meaningful changed flow. Use `simulated-user-review` when qualitative German clarity, fit, or trust matters.
- For migrations, auth, billing, privacy/security, or production-data behavior, add the relevant live-state or migration check without performing an unauthorized write.
- For evidence-sensitive or medically adjacent guidance, use `hair-care-expert` as a separate evidence pass.
- Inspect delegated changes and run their proof; worker reports are not verification.

Report blockers instead of substituting confidence for unavailable evidence.

## 3. Issue a verification receipt

Record:

- branch and base
- a canonical content fingerprint: SHA-256 of a sorted manifest containing each
  in-scope path relative to the base plus its current content hash or `DELETED`
- promised outcomes checked
- commands and results
- browser/manual evidence
- task-owned artifacts classified as commit, archive, or discard
- skipped checks, blockers, and residual risk

The fingerprint is independent of staging or commit layout, so staging and committing identical content do not stale the receipt. If content changes after verification, rerun only the affected checks plus any required repository-wide gate and issue a new receipt.

Completion criterion: every promised outcome is observed or explicitly blocked, and every success claim is backed by fresh evidence for the identified tree.
