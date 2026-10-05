# v1.6 candidate: decisions for Nick

Five choices change which shampoos people see. The candidate standard picks the cautious option for each one, because a rule we're unsure about must never recommend more products. Each answer below is either "keep the cautious option" or "you accept a wider rule".

**How the counts were made:** the new hair-thickness rule applied to the 46 recommended products that already have v1.4 research, using the live snapshot from 2026-10-05. Each product keeps its current scalp group. "7 → 1" means 7 recommended products serve that hair-thickness × scalp combination today, and 1 would under the candidate. These are estimates only: v1.6 research may change individual product values.

What the candidate does overall: fewer fine-hair matches, many more normal-hair matches (normal + balanced scalp goes 4 → 11), and fewer thick-hair matches.

## 1. Should a "moderately heavy" shampoo count as right for fine hair?

**Example:** Neqi Volume Victory is a volume shampoo. Today it's recommended for fine hair. Its formula is rated "moderate" weight, meaning some residue is likely but limited.

- **Cautious (in the candidate):** moderate weight is not a default fine-hair match. Fine + balanced scalp goes 7 → 1, and fine + dandruff goes 4 → 2. No combination is left empty.
- **Wider:** moderate weight still counts for fine hair unless the formula is also highly conditioning. Fine + balanced scalp goes 7 → 11.
- **Earlier judgments split 3 to 2:** the 10-product calibration said "not ideal" three times, while the 5-product pilot said "ideal" twice for formulas rated the same way.

**Recommendation:** keep the cautious rule for now. Put at least three fine-hair, moderate-weight products in the gold set, and decide at lock time based on what that calibration shows.

## 2. Should a "heavy" shampoo count as right for normal hair?

**Example:** OGX Renewing + Argan Oil is recommended for normal hair today. Its formula is rated "high" weight, meaning hair is likely to lose movement.

- **Cautious (in the candidate):** heavy formulas only fit thick hair. Normal + balanced scalp loses OGX Renewing, and normal + oily scalp loses Monday Volume. Both combinations still grow overall because of the moderate-weight products.
- **Wider:** heavy formulas still count for normal hair unless they're also highly conditioning.
- **Earlier judgments split 2 to 2.**

**Recommendation:** keep the cautious rule. Few products are affected, and normal hair has plenty of other options.

## 3. Should a moderately conditioning shampoo count as right for thick hair?

**Example:** Head & Shoulders Anti Schuppen Sensitive is today's thick-hair anti-dandruff pick, and its conditioning is "moderate".

- **Cautious (in the candidate):** only highly conditioning or heavy formulas are a default thick-hair match. Thick + dandruff goes 2 → **0**, which triggers your D9 rule (no combination may lose its last product). Thick + sensitive scalp goes 2 → 1, and curl shampoos like Cantu lose thick-hair eligibility.
- **Wider, only for scalp products:** for anti-dandruff and sensitive-scalp shampoos, moderate conditioning counts for thick hair. Thick + dandruff becomes about 5.
- **Wider, for everything:** thick + balanced scalp goes 4 → 10.

**Recommendation:** use the scalp-products-only version. Dandruff and sensitive-scalp care don't depend on how thick the hair is, and the conditioner step covers the lengths. The pilot already reasoned this way for Head & Shoulders Classic Clean. This widens the rule, so it needs your explicit yes.

## 4. Can a heavy volume shampoo be the oily-scalp pick?

**Example:** Monday Volume Kraft & Fülle is the **only** recommended thick-hair + oily-scalp shampoo (added in PR #449 to fill that gap). Its formula is rated "high" weight.

- **Cautious (in the candidate):** an oily-scalp pick must not be heavy, because residue at the roots works against the claim. Monday is held for your review and proposed as thick hair + balanced scalp only. That leaves thick + oily **empty** (D9).
- **Wider:** the oily-scalp claim wins even when the formula is heavy.

**Recommendation:** keep the cautious rule. Rule on Monday individually under D9: either keep its oily row as a documented one-off exception until a replacement exists, or accept the gap. Then look for a lighter thick-hair oily-scalp shampoo among the paused new products (Track B).

## 5. Do "Tiefenreinigung" (deep-cleansing) products stay regular shampoos?

**Example:** Balea Tiefenreinigung is a recommended fine-hair + oily-scalp shampoo today.

- **Candidate:** a product sold as deep cleansing ("Tiefenreinigung", "Clarifying", or "1× pro Woche" on the pack) with a strong reset formula moves to the deep-cleansing category, out of regular shampoo. Fine + oily goes 5 → 4. Herbal Essences Tiefenreinigung (not recommended) moves too. Wahre Schätze Aktivkohle depends on its exact pack wording.
- **Alternative:** keep them as regular shampoos with "clarifying" cleansing.

**Recommendation:** move them out, since their own name says reset product. But only apply this once the deep-cleansing category can actually show them to users. Until then, leave their live rows unchanged.

## Earlier rules proposed for re-testing

None. The two rules v1.4 rejected (counting ingredient routes to set weight, and "a polymer means moderate weight") are not needed to answer any question above.
