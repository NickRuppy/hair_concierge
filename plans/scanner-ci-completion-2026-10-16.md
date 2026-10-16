# Finish the Scanner CI repair in PR #693

## Outcome and decision coverage

Nick requested: “finish the Scanner fix and rerun CI on #693. Use subagents, keep matching tags manual and don't deploy yet.” Coverage confirmed. This authorizes the bounded fix, checks and update of existing draft #693; no merge, deployment, migration, queue/catalog writes or matching approval. Internal revalidation: clean task branch at e6e87439, main412ec3bd; separate scanner-welcome-ci has an uncommitted candidate and is left untouched by this task. Undiscussed consequential assumptions affecting this handoff: none.

Confirmed with Nick: requested Scanner CI repair and exact PR update. Inherited: optional one-session greeting beside ScanFlow, real modal isolation and keyboard focus contract, existing manual matching and no-deployment boundaries. Defaults: use the owned Shampoo worktree and shared local verification gate; deterministic denied-camera browser fixture. Open consequential assumptions: none. No new UI or product behavior is introduced.

## Diagnosis and chosen direction

CI38909541969 demonstrates that the camera-denied search modal's backdrop blocks the outside welcome button. This is correct modal isolation; the journey incorrectly tries to acknowledge outside it. The original dirty candidate portals the button above the modal, but leaves it outside aria-modal and the keyboard focus trap. Do not import that production change or change shared modal rules.

Keep the production greeting unchanged. The interaction becomes: wait for `data-scan-camera="unavailable"` and the named search dialog to be visible; close the actual search dialog through its accessible close button, then acknowledge the welcome with a real click. The unavailable tile remains usable, and search can reopen through its normal entry. Working-camera behavior and one-session dismissal remain unchanged. This is a correction of automated interaction order, not a new design; no additional user-facing sign-off is needed.

## Tasks and proof

1. Mount the existing production greeting in the dev-only Scan Lab via welcome=scan. Preserve Lab padding and all production behavior. Copy only reviewed Lab boot support from the dirty candidate, without writing to its source tree.
2. Extract the existing greeting acknowledgement into tests/helpers/scan-welcome.ts shared by the real journey and local denied-camera regression. Initially retain direct click to reproduce the exact backdrop failure locally; after valid red, assert unavailable camera state and the visible named dialog, click its `Schließen`, wait for it to disappear, then acknowledge the greeting. The helper name explicitly includes camera fallback. No forced clicks, sleeps, skipped assertions or production behavior exemptions.
3. Pin a denied camera with a Playwright `addInitScript` override of `navigator.mediaDevices.getUserMedia` throwing `NotAllowedError`, in the real journey before its first document navigation (also covering later SPA entry into /scan and reload), rather than relying on CI hardware timing. Keep real auth/provisioning/catalog assertions and session reload proof; full real journey runs in hosted CI, not local production fixture creation.
4. Run focused Lab browser proof, scanner owner/sibling Node tests, typecheck and lint in one local slot; source review verifies production welcome/modal bytes unchanged. Read-only counterpart plan review before final interaction fix and whole-delta correctness review before push. Main integrates subagent diagnosis/regression findings.
5. Commit/push exact verified scope to #693, rerun full CI and Security on the final head, inspect failures and CodeQL alert delta. Existing691 dependency and PR682 disposition remain separate merge gates.

Target map: src/app/labs/scan/{page,scan-lab-client}.tsx; tests/scan-flow.spec.ts; tests/scan-funnel-journey.spec.ts; tests/helpers/scan-welcome.ts; this record and verification receipt. No changes to production ScanWelcomeHint, BottomSheet, modal manager or engine/matching contracts.

Artifacts: commit scoped Lab/test files, this plan and final receipt; archive transient logs/reviews under /tmp; preserve all dirty scanner-welcome-ci files. Stop after updated draft and exact-head CI results; no merge/deploy/live model or manual product trial. Tests of the live journey retain existing CI fixture lifecycle; local proof uses only mocked API/real browser components.

## Review disposition and exact checks

Claude/high plan review approves with no hard blockers. Accepted concrete unavailable/dialog/close predicates, the media API deny mechanism, and bounded delta review against e6e87439. Its proposed production-UX question does not block this correction: existing modal priority is preserved, not newly chosen; any redesign is outside Nick's requested CI repair. A denied-camera buyer can use search immediately and close it before interacting with the greeting. The hosted path now intentionally covers denial; existing production behavior and greeting/session unit coverage stay unchanged.

Valid local red: the shared helper retaining the journey's direct click times out while the named fallback is open and the greeting's button is excluded by modal isolation (`/tmp/scanner-ci-completion-red.log`). No fixture/import failure. The helper is then corrected; production greeting/modal bytes remain unchanged.

Run through the shared launcher: `npx start-server-and-test 'next dev --webpack --hostname 127.0.0.1 --port 3287' http://127.0.0.1:3287 'playwright test tests/scan-flow.spec.ts --project=chromium --workers=1 --output /tmp/scanner-ci-completion-browser-results'` with `PLAYWRIGHT_BASE_URL=http://localhost:3287`. Run `npm run test:focused -- tests/scanner-funnel-arrival.test.tsx tests/scan-flow-state.test.ts tests/modal-layer-manager.test.ts`, `npm run typecheck`, and scoped ESLint via the shared gate. Hosted CI supplies the complete Node/build/browser/live-journey gates; avoid a duplicate broad local suite. Review only the changed Scanner Lab/test/plan delta against e6e87439 and affected callers, reusing the unchanged #693 engine/cycle review receipt.

Focused green passes after the close-first helper. The media override is registered
before the initial landing-page navigation, since registering an init script just
before a client-side Scanner link would not run it in that existing document.
The local regression also submits a mocked search and observes its empty result
before closing, then proves search can reopen after acknowledgement.

## Final local verification and code review

All 28 Chromium Scan Flow browser cases pass, including the new regression; all
71 greeting/state/modal owner tests pass. Root typecheck passes. The normal
read-only Claude/high delta review approves with no hard defects. Structural
re-review is unnecessary for this small Lab/test-support delta; reuse the prior
whole-branch engine/SQL review at e6e87439. Main's post-review delta waits for
unavailable camera state after reload before asserting the greeting stays absent,
so the assertion observes hydrated client persistence rather than only SSR's
intentionally empty snapshot. Hosted CI validates this real-journey strengthening.

Review notes retained: the hosted journey intentionally covers denied camera;
working-camera greeting dismissal retains existing unit coverage. The media API
override requires the already-mandatory secure localhost test origin; unexpected
insecure origins should fail instead of silently testing another premise. The
helper's name states its denied-camera precondition. No new product decision.

The separate Scanner owner continued editing its own dirty candidate during this
run; our initial snapshot records that state under /tmp and no writes were made
to that worktree. Its later changes are not imported. Only this task's Lab/test
delta is committed to #693; production welcome/modal bytes remain unchanged.
