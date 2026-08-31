# Retire legacy chapters after universal paid entry

Date: 2026-08-28. Status: **implemented and locally verified in the combined task worktree; unpublished**.
Depends on [universal paid entry](2026-08-28-universal-paid-entry.md) and
[saved prefill support](2026-08-28-legacy-refinement-prefill.md), with the
same approved [scope/decisions](2026-08-28-unified-post-payment.md).

## Integration checkpoint — 2026-08-31

PR #478 was still open, behind current main and failing an unrelated profile
logout smoke assertion. Its exact patch was therefore composed read-only with
current main/#479 and the verified migration slice in
`.worktrees/unified-post-payment-complete`; the original task worktree and PR
branch were not mutated.

The combined implementation now removes `ResumeShell`, chapters 3+4, the
five-stage bar/overview, chapter-only exports and the chapter lab. Bare partial
Stage 2 opens the first unresolved saved question. Stage 2 preparation and
handoff failures stay in the current shell with saved-state copy, Back and
idempotent retry; Back is guarded while the host handoff is already in flight.
Every successful Stage 3 completion opens Routine once. The shared header keeps
Back, save state, wordmark and module progress “X von 4”.

Final local verification passes the complete 32-test Chromium journey suite,
2,370 Personal Plan tests, typecheck, lint, production build and diff hygiene.
The final read-only combined-diff audit found no correctness or security issue.

Explicit optional entry uses the dedicated Stage 2/3 APIs; baseline Plan and
direct acceptance retain their generic loaders. Profile retake/edit onboarding
with an explicit step/return remains supported. No publication, migration apply,
flag activation, account write or production data write has occurred.

## PR #478 overlap check — 2026-08-28

Inspected GitHub PR #478 at `ed96e372614e56e05bcffc12c74b92ad45eb0b96`.
At inspection it was OPEN, not merged; this worktree remains on the #477 base.
This is a scoped overlap check, not a whole-branch approval or deployment receipt.
Before shared chapter UI implementation, refresh after #478 lands and verify its final SHA.
Independent data implementation starts on current main #479.
Readiness recheck: #478's head predates merged #479 (`870fc4fb`). Reconcile #478
with current main first, then refresh this worktree. Do not independently absorb
its changes while its PR still owns them. Preserve #479's `quiz` transition mode,
reduced-motion/focus timing and overflow behavior in the shared refinement,
Plan-start, view-transition and stage-entrance components, alongside #478's
completed-draft first_open regression test. No new product decision is required.

- Covered by #478: chapters 1+2, InvitationShell, invitation mode and directEntry
  plumbing removed; first_open resolves to an explicit module, with meter/quiet
  pending/accepted-origin exit and integrated direct-accept re-entry coverage.
  Do not duplicate those deletions after it lands.
- Still ours: chapters 3+4, five-stage bar/overview, bare linear ResumeShell,
  repair/plain Stage3 completion, shared historical paid admission and legacy
  answer/product prefill. The PR changes no migration or inventory contracts.
- Preserve #478's explicit `?refine=1` behavior: first open module, or products
  when every question is answered. This differs from a bare URL resuming the
  persisted frontier; do not accidentally undo its intentional edit visit.
- Confirmed recovery decision (Nick, 2026-08-28): chapter 3 is also the error/retry
  presentation for ALL Stage2→Stage3 handoffs (`stage2BridgePresentation`).
  Replace it with a compact error and “Erneut versuchen” within the
  current module/preparation shell, retaining Back and saved answers. No chapter
  ceremony or extra confirmation. Direction confirmed; contextual evidence still
  needs review before implementation.
- Keep Customer.io cleanup out of scope: the organic legacy quiz and shared
  operator helpers remain live code consumers. No remote template deletion here.

CI at inspection: relevant Personal Plan browser/journey jobs succeeded; generic
playwright-smoke failed at `tests/profile-editorial-v3.spec.ts:157`, expecting the
signed-out auth URL. Cause not diagnosed or labeled pre-existing by this check.

## Outcome, direction and scope

All buyers use Plan → Routine with optional explicit refinement modules. Remove
the remaining resume ceremony, chapters 3+4 and five-stage overview once every
caller has a safe destination and the compact error/retry replacement exists.
Chapters 1+2, InvitationShell/directEntry and explicit first_open behavior belong
to #478 and are not implementation tasks here. Preserve shared
Back/save UI, module progress “X von 4”, backend access stages, durable drafts and
real profile editing. No recommendation, entitlement, event or product-policy change.

## Target map: delete, adapt, retain

| Action                                                  | Target                                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Replace route renderer with compatibility redirect only | `src/app/onboarding/page.tsx`; old URLs keep validated lead/return context, no old flow renders.                                                                                                                                                       |
| Remove route-only screens                               | `src/components/onboarding/onboarding-flow.tsx` and its exclusive screens/navigation/progress, only after profile single-step extraction. Use final import graph to prove each deletion.                                                               |
| Delete chapters                                         | `src/components/personal-plan-journey/{chapter-transition,journey-overview}.tsx`; chapter-only exports/content; `src/app/labs/personal-plan-chapters/` and exclusive tests.                                                                            |
| Simplify shared header                                  | `journey-header.tsx`, `journey-content.ts`, `index.ts`: remove five-stage row/props/types only after relocating any still-used type. Keep Back, save, brand and module progress.                                                                       |
| Normalize Stage2 entry                                  | `src/app/plan-start/page.tsx`, `src/lib/personal-plan/refinement/module-scope.ts`; resolve compatibility intent before passing an explicit products/habits module to `refinement-flow.tsx`.                                                            |
| Replace chapter-based recovery first                    | `refinement-bridge.tsx`, `stage2BridgePresentation` in `refinement-flow.tsx`: render transient failure/retry in the current preparation shell, retain bridge version/context markers and Back; no dependency on PersonalPlanChapterTransition remains. |
| Remove old client branches                              | `refinement-flow.tsx`: remaining ResumeShell, chapter bridge and unscoped ceremony after server normalization. InvitationShell/directEntry removal is owned by #478. Keep acceptance guards and full-session answer storage.                           |
| Direct successful product completion                    | `stage3-products-flow.tsx`: always normal Routine handoff after durable successful completion. Keep retry/conflict and restored Stage3 → Back → original Stage2 module.                                                                                |
| Preserve profile editing                                | `src/app/profile/page.tsx`: move single-step edit entry to `/profile/edit` (profile-owned route), with same existing editor/form and safe return. Do not make paid users redo refinement to change an unrelated profile field.                         |
| Keep active utilities                                   | `src/lib/onboarding/**` types/helpers imported by profile, routine, application, goals, quiz, intake and tracking. No bulk deletion or speculative renaming.                                                                                           |
| Adapt mixed labs/tests                                  | Plan-start, Stage1–2, Stage2 and Feinschliff labs: remove remaining chapter cases; retain first_open compatibility and modular journey fixtures from #478.                                                                                             |

Normal callers to update (not just the route): plan-bereit fallback, both quiz-result
clients and `result-navigation.ts`, auth continuation, routine empty state,
`billing/checkout-success-redirect.ts`, `auth/intake-state.ts`, protected-route
middleware and chat/profile tool links. Enumerate with `rg '/onboarding' src tests`.
The `/onboarding` URL remains a safe alias for old bookmarks; its old screen flow
does not remain accessible. Do not delete support email helpers still imported by
Personal Plan operators or active Customer.io guards.

## Exact compatibility contract

`resolveLegacyRefinementEntry` is a pure server-side resolver consuming requested
refine value, persisted unscoped Stage2 session/provenance, explicit acceptance
state and persisted Stage3/Routine frontier; produces either
`{kind: "module", module: "products" | "habits"}` or an existing validated frontier
destination. Never use an active-routine boolean alone as proof of the right exit.

| Entry                                                    | Normalized target                                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Explicit `?refine=products` / `habits`                   | Requested optional module; preserve explicit scope and safe origin.                                                            |
| Explicit legacy `?refine=1`                              | First open canonical module (products, then habits), or products when all answered, preserving #478.                           |
| Bare Stage2 entry with incomplete real draft             | First unresolved canonical module; full saved answers/revision preserved.                                                      |
| Bare entry with completed Stage2 or no unresolved module | Persisted Stage3/Routine/application frontier; no invitation/resume/bridge, progress reset or auto-accept of unseen decisions. |
| Unaccepted Plan/recovery                                 | Keep the Plan's explicit acceptance semantics, not automatic routine entry.                                                    |
| Old profile edit URL                                     | Validate allowed step + owner and redirect to profile-owned single-step editor.                                                |

After #478, `first_open` is already absent from Stage2ModuleScope but remains an
intent in Stage2ModuleEntryRequest. Retire only the remaining `none` flow after
normalization; keep first_open intent/`refine=1` compatibility working as above.
Keep the full unscoped session in host storage; only UI path is module-scoped.

### Confirmed product-preparation recovery

- While preparing, keep the current flow's header/save state and quiet loading
  presentation. Disable duplicate retry/continue requests.
- On transient handoff failure, render a compact accessible error and
  “Erneut versuchen” in that shell. Preserve the saved session, module origin and
  exact refined-version context; never resubmit already-saved answers or complete
  the module a second time merely to retry preparation.
- Retry repeats the existing idempotent handoff. On stale source/revision, reload
  current server state through existing recovery before retrying; never blindly
  reuse obsolete authority. Successful preparation navigates exactly once.
- Back remains available to the original module with saved answers. Reload must
  resolve the same persisted journey; failure is not a reason to resurrect a
  chapter, InvitationShell or ResumeShell.

## Designed journey and evidence

The universal-entry plan owns the first-return journey and product prefill preview.
Here the successful user sees fewer screens: Plan's normal action → Routine;
optional Products/Habits → questions → normal durable completion → Routine.
Old bookmarks land on the same persisted frontier. Back/reload recover the exact
module, including a server-restored Stage3 draft. Failed save/completion stays
retryable, without navigating away or losing saved progress. Nick approved the
compact handoff retry replacement above; its contextual evidence review remains
pending. Profile edits retain
their current form and return to Profile; only route ownership changes.

Retry evidence is now available in the shared static preview and as
[mobile error](unified-post-payment-evidence/recovery-mobile.png),
[desktop error](unified-post-payment-evidence/recovery-desktop.png), and
[pending](unified-post-payment-evidence/preparation-mobile.png). Codex verified
one visible state, retained Back/save context and disabled action while pending.
These are planning screenshots, not an implemented handoff/persistence test.

The deletion uses existing surviving layouts, not a redesign. Product prefill
evidence is linked from the decision record. During implementation, compare current
and retained profile editor and module Back/loading/error UI in local fixtures;
if extraction requires a changed layout or new interaction, stop for contextual
mockup review before implementing that new UI. Nick confirmed the reviewed evidence and complete journey on 2026-08-28.
The isolated combined implementation satisfies the #478 integration gate; final verification remains.

## Ordered tasks

1. **Normalize old entries before deleting their renderers.** Consumes universal
   paid admission + shared frontier, produces compatibility resolver and profile
   edit alias. Extend result/auth/checkout/intake/frontier and profile navigation
   tests. Completion: every normal caller resolves shared entry; invalid step,
   foreign lead or unsafe returnTo rejected; profile edit still works.
2. **Make every refinement render explicitly scoped.** Consumes persisted full
   session/acceptance/frontier, produces explicit module context. Extend module-scope,
   module1-stage3-resume, plan-start entry and Feinschliff browser fixtures.
   Completion: `refine=1`, bare incomplete, completed, direct-accept assumed and
   explicit module cases all preserve answers/provenance, never show a ceremony,
   and restored Stage3 Back renders its originating Stage2 module.
3. **Replace chapter-dependent handoff recovery.** Consumes saved session, module
   origin and refined-version context; produces the compact pending/error/retry
   presentation without a chapter import. Extend transition-motion, module-entry
   and Stage1–2–3 journey tests. Completion: transient failure, repeated retry,
   stale revision/source, Back and reload preserve data and context, issue no
   duplicate module completion, and navigate exactly once after success.
4. **Delete chapter/linear-only components and simplify surviving completion.**
   Consumes normalized routes, produces no remaining reachable chapter renderer.
   Delete only exclusive tests/labs; adapt shared header, Stage2/3 and profile tests.
   Completion: import/reference audit clean; success/retry/conflict/reload handoff
   happens once; Back/save and X von 4 survive; no stale development route promises
   old stages. Existing reduced-motion readiness fix remains; don't re-fix #476.

## Verification, rollout and handoff

Focused tests + typecheck/lint, then fixture browser matrix: old bookmark, valid
paid legacy source, already-current Plan, unaccepted Plan, partial/completed Stage2,
direct acceptance, restored Stage3 Back, completion retry, profile edit. Run through
implementation-loop/ready-check and meaningful whole-branch counterpart review.
No production fixture mutations or provider claims from local labs.
Recovery coverage must include explicit products/habits entry, old `?refine=1`,
normalized bare entry and server-restored handoff. The successful prefill mockup
does not by itself verify this error state.

Ship only after universal entry is available for all intended current paid sources;
do not deploy deletion ahead of schema/reader/source compatibility. Keep lightweight
URL redirects and historical storage/decoders. Roll back routing/application code
without deleting data; no old chapter UI is a supported permanent rollback lane.

Stop before publication; user must approve reviewed evidence/final journey and later
authorize ship/merge/deploy separately. Durable plan/evidence = commit; transient
review output = discard. Existing unrelated/merged-worktree artifacts untouched.

## Implementation authorization

On 2026-08-28 Nick confirmed the contextual evidence and final journey and explicitly
requested implementation with workers and explorers. This supersedes earlier
planning-only status text. Publication and production changes remain separate.
