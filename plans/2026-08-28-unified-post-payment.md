# One post-payment experience — remaining cleanup plan

Date: 2026-08-28. Implementation base: `870fc4fbbc95d03e2662b379782be8a7e5c0bc11` (#479).
Worktree: `.worktrees/unified-post-payment`, branch `codex/unified-post-payment`.
Status: **implemented and locally verified in an isolated combined worktree; unpublished**.

Latest instruction (2026-08-28): Nick confirmed the reviewed desktop/mobile
prefill and preparation/retry evidence and the final complete journey, then said:
“confirmed, start implementation with workers and explorers”. Implementation is
authorized. Publication, merge, deployment, activation and production writes are not.

Execution sequencing: the original task worktree remains preserved at #479.
Because #478 remained open, behind and failing an unrelated profile logout smoke
assertion, its exact patch was composed with #479 and the verified migration work
in `.worktrees/unified-post-payment-complete`. This isolates integration without
mutating the PR branch or the original verified worktree.

## Combined implementation checkpoint — 2026-08-31

- Explicit Stage 2/3 optional-entry APIs are wired only from verified optional
  module contexts. Baseline Plan/direct acceptance keep generic loaders.
- Bare partial Stage 2 opens the first unresolved saved question. The old
  ResumeShell, chapters 3+4, five-stage overview/bar and chapter-only lab are
  removed.
- Stage 2 preparation/handoff failure uses the approved compact retry state with
  saved answers and Back. Successful Stage 3 completion opens Routine once.
- Profile retake/edit onboarding remains available through explicit safe
  step/return context; ordinary returning paid entry resolves through the shared
  Personal Plan frontier.
- Final local verification is green: 2,370 Personal Plan tests, 724 nested
  Personal Plan tests, 34 adjacent quiz/routing tests and the complete 32-test
  Chromium journey suite pass. Typecheck, lint, production build and
  `git diff --check` also pass; lint retains five warnings in unchanged files.

The implementation remains uncommitted and unpublished. No schema apply, hosted
account/data write, flag activation, deployment or production operation was run.

## Outcome and source context

Nick confirmed one modular post-payment experience for all buyers, including
historical legacy-quiz buyers, and deletion of the old chapter/linear flow.
This expands the original Feinschliff cleanup beyond currently cutover-eligible
users. The source handoff covered #467, #471, #473, and #477; the current source
also includes the reduced-motion test readiness fix from #476.

PR #478 was checked at head `ed96e372614e56e05bcffc12c74b92ad45eb0b96`
on 2026-08-28: OPEN, not merged at inspection. It covers chapters 1+2 deletion
and explicit `?refine=1` behavior, not all-buyer admission or saved-data prefill.
The [chapter plan](2026-08-28-chapter-retirement.md) now records the overlap and
preserves its all-answered `refine=1` → products edit behavior. Do not repeat those
changes; refresh this task worktree again after the final upstream merge.
Rechecked during this revision: #478 is still open at that head. Root `main` is
now `870fc4fbbc95d03e2662b379782be8a7e5c0bc11` (#479, post-payment motion);
this task worktree is now fast-forwarded to that commit. Preserve #479's motion
behavior and verify #478's eventual merged head before shared chapter UI edits.

Explorer readiness check (2026-08-28): no additional product decision was
found. Evidence/journey approval is recorded above. Independent application and
data implementation is now present; upstream chapter integration and the final
complete-journey release gate remain required before shipping behavior.

## Implementation checkpoint — 2026-08-28

Implemented in this worktree:

- Read-only paid migration admission and explicit POST source binding; current
  paid authority is rechecked without granting time or changing billing.
- Owned legacy-source preparation, missing-fact recovery through signed current
  quiz context, and source-preserving current-Plan resume.
- Separate Stage 2/3 optional-entry APIs and transactional once-only prefill
  receipts. Baseline preview/direct acceptance do not import old inventory.
- Existing product-capture UI renders imported selections and saved-name hints.
  Local fixture browser evidence covers Weiter, fit review, Back and removal.
- Additive SQL migrations and deterministic service, API and PGlite tests,
  including all three migrations composing with the real Plan predecessor RPCs.

Independent-slice verification and review:

- Final broad checks: 2,367 Personal Plan tests, 724 nested tests and 44
  adjacent quiz/auth/routing tests pass. Typecheck and production build pass;
  lint has no errors and five warnings in unchanged files. Local fixture browser evidence covers
  selected products, saved-name search, normal fit review, Back and removal.
- Claude reviewed the complete independent slice at high effort. Codex reconciled
  every finding and reviewed the changed contracts after fixes. Historical paid
  eligibility now agrees across enrollment/frontier/journey/Stage 1. Optional
  products entry finds the exact persisted handoff rather than only the newest
  draft; malformed optional hints are discarded safely.
- Recovery quiz intent is explicit and separate from signed-cookie authority.
  Missing/expired context cannot fall into ordinary signup; leftover cookies
  cannot hijack a normal quiz. Temporary lookup failure retries in place without
  losing live answers, covered by a component-runtime regression.
- The suggested draft-insert race was rejected against the actual latest
  predecessor RPC: generic and optional entry already lock the same Plan row.
  No speculative reservation machinery was retained. Resolver/paid-authority
  failures remain fail-closed rather than substituting a different source or
  falling through to writes. Deploy migrations before code as stated below.
- PGlite and fixture evidence do not prove hosted JWT/PostgREST behavior,
  authenticated end-to-end persistence or true multi-connection races. These
  checks made no hosted account/data writes. Full joined-journey verification
  and a fresh whole-branch review remain due after #478 integration.

Completed in the isolated #478/#479 integration worktree:

- Wired explicit module hosts to the optional-entry APIs, preserving #478's
  completed-draft products fallback and #479's motion behavior.
- Retired remaining chapters 3+4/linear ResumeShell/five-stage UI and replaced
  chapter-owned preparation retry with the approved inline state.
- Preserved old bookmark/retake/profile-edit compatibility routing. Complete
  joined-journey verification is green; the final read-only whole-branch audit
  found no correctness or security issue.

**Implementation-ready, but historical admission still requires release activation.**
`PERSONAL_PLAN_LEGACY_MIGRATION_ENABLED` defaults off. Enable it only in the
intended environment as an explicit release step. Deploy the additive migrations before application code:
the enrollment reader intentionally requires the new read RPC even while the
new-admission flag is off. No hosted migration, account write, activation,
publication or merge has been performed.

## Chosen direction

- **Confirmed:** migrate existing paid users when they next visit, not in a bulk
  account migration. Nick selected this on 2026-08-28.
- **Confirmed:** use completed legacy quizzes as input to the new Plan instead
  of requiring everybody to retake the quiz.
- **Confirmed:** buyers who have not finished old onboarding enter the shared
  experience; do not preserve a second visible onboarding/chapter sequence.
- **Confirmed:** remove obsolete chapter UI and associated dead branches.
- **Confirmed recovery:** if product preparation fails, show a compact error and
  “Erneut versuchen” inside the current flow. Retain Back and saved answers;
  do not show another chapter or ask for an extra confirmation.
- **Confirmed first-return UX:** migrated legacy users see the same Plan screen
  and onward flow as new users. The existing "Zu deiner Routine" action leads
  into the normal routine; refinement remains optional. When opened, refinement
  shows usable saved answers and products already filled in. No migration-only
  screen, separate review ceremony, or additional activation confirmation.
- **Confirmed:** products entered in the old onboarding carry into the new
  "Deine Produkte" refinement as reviewable prefilled choices. Nick approved
  this direction on 2026-08-28; users should not have to enter everything again.
- **Confirmed UX clarification:** carry over known product selections
  without a separate confirmation screen or requiring the same product to be
  selected again. Use the existing product-capture screen and ordinary Weiter.
- **Constraint:** preserve saved answers, existing product records, and current
  paid access. The migration must not charge again or grant new paid time.
- **Interpretation to preserve:** unfinished onboarding is different from an
  unfinished quiz. Missing required quiz facts must be collected, not invented.
- **Confirmed simplicity tradeoff:** the initial Plan and normal direct acceptance
  are quiz-only, exactly as for new users. Existing products do not influence that
  initial result. Nick explicitly accepts the small risk of confusion for this
  limited historical cohort; no explanatory migration screen or banner is wanted.
  Import saved values only on explicit optional-refinement entry, never during
  baseline preview or `acceptIdealPlan`.

## Scope and non-goals

The target includes current valid historical paid access, regardless of the
old new-buyer cutoff or launch-pricing classification. Expired/revoked access
does not become valid through this change. Existing field-test access and return
behavior must remain intact; no campaigns or accounts are revoked/reset here.

Only these remaining deliverables are in scope, in this order:

1. Universal paid entry and safe conversion of owned legacy sources into the
   current Plan model, including old `/onboarding` links and retakes.
2. Once-only saved-answer and product prefill on optional-refinement entry.
3. Chapter retirement once compatibility paths feed the module flow; remove
   chapters 3+4, five-stage bar/list/copy, remaining chapter-only lab/tests and
   old linear resume branches. Replace chapter-based error/retry before deleting
   its renderer. Retain live Back/save controls, `X von 4`, backend access stages,
   existing profile editing and shared journey fixtures.

**Excluded as owned by #478:** chapters 1+2, InvitationShell/invitation mode,
directEntry plumbing and conversion of `?refine=1` to explicit module entry.
Keep its first-open-module behavior, including products fallback when all answers
are complete. An explicit edit link must not become a bare-URL resume redirect.

Detailed plans: [universal paid entry](2026-08-28-universal-paid-entry.md),
[saved prefills](2026-08-28-legacy-refinement-prefill.md), then
[chapter retirement](2026-08-28-chapter-retirement.md).
All remain in approved product scope; broad historical activation waits for all
three. The split does not defer prefill or change the first-return experience.

Out of scope: pricing changes, provider changes, new paid entitlements, product
recommendation-policy changes, module-depth expansion, PostHog instrumentation,
Customer.io operations, test-account cleanup, and merged-worktree deletion.

## Target map and verified evidence

- `src/lib/personal-plan/enrollment.ts:159`: existing one-time, launch-subscription,
  and field-test sources. Historical non-launch subscriptions are excluded at
  line 188; legacy source/cutoff admission is checked at line 321.
- `src/lib/personal-plan/persistence/stage1-service.ts:93`: existing owned legacy
  lead adapter already feeds `computeNeedPlan`; eligibility is independently
  checked at line 158. Changing one route or flag is insufficient.
- `src/lib/personal-plan/journey-access-loader.ts` and
  `src/lib/personal-plan/frontier-routing-loader.ts`: access and destination must
  agree with conversion admission; no boolean-only routine exit assumption.
- `src/app/plan-bereit/readiness.ts:342`: complete legacy source is accepted;
  missing hair length alone has a current repair screen. Other missing facts
  need an explicit recovery contract. Exact source/profile linkage exists at
  line 582; it is not necessary to preserve visible legacy onboarding to keep
  quiz-to-profile projection.
- `src/app/onboarding/page.tsx`, `src/lib/quiz/link-to-profile.ts`,
  `src/lib/quiz/result-navigation.ts`, both legacy result clients: preserve lead
  ownership, projection, and safe retake return while replacing old destinations.
- `src/lib/quiz/draft.ts`: legacy quiz drafts are browser-local with a 14-day
  lifetime, so cross-device or expired-draft recovery cannot be promised from
  the current draft store. Durable owned quiz data must take precedence.
- `src/lib/routines/load-routine-artifact-data.ts:200`: legacy routine is derived
  from `hair_profiles` and `user_product_usage`.
- `src/lib/personal-plan/routine/contracts.ts:131` and
  `src/lib/personal-plan/products/stage3-persistence-supabase.ts:250`: the new
  routine uses versioned needs, portfolio provenance, and `user_products`.
  An old routine cannot be relabeled as a new routine or silently adopted.
- `src/components/personal-plan-journey/` and
  `src/lib/personal-plan/refinement/module-scope.ts`: chapter UI is still reachable
  for unscoped/old-link states. Compatibility routing precedes deletion.

## Designed user journey — confirmed 2026-08-28

| Returning buyer state                                                     | Intended shared experience                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Already has a valid current Personal Plan                                 | Resume that Plan; do not recompute merely because of the migration.                                                                                                                                                                                                                                             |
| Valid paid access, completed owned legacy quiz, unfinished old onboarding | Prepare the new Plan from existing quiz answers, then use current Plan → Routine and optional modules. No old chapter screens or second checkout.                                                                                                                                                               |
| Valid paid access, completed legacy quiz and old routine                  | Prepare a new versioned Plan and show the same Plan screen as a new user. Use its normal onward action and optional refinement, with usable saved answers/products already filled in. No migration-specific screen or extra identity confirmation; corrections remain available and original data is preserved. |
| Valid paid access, missing required quiz facts                            | Reuse reliable saved facts and collect missing facts before computation; use existing hair-length repair where applicable. Never mark an incomplete quiz complete.                                                                                                                                              |
| Valid paid access, no defensible historical source binding                | Design an authenticated fresh-quiz source binding to the existing entitlement, or an explicit recovery path. Do not invent historical purchase attribution or use a fuzzy email match.                                                                                                                          |
| Old chapter or `/onboarding` bookmark                                     | Preserve validated lead/return context and resolve the shared destination server-side.                                                                                                                                                                                                                          |
| Retake from profile                                                       | Persist the owned new quiz source and preserve the explicit safe return and existing routine-update confirmation contract; no silent replacement of the active routine.                                                                                                                                         |
| Conversion fails or is retried                                            | Keep source/product data; show a retryable recovery state. No duplicate Plan generations or partial activation. Existing access must not be destroyed.                                                                                                                                                          |

The normal paid access gate remains authoritative. The successful first-return
direction is confirmed. Failed conversion preserves original records and access,
and uses the existing preparation retry surface; it does not maintain a second
normal onboarding journey. Optional-refinement failure can return to the current
routine. The detailed plan owns transactional/retry behavior.

## Planning evidence and open decisions

Current source and existing arrival/Plan layouts inspected. Contextual evidence:
[current product screen](unified-post-payment-evidence/current-products.png),
[proposed screen](unified-post-payment-evidence/prefill.html),
[mobile](unified-post-payment-evidence/proposed-mobile.png), and
[unresolved product](unified-post-payment-evidence/unresolved-mobile.png).
The worker added the agreed preparation/error states to the same preview; Codex
checked their state switching and desktop/mobile rendering:
[inline retry](unified-post-payment-evidence/recovery-mobile.png),
[preparation pending](unified-post-payment-evidence/preparation-mobile.png).
The static proposal reuses the existing hierarchy and controls, with a small
saved-source label. It uses fixture data and system fonts; it is not an implemented
or persistence-verified feature. Desktop and 390px mobile inspected by Codex.
**Nick's mockup review: confirmed. Final journey sign-off: confirmed (2026-08-28).**

Recovery decision confirmed by Nick in this revision: the old chapter owns failed
product-preparation retry; replace it with a compact error with
“Erneut versuchen” inside the current module/preparation shell, keeping Back and
saved progress. No extra chapter/confirmation. Its small contextual error-state
preview has now been created and checked locally; Nick's visual review and journey approval are confirmed. No further recovery product choice is open. The core
successful journey is unchanged.

Product carry-over direction is **confirmed**. Nick clarified that the desired
experience has no additional confirmation screen or redundant product selection.
Nick approved the following minimal UI direction ("Okay sounds good"); contextual
mockup review and the final complete-journey sign-off are now confirmed:

- A valid exact saved catalog product ID appears under the existing
  "Ausgewählte Produkte", with usable saved frequency and a small source label
  "Aus deinen bisherigen Angaben". Ordinary "Weiter" is available once required
  facts are valid. Users may remove/change the selection or add another product.
- A name-only, ambiguous, retired, or otherwise unresolved identity must not be
  silently converted to a guessed catalog item. Preserve the original record;
  prefill the existing search/intake with its saved name and ask only for the
  unresolved identity/frequency through that existing surface.
- Import records ownership, not suitability, role selection, recommendation
  acceptance, or completed module progress. Keep current product-fit checks and
  routine activation safeguards.
- Original legacy records remain unchanged; retries must not duplicate imported
  products or overwrite changes made in the new module.
- Prefill other saved onboarding answers when an unambiguous current-question
  mapping exists. Preserve their actual provenance and do not manufacture missing
  answers, treat resolver defaults as user input, or mark unseen product-fit
  decisions complete. Exact mappings and progress semantics belong in the
  implementation plan and its deterministic fixtures.

Current UI support: `ProductCaptureScreen` and `ProductCapturedProductList` in
`src/components/personal-plan-products/index.tsx:118,542` already render saved
selections, removal/add controls, and ordinary "Weiter". The production host
at `stage3-products-flow.tsx:1031` supplies captured products and enables Continue
when products are present. No new standalone identity-confirmation screen is
needed for this proposed behavior. `load-routine-artifact-data.ts:15` confirms
legacy rows can have an exact `product_id`, or an unresolved text/submission;
those cases require different conversion handling.

Architecture research selected a small owner-scoped migration enrollment binding:
an exact existing paid authority (provider subscription, one-time purchase, or
the application's existing legacy-profile paid fallback) plus an owned quiz source.
Fresh authenticated quiz completion binds to that record; it never fabricates an
old provider/funnel purchase correlation. See the detailed implementation plans.

**First-return decision confirmed:** Nick requested exactly the new-user Plan
experience, then the normal optional refinement with saved information prefilled.
Use the existing Plan view and "Zu deiner Routine" action; do not introduce a
special migration review/confirmation screen or silently skip the Plan view.
Users already on a valid current Personal Plan continue to resume their current
state. Contextual evidence review and final whole-journey sign-off are confirmed.

## Execution order

1. Evidence and full-journey sign-off: completed, 2026-08-28.
2. Current-main refresh: completed through #479. Start independent data work now.
   Before shared chapter UI edits, refresh after #478's eventual merge and verify
   its final SHA. Do not implement #478 twice or modify its PR. Preserve its
   completed-draft `?refine=1` products edit behavior and #479's quiz transitions,
   reduced-motion handling, focus timing and overflow containment.
3. Execute the universal-entry plan, then the saved-prefill plan, then the remaining
   chapter-retirement plan. Each owns its exact interfaces and regression checks.
4. Run implementation-loop verification and whole-change review. Broad historical
   activation waits for all three deliverables; publication and production writes
   still require their separate permissions.

## Verification requirements

- Deterministic fixtures: active historical subscription with complete exact
  source; pre-cutoff/non-launch source; expired/revoked access; wrong owner;
  missing correlation; complete/missing-fact source; retry/idempotency.
- Preserve paid access, retake return, profile projection, and all existing
  user-owned product data. Test matched, retired, unmatched/free-text, and
  duplicate legacy product cases for the selected carry-over behavior.
- Integration: server-resolved entry from both result callers, old onboarding
  URLs, fresh source completion, and accepted-but-incomplete routing pointers.
- Browser: new/returning paid users, incomplete onboarding, old bookmarks,
  module Back/reload, normal completion, and conversion failure/retry.
- Production cohort counts and any migration require a fresh explicit preflight;
  no production data or accounts have been inspected or changed in this task.
- Local labs do not prove hosted access/persistence. Normal dev credentials target
  production; never use dev login or a payment fixture as an implicit write approval.

## Review and handoff

Implementation and additive local migrations are authorized by Nick's explicit
confirmation. No deployment, activation, account operation or production write is
authorized. Claude reviewed the plan once at high; findings are reconciled in the
universal-entry plan. The independent implementation has now been reviewed and
checked as recorded above; final joined-journey verification and whole-change
review remain due after the upstream dependency is integrated.
Broader Plan eligibility is intentional; paid duration stays unchanged. No production
cohort counts support a claim that most users need a fresh quiz.

Artifact disposition: this decision record and subsequent approved mockups/plans
are durable (`commit` with the eventual task PR); transient review output is
`discard` after findings are reconciled. Do not delete existing merged-task
artifacts as part of this worktree.
