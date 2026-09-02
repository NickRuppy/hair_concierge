# Weight rerun: interpretation and remaining limits

The original two label sets and policy are frozen. This note interprets the result; it does not change either researcher's answers or tune the policy to improve agreement.

## Why two labels changed

- **ISANA Professional Plex: high → moderate.** Multiple proteins do not become multiple persistent weight routes. The explicit policy identifies one substantive cationic-polymer route; proteins and the lipid/refatting route remain weak. Rich care positioning is not another route.
- **Jean&Len Repair Dattel & Vanille: high → moderate.** Early PEG-40 Hydrogenated Castor Oil is a solubilizer, not an oil payload. PEG-18 Glyceryl Oleate/Cocoate belongs to the weak refatting route. The actual oil is later in the list. One substantive cationic route remains; the other evidence does not pass the prominent-payload rule. Exact formula identity is still low confidence independently of this classification.

NIVEA Classic Care and Balea Oil Repair retain high weight under this heuristic: each has an early eligible oil payload plus a cationic-polymer route. The other six retain moderate. These are architectural approximations, not measurements of how heavy each shampoo will feel.

## Shared reviewer caveat: Carbomer

Both fresh researchers flag Carbomer in Garnier Fructis Kraft & Glanz as an unlisted polymer function. The literal evaluator recognition patterns do not identify the name as a gap, but all three still classify the formula as moderate and agree on its counted routes. The report preserves this difference and marks the product for research follow-up; final-label agreement must not hide incomplete recognition coverage.

A post-comparison supplier check confirms why this should not be resolved by a blanket rule. [Lubrizol's Carbopol Clear page](https://www.lubrizol.com/solutions/products/beauty/detail-pages/carbopol-clear-polymer) describes Carbomer primarily for rheology, suspension and thickening. [Its Carbopol Silk 100 page](https://www.lubrizol.com/solutions/products/beauty/detail-pages/carbopol-silk-100-polymer) also describes grade-specific coacervation/deposition enhancement. These are supplier claims about specific ingredients, **not evidence that this Garnier formula uses either grade or has higher weight**.

Decision for this frozen run: retain moderate, retain the reviewers' caveat, and do not add an automatic Carbomer weight vote. A later dictionary revision should describe rheology polymers and their possible supporting roles explicitly. Neither a high-confidence exclusion nor a weight upgrade is established from the generic INCI name alone.

## What the experiment establishes

All ten labels and all counted route extractions agree between two fresh labelers and the deterministic implementation. The window-sensitivity cross-check agrees for nine of ten products. This is clearer operational repeatability, not proof of high real-world accuracy. Both labelers used the same model lineage and formula packet; the main session had seen prior results while defining the calibration. Prior v2 labels had access to positioning whereas this rerun was formula-only, so the improvement cannot be attributed solely to one rule change.

**alverde Nutri Care sensitivity check:** rater A reports low at window 8 by dropping weak refatters outside that window. The frozen policy's window controls whether a payload is substantive; it does not delete weak routes. Rater B and the evaluator therefore retain moderate at all three windows. This is a recorded operator error in the sensitivity subcheck, not a dispute about the baseline moderate label. Retain the original answer and report 9/10 sensitivity agreement; no label or policy rewrite.

No low-weight or silicone-containing product occurs in this ten-product set. Synthetic tests cover those mechanics, not their real-world calibration. Source identity remains one high, eight moderate and one low. INCI-only product confidence is capped at moderate, regardless of researcher agreement. No approvals, original audits, live fits or database entries were changed.

## Implementation/process notes

The evaluator's first implementation incorrectly flagged recognized oils as unknown and subsequently overmatched Piroctone Olamine as a conditioning amine. Both were fixed against synthetic regression cases to conform to the already-frozen policy; no classification threshold or labeler answer was changed. The independent outputs remained hash-pinned throughout integration.

One rater reported creating then removing an accidental root-checkout copy of its new output; the final output resides only in the assigned worktree. No existing root file was replaced. Final root status is checked separately.
