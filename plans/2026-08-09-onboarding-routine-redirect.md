# Onboarding completion redirects to Routine

## Outcome and source context

After a new customer completes the quiz, purchase, and default onboarding flow, the completion action lands on `/routine` instead of `/chat`. The request is scoped to the current production onboarding journey. Repository tracing confirms that the client completion handler and the server-side completed-onboarding recovery path currently default to `/chat`.

## Chosen direction

Change only the default onboarding completion destination to `/routine`. Keep explicit `returnTo` destinations authoritative so profile edits and quiz-retake flows return where they already do. Update the default completion CTA from `ZUM CHAT` to `ZU MEINER ROUTINE`; explicit-`returnTo` celebration paths retain their current `ZUM CHAT` label and destination behavior so this task does not widen into a retake/profile copy change. Do not redesign the modal or Routine page.

## Scope and non-goals

In scope:

- Default celebration completion click routes to `/routine`.
- A reload/direct revisit after onboarding has already been marked complete also recovers to `/routine` when no explicit `returnTo` exists.
- The default celebration CTA names the Routine destination.
- Deterministic tests cover the default destination and explicit-return preservation.

Non-goals:

- No global change to the `/auth` or `/quiz` defaults for already-ready users.
- No change to explicit profile-edit or retake `returnTo` destinations.
- No Routine UI, data-shaping, recommendation, billing, entitlement, analytics-event, migration, or feature-flag change.
- No deployment or production write in the implementation handoff.

## Target map

- `src/lib/onboarding/completion-destination.ts` — one deterministic default/preservation rule shared by server and client.
- `src/app/onboarding/page.tsx` — use the shared rule for completed-onboarding recovery.
- `src/components/onboarding/onboarding-flow.tsx` — use the shared rule after successful celebration completion and select the destination-aware default CTA.
- `src/components/onboarding/screens/celebration-popup.tsx` — accept the CTA label required by the caller without changing layout.
- `tests/onboarding-completion-destination.test.ts` — regression coverage for default Routine routing and explicit returns.
- `tests/onboarding-completion-ui.test.tsx` — regression coverage for the new default CTA while retaining caller-controlled labels.

## Designed user journey

1. A new customer completes the quiz, purchases access, signs in, and finishes the default onboarding questions.
2. The app saves the final onboarding answer and marks onboarding complete exactly as it does today.
3. The existing celebration modal appears with unchanged heading and body copy. Its default CTA reads `ZU MEINER ROUTINE`.
4. Activating the CTA navigates to `/routine`, where the existing Routine page loads the customer's saved product/routine state. Chat remains available in the authenticated navigation and from existing Routine actions.
5. If navigation is interrupted after onboarding is marked complete, revisiting/reloading `/onboarding` without an explicit return destination recovers to `/routine` rather than `/chat`.
6. If the user entered onboarding with an explicit safe `returnTo` destination (for example, a profile edit or retake), that destination remains authoritative; the new default does not override it. The rare celebration fallback for that branch retains its current `ZUM CHAT` label as an explicit scope-preservation choice.
7. Existing save-error, timeout, and Routine loading/error/empty recovery states remain unchanged.

User-journey sign-off: **confirmed on 2026-08-09**. Nick approved the walkthrough without corrections.

## Planning evidence

- [Before/after rendered review](artifacts/onboarding-routine-redirect-review.html) — compares the exact current celebration copy/layout and `/chat` handoff with the proposed destination-aware CTA and existing `/routine` target.
- [Review screenshot](artifacts/onboarding-routine-redirect-review.jpg) — rendered evidence for review.
- Question answered: whether the product should change the whole authenticated default or only the default new-user onboarding exit.
- Selected direction: onboarding exit only; explicit returns and existing-user entry defaults remain unchanged.
- Evidence-review status: **confirmed on 2026-08-09**. Nick approved the rendered before/after without corrections.

## Ordered tasks

### Task 1: Make the completion destination deterministic

Consumes: `returnTo: string | null` from the existing server and client onboarding contracts.

Produces: a shared resolver that returns the explicit destination when present and `/routine` otherwise.

Add the focused regression test first and capture the failing proof. Implement the shared resolver, wire it into the server recovery redirect and client celebration redirect, and verify that `/auth` and `/quiz` ready-user routing remains `/chat`. The final diff and mandatory browser check must verify both call sites are wired; the resolver unit test alone is not accepted as end-to-end proof.

Completion criterion: focused routing tests pass; no default `/chat` remains in the two onboarding-completion seams; explicit returns are preserved.

### Task 2: Align the completion CTA with the destination

Consumes: the selected completion destination from Task 1.

Produces: `ZU MEINER ROUTINE` on the default new-user completion path without changing modal layout or explicit-return behavior.

Add the focused UI regression first and capture the failing proof. Make the CTA label caller-controlled, use the Routine label only when `returnTo` is absent, and retain the current `ZUM CHAT` label when `returnTo` is present. The label condition must mirror the navigation condition exactly.

Completion criterion: focused UI tests pass and rendered comparison matches the reviewed artifact.

## Verification

Automated:

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/onboarding-completion-destination.test.ts tests/onboarding-completion-ui.test.tsx tests/auth-intake-state.test.ts`
- `npm run ci:verify` (typecheck, lint, and production build), selected and interpreted through the repo `ready-check` gate.

Manual/browser:

- Complete or fixture the default onboarding celebration at mobile and desktop widths; confirm the CTA reads `ZU MEINER ROUTINE` and lands on `/routine`.
- Refresh/revisit `/onboarding` after completion and confirm recovery lands on `/routine`.
- Exercise an onboarding URL with an explicit profile `returnTo` and confirm that destination is preserved.
- Confirm Routine loading, populated/empty, and error states are unchanged and Chat remains reachable.

Migration/live-state checks: none; this change has no schema or production-data write.

## Review and handoff

- Branch/worktree: `codex/onboarding-routine-redirect` in `.worktrees/onboarding-routine-redirect`, based on fresh `origin/main`.
- Gates: `ready-check`, `request-code-review`, and the required read-only Claude whole-branch review during implementation.
- Rollout decisions: accept git-revert rollback rather than a feature flag for this stateless destination/copy change; retain the existing `onboarding_completed` event without adding a new analytics event; apply the default to every no-`returnTo` onboarding completion path, including legacy quiz purchasers and completed users recovering through `/onboarding`. Existing customers' normal auth entry remains unchanged.
- Evidence review: confirmed on 2026-08-09; no corrections requested.
- User-journey sign-off: confirmed on 2026-08-09; no corrections requested.
- Artifact disposition: plan, HTML, and screenshot are `commit`; transient reviewer output is `discard` after findings reconciliation.
- Stop point: verified, review-ready local branch; no commit, push, PR, merge, deploy, or production write without explicit authorization.

## Counterpart review findings

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | The return-path CTA label was not explicit even though the navigation branch was. | accepted | Preserve `ZUM CHAT` when `returnTo` exists and require label/navigation branch parity. | Focused UI test and browser return-path check. |
| C2 | defect | The first focused-test command omitted the repository's Node import shims. | accepted | Use the exact `node --import server-only-register --import tsx --test` harness. | Run the named command. |
| C3 | tradeoff | A resolver unit test cannot prove both server and client seams use it. | accepted | Keep mandatory full-diff inspection and browser checks for both normal completion and recovery. | `ready-check` receipt. |
| C4 | defect | Reviewer reported `ready-check` was unavailable. | rejected | `ready-check` exists at `.agents/skills/ready-check/SKILL.md`; retain it and also name `npm run ci:verify` explicitly. | Repo skill inspection completed. |
| C5 | tradeoff | Flag, new measurement, and global no-`returnTo` scope require an explicit rollout choice. | accepted | Record revert-only rollback, no new event, and all-new-customer/recovery scope above. | User-journey sign-off. |
