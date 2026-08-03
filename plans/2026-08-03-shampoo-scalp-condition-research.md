# Shampoo requirements for dandruff, dry flakes, and irritated scalp

**Status:** external evidence review reconciled with the live catalog; shampoo product rules confirmed by Nick on 2026-08-03

**Decision informed:** How the Personal Plan should turn the quiz's lossless `scalpConcerns[]` answers into shampoo roles, product requirements, application instructions, phases, and follow-up.

## Scope and safety boundary

- Population: adults and adolescents with self-reported, apparently mild scalp symptoms in Germany.
- The new Personal Plan quiz allows any combination of `oily_dandruff`, `dry_dandruff`, and `irritated`. It does not diagnose seborrhoeic dermatitis, eczema, psoriasis, contact dermatitis, or infection.
- The current offer adapter collapses that array to one legacy `scalp_condition`. That lossy adapter is not authoritative for Personal Plan computation; the plan must consume every selected specific concern.
- The plan may give conservative self-care guidance and select a verified product. It must not present a quiz answer as a medical diagnosis or silently continue a worsening treatment.

## Answer-first findings

### 1. Dandruff commonly needs a targeted shampoo protocol, not merely a gentler everyday shampoo

The evidence supports antifungal or otherwise active anti-dandruff shampoos for dandruff and scalp seborrhoeic dermatitis. A 2026 EADV-supported European expert consensus considers antifungal shampoo a first-line option for short-term control of scalp seborrhoeic dermatitis. A Cochrane review found ketoconazole and ciclopirox more effective than placebo, although much of the evidence was low or moderate quality and did not establish one universal dose or schedule.

The safe implementation rule is therefore **a product with a verified anti-dandruff claim and effective active**, followed according to the exact product directions. The category must not invent one universal medicinal dose or contact time.

Sources:

- [EADV-supported 2026 expert consensus](https://onlinelibrary.wiley.com/doi/full/10.1111/jdv.70444)
- [Cochrane review of topical antifungals](https://www.cochrane.org/evidence/CD008138_antifungal-treatments-applied-skin-treat-seborrhoeic-dermatitis)
- [IQWiG overview of seborrhoeic eczema treatment](https://www.gesundheitsinformation.de/seborrhoisches-ekzem-welche-mittel-helfen-jugendlichen-und-erwachsenen.html)

### 2. Acute treatment followed by lower-frequency maintenance is common, but the numbers are product-specific

Representative German product directions differ materially:

| Verified product/direction | Initial phase | Contact time | Maintenance | Other wash days |
|---|---|---|---|---|
| Ketoconazol Klinge 20 mg/g medicinal shampoo | 2x weekly for 2–4 weeks | 3–5 minutes | 1x every 1–2 weeks | Normal shampoo may be used between applications |
| Vichy Dercos selenium/salicylic-acid shampoo | 3x weekly for 4 weeks | 2 minutes | 1x weekly | Product-specific |
| Ducray Kelual DS | 3x weekly for 2 weeks | Follow product directions | 1x weekly | A balancing shampoo is suggested for additional washes |

Sources:

- [German ketoconazole patient leaflet](https://www.patienteninfo-service.de/a-z-liste/k/ketoconazol-klinge-20-mgg-shampoo?schrift=0.9)
- [Vichy Dercos German directions](https://www.vichy.de/alle-produkte/haarpflege/shampoos/schuppen/dercos-anti-schuppen-shampoo-fuer-normale-bis-fettige-kopfhaut)
- [Ducray Kelual DS German directions](https://www.ducray.com/de-de/schuppen/hautpflege-routinen/gegen-chronische-schuppen)

Consequently, the Personal Plan must not hard-code “2x weekly,” “four weeks,” or “leave on for five minutes” at category level. Those values become precise only after Stage 2 has selected an exact product with a verified source.

### 3. The anti-dandruff product does not necessarily replace the everyday shampoo

Professional guidance and product directions allow a normal shampoo between targeted anti-dandruff applications. Application is primarily to the scalp; contact time comes from the exact product. Hair texture and tolerance affect how often the targeted shampoo is practical, and curly/coily lengths may need protection from unnecessary exposure.

This supports two semantic jobs for some users:

1. `shampoo_dandruff`: the targeted product used according to its acute or maintenance protocol.
2. `shampoo_everyday`: the compatible shampoo for remaining wash events.

One verified product may fulfil both jobs. Otherwise, the user has two shampoos in the category. Which one is primary remains derived from planned usage frequency.

Source: [American Academy of Dermatology dandruff guidance](https://www.aad.org/public/everyday-care/hair-scalp-care/scalp/treat-dandruff)

### 4. Dry flakes should default to a gentle, non-medicated shampoo—not an anti-dandruff protocol

Dry scalp and dandruff can look similar. Dermatology guidance distinguishes the initial self-care approach: dandruff shampoo for dandruff, but a gentle non-medicated shampoo for dry scalp. There is no well-supported universal treatment duration, contact time, or fixed wash frequency for self-reported dry flakes.

Therefore `dry_dandruff` (the quiz label is “Trockene Schuppen”) should change the required everyday shampoo target to:

- gentle cleansing;
- non-medicated by default;
- explicitly suitable for dry or easily stripped scalp;
- thoroughly rinsed;
- used at the person's resolved wash cadence, not at a fabricated “treatment” cadence.

The plan should not claim that everybody with dry flakes must wash only once weekly. If symptoms persist despite a gentle routine, the user needs reassessment because psoriasis, eczema, contact dermatitis, and other conditions can resemble dry scalp.

Sources:

- [AAD dry-scalp differential and self-care](https://www.aad.org/public/everyday-care/hair-scalp-care/scalp/dry-scalp-conditions)
- [NHS patient guidance for scalp eczema and dry scalp](https://www.gloshospitals.nhs.uk/your-visit/patient-information-leaflets/hair-care-for-eczema-of-the-scalp/)

### 5. “Irritated scalp” is a symptom cluster, not a sufficient diagnosis for an active shampoo

The quiz description combines itching, redness, and burning. Those symptoms may reflect product irritation, allergic contact dermatitis, eczema, dandruff/seborrhoeic dermatitis, psoriasis, infection, or another cause. Hair products are a meaningful source of scalp contact dermatitis; a systematic review found shampoos were among the commonly implicated product classes, with fragrance and several preservatives/surfactants among reported allergens.

The safe default requirement is:

- a gentle, non-medicated everyday shampoo;
- fragrance-free when verified;
- no automatic anti-dandruff or exfoliating active;
- gentle scalp application and thorough rinsing;
- stop a product that causes or clearly worsens burning, itching, or rash;
- no universal ingredient blacklist beyond known personal exclusions or a diagnosed allergy.

Sources:

- [Systematic review of scalp allergic contact dermatitis](https://pubmed.ncbi.nlm.nih.gov/35318978/)
- [AAD causes of an itchy or reactive scalp](https://www.aad.org/public/everyday-care/itchy-skin/itch-relief/relieve-scalp-itch)
- [NHS scalp-eczema hair-care guidance](https://www.gloshospitals.nhs.uk/your-visit/patient-information-leaflets/hair-care-for-eczema-of-the-scalp/)

### 6. The current Chaarlie dandruff cohort is suitable as the cosmetic first line

A read-only live-catalog audit on 2026-08-03 found eight active Chaarlie-recommended products in the `schuppen`/`dandruff` route. Every current German formula lists Piroctone Olamine and the product is explicitly sold for dandruff. Piroctone Olamine is an antifungal anti-dandruff active rather than only a soothing ingredient. A controlled study of a 0.5% Piroctone Olamine shampoo found improved clinical flaking and a shift in dandruff-associated scalp microbiota versus a control after three weeks; the exact concentration of the Chaarlie catalog products is not public, so the study supports the active and product class, not equivalence between every finished formula.

| Current active recommendation | Verified current formula/claim | Product-fit note |
|---|---|---|
| [Balea med Anti-Schuppen Ultra Sensitive](https://www.dm.de/p/d/2968885/balea-med-shampoo-anti-schuppen-ultra-sensitive) | Piroctone Olamine; anti-dandruff claim; fragrance-free | Clearest current reference for dandruff plus irritation/dryness when thickness, exclusions, and other fit checks allow it. |
| [Sebamed Anti-Schuppen](https://www.dm.de/p/d/1023236/sebamed-shampoo-anti-schuppen) | Piroctone Olamine; explicit dandruff-reduction claim | Valid cosmetic first-line candidate; contains fragrance. |
| [Salthouse Mildes Anti-Schuppen](https://www.rossmann.de/de/pflege-und-duft-salthouse-totes-meer-mildes-anti-schuppen-shampoo/p/4008890006429) | Piroctone Olamine; anti-dandruff claim | Valid dandruff candidate; essential oils/fragrance make it less conservative for an already irritated scalp. |
| [Head & Shoulders Sensitive](https://www.dm.de/p/d/3115868/head-und-shoulders-shampoo-anti-schuppen-sensitive-kopfhaut) | Piroctone Olamine; anti-dandruff claim | Sensitive-positioned option, but still contains fragrance. |
| [Head & Shoulders DERMAXPRO Beruhigende Pflege](https://www.dm.de/p/d/1343250/head-und-shoulders-shampoo-derma-x-pro-beruhigende-pflege) | Piroctone Olamine; anti-dandruff claim | Targets dry/itchy dandruff; contains menthol and fragrance, so exclusions/tolerance still matter. |
| [Guhl Anti-Schuppen](https://www.dm.de/p/d/1446893/guhl-shampoo-anti-schuppen) | Piroctone Olamine; anti-dandruff claim | Valid dandruff candidate; contains fragrance/colorants. |
| [Schauma Anti-Schuppen Classic](https://www.dm.de/p/d/1588728/schauma-shampoo-anti-schuppen-classic) | Piroctone Olamine; anti-dandruff claim | Valid dandruff candidate; contains fragrance/colorant. |
| [Pantene Anti-Schuppen](https://www.dm.de/p/d/1561902/pantene-pro-v-shampoo-anti-schuppen-active-nutri-plex) | Piroctone Olamine; anti-dandruff positioning | Valid candidate, with less public finished-product substantiation than the strongest catalog examples. |

Source for the active-class evidence: [controlled Piroctone Olamine shampoo study](https://pubmed.ncbi.nlm.nih.gov/38196163/).

Product decision: these catalog products are the normal Stage 2 first line. Describe them as evidence-backed cosmetic anti-dandruff products that can reduce/control dandruff, not as medicinal cures. A stronger medicinal product is a later escalation, not the initial catalog default.

The current irritated cohort remains in `irritationen`. Products in that cohort that happen to contain Piroctone Olamine are not reclassified unless their anti-dandruff claim was separately verified. Ingredient presence alone is not a new role.

## Confirmed deterministic product rules

The rules are composable because the quiz is multi-select. Begin with one `shampoo_everyday` role, then apply every selected concern rather than choosing a winner.

| Selected input | Stage 1 requirement modifier | Stage 2 product resolution | Stage 3 use |
|---|---|---|---|
| No selected scalp concern | Everyday shampoo based on scalp oiliness and hair compatibility | Select one matching everyday shampoo | Use at the resolved total wash cadence |
| `oily_dandruff` | Add a targeted `shampoo_dandruff` role; retain `shampoo_everyday` for remaining washes, allowing one product to fill both | Select from the evidence-gated `schuppen` cohort, then apply thickness, irritation, budget, and exclusion fit | Follow the exact product directions inside the confirmed wash plan; check in after 21 days |
| `dry_dandruff` | Make `shampoo_everyday` gentle, non-medicated by default, and suitable for a dry/easily stripped scalp | Select a verified gentle/dry-scalp product | No fabricated treatment phase; use at resolved wash cadence and reassess if symptoms persist or worsen |
| `irritated` | Add the strictest irritation-compatible constraints to `shampoo_everyday`; do not infer a diagnosis or active treatment | Select a gentle, non-medicated product with verified fragrance-free/sensitive-scalp metadata; preserve known exclusions | Stop a suspected trigger; use gently if tolerated; show the escalation boundary |

Combination behavior follows directly:

- `oily_dandruff + irritated`: retain the targeted dandruff role, but require irritation-compatible product selection and safety guidance; never interpret irritation as permission to intensify treatment.
- `dry_dandruff + irritated`: one stricter gentle everyday role can satisfy both concerns.
- `oily_dandruff + dry_dandruff`: retain the targeted dandruff role and use a gentle dry-scalp-compatible everyday product for remaining washes.
- all three: combine the dandruff protocol with the stricter everyday-product and safety constraints. No selected concern is discarded.

## Required product-protocol data

For any exact targeted shampoo that enters the plan, store a reviewed protocol snapshot rather than regenerating instructions from generic copy:

- `protocol_source_url` and `protocol_verified_at`;
- target/indication and whether the product is cosmetic or medicinal;
- initial frequency and initial duration;
- maintenance frequency, when the source provides one;
- scalp contact time;
- wet/dry application and rinse instructions;
- whether a normal shampoo may be used between or after applications;
- material cautions relevant to the plan.

If any instruction needed for Stage 3 is missing, show “nach Produktangabe” and keep the day instruction unresolved rather than inventing precision.

## Confirmed response and escalation behavior for dandruff

1. `initial`: the selected cosmetic anti-dandruff product is active inside the confirmed wash plan and follows its label/verified directions.
2. `review_due`: 21 days after the version becomes active, ask whether symptoms are clearly improved, unchanged, or worse. This is a product check-in decision, not a claim that every medicinal course ends at exactly three weeks.
3. `keep_current`: if clearly improved, keep the product and plan. A product-specific maintenance change is proposed only when verified directions support it.
4. `medicinal_product_proposed`: if unchanged, keep the current plan active while recommending a stronger reviewed medicinal anti-dandruff product with pharmacy/medical guidance. Accepting the recommendation may place the exact product on the shopping list, but it does not mark it acquired or active.
5. `professional_care`: if worse or if a red flag exists, do not automatically intensify; advise pharmacist/dermatology evaluation.

The app never silently switches products. Acquiring a medicinal product creates a proposed plan successor with its exact reviewed instructions; the user confirms before the active plan changes.

## Escalation boundary

Show a professional-evaluation recommendation when any of the following is reported:

- no clear improvement at the product's 21-day check-in or after its appropriate full course;
- severe or very itchy dandruff;
- red or swollen scalp;
- blistering, oozing, sores, marked pain, or a strong burning reaction;
- flaky/itchy areas on the face or elsewhere;
- patchy hair loss or a suspicious red/silvery rash;
- symptoms that clearly worsen with the selected product.

Sources:

- [NHS dandruff escalation guidance](https://www.nhs.uk/conditions/dandruff/)
- [German ketoconazole patient leaflet safety instructions](https://www.patienteninfo-service.de/a-z-liste/k/ketoconazol-klinge-20-mgg-shampoo?schrift=0.9)

## Confirmed product decisions

- Initial Stage 2 selection uses the current cosmetic `schuppen` cohort.
- No clear improvement after 21 days produces a stronger medicinal-product proposal plus pharmacy/medical guidance; it does not silently mutate the active plan.
- Balea med Anti-Schuppen Ultra Sensitive is the clearest current example for combined dandruff plus irritation, but remains subject to thickness, exclusions, availability, and deterministic candidate ranking.
- Irritation without dandruff stays on the existing `irritationen` route and does not create a treatment role.
- `schuppen` is treated as an evidence-gated bucket. Runtime does not need a redundant anti-dandruff-active boolean; catalog review retains the supporting ingredient/claim evidence.

Confirmed onboarding behavior:

- The irritation safety/recent-reaction follow-up is required only when `irritated` was selected.
- A hidden buildup assessment infers as much as possible from the user's products, placement, frequency, cleansing method, wash cadence, scalp context, and existing symptom evidence.
- Only `likely` or `strong` buildup without an observed outcome triggers the one-question confirmation. `none`/`possible` does not interrupt onboarding; a negative confirmation suppresses clarification.
- Exact buildup weights and deep-cleansing need-tier thresholds remain to be defined in the deep-cleansing category session rather than duplicated inside shampoo logic.

## Existing implementation gaps exposed by the review

- `adaptPersonalPlanAnswersForOffer()` currently prioritizes and emits only one legacy scalp condition. Personal Plan computation must bypass that lossy projection and consume `scalpConcerns[]` directly.
- `deriveShampooBucket()` routes legacy `dry_flakes` to the `trocken` bucket, while the product-intake validator currently accepts `dry_flakes` under `schuppen`. The Personal Plan uses the confirmed distinction: self-reported `dry_dandruff` defaults to the gentle dry-scalp route; only the targeted dandruff concern creates the `schuppen` role. Intake/legacy mappings must be reconciled to that invariant.
- Existing shampoo metadata describes route and cleansing intensity, but not a complete product-specific initial/maintenance protocol. Until the protocol fields above exist and are reviewed, Stage 3 must say “nach Produktangabe.”
- The existing review export may derive `anti_dandruff_active` from an already evidence-reviewed `schuppen` assignment. Do not promote that redundant export value into a second runtime authority; enforce the evidence gate during intake/review instead.

## Confirmed cadence interaction rules

The follow-up evidence review separated long-term scalp-led cadence from within-cycle cleansing pressure:

- Scalp oiliness sets the normal suitable frequency range. Retain the user's current exact frequency when it is inside that range; otherwise recommend the nearest range boundary.
- Goals do not change cadence. Dry flakes and irritation change product gentleness and technique, not the numerical base range.
- Dry shampoo absorbs oil but does not replace shampoo-and-water cleansing. Count applications since the last wet wash: after one use another bridge may be possible; after two, the next event is a wet wash. This may change the resolved schedule when a recurring pattern would otherwise exceed two applications between wet washes, but it does not permanently move the scalp-led band.
- Product load is not a category-count frequency modifier. Meaningful scalp exposure plus an observed residue outcome may make a normal wet wash due; persistent residue despite normal cleansing may replace one scheduled wash with a cautious clarifying wash.
- Fragility does not automatically lower the frequency band. It requires a mild compatible product, scalp-focused application, conditioning/length protection, and gentle detangling. In a true tie between acceptable frequencies, severe explicit fragility may favor the lower edge unless scalp or treatment needs conflict.
- A clarifying wash substitutes for a normal wash. It is not added on top, and irritated/dry/heavily treated/fragile profiles require stronger evidence and a gentler compatible option.

Sources:

- [AAD dry-shampoo guidance](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/dry-shampoo-best-results)
- [AAD curly/coily hair guidance](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/curly-hair-care)
- [DermNet shampoo and clarifying guidance](https://dermnetnz.org/topics/shampoo)
- [Dermatology review of shampoo types and retained styling films](https://pmc.ncbi.nlm.nih.gov/articles/PMC3002407/)
- [Review of cleansing conditioners, fiber vulnerability, and buildup](https://pmc.ncbi.nlm.nih.gov/articles/PMC6489037/)
- [Wash-frequency study with population and funding limitations](https://pmc.ncbi.nlm.nih.gov/articles/PMC8138261/)
