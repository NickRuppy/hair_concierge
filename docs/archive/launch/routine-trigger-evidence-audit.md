# Routine Trigger Evidence Audit

Last updated: 2026-04-09

## Scope

This memo audits the **currently shipped** routine options in [src/lib/routines/planner.ts](/Users/nick/AI_work/hair_conscierge/src/lib/routines/planner.ts), not future spec-only modules.

Current live options:

1. `Routine Glatt`
2. `Locken & Wellen`
3. `Routine Locken`
4. `Tiefenreinigung / Reset`
5. `Hair Oiling`
6. `Bond Builder / Repair-Support`
7. `Lockenrefresh`
8. `CWC / OWC als Technik-Option`

Evidence standard for this audit:

- `Strong`: direct study or consistent dermatologist guidance for the trigger-behavior link
- `Moderate`: plausible support from adjacent literature and clinical guidance, but not a clean direct test
- `Weak / practice`: widely used in professional practice, but limited direct evidence
- `Unsupported`: current trigger is not well supported for this option

Important framing:

- This is an **external evidence** audit, not a Tom-alignment exercise.
- Several routine decisions in this area are driven more by **cosmetic dermatology + professional practice** than by RCT-style evidence.
- When evidence is weak, the recommendation is to keep behavior conservative and label it as such rather than present it as a hard rule.

## Current Live Triggers

The current planner activates these topics from the following main triggers:

- `Routine Glatt`: `hair_texture = straight`
- `Locken & Wellen`: `hair_texture = wavy`
- `Routine Locken`: `hair_texture = curly` or `coily`
- `Tiefenreinigung`: explicit ask, or `has_buildup_signals`
- `Hair Oiling`: explicit ask, dry scalp / dry flakes / dandruff scalp fit, or dryness-damage fit without oil-weight risk
- `Bond Builder`: explicit ask, or damage / chemistry signals except `colored` alone
- `Lockenrefresh`: explicit ask, or between-wash days + wavy/curly/coily pattern
- `CWC/OWC`: explicit ask, or broad dryness-damage technique fit

## 1. Routine Glatt

### Research summary

- Using **hair pattern** as the top-level base family trigger is supported. Curly versus straighter hair reflects real structural and mechanical differences, not just styling preference.
- Curved or highly curled fibers are more prone to tangling, uneven sebum distribution, and mechanical stress than straighter fibers, so it is reasonable to keep straight hair as its own lower-friction base family.
- The evidence does **not** support using ancestry as a proxy trigger. Curly-hair literature consistently warns against race-based shortcuts and recommends pattern-based classification.

### Conflicts

- There is much stronger literature on **curly / Afro-textured** hair than on a distinct “straight-hair routine” as a clinical object.
- The evidence supports `straight` mostly by contrast: straighter hair usually has fewer of the fragility patterns that justify curl-specific care branches.

### Implementation proposal

- Keep `hair_texture = straight` as the base trigger for `Routine Glatt`.
- Do **not** add ancestry or ethnicity as a trigger.
- Keep scalp type, oiliness, thickness, damage, and volume as **modifiers inside the base routine**, not as reasons to replace the base family.

### Open risks

- `Routine Glatt` may be too broad for users with straight-but-chemically-damaged hair; that gap is better handled by add-on modules than by splitting the base family.

## 2. Locken & Wellen

### Research summary

- A wavy / curly-adjacent base family is supported. Hair curvature changes friction, tangling behavior, and how conditioning and detangling should be handled.
- Dermatologist guidance supports more careful wet handling and texture-aware detangling for textured / tightly curled hair.
- The literature does not justify splitting `wavy` into many subfamilies unless the product logic truly diverges.

### Conflicts

- Most rigorous literature collapses curly-texture questions into broader “curly” or “Afro-textured” buckets, so the evidence for a distinct `wavy` family is partly inferential.
- That said, the inference is reasonable because waves share some curl-management needs while usually tolerating lighter products than tighter curl patterns.

### Implementation proposal

- Keep `hair_texture = wavy` as the main trigger for `Locken & Wellen`.
- Do not add extra top-level triggers beyond pattern itself.
- If this family needs more precision, do it through **slot-level modifiers**:
  - lighter finish for fine/low-density waves
  - more moisture / conditioning for damaged or rough waves
  - refresh emphasis when next-day flattening or frizz is reported

### Open risks

- Wavy users often overlap with straight-hair habits and may be over-served by a curl-first routine if the prompt has no frizz / definition / next-day issue.

## 3. Routine Locken

### Research summary

- `curly` / `coily` as the main trigger is strongly supported.
- Curly and coily fibers have greater tangling, more uneven sebum distribution along the shaft, and higher susceptibility to breakage from manipulation and heat.
- Weekly gentle cleansing and careful detangling are supported in textured-hair guidance; prolonged low-wash intervals plus heavy oils or product buildup can worsen scalp issues.

### Conflicts

- There is real variation within `curly` and `coily`, but the current evidence does not require separate top-level families unless the product logic will materially differ.
- Clinical and cosmetic literature often mixes “curly,” “coily,” and “Afro-textured,” so exact boundaries remain fuzzy.

### Implementation proposal

- Keep `hair_texture = curly | coily` as the main trigger for `Routine Locken`.
- Do not split `curly` and `coily` yet at the top level.
- Add or strengthen **within-family modifiers** for:
  - wash cadence
  - scalp discomfort / dandruff
  - mechanical stress / protective styling
  - detangling difficulty
  - thermal damage

### Open risks

- The current planner has no dedicated scalp-support module, so some curly/coily scalp problems are likely being routed into the wrong add-ons.

## 4. Tiefenreinigung / Reset

### Research summary

- The current core triggers are directionally right. Shampoos are meant to remove sebum, environmental pollutants, scales, and residues from previous products; product-heavy routines and oily scalp are valid triggers.
- Evidence also supports residue and buildup risk with:
  - repeated use of silicone-heavy / residue-prone products
  - co-washing without periodic clarifying
  - infrequent washing with heavy product accumulation
  - hard-water mineral deposition
- Dermatologist guidance also supports special cleansing after **swimming / chlorine exposure**.

### Conflicts

- “Clarifying shampoo” itself is more of a cosmetic-practice category than a tightly defined medical one.
- Hard water clearly increases mineral deposition, but the evidence is mixed on how much visible structural damage it causes on its own.
- In dandruff or seborrheic dermatitis, the right move is often **medicated scalp cleansing**, not a generic “detox/reset.”

### Implementation proposal

- Keep these current triggers:
  - oily scalp
  - buildup / heavy routine products
  - heavy stylers
  - underperforming / weighed-down routine
- Add likely missing triggers:
  - hard water exposure
  - swimming / chlorine exposure
  - exclusive or frequent co-wash without periodic stronger cleansing
  - frequent use of non-water-soluble silicone / petrolatum / mineral-oil-heavy products
  - prolonged protective styles or very infrequent wash intervals with heavy product use
- Add a clinical guardrail:
  - if the signal is **dandruff / seborrheic dermatitis**, prefer a scalp-treatment branch over generic clarify language

### Open risks

- The current planner uses `goal = volume` as a proactive clarifying signal. That is reasonable in practice, but only moderate-evidence. It should stay a soft trigger, not a hard one.

## 5. Hair Oiling

### Research summary

- The strongest support is for **pre-wash oiling of dry or damaged lengths**, especially where reducing protein loss, porosity, or washing damage matters.
- Coconut oil has the best direct evidence among common oils; the evidence is **not** interchangeable across all oils.
- Dry or damaged textured hair, chemically treated hair, and frequent washing all make the pre-wash protection logic more plausible.
- There is also reasonable practice support for using oils to improve lubrication and reduce combing stress in dry, fragile hair.

### Conflicts

- The evidence is much stronger for **shaft protection** than for **scalp-treatment claims**.
- Current live triggering of `dandruff` into `Hair Oiling` is weak and likely wrong. Dandruff guidance points toward regular washing and dandruff shampoos, not scalp oiling.
- `dry_flakes` is not automatically the same thing as a simple dry scalp. Dry/scaly scalp may need barrier-supporting scalp treatment, but that is not the same as recommending generic hair oiling.
- Broad statements like “rosemary oil helps the scalp” remain medically and formulation-sensitive; they should not be used as deterministic triggers.

### Implementation proposal

- Keep these as positive triggers:
  - dry / damaged lengths
  - rough cuticle / shaft weathering
  - colored or bleached hair
  - high washing burden
  - mechanical friction / detangling burden
- Add likely missing triggers:
  - frequent washing
  - clear detangling / friction complaints
  - textured hair dryness when lengths are fragile rather than oily
- Remove or demote these current scalp-driven triggers:
  - `dandruff` should **not** positively trigger `Hair Oiling`
  - `dry_flakes` should not auto-trigger oiling without a stronger dry-scalp distinction
- Replace with a rule like:
  - scalp-directed oiling only when the user’s scalp sounds **dry/non-inflammatory**, and even then keep it optional and conservative

### Open risks

- The planner currently lacks a dedicated scalp-support branch, so some scalp problems are being forced into `Hair Oiling` even when the evidence points elsewhere.

## 6. Bond Builder / Repair-Support

### Research summary

- There is strong evidence that **bleaching, coloring, straightening/relaxing, and heat** damage hair structure.
- There is emerging evidence that some cross-linking or bond-repair chemistries can improve mechanical properties of damaged hair fibers.
- However, independent evidence for commercial “bond builder” claims is more limited and more nuanced than the category marketing suggests.
- One structural investigation specifically found that maleate-based restoring agents improved surface morphology, but did **not** provide direct evidence of full disulfide-bond reconstruction in the cortex.

### Conflicts

- The current planner sometimes treats “bond builder” as a broader repair bucket than the evidence cleanly supports.
- `split_ends` or generalized roughness alone are not strong evidence that a bond-builder routine is the best add-on.
- The evidence is strongest for **chemically damaged hair**, then for **clear high-heat damage**; it is much weaker for ordinary weathering.

### Implementation proposal

- Keep strong positive triggers:
  - bleach
  - repeated coloring with clear damage signals
  - relaxers / chemical straightening / perm-like chemical processing
  - frequent high-heat damage, especially without protection
  - clear breakage / internal-structure damage pattern
- Add likely missing trigger:
  - chemical straightening / relaxers
- Narrow or demote current weak triggers:
  - `split_ends` alone should not be enough
  - “rough cuticle” alone should not be enough without stronger chemistry / heat / breakage context
- Keep guidance technology-agnostic in user-facing output unless there is specific cited support for the exact ingredient class

### Open risks

- The current planner may over-activate `Bond Builder` for users who primarily need conditioning, trimming, or heat reduction rather than a bond-repair protocol.

## 7. Lockenrefresh

### Research summary

- This is a **practice-supported** module rather than a highly studied one.
- The main logic is sound: users with wavy/curly/coily hair and between-wash days often need a light refresh step to restore shape, reduce frizz, and re-activate previous styling.
- Dermatologist guidance supports texture-aware wet handling and lower-damage between-wash management.

### Conflicts

- Direct clinical literature on “refresh” as a named module is sparse.
- The current auto-trigger of “between-wash days + curl pattern” is useful in practice, but stronger evidence would come from adding symptom triggers rather than relying on cadence alone.

### Implementation proposal

- Keep the current main trigger:
  - between-wash days + wavy/curly/coily hair
- Add likely missing triggers:
  - next-day flattening
  - loss of definition
  - frizz between washes
  - sleep-related disruption
  - post-exercise / sweat refresh need
- Consider reducing the confidence of the universal auto-trigger:
  - keep it proactive, but present it as optional rather than assumed essential

### Open risks

- Without user-reported next-day issues, some curl users may be shown a refresh branch they do not actually need.

## 8. CWC / OWC als Technik-Option

### Research summary

- This is the weakest routine option in the current set from an evidence standpoint.
- There is some support for **gentler cleansing strategies** in sensitive, dry, chemically treated, or textured hair, and co-washing can reduce harsh cleansing exposure.
- There is also clear caution that conditioner-led washing alone can create residue and requires periodic clarifying.
- Direct evidence for `CWC` or `OWC` as a specifically validated routine module is limited. This is primarily a professional-practice / enthusiast-haircare technique lane.

### Conflicts

- The current planner auto-triggers `CWC/OWC` for a broad dryness-damage cluster. That is a stronger claim than the literature supports.
- The evidence supports “optional technique some users may benefit from,” not “default module for damage.”

### Implementation proposal

- Keep `CWC/OWC` as:
  - explicit ask
  - optional technique for dry, fragile, chemically treated, or detangling-difficult hair
- Add one better-aligned positive trigger if this module stays:
  - clear detangling difficulty / high friction during wash day
- Narrow auto-activation:
  - do not trigger from broad damage signals alone
  - remove thickness (`normal` / `coarse`) as a practical proxy unless supported by other dryness / breakage evidence
- If product wants higher evidence discipline, demote this module to:
  - explicit ask only

### Open risks

- If left as a broad proactive module, `CWC/OWC` is likely to overfit to online haircare practice rather than evidence-led routine design.

## Cross-Cutting Findings

### Strongest likely gaps in the current planner

1. **Dandruff is routed incorrectly**
   - `dandruff -> Hair Oiling` is the weakest current trigger.
   - The evidence points more toward **regular scalp cleansing / dandruff shampoo** than oiling.

2. **Hard-water and swimming exposure are missing clarifying triggers**
   - Both are plausible and evidence-supported enough to add conservatively.

3. **Chemical straightening / relaxers are missing as bond-builder triggers**
   - This is a stronger omission than many of the current broad damage heuristics.

4. **Mechanical-friction / detangling burden is underused**
   - It plausibly belongs in `Hair Oiling` and possibly as an optional `CWC/OWC` trigger.

5. **Scalp-support is a missing module**
   - Some current trigger tension comes from trying to use `Hair Oiling` or `Tiefenreinigung` for scalp states that really need a separate conservative scalp branch.

### Likely false-positive areas

- `dandruff -> Hair Oiling`
- `split_ends alone -> Bond Builder`
- broad dryness-damage cluster -> `CWC/OWC`
- `volume goal -> Tiefenreinigung` as a hard trigger instead of a soft hint

## Recommended Delta for the Planner

### Keep

- Base families driven primarily by `hair_texture`
- `Tiefenreinigung` for oily scalp, buildup, heavy styling, weighed-down routine
- `Hair Oiling` for dry / damaged lengths and chemically stressed hair
- `Bond Builder` for bleach / chemistry / strong heat damage
- `Lockenrefresh` for curl-pattern users with between-wash days

### Add

- `Tiefenreinigung`
  - hard water exposure
  - chlorine / frequent swimming
  - co-wash-heavy routines without periodic clarifying
  - prolonged product-heavy protective styling / infrequent wash intervals
- `Hair Oiling`
  - frequent washing
  - friction / detangling burden
- `Bond Builder`
  - relaxers / chemical straightening
- `Lockenrefresh`
  - next-day flattening
  - loss of definition
  - sleep disruption
  - post-workout refresh need
- `CWC/OWC`
  - if retained, detangling difficulty / high friction during wash day

### Remove or demote

- `dandruff` as a positive `Hair Oiling` trigger
- `dry_flakes` as an automatic `Hair Oiling` trigger
- `split_ends` alone as a `Bond Builder` trigger
- broad proactive `CWC/OWC` activation from generic dryness-damage fit

## Research Matrix

| Option            | Current main trigger                  | Evidence-supported trigger direction                       | Likely missing triggers                                                  | Confidence      | Recommendation               |
| ----------------- | ------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | --------------- | ---------------------------- |
| `Routine Glatt`   | `straight` pattern                    | Keep pattern-based base family                             | none major; use slot modifiers instead                                   | Moderate        | Keep                         |
| `Locken & Wellen` | `wavy` pattern                        | Keep pattern-based base family                             | none major; use lightweight modifiers                                    | Moderate        | Keep                         |
| `Routine Locken`  | `curly/coily` pattern                 | Keep pattern-based base family                             | scalp/breakage modifiers, not new base trigger                           | Strong          | Keep                         |
| `Tiefenreinigung` | buildup / oily / heavy routine        | Supported                                                  | hard water, chlorine, co-wash residue, prolonged product-heavy intervals | Strong-Moderate | Keep + add triggers          |
| `Hair Oiling`     | dry scalp / dandruff / dry-damage fit | Strong for dry or damaged lengths; weak for dandruff scalp | frequent washing, detangling/friction burden                             | Moderate        | Keep + narrow scalp triggers |
| `Bond Builder`    | damage / chemistry / heat             | Strongest for bleach / chemistry / high heat               | relaxers / chemical straightening                                        | Moderate        | Keep + narrow weak triggers  |
| `Lockenrefresh`   | between-wash days + curl pattern      | Practice-supported                                         | flattening, frizz, definition loss, post-workout, sleep                  | Weak-Moderate   | Keep + add symptom triggers  |
| `CWC/OWC`         | dryness-damage fit                    | Weak / practice-only                                       | detangling difficulty if retained                                        | Weak            | Demote or explicit-ask-first |

## Sources

Primary / review literature:

- Cloete E, Khumalo NP, Ngoepe MN. _The what, why and how of curly hair: a review._ [PMC6894537](https://pmc.ncbi.nlm.nih.gov/articles/PMC6894537/)
- Fernandes C, Medronho B, Alves L, Rasteiro MG. _On Hair Care Physicochemistry: From Structure and Degradation to Novel Biobased Conditioning Agents._ [PMC9921463](https://pmc.ncbi.nlm.nih.gov/articles/PMC9921463/)
- Dias MFRG, Loures AF, Ekelem C. _Hair Cosmetics for the Hair Loss Patient._ [PMC8719955](https://pmc.ncbi.nlm.nih.gov/articles/PMC8719955/)
- Rele AS, Mohile RB. _Effect of mineral oil, sunflower oil, and coconut oil on prevention of hair damage._ [PubMed 12715094](https://pubmed.ncbi.nlm.nih.gov/12715094/)
- Kaushik V, Kumar A, Gosvami NN, et al. _Benefit of coconut-based hair oil via hair porosity quantification._ [PubMed 35377477](https://pubmed.ncbi.nlm.nih.gov/35377477/)
- Bloch LD, Goshiyama AM, Dario MF, et al. _Chemical and physical treatments damage Caucasian and Afro-ethnic hair fibre: analytical and image assays._ [PubMed 31237371](https://pubmed.ncbi.nlm.nih.gov/31237371/)
- Gavazzoni Dias MFR. _Pro and Contra of Cleansing Conditioners._ [PMC6489037](https://pmc.ncbi.nlm.nih.gov/articles/PMC6489037/)
- Fajuyigbe D, Sewraj P, Connétable S, et al. _Weekly hair washing: The recommended solution for women with afro-textured hair to alleviate dandruff and scalp discomfort._ [PubMed 38217001](https://pubmed.ncbi.nlm.nih.gov/38217001/)
- AlGhamdi KM, AlGhamdi OA, Alotaibi AK, et al. _Scanning electron microscopy study of hair shaft changes related to hardness of water._ [PubMed 28799530](https://pubmed.ncbi.nlm.nih.gov/28799530/)
- Ruetsch SB, Kamath YK, Rele AS, Mohile RB. _The uptake of water hardness metals by human hair._ [PubMed 21982353](https://pubmed.ncbi.nlm.nih.gov/21982353/)
- Bottino A, Pasquali P, D'Agostino C, et al. _Structural investigation on damaged hair keratin treated with α,β-unsaturated Michael acceptors used as repairing agents._ [PubMed 33279560](https://pubmed.ncbi.nlm.nih.gov/33279560/)
- Pasquali P, Calvieri V, Granieri M, et al. _Novel Compounds for Hair Repair: Chemical Characterization and In Vitro Analysis of Thiol Cross-Linking Agents._ [PubMed 40430453](https://pubmed.ncbi.nlm.nih.gov/40430453/)
- Nakagawa K, Tashiro A, Suzuki S, et al. _The efficacy of a pseudo-ceramide and eucalyptus extract containing lotion on dry scalp skin._ [PubMed 29670385](https://pubmed.ncbi.nlm.nih.gov/29670385/)
- Ojukwu A, Galadari H, Wohlfart S, et al. _Afro-textured hair care: a narrative review and recommendations for dermatologists._ [PMC12900221](https://pmc.ncbi.nlm.nih.gov/articles/PMC12900221/)

Dermatologist guidance:

- American Academy of Dermatology. _Hair styling without damage._ [AAD](https://www.aad.org/public/diseases/hair-loss/hair-care/styling)
- American Academy of Dermatology. _How to treat dandruff._ [AAD](https://www.aad.org/public/everyday-care/hair-scalp-care/scalp/treat-dandruff)
- American Academy of Dermatology. _African American hair: Tips for everyday care._ [AAD](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/care-african-american)
- American Academy of Dermatology. _Tips for healthy hair._ [AAD](https://www.aad.org/tips-healthy-hair)
- American Academy of Dermatology. _10 hair care habits that can damage your hair._ [AAD](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/habits-that-damage-hair)
