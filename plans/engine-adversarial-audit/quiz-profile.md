# Adversarial audit: quiz → hair profile (central user facts)

Audit date: 2026-10-09. Branch: `codex/engine-adversarial-audit`, based on main `746bf6df`. This is a read-only audit; no `src/` changes were made.

Test file: `tests/audit-quiz-profile-rules.test.ts`. Tests in the `contradictions` suite are expected to fail. Tests in the `verified` suite are expected to pass.

```
cd /Users/nick/AI_work/hair_conscierge/.worktrees/engine-adversarial-audit && node --import ./tests/server-only-register.cjs --import tsx --test tests/audit-quiz-profile-rules.test.ts
```

Result on 2026-10-09: `# tests 21 · pass 12 · fail 9`. All 9 failures are assertion failures for the stated reason. None is a crash.

**Doc abbreviations**

| Short | File |
| --- | --- |
| FLOW | `docs/chaarlie-flow-specs.md` (stale: 7 questions, legacy values) |
| CIO | `docs/customerio-data-contract.md` |
| H | `plans/2026-09-15-care-habits-source-of-truth.md` |
| K | `plans/2026-09-30-central-user-profile-clean-switch.md` (Nick 2026-09-30; overrides H where they conflict) |
| CS | `plans/2026-08-02-personal-plan-computation-spec.md` |

**Production paths traced**

1. Personal-Plan v3 quiz (the primary path):
   - Answers become the envelope in `personal_plan_prepared_artifacts`.
   - `projectArtifactToFacts` turns the envelope into `DiagnosticsV1`.
   - The DiagnosticsV1 is written through `user_facts_save_v1` by `writeAccountLinkFacts`.
   - That write derives the legacy `hair_profiles` columns. Their TypeScript reference implementation is `deriveDiagnosticsColumns`.
   - The legacy columns feed `recommendation-engine/normalize.ts`: chat, routine and care-balance read `scalp_condition`, `concerns`, `goals`, `chemical_treatment` from there.
   - Stage-1 builds `PlanProfile` from the raw envelope via `buildPlanProfile`.
2. Legacy (regular) quiz lead:
   - `linkQuizToProfile` (both the direct path and the e-mail fallback) calls `projectLegacyLeadToFacts`.
   - That runs `buildLegacyQuizStage1Source`, then `canonicalizeQuizAnswers` / `normalizeStoredQuizAnswers`, then `adaptLegacyQuizAnswersForAssessment`.
   - The result is written through the same door.
3. Returning lead, "Edit" from e-mail:
   - `api/quiz/email-return/choose/route.ts:100` calls `projectQuizEmailReturnPrefill`.
   - That calls `adaptPersonalPlanAnswersForOffer` to prefill the regular quiz.
   - Re-submitting creates a new lead. That lead is the latest quiz, so it wins under K:29.
4. Backfill of legacy columns: `legacyColumnsToDiagnostics` turns the old columns into DiagnosticsV1, which then derives the columns again.

The old onboarding flow was not audited, because it is obsolete.

## (a) Rule inventory

| ruleId | Rule | Citation | Status |
| --- | --- | --- | --- |
| quiz.hair_texture.1 | The structure answer (straight/wavy/curly/coily) maps to `texture` / `hair_texture`. It never maps to thickness. | FLOW:55-61, CIO:74, H:57 | holds (all 4 projectors, 36 combos) |
| quiz.thickness.1 | The diameter answer (fine/normal/coarse) maps to `thickness`. It never maps to texture or density. | FLOW:71-81, CIO:76 | holds |
| profile.density.1 | `density` is separate from `thickness`. | H:57, CIO:78 | holds |
| profile.defaults.assumed.1 | Only two completeness defaults exist: density → medium and hair length → long. Both are marked `assumed`. | K:34-35 | holds |
| profile.defaults.none.1 | No other field is ever defaulted, and no unanswered field is replaced by a neutral answer. | K:35, CS:59, CS:200 | contradicted (quiz.scalp.issue_unknown_condition.1, quiz.prefill.no_invented_goals.1) |
| profile.scalp.diagnostics.1 | Diagnostics and Stage-1 keep the full multi-select `scalpConcerns[]`. | CS:362, CS:408-411 | holds |
| profile.scalp.legacy_column.priority.1 | The `scalp_condition` column is a priority pick: irritated > oily_dandruff > dry_dandruff, none → null. | H:61 | holds as written (the limitation is NR1) |
| profile.scalp.empty.1 | An explicit `[]` means "no scalp concern". Absent means unknown. | CS:413 | contradicted (quiz.scalp.legacy_dry_flakes.1, quiz.scalp.issue_unknown_condition.1) |
| quiz.scalp.legacy_dry_flakes.1 | The legacy `trocken` answer ("Trocken / Schuppen") means dry scalp plus dry flakes. | FLOW:139, CS:406 | contradicted |
| quiz.scalp.legacy_oily_dandruff.1 | The legacy `fettig_schuppen` answer means oily scalp plus oily dandruff. | FLOW:140 | holds |
| quiz.legacy.pulltest.1 | The same-era German pull-test values are still read. | FLOW:116-121 | holds |
| quiz.goals.legacy_slugs.1 | Same-era legacy goal slugs (`kein_volumen`, `glanzlos`, …) still convert through table M. | FLOW:177-187, K:39-48, diagnostic-input.ts:43 | contradicted (low confidence) |
| profile.chemical.natural_exclusive.1 | "Naturhaar" is exclusive of every chemical treatment. | quiz-data.ts:533, validators.ts, quiz-answers.ts header, CS:518 | contradicted |
| profile.concerns_goals.empty_not_null.1 | When the facts are absent, the derived `concerns`, `goals` and `chemical_treatment` are `[]`, not null. | K:56 | holds |
| profile.concerns_goals.lossless.1 | Selected concerns and goals are never truncated or invented. | CS:57-59, H:15, K:56 | contradicted on the e-mail-return prefill path |
| profile.primary_concern.1 | A sole concern with no pick becomes the main problem. Several concerns with no pick give no main problem. | K:78, primary-concern.ts (F1.2) | holds |
| profile.goals.legacy_conversion.1 | Table M goal conversions apply, for example Farbschutz → Glanz and Gesünderes Haar → Kräftigung. | K:39-47, K:54 | holds |
| profile.goals.volume.1 | The stored legacy volume direction is kept for existing profiles. | K:48 | holds |
| quiz.goals.volume_tie.1 | One lead resolves to one volume direction in every reader. | K:48, CIO:62 | contradicted (low confidence) |
| profile.concerns.legacy_conversion.1 | The legacy concern Schuppen moves to the scalp answer, and thinning becomes hair loss. | K:50-51 | holds (NR4 covers the side effect) |
| profile.concerns.v2_combined.1 | The v2 combined concern projects the same way in every reader. | CS:61, K:54 | contradicted (which side is correct is NR5) |
| quiz.concerns_other_text.wellformed.1 | Free text is cut to 50 characters and stays well-formed. | project-legacy-lead.ts:73-83, CIO:105 | contradicted |
| quiz.assessment.legacy_structure.1 | The legacy-to-assessment adapter maps `structure` to `texture`. | CIO:74 | holds |
| cio.pp_namespaced.1 | Personal-Plan scalp concerns go to Customer.io as an array (`personal_plan_scalp_concerns`). | CIO:139-157 | holds (by reading `personal-plan-quiz/customerio.ts:212-214`; not tested) |
| cio.value_vocab.1 | The legacy Customer.io traits keep the legacy vocabulary, which comes from `projectQuizAnswersToLegacyVocabulary`. | H:65, P3:16-17 | holds (existing tests cover it) |

Counts: 25 rules. 15 hold, 9 are contradicted, and 1 holds only as written while depending on a ruling (the scalp priority rule). On top of these there are 8 needs-ruling items.

## (b) Contradictions

### 1. quiz.prefill.lossless_concerns.1

Severity P1, confidence medium.

**Example.** A Personal-Plan member picked six problems. She comes back by e-mail and taps "Edit". The regular quiz shows only three of them (Strapaziert, Spliss, Haarbruch). If she submits, her profile loses Trockene Längen, Frizz and Verknoten.

| | |
| --- | --- |
| Expected | All six concerns survive. CS:57-59, H:15 ("capped at 3" is listed as a defect), K:29 (the latest quiz replaces the facts). |
| Observed | Only 3 concerns survive. `src/lib/quiz/email-return-prefill.ts:54` calls `src/lib/personal-plan-quiz/offer-adapter.ts:182` (`ordered.slice(0, 3)`). |

### 2. quiz.prefill.no_invented_goals.1

Severity P1, confidence medium.

**Example.** She chose only the goal "Mehr Glanz", but has an oily scalp and has problems with breakage and split ends. The edit prefill pre-selects "Ausgeglichene Kopfhaut" and "Weniger Haarbruch und Spliss" as goals she supposedly chose. On re-submit these become `healthy_scalp` and `anti_breakage` in `hair_profiles.goals`, and so change what the engine recommends.

| | |
| --- | --- |
| Expected | Goals are exactly `[shine]`. K:56 ("see only the goals they picked"), CS:59. The existing test title at `tests/quiz-email-return-journey.test.ts:47` is "does not prefill adapter defaults". |
| Observed | `[scalp_balance, shine, strength_ends]`, inferred in `offer-adapter.ts:215-260` (`retainGoals`). |

### 3. quiz.scalp.legacy_dry_flakes.1

Severity P1, confidence medium.

**Example.** A February-2026 legacy lead answered "Trocken / Schuppen". After she links an account, her facts say "dry scalp, no scalp concern". Her dry flakes are gone, and the `[]` is a positive claim that she has no concern.

| | |
| --- | --- |
| Expected | `scalpOiliness: dry`, `scalpConcerns: ["dry_dandruff"]`. FLOW:139, CS:406. The parallel case `fettig_schuppen` is already mapped to both halves. |
| Observed | `scalpConcerns: []`. `src/lib/quiz/normalization.ts:182-184` maps it as type only with `has_scalp_issue: false`. |

Reach: leads captured from 2026-02-13 to 2026-02-17 (git `907c0ae3` to `eb732028`) that are still unlinked or are re-projected.

### 4. quiz.goals.legacy_slugs.1

Severity P1, confidence low.

**Example.** A Feb/March-2026 legacy lead chose "Kein Volumen" and "Glanzlos". Once linked, she has no goals at all.

| | |
| --- | --- |
| Expected | `goals [shine, volume_balance]`, `volumeDirection: more`. This follows the removed `GOAL_SLUG_MAP` (git `02a16a59`), table M (K:39-48), and `diagnostic-input.ts:43`, which says this is the rule for legacy leads. |
| Observed | `goals: []`. `normalization.ts:115` drops unknown slugs. The same normalizer still maps the same-era pull-test values, so the drop is inconsistent rather than a deliberate cut-off. |

Open question: whether the production `leads.quiz_answers` were ever rewritten. This needs the database (see gaps).

### 5. profile.chemical.natural_exclusive.1

Severity P2, confidence medium.

**Example.** A client that is not the quiz UI submits "Naturhaar" together with "Gefärbt". The server accepts it, and `hair_profiles.chemical_treatment` becomes `["colored","natural"]`.

| | |
| --- | --- |
| Expected | The answer is rejected, or `natural` is dropped. The UI sets `exclusiveValue` at `quiz-data.ts:533`, the legacy validator rejects the combination, and `quiz-answers.ts` shows the pair without `natural`. |
| Observed | `src/lib/personal-plan-quiz/persistence.ts:49` has no refine. `src/lib/user-facts/derive-legacy-columns.ts:168` maps the values verbatim. |

### 6. quiz.concerns_other_text.wellformed.1

Severity P2, confidence medium.

**Example.** She types 49 letters and then an emoji under "Etwas anderes". The stored note ends in a lone UTF-16 high surrogate.

| | |
| --- | --- |
| Expected | A well-formed string of at most 50 characters. |
| Observed | `"x…x\ud83d"`. The cut happens at `src/lib/user-facts/project-legacy-lead.ts:82` (and the same `slice(0, 50)` at `src/lib/quiz/normalization.ts:101`). |

Whether Postgres `jsonb` then rejects the account-link write is a gap: it needs the database.

### 7. quiz.goals.volume_tie.1

Severity P2, confidence low.

**Example.** A historical lead stored both volume goals, "Weniger Volumen" first. Customer.io and the result narrative say `less_volume`, but the profile column says `volume`.

| | |
| --- | --- |
| Expected | One direction everywhere. K:48. |
| Observed | `normalization.ts:107-110` keeps the first one seen. `project-legacy-lead.ts:104` lets "volume" always win. |

The validator rejects this pair for new leads.

### 8. quiz.scalp.issue_unknown_condition.1

Severity P2, confidence low.

**Example.** A lead says "yes, I have a scalp issue", but the condition value is not in the vocabulary. The facts record "no scalp concern".

| | |
| --- | --- |
| Expected | `scalpConcerns` absent (unknown). CS:200, CS:413, K:35. |
| Observed | `[]`. `offer-adapter.ts:95-104` falls through to `[]`. |

New leads cannot reach this state, because the validator blocks it at capture.

### 9. profile.concerns.v2_combined.1

Severity P2, confidence medium.

**Example.** A v2 Personal-Plan answer "Haarbruch oder Spliss" becomes only `split_ends` in her facts, in Stage-1 and in the `concerns` column. The returning-lead prefill turns the same answer into `breakage` plus `split_ends`.

| | |
| --- | --- |
| Expected | Both readers agree. Which reading is correct is NR5. |
| Observed | `src/lib/personal-plan/input.ts:175` vs `src/lib/quiz/email-return-prefill.ts:40`. |

No P0 finding. The texture/thickness/density mapping holds on all five projectors (verified test 1).

## (c) Needs ruling

**NR1 — single scalp condition.** This is the priority limitation.

Two rules pull against each other:
- H:61 rules that the legacy `scalp_condition` column is one value, chosen by priority.
- CS:362 says the collapsed column "is never authoritative" for the plan. CS:408-411 specifies behaviour for scalp-concern combinations. K:75 makes the editor multi-select.

The plan engine is fine: it keeps the array. But the recommendation engine (`recommendation-engine/normalize.ts:60`, used by `shampoo-cadence.ts`, `care-balance/*`, `categories/shared.ts`, `assessments/reset.ts`) reads only the column.

Every path that needs two values, and what gets dropped:

| Path | Input | Column | Dropped |
| --- | --- | --- | --- |
| v3 quiz | oily_dandruff + dry_dandruff | dandruff | dry_flakes (gentle dry-scalp constraint) |
| v3 quiz | oily_dandruff + irritated | irritated | dandruff (targeted anti-dandruff role) |
| v3 quiz | dry_dandruff + irritated | irritated | dry_flakes |
| v3 quiz | all three | irritated | both dandruff types |
| iOS edit and scanner (`diagnosticsToQuizAnswers`) | same | single `scalp_condition` | same as above |
| Offer adapter (prefill, scanner paid source, `detect-hand-edits`) | same | single `scalp_condition` | same as above |
| Legacy-columns backfill | `scalp_condition` dry_flakes + concern `dandruff` | dandruff | flips to dandruff, see NR4 |

The legacy regular quiz itself is single-select by design, so it never produces two values.

Question for Nick: should the recommendation-engine and scanner inputs read `diagnostics.scalpConcerns[]`, or does the priority pick stay accepted for those consumers? If it stays, which of the combinations above must not be dropped? The strongest candidate is oily_dandruff + irritated, which loses its targeted dandruff role.

**NR2 — "Ausgewogenes Volumen" without a hair-type signal.**
- K:48 says "new answers follow hair type". K:56 says "new plan buyers see only the goals they picked".
- Example: straight, normal thickness, medium density, goal "Ausgewogenes Volumen". `hair_profiles.goals` = `[]` and `desired_volume` = null (`derive-legacy-columns.ts:104-112`, `normalization.ts:302-318`).
- She chose a goal and the engine sees none. The profile UI still shows it from the facts.
- Question: accept the drop, map to a neutral goal, or keep `volume_balance` in the column?

**NR3 — three v3 concerns with no legacy equivalent.**
- H:15 lists "three values never mapped" as a defect of the old profile path. H:61 asks for a "full vocabulary map, no caps".
- Under the new derivation, `low_shine`, `lost_shape` and `low_volume_or_weighed_down` still vanish from `hair_profiles.concerns`. A stated main problem among them gives `primary_concern = null`.
- The old offer adapter at least turned them into goals: shine, curl_definition, volume. K:56 now forbids invented goals.
- Example: concerns `[low_shine, lost_shape]` give `concerns: []` and `primary_concern: null`, so the engine sees nothing.
- Question: widen the column vocabulary, or accept the loss for engine consumers?

**NR4 — table M "Concern Schuppen → scalp answer" names no dandruff type.**
- The backfill always adds `oily_dandruff` (`legacy-columns-to-diagnostics.ts:174`).
- A profile with `scalp_condition: dry_flakes` and concern `dandruff` re-derives to `scalp_condition: dandruff`. A gentle dry-scalp route becomes an anti-dandruff route.
- Question: which type, and should an existing `dry_flakes` stop the oily guess?

**NR5 — v2 `breakage_or_split_ends`.**
- CS:61 says to keep breakage and split ends distinct.
- The F10 hash-stability rule (`project-artifact.ts` header) requires `V2_CONCERN_MAP`, which keeps only `split_ends`.
- Question: is the lost breakage signal accepted for v2 members? If so, the prefill (`email-return-prefill.ts:40`) should match it.

**NR6 — table M merges vs the research levers.**
- K:45-47 merges Farbschutz into Glanz, and Anti-Haarbruch / Stärken / Weniger Spliss / Gesünderes Haar into one goal.
- `docs/research/goal-concern-levers/synthesis.md` (SYN:19-29) gives these different primary levers.
- Example: a "Farbschutz" profile loses the UV / colour-safe / heat-protectant levers.
- Ruled by Nick 2026-09-30, but the research doc disagrees. Should the research doc be updated, or should the merge be revisited?

**NR7 — `has_scalp_issue` is not defined.** CIO:88 lists the trait but never defines it.
- Personal-Plan sends `personal_plan_has_scalp_concern = scalpConcerns.length > 0`.
- The legacy trait comes from the quiz flag.
- Question: should an irritated-only answer count as a "scalp issue"? It does today.

**NR8 — do assumed defaults feed the recommendation engine?**
- K:34 says assumed density and length "never feed a plan calculation".
- The derived columns `density: medium` and `hair_length: long` are nevertheless read by the chat/routine engine (`normalize.ts:49-51`).
- Question: is the recommendation engine a "plan calculation" for this rule?

## (d) Untestable gaps

- **Production lead data.** Whether `leads.quiz_answers` still holds February slugs (`trocken`, `kein_volumen`, `spliss`, `glatt` texture, `fein` thickness) cannot be checked offline. Commit `df24bd6f` says texture leads were rewritten. No migration for goals or for scalp `trocken` is in the repo. This sets the reach of contradictions 3 and 4.
- **Lone surrogate in jsonb.** Whether Postgres rejects the account-link write with the broken note (contradiction 6) needs a database.
- **SQL derivation parity.** `user_facts_save_v1` re-implements `deriveDiagnosticsColumns` in SQL. This audit used the TypeScript reference only. The parity tests live elsewhere (pglite/postgres) and were not re-run.
- **E-mail-return Edit in practice.** Whether users actually re-submit the prefilled answers unchanged (contradictions 1 and 2) needs PostHog funnel data.
- **Customer.io wire values.** These were read from the builders only. No outbound sync was exercised.
