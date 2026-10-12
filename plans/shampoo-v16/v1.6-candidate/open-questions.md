# v1.6 candidate: what is still open

The five earlier questions are all decided (rulings R2–R6, 2026-10-07, in `../rulings.md`) and are written into the standard:

| Earlier question | Ruling | Where in the standard |
| --- | --- | --- |
| Moderate-weight shampoo for fine hair | R2: amber (shown, ranked lower) | T1, T5, W-LIVE |
| Heavy shampoo for normal hair | R3: amber | T1 |
| Moderate-conditioning shampoo for thick hair, scalp products | R4: thickness never hides a scalp-concern product | T6 |
| Heavy volume shampoo as the oily-scalp pick (Monday) | R5: temporary named exception + no-gap rule | S-OILY, 13.11 N1, 13.12 X1 |
| "Tiefenreinigung" products | R6: stay regular shampoos (`clarifying`) and also get a deep-cleanser entry | I1, D2, D3 |

Two questions from calibration round 2 are also decided (rulings of 2026-10-09) and written into the standard:

| Question | Ruling | Where in the standard |
| --- | --- | --- |
| Do trace glycols or aloe juice count as the "humectants" in the high-conditioning rule? | R11: no; a deliberate humectant such as glycerin or panthenol is needed | C2 (humectant element) |
| Dandruff shampoo with soothing words next to its dandruff claim (e.g. "Deine juckende Kopfhaut wird beruhigt") | R12 option A: shown for dandruff only; the research record notes that it also suits an irritated scalp, for a later profile feature | E2b, `researchCombinationTargets`, S-SECONDARY |

Questions 3–6 are decided too (rulings R15 and R16, 2026-10-10) and are written into the standard, which is now locked as v1.6 (R14):

| Question | Ruling | Where in the standard |
| --- | --- | --- |
| 3. "Tiefenreinigung" name on an ordinary-strength formula | R16.3: no deep-cleanser entry; the product keeps its regular-shampoo entry at normal strength; the review flag becomes an informational note | Scope, U5, D2, D3, 13.9 (`deep_cleansing_name_ordinary_formula`) |
| 4. Can the sensitive/dry-scalp ingredient lists grow? | R16.4: the E4, C2 humectant and CSA lists stay closed and unchanged; flagged candidates are collected during the Track A/B research and additions are decided in one batch afterwards (deferred, not rejected) | C2, CSA, E4 |
| 5. Strong oily-scalp shampoo: green or amber? | R16.2 (option B): only explicit deep cleansers (D1) record `clarifying`; a strong oily-scalp shampoo without D1 records `regular` and shows green for oily scalp | I1, F6, U4, 13.8 |
| 6. Anti-dandruff shampoo with its own sensitive- or dry-scalp claim | R15 (option B, sensitive) and R16.1 (dry): a `dandruff`-primary product never projects a secondary `sensitive` or `dry` target; the fit is kept as research-only `researchCombinationTargets` | E2b, S-SECONDARY, S-FAIL, SC1, 1.2, 13.8, 13.9 |

**Still open: questions 1 and 2.** Both concern how the live app shows a result, not how a product is classified, so they did not block calibration or the lock. They belong to the later app PR (the R2 PR: new `weight` column + shampoo authority rule) and must be settled before it ships.

## 1. How does the app turn "weight" into green or amber? — OPEN (later app PR)

R2 says to judge shampoo weight "like the conditioner". Copied exactly, the conditioner rule would disagree with the thickness table you approved in two places:

- **Normal hair + light shampoo.** Example: Salthouse Anti Schuppen (light, per its v1.4 research) for a normal-hair user. The table says green. A conditioner copy says amber, because the conditioner's target for normal hair is "medium".
- **Thick hair + light shampoo.** Example: a light curl shampoo, or Salthouse Anti Schuppen, for a thick-hair user. The table says amber (or green if it is very caring). A conditioner copy says it's two steps off, so it's hidden. For a dandruff or sensitive-scalp product that would break R4.

The conditioner also moves its target when someone says their hair goes flat. If the shampoo did the same, the app would show different colors than the research decided.

**Recommendation:** the app uses the thickness table, not a conditioner copy. If a product has a row for your thickness, it's shown; it's green when its weight is right for that thickness (fine: light; normal: light or moderate; thick: heavy), otherwise amber. No adjustment for "goes flat". One small known gap: a light but very caring shampoo is green for thick hair in the research but would show amber in the app, because the app has no conditioning field. That errs on the careful side, so I'd accept it rather than add a second column. (Standard T7.)

## 2. Should Monday Volume show green or amber for thick hair + oily scalp? — OPEN (later app PR)

Monday is the only thick-hair + oily-scalp pick and is kept only through the temporary exception X1. By the weight rule it's a perfect thick-hair match (heavy), so the app would show it **green**. You said the exception "doesn't sound good".

- **Green (in the candidate):** no special case in the app. It's temporary anyway and goes as soon as a lighter replacement passes review. Any replacement will show amber, because an oily-scalp shampoo can't be heavy or very caring.
- **Amber:** more honest about the compromise, but needs a one-product rule in the app's code.

**Recommendation:** keep green and focus on finding the replacement (Track B, cell C2).

## Earlier rules proposed for re-testing

None. The two rules v1.4 rejected (counting ingredient routes to set weight, and "a polymer means moderate weight") are not needed for anything above.

## 3. A "Tiefenreinigung" name on an ordinary-strength formula: deep-cleanser entry or not? — RULED (R16.3, 2026-10-10): no deep-cleanser entry; the flag becomes a note

Round 1 showed that a deep-cleansing name can sit on a completely ordinary formula. The standard now judges cleansing strength from the formula only (a name or claim can no longer make it "strong"). So a product can be called "Tiefenreinigung" while its formula reads as normal strength.

- **Example:** a shampoo named "Tiefenreinigung" whose formula is the everyday SLES-plus-betaine base found in most drugstore shampoos.
- **What happens now:** it stays a normal regular shampoo (normal strength, shown green where it fits). It is not flagged for a deep-cleanser entry, because that needs a strong formula. It gets a review flag, so it waits for you product by product.
- **The question:** should such a product ever get a deep-cleanser entry because of its name?

**Recommendation:** no. Give a deep-cleanser entry only when the formula is actually strong. The product keeps its regular-shampoo entry as a normal-strength shampoo. Then the per-product review flag becomes a note, and you stop seeing these one by one.

**Ruling (R16.3):** as recommended. A "Tiefenreinigung"-type name on an ordinary-strength formula keeps only its regular-shampoo entry at normal strength; no deep-cleanser entry; the review flag becomes the informational note `deep_cleansing_name_ordinary_formula` (D3).

## 4. Can the ingredient lists for sensitive and dry scalp grow? — RULED (R16.4, 2026-10-10): lists stay closed for now; additions deferred to one batch decision after the Track A/B research

A sensitive- or dry-scalp product only gets that scalp target when one of a short, fixed list of soothing or moisturising ingredients sits high in the ingredient list (before the perfume). In round 1 the two classifiers handled other plausible ingredients differently. The standard now says: a classifier never counts an ingredient that is not on the list. Instead it raises a review flag naming the ingredient.

- **Example:** a "für empfindliche Kopfhaut" shampoo whose main soothing ingredient is aloe vera juice, listed second, with panthenol only after the perfume. Aloe is not on the list, so the product gets no sensitive-scalp target. It is flagged for you with "aloe barbadensis leaf juice" named.
- **The question:** do you want to add ingredients to the lists, and if so which?

**Recommendation:** keep the lists closed for round 2. Afterwards, collect every ingredient the flags name and decide on additions in one batch. An addition then applies to every product, never to one product.

Since round 2 the same closed-list approach also covers two related checks: the humectants that count for the high-conditioning rule (C2, ruling R11) and the "credible supportive architecture" a sensitive-scalp product needs (CSA). A batch decision on additions should cover all three lists at once.

**Ruling (R16.4):** the E4, C2 humectant and CSA lists stay closed and unchanged in v1.6. The ingredients the flags name (`unlisted_route_candidate:<INCI name>`) are collected during the Track A/B research; additions are decided in one batch afterwards and then apply to every product. This item is deferred, not closed: the batch decision is still to come.

## 5. Strong shampoo for oily scalp: green or amber for oily-scalp users? — RULED (R16.2, 2026-10-10): option B (green)

Round 1 showed that oily-scalp positioning could be read as two different focus values. The standard now settles it the way its own definition already said: oily scalp belongs to the "clarifying" focus. One consequence follows from an existing rule. A strong-cleansing shampoo with oily-scalp wording is treated as a reset-type product, so its cleansing level is recorded as "clarifying". The oily-scalp profile expects "regular", so the product shows amber for oily-scalp users.

- **Example:** an "Anti-Fett" shampoo with a strong sulfate base and no milder co-cleanser. Now: amber for oily scalp, at every hair thickness.
- **Option A (current, cautious):** keep amber. It is honest that the product cleans harder than an everyday shampoo.
- **Option B:** only explicit deep cleansers ("Tiefenreinigung", "1× pro Woche") are recorded as "clarifying". A strong oily-scalp shampoo is recorded as "regular" and shows green for oily scalp.

**Recommendation:** B. A strong cleanser is what the oily-scalp profile is for. Showing those products amber to exactly those users looks like a mistake to them. B shows more products as green, so it needs your ruling; until then A applies.

**Ruling (R16.2):** option B. Only explicit deep cleansers (D1 true: "Tiefenreinigung", "Clarifying", "1× pro Woche" …) with a strong formula record `cleansing_intensity = clarifying`. A strong-cleansing oily-scalp shampoo without D1 records `regular` and shows green for oily scalp (I1).

## 6. Anti-dandruff shampoo with its own "für empfindliche Kopfhaut" claim: show it to people with only an irritated scalp? — RULED (R15, 2026-10-10: option B for the sensitive case; R16.1, 2026-10-10: the same for the dry case)

R12 keeps an anti-dandruff shampoo away from people who only have an irritated scalp when the soothing words sit next to its dandruff claim. An older rule still applies when the soothing claim stands on its own: if the shampoo's own page has a separate section such as "Für empfindliche Kopfhaut" and the formula has a soothing ingredient high in the list (panthenol, allantoin and similar), the product also gets irritated-scalp rows. People with only an irritated scalp then see an anti-dandruff shampoo. The same holds for a separate dry-scalp claim and dry-scalp users.

- **Example:** an "Anti-Schuppen" shampoo whose maker's page says "Gegen Schuppen" in the headline and, in a separate bullet list further down, "Für empfindliche Kopfhaut"; panthenol is listed before the perfume. Now: shown to dandruff users and, as a second scalp target, to irritated-scalp users.
- **Option A (current, unchanged by R12):** keep it. Irritated-scalp users get more choices.
- **Option B:** treat it like R12. Dandruff rows only; the irritated-scalp fit is kept in the research record for the later profile feature.

**Recommendation:** B. R12's reason, that someone with only an irritated scalp should not get an anti-dandruff active, applies whether the soothing claim is next to the dandruff claim or further down the page; that is a layout difference, not a product difference. B removes rows, so the no-gap check (N1) must confirm the irritated-scalp cells stay filled before any apply (baseline 2026-10-05: fine 5, normal 3, coarse 2). Until you rule, A applies, because R12 ruled only the next-to-the-claim case.

**Ruling (R15, R16.1):** option B, for both cases. Anti-dandruff is the path: a product whose primary target is dandruff never projects a secondary sensitive (R15) or dry (R16.1) target. A separate sensitive- or dry-scalp claim whose formula passes the matching formula check is kept as research-only `researchCombinationTargets` (`"sensitive"`, `"dry"`) for the later profile feature (E2b). N1 must still confirm the irritated- and dry-scalp cells stay filled before any apply.
