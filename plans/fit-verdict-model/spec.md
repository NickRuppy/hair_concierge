# Canonical product-fit verdict model

Status: **ruled by Nick 2026-10-12** (chat); no open questions. Supersedes the per-category fit semantics in `docs/personal-plan/categories/*/decision.md` where they conflict, and the Mask v4 "basis ideal-only" rule (`plans/2026-08-15-personal-plan-mask-v4-independent-release.md`). Evidence for the current state: `plans/engine-adversarial-audit/fit-verdict-model-map.md` (read-only map, 17 inconsistencies).

Vocabulary: `hair_texture` = pattern (straight/wavy/curly/coily); `thickness` = diameter (fine/normal/coarse).

## 1. Levels and labels (plan and scanner use the same words)

| Level | Internal | Label | Second line |
|---|---|---|---|
| exact | `ideal` | **Passt** | optional |
| one step off | `supportive` | **Passt bedingt** | the concrete reason(s), e.g. "Für feines Haar eher schwer" |
| hard gate failed or two+ steps off | `mismatch` | **Passt nicht** | the reason; owned/scanned product gets the action **Wechseln** and the quiet option "Trotzdem behalten" |
| required fact missing / product not yet reviewed | `unknown` | **Nicht geprüft** | none |

Alternatives read "Alternative · passt bedingt". The documented labels "passt sehr gut", "wechseln empfohlen", "noch in Prüfung" and the shipped "Unklar" are retired. Internal enum values stay as they are.

## 2. Hard gates (binary; any failure ⇒ Passt nicht)

1. Safety: a known reaction to the product.
2. Lifecycle: product not active / not recommendable.
3. Wrong job: wrong category or role (shampoo bucket, scalp route, leave-in post-wash vs pre-heat, oil role), wrong application stage, missing required capability (heat protection for a heat protectant or pre-heat leave-in), missing required functional benefit (mask, leave-in).
4. Medically adjacent exclusions: an anti-dandruff active for an irritated-only scalp; the dandruff role accepts only gentle cleansing when irritation is present (ties into the scalp-combination proposal).
5. Bondbuilder technology not approved (see §6).

Thickness is **not** a hard gate in any category (overrides conditioner/mask/shampoo/oil decision docs and the Mask v4 fail-closed list). Price never flips a verdict (R19 stays).

## 3. Degree axes (scored by distance in steps)

Exact = 0 steps ⇒ Passt. 1 step ⇒ Passt bedingt. 2+ steps ⇒ Passt nicht.

| Axis | Scale | Categories |
|---|---|---|
| Thickness | fine – normal – coarse | shampoo, conditioner, mask, oil, leave-in (leave-in currently unchecked; docs say it must be) |
| Weight | light – moderate – rich | conditioner, mask, oil (leave-on), leave-in |
| Care direction | protein – balanced – moisture | conditioner, mask, leave-in (a `balanced` user target vs a moisture product is 1 step ⇒ Passt bedingt if it is the only miss) |
| Repair support vs need | at/above = 0; 1 below = 1; 2 below = 2 | conditioner, mask, leave-in |
| Cleansing intensity | gentle – regular – strong | shampoo |
| Tint / scalp sensitivity | match = 0; other = 1 | dry shampoo (per its decision doc; today has no middle level) |

Categories with no degree axis today (deep cleanser, scalp care, heat protectant) keep gates only; their verdict set is Passt / Passt nicht / Nicht geprüft. Shampoo stops dropping thickness-conditional products before evaluation: the research envelope's `conditional` thickness fit is emitted as a 1-step row, not discarded, so a thickness miss is reported as a thickness reason, never as "deckt die Shampoo-Aufgabe nicht ab".

## 4. Combination rule (ruled 2026-10-12: additive)

- Any hard gate failure ⇒ Passt nicht, regardless of axes.
- Otherwise sum the step distances over all degree axes: **0 ⇒ Passt; 1 ⇒ Passt bedingt; 2 or more ⇒ Passt nicht.** So a single axis two steps off fails the product, and so do two axes that are each one step off. A Passt bedingt product therefore has exactly one one-step miss, and its reason line names it.
- Otherwise, if a required fact for a gate or axis is missing ⇒ Nicht geprüft.
- Ranking inside a verdict: the existing tie-breaks (target match count, catalog order, price). The budget policy consumes the ranked list unchanged.

## 5. Downstream rules (same in plan and scanner)

- Recommendation: Passt first. A Passt bedingt product may be the pick when no Passt product exists, in **every** category and in **both** need tiers (basis and optional), always with its reason shown. This replaces the Mask v4 basis-ideal-only rule.
- Alternatives: Passt or Passt bedingt only; never Passt nicht or Nicht geprüft.
- Owned or scanned products are always shown with their verdict and reasons; Passt nicht offers **Wechseln** (primary, when an alternative exists) and "Trotzdem behalten" (quiet, requires acknowledged limitation as today). Nicht geprüft is never recommended and cannot be activated.
- Owned-mismatch actions are the same in every category (`acknowledge_override` + `leave_uncovered`), removing the mask/bondbuilder/deep-cleanser exception.
- Chat (`recommendation-engine`) is out of scope for this change (product near sunset per Nick 2026-10-11); its divergence is recorded in the map, not fixed here.

## 6. Bondbuilder (no degree axes)

Recommended by **trust in the technology** (reviewed/approved tiers per the 2026-10-05 policy and the diameter ruling), then **budget** (equally trusted products are equal options, cheaper first per the 2026-10-09 trust-tie rule). No preferred-step filter (Nick 2026-10-12: keep it simple). Verdict set: Passt / Passt nicht (gates §2) / Nicht geprüft. Passt bedingt is unused. The former "add-on ⇒ supportive" relationship rule is retired; a companion product is not a standalone candidate.

## 7. Implementation shape (for the Codex brief)

- One shared evaluator in `src/lib/personal-plan/products/authority/` that takes `{gates[], axes[]}` from a per-category config and returns `{verdict, reasons[], missCount}`; the ten per-category aggregation paths (map §1) are replaced by configs.
- Scanner and plan keep consuming `Stage3FitVerdict`; only labels and reason lines change in the presentation layer (`verdict-labels.ts`, `product-fit-comparison.tsx`, mobile `result-presentation.ts`).
- Shampoo adapter: emit `conditional` thickness rows as 1-step eligibility instead of dropping them (`production-light-adapter.ts:536-603`) — coordinate with the shampoo v1.6 program (R2–R4 say the same).
- Oracle: the audit's red tests in `tests/audit-*-rules.test.ts` for thickness/weight/direction cases, plus new table-driven tests for the shared evaluator (every category × every axis × 0/1/2 steps, every gate, missing facts, ranking order), plus label snapshot updates. Existing tests that pin the old hard-fail behaviour or the old labels are updated, not deleted, with the ruling cited.
- Docs: update the category decision docs' fit sections to point here; update `category-design-framework.md` labels; note the Mask v4 override.

### 7a. Review findings folded in (Codex lead check 2026-10-12, verified by Claude)

These are implementation consequences of §1–§6, not new rulings.

1. **Distance-preserving facts.** The loader must keep near rows, not only exact ones:
   - shampoo: `catalog-facts.ts` (~1154–1168) selects exact thickness + bucket + route and turns everything else into `targetFit: "known_mismatch"`, which `categories/shampoo.ts` (~112–120) reports as a wrong-job miss. Bucket and route stay exact (gates); thickness must carry its distance.
   - conditioner: `catalog-facts.ts` (~1195–1207) selects exact thickness + care direction; same fix, both are degree axes.
   - oil: `catalog-facts.ts` (~1253–1260) projects thickness to an exact boolean and `categories/oil.ts` (~46–56) drops `false`; replace with the product's thickness set so distance is computable.
   - mask / leave-in already copy spec values; leave-in gains the thickness axis (§3).
2. **Repair at/above target = 0 steps.** `axis-fit.ts` `repairSupportAxisFitResult` returns `caution` for product above target; §3 says 0.
3. **Presentation consumes evaluator axis outcomes, never re-derives them.** Today rows are recomputed in `fit-comparison.ts` (~685–738, binary overlap ~778–784), mobile `result-presentation.ts` (~159–193), web scanner `resolve-verdict.ts` (~483–489) → `scan-dimension-bar.tsx` (every non-overlap red) and `scan/result-presentation.ts` (~121–123 ✕). The evaluator returns per-axis `{axis, steps, reason}`; every surface renders those (0 = ok, 1 = amber, ≥2 or gate = red). `comparison-dimensions.ts` (~317–406) gains the leave-in/mask thickness rows. The mask's R12 accepted care-direction set (`maskAcceptedCareDirections`, high repair widens one step toward protein) stays a prior ruling: every direction in that set is 0 steps; distance is measured from the nearest member.
4. **Wire fields.** Web scan transport (`scan/types.ts` ~81, `product-presentation.ts` ~78–103) and mobile contract (`mobile/scan-contracts.ts` ~59) carry the reason line(s) for Passt bedingt, for the scanned product and its alternatives.
5. **Nicht geprüft is a verdict, not an error.** Mobile `scan-service.ts` (~186–201) maps `unknown` to an authority failure; it must render "Nicht geprüft" (keeping the existing "personal target unavailable" copy where that is the cause).
6. **Owned-mismatch actions** normalised to `acknowledge_override` + `leave_uncovered` (+ `plan_recommendation` when a candidate exists) in mask (~327–332), bondbuilder (~236–241), deep-cleansing (~144–149). Heat protectant: see open question Q2.
7. **Retired wording elsewhere:** `discovery/cockpit-copy.ts` (~31–34) and the quiz scanner demo `quiz/scan-insert-examples.ts` (~251–271 aggregation, ~299–307 hard-coded mask row) adopt the four labels and the additive rule.

### 7b. Rulings on the review questions (Nick, chat 2026-10-12)

- **Q1 Scanner actions — same buttons for every verdict.** The scanner keeps its buy/save footer; "Trotzdem kaufen" is retired ("Trotzdem" confuses users). Every verdict shows the same two actions: "Kaufen" (with price when known) and "Speichern" (Benutze ich schon / Merkliste). Only the verdict label and reason lines differ. "Wechseln" / "Trotzdem behalten" stay plan-only (owned products). Supersedes §5 for the scanner.
- **Q2 Heat protectant — same as others.** A heat protectant owned without verified heat protection offers `acknowledge_override` + `leave_uncovered` (+ `plan_recommendation` when a candidate exists), like every category.
- **Q3 Inactive scanned products — leave as is.** Scanner lookup still rejects inactive products before evaluation; out of scope here. Owned inactive products in the plan keep the lifecycle Passt nicht.
