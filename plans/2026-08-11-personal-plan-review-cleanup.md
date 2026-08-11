# Personal Plan review cleanup

## Outcome and source context

Close the two still-valid post-merge review findings from Personal Plan PR #344 without reopening its retained worktree:

- an authenticated Personal Plan user can sign out from the existing Profile Account card;
- a valid Stage 3 revision conflict preserves the server's canonical `latestDraft`, shows the already-designed conflict explanation, and waits for the user to retry deliberately.

The already-fixed legacy-onboarding review thread is bookkeeping only because PR #349 shipped its runtime fix.

## Chosen direction

- Keep logout on `/profile`, inside the existing Account card. The card contains only its heading, the current avatar/name/email identity, and a neutral outlined `Abmelden` action. Reuse the existing server action, redirect, and signed-out confirmation. Do not add explanatory copy or a confirmation dialog.
- Teach the shared Stage 3 HTTP adapter to return the existing `{ status: "conflict", latestDraft }` union for a well-formed HTTP 409 revision-conflict response from both mutate and complete endpoints. Keep the existing UI conflict state and deliberate retry behavior unchanged.
- Deliver both corrections in one focused cleanup branch from current `origin/main`.

## Scope and non-goals

In scope:

- Profile Account-card logout and its focused rendering/auth-boundary coverage.
- Stage 3 mutate/complete conflict transport, focused HTTP/API/flow regressions, and closure of the corresponding review conversations after publication.
- Durable planning evidence and verification receipts for this cleanup.

Non-goals:

- No edits to the retained `personal-plan-launch-candidate` worktree or branch.
- No header or overflow-menu redesign for unrelated legacy app users.
- No new conflict screen, automatic retry, full-stage reload, or changed German conflict copy.
- No changes to owner scope, passive reads, revision CAS, authority evaluation, pending/unassigned execution semantics, or atomic Stage 4 completion.
- No Heat/catalog assets, PR #345 writes, migrations, production data/flags, deployment, merge, or cleanup.

## Target map

- `src/app/profile/page.tsx`: remove the current internal-rationale description and add the server-action logout form after the identity row.
- `src/app/auth/actions.ts`: existing `signOutAction`; reuse without behavior changes.
- `src/lib/personal-plan/products/http-gateway.ts`: recognize a well-formed revision-conflict response for mutation and completion calls.
- `src/components/personal-plan-products/stage3-products-flow.tsx`: reuse the validated conflict parser in direct authority-decision fallbacks and bind explicit retries to the canonical draft revision.
- `src/lib/personal-plan/products/gateway.ts`: existing response unions; change only if a narrow shared type guard needs an exported type.
- `tests/profile-account-logout.test.ts`: focused Account-card source/rendering contract.
- `tests/profile-editorial-v3.spec.ts`: rendered Profile assertion if the existing browser harness is the smallest reliable user-facing guard.
- `tests/personal-plan-stage3-gateway.test.ts`: HTTP 409 preservation for mutate and complete plus malformed-conflict fail-closed behavior.
- `tests/personal-plan-api-stage3.test.ts` and the focused Stage 3 completion API tests: retain/complete route-boundary payload coverage.
- `tests/personal-plan-stage3-flow.test.tsx`: verify canonical draft replacement, explicit explanation, and user-triggered retry with the latest revision.

## Designed user journey

### Profile logout

1. An authenticated user opens Profile through the Personal Plan navigation.
2. The existing Account card shows `Account`, the user's avatar, name, and email.
3. A visible, keyboard-accessible neutral outlined `Abmelden` button follows the identity. There is no helper sentence, internal layout rationale, hidden menu, or confirmation dialog.
4. Selecting `Abmelden` submits the existing server-backed sign-out action.
5. The session is cleared and the user lands on `/auth?reason=signed_out`, where the existing signed-out confirmation is shown. Revisiting `/profile` while unauthenticated continues to use the existing sanitized authentication redirect.

### Stage 3 conflict recovery

1. A user acts on a Stage 3 product capture/decision or attempts completion while their mounted revision is stale.
2. The server rejects the CAS write with HTTP 409 and returns the canonical `latestDraft`.
3. The HTTP adapter preserves that response instead of converting it into a temporary-unavailable error.
4. The existing Stage 3 UI replaces its local draft with the canonical version and displays: `Deine Auswahl wurde zwischenzeitlich aktualisiert.` It does not automatically repeat the write.
5. The user deliberately retries. The retry uses the canonical revision and continues through the existing flow. Network errors, malformed conflict bodies, and other non-2xx responses continue through the existing truthful error/retry path.

## Planning evidence

- Durable reviewed mockup: [`plans/mockups/2026-08-11-profile-account-logout.html`](./mockups/2026-08-11-profile-account-logout.html)
- Decision resolved: placement and information density of logout in the real Account-card hierarchy.
- Selected direction: Account heading + identity + `Abmelden` only.
- Feedback incorporated: removed both `Dein Zugang bleibt bewusst sekundär ...` and `Du kannst dich ... jederzeit abmelden.` because neither helps the user act.
- Evidence review: confirmed by Nick on 2026-08-11.
- User-journey sign-off: confirmed by Nick's instruction to implement the corrected minimal card and the settled deliberate Stage 3 retry journey on 2026-08-11.

## Ordered tasks

### 1. Preserve Stage 3 conflicts at the HTTP boundary

Consumes: existing 409 route body `{ error: "revision_conflict", latestDraft }` and existing `Stage3MutationResponse` / `Stage3CompleteResponse` unions.

Add failing guards for mutate, complete, and malformed 409 bodies. Implement the smallest shared adapter seam that returns a conflict only when status, error code, and draft shape are credible; keep other errors typed and fail closed. Add/confirm route-boundary and flow recovery tests, including explicit retry with the canonical revision.

Produces: lossless conflict results for both write paths, with no automatic duplicate submission.

Complete when: focused gateway/API/flow tests prove red for the current adapter and green for both valid conflict paths plus malformed/non-conflict errors.

### 2. Add the minimal Profile Account logout

Consumes: the existing Account identity layout and `signOutAction` redirect contract.

Add a failing focused guard for the visible `Abmelden` action, absence of the rejected prose, lack of confirmation-dialog wiring, and reuse of the server action. Replace the Account description with a server-action form after the identity row. Use a labeled keyboard-accessible neutral outlined button and preserve the remaining Profile surface.

Produces: a discoverable Profile-only logout for Personal Plan users.

Complete when: focused source/component coverage and the Profile browser assertion pass, while the existing unauthenticated redirect and signed-out confirmation contracts remain green.

### 3. Integrate and verify the exact tree

Run formatting, lint/typecheck, focused Node/browser tests, and the repository `ready-check`. Verify the Profile card at representative mobile and desktop widths and exercise the Stage 3 conflict state/retry deterministically. Run one whole-branch code-review lane, reconcile supported findings, and refresh verification if content changes.

Complete when: readiness and review receipts share the same canonical content fingerprint and no blocking finding remains.

## Verification

Automated:

- Focused Profile Account/logout test.
- Existing auth sign-out/signed-out and unauthenticated Profile redirect tests.
- Stage 3 HTTP gateway mutate and complete conflict tests, including malformed 409 fail-closed coverage.
- Stage 3 PATCH and complete route boundary tests.
- Stage 3 UI conflict/retry regression.
- Typecheck, lint/format checks, affected Personal Plan test groups, and repository-required readiness checks.

Manual/browser:

- Mobile and desktop Profile: Account card contains only heading, identity, and outlined `Abmelden`; button is keyboard reachable and no dialog appears.
- After logout, `/auth?reason=signed_out` renders and authenticated Profile content is no longer reachable.
- Stage 3 conflict: explanation appears, no automatic repeat occurs, and explicit retry uses the canonical revision.

Migration/live-state:

- None. No database, catalog, rollout flag, production identity, or deployment action is authorized or required.

Evidence-sensitive review:

- Verify the final Profile hierarchy against the confirmed durable mockup.
- Verify the conflict fix changes transport only and does not widen state-machine behavior.

## Findings ledger

| ID   | Type   | Evidence                                                                                                                                                      | Decision | Plan change                                                                                                              | Revalidation                                                               |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| CR-1 | defect | Whole-branch review found that direct authority-decision 409 fallbacks trusted an unvalidated draft and single-decision retry reused a stale render revision. | accepted | Share the schema-validating parser across all Stage 3 write fallbacks and carry the canonical draft into explicit retry. | Focused authority conflict tests, typecheck, lint, and final delta review. |

Counterpart-review status: the required local Claude plan review hit its account session limit; the CLI reported a reset at 12:20 CEST. No product or implementation decision was inferred from the unavailable review. It must run and be reconciled before review-ready handoff, with affected verification refreshed only if content changes.

## Review and handoff

- Worktree: `.worktrees/personal-plan-review-cleanup`
- Branch: `codex/personal-plan-review-cleanup`, based on fresh `origin/main`.
- Planning evidence: commit with the cleanup branch.
- Counterpart plan review: required, read-only, transient output stored outside the repository and discarded after reconciliation.
- Final repository review: one `request-code-review` lane through `implementation-loop`.
- Evidence review and designed-journey sign-off: confirmed.
- Stop point: verified review-ready local branch. Commit/push/draft PR require separate `ship-it` authorization; merge, deployment, and production writes remain separate.
