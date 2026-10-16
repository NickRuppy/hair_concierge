# Consultation handoff clarity — revision 4

## Outcome and chosen direction

Nick’s 16 October screenshot shows a full quiz bar and “Geschafft” on the consultation handoff. He requests clear continuation. PR #698 already corrected admin reporting and both affected participants subsequently submitted; this task improves future handoff comprehension, without claiming the screen caused their drop-off.

The [contextual proposal](consultation-handoff-clarity/preview.html) now uses the mobile viewport deliberately: one compact header row (Back, filled “Profil fertig ✓” segment, outlined “Produkte offen” segment), centered heading “Als Nächstes: deine Produkte.”, and a 56 px primary button “Produkte ergänzen” near the bottom, above the safe area. The two segments name completed and open preparation phases, without a time or question percentage. The heading and button use natural next-action copy instead of abstract “Teil 2”. Main content has two text sizes: 32 px heading and 14 px progress/button. Feedback keeps its existing global styling and remains clear of the heading and bottom button. The action remains in normal flex layout, so short screens and error text can grow/scroll rather than being covered by a fixed footer.

## Decision coverage: confirmed

- **Confirmed with Nick:** clarify ongoing preparation in progress and CTA; fewer sections, sizes and words; no wrapping top labels; optimize for mobile with a lower button and balanced use of screen height. These are his direct corrections to revisions 1 and 2. Latest acknowledgement: “Already a lot better”; retain the mobile composition and add profile-done/products-open words to the progress bar, plus a heading explicitly introducing the products. Revision 4 incorporates those precise corrections in German.
- **Inherited from evidence or contract:** discovery handoff is the affected branch. Quiz save runs automatically, continuation requires both a tap and a successful save. Checklist remains products, optional budget, routine, heat/styling, review, submit. Other quiz flows retain their own progress.
- **Implementation defaults:** existing fonts/tokens and CTA treatment; local static progress markup with accessible phase description, two visible phase labels; no inherited question-progress animation. Flex layout rather than fixed positioning. Account for the quiz shell’s outer padding when calculating available mobile height; do not add a second viewport height inside the shell.
- **Open consequential assumptions:** none. No requested work is parked. This revision follows Nick’s concrete correction to the reviewed composition; no new design approval ceremony is needed.
- **Coverage acknowledgement:** original request: “rework that screen … clarify in the button copy and in the progress bar that you still need to go on here.” Revision 2: reduce sections, sizes and words. Revision 3: reject wrapped top-bar labels, upper-third CTA, excess blank space below the CTA and prior copy; optimize for mobile. Latest acknowledgement and exact correction settle the revised design and continuation journey.
- **Internal revalidation:** revision 4 supersedes both earlier mockups. Current source and viewport constraints checked. Undiscussed consequential assumptions affecting this handoff: none. Claude review waived by Nick; adversarial Codex review follows publication.

## Scope and target map

1. `src/components/quiz/quiz-lead-capture.tsx`, discovery-ending branch only: local one-row labelled preparation progress and available-height flex wrapper. Do not reuse the animated shared question bar with a different denominator: its inherited transition context represents question counts.
2. `src/components/quiz/quiz-discovery-lead-save.tsx`: approved heading and CTA, flexible middle heading area and bottom action. Preserve save, delayed spinner, duplicate-tap guard, error/retry and saved remount semantics.
3. `src/app/quiz/quiz-shell.tsx`: inspect the existing step-9 `px-5 py-8` wrapper; prefer accounting for its padding within the discovery-ending branch rather than changing shared shell behavior. Verify the actual route, not only the standalone artifact.
4. Existing `tests/discovery-quiz-lead-save.test.tsx` and `tests/discovery-quiz-handoff-dom.test.tsx`: update stale visible-copy assertions and preserve behavior coverage. No tests that simply mirror layout classes.

No auth, storage, API, analytics, destination, checklist sequence, admin, regular/partner quiz, global Feedback or production data changes.

## Journey and evidence

After finishing the hair questions, a consultation participant sees an incomplete preparation bar and the next task, products. The bottom button continues to the existing checklist after successful automatic save. During a pending save, preserve its action label, show the existing delayed loader and avoid duplicate continuation. A failed save shows the actual current error above the bottom retry button. Back and returning to an already-saved quiz work as before. Completion remains the existing final successful submission screen.

Static planning artifact uses current public fonts and colors. Browser review of revision 4 passed at 390×740, 320×568 (including error/retry) and 960×640. Header remains a single row, heading and CTA are readable, and Feedback covers neither. The bottom CTA is visible without scrolling in the tested phone viewports. Pending variant retains the same label. Error sample is illustrative; production keeps truthful current error messages. No backend is connected. Revision 4 was inspected at 320×568 and 390×740: both progress labels stay on one line and the bottom action remains visible. Screenshot `/tmp/consultation-handoff-labelled.jpg` records the current 390 px proposal.

## Execution, checks and handoff

1. Design/journey approval is settled through the reviewed mobile preview and Nick’s precise correction; Claude plan review waived explicitly by Nick; proceed with the approved design.
2. Implement only the scoped discovery handoff, preserving the existing save and navigation logic.
3. Use `verification:plan` and the shared coding-check budget for focused handoff/save tests, targeted lint and typecheck. Preserve delayed save, retry, remount and fixture checklist coverage. Inspect other quiz branches for accidental changes.
4. Verify the actual local route at tall/short phone and desktop sizes, including retry, pending, keyboard focus, safe-area padding, no horizontal overflow, and dynamic viewport height. Run owning implementation-loop ready-check and request-code-review; use main-session normal review before publication and an independent read-only Codex adversarial review after publication, per Nick’s explicit override.

Task branch `codex/consultation-handoff-clarity`, isolated worktree of the same name, based on clean main `264cbd5a`. Commit plan and HTML decision evidence with eventual implementation; discard temporary screenshots and reviewer output after recording receipts. No migrations. Main risk is changing progress scope from quiz questions to preparation phases: the completed/open phase labels and next-action copy communicate continuation; verify comprehension in context.

Claude plan review was attempted read-only on Opus 4.8, high, but returned the account weekly limit (reset reported as 03:00 Europe/Berlin), without a verdict. Nick subsequently waived this Claude gate. No Claude approval is claimed.

Nick explicitly approved implementation of revision 4 and waived Claude review for this change: “Looks good, implement this version. Skip the Claude review … After you ship … adversarial review with Codex”. The Claude gate is waived for this task; use main-session normal review before publication, followed by an independent read-only Codex adversarial review after the draft PR is published. Design/journey are settled; do not ask again. Current authorization includes commit, push and draft PR creation. Stop before merge/deployment; earlier #698 merge/deploy approval was specific to that PR.

## Implementation verification record

Existing owner tests were updated to the approved visible copy; the real DOM handoff case now checks the completed/open phase labels. These guard actual user-visible semantics and real continuation, without class assertions or new test seams. Pre-implementation focused run: 16 passed / 5 failed for missing new labels/heading/CTA. Initial implementation run: 21 passed. Save-state/effect logic remains unchanged. Artifacts: commit plan, HTML proposal and source/tests; discard temporary local QA route, screenshots and review output after recording evidence.

Local browser QA mounted the actual changed components inside the current quiz-shell padding, with auth, HTTP and navigation fixtures. Verified 320×568 and 390×740 mobile, 960×740 desktop, successful navigation target and failure/retry. A first-visit cookie-banner overlap was reproduced and repaired using existing `--cookie-consent-clearance`; mobile action side clearance also prevents Feedback overlap when the banner raises the button. The final browser screenshot is `/tmp/handoff-clarity-implemented-mobile.jpg`. No customer or production record was touched. The temporary lab route is removed before publication. A MetaMask browser-extension error appeared in Next dev tools; its stack pointed entirely to the extension, and only that unrelated dev overlay was hidden in the disposable visual fixture.

Final owner/sibling verification: 66 tests passed across handoff, lead save, identity, admin quiz projection, participant routing, middleware gate and checklist projection. Source ESLint passed; test files are intentionally ignored by repository ESLint and were verified by Node tests and Prettier. Fresh route types were generated after removal of the disposable QA route to clear its stale development validator. Browser QA also confirmed the 300 ms delayed loader with stable button label/icon slot and keyboard focus on the continuation. Final typecheck result and exact content fingerprint are recorded in the external verification receipt. Root main remains untouched.
