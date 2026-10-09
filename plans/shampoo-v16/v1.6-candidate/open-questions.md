# v1.6 candidate: what is still open

The five earlier questions are all decided (rulings R2–R6, 2026-10-07, in `../rulings.md`) and are written into the standard:

| Earlier question | Ruling | Where in the standard |
| --- | --- | --- |
| Moderate-weight shampoo for fine hair | R2: amber (shown, ranked lower) | T1, T5, W-LIVE |
| Heavy shampoo for normal hair | R3: amber | T1 |
| Moderate-conditioning shampoo for thick hair, scalp products | R4: thickness never hides a scalp-concern product | T6 |
| Heavy volume shampoo as the oily-scalp pick (Monday) | R5: temporary named exception + no-gap rule | S-OILY, 13.11 N1, 13.12 X1 |
| "Tiefenreinigung" products | R6: stay regular shampoos (`clarifying`) and also get a deep-cleanser entry | I1, D2, D3 |

Questions 1 and 2 remain from the R2–R6 round. Neither blocks the calibration lanes, because both concern how the live app shows a result, not how a product is classified. Both must be settled before the R2 PR (new `weight` column + shampoo rule) ships.

Questions 3–5 are new (2026-10-09, after calibration round 1). Each came up while closing a round-1 ambiguity and would change what users see, so it is left for you. Until you rule, the standard applies the cautious answer described under each question, so round 2 can run without them.

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

## 3. A "Tiefenreinigung" name on an ordinary-strength formula: deep-cleanser entry or not?

Round 1 showed that a deep-cleansing name can sit on a completely ordinary formula. The standard now judges cleansing strength from the formula only (a name or claim can no longer make it "strong"). So a product can be called "Tiefenreinigung" while its formula reads as normal strength.

- **Example:** a shampoo named "Tiefenreinigung" whose formula is the everyday SLES-plus-betaine base found in most drugstore shampoos.
- **What happens now:** it stays a normal regular shampoo (normal strength, shown green where it fits). It is not flagged for a deep-cleanser entry, because that needs a strong formula. It gets a review flag, so it waits for you product by product.
- **The question:** should such a product ever get a deep-cleanser entry because of its name?

**Recommendation:** no. Give a deep-cleanser entry only when the formula is actually strong. The product keeps its regular-shampoo entry as a normal-strength shampoo. Then the per-product review flag becomes a note, and you stop seeing these one by one.

## 4. Can the ingredient lists for sensitive and dry scalp grow?

A sensitive- or dry-scalp product only gets that scalp target when one of a short, fixed list of soothing or moisturising ingredients sits high in the ingredient list (before the perfume). In round 1 the two classifiers handled other plausible ingredients differently. The standard now says: a classifier never counts an ingredient that is not on the list. Instead it raises a review flag naming the ingredient.

- **Example:** a "für empfindliche Kopfhaut" shampoo whose main soothing ingredient is aloe vera juice, listed second, with panthenol only after the perfume. Aloe is not on the list, so the product gets no sensitive-scalp target. It is flagged for you with "aloe barbadensis leaf juice" named.
- **The question:** do you want to add ingredients to the lists, and if so which?

**Recommendation:** keep the lists closed for round 2. Afterwards, collect every ingredient the flags name and decide on additions in one batch. An addition then applies to every product, never to one product.

## 5. Strong shampoo for oily scalp: green or amber for oily-scalp users?

Round 1 showed that oily-scalp positioning could be read as two different focus values. The standard now settles it the way its own definition already said: oily scalp belongs to the "clarifying" focus. One consequence follows from an existing rule. A strong-cleansing shampoo with oily-scalp wording is treated as a reset-type product, so its cleansing level is recorded as "clarifying". The oily-scalp profile expects "regular", so the product shows amber for oily-scalp users.

- **Example:** an "Anti-Fett" shampoo with a strong sulfate base and no milder co-cleanser. Now: amber for oily scalp, at every hair thickness.
- **Option A (current, cautious):** keep amber. It is honest that the product cleans harder than an everyday shampoo.
- **Option B:** only explicit deep cleansers ("Tiefenreinigung", "1× pro Woche") are recorded as "clarifying". A strong oily-scalp shampoo is recorded as "regular" and shows green for oily scalp.

**Recommendation:** B. A strong cleanser is what the oily-scalp profile is for. Showing those products amber to exactly those users looks like a mistake to them. B shows more products as green, so it needs your ruling; until then A applies.

