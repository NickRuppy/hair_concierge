# Chaarlie iOS — implementation handoff

2026-09-12 · **Product scope, approved designs and connected journey confirmed.**

Start with [implementation-plan.md](implementation-plan.md), revision 9. It is the canonical public-v1 roadmap and shared backend contract. Execute the first connected scanner milestone from [first-build-plan.md](first-build-plan.md), revision 5; continue the same app through the roadmap. No separate disposable app or duplicate backend.

## Build order

| Milestone | Deliverable | Owning tasks | Completion evidence |
|---|---|---|---|
| 1 | Existing test user signs in, scans/searches, sees the approved result and alternatives, opens the correct shop and views Profile/logout. | First-build B1–B4; initial T1–T3/T6; T4 scanner/results UI | Native build, isolated real auth/database integration, free/paid-owner fixtures, result/large-text/recovery walkthrough |
| 2 | New-user ten-question quiz, code/link login and shared answer editing. | Remaining T1/T2 and Profile portion of T6 | Complete-source binding, repeat login, profile conflict, atomic edit/refinement concurrency, no paid routine changes |
| 3 | Unknown-product submission and independent result email/push. | Remaining T3 and T5 | Deduplication, public-readiness transition, independent retries, signed-out deep-link return |
| 4 | Verified account changes/deletion, organic website handoff, legal/listing and device release checks. | Remaining T6/T7 | Reviewed retained-data disposition, provider cancellation, physical iPhone camera/links/push, release checklist |

Milestone 1 completes T4’s scanner/result UI; real-device release verification remains in milestone 4/T7. Its missing-product close/continue fallback is development-only; milestone 3 replaces it with the approved submission/research flow before public release.

Milestone 1 is executable without the parked co-founder decisions. Milestones 2–4 retain the individual gates in the main plan: no changed consent/free-contract behavior before R3–R6 reconciliation, no policy-dependent deletion transformations before E2/R1–R6 resolution, and no public release before required legal/account-deletion work is complete. Independent technical work can proceed. Development milestones do not reduce the agreed public-v1 scope.

## Designs and evidence

- [Design handoff and complete artifact index](design-handoff.md): what is authoritative, historical, or provisional; screen-to-task acceptance map.
- [Connected walkthrough](evidence/walkthrough.html): entry → scan → result → research/messages → Profile/recovery.
- [Approved scanner sheet](evidence/scan-ergebnis/smart-scanner.html): authoritative result/table/explanations/carousel/purchase-only actions.
- [Design specification](design-spec.md) and [final definitions](copy-drafts.md): tokens, dimensions, copy and behavior.
- [One-time merged backend audit](merged-backend-audit.md): reuse boundaries at PR #531. Do not repeat the broad audit or enable web freemium.
- [Parked co-founder questions](cofounder-questions.md) and [legal editorial register](legal/README.md): unresolved release-dependent work.

## Confirmed boundaries

SwiftUI, iPhone/iOS 18+, German, free public smart scanner, Scan + Profile, one account/hair profile/calculation authority. Full approved alternatives and editing are free in native. No Merkliste, routine/chat UI, native paywall or in-app purchases. Web behavior and parked freemium flag stay unchanged. Prototype shortcuts, demo email codes, static assessments and browser controls are not production implementation.

Decision coverage: **confirmed for milestone 1**. Public-v1 functional journey/design: **confirmed**; release-policy work remains explicitly parked. Undiscussed consequential assumptions affecting this handoff: none.

Nick reviewed the connected walkthrough (open at `#answers`) and said on 2026-09-12: “Okay I think we can start with this. Yeah sounds good. Can we do the implementation plan then, including all the designs that we had from before?” This confirms the connected journey and requests the finalized plan. Earlier result/CTA approvals remain in force. It does not approve parked policy details, fixed fixture assessments as domain truth, or production publication.

## Handoff

Use `implementation-loop` in the task worktree with the approved evidence retained; integrate with current main using the repository worktree workflow before code changes, preserving existing planning/design edits. Never reset/rebase away uncommitted evidence. Resolve exact shared-file ownership when implementation starts. The completed #531 audit supplies the baseline; normal changed-code, migration and integration checks still apply.

This request produces the plan package. No native code, production migration, provider configuration, customer email, commit/push, merge, deployment or App Store submission is performed by finalizing it. Implementation uses the normal ready-check and whole-branch review. Publication requires its own authorization.

Final bounded counterpart review: [handoff-review.md](handoff-review.md). No material defects; two non-blocking clarifications incorporated and locally verified.
