# Adversarial audit: selection engine + routine planner

2026-10-09 · tree `746bf6df` (worktree `engine-adversarial-audit`) · read-only audit. Nothing under `src/`, `docs/` or existing tests was changed.

Failing pins live in `tests/audit-selection-planner-rules.test.ts`. Run them with:

```
cd /Users/nick/AI_work/hair_conscierge/.worktrees/engine-adversarial-audit && node --import ./tests/server-only-register.cjs --import tsx --test tests/audit-selection-planner-rules.test.ts
```

Result: `# tests 18 · # pass 8 · # fail 10`. All 10 failures are intended contradiction pins. All 8 passes are in the `verified` block.

## Production paths confirmed

- **Personal Plan selection.** Stage-1 `computeNeedPlan`, then Stage-1 previews (`product-previews.ts`, also used by consultation `load-ideal-routine.ts`), then Stage 3 (`production-persistence-gateway.ts` → `fit-comparison.ts` → `budget-policy.ts`).
- **Chat selection.** `agent-v2/production/chat-pipeline.ts` → `select-products.ts` → `recommendation-engine/selection.ts` + `chat-budget.ts`.
- **Scanner.** `scan/resolve-verdict.ts`.
- **Routine planner.** `src/lib/routines/planner.ts` is production for the chat routine tool (`build-or-fix-routine.ts`, imported by `chat-pipeline.ts`). It is also production for the legacy `/routine` page (users without a Personal Plan, via `/api/routine`). Personal Plan users get the personal-plan routine (`src/lib/personal-plan/routine/*`) instead.

## (a) Rule inventory

| ruleId | rule | citation | status |
|---|---|---|---|
| selection.budget.allowance.1 | A = max(1, floor(0.25·N)); 1 for N 1–7, 2 for N 8–11 | profi-tier-baseline/plan.md pt 14 | holds |
| selection.budget.gap.1 | capacity max(A,G); gaps first, then ordinary exceptions ≤ A−G | pt 18 | holds |
| selection.budget.strict-zero.1 | strict cap with 0 affordable → no default | pt 20, impl-plan §4 | holds |
| selection.budget.unpriced.1 | unknown/unbuyable price is never affordable | pt 20/25 | holds |
| selection.budget.inference.1 | inference examples 3/4/5→5, 8/10/14→15, 4/4/25→none, 4/4/4/4/12→5 | pt 30 | holds |
| selection.budget.missing.1 | missing budget ≠ uncapped (chat) | pt 21 | holds |
| selection.budget.strict-standalone.1 | strict, ≥2 affordable → only within budget (scanner) | pt 20 + pt 35, §4 | **contradicted** |
| selection.budget.strict-standalone.2 | same rule for chat | pt 20/21, Task 8b | **contradicted** |
| selection.budget.native-order.1 | iOS native: affordability first, then native verdict/price comparator | impl-plan Task 7 | **contradicted** |
| selection.budget.trust-tie.1 | equal trust under a cap → cheaper first, same in Personal Plan (incl. previews) and chat | impl-plan §13 | **contradicted** (previews) |
| selection.budget.no-ceiling-coverage.1 | no-ceiling 60/40 never picks a worse fit; #1 card never fewer checks than an alternative | pt 16, stage3-coverage-ranking.md | **contradicted** |
| selection.budget.manual-allowance | manual over-budget choice vs automatic allowance | pt 17 | needs ruling (R1) |
| selection.budget.ideal-baseline | exception when the affordable baseline is already ideal | pt 26 vs §4 | needs ruling (R2) |
| selection.budget.within-role-pick | which over-budget candidate inside one role becomes the exception | pt 27 | needs ruling (R3) |
| selection.budget.flex-standalone | flexible standalone: show over-budget only when an improvement is evidenced | plan.md rev 46 / pt 35 vs Task 7 | needs ruling (R4) |
| selection.ranking.comparator | verdict > coverage > cautions > catalog order > price > id | stage3-coverage-ranking.md | holds (the last tiebreak is productId, not name) |
| selection.pp-mask.6 | ≥2 strong observed needs → Mask need strength high, weekly | mask/decision.md need-strength table | **contradicted** |
| selection.pp-dry.5 | active irritation/dry flakes/dandruff → Dry Shampoo `pause` | dry-shampoo/decision.md "Cadence, pause…" | **contradicted** |
| selection.pp-* (other) | Conditioner weight/balance/inclusion, Bondbuilder tiers, Shampoo roles/bands, Heat tiers, Oil tables, Scalp roles | category decision.md files | hold (Stage-1 agent; Conditioner weight examples were executed) |
| planner.night.1 | `night_protection: null` is not "none" | plans/2026-06-23-hai-130… approved decisions | holds |
| planner.night.2 | night protection never the `priority_lever` | same plan, Task 4 | **contradicted** |
| planner.brush.1–5, 8–10 | brush-tools Kernlogik + heat/cleaning caveats | docs/brush-tools-guidance.md | hold |
| planner.brush.6 | irritated/flaky/sensitive scalp → no hard scalp brush | brush guidance "Sicherheitsgrenzen" | **contradicted** (message-only signal) |
| planner.brush.7 | hair loss → no aggressive scalp massage | same | **contradicted** (message-only signal, medium) |
| planner.layer.1–3 | layered-flow priority order and caps | plans/2026-05-04-routine-layered-flow.md | hold |
| planner.dismiss.1 | dismissal TTL 14 days | test only, no normative doc | no rule |
| planner.chat.1 | chat-trigger seed copy | no doc | no rule |

**Totals: 31 rule rows. 18 hold, 10 contradicted and pinned, 4 budget items need a ruling.** The planner-vs-Personal-Plan divergences in R5 and the Stage-1 items in "Additional contradictions" are reported but not pinned.

## (b) Contradictions (pinned, currently failing)

| ruleId | sev | conf | plain example | expected → observed | src |
|---|---|---|---|---|---|
| selection.budget.strict-standalone.1 | P1 | medium-high | Lea („Bis 5 € für jedes Produkt“) scans a conditioner; two fitting alternatives cost 3–4 € | only the 2 affordable → a 20 € one is appended | `budget-policy.ts:232-242` (ignores `allowExceptions`), `scan/resolve-verdict.ts:254`; `tests/scan-shopping-budget.test.ts` "capped 5 EUR (web)" pins the observed behaviour |
| selection.budget.strict-standalone.2 | P1 | medium-high | Same Lea asks the chat | only affordable → over-budget listed after them | `agent/tools/chat-budget.ts:95` → `budget-policy.ts:232` |
| selection.budget.native-order.1 | P2 | medium-high | Ben (Bis 15 €, flexible), iOS scan | 3 €, 4 €, 12 €, then 20 € → 4 €, 12 €, 3 €, 20 € (fit order replaces the native comparator) | `fit-comparison.ts:245-262`, `resolve-verdict.ts:248-268`; the existing scan test pins the observed behaviour |
| selection.budget.trust-tie.1 | P1 | high | Mia (Bondbuilder basis, Bis 5 € flexible); K18 35 € and Olaplex 28 € are equally trusted | Idealplan/consultation preview shows Olaplex (as Stage 3 does) → shows K18 | `product-previews.ts:336-350` never passes `displayMode:"trust_pair"`/`trustRank`; the gateway does at `production-persistence-gateway.ts:669-683` |
| selection.budget.no-ceiling-coverage.1 | P1 | medium | Ana („Keine feste Preisgrenze“): conditioner A (8 €) has 4/4 checks, B (20 €) misses Pflegerichtung | A stays default → B is swapped in to hit round(0.6·N) | `budget-policy.ts:168-175` (`fitComparable` ignores coverage), `:543-554` |
| selection.pp-mask.6 | P1 | high | Eva: dry lengths + tangling | Mask high/weekly → standard/biweekly | `personal-plan/categories/mask.ts:187-196` |
| selection.pp-dry.5 | P1 | medium-high | Nora: oily scalp + dry flakes, accepted the dry-shampoo bridge | executionState pause → available | `personal-plan/categories/dry-shampoo.ts:44,66,81` |
| planner.night.2 | P1 | high | Jana: long healthy hair, no night protection, asks for a routine | lever ≠ night protection → lever is night protection | `routines/planner.ts:2281-2293` (inferred-need fallback) |
| planner.brush.6 | P1 | medium-high | Tom asks about a scalp brush; „Kopfhaut juckt“ | gentle-brush caveat → only the cleaning caveat | `routines/brush-tools.ts:206-214` reads only `scalp_condition`, although `planner.ts:149,332,755` sets `has_sensitive_scalp_signals` |
| planner.brush.7 | P2 | medium | Sara mentions Haarausfall only in her message | hair-loss caveat → absent | `routines/brush-tools.ts:215-219` |

### Additional contradictions found but not pinned (gap: not turned into tests)

All were executed by the Stage-1 agent with `computeNeedPlan`, but I did not re-run them:

- **pp-mask.3** — Mask care direction is elasticity-only and does not reuse the Conditioner mapping. Doc: mask/decision.md:190. Code: `mask.ts:80-84`. P1.
- **pp-oil.7** — non-coily damp Oil is demoted to optional whenever Leave-in is basis, without checking that `smooth_anti_frizz` is a *required* function. The demoted cadence also stays `after_every_compatible_wash`. Doc: oil/decision.md:233-237. Code: `portfolio.ts:41,57-61`. P1.
- **pp-leave_in.8** — treatment-led recurring-heat Leave-in misses the `pre_heat_application` role. Doc: leave-in/decision.md:194,206. Code: `leave-in.ts:220`. P1, medium.
- **pp-dry.4** — existing Dry Shampoo use never yields optional. Doc: dry-shampoo/decision.md:59. Code: `dry-shampoo.ts:54`. P1.
- **pp-heat.4** — direct heat plus one unclassified tool defers the whole Heat category. Code: `heat-protectant.ts:62-66`. P1, low-medium.
- **pp-conditioner.9** — balanced-bridge Conditioner is ideal; doc fixture 17 says supportive. Code: `authority/categories/conditioner.ts:138-140`. P1, medium.
- **pp-oil.9** — Oil "ideal sets" are collapsed to a single weight, so the doc's ideal adjacent weights become supportive. Code: `oil.ts:70-76`, `authority/categories/oil.ts:69-83`. P1, medium.
- **Minor** — pp-mask.17 (optional Mask needStrength is "standard", not null), pp-deep.6 (low-wash point), pp-dry.6 (no `decrease_frequency`; there is no frequency data).

## (c) Needs ruling

- **R1 – manual over-budget vs allowance.** B-MAN-1 and code (`budget-policy.ts:417-434`) let an explicit over-budget choice consume the automatic allowance. Point 17 says the allowance "does not constrain explicit manual choices… users may select *additional*" ones.
  - Example: Bis 15 € flexible, 4 purchases, A=1. The user picks a 30 € conditioner herself, and the mask's qualifying 25 € upgrade is then withheld.
  - Reading A: manual choices count against A (code). Reading B: they sit on top of it.
  - `exceptionsUsed` also omits `manualOver`.
- **R2 – exception over an already-ideal baseline.** Point 26: "Smaller improvements while the affordable product already has ideal authority fit are not selected". §4 (which says it wins over the ledger) requires only "strictly closer on ≥1 need dimension, verdict not worse". The code follows §4.
  - Example: an ideal 4 € conditioner one weight-step off versus an ideal 20 € on-target one. The exception is granted under §4 and refused under pt 26.
- **R3 – which candidate inside a role.** The code takes the first improving over-budget candidate in fit order (`budget-policy.ts:355-366`). It ignores main concern and extraCost within the role, although pt 27 applies them across roles.
  - Example: a 30 € repair-only upgrade is ranked above a 20 € weight upgrade for a „weighed down“ user. The code picks the repair one, with no main-concern priority.
- **R4 – flexible standalone (scanner/chat).** plan.md rev 46/pt 35: higher-priced alternatives appear "when suitability improvement is established". Task 7/8b and the code: every over-budget alternative is shown after the affordable ones, with no evidence check (`needDistances: {}`).
- **R5 – legacy chat planner vs Personal Plan category standards.** The `docs/personal-plan/categories/*/decision.md` files declare legacy Routine/CareBalance logic "reject as Personal Plan authority". They do not say the chat planner must follow them. Divergences found by execution through `buildRoutinePlan`:
  - blow-drying alone adds Leave-in and makes it the lever (`planner.ts:1753-1762`; CareBalance already follows the airflow rule);
  - rough/split_ends/stretches_stays/heat alone add a Bondbuilder with a universal "4 Anwendungen am Stück" cadence, while chemically straightened gets none (`planner.ts:459-483`, `:2030`);
  - Mask "jede 2. Wäsche" regardless of wash frequency (`planner.ts:1226-1230`);
  - two heavy products or oil trigger a Haar-Reset (`planner.ts:349-385`);
  - oily scalp alone gets a scalp-clarify/exfoliant lever (`:343,1346,2228`), and irritation does not pause it;
  - the shampoo slot keeps the current frequency instead of the target (`planner.ts:1625`), and `shampoo-cadence.ts:69,73,148,160` shifts the band by condition and goals;
  - very short hair always gets a Conditioner (`hair-length-policy.ts:103`), and the existing spec asserts this;
  - a forced Mask slot says it does not replace the Conditioner (`planner.ts:1108`);
  - CareBalance dry-shampoo frequency targets (`evaluators.ts:644-648`).

  Ruling needed: must chat and legacy routine follow the Personal Plan standards ("one rule everywhere"), or are they accepted legacy?
- **R6 – stale docs superseded by rulings.** Code follows the later rulings, so update the docs, not the code:
  - shampoo dry band (nomi-consult-finish T4, 2026-10-09);
  - Mask care-direction fit (#621 Option A);
  - Mask fit thresholds (v4 + 08-17 supportive fallback);
  - Bondbuilder thickness/K18/trust (code comments cite Nick; plan files not located).
- **R7 – other doc ambiguities from Stage 1.** Is the Mask heat exposure route-aware (tests) or `heatLevel ≥ moderate` (doc)? Dry+rough repair "low/medium" example vs the shared formula (high). Oil healthy guard omits `hair_damage`. Leave-in `repair_only` omits `hair_damage`. `colored` counted as a protein group. `does_not_wash` → minimum band.
- **R8 – care direction in budget swaps and exceptions.** §4 excludes care direction as weak evidence. Should a care-direction *regression* still block a flexible improvement exception (pt 26 "without introducing another compromise")? Related to the no-ceiling-coverage pin.

## (d) Untestable gaps

- **Stage-3 gateway end to end** (`production-persistence-gateway.ts` with persistence) was not exercised. Budget behaviour was pinned through the pure policy, the Stage-1 previews, the scanner `buildScanVerdict` and chat `applyChatBudgetOrdering`. The trust-pair gateway behaviour is inferred from code plus `budget-policy.test.ts` B-TRUST-4.
- **`npm run personal-plan:stage3:coverage-audit`** needs the production Supabase DB, so it was not run. No production data was checked: real catalog price/segment distribution and how many users hit each pin are unknown.
- **Chat end to end** (LLM turn, `test:chat` fixture `shampoo-saved-budget-strict`) needs an API key and the applied migration, so it was not run.
- **Not audited:**
  - `recommendation-engine/selection.ts` category rules vs the category docs. The research lane was still running at hand-back, so that whole area is a gap.
  - The scalp-care and heat-protectant Stage-3 adapters.
  - Dismissal and chat-trigger behaviour (no normative rule exists).
  - The UI copy of budget notices.
- **Stage-1 contradictions** listed under "Additional contradictions" were executed by a research agent only. I re-ran none of them (mask-care-direction, oil demotion, leave-in heat role, existing dry-shampoo use, mixed-heat deferral) and pinned none.

## Addendum: chat-selection lane (arrived after hand-back; not re-run, not pinned)

A research agent found these by runtime probes of `recommendation-engine/selection.ts` and `categories/*`. Its probe scripts are in the session scratchpad at `…/scratchpad/eng/`. I re-ran none of them, so treat each as unverified until pinned.

Every item uses `docs/personal-plan/categories/*/decision.md` as its standard. Those docs scope themselves to the Personal Plan, so for chat every item falls under ruling R5 ("must chat follow the Personal Plan standards?"). Two items are exceptions because they break a rule that already binds chat:
- **C10:** a requested leave-in format bypasses the budget order before the cut. This breaks the budget plan §13 rule R7 ("order before the engine limit"), which explicitly covers chat. P1, high.
- **C8:** chat ranking lets a supportive product outrank an ideal one, and ties are broken by price, not catalog order. This conflicts with the rule in `plans/stage3-coverage-ranking.md`. Whether that ranking rule binds chat is itself an R5 question. P1, high.

Candidates, P0 first:
- **C1 (P0).** Fine hair with unknown density gets `weight: null`, so a rich conditioner or mask counts as ideal. Code: `categories/shared.ts:48-66`.
- **C2 (P0).** Density shifts the formula weight. The docs say weight comes from thickness only. Code: `shared.ts:48-66`, `mask.ts:42-55`.
- **C3 (P0).** Mask selection has no thickness gate, so a coarse-only mask is "ideal" for fine hair. Code: `mask.ts:302-370`.
- **C9 (P0).** A user with heat styling who already uses a separate heat protectant gets zero care-only leave-ins. Code: `categories/leave-in.ts:105-125,463-474`; `selection.ts:499-509`.
- **C4–C6.** Mask fallback returns rich masks for fine hair. A weight mismatch is not flagged in both directions. Mask repair fit contradicts the doc. Code: `selection.ts:1983-1985`, `mask.ts:226-286`.
- **C7.** Peeling fills the slot with mismatched products. Code: `selection.ts:1609`.
- **C11.** Dry-shampoo tint, sensitivity and frequency rules differ from the doc, and hair loss alone blocks dry shampoo.
- **C12.** Oil is suppressed for oily scalp plus fine hair when the user owns an oil.
- **C13/C14.** The dandruff concern is ignored in shampoo bucketing, and supportive dandruff shampoos are returned.
- **C15.** Shampoo cadence shifts with goals and scalp condition. The planner lane found the same.
- **C16.** Conditioner care direction and repair level differ from the doc.
- **C17.** Bondbuilder tiers differ from the doc.
- **C18.** Mask is escalated to a fixed role on a single signal.
- **C19.** Reset load counts mask and oil.
- **C20.** Very short hair always gets a conditioner.
- **C21/C22.** Leave-in for chemically straightened hair, and the replacement relationship.
- **C23/C24.** Mask cadence for fine hair, and peeling type chosen from scalp type.

Chat items that hold: Bondbuilder trust ranking with the K18 tie default, the trust pair and cheaper-first rule under a cap, owned products protected, and unpriced products dropped under a cap.

Recommended next step: get the R5 scope ruling first, then pin C1–C3 and C9, the P0 safety and fit items.
