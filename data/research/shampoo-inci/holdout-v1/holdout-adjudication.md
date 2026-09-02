# Shampoo holdout v1 — repeatability adjudication

Date: 2026-08-26  
State: internal research only; ten analyses remain provisional

## Result

All ten exact-product formula/analysis pairs pass the shared v1.3 validator, all ten blind-pass hashes and blind-to-final deltas are valid, and profile replay produced no identity or formula-conflict abstentions. Approval-state abstention is not an empirical check here: the report harness deliberately grants an in-memory validator-preview state after a provisional artifact passes validation. Independent second labeling reached 48/70 exact judgment matches (68.6%), below the pre-registered 75% overall bar. Six of seven judged properties meet the 60% per-property floor; `focusSecondary` does not (10%). Formula-derived `dandruffSupport` agreed for all ten products.

The holdout therefore **does not pass the repeatability gate**. This is not a reason to alter these ten answers until the metric passes. It is evidence that the current focus ontology and tie-breakers need hardening before automatic new-product classification.

## Adjudication

| Pattern | Classification | Evidence and action |
| --- | --- | --- |
| `focusSecondary` disagrees for 9/10 products | Systematic rule gap | Researchers treat the optional field differently: some use it for any plausible minor mechanism, others only for a distinct product role. Define a minimum independent signal and when the correct value is empty; then rerun all ten and the original cohort. |
| Moisture, curl and 2-in-1 products map inconsistently to `shine`, `repair` or `general` | Ontology/systematic rule gap | The current focus vocabulary has no moisture, curl-definition or conditioning focus. Decide whether these belong as new direct focuses or whether a locked projection table should map them to existing values. |
| ISANA MED differs on cleansing (`strong`/`moderate`), primary focus and usage | Product boundary plus tie-breaker gap | The formula chassis and daily/sensitive claim pull in different directions. Specify whether usage follows intended use unless a formula crosses a numerical strong-cleansing threshold, and publish that threshold. |
| Dove 2-in-1 differs on cleansing, weight, focus and usage | Product boundary plus net-formula gap | The strong detergent chassis and high-deposition 2-in-1 system need an explicit net-profile rule; a marketing “daily/non-weighing” claim cannot resolve it alone. |
| Kérastase and Traumlocken differ on weight | Product-specific boundary | Add examples around moderate/high deposition and low/moderate weight, but do not change the global scale from two examples alone. |
| Three identities have low source confidence | Source-quality limitation | Ducray, John Frieda and Dove remain usable provisional research records, but exact pack or German manufacturer formula evidence would be required to raise identity confidence. |

## Stable parts of the method

- `scalpComfortTarget`: 10/10 agreement.
- `conditioningLevel`: 9/10 agreement.
- `cleansingStrength`: 8/10 agreement.
- `weightPotential` and `usageRole`: 7/10 each.
- `focusPrimary`: 6/10, exactly at the minimum and therefore still a hardening priority.
- `dandruffSupport`: 10/10 under the locked Piroctone Olamine / Climbazole rule.

## Required next gate

Before using this as an automatic Product Intake classifier, amend the normative standard for secondary-focus inclusion, moisture/curl/2-in-1 projection, and the two net-formula tie-breakers above. Then independently rerun all ten products without exposing either prior label set. The same 75% overall and 60% per-property thresholds apply. Nick's product-by-product approval remains separate even if repeatability later passes.
