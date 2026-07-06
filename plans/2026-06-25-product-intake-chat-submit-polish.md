# Product Intake Chat Submit Polish Plan

Date: 2026-06-25

Status: Implemented in `codex/product-intake-full-flow-smoke`. Claude and code-review findings are
folded in; focused verification and the 2026-06-26 integrated browser smoke passed for the unknown
product submit path. The card now collapses to the pending-review confirmation after submit.

Claude review:
`/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke/plans/2026-06-25-product-intake-chat-submit-polish.claude-review.md`

Related follow-up ticket:
HAI-141 `Backlog: Eingereichte Produkte mit Status im Profil/Routine-Artefakt anzeigen`

## Goal

Make the unknown-product chat intake flow feel coherent after local testing:

- the assistant message should warmly explain that the exact product is not in the database yet
- the intake card should be a direct action surface, not repeat the same explanation
- after successful submission, the card should collapse into a completed state instead of leaving
  editable controls visible
- if the intake submit immediately matches an existing catalog product, show a compact saved state

## Settled Product Decisions

- The main flow is pending review:
  user asks about an unknown product -> assistant defers warmly -> intake card appears -> user
  submits -> card collapses to a pending-review confirmation.
- The assistant message for `product_intake_offer` should be short and warm:
  `Das konkrete Produkt haben wir noch nicht in unserer Datenbank. Wenn du magst, gib es kurz hier ein, dann prüfen wir es für dich.`
- The intake card should not show an extra helper paragraph above the upload/manual tabs for normal
  `product_lookup_not_found` offers.
- After pending submission, collapse the card and show:
  - headline: `Danke, wir prüfen dein Produkt.`
  - body: `Wir melden uns hier im Chat. Du kannst inzwischen einfach weiterfragen.`
- After immediate match from the intake submit endpoint, collapse the card and show:
  - headline: `Produkt gespeichert.`
  - body: `Du kannst dazu jetzt direkt weiterfragen.`
- Candidate-card selection is a different path. If a user selects a suggested existing product
  candidate, the assistant should acknowledge the selected product in chat; do not show the intake
  submit success panel for that path.
- The profile/routine-artifact overview for submitted products is not part of this patch. It is
  tracked separately in HAI-141.
- The user-facing `Conditioner (Drogerie)` label cleanup is not part of this patch. It has been
  handed off to a separate work session.

## Non-Goals

- No database schema changes or Supabase migrations.
- No product review workflow changes.
- No profile/routine-artifact status overview implementation.
- No candidate-card selection redesign.
- No conditioner/category-label cleanup in this branch.
- No broad AgentV2 copy rewrite.

## Target File Map

Likely files:

- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`
- `src/lib/agent-v2/production/chat-pipeline.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/components/chat/product-intake-card.tsx`
- `src/components/chat/product-lookup-clarification-card.tsx`
- `tests/agent-v2-product-selection.spec.ts`
- `tests/agent-v2-product-lookup-clarification.spec.ts`
- `tests/chat-product-mentions.test.tsx`

Implementation may use a different nearby test file if local fixtures make that cleaner, but avoid
adding broad end-to-end prompt fixtures for this small UX patch.

## Implementation Checklist

### Task 1: Guard Product-Intake Fallback Copy

- [x] Add a failing focused test for the case where a turn has structured
  `rag_context.product_intake_offer` but the visible answer currently falls back to generic
  unclear-message copy.
- [x] Patch the product lookup outcome path only for the visible-failure case where
  `visibleFailure === true && productIntakeOffer != null`. This belongs near the
  `product-lookup-turn-outcome.ts` visible-failure/fallback branch, not as a broad post-processing
  rewrite of every answer that contains an offer.
- [x] Preserve the richer existing warm deferral copy when the deterministic/recovered product
  lookup fallback already produced a valid product-specific answer. Do not overwrite those answers
  just because `product_intake_offer` is present.
- [x] In the visible-failure + intake-offer case, use the warm short message instead of:
  `Ich bin mir gerade nicht sicher, was du genau möchtest. Formulier es bitte einmal konkreter.`
- [x] Keep the card rendering driven only by structured metadata. Do not parse visible copy to
  decide whether to render the intake card.
- [x] Verify the visible message and card no longer duplicate or contradict each other.

### Task 2: Simplify Intake Card Pre-Submit Copy

- [x] Remove the normal helper paragraph above the upload/manual tabs for `product_lookup_not_found`
  chat offers.
- [x] Keep missing-info guidance when `offer.reason === "needs_more_info"` because that state needs
  explicit field-repair context.
- [x] Ensure the card still feels understandable from the tabs and fields alone.
- [x] Verify both consumers of the shared card still read correctly:
  - direct chat message rendering in `chat-message.tsx`
  - nested add-product path inside `product-lookup-clarification-card.tsx`

### Task 3: Collapse Card After Pending Submission

- [x] Extract a pure, prop-driven submitted-state view from `ProductIntakeCard`, for example
  `ProductIntakeSubmittedState`. Do not add a new DOM-testing dependency just to drive the async
  `fetch -> setState` transition.
- [x] Add a static `renderToStaticMarkup` test for the pending-review submitted-state view proving:
  - upload/manual tabs are not visible
  - category/frequency fields are not visible
  - brand/product inputs are not visible
  - the submit button is not visible
  - the pending-review success copy is visible
- [x] Patch `ProductIntakeCard` to store a submitted state object rather than only a green status
  string.
- [x] Render the compact checkmark success state for pending review:
  `Danke, wir prüfen dein Produkt.`
  `Wir melden uns hier im Chat. Du kannst inzwischen einfach weiterfragen.`
- [x] Add a small CSS/Tailwind transition for the card state change. Keep it local to the card and
  use an explicit reduced-motion-safe class if available in the local styling approach; otherwise
  skip animation rather than adding a new motion dependency.
- [x] Record the known limitation: this collapsed state is client-side and ephemeral. On reload or
  historical scrollback, persisted product-submission status belongs to the future HAI-141
  profile/routine status surface, not this patch.

### Task 4: Collapse Card After Immediate Match

- [x] Add a static `renderToStaticMarkup` test for the immediate-match submitted-state view.
- [x] Render the compact saved state:
  `Produkt gespeichert.`
  `Du kannst dazu jetzt direkt weiterfragen.`
- [x] Keep this as an intake-submit outcome only. Do not reuse it for product candidate-card
  selection.

### Task 5: Verification And Review

- [x] Run focused component/chat tests touched by this patch.
- [x] Run:

```bash
npx tsx --test tests/agent-v2-product-selection.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts tests/chat-product-mentions.test.tsx
npm run typecheck
git diff --check
```

- [x] Run `npm run ci:verify` unless the patch is plan-only.
- [ ] If the local dev server is available, run the chat eval against that server with explicit
  `--base-url`; do not rely on bare `npm run test:chat` unless a server is listening on its default
  port.
- [x] Browser-smoke the chat flow on the local worktree:
  - unknown product shows warm deferral + intake card
  - submitting the card collapses into pending-review success state
  - controls are not editable after success
  - immediate-match behavior remains covered by tests if hard to reproduce manually
- [ ] Run review gate if the patch changes shared AgentV2 fallback behavior beyond the narrow
  product-intake branch.

Verification notes:

- `npx tsx --test tests/agent-v2-product-selection.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts tests/chat-product-mentions.test.tsx`
  passed 50/50.
- `npm run typecheck` passed.
- `git diff --check` passed.
- `npm run ci:verify` passed. Lint reported 6 warnings in pre-existing unrelated files.
- `npx tsx scripts/eval-chat/run.ts --skip-judge --ci-smoke --base-url http://localhost:3543`
  was attempted against the local dirty worktree server and failed 4/6:
  - `leave-in-offer-confirmation` missed the fixture keyword `Anwendung` although the visible reply
    offered to explain usage in natural language.
  - `clarification-cap` turn 3 returned HTTP 500; eval cleanup also hit Supabase DNS
    `ENOTFOUND pqdkhefxsxkyeqelqegq.supabase.co`.
  These failures do not appear caused by the submit-state polish patch, but they are not a clean
  eval pass.
- Browser smoke on `http://localhost:3543/chat` with dev login verified the unknown-product card
  renders without duplicate card helper copy and collapses to the pending-review state after submit.

## Open Decisions

None currently. The implementation should follow the mockup decisions above.

## Handoff Notes

This is a UX polish patch on top of the already implemented product lookup/intake stack. Keep it
small. If implementation reveals that candidate-card selection and intake-card submission share the
same state unexpectedly, stop and re-align before patching.

Do not stage, commit, push, open a PR, apply migrations, or clean up unrelated files without
explicit approval.
