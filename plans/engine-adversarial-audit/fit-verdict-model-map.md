# Product-fit verdict model: read-only map (main checkout, 2026-10-12)

Produced by a read-only Explore pass for the "canonical fit logic across categories" decision. Paths relative to the repo root. `AUTH` = `src/lib/personal-plan/products/authority`, `CAT` = `AUTH/categories`. Describes, does not recommend.

Two separate verdict systems exist: the Personal Plan Stage 3 "authority" (plan, scanner, plan previews) and the chat engine in `src/lib/recommendation-engine` (own evaluators, extra status `not_applicable`).

## 1. Verdict vocabulary and aggregation

- Verdict: `src/lib/personal-plan/products/contracts.ts:75-76` `STAGE3_FIT_VERDICTS = ["ideal","supportive","mismatch","unknown"]`. Scan mirror `src/lib/scan/types.ts:17`.
- Criterion status: `contracts.ts:248-253` `pass | caution | fail | unknown`.
- Evaluation envelope `AUTH/contracts.ts:244-283`: `status` is `known | pending | unknown | unsupported`; only `known` carries a verdict; `status:"unknown"` carries `missingFacts` and `allowedActions:["leave_uncovered"]`.
- `known_mismatch` is not a verdict; it is `spec.targetFit` (`AUTH/contracts.ts:91,103`; set in `AUTH/catalog-facts.ts:1168` shampoo, `:1207` conditioner).
- No shared aggregation function. Per category:

| Category | Where | Rule |
|---|---|---|
| mask | `CAT/mask.ts:234-241` | any fail → mismatch; else any unknown → unknown; else any caution → supportive; else ideal |
| bondbuilder | `CAT/bondbuilder.ts:155-162` | any fail → mismatch; else any unknown → unknown; else `relationship==="add_on"` → supportive; else ideal |
| deep_cleansing | `CAT/deep-cleansing-shampoo.ts:88-93` | fail → mismatch; unknown → unknown; else ideal (no supportive path) |
| shampoo / conditioner / leave-in | `shampoo.ts:55-159`, `conditioner.ts:33-137`, `leave-in.ts:39-181` | sequential early returns: first failing check returns mismatch with that single fail criterion; missing facts accumulate to unknown; supportive decided by one boolean (shampoo intensity `:160-163`; conditioner weight/repair caution `:140-142`; leave-in weight/repair/care-direction caution `:182-185`) |
| oil / heat_protectant / scalp_care / dry_shampoo | `oil.ts:147,187,213`; `heat-protectant.ts:109,127,162,181,198`; `scalp-care.ts:91,136,159`; `dry-shampoo.ts:77,104,137` | verdict literals hard-coded per branch |

Uncovered-slot verdicts differ: oil returns mismatch + recommendation (`oil.ts:144-157`); heat_protectant mismatch + recommendation or ideal if a carrier is verified (`heat-protectant.ts:106-141`); scalp_care and dry_shampoo return unknown + caution even with a recommendation (`scalp-care.ts:86-114`, `dry-shampoo.ts:73-98`); others return unknown when no candidate, else the best candidate's verdict.

Persistence guards (`contracts.ts:776-835`): `owned_active` needs ideal or supportive; `owned_override` on a mismatch needs `limitationAcknowledged`; unknown cannot be overridden; `pending_review` needs unknown.

Chat engine: `CATEGORY_FIT_STATUSES` = ideal, supportive, mismatch, unknown, not_applicable (`recommendation-engine/contracts.ts:35-41`); per-axis `exact | close | mismatch | unknown` (`categories/shared.ts:90-139`); aggregation repeated per evaluator (any axis mismatch → mismatch; all exact/unknown → ideal; else supportive): conditioner `:130-150`, mask `:302-370`, leave-in `:567-595`.

## 2. Per-category check matrix (Stage 3 authority)

P = pass, C = caution (soft), F = fail (hard → mismatch), U = unknown, "-" = absent.

| Check | shampoo | conditioner | mask | oil | leave_in | bondbuilder | dry_shampoo | deep_cleansing | scalp_care | heat_protectant |
|---|---|---|---|---|---|---|---|---|---|---|
| Lifecycle/active | F `shampoo.ts:55-67` | F `conditioner.ts:33-44` | F `mask.ts:147-150` | F `oil.ts:180-199` | F `leave-in.ts:39-50` | F `bondbuilder.ts:120-123` | F `dry-shampoo.ts:101-122` | F `deep-cleansing-shampoo.ts:48-56` | F `scalp-care.ts:129-156` | F `heat-protectant.ts:160-176` |
| Known reaction | F `shampoo.ts:68-80` | F `conditioner.ts:33-44` | F `mask.ts:107-115` | - | F `leave-in.ts:39-50` | F `bondbuilder.ts:102-110` | F `dry-shampoo.ts:101` | F `deep-cleansing-shampoo.ts:39-47` | F `scalp-care.ts:131` | - (U via commonUnknownFacts) |
| Thickness vs `suitableThicknesses` | **F only** `shampoo.ts:81-97` | **F only** `conditioner.ts:45-60` | P/U/F `mask.ts:116-146` | F or U via `targetThicknessEligible` `oil.ts:164,180-199`; candidates need `=== true` `:54` | **none** (`leave-in.ts:51-52`); U if null | P always `bondbuilder.ts:112-119` | none (`requiresSuitableThickness:false` `:22`) | none; U if null `:128` | none | none |
| Texture (`hair_texture`) | not evaluated | not evaluated | not evaluated | not evaluated | not evaluated | not evaluated | not evaluated | not evaluated | not evaluated | not evaluated |
| Role / bucket / scalp route | F `shampoo.ts:133-145,146-159`; F via targetFit `:112-123` | F via targetFit `conditioner.ts:66-78` | - | F/U `oil.ts:162-163,180-199` | F `leave-in.ts:71-82` | - | - | P/F/U `deep-cleansing-shampoo.ts:57-76` | F `scalp-care.ts:129-156` | - |
| Weight | - | P / C (1 step) / F (2 steps) `conditioner.ts:88-104`, `axis-fit.ts:5-13` | P/C/U, never F `mask.ts:44-76,151-162` | P/C owned only `oil.ts:211-233`; candidates exclude ≥2 steps `:67-79` | P/C/F `leave-in.ts:132-148` | - | - | - | - | - |
| Care direction | - | F only moisture↔protein; balanced not a caution `conditioner.ts:105-120,138-140` | P/C/U, never F `mask.ts:78-101,163-168` | - | P / C (balanced) / F (opposite) `leave-in.ts:166-181` | - | - | - | - | - |
| Repair support | - | P/C/F (≥2 below) `conditioner.ts:121-137` | P/C (≥2 below)/U, never F `mask.ts:54-67,169-187` | - | P/C/F `leave-in.ts:149-165` | - | - | - | - | - |
| Cleansing intensity | C only `shampoo.ts:160-180` | - | - | - | - | - | - | - | - | - |
| Functional benefits | - | - | P/U/F `mask.ts:188-222` | - | F `leave-in.ts:83-97`; U if null | - | - | - | - | - |
| Heat / application stage | - | - | - | - | F `leave-in.ts:98-104,105-131` | - | - | - | - | F `heat-protectant.ts:178-195`; U if null |
| Protocol verified | U `shampoo.ts:100-106` | U `conditioner.ts:63-64` | P/U `mask.ts:223-233` | U `oil.ts:166-168` | U `leave-in.ts:66-67` | P/U `bondbuilder.ts:144-154` | U `:27` | P/U `:77-87` | U `:38-39` | U `:146-148` |
| Relationship (add-on) | - | - | - | - | - | P / C `bondbuilder.ts:134-143` | - | - | - | - |
| Soft check can yield supportive? | yes | yes | yes | yes | yes | yes | **no** | **no** | **no** | **no** |

Shampoo drops thickness-conditional products BEFORE evaluation: `src/lib/shampoo/production-light-adapter.ts:199-206,536-540,585-587,603` (only `ideal` thicknesses become eligibility rows; `docs/product-intake-shampoo-production-light.md:432-435`). At runtime `AUTH/catalog-facts.ts:1110-1170` keeps only rows with the user's thickness; no row → `targetFit:"known_mismatch"` → reported as `shampoo.role` "deckt die erforderliche Shampoo-Aufgabe nicht ab" (`shampoo.ts:112-123`), not as a thickness criterion. Conditioner does the same (`catalog-facts.ts:1173-1210`). Oil drops candidates when `targetThicknessEligible !== true` (`oil.ts:46-59`).

## 3. Surfaces

**Stage 3 cards** (`src/components/personal-plan-products/product-fit-comparison.tsx`): ideal "Passt" (`:964-969`); supportive "Passt mit Einschränkung" (`:968`), alternatives "Alternative · passt mit Einschränkung" / "passt teilweise", first candidate "Beste verfügbare Option" with "Wir zeigen die Einschränkung offen."; mismatch "Passt nicht" with up to 3 failing criteria (`:1651-1680`), owned mismatch gets "Diese Alternative wählen" primary and "Mein Produkt trotzdem behalten" quiet; unknown → no verdict, `UnassessableReview` "Noch nicht eindeutig beurteilbar". The literal "wechseln empfohlen" appears nowhere in `src`; "Noch in Prüfung" is only the routine availability badge (`routine-status.tsx:34-36`). Routine `informed_override` renders "Mit Einschränkung" (presentation v3/v4) else "Bewusste Wahl".

Allowed actions for owned products: ideal → keep_owned; supportive → keep_owned + leave_uncovered (oil also acknowledge_override); mismatch → acknowledge_override (+ leave_uncovered for shampoo/conditioner/leave-in/oil/dry_shampoo/scalp_care; mask/bondbuilder/deep-cleansing get acknowledge_override only).

**Scanner** (`src/lib/scan/verdict-labels.ts:9-21`): ideal "Passt" (ok), supportive "Passt mit Einschränkung" (pending), mismatch "Passt nicht" (danger), unknown "Unklar" (neutral). Scanned product is evaluated like an owned product; mismatch is never hidden; footer "Kaufen" for ideal, "Trotzdem kaufen" otherwise. Best role picked by ideal < supportive < unknown < mismatch (`role-selection.ts:18-27`). Alternatives come from `buildStage3FitComparison` → ideal or supportive only.

**Chat** (`recommendation-engine/selection.ts`, `agent/tools/select-products.ts`): score adjustments ideal +28 / supportive +14 / unknown +2 / mismatch −20 / not_applicable −100 (`selection.ts:213-226`); limit 3; mismatches surface as labelled "Fallback" when fewer than 3 acceptable (shampoo `:870-891`, conditioner `:757-773`, leave-in `:499-509`, mask `:1977-1979`). Labels: "idealer Treffer" / "unterstützender Treffer" / "Daten unvollständig" / "weicht (etwas) ab". Thickness: conditioner axis (`categories/conditioner.ts:88-136`), leave-in hard code (`:455-492`), shampoo/oil DB filter (`selection.ts:2337,2413`), mask none.

## 4. Selection consequences

- Supportive can be the pick when no ideal exists in shampoo (not for `shampoo_dandruff`, `shampoo.ts:199-200`), conditioner, leave-in, mask (needs image), oil (`candidate-ranking.ts:10-44`: verdict rank first). Not for bondbuilder (ideal only, `bondbuilder.ts:183-188`), deep_cleansing, heat_protectant, scalp_care, dry_shampoo.
- Stage 1 preview allows supportive for basis and optional tiers (`authorities.ts:115-124`), contradicting the Mask v4 plan ("Basis remains ideal-only").
- Alternatives: `fit-comparison.ts:546-551` drops any candidate not ideal/supportive → mismatch and unknown never appear as alternatives; web needs `targetMatchCount > 0` (`:417-420`), native does not; limits web 3 / native 5.
- Budget policy consumes the fit-ranked list and never re-ranks by fit (`fit-comparison.ts:396-399`, `budget-policy.ts:149,166-175`).
- Unknown: owned with missing facts → `status:"unknown"`, only leave_uncovered; uncovered slot with no candidate → `verdict:"unknown"`, recommendation null; can never be an alternative or `owned_active`.

## 5. Documented intent (quotes)

- `docs/personal-plan/categories/category-design-framework.md:173-180`: labels `ideal → passt sehr gut; supportive → passt mit Einschränkung; mismatch → wechseln empfohlen; unknown → noch in Prüfung`; "allow a supportive new recommendation only when no ideal candidate exists and its limitation is explicit. Never recommend a mismatch or unknown product confidently." Layered model `:165-169`: (1) strict suitability and safety, (2) core formula/role fit, (3) need and functional coverage, (4) aggregate verdict and precedence.
- `conditioner/decision.md:248-249`: "`suitable_thicknesses = null` means not verified … a non-empty verified array must contain the user's `thickness`." "A verified exclusion is a hard mismatch even when the formula weight looks close." `:263`: "Thickness remains a separate strict product-suitability gate." `:276-282` level definitions + precedence: unresolved identity; safety; strict thickness; hard core/repair; missing data; supportive deviations; ideal.
- `mask/decision.md:301,324-325,346`: thickness strict gate; supportive = near-match on a core axis; mismatch includes two-level weight gap; owned supportive mask may stay primary.
- `shampoo/decision.md:129,156`; `oil/decision.md:331,419`; `leave-in/decision.md:62,391`; `bondbuilder/decision.md:254-278`; `dry-shampoo/decision.md:188-192,229`; `heat-protectant/decision.md:159`.
- Research standards: `conditioner-classification-standard.md:272` and `mask-classification-standard.md:900`: thickness fit "is a desired-finish/dosage prior, not a universal exclusion"; mask: never worded as "fine hair must avoid masks".
- `plans/2026-08-15-personal-plan-mask-v4-independent-release.md:62-67`: "hard and fail-closed: … exact hair-thickness eligibility …"; "Basis remains ideal-only. Optional Mask alone may select the best verified image-backed supportive candidate".
- `plans/2026-08-12-personal-plan-stage3-durable-fit-review.md:235-240,340-344`: owned supportive/mismatch action matrix; supportive alternatives "Sehr passend" / "Trotz Einschränkung übernehmen" (not the shipped labels).
- `plans/verdict-layer/plan.md:11-12`: R12 mask care-direction alignment; R19 price never flips fit.

## Inconsistencies observed

1. Thickness differs by category: hard fail (shampoo, conditioner), P/U/F (mask), F-or-U flag (oil), not evaluated (leave-in, deep_cleansing), constant pass (bondbuilder), N/A (dry_shampoo, scalp_care, heat_protectant). No category emits caution for thickness.
2. Shampoo and conditioner thickness exclusions surface as a role/"Reinigungsaufgabe"/"Haardicke + Pflegerichtung" fail, not a thickness criterion, because non-matching rows are filtered before evaluation.
3. Research standards call thickness a dosage prior, not an exclusion; the authority code and every category decision doc make it a hard mismatch.
4. Leave-in docs say excluded thickness is a mismatch; code never compares thickness.
5. Mask docs say a two-level weight gap is a mismatch; code never emits fail for mask weight/care/repair. Conditioner and leave-in do fail at 2 steps.
6. Care direction `balanced`: non-decisive in conditioner, caution in leave-in, caution in mask unless in accepted set; Mask v4 plan says any known direction is ideal-compatible.
7. Oil owned weight: any mismatch → supportive, even two steps; candidate path excludes ≥2 steps.
8. Aggregation not shared; shampoo/conditioner/leave-in report only the first fail.
9. Scalp_care mismatch can carry a passing criterion.
10. Dry_shampoo has no supportive path in code; its doc defines one.
11. Heat-protectant, scalp_care, deep_cleansing have no supportive path; deep_cleansing declares unused facts.
12. "Uncovered slot" verdict meaning differs (mismatch+rec vs unknown+rec vs candidate verdict vs ideal/unknown).
13. Basis-mask ideal-only (plan) vs code allowing supportive for basis.
14. Documented labels ("passt sehr gut", "wechseln empfohlen", "noch in Prüfung") differ from shipped UI labels ("Passt", "Passt nicht", "Unklar"/none).
15. Chat vs Stage 3: fifth status, unknown acceptable for shampoo only, no thickness axis for mask/shampoo, mismatches surfaced as "Fallback".
16. `shampoo_dandruff` excludes supportive for new purchases but `supportiveOwnedRecommendation` can still surface one as an alternative.
17. Owned-mismatch allowed actions differ (leave_uncovered missing for mask, bondbuilder, deep-cleansing).
