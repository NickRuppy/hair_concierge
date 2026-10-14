# S4 — Bondbuilder routine question, ranking and Aveda schedule (slice plan)

**Status:** Draft Rev. 1 (2026-10-09), implementation-ready apart from the two "Questions for Nick". Read-only research against worktree HEAD `57ae223f` (= `origin/main` `320940f4` incl. #654/#655 + S1 T1.1) and prod (SELECT, aggregate only).
**Rulings consumed:** `decisions.md` S2, B1, D-b, X1, D-h; plan §8b S4, §11 F10/F11. Mockup: `mockups/mockup-1-bondbuilder-preference.html`.
**Ships as:** its own PR from `.worktrees/s4-bondbuilder` (branch `codex/s4-bondbuilder`, base `origin/main`). S4 touches no S1 data row and no S1 code file (S1 code = `categories/leave-in.ts`), so it does not wait for S1.

---

## Integration contract — updated S2 into S4 (2026-10-13)

Coverage is confirmed by Nick's explicit ruling on 2026-10-13: retain S4 timing, late-question assumptions, timing-unmet notes and damage-branched Aveda cadence. Ranking is verdict → reviewed technology trust → timing → capped budget → price ascending → catalogue order → id. K18's house default is retired. Q1's catalogue-first tie order is superseded: equally trusted and equally timed products rank cheapest first, with the others shown as equal options. Shared budget-role ranking and native ordering remain. Incoming S2/main supplies the fit evaluator, technology gates and current refinement/Hair Tools machinery. No unresolved product decisions.

Lena, damaged hair with no timing preference: all three high-trust products fit, so OLAPLEX No.3PLUS (€34) is selected; Epres (€48) and K18 (€56.25) are equal options. The timing question stays.

Authorized scope: update ranking, regression expectations and these contracts; verify offline. No git add, commit, push, network/DB access or `.env.local` edits. Do not touch parallel-owned dry-shampoo, selection-profile, volume-direction, visible-hair-color or scan dryShampooTarget code. The Aveda migration and frozen fingerprint `92dcb1acf4b736765167ad1f1bdd98cc30307d106d0c07991532f60272fda4f0` are unchanged.

## 0. Historical baseline (verified 2026-10-09; ranking superseded by the integration contract)

**Catalogue (prod, active + recommended Bondbuilders; every `products.sort_order` = 0):**

| Product (id prefix) | trust | `application_mode` / `treatment_mode` | Timing bucket (§2.2) | Price | Protocol cadence today |
|---|---|---|---|---|---|
| OLAPLEX No.3PLUS (`3dc24d67`) | high | pre_shampoo / rinse_out | before_wash | 34,00 € | „Alle ein bis drei Haarwäschen anwenden." |
| Epres Bond Repair (`f8a63590`) | high | pre_shampoo / rinse_out | before_wash | 48,00 € | „Ein- bis zweimal pro Woche anwenden." |
| K18 Leave-In (`38dace91`) | high | post_wash_leave_in / leave_in | after_wash | 56,25 € | label_course |
| L'Oréal Elvital Bond Repair Plus (`e5fd7ff9`) | medium | pre_shampoo / rinse_out | before_wash | 8,95 € | NULL |
| Redken Acidic Bonding (`9e5da870`) | medium | pre_shampoo / rinse_out | before_wash | 25,50 € | NULL |
| Kérastase Première (`2490911e`) | medium | pre_shampoo / rinse_out | before_wash | 56,29 € | NULL |
| OGX Sealing Serum (`2c809d0d`) | low | bedtime_leave_in / leave_in | overnight | 18,68 € | NULL (S1 sets B2) |
| Aveda Botanical Repair (`04a83f16`) | low | pre_shampoo / rinse_out | before_wash | 52,00 € | NULL → S4 (§3) |

**Users (real accounts; test/CI/Nick aliases excluded):**
- Plan heads with a Bondbuilder need (`needTier` basis|optional): 57 — derived `structuralLevel` moderate 6, high 14, severe 37, none/low 0.
- Active routines with a Bondbuilder item: K18 planned 36, OLAPLEX planned 1, OLAPLEX owned 1, none 6; **Aveda in 0 routines**.
- Saved shopping budgets: 0 (flag just turned on). Users reporting an owned Bondbuilder: 3. `does_not_wash`: 1.
- Non-stale refinement drafts whose path would gain the new question (need + not owner + washes wet): **68 complete** (incl. 9 products-projected) + **4 in-progress with the products module already projected** + 4 in-progress before that point.

**Code (worktree HEAD):**
- Authority `src/lib/personal-plan/products/authority/categories/bondbuilder.ts`: trust filter → if >1 most-trusted ideal: K18 only if K18 is in the set, **otherwise `selected = null` (need left uncovered)**.
- Ranking `fit-comparison.ts` `compareBondbuilderTrust`: verdict → trust → K18 pin → shared comparator (`candidate-ranking.ts`: catalog order → price → id).
- Budget `budget-policy.ts`: `trust_pair` mode, `trustTiesByPrice` re-sorts equal-trust runs by price under a cap.
- **#654 parity gaps found** (all fixed in S4 because S4 rewrites the same ordering):
  - G1 `discovery/equal-options.ts` lists every detached-`ideal` candidate (incl. medium/low trust) as „equal".
  - G2 `product-previews.ts` `allocateProposal` builds the Bondbuilder role without `trustRank`/`displayMode: "trust_pair"` (gateway sets both).
  - G3 `scan/resolve-verdict.ts` orders capped alternatives with `orderStandaloneAlternatives`, not the trust pair.
- Refinement: `triggerContext.relevantCategories` = initial snapshot `renderedOrder` (= categories with tier basis|optional). Every persisted **complete** draft is re-checked by `createStage2RefinementSession`, which **throws** when the canonical path is incomplete → adding a required question breaks Feinschliff load for the 68 complete drafts unless handled (§1.6).
- Cadence: `routine/cadence.ts` resolves Bondbuilder copy only from `label_course|label_schedule|frequency|weekly_range|wash_event`; unknown kind → „Nach Herstellerangabe" + gap. Call sites: compiler (`routine-candidate-compiler.ts` L307, has `refinedNeedSnapshot`) and successor sync (`routine/source-sync-service.ts` L183, payload only). Routine payload `cadence` object is zod `.strict()`.

---

## 1. Refinement question

### 1.1 Identity
| Item | Value |
|---|---|
| Question id (`Stage2StaticQuestionId`) | `bondbuilder_timing` |
| Answer key (`PersonalPlanRefinementAnswersV1`) | `bondbuilderTiming?: BondbuilderTiming` |
| Vocabulary (`refinement/types.ts`) | `BONDBUILDER_TIMINGS = ["before_wash", "after_wash", "no_preference"] as const` |
| UI copy (X1, approved) | Title „Wann passt der Extra-Schritt?"; options „Vor dem Waschen" — „Einwirken lassen, dann waschen." / „Nach dem Waschen" — „Drin lassen, nicht ausspülen." / „Ist mir egal" (no description, no icon — mockup `.opt.noicon`). No lead line (mockup has none). No overnight option. |
| Module | `products` (`STAGE2_QUESTION_MODULE_BY_ID`) |
| Telemetry | existing `personal_plan_stage2_question_viewed/answered` events; `getQuestionFamily` falls through to `conditional_context` (dry-shampoo precedent); section `current_products`. No new event, no answer value in telemetry. |

### 1.2 Gating predicate (single source: the Stage-1 decision)
`isBondbuilderTimingOnPath(triggerContext, answers)` in `question-path.ts`:
```
triggerContext.relevantCategories.includes("bondbuilder")      // Stage-1 bondbuilder needTier basis|optional (renderedOrder)
&& !(answers.currentProductCategories ?? []).includes("bondbuilder")   // owner: the plan keeps her product, recommends none
&& answers.wetWashFrequency !== "does_not_wash"                 // „vor/nach dem Waschen" is meaningless without a wet wash
```
No new trigger-context field: `relevantCategories` already carries the decision, and it is derived from the initial snapshot the draft is based on, so it is stable per draft and recomputed by the facts rebase (`rebase-projection.ts` → `deriveStage2TriggerContext(newInitial)`). The refined projection cannot change the Bondbuilder tier (it reads only chemical treatments, concerns, elasticity; heat only feeds reasons), so "need at question time" = "need in the refined plan".

### 1.3 Placement
`getOrderedQuestionIds`: `["current_product_categories", "wet_wash_frequency", "bondbuilder_timing"?, "scalp_irritation_detail"?, …]` — i.e. pushed immediately after `BASE_QUESTION_IDS`, before the scalp/dry-shampoo/oil conditionals.

### 1.4 Validity, save, prune
- `isStage2QuestionAnswerValid("bondbuilder_timing")` = `isOneOf(answers.bondbuilderTiming, BONDBUILDER_TIMINGS)`.
- `session.ts replaceQuestionAnswer`: `case "bondbuilder_timing": next.bondbuilderTiming = answer`.
- `pruneStage2Answers`: `remove("bondbuilderTiming")` when the predicate is false (need gone after a facts rebase, user now reports owning a Bondbuilder, or `does_not_wash`). `completedQuestionIds` drop the id via the existing active-path filter.
- Pruning never erases `care_habits.bondbuilderTiming` (absent patch field = keep, documented precedent in `from-refinement-draft.ts`); if the need returns, `knownCareAnswers` re-seeds the stored user answer.

### 1.5 Assumed default
`assumed-defaults.ts`: `STAGE2_ASSUMED_BONDBUILDER_TIMING = "no_preference"`, rule `assume:bondbuilder_timing:no_preference` appended to `STAGE2_ASSUMPTION_RULE_IDS` / `STAGE2_ASSUMPTION_RULES`, `STAGE2_ANSWER_KEY_BY_QUESTION_ID.bondbuilder_timing = "bondbuilderTiming"`.
- condition: "Stage-1 Bondbuilder need, user does not report an owned Bondbuilder, washes wet".
- rationale: "`no_preference` is the only value that leaves today's selection untouched (trust tier, then cheapest first); assuming a timing would silently swap the product the Idealplan showed." Direct acceptance and Stage-1 previews therefore agree on the cheapest equal-trust pick.

### 1.6 Drafts that already passed this point (68 complete + 4 products-projected)
Without handling, `stage2SessionFromPersistedDraft` throws for all of them. Rule (Proposal P4): a persisted draft that is `complete`, or `in_progress` with `module_projections.products`, and whose only unresolved path ids are in `STAGE2_LATE_ADDED_QUESTION_IDS = ["bondbuilder_timing"]`, is normalized on read with the assumption rule (answer `no_preference`, provenance `assumed`, id appended to `completedQuestionIds`). Implemented once as `normalizeLateAddedQuestions(draft, triggerContext)` in `refinement/assumed-defaults.ts` and called at every reader that rebuilds a contract from a persisted draft:
`persistence/stage2-refinement-supabase.ts` (`mapDraft`), `persistence/refinement-status-read.ts`, `persistence/stage2-optional-entry.ts` (both trigger-context sites), `facts-recompute/rebase-projection.ts` (already resolves via `resolveAssumedAnswers` for complete sources — assert), `scan/scanner-context.ts` (already resolves — assert), `refinement/module1-stage3-resume.ts`, direct-acceptance draft recognition (`direct-acceptance/accept.ts`).
The persisted refined versions are untouched: their answers lack the key, which projects to "no preference" — the same behaviour the normalized value produces. Users can still change it via the Feinschliff edit entry (completed questions are editable, `saveStage2SessionAnswer`). In-progress drafts before the products module simply meet the question in order.

### 1.7 Storage (`care_habits`)
- `src/lib/user-facts/schema.ts` `careHabitsV1Schema`: `bondbuilderTiming: z.enum(BONDBUILDER_TIMINGS).optional()` (schema is `.strict()`; no SQL change — `user_facts_save_v1` merges any `care_habits` key; `derive-legacy-columns` ignores unknown keys).
- `src/lib/user-facts/from-refinement-draft.ts` `CARE_HABITS_FIELD_BY_STATIC_QUESTION_ID.bondbuilder_timing = "bondbuilderTiming"` (TS forces it). Provenance flows unchanged: `user` when answered, `assumed` from the rule; source kind `feinschliff_draft` (module completion) / `refined_version` (rebase).
- `src/lib/user-facts/known-care-answers.ts`: no code change (generic over the field map); covered by test.
- `src/lib/mobile/profile-service.ts`: label `bondbuilderTiming: "Zeitpunkt Bondbuilder"`, value labels `before_wash: "Vor dem Waschen"`, `after_wash: "Nach dem Waschen"`, `no_preference: "Ist mir egal"` (iOS profile list renders `care_habits`).

### 1.8 Read path to selection (carrier)
- `PlanRoutineContext` (`personal-plan/types.ts`) gains `bondbuilderTiming?: PlanKnowledge<BondbuilderTiming>`; `buildPlanRoutineContextFromCompletedRefinement` sets `{state:"known", value}` **only when the pruned contract answers carry the key**; otherwise the key is omitted. Result: every refined snapshot recomputed from pre-S4 inputs is byte-identical (no `computationVersion` bump, `user-facts-plan-hash-audit` stays green), and `INITIAL_UNKNOWN_ROUTINE_CONTEXT` is unchanged.
- One accessor `bondbuilderTimingFromSnapshot(snapshot): BondbuilderTiming` (`known` value, else `no_preference`) in `src/lib/personal-plan/products/authority/bondbuilder-timing.ts`.
- `Stage3AuthorityInput` gains optional `bondbuilderTiming?: BondbuilderTiming` (absent = `no_preference`). Recompute: a changed answer changes the refined input hash → new refined version → the Stage-3 draft re-evaluates (`completionDecisionsRemainCurrent` fails for a `planned_purchase` whose product is no longer the recommendation) → new portfolio → routine proposal (existing chain; covered by T4.6 test).

### 1.9 Edit / reset
Edit = the existing Feinschliff edit entry for the products module (`hair-profile-section.ts` `editHref`); „Ist mir egal" is the reset (restores trust → cheapest-first behaviour). No profile-editor field (care habits are not editable there today).

---

## 2. Ranking

### 2.1 Order (S2 + X1)
For one Bondbuilder subject, lexicographic: **verdict (ideal first) → claim trust (high > medium > low > none) → timing match → [budget policy, capped only] → price ascending → catalogue order → id**. Timing never lifts a lower-trust product over a higher-trust one and never changes a verdict (scan verdicts unaffected).

### 2.2 Timing bucket (product side)
`bondbuilderTimingBucket(spec)` from `product_bondbuilder_specs.application_mode` (the "when" axis; ideal candidates always have it, `bondbuilderApplicationVerified`):
`pre_shampoo → before_wash`, `post_wash_leave_in → after_wash`, `bedtime_leave_in → overnight`, else `null`.
`matchesTiming(bucket, timing)`: `no_preference` → every bucket matches; `before_wash`/`after_wash` → exact bucket only (`overnight` and `null` match neither; Proposal P5).

### 2.3 Authority (`evaluateBondbuilderAuthority`, recommendation path)
```
ideal       = active, recommendable candidates with verdict ideal
mostTrusted = ideal at the best trust rank                          (unchanged)
matching    = mostTrusted.filter(c => matchesTiming(bucket(c), timing))
pool        = matching.length > 0 ? matching : mostTrusted
timingUnmet = timing !== "no_preference" && matching.length === 0
selected    = first of pool by compareBondbuilderTieOrder (price → catalogue order → id)
caution     = bondbuilder.equal_shortlist when pool.length > 1                         (unchanged id)
ruleId      = timingUnmet ? `bondbuilder.stage3.timing_unmet.${timing}.${bucket(selected)}`
            : pool.length > 1 ? bondbuilder.stage3.tie_ordered                           // Q1
            : bondbuilder.stage3.validated_standalone
```
Export `bondbuilderShortlist(input): { pool, selected, timingUnmet }` so `equal-options.ts` consumes the authority's own tie set (fixes G1: options = `pool` minus the selected product; medium/low ideals are never "equal" to a high-trust pick).
Reason strings stay modest: tie_ordered „Gleich gut passende Produkte; wir nennen zuerst das günstigste." (Opus copy pass); timing_unmet „Kein gleich vertrauenswürdiges Produkt passt zu deinem Zeitpunkt."

### 2.4 Comparison ranking (`fit-comparison.ts`)
`compareBondbuilderTrust(left, right, timing)`: verdict → trust → `Number(!matches(left)) - Number(!matches(right))` → price → catalogue order → id. Invariant test: for every timing and no budget, `rankStage3ComparisonCandidates(...)[0].productId === authority.recommendation.productId`.

### 2.5 Budget policy (`budget-policy.ts`)
- `BudgetCandidate.usageRank?: number` (0 match, 1 no match; omitted for `no_preference`). `trustTiesByPrice` breaks runs on `(verdict, trustRank, usageRank)` so the cap's cheaper-first sort never mixes matching and non-matching products. `fitComparable` unchanged (trust_pair never takes exceptions).
- One shared builder `bondbuilderBudgetRanked(authorityInput, ranked): BudgetCandidate[]` + `displayMode: "trust_pair"`, used by the gateway (`computeProposalAllocation`), previews (`allocateProposal`, fixes G2) and scan (`resolve-verdict.ts` uses `orderTrustPairAlternatives` for Bondbuilder, fixes G3; native scan identical with its own limit).
- Uncapped / unknown budget: ranked order unchanged (already trust → timing → price).

### 2.6 Unmet signal and card copy
- The signal is the authority rule id `bondbuilder.stage3.timing_unmet.<requested>.<actual>`, carried by `recommendationForCandidate` (single-candidate authority call → same rule) so it also travels with a **budget-chosen default** (`budgetedEvaluation` uses `chosen.recommendation`).
- **Explicit user picks never show the line:** `buildAuthorityDecision` for `select_replacement` rewrites a `timing_unmet.*` recommendation to `validated_standalone` (the preference *could* be met; the user chose otherwise).
- A non-explicit preserved Bondbuilder (`budgetChoiceFor` → `preserved.explicit === false`) whose bucket does not match a non-neutral timing is not preserved, so a changed answer re-picks under a budget too (Proposal P14).
- Persisted via `portfolio.ts` (`planned.authorityRuleId`) into routine `authorityRuleIds`. Owned items never show the line.
- Routine card (`components/routine/personal-plan/routine-item-card.tsx`): helper `bondbuilderTimingNoteDe(item)` in `src/lib/personal-plan/routine/bondbuilder-timing-note.ts` returns one neutral line or null (no line when met — X1):

| Rule suffix (requested.actual) | Line |
|---|---|
| `after_wash.before_wash` | „Nach dem Waschen gerade nicht möglich. Kommt vor dem Waschen ins Haar." (approved) |
| `before_wash.after_wash` | „Vor dem Waschen gerade nicht möglich. Kommt nach dem Waschen ins Haar." |
| `before_wash.overnight` / `after_wash.overnight` | „Vor/Nach dem Waschen gerade nicht möglich. Kommt abends ins Haar und bleibt über Nacht drin." |
Lines 2–3 mirror the approved line; Opus checks them in the copy pass.

### 2.7 Worked examples (prod prices; all eight assumed `ideal` — T4.4 re-checks with the coverage audit)
| # | Timing | Budget | Default | Line | Alternatives / options |
|---|---|---|---|---|---|
| E1 | no_preference (assumed / „Ist mir egal") | none or uncapped | OLAPLEX (`tie_ordered`) | — | cockpit equal options: Epres, K18 |
| E2 | after_wash | none | K18 (`validated_standalone`, no tie caution) | — | OLAPLEX, Epres, Elvital, Redken, Kérastase, OGX, Aveda |
| E3 | before_wash | none | **OLAPLEX 34,00 €** (`tie_ordered`, Q1) | — | Epres (equal), K18, Elvital, … |
| E4 | after_wash | capped 15 € (strict or flex) | Elvital 8,95 € (only affordable) | „Nach dem Waschen gerade nicht möglich. Kommt vor dem Waschen ins Haar." | trust pair: Elvital (im Budget), K18 (über Budget, best overall), OLAPLEX, Epres, … |
| E5 | before_wash | capped 15 € | Elvital 8,95 € | — (matches) | Elvital, OLAPLEX (best overall), Epres, K18, … |
| E6 | no_preference | capped 15 € | Elvital 8,95 € | — | Elvital, OLAPLEX (cheapest high, #654 rule), Epres, K18 — identical to today |
| E7 | any | capped 5 € strict | none (`strict_none_affordable`) | — | unchanged #654 |
| E8 | after_wash | none, K18 inactive (fixture only) | OLAPLEX (`timing_unmet.after_wash.before_wash`) | approved line | Epres, … OGX |

---

## 3. Aveda damage-band schedule (B1, D-b, F11)

### 3.1 Data model — new protocol cadence kind (not a projection of the old kinds)
`product_application_protocols.cadence` for Aveda protocol `f8d9cf57`:
```json
{
  "kind": "damage_branched",
  "branches": [
    { "structural_levels": ["moderate"],       "copy_de": "Einmal pro Woche anwenden.",
      "maintenance": {"kind":"times_per_week","minimum":1,"maximum":1}, "source_ids": ["C03-P07-1"] },
    { "structural_levels": ["high", "severe"], "copy_de": "An jedem Waschtag anwenden.",
      "maintenance": {"kind":"every_n_washes","minimum":1,"maximum":1}, "source_ids": ["C03-P07-1"] }
  ],
  "source_ids": ["C03-P07-1"],
  "binding_ruling": "decisions.md B1/D-b (Nick, 2026-10-09)"
}
```
- Levels are `PlanDamageLevel` values; a level may appear in at most one branch (the overlap at "moderate" is resolved by D-b, not by the projector). `none`/`low` are unbound → fallback.
- Producer: new pure `projectBondbuilderDamageBranchedCadence(profile, binding)` in `src/lib/bondbuilder-research/cadence-projection.ts`. It reads the frozen research profile (`application.cadence.value.status === "source_stated_conditional"`, branches by exact `condition` string) plus a reviewed binding file `data/research/bondbuilder-inci/v1.0/s4-aveda-cadence-binding/aveda-damage-binding.json` (condition → `structural_levels` + reviewed `copy_de`, citing D-b). Refuses on: confidence low, unresolved market, source ids outside `direction_source_ids`, branch/condition mismatch, overlapping or empty levels, blank copy. `projectBondbuilderCadence` (L19) stays unchanged: branches without a binding are still dropped (no invented cutoffs).
- `bondbuilder-reviewed-promotion.ts` (frozen P04–P08 builder) is not edited.

### 3.2 Damage band source
`InitialNeedPlanSnapshot.assessments.damage.structuralLevel` from `needs.ts buildDamageAssessment` (surface 0/2/4 + chemical 0/2/3/4 + min(concerns,5); 0 none, 1 low, 2–3 moderate, 4–5 high, 6+ severe). Examples: coloured only, smooth, no concern = 2 → moderate → „Einmal pro Woche anwenden."; lightened + slightly uneven = 6 → severe → „An jedem Waschtag anwenden."; coloured + slightly uneven = 4 → high → every wash day. Prod need-holders: moderate 6 / high 14 / severe 37.

### 3.3 How damage reaches routine cadence
- `RoutineCadenceResolutionInput` gains `structuralDamageLevel?: PlanDamageLevel | null`. In `canonicalProtocolCopy` path for owner `bondbuilder`: `kind === "damage_branched"` → branch whose `structural_levels` contains the level → `{copyDe, source: "exact_product_protocol"}`; no level / unbound level → existing safe generic („Nach Herstellerangabe", gap `exact_product_cadence_unavailable`). Other kinds ignore the level.
- **Compiler** (`routine-candidate-compiler.ts makeItem`): passes `input.refinedNeedSnapshot.assessments.damage.structuralLevel`.
- **Successor sync** (`source-sync-service.ts resolveSuccessorRoutineCadences`): `RoutineCadenceAuthorityReader.load({ productIds, refinedVersionId })` additionally returns `structuralDamageLevel` read from `personal_plan_need_versions.output_snapshot->assessments->damage->>structuralLevel` for `routine.source.refinedVersionId` (user-scoped, one row) — only when a fact of kind `damage_branched` is among the loaded facts.
- Persistence: the resolved copy lands in the existing `cadence.resolved`; **no routine-payload schema change** (Proposal P10 — avoids a strict-schema rollback hazard).
- Recompute: damage changes only through diagnostics edits → facts rebase → new initial + refined version → Stage-3 draft → new routine proposal/compile (existing chain); catalog cadence changes → successor sync with the refined version's level.

### 3.4 Write vehicle (production data)
Guarded one-shot migration `supabase/migrations/<ts>_bondbuilder_aveda_damage_cadence.sql` (precedent `20261007080123_bondbuilder_reviewed_promotion_p08.sql`, S1 OGX cadence): CAS on protocol `f8d9cf57` (product `04a83f16`, role `specialized_bond_treatment`, `cadence IS NULL`, research-profile fingerprint), writes cadence + one `personal_plan_catalog_fact_evidence` row (`fact_key = bondbuilder.protocol.cadence`, source aveda.de „ANWENDUNG", ruling D-b). Generator/prestate/verify/rollback under `plans/catalog-completeness-fill/slice4/`. Seeded-prestate PGlite rehearsal (apply + rollback + reapply + tamper). **Prod apply only after Nick approves the exact batch.** Runtime order is safe either way: before the code ships, an unknown kind already falls back to the generic line.

---

## 4. Ordered tasks

Routing: main session owns test design for T4.1, T4.3, T4.4, T4.9 (test-first) and integration; Opus implements T4.4 + copy; Sonnet does T4.2, T4.5–T4.8, T4.10 wiring. Every task ends green on its named suites.

**T4.0 Worktree.** `npm run worktree:new -- s4-bondbuilder`; verify base == fetched `origin/main` tip. *Produces:* clean branch.

**T4.1 Question path (test-first).** *Consumes:* §1.1–1.5. *Files:* `refinement/types.ts`, `question-path.ts`, `session.ts`, `assumed-defaults.ts`. *Tests (red first):*
- `tests/personal-plan-stage2-question-path.test.ts`: „bondbuilder_timing follows wet_wash_frequency when the Stage-1 need is basis or optional"; „absent without need / for owners / for does_not_wash"; „pruned when the owner answer or does_not_wash arrives later"; „invalid value rejected".
- `tests/personal-plan-stage2-question-path-modules.test.ts`: maps to `products`.
- `tests/personal-plan/refinement/assumed-defaults.test.ts`: rule `assume:bondbuilder_timing:no_preference` fires only on-path; direct-acceptance defaults equal the pre-S4 set plus this one answer.
- `tests/personal-plan-stage2-session.test.ts`: save + edit of a completed `bondbuilder_timing`.
*Produces:* path contract.

**T4.2 Storage.** *Consumes:* T4.1. *Files:* `user-facts/schema.ts`, `user-facts/from-refinement-draft.ts`, `mobile/profile-service.ts`. *Tests:* `tests/user-facts-schema.test.ts` (accepts the enum, rejects others), `tests/user-facts-from-refinement-draft.test.ts` (field + `user|assumed` provenance), `tests/user-facts-known-care-answers.test.ts` (user answer survives assumption), `tests/user-facts-assumed-never-replaces-real.test.ts` (assumed `no_preference` never overwrites a stored user `after_wash`), `tests/mobile-profile-service.test.ts` (labels). *Produces:* `care_habits.bondbuilderTiming`.

**T4.3 Routine-context carrier + late-question normalization (test-first).** *Consumes:* T4.1. *Files:* `personal-plan/types.ts`, `refinement/stage1-adapter.ts`, `refinement/assumed-defaults.ts` (`normalizeLateAddedQuestions`), the reader list in §1.6, `products/authority/bondbuilder-timing.ts` (accessor). *Tests:* `tests/personal-plan-stage1-stage2-adapter.test.ts` („key omitted when unanswered; snapshot byte-identical to a pre-S4 fixture"); `tests/personal-plan/persistence/stage2-refinement-service.test.ts` („complete pre-S4 draft with a Bondbuilder need loads, module stays complete, answer assumed"); `tests/personal-plan/refinement/refinement-status.test.ts`; `tests/personal-plan/persistence/stage2-optional-entry.test.ts`; `tests/personal-plan/facts-recompute/rebase-projection.test.ts` („need appears via facts edit → assumed; need disappears → pruned"); `tests/personal-plan-module1-stage3-resume.test.tsx`; `tests/personal-plan-direct-acceptance.test.ts` (draft still recognised); `tests/user-facts-plan-hash-audit.test.ts` stays green. *Produces:* `snapshot.profile.routine.bondbuilderTiming`.

**T4.4 Authority + comparison ranking (test-first, Opus).** *Consumes:* T4.3 accessor, §2.1–2.4, Q1. *Files:* `authority/contracts.ts` (`bondbuilderTiming?`), `authority/categories/bondbuilder.ts` (bucket, shortlist, rule ids), `fit-comparison.ts` (`compareBondbuilderTrust`). *Tests:* `tests/personal-plan/products/stage3-authority.test.ts`: „E1 no preference → OLAPLEX tie_ordered", „E2 after_wash → K18 validated_standalone without caution", „E3 before_wash → OLAPLEX tie_ordered, caution kept", „E8 after_wash without K18 → OLAPLEX timing_unmet.after_wash.before_wash", „lower-trust after-wash (OGX) never beats high-trust before-wash", „overnight matches neither answer", „timing never changes a scanned product's verdict". `tests/personal-plan/products/stage3-fit-comparison.test.ts`: „ranked[0] equals the authority pick for all three timings", „order E2/E3 exact". Also run `npm run personal-plan:stage3:coverage-audit` to confirm all eight are `ideal`. *Produces:* authority contract.

**T4.5 Budget parity (test-first).** *Consumes:* T4.4. *Files:* `budget-policy.ts` (`usageRank`, run key), shared `bondbuilderBudgetRanked` (next to `budget-need-distances`), `production-persistence-gateway.ts` (use builder; `select_replacement` normalization; non-explicit preserved drop), `product-previews.ts` (G2), `scan/resolve-verdict.ts` (G3). *Tests:* `tests/personal-plan/products/budget-policy.test.ts` („usage runs are never merged by the price sort", E4–E7 views); `tests/personal-plan/products/production-persistence-gateway-budget.test.ts` („E4 default Elvital carries timing_unmet", „explicit pick of OLAPLEX under after_wash persists validated_standalone", „timing change re-picks a non-explicit preserved K18"); `tests/personal-plan/product-previews-budget.test.ts` („preview allocation equals gateway allocation for Bondbuilder"); `tests/scan-resolve-verdict.test.ts` + `tests/mobile-scan-authority.test.ts` („capped Bondbuilder alternatives use the trust pair, native and web"). *Produces:* identical ordering in plan, preview, scan.

**T4.6 Input wiring + equal options.** *Consumes:* T4.4, T4.5. *Files:* `production-persistence-gateway.ts rawAuthorityAssessment` (from `context.refinedNeedSnapshot`), `product-previews.ts` (both authority-input sites), `discovery/equal-options.ts` (snapshot + `bondbuilderShortlist`, G1), `scan/resolve-verdict.ts` (`BuildScanVerdictInput.bondbuilderTiming`), `scan/load-scan-verdict.ts` + `mobile/scan-service.ts` (from `context.snapshot`); `product-intake/scan-catalog-readiness.ts` passes nothing (no user). *Tests:* `tests/discovery-equal-options.test.ts` („options are the authority's tie set: Epres + K18 only"; „no options for after_wash"); `tests/personal-plan/product-previews.test.ts` (refined snapshot with before_wash previews OLAPLEX; initial snapshot previews OLAPLEX); `tests/personal-plan/products/production-persistence-gateway.test.ts` (end-to-end: answer change → new refined version → planned purchase changes). *Produces:* all surfaces aligned.

**T4.7 Question UI (against mockup frame „Neue Frage").** *Consumes:* T4.1. *Files:* `components/personal-plan-refinement/refinement-options.tsx` (`BONDBUILDER_TIMING_OPTIONS`: first two with icons as in the mockup — reuse existing icon keys, Sonnet picks from the current set; third `noicon`), `refinement-question.tsx` (`getAnswerForQuestion`, `renderQuestionBody` case with title only, single-select), lab scenario `bondbuilder` in `src/app/labs/personal-plan-stage-2/{page,preview-client}.tsx` (`relevantCategories` incl. `bondbuilder`). *Tests:* `tests/personal-plan-stage2-refinement-ui.test.tsx` („renders after wash frequency with the approved copy; Weiter disabled until a choice"); Playwright case in `tests/personal-plan-stage2-refinement.spec.ts`. *Produces:* screen.

**T4.8 Routine card line.** *Consumes:* T4.5 rule ids. *Files:* `src/lib/personal-plan/routine/bondbuilder-timing-note.ts`, `components/routine/personal-plan/routine-item-card.tsx` (one muted line under the meta row, mockup frame „Wunsch nicht erfüllbar"); routine-editor lab fixture with the unmet rule id. *Tests:* new `tests/personal-plan-routine-bondbuilder-timing-note.test.ts` (each suffix → exact copy; met/owned/explicit → null); card render test in the existing routine card suite. Opus copy check for the two non-approved lines.

**T4.9 Damage-branched cadence runtime (test-first).** *Consumes:* §3.1–3.3. *Files:* `routine/cadence.ts`, `routine-candidate-compiler.ts`, `routine/cadence-authority.ts`, `routine/source-sync-service.ts` (+ `proposal-service.ts` caller). *Tests:* `tests/personal-plan-routine-cadence.test.ts` („moderate → Einmal pro Woche", „high and severe → An jedem Waschtag", „none / missing level → Nach Herstellerangabe + gap", „malformed branches → generic"); `tests/personal-plan-routine-candidate-compiler.test.ts` (snapshot level reaches the item); `tests/personal-plan-stage4-source-sync-api.test.ts` (successor reads the refined level; no `damage_branched` fact → no snapshot read).

**T4.10 Aveda cadence data.** *Consumes:* T4.9 contract. *Files:* `cadence-projection.ts` (`projectBondbuilderDamageBranchedCadence`), binding JSON (§3.1), `plans/catalog-completeness-fill/slice4/{generate.ts,prestate.json,verify.sql,rollback.sql}`, migration. *Tests:* new `tests/bondbuilder-cadence-projection.test.ts` (Aveda profile + binding → exact JSON; overlap/condition-mismatch/low-confidence refusals; `projectBondbuilderCadence` still null for branches); PGlite rehearsal test (precedent `tests/bondbuilder-reviewed-promotion-postgres.test.ts`). *Produces:* reviewed batch for Nick.

**T4.11 Docs.** `docs/personal-plan/categories/bondbuilder/decision.md` selection rules (trust → timing → budget → price → catalogue → id; rule ids; question gating; Aveda damage bands), cadence kind in `docs/product-application-protocol-templates.md`, `research/x2-bondbuilder-prefs/facts.md` superseded note in `decisions.md` only if Nick's Q-answers differ from proposals.

**T4.12 Verify → review → ship.** `npm run ci:verify`; `npm run test:personal-plan`; targeted suites above; `npm run personal-plan:stage3:coverage-audit`. Manual (dev server `npm run dev:worktree`, host `localhost`):
- `/labs/personal-plan-stage-2?scenario=bondbuilder` — question order and copy vs mockup, 375 px and desktop.
- `/labs/feinschliff-journey` — products module with and without a Bondbuilder need.
- `/labs/personal-plan/stage-3` — Bondbuilder comparison order for E2/E3 fixtures.
- `/labs/personal-plan-routine-editor` — card with and without the unmet line.
- `/api/dev/login?next=/routine` — real routine renders (no Bondbuilder regression for the dev user).
Then one Codex whole-branch review (read-only), `/ship`. Data apply (T4.10) is a separate go-ahead; after apply re-read the Aveda protocol row and replay a moderate and a severe fixture through the compiler.

---

## 5. Risks
| Risk | Mitigation |
|---|---|
| New required question breaks loading of 68 complete drafts (throw in `createStage2RefinementSession`) | §1.6 normalization at every reader; T4.3 tests per reader |
| Snapshot drift triggers mass recompute / hash audit failures | key omitted when unanswered; byte-identity test; no computation-version bump |
| Rollback after users saved answers: `careHabitsV1Schema` is `.strict()` on old code → `care_habits` parse failure | forward-fix only (same as every care-habits key); keep the PR revertable until the first answer is saved, i.e. verify on a preview deployment before promoting |
| Timing change does not re-pick under a budget (preserved K18) | P14 + gateway test |
| Explicit picks showing a false „nicht möglich" line | `select_replacement` normalization + test |
| Ranking drift between authority, comparison, preview, scan, cockpit | shared bucket/shortlist/budget builder; invariant tests (ranked[0] = authority pick; preview allocation = gateway allocation) |
| Aveda row changes between capture and apply | CAS + fingerprint in the migration; tamper rehearsal |
| Legacy chat engine (`recommendation-engine/selection.ts`) ignores timing | out of scope (plan §3 non-goal); chat keeps trust order |

---

## 6. Proposals (one recommendation per technical choice)
- **P1 Names:** `bondbuilder_timing` / `bondbuilderTiming` / `before_wash|after_wash|no_preference` (states the user's answer, not a product property).
- **P2 Gating:** need from `relevantCategories` + skip owners + skip `does_not_wash` (X1 says "only when the plan recommends a Bondbuilder"; for an owner the plan keeps her product).
- **P3 Carrier:** refined snapshot `profile.routine.bondbuilderTiming` (omitted when unanswered) → optional `Stage3AuthorityInput.bondbuilderTiming`. Rejected: post-authority layer like #654's budget — the tie pick is chosen inside the authority, so every default site would need the layer.
- **P4 Existing drafts:** silent read-time normalization to assumed `no_preference` (see Q2). Rejected: rewriting persisted drafts (breaks refined-version input parity).
- **P5 Overnight (OGX):** matches neither answer; reachable only when no high/medium product exists, so no practical effect today.
- **P6 Unmet signal:** authority rule id persisted with the planned purchase; no new payload field.
- **P7 Budget:** `usageRank` on `BudgetCandidate` + one shared Bondbuilder role builder (fixes G2/G3).
- **P8 Equal options:** derive from the authority's exported shortlist (fixes G1) instead of re-filtering detached verdicts.
- **P9 Aveda data:** new `damage_branched` cadence kind built by a projector from the frozen profile + a reviewed ruling binding; frozen promotion builder untouched.
- **P10 Damage context:** compiler reads the snapshot; successor sync reads the refined version's level through the cadence reader; no routine-payload schema change.
- **P11 No release flag:** default behaviour is unchanged until a user answers.
- **P12 Analytics:** none new (dry-shampoo precedent).
- **P13 Comparison „Anwendung" row:** unchanged in S4 (target stays „nach deinem Alltag"); showing the answer there is a follow-up, not in the mockup.
- **P14 Preserved default:** a non-explicit preserved Bondbuilder that no longer matches a stated timing is re-picked.

## 7. Questions for Nick
1. **Two equally trusted products, K18 not among them — which comes first?** Example: a user with bleached hair answers „Vor dem Waschen" and has no budget. OLAPLEX No.3PLUS (34,00 €) and Epres (48,00 €) are both top-trust pre-wash products. Today such a tie without K18 leaves the Bondbuilder slot empty. 57 current plans have a Bondbuilder need; any of them can give this answer. **Recommendation:** the cheaper one (OLAPLEX), with Epres shown as equal option — the comparison list already orders them this way, and it matches your budget rule from 2026-10-09.
2. **Existing members who finished the Feinschliff before this question existed — ask them or not?** 68 completed Feinschliffs (plus 4 halfway) would get the question. **Recommendation:** don't reopen anything; treat them as „Ist mir egal" (they use trust → cheapest first) and let them change it via „Bearbeiten" in the Feinschliff. Alternative: show the products module as open again with this one question.
