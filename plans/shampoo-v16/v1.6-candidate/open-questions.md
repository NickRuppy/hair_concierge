# v1.6 candidate: what is still open

The five earlier questions are all decided (rulings R2–R6, 2026-10-07, in `../rulings.md`) and are written into the standard:

| Earlier question | Ruling | Where in the standard |
| --- | --- | --- |
| Moderate-weight shampoo for fine hair | R2: amber (shown, ranked lower) | T1, T5, W-LIVE |
| Heavy shampoo for normal hair | R3: amber | T1 |
| Moderate-conditioning shampoo for thick hair, scalp products | R4: thickness never hides a scalp-concern product | T6 |
| Heavy volume shampoo as the oily-scalp pick (Monday) | R5: temporary named exception + no-gap rule | S-OILY, 13.11 N1, 13.12 X1 |
| "Tiefenreinigung" products | R6: stay regular shampoos (`clarifying`) and also get a deep-cleanser entry | I1, D2, D3 |

Two smaller questions remain. Neither blocks the calibration lanes, because both concern how the live app shows a result, not how a product is classified. Both must be settled before the R2 PR (new `weight` column + shampoo rule) ships.

## 1. How does the app turn "weight" into green or amber?

R2 says to judge shampoo weight "like the conditioner". Copied exactly, the conditioner rule would disagree with the thickness table you approved in two places:

- **Normal hair + light shampoo.** Example: Salthouse Anti Schuppen (light, per its v1.4 research) for a normal-hair user. The table says green. A conditioner copy says amber, because the conditioner's target for normal hair is "medium".
- **Thick hair + light shampoo.** Example: a light curl shampoo, or Salthouse Anti Schuppen, for a thick-hair user. The table says amber (or green if it is very caring). A conditioner copy says it's two steps off, so it's hidden. For a dandruff or sensitive-scalp product that would break R4.

The conditioner also moves its target when someone says their hair goes flat. If the shampoo did the same, the app would show different colors than the research decided.

**Recommendation:** the app uses the thickness table, not a conditioner copy. If a product has a row for your thickness, it's shown; it's green when its weight is right for that thickness (fine: light; normal: light or moderate; thick: heavy), otherwise amber. No adjustment for "goes flat". One small known gap: a light but very caring shampoo is green for thick hair in the research but would show amber in the app, because the app has no conditioning field. That errs on the careful side, so I'd accept it rather than add a second column. (Standard T7.)

## 2. Should Monday Volume show green or amber for thick hair + oily scalp?

Monday is the only thick-hair + oily-scalp pick and is kept only through the temporary exception X1. By the weight rule it's a perfect thick-hair match (heavy), so the app would show it **green**. You said the exception "doesn't sound good".

- **Green (in the candidate):** no special case in the app. It's temporary anyway and goes as soon as a lighter replacement passes review. Any replacement will show amber, because an oily-scalp shampoo can't be heavy or very caring.
- **Amber:** more honest about the compromise, but needs a one-product rule in the app's code.

**Recommendation:** keep green and focus on finding the replacement (Track B, cell C2).

## Earlier rules proposed for re-testing

None. The two rules v1.4 rejected (counting ingredient routes to set weight, and "a polymer means moderate weight") are not needed for anything above.
