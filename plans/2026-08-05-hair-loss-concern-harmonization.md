# Hair-loss concern harmonization across both quizzes

## Outcome and source context

Both the Personal Plan quiz and the regular organic quiz capture the same new structured concern, `hair_loss_or_thinning`, under the German label **“Haarausfall oder dünner werdendes Haar”**. Both retain a UI-only **“Etwas anderes”** free-text path and expose no **“Nichts davon”** choice on the hair-concern page. The selected hair-loss concern participates in the shared three-row assessment and uses the same cautious explanatory copy on both offer paths.

Source context:

- Review of page-9 free-text submissions found recurring hair-loss/thinning and volume language; volume is already covered by the texture-aware `low_volume_or_weighed_down` option.
- Product decisions in this task: add one combined hair-loss/thinning option, keep Hair damage and Frizz separate, preserve free text, remove the hair-concern “Nichts davon” option, and integrate hair loss into the existing result rows rather than adding a special section.
- PR #329 already aligned the regular organic concern page with the Personal Plan card layout and added a persisted “Etwas anderes” note while removing its “Nichts davon” action. This plan preserves that shipped interaction, shortens its note limit from 120 to 50 characters, and adds the shared hair-loss concern.
- Reviewed planning artifact: [plans/mockups/2026-08-05-hair-loss-concern-harmonization.html](./mockups/2026-08-05-hair-loss-concern-harmonization.html).

## Chosen direction

Use one quiz-owned structured value everywhere:

| Meaning | Personal Plan storage | Organic quiz storage | Downstream profile projection |
| --- | --- | --- | --- |
| Haarausfall oder dünner werdendes Haar | `currentConcerns: ["hair_loss_or_thinning"]` | `concerns: ["hair_loss_or_thinning"]` | `hair_loss` |
| Etwas anderes | `currentConcernsOtherText` | `concerns_other_text` | none |

The option copy is:

- Label: **Haarausfall oder dünner werdendes Haar**
- Description: **Mir fallen mehr Haare auf als sonst oder mein Haar wirkt weniger dicht.**
- Stable value: `hair_loss_or_thinning`
- Icon: existing `goal-growth` concern icon

`hair_loss_or_thinning` is added to the shared `DIAGNOSTIC_CONCERNS` taxonomy and the shared `getConcernOptions` list. Hair damage (`hair_damage`) and Frizz (`frizz_flyaways`) remain distinct values, labels, assessment dimensions, and downstream signals. The existing texture-aware `low_volume_or_weighed_down` option remains the sole volume concern.

“Etwas anderes” remains UI-only rather than becoming an enum value. Its trimmed text is stored, resumed, and submitted, but is never interpreted, ranked, projected into a profile, sent to Customer.io, or shown on the public offer. This preserves the user escape hatch without turning unreviewed raw text into recommendation logic.

The Personal Plan retains answer version 3 and browser/server draft version 4. This is a backward-compatible widening of a JSON answer contract, not a database migration. Historical empty `currentConcerns` submissions and drafts remain parseable; the updated UI prevents new users from continuing unless a structured concern or non-empty note is present.

## Scope and non-goals

### In scope

- Add `hair_loss_or_thinning` to the one shared concern taxonomy and shared option source used by both quizzes.
- Preserve the organic quiz’s shipped “Etwas anderes” interaction, shorten its limit to 50 characters, and add equivalent Personal Plan behavior using `currentConcernsOtherText`.
- Remove only the Personal Plan hair-concern `Nichts davon` card; the scalp-concern “Nichts davon” behavior is unrelated and remains.
- Validate Personal Plan navigation when users choose structured concerns, free text, or both.
- Persist and resume Personal Plan concern free text through browser drafts, server drafts, canonical submission, and back navigation.
- Resolve the Personal Plan recurrence subject from the same assessment ranking used for offer rows rather than visible option order.
- Skip the recurrence question when only free text was supplied, while preserving any applicable conflict question and the rest of the flow.
- Add a hair-loss/thinning assessment dimension so the shared Personal Plan and organic offers can render it as one of the existing three rows.
- Project the combined quiz concern to the existing profile concern `hair_loss` so established hair-loss guidance can activate without manufacturing both `hair_loss` and `thinning` signals.
- Add the structured Customer.io label while continuing to exclude raw free text.

### Non-goals

- No separate hair-loss offer section, page, modal, banner, or medical disclaimer block.
- No new product category, medicinal product recommendation, treatment eligibility logic, or hair-loss-specific product ranking. Deeper product logic remains a later task.
- No merge of Hair damage and Frizz and no new volume option.
- No interpretation, classification, analytics export, Customer.io export, or profile projection of free text.
- No changes to the broader organic layout, card styling, navigation/resume, consent, loading, checkout, or tracking work delivered by PR #329.
- No database migration and no invalidation of existing Personal Plan v3 or draft v4 records.

## Target map

### Shared concern contract

- `src/lib/quiz/diagnostic-input.ts`
  - Add `hair_loss_or_thinning` to `DIAGNOSTIC_CONCERNS`.
  - Keep it quiz-owned; do not add `other` or merge it with two profile enum values.
- `src/components/personal-plan-quiz/quiz-data.ts`
  - Add the exact label, description, mid-sentence label, and existing icon to `SHARED_CONCERNS` immediately after `hair_damage` (fifth shared card), before `breakage`, `split_ends`, `tangling`, and the two texture-specific concerns.
  - Because both quiz pages call `getConcernOptions`, this is the single visible-option change for both funnels.
- `src/components/quiz/quiz-concerns-question.tsx`
  - Preserve the shipped free-text implementation and validate that the new shared option renders and submits correctly; no parallel option list.
- `src/components/quiz/legacy-quiz-visuals.ts`
  - Retain the existing `hair_loss_or_thinning: "goal-growth"` icon mapping.

### Personal Plan concern UI and flow

- `src/lib/personal-plan-quiz/types.ts`
  - Add optional `currentConcernsOtherText?: string` with a 50-character contract.
- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`
  - Remove `noneOption` and `onEmpty` only from `current_problems`.
  - Explicitly extend `QuestionScreen` with a Continue-validity override, a standalone other-text trigger that is not an option value, and a per-screen maximum length. The existing blockers screen remains enum-backed at 280 characters; the concern screen uses the standalone path at 50 characters.
  - Mirror the organic interaction: the card opens and focuses the note; “Notiz entfernen” clears and closes it; structured cards remain independently selectable.
  - Enable Continue when `currentConcerns.length > 0 || currentConcernsOtherText.trim().length > 0`.
  - Clear stale `concernRecurrence` whenever structured concern selections change.
  - Render and save recurrence against the shared ranked primary structured concern, not the first visible option.
- `src/lib/personal-plan-quiz/flow.ts`
  - When no structured concern exists, route from `scalp_concerns` past `admission_recurrence`; still include `admission_conflict` when `derivePersonalPlanConflictPrompt` produces one.
  - Keep all other sequencing unchanged.
- `src/lib/personal-plan-quiz/hair-assessment.ts`
  - Expose a deterministic resolver for the highest-ranked explicit selected concern using the assessment’s pre-recurrence score and tie-breaking: evaluate with recurrence removed, filter to `explicitConcern`, and use the full ranked dimension list rather than only the final three public rows.
  - Reverse-map the winning dimension explicitly: `hair_loss_thinning -> hair_loss_or_thinning`; `breakage_stability -> breakage` when selected, otherwise `hair_damage`; every other explicit dimension maps through `CONCERN_BY_DIMENSION`. Surface-only observations cannot become a recurrence subject.
  - Use it for recurrence subject selection, including hair loss, Hair damage, Breakage, and Frizz regression cases.

### Persistence and compatibility

- `src/lib/personal-plan-quiz/persistence.ts`
  - Accept and canonicalize trimmed `currentConcernsOtherText` up to 50 characters so it participates in the existing stable answer hash/deduplication.
  - Keep historical empty concern arrays valid at the API boundary for v3 compatibility; new-flow completeness is enforced by the UI journey.
- `src/lib/personal-plan-quiz/draft.ts`
  - Sanitize and round-trip the optional note without changing storage key/version. The recovery sanitizer trims and truncates malformed client state to 50 characters.
- `src/lib/personal-plan-quiz/server-draft.ts`
  - Accept and round-trip the optional note without changing draft envelope version. Server-draft and durable request schemas reject values above 50 characters; UI input prevents/slices above 50 before submission.
- Existing lead/prepared-artifact JSON persistence remains unchanged; no SQL migration is needed.

### Offer, profile, and messaging integration

- `src/lib/personal-plan-quiz/hair-assessment.ts`
  - Add internal `hair_loss_thinning` immediately after `scalp_balance` in `HAIR_ASSESSMENT_DIMENSION_IDS`. This pins its tie-break position rather than leaving user-visible priority to an accidental insertion index.
  - Change `GOAL_BY_DIMENSION` from an exhaustive `Record` to a `Partial<Record<...>>` and make `goalMatch` false when no goal mapping exists; do not invent a hair-loss goal.
  - Add `hair_loss_thinning: "hair_loss_or_thinning"` to `CONCERN_BY_DIMENSION` so recurrence weighting works normally.
  - Add primary evidence from `hair_loss_or_thinning`, no synthetic goal match, normal recurrence weighting, and normal top-three selection.
- `src/lib/personal-plan-quiz/assessment-copy.ts`
  - Add title **“Haarausfall & dünner werdendes Haar”** and this reviewed 24-word, two-sentence explanation:
  - **“Schonende Pflege schützt bei Haarausfall und dünner werdendem Haar vor zusätzlichem Haarbruch, Zug und Reibung. Medizinische Behandlungen können Haarausfall bremsen oder neues Wachstum unterstützen.”**
  - Add an explicit `hair_loss_thinning` branch before the existing final volume fall-through. Split the same string into established `text()` / `answer()` parts so only **“Haarausfall und dünner werdendem Haar”** receives answer emphasis.
  - Keep the shared 28-word/two-sentence copy contract intact so both offer renderers receive identical copy automatically.
- `src/lib/personal-plan-quiz/offer-adapter.ts`
  - Add the identity mapping `hair_loss_or_thinning -> hair_loss_or_thinning` for organic answers entering the shared assessment.
  - Preserve the established three routine concerns used for guided-story/product computation; append the projected `hair_loss` profile signal without allowing it to displace those routine concerns.
- `src/lib/quiz/normalization.ts`
  - Let the shared enum expand `QUIZ_ANSWER_CONCERN_VALUES` automatically.
  - Add the explicit compatibility projection `hair_loss_or_thinning -> hair_loss`.
- `src/lib/personal-plan-quiz/customerio.ts`
  - Add the readable label for the structured selection.
  - Do not emit `currentConcernsOtherText`; add a regression assertion matching the organic quiz’s existing raw-text privacy boundary.
- `src/components/organic-plan-offer/organic-plan-offer.tsx` and Personal Plan prepared-plan rendering
  - Require no special UI branch: both already consume `assessPersonalPlanHair` plus `buildPersonalPlanAssessmentRows`.

## Designed user journey

### Shared concern capture

1. A user reaches **“Was beschäftigt dich gerade?”** in either quiz.
2. The existing concern cards remain, including separate Hair damage and Frizz cards and the texture-aware volume card.
3. The user also sees **“Haarausfall oder dünner werdendes Haar”** with the non-diagnostic description **“Mir fallen mehr Haare auf als sonst oder mein Haar wirkt weniger dicht.”**
4. The user may select one or more structured cards, open **“Etwas anderes”** and enter up to 50 characters, or do both. There is no **“Nichts davon”** choice.
5. Continue remains disabled when neither a structured concern nor non-whitespace free text exists. Removing the note returns it to the disabled state if no structured card is selected.
6. Back navigation and browser/server resume restore both the structured selections and the trimmed note. Existing old drafts continue to load because versions are unchanged.

### Personal Plan continuation

7. If at least one structured concern is selected, the assessment ranking determines which selected concern becomes the recurrence subject. The question names that concern and stores recurrence against its stable enum.
8. If the user supplied only free text, the recurrence question is skipped because raw text is not interpreted. Any applicable conflict question still appears, followed by the normal practical and emotional admissions.
9. If the user changes structured concerns after navigating back, stale recurrence is cleared and recomputed from the new ranked selection.

### Results and downstream use

10. When hair loss/thinning ranks among the top three assessment dimensions, either offer shows **“Haarausfall & dünner werdendes Haar”** as one of its normal three rows with the reviewed two-sentence guidance. No extra section appears.
11. The stored structured signal projects to profile concern `hair_loss`, enabling existing conservative advisor guidance after profile linking. It does not create a second `thinning` signal.
12. Free text remains stored for product research and support review but is not interpreted, displayed on the offer, projected into the profile, or sent to Customer.io.
13. The user proceeds through the unchanged result, plan, email, and checkout journeys for the funnel they entered.

### Recovery and compatibility states

- Whitespace-only free text does not count as an answer and is removed during normalization.
- A note longer than 50 characters is bounded in the UI and rejected/sanitized consistently at storage boundaries.
- Historical organic submissions, Personal Plan v3 submissions, and draft v4 snapshots without the new enum or note remain valid.
- Existing historical Personal Plan drafts with an empty concern array remain resumable; the change does not introduce a version-based reset.

User-journey sign-off: **confirmed August 5, 2026** when Nick explicitly requested implementation after reviewing the final 50-character journey and refreshed free-text evidence.

## Planning evidence

- Artifact: [plans/mockups/2026-08-05-hair-loss-concern-harmonization.html](./mockups/2026-08-05-hair-loss-concern-harmonization.html)
- Question answered: Can the new hair-loss concern, free-text escape hatch, recurrence, and cautious result guidance fit into the existing shared concern and three-row offer layouts without a special section?
- Selected direction: one shared concern card, UI-only free text, ranked recurrence for structured answers, and one normal shared assessment row.
- Current-main correction incorporated: the organic quiz already has the final free-text interaction and no hair-concern “Nichts davon”; implementation must preserve that interaction while shortening its limit to 50 characters rather than rebuilding it.
- Evidence-review status: **confirmed August 5, 2026**; feedback incorporated by shortening both concern-note limits from 120 to 50 characters.
- Artifact disposition: **commit** with the plan and implementation PR.

## Ordered tasks

1. **Write shared-taxonomy and projection tests first.**
   - Extend quiz normalization/type tests to prove `hair_loss_or_thinning` canonicalizes in organic answers and projects to exactly `hair_loss`.
   - Extend shared option-source tests to prove both concern pages receive the same stable option while Hair damage, Frizz, and volume remain separate.
   - Completion: failing tests describe the new enum, exact copy, ordering, icon, and profile projection before production edits.

2. **Add the shared option once.**
   - Widen `DIAGNOSTIC_CONCERNS` and add the option to `SHARED_CONCERNS`.
   - Do not add `other`, another volume value, or aliases between Hair damage and Frizz.
   - Completion: both quiz pages render the exact new card from `getConcernOptions`; organic normalization accepts it.

3. **Add Personal Plan UI-only free text and remove the hair-concern empty action.**
   - Add `currentConcernsOtherText`, the independent “Etwas anderes” card/field, 50-character limit, remove-note behavior, and combined Continue validation; change the organic UI and validator from 120 to the same 50-character limit.
   - Remove the `current_problems` `noneOption`/`onEmpty` configuration only.
   - Preserve blockers and scalp “Nichts davon” behavior.
   - Completion: component/source tests and browser checks cover structured-only, text-only, combined, whitespace-only, clearing, and no hair-concern “Nichts davon”.

4. **Round-trip the note without resetting old drafts.**
   - Extend client sanitizer, local draft, server draft, durable submission, canonicalization, hashing, and dedupe fixtures.
   - Keep Personal Plan version 3 and draft version 4.
   - Completion: old fixtures still parse; a 50-character note survives back navigation, browser reload, server resume, prepare, and lead submission; UI input is bounded, malformed local draft state is truncated during recovery, and server/durable requests reject 51 characters.
   - Stop gate: the Personal Plan UI change must not be merged or deployed before every strict persistence schema accepts `currentConcernsOtherText`; otherwise the entire lead submission would be rejected.

5. **Unify recurrence subject selection with assessment ranking.**
   - Add a deterministic ranked-primary-concern resolver over the pre-recurrence assessment ranking and use it in the Personal Plan admission screen and recurrence write path. This is intentionally a cross-concern behavior correction requested for this task, not hair-loss-only special casing.
   - Add the free-text-only flow skip while preserving optional conflict routing.
   - Completion: tests prove recurrence is not driven by option order, changes after back-navigation clear stale recurrence, hair loss can be the subject, and free-text-only users never receive a synthetic recurrence concern.

6. **Integrate hair loss into the shared three-row assessment.**
   - Add the hair-loss dimension at the pinned second index, make the goal map optional, add its concern map/evidence/recurrence support, and add an explicit copy branch with the exact reviewed explanation.
   - Preserve the assessment model’s exactly-three-row and copy-length contracts.
   - Completion: Personal Plan prepared-artifact and organic-offer adapter tests both produce the same hair-loss row when it ranks in the top three; Hair damage and Frizz continue to produce separate rows; the exact explanation string is asserted; and the prepared-plan fixture is intentionally updated from nine to ten diagnostic dimensions.

7. **Carry the structured signal across compatibility and messaging boundaries.**
   - Add organic assessment identity mapping, profile projection to `hair_loss`, Personal Plan canonical-profile retention that does not displace established routine concerns, and the structured Customer.io label.
   - Explicitly exclude both free-text field names from Customer.io and result-email payloads.
   - Completion: profile-link tests activate exactly one `hair_loss` concern and the established hair-loss advisor/routine guardrails, while existing cosmetic guided-story/product priorities remain unchanged; privacy regressions prove raw notes are absent; and a taxonomy coverage test fails if any structured Personal Plan concern lacks a Customer.io label.

8. **Run full cross-quiz verification and review.**
   - Run targeted unit/component tests, both quiz browser paths at mobile and desktop viewports, prepared-artifact determinism, organic offer rendering, Customer.io privacy tests, and the repository ready/review gates.
   - Completion: both journeys match the reviewed artifact and no regression appears in resume, answer normalization, offer ranking, profile linking, consent, or loading behavior.

## Verification

### Automated checks

- Shared vocabulary/normalization: `tests/quiz-normalization.test.ts`, `tests/quiz-validators.test.ts`, and a shared concern-option contract test.
- Organic UI/resume: `tests/legacy-quiz-ui.test.ts`, `tests/legacy-quiz-mobile-action.spec.ts`, `tests/legacy-quiz-browser-history.test.ts`, and relevant onboarding/lead lifecycle tests.
- Personal Plan UI/flow: `tests/personal-plan-quiz-funnel-entry.test.ts`, `tests/personal-plan-quiz.test.ts`, `tests/personal-plan-quiz-server-draft.test.ts`, plus a focused browser test for the concern page and free-text-only recurrence skip.
- Ranking/result copy: `tests/personal-plan-hair-assessment.test.ts`, `tests/personal-plan-prepared-plan.test.ts`, and organic offer/adapter coverage.
- Persistence/privacy: `tests/personal-plan-lead-persistence.test.ts`, Customer.io sync/outbox tests, quiz result email tests, and Personal Plan result email tests.
- Run targeted Node tests with `node --import ./tests/server-only-register.cjs --import tsx --test <files>` during implementation, then `npm run test:node` and `npm run ci:verify` at readiness.
- Run UI browser coverage explicitly with `npx playwright test tests/legacy-quiz-mobile-action.spec.ts <new-personal-plan-concern-spec> --project=chromium`; this spec is not part of `npm run test:node`.

### Manual/browser checks

- Personal Plan and organic quiz at 375×667, 390×844, and a representative desktop viewport.
- Confirm the exact hair-loss card copy, independent Hair damage/Frizz cards, texture-aware volume card, “Etwas anderes” expansion, fixed bottom action, keyboard visibility, and absence of hair-concern “Nichts davon”.
- Confirm Continue behavior for structured-only, text-only, combined, blank, and cleared states.
- Confirm browser Back, reload, resume-token/server-draft restore, and editing after resume.
- Confirm Personal Plan structured recurrence versus free-text-only skip.
- Confirm both offer paths show the same normal hair-loss result row when selected into the top three and show no additional section.

### Migration and live-state checks

- No SQL migration or production data rewrite.
- Verify representative stored organic and Personal Plan answers from before the change still normalize.
- Verify the new JSON value and optional field persist in their respective lead payloads after deployment.
- Do not inspect or expose raw user-entered note content during automated verification.

### Evidence-sensitive review

- Review the hair-loss description and result paragraph for non-diagnostic wording, clear separation between routine protection and medical treatment possibilities, and no treatment promise.
- Verify raw free text remains outside Customer.io, result emails, analytics, assessment computation, and profile projection.

## Review and handoff

- Planning/implementation worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/hair-loss-guidance-plan`
- Branch: `codex/hair-loss-guidance-plan`, refreshed to current `origin/main` after PR #329.
- The organic-parity branch/worktree is out of scope and must not be edited.
- Counterpart plan review: completed at `high` effort; transient Claude output was stored outside the repository and will be discarded after this handoff.
- Evidence review: confirmed; the requested 50-character correction is reflected in the plan and HTML artifact.
- User-journey sign-off: confirmed; implementation is authorized within this plan’s scope.
- Durable artifacts: this plan and its HTML mockup are **commit** artifacts.
- No migration, deployment, merge, or production write is authorized by plan approval.
- After evidence and journey sign-off, hand execution to `implementation-loop`, which will invoke `ready-check` and `request-code-review` before a review-ready handoff.

## Findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| F-01 | defect | Organic concern UI on current `main` already implements free text and removes “Nichts davon” via PR #329. | accepted | Preserve the interaction, deliberately shorten its limit from 120 to 50 characters in both quizzes, and do not duplicate parity work. | Organic UI, validator, and browser-history tests. |
| F-12 | scope/product decision | Live length analysis covered 111 submissions from 106 submitters: median 23, p90 48, max 50; a 40-character limit would truncate 18%, while 50 covers every observed entry. | accepted | Set both concern-note fields and all validation/persistence boundaries to 50 characters. | Exact 50/51-character boundary tests in both quiz contracts. |
| F-02 | tradeoff | Personal Plan draft/submission versions currently accept empty historical `currentConcerns`; bumping versions would reset active drafts. | accepted | Keep v3/v4 and enforce non-empty concern-or-note in the new UI while retaining backward-compatible parsing. | Old draft/submission fixtures plus new UI validation tests. |
| F-03 | scope/product decision | Raw free text cannot safely drive ranking or profile guidance without classification policy. | accepted | Store it only; skip recurrence for text-only answers and exclude it downstream. | Flow, Customer.io, email, and profile-projection tests. |
| F-04 | defect | `GOAL_BY_DIMENSION` is exhaustive, `CONCERN_BY_DIMENSION` drives recurrence, and `explanationFor` falls through to volume copy. | accepted | Make goal mapping optional, add the exact concern mapping, and require an explicit hair-loss copy branch. | Typecheck plus exact assessment/copy tests. |
| F-05 | defect | Dimension array position breaks equal-score ties and an existing prepared-plan test asserts nine dimensions. | accepted | Pin hair loss second after scalp and update the fixture to ten dimensions. | Ranking-order and prepared-plan tests. |
| F-06 | defect | The current other-text seam is enum-triggered, 280 characters, and cannot override Continue validity. | accepted | Add explicit standalone trigger, validity override, and per-screen maximum while preserving blockers. | Personal Plan UI and persistence tests. |
| F-07 | tradeoff | Re-ranking recurrence affects all multi-concern Personal Plan users. | accepted | Keep it in scope because the owner explicitly requested reuse of offer ranking; define pre-recurrence filtering and reverse mapping precisely. | Cross-concern recurrence regression matrix. |
| F-08 | scope/product decision | The result sentence mentions medical treatments without adding a special disclaimer section. | accepted | Keep the previously reviewed cautious two-sentence copy and no special section. | Evidence-sensitive copy review and exact-string test. |
| F-09 | scope/product decision | Profile projection activates existing hair-loss guidance in addition to the public row. | accepted | Ship the option, row, and `hair_loss` projection together as previously requested. | Profile-link and advisor-guidance tests. |
| F-10 | tradeoff | A feature flag would add a kill switch but also widen scope around a small additive taxonomy change. | rejected | Use the existing revert workflow; do not add a flag. | Full pre-ship verification and stored-answer compatibility fixtures. |
| F-11 | defect | Counterpart claimed Codex workflow skills were unavailable based on Claude-side skill visibility. | rejected | Retain `implementation-loop`, `ready-check`, and `request-code-review`, which are available to the orchestrator; also name exact repository commands. | Handoff uses the listed skills and commands. |
