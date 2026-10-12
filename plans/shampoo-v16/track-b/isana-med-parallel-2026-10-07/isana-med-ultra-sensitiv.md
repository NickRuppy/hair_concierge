# ISANA MED Shampoo Jeden Tag (Ultra Sensitiv): consultant brief

**Identity:** Rossmann private label, 200 ml, 1,79 €, EAN 4305615629223 (Art.-Nr. 042817). This is not the urea "Shampoo Jeden Tag" (EAN …216). Checked live on rossmann.de on 2026-10-06. The INCI matches the 2026-09-02 capture and codecheck (edited by Rossmann in Feb 2026).

**INCI headline (16):** Aqua, **Sodium Laureth Sulfate (2)**, Glycerin (3), Cocamidopropyl Hydroxysultaine (4), Sodium Chloride, Coco-Glucoside (6), Glyceryl Oleate (7), **Panthenol (8), Allantoin (9)**, **Guar HPTC (10)**, … Sodium Benzoate (16).
- No fragrance, no silicone. Pack front: "Ultra Sensitiv · Allantoin · Allergie getestet · 0% Parfüm/Farbstoffe/Silikon".
- The sensitive-scalp claim ("sehr sensible und empfindliche Kopfhaut") appears on rossmann.de only, not on the pack front.

## Classification (v1.6 candidate, not locked)

| Property | Value | Conf. | Why |
| --- | --- | --- | --- |
| Cleansing | moderate | mod | SLES primary, softened by a sultaine, a glucoside and a refatter (C1). Neighbour: low |
| Conditioning | moderate | mod | One guar conditioner plus light refatting. No silicone |
| Weight | low | mod | One light deposit in an effective wash base. Neighbour: moderate |
| Focus primary | scalp_active | mod | Explicit sensitive-scalp positioning with a supportive formula |
| Focus secondary | — | mod | Anti-drying claim uses the same routes (F2) |
| Usage role | frequent | mod | "Jeden Tag" in the name and cleansing not strong |
| Scalp comfort | targeted | high | Fragrance-free, Allantoin and Panthenol, softened sulfate |
| Dandruff support | not_supported | high | No Piroctone Olamine or Climbazole |

## Projection

| Field | Result |
| --- | --- |
| Thickness | fine **ideal** (flag T4), normal **ideal**, coarse conditional (T1; OQ3 cautious default) |
| Scalp target | **sensitive** → irritationen/irritated (S-SENSITIVE, E1 moderate). Dry secondary **not** emitted (claim isn't E2 lexicon, P0) |
| Intensity | **regular** (I1). The irritationen bucket expects gentle, so the match is "supportive" |
| Reset | false |
| Rows | fine + normal × irritationen / irritated / regular |
| Review flags (blocking) | `review_thickness_boundary` (fine), `review_intensity_boundary` |

## Fit for Viola: **keep, with conditions**

It's light, so it won't flatten fine waves. It's fragrance-free and comfortable for her dry-feeling scalp. Its moderate cleansing also removes film from the glaze mask, leave-in and oil.

It is **not** the fix for her dry, frizzy, snapping lengths:
- It's an ordinary sulfate shampoo, not ultra-mild, and gives only moderate care to the lengths.
- On bleached hair, she should wash the scalp only and let the foam rinse through the lengths. One lather, no scrubbing.
- The "sensitive" label is more than she needs; it does no harm.
- Lost wave shape more likely comes from weight (glaze + oil on fine, dense hair) than from this shampoo.

Swap to a lower-cleansing shampoo if her scalp feels tight, her lengths feel squeaky or straw-like after washing, or her colour fades fast.

Note: our projection gives it only a sensitive-scalp row, so the app wouldn't suggest it for her dry-scalp profile.

**Ask in the call:**
1. Which shampoo do you use for your other weekly wash, and why do you switch?
2. How do you wash: scalp only or the lengths too, once or twice? How does your scalp feel afterwards?
3. Do you use the Syoss glaze mask every time instead of conditioner, and how much oil? Are your waves flatter afterwards?

*Open issues:* the scalp claim and "Jeden Tag" were not seen on the pack front (pack back not checked). Skinsignal lists an undated variant with a different preservative; it was not merged and wouldn't change any property. This was not a sealed blind lane.
