# Waitlist thank-you confirmation framing

## Outcome and source context

Reproduce Jonas's reviewed [PR #335](https://github.com/NickRuppy/hair_concierge/pull/335) at approved head `8af54eafa7ec0614aa88fa3c62658ac1bb56c19f` on an owner-controlled branch so the existing waitlist thank-you route can use the approved WhatsApp confirmation framing without violating the fork contributor-path gate.

## Chosen direction

Adopt PR #335's wording and presentation exactly. Nick reviewed the rendered mobile and desktop page on 2026-08-07 and explicitly selected **PR wording as-is**, including “Dein Platz ist noch nicht bestätigt” and “Bestätige jetzt deinen Platz in der WhatsApp-Gruppe.”

## Scope and non-goals

In scope:

- Reframe `/warteliste/danke` as the final WhatsApp confirmation step.
- Add the conditional alert banner to the waitlist shell.
- Change the WhatsApp CTA label from “Community” to “Gruppe.”
- Add the three approved benefit cards and preserve the no-WhatsApp fallback.
- Remove the complete “Was jetzt passiert” email-expectations block, including the welcome-email, daily-email, and founding-price deadline copy, so the page has only the WhatsApp-join job.
- Replace the previous opt-out and CTA microcopy with the approved loss-aversion line, “100 % kostenlos · Unser Hauptkanal für den Start,” and the WhatsApp download link.
- Update the existing waitlist UI contract test to the approved wording.

Constraints:

- Preserve the current waitlist signup, survey, analytics, consent, routing, legal footer, WhatsApp destination, QR asset, and configuration contracts.
- Render the alert banner only when `WAITLIST_WHATSAPP_URL` is available.
- Keep the fallback explicit that the email signup remains stored.
- Do not change the approved German copy or hierarchy from PR head `8af54eaf`.

Non-goals:

- No Customer.io, Supabase, Typeform, Meta/PostHog, cookie, email, WhatsApp operations, launch configuration, or production changes.
- No redesign of `/warteliste` or `/warteliste/umfrage`.
- No commit, push, PR, merge, deployment, or cleanup without later publication authorization.

## Target map

- `src/app/warteliste/danke/page.tsx`: approved thank-you hierarchy and copy.
- `src/components/waitlist/waitlist-shell.tsx`: optional conditional top banner slot.
- `src/components/waitlist/whatsapp-cta.tsx`: approved CTA label.
- `tests/waitlist-ui.test.ts`: deterministic waitlist copy/flow contract.

## Designed user journey

1. A waitlist lead reaches `/warteliste/danke` after the existing signup/survey flow.
2. When the WhatsApp URL exists, the page shows “Dein Platz ist noch nicht bestätigt,” 97% progress, and the headline “Bestätige jetzt deinen Platz in der WhatsApp-Gruppe.”
3. The page explains that the launch link, immediate reminder, and free pre-launch resources arrive in WhatsApp, then presents the primary “WhatsApp-Gruppe beitreten” CTA.
4. The user sees three concrete WhatsApp benefits. On desktop, the QR block provides the same group destination; on mobile, the primary CTA remains the immediate action and the lazy-loaded QR appears when scrolled into view.
5. The previous “Was jetzt passiert” email-expectations section is absent; after the WhatsApp benefits and desktop QR alternative, the page ends at the legal footer.
6. Completion is external to the page: the CTA or QR opens the configured WhatsApp invite. The application does not claim or track an in-page join confirmation.
7. If the WhatsApp URL is unavailable, the banner and CTA content are omitted and the user sees “Wir melden uns per E-Mail bei dir” plus confirmation that the signup remains stored.

User-journey sign-off: **confirmed 2026-08-07**. Nick explicitly chose the PR wording as rendered after the entry-page wording tension was called out, then separately confirmed removal of the complete “Was jetzt passiert” email-expectations block.

## Planning evidence

- `plans/evidence/pr335-mobile-approved.jpg`: exact PR rendering at an iPhone 13 viewport. It answered whether the aggressive confirmation framing and vertical hierarchy were acceptable on mobile.
- `plans/evidence/pr335-desktop-approved.jpg`: exact PR rendering at 1280×900. It answered whether the CTA, benefit cards, and QR block remained coherent on desktop.
- Evidence review status: **confirmed 2026-08-07**.
- Feedback incorporated: Nick selected **PR wording as-is** over the proposed honest-urgency alternative.
- The mobile full-page capture leaves the below-fold QR image blank because Next Image lazy-loads it only when scrolled into view; the desktop capture confirms the QR asset renders, and the existing asset/destination remain unchanged.

## Ordered tasks

1. **Update the regression contract.** Apply the exact PR test delta to `tests/waitlist-ui.test.ts`, verify that it fails against the current main implementation for the intended missing 97%/confirmation wording, and record the red proof. Completion: the focused test fails only on the newly expected user-facing contract.
2. **Apply the approved UI delta.** Apply PR #335's exact source changes to the three target components without expanding scope. Completion: the focused test passes and the owner branch is patch-equivalent to PR head `8af54eaf` for all four changed files.
3. **Verify the final experience.** Run the focused waitlist contract, repository readiness checks proportional to the change, and mobile/desktop browser review including the no-URL fallback where practical. Completion: no new failure is attributable to the branch, exact-tree receipts are recorded, and known baseline failures are separated.

## Verification

Automated:

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/waitlist-ui.test.ts`
- Patch-equivalence comparison against `8af54eafa7ec0614aa88fa3c62658ac1bb56c19f` for the four target files.
- `npm run ci:verify`, with any baseline failure reproduced on `f245db8e` and reported separately.
- The `ready-check` repo skill owns the final exact-tree verification receipt; it is a workflow gate, not an npm command.

Manual/browser:

- Render `/warteliste/danke` at mobile and desktop widths with the configured/default WhatsApp URL.
- Confirm banner, 97% progress, CTA, three benefits, QR block, footer, and absence of console errors attributable to the change.
- Confirm the no-URL fallback has no alert banner and preserves the stored-signup message.

Live-state and migrations:

- None. Do not write production data, modify launch configuration, or exercise a real waitlist signup.

## Review and handoff

- Worktree: `.worktrees/waitlist-danke-confirm-framing`
- Branch: `codex/waitlist-danke-confirm-framing` from fresh `origin/main` at `f245db8e`.
- Required gates: `ready-check`, `request-code-review`, and one read-only Claude whole-branch review if the final change remains meaningful.
- Planning counterpart review: one read-only Claude plan review; findings must be verified locally before changing this plan.
- Artifacts: plan and both approved screenshots are **commit** artifacts. Claude review output is transient and **discard** unless a finding must be retained in the plan.
- Stop point: verified review-ready local branch. Publication requires a later explicit `ship it` instruction.

## Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | scope/product decision | PR #335 deletes the complete “Was jetzt passiert” section, but the original scope list emphasized additions. | accepted | Made the removal explicit in scope and the designed journey; Nick confirmed removal on 2026-08-07. | Exact patch-equivalence and browser review. |
| C2 | defect | The verification section named `ready-check` without an exact full-repo command. | accepted | Added `npm run ci:verify` and clarified that `ready-check` is the repo workflow skill. | Confirm the final receipt names exact commands and outcomes. |
| C3 | tradeoff | A mechanical four-file copy is leaner than re-deriving the frozen PR through TDD. | rejected | Keep the short red/green guard because the repo implementation loop requires proof when changing a deterministic regression contract; implementation remains exact and mechanical. | Focused red then green test plus patch-equivalence proof. |
| C4 | tradeoff | `/warteliste/umfrage` still says “WhatsApp-Community,” while the approved thank-you page switches to “WhatsApp-Gruppe.” | deferred | Exact PR equivalence and the approved non-goal exclude changing the survey page in this task. | Record as residual terminology risk; handle only in a separately approved consistency change. |
| C5 | tradeoff | Removing the email block leaves exported `LAUNCH_CLOSE_LABEL` without a current consumer. | rejected | Keep launch configuration outside this copy/layout integration; an unused exported label is harmless and may remain useful for launch messaging. | Typecheck, lint, and build passed. |
| C6 | tradeoff | Reviewer suggested `role="status"` or `role="alert"` for the static urgency banner. | rejected | The initial server-rendered text is screen-reader-visible and does not convey meaning by color alone; a live-region role is unnecessary for content present at page load. | Browser inspection and semantic source review. |
