# Personal-plan assessment and score explanations

## Outcome and source context

Replace the personal-plan offer's opaque 40–100 hair-potential calculation with one small, reusable assessment model. The model evaluates all supported hair dimensions from durable quiz answers, selects the three most relevant rows, and explains each visible row with a concise German sentence grounded in the user's own selections.

The offer remains a simplified projection of the same assessment object that can later be reused inside the product. It must not maintain a second offer-only scoring system.

Repository context was refreshed to `origin/main` at `a8131d7c` on 2026-08-01. Current behavior:

- `src/lib/quiz/hair-potential.ts` owns the legacy 40–100 score whitelist and is shared with guided-story paths.
- `src/lib/personal-plan-quiz/prepared-plan.ts` adapts V2 answers into that legacy model, selects three guided-story priorities, and converts 40–100 values into 1–3 visible segments.
- `src/lib/personal-plan-quiz/offer-adapter.ts` currently expands “Haarbruch oder Spliss” into one or two canonical concerns and retains at most three concerns, which can crowd out another explicitly selected topic.
- `src/lib/personal-plan-quiz/types.ts` keeps recurrence in ephemeral state, so it is not available when the server prepares the result artifact.
- `src/lib/personal-plan-quiz/profile-summary.ts` is another user-visible consumer of the current combined concern IDs and must migrate with the quiz vocabulary.
- `personal_plan_prepared_artifacts.diagnostic_scores` is an existing private JSONB field written during preparation and has no application read path today; it is the natural home for the versioned assessment without a migration.
- `src/app/result/[leadId]/page.tsx` reads only the bearer-style `public_offer_model`; raw or private assessment data must not be added to that query.

Approved product decisions:

- keep the existing two-column 1–3 segment graphic;
- add one short expert explanation below each row;
- quote at most three selected answers in bold, with no chips or checkmarks;
- end the three rows with one shared reassuring transition;
- use nine reusable dimensions: scalp, moisture, surface, shine, breakage, split ends, manageability, definition, and volume;
- keep Haarbruch and Spliss separate;
- keep Glanz as a separate assessment dimension but a display sibling of Oberfläche;
- keep Kämmbarkeit/Verknotung independent;
- do not add length retention, build-up, or color protection dimensions;
- use a capped 0–3 evidence score, a `+0.5` matching-goal bonus for ranking only, and recurrence only as a tie-breaker;
- remove the arbitrary 40-point floor and do not expose percentages or formulas.

## Chosen direction

### One minimal canonical model

Evaluate every dimension into this small private contract:

```ts
type DimensionAssessment = {
  id: HairAssessmentDimensionId
  evidenceScore: number // 0..3 in 0.5 increments
  goalMatch: boolean
  evidence: readonly AssessmentEvidence[]
  recurrence?: "often" | "sometimes" | "rather_not"
}
```

`priorityScore` is derived, not stored:

```text
priorityScore = evidenceScore + (goalMatch ? 0.5 : 0)
```

The evidence score uses only three weights:

- `2`: a primary signal—an explicit current concern or unambiguous dimension-defining state;
- `1`: a meaningful direct observation;
- `0.5`: supporting context that cannot activate a dimension by itself;
- cap the sum at `3`.

Goals never change the current-condition evidence score. Texture, thickness, and density never count as damage. Chemical treatment, length, and related observations may reinforce an already active dimension but cannot create it.

Do not persist a second confidence score or a band. The typed evidence trace is the explanation and audit source; offer bands are derived at presentation time.

### Dimension rule table

| Dimension                | Primary `+2`                          | Observation `+1`                                                  | Supporting `+0.5`                                                     | Matching goal `+0.5` to priority only |
| ------------------------ | ------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| `scalp_balance`          | oily or dry scalp; flakes; irritation | —                                                                 | one additional distinct scalp concern                                 | `scalp_balance`                       |
| `moisture_softness`      | dry/straw-like lengths                | —                                                                 | rough surface; lightened/permed/chemically straightened lengths       | `moisture`                            |
| `surface_frizz`          | frizz/flyaways; rough surface         | slightly uneven surface                                           | —                                                                     | `frizz_surface`                       |
| `shine`                  | low shine                             | —                                                                 | rough surface                                                         | `shine`                               |
| `breakage_stability`     | reported breakage in the lengths      | hair snaps or remains stretched in the gentle stretch observation | lightened/permed/chemically straightened lengths                      | `strength_ends`                       |
| `split_ends`             | visibly split/frayed tips             | —                                                                 | long/very long hair; lightened/permed/chemically straightened lengths | `strength_ends`                       |
| `manageability_tangling` | quick tangling                        | —                                                                 | rough surface; long/very long hair                                    | `manageability_styling`               |
| `shape_definition`       | lost shape/definition                 | —                                                                 | frizz/flyaways                                                        | `shape_definition`                    |
| `volume_lightness`       | flat, weighed-down, or uneven volume  | —                                                                 | confirmed “care makes my hair heavy” conflict                         | `volume_balance`                      |

Rules within a dimension:

- the same answer contributes at most once;
- several primary signals may coexist but the total remains capped at `3`;
- a supporting signal is ignored unless at least one primary/observation signal activated the dimension;
- `colored` is retained as product context but contributes no assessment points;
- the home stretch observation may activate a neutral `Stabilität` row but must not infer Haarbruch, moisture need, or a protein/moisture state; only an explicit breakage concern uses the public title `Haarbruch & Stabilität`.

### Row selection and visible segments

1. Evaluate all nine dimensions.
2. A dimension is an active candidate only when it has a primary or direct-observation signal; a goal or supporting context alone cannot activate it.
3. Sort active candidates by descending derived priority, then by exact-concern recurrence (`often`, `sometimes`, `rather_not`), explicit current concern over observation-only activation, and a fixed dimension order.
4. Oberfläche and Glanz are siblings: keep both in the private assessment, but show at most one of them in the final three offer rows, including positive-fill rows.
5. Haarbruch and Spliss are independent and may both appear when each has its own explicit concern evidence.
6. If fewer than three active candidates remain, fill with deterministic positive dimensions backed by explicit neutral observations; preserve the sibling rule while filling and do not invent a problem from a goal alone.

Confirmed positive-fill allowlist:

- `scalp_balance`: explicitly balanced scalp with no selected scalp concerns;
- `surface_frizz`: explicitly smooth surface;
- `breakage_stability`: gentle stretch observation “stretches and returns” with no reported breakage.

No other dimension gets a positive `3/3` row from absence of a concern alone.

Implementation review decision confirmed on 2026-08-01: “stretches and remains stretched” is a direct observation worth `+1`, ensuring every complete quiz has three evidence-backed rows. Without an explicit breakage concern, the row is titled `Stabilität` and uses the approved bounded copy: “Beim sanften Dehnen blieb dein Haar gedehnt. Das spricht dafür, dass es sich unter Zug aktuell weniger gut zurückformt.”

Map evidence—not priority—to the existing segments:

| Evidence  | Current segments | Meaning                    |
| --------- | ---------------- | -------------------------- |
| `0`       | `3/3`            | positive/maintenance state |
| `0.5–1.5` | `2/3`            | light indication           |
| `2–3`     | `1/3`            | clear actionable need      |

The matching goal can move a row into the top three but can never worsen its displayed current state.

### Recurrence and reflective questions

Make recurrence durable only for the exact concern named on the screen:

```ts
type ConcernRecurrence = {
  concernId: PersonalPlanQuizConcern
  frequency: "often" | "sometimes" | "rather_not"
}
```

Recurrence is an ordinal tie-breaker and an optional copy fact; it does not change evidence. The quiz must save the subject concern ID alongside the answer and clear/update it when the concern selection changes.

The concern vocabulary change is intentionally incompatible with unfinished drafts that contain the combined IDs. Bump the submitted quiz schema from version `2` to `3`, bump the browser/server draft schema from version `3` to `4`, and move the browser storage key from `v3` to `v4`. Do not silently map “Haarbruch oder Spliss” to either new concern. An unfinished pre-change draft starts again; already attached result artifacts remain unchanged.

Conditional conflict answers may become typed plan modifiers such as `different_zone_needs` or `weight_sensitivity`, but only the exact “care makes my hair heavy” response may reinforce the already-active volume/lightness dimension. Practical cost and emotional-importance admissions must never affect assessment or ranking.

Routine clarity, result reliability, adaptation confidence, previous attempts, blockers, routine style, and daily time remain plan-personalization inputs. A separate routine-guidance score is not required for this change.

### Quiz concern vocabulary

The current concern screen must stop combining unrelated dimensions:

- replace “Trockene oder raue Längen” with “Trockene oder strohige Längen”;
- replace “Haarbruch oder Spliss” with two options;
- remove the broad scalp-imbalance option because the later scalp questions are more precise;
- retain Frizz/flyaways, low shine, tangling, lost shape/definition, and volume/lightness concerns.

Current copy candidate for the split:

- Haarbruch: **„Mein Haar bricht in den Längen ab.“** Supporting description: „Einzelne Haare reißen oberhalb der Spitzen ab.“
- Spliss: **„Meine Spitzen sind sichtbar gespalten oder ausgefranst.“** Supporting description: „Die Enden einzelner Haare teilen sich sichtbar.“

The structural split is confirmed; final German wording remains part of the revised mockup/journey review before implementation.

### Explanation composition

The selected dimension's evidence trace is the only source for its public explanation.

1. Quote the strongest primary current-state evidence.
2. Add at most two non-redundant current-state observations or supporting facts.
3. Translate each fact into what it means for the named dimension. A direct answer may need only one short restatement; a supporting fact earns space only when the copy explains its causal relevance.
4. Omit goals and recurrence from the row explanation. They may affect row selection or ordering, but they do not explain the current potential segments.
5. Give each signal one public owner. A primary signal wins over the same signal being reused as support elsewhere; skip repeated support rather than forcing three facts into every row.
6. Use at most two short sentences and 28 German words. Never announce that the dimension will be a plan focus or repeat that the graphic shows potential; both are already visible.
7. When reinforcing context matters, explain mechanism plus relevance in bounded language—for example: “Blondierung kann die Haarfaser zusätzlich beanspruchen und poröser machen – deshalb sollten wir diesen Bereich besonders im Blick behalten.” Use “kann” for a contributing context; never claim that treatment proves individual damage.
8. Remove filler such as “zusammen zeigt uns das”, “klarer Ansatzpunkt”, repeated reassurance, and self-referential conclusions such as “Darum sehen wir hier viel Potenzial”.
9. Apply an insightfulness gate before publishing any sentence: it must add a causal relationship, a useful distinction, or a concrete implication. A synonym-only restatement is omitted rather than dressed up as expertise.
10. Keep scoring confidence, method caveats, and generic placeholders such as “weiteres Signal” out of public copy. Pair scalp signals through explicit compatible, mixed, or irritation-sensitive relationships instead.
11. A neutral observation may clarify an apparent contradiction without changing evidence—for example, smooth-feeling hair alongside low visible shine. It follows the same single-owner rule and cannot also create a positive sibling row.
12. Keep causal bridges allowlisted and evidence-reviewed per signal; do not generate novel mechanisms from raw answers. Use dimension-specific safe rich-text parts, never HTML.
13. Positive `3/3` rows state the supporting neutral observations and the useful maintenance implication without inventing a weakness.

This direct ownership pass replaces the earlier combinatorial explanation optimizer. With nine explicit dimensions, one primary anchor per active row, sibling suppression, a three-fact cap, and a two-sentence copy contract, a deterministic ordered pass is sufficient and easier to audit.

### Meaning of the stored plan focus

“Locked plan” is the repository's internal name for the plan artifact prepared and stored after the quiz. It contains the actual product cards, derived care needs, product order, and routine guidance. Its “focus” is the ranked hair topic used as the primary message and as input to those existing builders. It is not another score shown on the offer.

## Scope and non-goals

### In scope

- Add the reusable nine-dimension assessment contract and deterministic evaluator.
- Change the personal-plan concern vocabulary to distinguish moisture/surface and breakage/split ends.
- Persist concern-specific recurrence so it can act as a tie-breaker.
- Use the assessment to select and segment the three public diagnostic rows.
- Prepare concise allowlisted explanation parts from the exact evidence trace.
- Store the complete assessment privately in the existing `diagnostic_scores` JSONB field as a versioned shape such as `{ modelVersion: "hair_assessment_v1", dimensions: [...] }` for later product reuse.
- Version and parse the new public offer model while preserving attached legacy artifacts.
- Update the offer diagnosis section to the reviewed copy hierarchy and shared transition.

### Non-goals

- Do not replace the legacy `hair-potential.ts` model for other guided-story funnels.
- Do not add an in-product assessment screen in this change.
- Do not redesign product-selection logic or category rules, billing, checkout, pricing, analytics milestones, emails, entitlement, or offer ordering. If shared focus is chosen, the new assessment may change the priority input passed into the existing plan builders.
- Do not infer hair problems from goals, texture, density, thickness, commercial admissions, or free text.
- Do not expose raw answers, point weights, recurrence metadata, private assessment data, detailed scalp state, or formulas on bearer-style result URLs.
- Do not add length retention, build-up, color protection, porosity, or hair-loss dimensions.
- Do not add a database migration or backfill; old `diagnostic_scores` values remain in their legacy shape, new rows use the versioned assessment shape, and old public models remain parseable.

## Target map

- `src/lib/hair-assessment/model.ts` (new): neutral dimension IDs, evidence roles/weights, rule table, evaluator, derived priority, segment mapping, and deterministic selection; no React or public German copy.
- `src/lib/personal-plan-quiz/assessment-adapter.ts` (new): translate versioned personal-plan answers and exact concern recurrence into the neutral assessment input.
- `src/lib/personal-plan-quiz/types.ts`: new concern IDs, durable concern recurrence, and quiz-version update.
- `src/components/personal-plan-quiz/quiz-data.ts`: revised concern labels/descriptions and goal-to-dimension metadata if needed.
- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`: persist the recurrence subject and remove recurrence from purely ephemeral state.
- `src/lib/personal-plan-quiz/{draft,persistence,server-draft}.ts`: preserve and validate the versioned new answer fields; define safe handling for resumable legacy drafts.
- `src/lib/personal-plan-quiz/flow.ts`: derive the recurrence subject and retain conditional conflict behavior without treating admissions as evidence.
- `src/lib/personal-plan-quiz/prepared-plan.ts`: use the new assessment for diagnostic rows, store it privately, prepare public explanations, and leave locked-plan product construction on the current compatibility path.
- `src/lib/personal-plan-quiz/offer-adapter.ts`: adapt the revised concerns for the unchanged downstream locked-plan helpers without reintroducing the old three-concern truncation into assessment rows.
- `src/lib/personal-plan-quiz/profile-summary.ts`: migrate the user-visible profile focus away from removed combined concern IDs.
- `src/lib/personal-plan-quiz/diagnostic-explanations.ts` (new): allowlisted labels, signal ownership/deduplication, dimension templates, and safe rich-text parts.
- `src/components/personal-plan-offer/types.ts`, `src/components/personal-plan-offer/model.ts`, and `src/components/personal-plan-offer/personal-plan-offer.tsx`: versioned public row parsing and rendering with legacy fallback.
- `src/app/labs/offer-page/page.tsx`: real-builder assessment fixture and legacy public-model fixture.
- Focused tests in `tests/personal-plan-quiz.test.ts`, `tests/personal-plan-prepared-plan.test.ts`, `tests/personal-plan-offer-page.test.tsx`, plus a new assessment matrix test if clearer.

## Designed user journey

Status: **revised mockup, designed journey, and five-profile dry run approved; implementation authorized**.

1. A person completes the personal-plan quiz. The current-problems screen offers separate, recognizable concerns for dryness, surface/frizz, shine, breakage, split ends, tangling, definition, and volume; scalp is handled by its dedicated later questions.
2. If the recurrence screen appears, it names one exact selected concern and saves both that concern and the frequency answer.
3. The preparation step evaluates all nine dimensions from the durable answers. Goals influence only which active topics are prioritized; they do not make the current state appear worse.
4. The three active dimensions with the strongest priority are selected, subject to the Oberfläche/Glanz sibling rule. Haarbruch and Spliss may both appear only when both were explicitly selected.
5. If the person has fewer than three active needs, remaining rows describe genuine positive observations using maintenance language.
6. On `/result/<leadId>`, the existing hero, imagery, row graphic, pricing, checkout, and offer order remain unchanged.
7. Each row shows the current 1–3 segment state against the three-segment goal. No percentage or formula is shown.
8. Beneath the graphic, at most two short sentences and 28 words name up to three relevant current-state answers in bold and explain what each contributes to the dimension. The copy adds a causal bridge or practical implication only when it teaches something beyond the answer and graphic; it never restates “viel Potenzial” or announces a plan focus. Goals and recurrence stay out of this explanation. The same supporting answer is not repeated across rows when it already belongs more directly elsewhere.
9. A scalp row uses cosmetic, non-diagnostic language and never exposes detailed scalp data or free text in the public artifact.
10. After the rows, one shared reassuring message transitions into the plan.
11. Existing attached `personal_plan_offer_v1` artifacts continue rendering their stored rows and summaries. Malformed optional v2 explanation data fails closed to a safe summary.
12. The private prepared artifact retains the complete assessment for future product consumers; the public result model contains only the selected rows and allowlisted copy parts.

Completion state: the person can see which answers drove each row, understands why those three topics were chosen, and proceeds to the plan without being shown fake precision.

## Mockup evidence

- Artifact: `plans/mockups/2026-07-31-personal-plan-score-explanations.html`
- Complete copy catalogue: `plans/mockups/2026-08-01-personal-plan-score-copy-catalogue.html`
- Five-profile real-completion dry run: `plans/mockups/2026-08-01-five-completed-quizzes-score-dry-run.html`
- Confirmed visual direction: existing segment graphic, concise integrated paragraphs, bold selected answers, no chips/checkmarks, and one shared positive transition.
- Architecture feedback incorporated: remove percentage logic; separate Glanz from Oberfläche internally; make Kämmbarkeit independent; split Haarbruch and Spliss; use at most three answer facts.
- Copy feedback incorporated on 2026-08-01: explain the causal role of each selected current-state answer; make reinforcing context such as Blondierung teach why the issue deserves extra attention; do not repeat the visible potential band or announce a plan focus; omit goals and recurrence; keep the copy to two concise sentences.
- Catalogue audit incorporated on 2026-08-01: remove synonym-only direct anchors, generic scalp placeholders, public scoring/method caveats, and copy that undermines the stretch observation. Every remaining sentence must teach a relationship, distinction, or practical implication.
- Follow-up simulated-user review on 2026-08-01 found the revised direction substantially clearer and user-centered. Its remaining wording findings (`Signal`, `Verstärker`, abstract `Relevanz`, and stretch-method commentary) were removed from the public variants.
- Pre-implementation data dry run on 2026-08-01: five uniformly random attached completions were sampled from a population of 368. No lead identity or result URL was queried; the mockup retained only assessment-relevant structured fields and discarded free text and all unrelated answers. One legacy combined breakage/split answer is presented as two explicit branches instead of guessed.
- Dry-run feedback incorporated on 2026-08-01: apply the Oberfläche/Glanz sibling rule after positive filling as well; use smooth surface only as zero-weight Glanz context; replace vague “Komfort” and “Anordnung der Haaroberfläche” wording with plain descriptions of tightness, mild cleansing, hair feel, and visible reflection.
- Original mockup direction: confirmed by Nick on 2026-07-31.
- Revised mockup content and complete explanation catalogue: **confirmed by Nick on 2026-08-01**.
- Added for review: representative `2/3`, positive/maintenance `3/3`, and attached legacy-v1 fallback variants alongside the actionable `1/3` example.
- Added for exhaustive review: every direct anchor, observation-only variant, reinforcing context, positive-fill sentence, texture-specific definition/volume variant, and representative composition. The catalogue lists reusable sentence blocks instead of duplicating every mechanical combination.

## Ordered tasks

### 1. Version and clarify the quiz inputs

- Add failing type, persistence, draft-resume, validation, and flow tests for the revised concern IDs and durable concern recurrence.
- Update the concern choices and remove broad scalp duplication.
- Bump the submitted quiz schema from `2` to `3`, the browser/server draft schema from `3` to `4`, and the browser storage key from `v3` to `v4`; reject/restart incompatible unfinished drafts instead of remapping the combined breakage/split-ends answer.
- Sweep every concern-ID consumer, including profile summary, flow, draft sanitization/schema, persistence, offer adapter, prepared plan, fixtures, and tests.
- Preserve old attached result artifacts unchanged.
- Ensure goals retain their current user meaning and only map to rank bonuses after a dimension is active.

Completion criterion: the quiz can collect each confirmed concern independently, round-trip the exact recurrence subject through browser and server drafts, submit without a preparation `400`, and restart rather than accept stale/ambiguous concern values into the new assessment.

### 2. Build the canonical assessment test-first

- Add a table-driven failing suite for every signal/weight, cap, activation rule, goal bonus, recurrence tie-break, sibling rule, and segment mapping.
- Implement the neutral evaluator with one shared weight vocabulary and no family-specific hidden scoring formula.
- Assert texture, thickness, density, goals alone, commercial admissions, and unsupported context cannot worsen evidence.
- Assert identical answer sets produce byte-stable ordered assessments.

Completion criterion: the nine-dimension matrix is exhaustive and deterministic, with no 40–100 values or legacy priority truncation in the new model.

### 3. Integrate assessment selection into artifact preparation

- Adapt the revised quiz answers directly into the canonical assessment.
- Select the three diagnostic rows from the new assessment.
- Store all dimension results privately in the existing `diagnostic_scores` JSONB field using the explicit `hair_assessment_v1` discriminator and project only the selected rows publicly.
- Keep legacy guided-story scoring available to other funnels and keep the current locked-plan helpers operational through an explicit compatibility seam.
- Limit this change to the personal-plan offer rows. Do not change the existing locked-plan focus, stored products, routine, or downstream priority helpers. Keep the private assessment reusable so a later redesign can deliberately adopt the same model.
- Test representative profiles including dryness/shine/tangling, separate breakage and split ends, scalp concerns, goal tie-breaks, recurrence tie-breaks, Oberfläche/Glanz competition, and positive fill rows.

Completion criterion: diagnostic rows, segments, and explanations derive from one assessment result, while existing downstream locked-plan output remains stable.

### 4. Compose and protect public explanations

- Build deterministic signal ownership and choose up to three public facts per row. A shared signal belongs to the highest-priority row where it is primary; if it is primary nowhere, it belongs to the highest-priority active row. Later rows skip it.
- Keep public explanation templates limited to current-state evidence; goal relevance and recurrence stay private because they affect selection, not the displayed band.
- Maintain an allowlisted, evidence-reviewed causal bridge for every supporting signal used in copy; test that a supporting treatment is phrased as a possible contributor rather than proof of damage.
- Reject public fragments that only paraphrase the selected answer, discuss scoring confidence, or expose method limitations; combine scalp facts only through reviewed pair-specific relationships.
- Enforce the reviewed maximum of two sentences and 28 words for new explanations.
- Emit bounded `{ kind: "text" | "answer", text }` parts and reject unknown signal IDs.
- Abstract medically adjacent scalp evidence and exclude free text, raw quiz payloads, private scores, and commercial admissions.

Completion criterion: every selected row has coherent, truthful copy within the two-sentence/28-word limit or a safe legacy summary; snapshot/matrix tests prove no unsupported or duplicated claim is emitted.

### 5. Render the reviewed diagnosis section

- Parse both public offer model versions and fail closed on malformed optional v2 copy.
- Render answer parts with `<strong>` and preserve the existing responsive segment graphic.
- Apply the reviewed headline/intro and shared green transition.
- Do not render pills, checkmarks, percentages, formulas, or per-row algorithm labels.

Completion criterion: the lab matches the revised reviewed mockup at mobile and desktop widths, and a legacy artifact remains unchanged.

### 6. Verify the full bounded journey

- Run focused deterministic tests, then the proportional repository verification required by `implementation-loop`.
- Inspect real-builder lab fixtures for every important row family, sibling competition, goal/recurrence tie-break, positive fill, long German wrapping, and legacy fallback.
- Confirm the public artifact contains no private assessment or sensitive answer data and the result route still selects only `public_offer_model`.
- Run `ready-check` and `request-code-review` through `implementation-loop` before any review-ready handoff.

Completion criterion: automated and browser evidence prove the quiz, assessment, offer projection, legacy fallback, privacy boundary, and downstream compatibility all behave as approved.

## Verification

### Automated

- focused assessment matrix tests;
- `npx tsx --test tests/personal-plan-quiz.test.ts`;
- `npx tsx --test tests/personal-plan-prepared-plan.test.ts`;
- focused explanation tests;
- `npx tsx --test tests/personal-plan-offer-page.test.tsx`;
- affected draft/server-draft tests;
- legacy `hair-potential` and guided-story suites as compatibility guards;
- `npm run test:node` and `npm run ci:verify` in proportion to the final diff.

### Manual/browser

- Start the task worktree with `npm run dev:worktree`.
- Review the changed concern screen, recurrence screen, loading/preparation path, and result offer at mobile and desktop widths.
- Verify goals change row priority but never the visible current segments.
- Verify the example profile produces Kämmbarkeit, Glanz, and Feuchtigkeit with the reviewed explanations.
- Verify separate Haarbruch/Spliss profiles, Oberfläche/Glanz sibling behavior, scalp abstraction, positive fill, and legacy public-model fallback.
- Review every allowlisted public sentence in the complete copy catalogue; verify composed outputs remain within two sentences/28 words and that each reinforcement teaches a bounded causal relationship.

### Data/privacy

- Inspect serialized public model fixtures and assert absence of the full assessment, raw answers, recurrence object, free text, detailed scalp state, email, name, products, and routine.
- Confirm old public artifacts remain parseable without migration or regeneration.

### Evidence-sensitive review

- Treat the score as deterministic product prioritization, not a scientific or diagnostic measurement.
- Do not let the home stretch observation diagnose moisture/protein balance or let treatment alone prove damage.
- Use bounded language such as “spricht dafür” and “zeigt uns”; route persistent or medically adjacent scalp/hair-loss signals outside cosmetic certainty.

## Review and handoff

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-score-explanations`
- Branch: `codex/personal-plan-score-explanations`, refreshed to `origin/main` at `a8131d7c` before this revision.
- Scoring architecture: confirmed by Nick on 2026-08-01.
- Original mockup direction: confirmed.
- Revised mockup content and copy catalogue: confirmed on 2026-08-01.
- Exact revised quiz wording: confirmed with the completed mockup and journey on 2026-08-01.
- User-journey sign-off: confirmed by Nick on 2026-08-01; the requested five-profile dry run was also reviewed and approved before implementation.
- Counterpart review: completed read-only against fresh `origin/main` on 2026-08-01; verdict **approve with revisions**. Verified findings are reconciled below, with product decisions left explicit.
- Planning artifacts: retain the plan, offer mockup, and complete copy catalogue and commit them with the eventual implementation if approved.
- Implementation authorization: confirmed by Nick on 2026-08-01 after the designed journey and five-profile dry run.
- Publication stop point: implementation approval does not authorize commit, push, PR, merge, deployment, migrations, or production writes.

Residual risks:

- Changing concern IDs affects unfinished drafts and versioned submissions; legacy behavior must be explicit rather than silently remapped into false precision.
- Incompatible unfinished pre-change drafts will restart after the version bump; this is deliberate but should be verified as a clean recovery path.
- The offer assessment and existing locked-plan priority helpers intentionally remain separate in this change. A later downstream redesign must adopt the assessment explicitly rather than inheriting it accidentally.
- The current recurrence screen chooses one concern from a deterministic option order rather than asking which issue matters most; it can only influence that exact recorded concern.
- A `+0.5` goal bonus can change which three active rows appear, so fixtures must prove it never changes visible evidence bands.
- Offer simplicity depends on preventing one shared support signal, especially rough surface, from being repeated across several rows.

## Counterpart findings ledger

The fresh Claude review returned **approve with revisions**. Codex verified each material finding against the refreshed repository:

- **Accepted — hidden concern-ID consumer:** `profile-summary.ts` is now an explicit target, and task 1 requires an exhaustive consumer sweep.
- **Accepted — unnamed private storage:** use the existing private `diagnostic_scores` JSONB field with a versioned `hair_assessment_v1` shape; no migration or backfill.
- **Accepted — strict legacy drafts:** bump submission and draft versions together and restart incompatible unfinished drafts instead of guessing whether a combined answer meant Haarbruch or Spliss.
- **Resolved — offer versus plan ownership:** this change owns only the offer-page assessment. Existing locked-plan focus remains unchanged; the stored private assessment is reusable for a later downstream redesign.
- **Resolved — rollout seam:** immediate cutover for newly prepared personal-plan offer artifacts; no dedicated server-side assessment flag.
- **Accepted — shared-support ownership:** the highest-priority primary owner wins; otherwise the highest-priority active row wins.
- **Accepted — incomplete state coverage:** add `2/3`, positive `3/3`, and attached legacy-v1 fallback variants to the mockup before journey sign-off.
- **Accepted — target suffix accuracy:** list `.ts` and `.tsx` component targets explicitly.

## Decisions before journey sign-off

1. **Assessment ownership — resolved on 2026-08-01.** The new assessment computes the three offer-page rows and is stored privately for later reuse. This implementation does not change existing locked-plan priorities or downstream plan output.
2. **Rollout seam — resolved on 2026-08-01.** Newly prepared personal-plan offers use the new assessment immediately. No dedicated assessment safety switch is added; attached legacy offer artifacts continue rendering unchanged.
