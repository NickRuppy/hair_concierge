# Research: wash frequency for a dry scalp, and whether hair texture changes it

Date: 2026-10-11. Scope: research only. No code or docs changed. Resolves audit item N7 in `shampoo.md`.

## 1. Question and the two competing rules

How often should someone with a **dry scalp** (quiz answer "Eher trocken": *spannt manchmal oder fühlt sich rau an*) wash, and does texture change that?

| Source | Dry scalp, straight/wavy | Dry scalp, curly/coily/unknown |
|---|---|---|
| `docs/personal-plan/categories/shampoo/decision.md` (confirmed v3), cadence table | 1×/week (range: every 2 weeks to 1×/week) | same |
| Nomi T4 ruling 2026-10-09 (`plans/nomi-consult-finish/plan.md`), code in `src/lib/personal-plan/needs.ts:160-184` | 2×/week (range: 1× to 3–4×/week) | 1×/week (range: every 2 weeks to 1×/week) |

The path in the brief (`categories/shampoo/needs.ts`) does not exist. The rule lives in `src/lib/personal-plan/needs.ts`. The legacy `recommendation-engine/shampoo-cadence.ts` sends every dry scalp to the `low` band, a third answer.

The two rules matter most through `nearest_boundary`. Under decision.md, a dry-scalp user who washes 2–3×/week today is told to cut to 1×/week.

## 2. What the repo already concluded

- `shampoo/evidence.md` §4: there is "no well-supported universal … fixed wash frequency for self-reported dry flakes". Its line 80 says the plan "should not claim that everybody with dry flakes must wash only once weekly". **decision.md's 1×/week ceiling contradicts the repo's own evidence file.**
- `goal-concern-levers/scalp-medical-adjacent.md` rates "shampoo less often for dry, textured, curly, coily, or thick hair" as **strong**, citing AAD. The AAD sentence is about dry *hair*, not a dry *scalp*. The label overstates the evidence for scalp cadence.
- The same file rates "training" the scalp by washing less as **unknown**, and says dandruff, seborrhoeic dermatitis, psoriasis and eczema cannot be told apart from chat text.
- `consult-knowledge/entries/wash-frequency-transition.md`: washing more often is unproblematic for most scalps if the shampoo is mild and goes on the scalp only. Reassess after 2–4 weeks.
- The T4 ruling rested on Punyani 2021, Fajuyigbe 2024 and AAD, rated "indirect, low–moderate confidence" by its own text. The scratchpad report behind it was not kept.

## 3. External evidence

| # | Claim | Source | Strength |
|---|---|---|---|
| E1 | No study tests wash frequency in people with a dry, non-dandruff scalp (xerosis). Every frequency study below uses healthy or dandruff scalps. | Searches of PubMed, Europe PMC and AAD/BAD/DermNet | Evidence gap |
| E2 | Dry scalp and dandruff look alike. The advice for a dry scalp is a gentle, non-medicated shampoo. No frequency is given. | [AAD dry-scalp conditions](https://www.aad.org/public/everyday-care/hair-scalp-care/scalp/dry-scalp-conditions) | Expert opinion |
| E3 | Wash based on oil and dirt. Oily straight hair may need daily washing. Dry, textured, curly or thick **hair**: wash when needed, at least every 2–3 weeks. | [AAD healthy-hair tips](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips), [AAD curly hair](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/curly-hair-care) | Expert opinion (about the hair fibre) |
| E4 | Healthy Asian scalps: daily washing beat once-weekly washing on all endpoints, with no objective hair damage. Satisfaction peaked at 5–6 washes/week. Work cited in the paper links less washing to more flaking, itch and Malassezia. | Punyani et al. 2021, *Skin Appendage Disord* 7:183, [doi:10.1159/000512786](https://doi.org/10.1159/000512786). Procter & Gamble authors. | Moderate for "frequent mild washing does not harm a healthy scalp". Weak for a dry scalp or for textured hair. |
| E5 | Healthy women: washing every 1–2 days raised scalp water loss (TEWL) at day 28 compared with every 3–5 days. Scalp hydration did not differ. | Mughni et al., *Int J Trichology* 2024;16(1):16 (n=60, hijab wearers, not randomised) | Weak, but it is the only barrier signal against frequent washing |
| E6 | Over-washing can strip the scalp's oil layer and worsen dermatoses. Mild everyday shampoos are designed for daily use. Use warm or cool water, not hot. | [DermNet: Shampoo](https://dermnetnz.org/topics/shampoo) | Expert opinion |
| E7 | Afro-textured hair: dandruff and itch return within about a week after washing. The authors recommend at least weekly washing. The study did not compare frequencies. | Fajuyigbe et al. 2024, *J Dermatol* 51:518, [doi:10.1111/1346-8138.17102](https://doi.org/10.1111/1346-8138.17102). n=60, L'Oréal-funded. | Weak to moderate |
| E8 | Afro-textured hair: wash every 1–3 weeks, depending on build-up and greasiness. Under-washing can cause or worsen seborrhoeic dermatitis. Over-washing dries the scalp and hair. AAD advises washing Black hair weekly or every other week. | [BAD patient information, 2023](https://www.skinhealthinfo.org.uk/condition/caring-for-afro-textured-hair/), [AAD Black hair](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/care-african-american) | Expert opinion (consistent across societies) |
| E9 | Many "dry scalp" complaints in Afro-textured hair are seborrhoeic dermatitis, typically washed every 2 weeks and oiled. The suggested treatment is temporary scalp shampooing twice a week. | R. Beach, Skin Spectrum Summit 2020 (conference report) | Expert opinion |
| E10 | Co-washing is gentle on curls but leaves build-up. | Gavazzoni Dias 2019, *Skin Appendage Disord* 5:131 | Expert opinion / narrative review |
| E11 | Sebum travels more slowly along tightly coiled fibres. | L'Oréal-sponsored feature; no peer-reviewed paper found | Weak |

**Consumer wording.** In consumer content and in clinic, "dry scalp" often means dandruff or seborrhoeic dermatitis (E2, E9). These conditions get **worse** with long gaps between washes (E4, E7, E8). The app separates the base "trocken" answer from the concerns *trockene Schuppen*, *Schuppen* and *gereizt*. That separation is sound, but a self-reported dry scalp will sometimes be mild dandruff.

## 4. Does texture change the answer?

**Yes, through the hair fibre and not through the scalp.**

- **Sebum travel.** Oil appears to reach the lengths more slowly on curly and coily hair (E11, weak). Straight and wavy hair therefore looks flat or greasy sooner. This is a cosmetic reason for more frequent washing, not a scalp-health reason.
- **Mechanical and hygral stress.** Each wet wash means swelling, detangling and drying. Curly and coily fibres are more fragile under this handling (E3, E8: expert consensus). That is the real reason textured hair gets longer intervals.
- **Co-washing practice.** Curly and coily routines use co-washing to stretch shampoo intervals (E10). This lowers surfactant exposure but adds scalp build-up, which the BAD links to seborrhoeic dermatitis (E8).
- **Scalp physiology.** No reliable evidence shows that a dry scalp needs a different cadence depending on hair pattern.

**Conclusion.** Texture should set how far apart washes may be, because of length care. Scalp state sets the minimum, because build-up and flaking get worse with long gaps. Shampooing only the scalp and conditioning the lengths makes more frequent washing cheap for any texture.

## 5. Recommendation for the app's rule (stated conservatively)

Confidence: **low.** No study addresses dry-scalp cadence directly. This is a judgement band built from expert consensus and indirect studies. It should be applied as **wide tolerated ranges**, so that users are rarely told to change a habit that is already reasonable.

| Texture, dry scalp | Preferred start | Tolerated range (keep if inside) | Change vs today |
|---|---|---|---|
| Straight / wavy | 2×/week | 1× to 3–4×/week | Keep T4 as is |
| Curly | 1×/week | Every 2 weeks to 2×/week | Proposal: widen the upper edge from 1× to 2× |
| Coily | 1×/week | Every 2 weeks to 1×/week | Keep |
| Unknown | 1×/week | Every 2 weeks to 2×/week | Proposal: use the curly band |

Supporting rules (all fit existing decision.md mechanisms):

1. **Gentleness over frequency.** Use a mild shampoo on the scalp only, lukewarm water, and conditioner on the lengths (E2, E6). Never present "wash less" as the fix for a dry scalp.
2. **Do not push frequent washers down without a symptom.** For a user at 3–4×/week with straight hair, `retain_in_range` is correct.
3. **Treat the upper edge as tolerated, not as a target.** E5 is the only barrier signal against near-daily washing.
4. **Escalate when the condition does not settle.** If flakes become greasy or yellowish, or itch or redness persists after 2–4 weeks of a gentle routine, re-ask the scalp concerns (Schuppen / gereizt). Do not lower the cadence further. If there is hair loss with scaling, or the condition is severe, point the user to a dermatologist (AAD, scalp-medical-adjacent.md).
5. **Keep the uncertainty internal.** The plan states the rhythm as a starting point with a 2–4 week check (consult-knowledge transition line), not as a medical rule. Per repo rulings, confidence labels are never shown to the user.

**Canonical rule.** Make the texture-split table canonical. The code (T4) is closer to the evidence than decision.md. Decision.md's flat 1×/week ceiling has no supporting source and contradicts `shampoo/evidence.md`. Update decision.md, fixture 6, and the strength label in scalp-medical-adjacent.md (it is strong for dry *hair*, expert opinion for a dry *scalp*). Widening the curly and unknown upper edge is a **proposal for Nick**, not a finding. The alternative is to keep T4 unchanged and only reconcile the documents.

## 6. What would change this recommendation

- A controlled wash-frequency study in people with xerotic, non-dandruff scalps, measuring TEWL, scaling and itch. If it showed that 2×/week harms the barrier, lower the straight/wavy band to 1×–2×.
- Replication of E5 (TEWL rising at every 1–2 days) in a randomised design: cap every texture at 2×/week.
- Independent, non-industry replication of E4 in European or textured-hair populations: raise the curly preferred start to 2×.
- App data showing many "trocken" users later report Schuppen. That would mean the dry label often hides dandruff, and long intervals become riskier. Raise the minimum to 1×/week for all textures.
- A dermatology consensus statement (AAD, BAD or a German society) giving a cadence for a dry scalp specifically.
