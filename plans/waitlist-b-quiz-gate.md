# Waitlist B quiz gate

## Outcome and source context

Add a temporary, paid-traffic-only entry route at `/warteliste/b`. It reproduces the current homepage layout while replacing every quiz navigation action with the approved waitlist modal. The existing `/`, `/api/waitlist`, survey, thank-you, Customer.io, and WhatsApp flow remain unchanged.

Source context:

- User brief supplied in the Codex task on 2026-08-05.
- Original design reference: `/Users/nick/Downloads/quiz-gate-modal-final.html`.
- Incorporated final evidence: `plans/evidence/waitlist-b-quiz-gate-modal.html`.

## Chosen direction

Keep `/` isolated by creating a route-owned copy of the current organic homepage presentation for `/warteliste/b`. Use the shared dialog behavior and shared waitlist submission contracts, adding only explicit configuration needed for the modal copy, redirect behavior, and Meta `content_name: "quiz_gate"`. The waitlist parent layout continues to own consent-gated PostHog and Meta Pixel loading.

## Scope and non-goals

In scope:

- Public, no-index route `/warteliste/b`.
- Homepage-equivalent sections and imagery with the approved page-only copy.
- Modal opening from every quiz CTA, including the product link in `SiteFooter`.
- Existing waitlist API submission, validation, error states, token storage, and redirects.
- One Meta `Lead` for a successful non-duplicate signup with `content_name: "quiz_gate"`.
- Focus management, focus trap, Escape/X/backdrop close, labelled modal, and short-screen scrolling.
- Focused route, UI, analytics, and regression tests.

Non-goals:

- No visual or behavioral change to `/`.
- No second backend, migration, Customer.io campaign, survey, thank-you, or WhatsApp implementation.
- No homepage footer addition.
- No feature flag, experiment allocation, campaign change, merge, deployment, or production write.

## Target map

- `src/app/warteliste/b/**`: route metadata and client entry surface.
- `src/components/waitlist/**`: quiz-gate modal/form and shared waitlist submission seam.
- `src/components/landing/site-footer.tsx`: optional quiz-action override with unchanged defaults.
- `src/lib/meta-pixel.ts`: named quiz-gate Lead helper beside the existing waitlist helper.
- `src/lib/auth/route-classification.ts`: exact public-route registration.
- Existing waitlist, route-classification, analytics, and UI test locations identified during implementation.

## Designed user journey

1. A paid visitor opens `/warteliste/b` and sees the current homepage layout with page-only quiz wording. `/` remains unchanged and still links to `/quiz`.
2. Every quiz action on `/warteliste/b`, including the footer product action, opens the centred quiz-gate modal instead of navigating.
3. The modal shows `Bald wieder offen`, the approved headline, and one explanatory subline containing the only explicit date reference. Focus enters the first-name field.
4. The visitor may close with X, Escape, or the backdrop; focus returns to the triggering action. Keyboard focus remains trapped while open, and the dialog scrolls safely on short screens.
5. Submitting uses `/api/waitlist` and retains the existing validation plus 429/503/general error feedback.
6. For a new signup, the client stores the returned survey token, emits one Meta `Lead` with `content_name: "quiz_gate"`, and navigates to `/warteliste/umfrage`.
7. For a duplicate, no second Meta `Lead` fires. Because no new survey token is issued, the visitor follows the existing fallback to `/warteliste/danke`.
8. The existing survey, thank-you page, Customer.io campaign, welcome email, and WhatsApp completion remain unchanged.

User-journey sign-off: confirmed 2026-08-05 after the date was reduced to one modal-subline mention.

## Planning evidence

`plans/evidence/waitlist-b-quiz-gate-modal.html` answers the modal hierarchy, copy, spacing, and responsive-fit question. It incorporates the approved correction from the supplied reference: the badge is `Bald wieder offen`, and the date appears only in the explanatory subline. Desktop and 390 px mobile renders were reviewed by Nick on 2026-08-05.

Evidence review: confirmed.

## Ordered tasks

1. Register `/warteliste/b` as an exact public route and add a no-index page contract. Complete when public/protected route tests distinguish `/warteliste/b` from unlisted descendants.
2. Add a route-owned homepage presentation with all quiz actions routed to a modal and the approved page-only copy. Complete when `/` regression tests remain unchanged and no `/quiz` bypass exists on `/warteliste/b`.
3. Implement the accessible modal and reuse the existing waitlist submission/error/token flow. Complete when close/focus behaviors and new/duplicate/error paths are covered.
4. Add the explicit `quiz_gate` Meta Lead destination and suppress it for duplicates. Complete when analytics tests prove the content name, shared event ID, success timing, and duplicate guard.
5. Add the shared footer with an opt-in quiz-action override and Meta disclaimer without changing default footer consumers. Complete when legal links remain normal and the product action opens the modal only on `/warteliste/b`.
6. Run focused and repository-level verification, then browser-check desktop/mobile states. Complete when readiness and review receipts share the same content fingerprint.

## Verification

Automated:

- Focused route classification tests.
- Waitlist modal/form success, duplicate, invalid, 429, and 503 tests.
- Meta helper and event suppression tests.
- Homepage regression and `/warteliste/b` CTA/copy/footer tests.
- Typecheck, lint for changed files, and the repository readiness suite selected by `ready-check`.

Manual/browser:

- Desktop and mobile `/warteliste/b` visual comparison with the approved modal evidence.
- Every quiz CTA opens the modal; legal links remain navigable.
- Keyboard focus entry/trap/return and X/Escape/backdrop close.
- Consent gating: no Meta Pixel before consent; PageView-capable Pixel after consent.
- Do not submit a fake production signup; browser success behavior is exercised locally/test-only.

Migration/live-state checks:

- No migration or production write is required.
- Existing Customer.io and waitlist backend contracts are regression-only scope.

## Review and handoff

- Branch: `codex/waitlist-b-quiz-gate`.
- Worktree: `.worktrees/waitlist-b-quiz-gate`.
- Required gates: `ready-check`, then `request-code-review`; no Claude review per Nick's explicit instruction for this workstream.
- Stop point: verified, review-ready local branch. Commit/push/PR/merge/deploy require later authorization.
- Artifacts: plan and HTML evidence are committed with the implementation; transient screenshots remain outside the repository.
