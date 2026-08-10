# Personal Plan Scalp Care category — market coverage and definition plan

**Status:** durable Scalp Care evidence and decision authorities confirmed; shared implementation/data gates remain; no implementation authorized

**Outcome:** make Personal Plan able to recognize and account for the cosmetic scalp-care products users actually own, independently of whether the package calls them a serum, tonic, fluid, oil, or scrub. Market presence establishes that a role belongs in the product model; external evidence determines recommendation confidence, wording, safety treatment, and whether Hair Concierge should proactively recommend an exact product.

## 1. Confirmed framing

This category starts from four user-observed product purposes:

1. scalp comfort for dry, tight, sensitive-feeling, irritated, or itchy scalps;
2. support products positioned for oily or flake-prone scalps;
3. products positioned for density, thinning, shedding, growth, or the hair root;
4. exfoliating or deep-cleansing scalp treatments.

All four must be recognizable when a user reports owning or using them. “We account for this product” is separate from “we recommend it,” “the claim is strongly supported,” and “it is safe to optimize without further questions.”

The Drogerie list in Nick's 2026-08-06 screenshot is a discovery seed, not a validated catalog or efficacy ranking. High-end products remain out of scope.

## 2. Research verdict

A read-only explorer reviewed the current German mass-market/Drogerie landscape on 2026-08-06 using retailer and manufacturer product pages for market existence and labelled use. It found that the four supplied lanes are real, but their labels mix role, symptom, marketing claim, and format.

The product model must not classify from the word `Serum` alone. `Kopfhautserum`, `Tonikum`, `Haarwasser`, `Treatment`, `Lotion`, `Drops`, and `Spray` overlap in the market.

Classify first by:

1. **target:** scalp, roots, hair lengths, hairline, or parting;
2. **rinse mode:** leave-on or rinse-off;
3. **primary role:** comfort, flake/oil adjunct, exfoliant, cosmetic density claim, or medicine;
4. **labelled use:** daily, course-based, as needed, or occasional;
5. **presentation format:** how the product is physically presented, kept separate from its job and application protocol.

### Confirmed target architecture

Nick confirmed on 2026-08-06 that the implementation should use the clean target rather than an intermediate `scalp_treatment` plus `peeling` split.

- canonical product category: `scalp_care`;
- German product-family label: `Kopfhautpflege`;
- all four confirmed roles live inside this one category, including `scalp_exfoliant`;
- `serum`, `tonic`, `lotion`, `fluid`, `oil`, and `scrub` are presentation formats, never categories or recommendation triggers;
- `peeling` describes the exfoliating job in ordinary market language, but is represented canonically by `primary_role = scalp_exfoliant` rather than a separate product category;
- medicines remain outside cosmetic `scalp_care`.

The category-specific product contract is:

| Field | Canonical values | Architectural purpose |
|---|---|---|
| `primary_role` | `scalp_comfort \| scalp_flake_oil_adjunct \| density_claim_tonic \| scalp_exfoliant` | The one primary job used by deterministic recommendation and portfolio coverage. |
| `presentation_format` | `serum \| tonic \| lotion_or_fluid \| oil \| scrub \| other \| unknown` | Product form for recognition, copy, filtering, and review. `Haarwasser` maps to `tonic`; spray/dropper are applicators, not formats. `other` means a verified format outside the vocabulary; `unknown` means the fact is not yet verified. |
| `rinse_mode` | `leave_on \| rinse_off` | Structured routine placement; never inferred from presentation format. |
| `application_instructions` | verified exact-product instruction | Owns product-specific cadence, application state, amount, contact time, wash timing, and rinse action when stated by the source. |

`presentation_format` does not change inclusion, evidence confidence, or efficacy ranking. An exfoliating serum is therefore `primary_role = scalp_exfoliant`, `presentation_format = serum`; a granular peeling is `primary_role = scalp_exfoliant`, `presentation_format = scrub`.

The current ownership store enforces one product per user and category. That is incompatible with a user owning, for example, a density tonic, comfort serum, and exfoliant simultaneously. The correct implementation must therefore separate many-row owned inventory from role-relative plan assignment before `scalp_care` launches. This is a required shared dependency, not an optional later cleanup.

## 3. Market-observed role map

| Working role | What users may own | Representative current mass-market examples | Accounting treatment |
|---|---|---|---|
| `scalp_comfort` | Leave-on hydration, barrier, soothing, sensitivity, tightness, or anti-itch positioning | [Balea Professional Sensitive serum](https://www.dm.de/p/d/1459196/balea-professional-kopfhautpflege-serum-sensitive), [Balea med Ultra Sensitive tonic](https://www.dm.de/p/d/3106575/balea-med-kopfhaut-tonikum-ultra-sensitive), [Eucerin 5% Urea tonic](https://www.dm.de/p/d/3086968/eucerin-dermo-capillaire-5-prozent-urea-kopfhautberuhigendes-intensiv-tonikum) | Core non-exfoliating scalp-care role. Barrier, microbiome, cooling, and anti-itch remain secondary claims unless later research proves a distinct product job. |
| `scalp_flake_oil_adjunct` | Leave-on products positioned for oily, flaky, or dandruff-prone scalps | [Head & Shoulders DermaXPro leave-in serum](https://www.dm.de/p/d/2482723/head-und-shoulders-leave-in-serum-derma-x-pro-kopfhaut-feuchtigkeitspflege), [Alpecin Medicinal Forte](https://www.dm.de/p/d/1001029/alpecin-haarwasser-medicinal-forte-intensiv), [Ducray Kelual Squanorm tonic](https://www.dm.de/p/d/3133856/ducray-ducray-kelual-squanorm-fresh-control-kopfhaut-tonikum) | Real owned-product role. Record it independently from whether Shampoo remains the primary treatment recommendation. |
| `density_claim_tonic` | Leave-on products marketed for density, stronger roots, growth, caffeine, or reduced shedding | [ISANA Coffein Tonikum](https://www.rossmann.de/de/pflege-und-duft-isana-tonikum-coffein/p/4305615348018), [GUHL Kraft & Fülle tonic](https://www.dm.de/p/d/3043223/guhl-kopfhaut-tonikum-kraft-und-fuelle), [SANTE Grow Mode On tonic](https://www.dm.de/p/d/3125329/sante-naturally-tonikum-grow-mode-on) | Retain as an owned-product claim family. Cosmetic claim status, evidence confidence, and hair-loss safety routing are separate facts. |
| `scalp_exfoliant` | Acid or physical scalp exfoliation and buildup reset, sometimes marketed as a serum or peeling | [Balea 4% AHA scalp peeling](https://www.dm.de/p/d/1700670/balea-professional-kopfhautpflege-peeling-tiefenreinigung), [ISANA Professional scalp peeling](https://www.rossmann.de/de/pflege-und-duft-isana-professional-kopfhautpeeling-tiefenreinigung/p/4068134100023) | Lives inside canonical `scalp_care`; exact format, rinse behavior, contact time, and cadence remain product-specific. |

Medicinal scalp topicals, including minoxidil, remain an adjacent product class. They require a hard medicine/cosmetic distinction and should be recorded only as medication/context unless a separately approved medical integration exists.

No separate mass-market lane was established for microbiome/prebiotic care, cooling/refreshing, or post-colour comfort. These remain secondary product claims for now.

## 4. What Hair Concierge needs to preserve for an owned product

The minimum accounting model should preserve:

- shared exact product identity, verification, source, commercial, image, and lifecycle facts;
- canonical `scalp_care` identity;
- one verified `primary_role`;
- one verified `presentation_format`, including explicit `unknown` while pending;
- structured `rinse_mode`;
- verified `application_instructions`;
- reported user cadence separately from label-directed cadence;
- whether the product currently has a role-relative routine assignment, is saved but unassigned, pending review, or only contextual.

This prevents three damaging collapses:

1. treating every product named `serum` as the legacy Peeling category;
2. treating every density claim as confirmed hair-loss treatment;
3. hiding a product merely because Hair Concierge would not proactively recommend it.

## 5. Compact decision sequence

These are working decisions for the category definition—not 94 questions for Nick to answer. Codex should research and propose defaults wherever evidence or repository structure can settle them. Nick only needs to decide consequential product-policy forks.

### Decision 1 — role taxonomy

The four working roles are confirmed: `scalp_comfort`, `scalp_flake_oil_adjunct`, `density_claim_tonic`, and `scalp_exfoliant`. Verify whether any observed Drogerie product cannot be represented by them during exact-product orientation.

### Decision 2 — identity and format boundary — confirmed

All four roles receive canonical `scalp_care` identity. `presentation_format` records serum, tonic, lotion/fluid, oil, scrub, other, or unknown without determining role or rinse mode. Legacy `serum`, `scrub`, and `peeling` values remain compatibility inputs only; medicines remain an adjacent class.

### Decision 3 — owned-product accounting

Define how each role appears when owned, pending, unmatched, saved, active, paused, or unassigned. A recognized product must not disappear because evidence is weak or Hair Concierge would not recommend it.

### Decision 4 — evidence and confidence

For each role, separately determine:

- whether the market claim has strong, mixed, weak, or absent evidence;
- whether Hair Concierge may proactively recommend the role;
- which wording and uncertainty must be shown;
- which claims remain recorded product facts but never become deterministic efficacy claims.

### Decision 5 — safety and medical boundary

Define symptom and reaction states that change use guidance, suppress optimization, or require professional review. Density-claim products remain accounted for even when sudden/patchy loss, pain, burning, sores, pustules, or prominent scale move the user out of ordinary cosmetic optimization.

### Decision 6 — fit and reconciliation

Define role-relative product fit, limitations, unknown-data behavior, keep/replace/review transitions, and user override. Fit must evaluate the exact product for its assigned role rather than judge all scalp serums as one formula family.

### Decision 7 — exact protocol and routine placement

Define product-specific application state, order, cadence, contact time, rinse behavior, and interactions. Do not infer one universal Scalp Care cadence from the presentation format.

### Decision 8 — catalog and launch readiness

Verify the named Drogerie products, add the lean `scalp_care` category/spec support to Product Intake, and require shared identity data plus primary role, presentation format, rinse mode, and exact application instructions before an exact product becomes recommendable or executable. Category-level safety gates remain authoritative rather than being duplicated as a large product schema.

## 6. Targeted research streams

The next research should answer category behavior rather than re-prove that the products exist:

1. **Comfort/hydration:** evidence for leave-on moisturizing/soothing use; meaningful scalp-state distinctions; reaction boundaries.
2. **Flake/oil adjunct:** what these leave-ons can plausibly support, how they interact with anti-dandruff Shampoo, and when symptoms suppress added leave-ons.
3. **Density claims:** distinguish cosmetic positioning, plausible but uncertain ingredients, medicinal products, red flags, and claims Hair Concierge must not make.
4. **Exfoliation:** safe protocol data, rinse/contact-time/cadence requirements, contraindications, and interaction with Shampoo or other actives.
5. **Exact-product verification:** map every legible Drogerie product from the screenshot to identity, role, format, protocol, claims, and evidence status.

Market presence and labelled directions come from retailer/manufacturer pages; they do not establish efficacy. For later evidence work, use systematic reviews, professional guidance, and regulatory sources. Initial boundary references include a [2025 systematic review of topical caffeine](https://pmc.ncbi.nlm.nih.gov/articles/PMC11855793/), [AAD dandruff guidance](https://www.aad.org/public/everyday-care/hair-scalp-care/scalp/treat-dandruff), [AAD hair-loss guidance](https://www.aad.org/public/diseases/hair-loss/insider/begin), [AAD contact-dermatitis guidance](https://www.aad.org/public/everyday-care/itchy-skin/rash/itchy-rash-contact-dermatitis), and the [European Commission cosmetic/medicine borderline guidance](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-products-specific-topics/borderline-products_en).

## 7. Confirmed optional-only inclusion policy

Read-only external research on 2026-08-06 tested whether any of the four cosmetic roles adds enough evidence-backed value beyond appropriate Shampoo/basic care to become a deterministic `basis` step.

**Confirmed V1 verdict:** keep all four cosmetic roles `optional`. None becomes `basis`. An owned product remains recognized and evaluated independently of that tier.

| Rule ID | Condition | Output |
|---|---|---|
| `scalp_care.inclusion.never_basis` | Any V1 profile or cosmetic role | Never return `basis`. |
| `scalp_care.inclusion.response_unknown_caps_optional` | A relevant scalp issue may persist despite appropriate Shampoo, but duration, appropriate prior Shampoo use, and response are not captured losslessly | Cap the role at `optional`; do not infer treatment failure. |
| `scalp_care.inclusion.owned_visible` | User owns or reports a product in any of the four roles | Preserve and evaluate the exact product independently of whether that role is included in the ideal plan. |

Optional does not mean globally visible. It is a contextual ceiling and requires either a matching quiz signal or an owned product:

| Rule ID | Current observable condition | V1 category behavior |
|---|---|---|
| `scalp_care.inclusion.balanced_absent` | `scalpOiliness = balanced`, no `scalpConcerns`, no `hair_loss_or_thinning`, and no owned Scalp Care product | Do not show a proactive Kopfhautpflege card. |
| `scalp_care.role.comfort` | Dry scalp, or safely clarified mild sensitivity/itch without a reaction or inflammatory red flag | Allow optional `scalp_comfort`. |
| `scalp_care.role.flake_oil_adjunct` | Oily scalp, `oily_dandruff`, or `dry_dandruff` | Allow optional `scalp_flake_oil_adjunct`; keep appropriate Shampoo primary for dandruff-like flakes. Oiliness alone does not imply exfoliation. |
| `scalp_care.role.density_claim` | `currentConcerns` contains `hair_loss_or_thinning` | Allow optional `density_claim_tonic` with cosmetic, uncertainty-aware wording; do not infer that the concern is gradual or cosmetic-only, promise regrowth, or imply a diagnosis. |
| `scalp_care.role.exfoliant` | Product-derived `scalpBuildupSignal = present` on an intact, tolerant scalp, or an exact owned exfoliant | Allow optional `scalp_exfoliant` using exact-product protocol. Reuse product-load reason facts; do not infer it from oiliness alone or from products used only in the lengths. |
| `scalp_care.safety.burning_pause` | Burning, pain, open or weeping areas, swelling, pronounced active redness/rash, pustules, or a known product reaction | Do not recommend or execute cosmetic Scalp Care; pause cosmetic optimization and route to appropriate assessment. |

### Exact onboarding input-to-role map

Current `main` (reviewed 2026-08-06) supplies these lossless structured inputs. The category must consume only the values that can change its deterministic result:

| Canonical input | Value | Scalp Care result |
|---|---|---|
| `scalpOiliness` | `oily` | Add optional `scalp_flake_oil_adjunct`. This does not establish buildup and does not unlock `scalp_exfoliant`. |
| `scalpOiliness` | `dry` | Add optional `scalp_comfort`. |
| `scalpOiliness` | `balanced` | Add no role. `balanced` does not override a separately selected scalp concern. |
| `scalpOiliness` | missing | Add no role from oiliness; do not guess. A completed new onboarding cannot reach this state, but older/incomplete data can. |
| `scalpConcerns[]` | `oily_dandruff` | Add optional `scalp_flake_oil_adjunct`; appropriate Shampoo remains the primary dandruff route. |
| `scalpConcerns[]` | `dry_dandruff` | Add optional `scalp_flake_oil_adjunct` plus supporting `scalp_comfort`; this is one category result and does not imply two purchases. Appropriate Shampoo remains primary for flakes. |
| `scalpConcerns[]` | `irritated` | Do not assign a role until the conditional `scalpIrritationState` answer is available. |
| `scalpIrritationState` | `mild_sensitive_or_itchy` | Add optional `scalp_comfort`. |
| `scalpIrritationState` | `burning_painful_or_inflamed` | Suppress every cosmetic Scalp Care role, including an otherwise-triggered density or flake/oil role. Safety wins. |
| `currentConcerns[]` | `hair_loss_or_thinning` | Add optional `density_claim_tonic`, unless a scalp-safety suppression wins. Use cosmetic, uncertainty-aware wording only. |
| Derived product-usage context | `scalpBuildupSignal = present` | Add optional `scalp_exfoliant`, provided the scalp is not in a safety-pause state. This is computed from the products and frequencies the user reports, not from a new quiz question. |
| Owned-product inventory | Recognized product in any of the four roles | Keep it visible and evaluate it role-relatively in Stage 2; ownership does not create Stage 1 need or change `not_needed` to `optional`. |

These available inputs are deliberately **not** Scalp Care inclusion triggers:

| Available input | Why it is not consumed for inclusion |
|---|---|
| `density = low` | Stable hair density is not evidence of active thinning or loss. |
| `goals[]` contains `scalp_balance` | Nick confirmed that a balanced scalp without a current issue should not show Scalp Care; a goal alone is too broad. |
| `concernRecurrence` | It captures recurrence for one ranked hair concern, not duration, onset, Shampoo adequacy, or response. It cannot promote Scalp Care beyond optional or resolve safety. |
| `previousAttempts` | It does not identify which Shampoo/product was used, whether it was appropriate, how long it was used, or the response. |
| `currentConcernsOtherText` | Raw free text is retained but not interpreted as a deterministic medical or product-routing signal. |
| Hair texture, thickness, length, surface, elasticity, chemical treatment, routine style, and budget-related answers | None safely changes whether a Scalp Care role is present. Product-specific fit may consume verified facts later, but Stage 1 inclusion does not. |

`scalpBuildupSignal` is an adapted shared dependency, not a second buildup calculator inside Scalp Care:

- reuse the confirmed product-usage/Reset reason facts from Deep Cleansing;
- current qualifying evidence includes regular/frequent Dry Shampoo use and another regularly used residue-prone leave-on whose verified application target includes scalp/roots;
- ordinary Shampoo, Deep Cleansing Shampoo, rinse-off exfoliants, and other cleanser/rinse-off steps are excluded merely for touching the scalp;
- oily scalp by itself does not qualify, even though it contributes to the broader Deep Cleansing `resetLoad`;
- Leave-in, Mask, or finishing Oil used only in lengths does not qualify for a scalp exfoliant, even though it may contribute to general hair/product Reset load;
- low Shampoo frequency and `low_volume_or_weighed_down` remain corroborating context only and do not create scalp buildup alone;
- an owned exfoliant remains visible independently, but ownership does not manufacture underlying buildup need;
- the shared computation must expose source reason facts, not only a scalar, so Scalp Care can distinguish scalp/root exposure from length-only load.

This keeps adjacent-category ownership honest: Deep Cleansing Shampoo remains the primary general hair/product-residue Reset. `scalp_exfoliant` is optional only for the scalp/root-specific subset. Final cross-category presentation and deduplication remain a shared dependency so the plan never recommends two Reset purchases merely because both categories can see the same source facts.

The current quiz also has no structured hair-loss onset/pattern input: it cannot distinguish gradual from sudden loss, diffuse from patchy loss, or ordinary concern from pain/inflammation-associated loss. Nick confirmed that no second hair-loss clarification is required for V1: `hair_loss_or_thinning` is sufficient to compute the optional `density_claim_tonic` route. Missing detail limits claims and confidence rather than blocking the role. Deterministic copy must not characterize the case as cosmetic-only and must retain a general boundary for sudden, patchy, painful, burning-associated, or inflamed loss; a cosmetic product recommendation never replaces appropriate assessment.

### Plan-wide job coverage and new-product recommendations

Nick confirmed that Scalp Care recommendations must be driven by **material uncovered jobs**, not by the number of triggered roles. Stage 1 may expose several optional roles; the shared portfolio pass then asks which of their jobs are already adequately covered by selected products in other categories.

| Scalp Care role/job | Primary or overlapping owner elsewhere | Portfolio consequence |
|---|---|---|
| `scalp_comfort` | An appropriate gentle/targeted Shampoo can provide the primary dry/itchy scalp route | If the selected Shampoo adequately covers the job, do not recommend another Scalp Care purchase for comfort alone. Keep a compatible owned product visible. |
| `scalp_flake_oil_adjunct` | Targeted Shampoo is primary for dandruff-like flakes and oil management | Scalp Care remains supporting. Do not recommend it merely to duplicate a valid Shampoo route. |
| `scalp_exfoliant` | Deep Cleansing Shampoo owns general product/hair residue; overlap depends on whether the remaining buildup is specifically scalp/root based | Recommend an exfoliant only when a material scalp/root Reset job remains uncovered after Deep Cleansing allocation. Never create two Reset purchases from the same source signal. |
| `density_claim_tonic` | No other current cosmetic Personal Plan category owns thinning/density support | `hair_loss_or_thinning` normally leaves a Scalp-Care-unique cosmetic-support job. If safety and exact-product eligibility pass, recommend one verified density-role product rather than spending the recommendation on an already-covered comfort job. |

“Scalp-Care-unique” describes portfolio ownership, not proven treatment efficacy. User-facing copy must say the product is optional cosmetic support for thinning/density concerns; it must not say that it fixes or treats hair loss.

| Rule ID | Inputs and trigger | Output and precedence |
|---|---|---|
| `scalp_care.portfolio.uncovered_job_gate` | Triggered Scalp Care role plus plan-wide coverage ledger says its material job is not adequately covered | The role becomes eligible for a new exact-product recommendation, subject to safety and product-fit gates. |
| `scalp_care.portfolio.no_duplicate_purchase` | Triggered role's job is adequately covered by another selected category/product | No new Scalp Care purchase for that role. Preserve the optional reason and any compatible owned product without creating a shopping recommendation. |
| `scalp_care.portfolio.density_unique` | `hair_loss_or_thinning` triggers `density_claim_tonic` and no safety suppression applies | Treat density support as uncovered in the current cosmetic portfolio and seek one eligible exact product. |
| `scalp_care.portfolio.one_primary_role_only` | A product has one verified `primary_role`; package copy also mentions supporting effects | Credit only the verified primary role for deterministic coverage. Supporting copy may remain visible but cannot silently cover another job. A future multi-role model requires an explicit normalized role relation. |
| `scalp_care.portfolio.one_analysed_product_per_role` | One product is owned for a triggered role, or the user has selected a main product from several same-role products | Analyse and assign that role's one main product in V1. When several same-role products exist without a selection, ask the shared conditional main-product question; save/show all products and analyse none automatically. |
| `scalp_care.portfolio.second_product_only_for_second_uncovered_job` | After the first selected product, a separate material job remains uncovered | A second product may be considered. Multiple signals alone never justify it. |
| `scalp_care.portfolio.no_safe_candidate` | A material job is uncovered but all candidates are mismatch, unknown, unsafe, or unavailable | Keep the job visibly uncovered; never promote a weak/unknown candidate as confident merely to fill the slot. |

Candidate ordering therefore starts with coverage of the highest-priority uncovered job, then category-specific safety and core role fit. Broad marketing claims and presentation format do not count as coverage. Products assigned to different material roles are analysed independently because they perform different jobs; the one-product limit applies within a role, not across the entire Scalp Care category.

### Density-product evidence and recommendation threshold

Nick confirmed that limited efficacy evidence does **not** make the density role owned-product-only. A cosmetic product may receive an optional exact recommendation when its identity, role, status, and protocol are verified, provided the weak evidence is stated visibly.

| Rule ID | Trigger | Output |
|---|---|---|
| `scalp_care.density.role_verified` | Exact product identity is confirmed; cosmetic/medicine status is resolved as cosmetic; verified manufacturer facts support `density_claim_tonic`; critical application protocol facts are available | Product is eligible for role-relative fit and candidate selection. Manufacturer positioning verifies the marketed job, not efficacy. |
| `scalp_care.density.limited_evidence_allowed` | Product passes safety/core fit and category or exact-product efficacy evidence is limited rather than strong | Product may be recommended as `optional` with a visible `limited_evidence` limitation. Do not downgrade it to owned-product-only solely because proof is limited. |
| `scalp_care.density.claim_or_identity_unknown` | Identity, cosmetic status, density role, or critical protocol remains unknown/pending | Return `unknown` / `noch in Prüfung`; do not recommend confidently. |
| `scalp_care.density.ingredient_not_proof` | Caffeine, rosemary, peptides, niacinamide, or another marketed ingredient is present without verified finished-product role/evidence | Ingredient presence alone neither proves the density role nor raises evidence confidence or ranking. |
| `scalp_care.density.medicine_boundary` | Product is medicinal, contains a regulated medicinal active, or requires a medicine-specific route | Keep it outside the cosmetic Scalp Care recommendation set and account for it through the separate medication/context route. |
| `scalp_care.density.evidence_tiebreak` | Several safe, role-fitting candidates exist | Verified finished-product evidence may rank a candidate higher; otherwise rank on exact role fit, tolerability/protocol fit, availability, and budget without inventing efficacy differences. |

Confirmed German limitation template:

> **Kann bei dünner werdendem Haar unterstützen. Die Studienlage ist noch begrenzt, der Nutzen kann individuell variieren.**

For an exact card, prepend the verified product fact rather than rewriting the limitation, for example: “`<Produkt>` ist für dünner werdendes Haar positioniert.” The limitation must remain adjacent to the recommendation and may not be hidden behind an info drawer.

Product fit and efficacy confidence remain separate. A density product may receive `passt sehr gut` when its identity, role, safety, and application protocol fit exactly; the adjacent limitation still states that the evidence is limited and individual benefit can vary. Limited role-level evidence alone does not force `passt mit Einschränkung`.

Forbidden claims include “stoppt Haarausfall,” “lässt Haare nachwachsen,” “wirkt garantiert,” a diagnosis, or “klinisch bewiesen” without exact finished-product authority sufficient for that exact statement. Even stronger exact-product evidence does not convert the V1 category from `optional` to `basis`.

### Confirmed exact-product reconciliation threshold

A safe owned Scalp Care product suppresses a new purchase when it adequately covers the triggered role. Hair Concierge does not recommend replacement for a marginal upgrade or a stronger marketing claim.

| Reconciliation state | Exact-product conditions | Personal Plan result |
|---|---|---|
| `keep_and_use` | Identity and cosmetic status are verified; product covers a triggered uncovered role; it is compatible with the user's scalp state; critical application instructions are complete | Keep the owned product and execute its exact protocol. Do not recommend another purchase for the same job. |
| `keep_pending_protocol` | Product appears role-compatible and no safety conflict is known, but identity or a safety-critical non-cadence direction remains incomplete | Keep it visible as owned, label it pending, and do not schedule it or recommend a duplicate merely because the record is incomplete. Missing repeat cadence alone uses the confirmed `Bei Bedarf` fallback. |
| `do_not_use` | Material role mismatch, active safety conflict, known reaction, medicinal/cosmetic misclassification, or another product-specific contraindication | Do not execute it as cosmetic Scalp Care. Explain the material reason and use the appropriate safety or medication route. |
| `replace_recommended` | The relevant job remains uncovered because the owned product is materially mismatched, unsafe, or cannot become executable after reasonable identity/protocol verification | Recommend one verified replacement for that uncovered role. |
| `new_recommendation` | A material Scalp Care job is triggered and uncovered, and no owned product adequately covers it | Recommend one verified exact product, subject to safety, evidence wording, availability, and protocol gates. |

Eligible exact products rank by role match, scalp compatibility and safety, protocol completeness and practicality, Drogerie availability and price, then evidence confidence. Claim strength alone never improves rank. A second Scalp Care product still requires a second material uncovered job.

Independent compatible triggers accumulate into one optional category result with a stable role set. They never create duplicate Kopfhautpflege cards or silently require multiple products. Precedence is:

1. `burning_painful_or_inflamed` → suppress cosmetic Scalp Care optimization;
2. selected `irritated` with missing `scalpIrritationState` → typed `clarification_required`, with no exact Scalp Care recommendation yet;
3. otherwise union every triggered role and return `optional`;
4. no triggered role → `not_needed` and omit the proactive category card.

### Confirmed conditional clarification contract

The current `scalpConcerns = irritated` option is described as **“Jucken, Rötungen oder Brennen”**. That one value combines a potentially compatible mild-itch case with a suppressing burning/reaction case. Nick confirmed that onboarding must ask one conditional clarification immediately after `scalp_concerns` whenever `irritated` is selected:

> **Wie fühlt sich die Reizung aktuell an?**
>
> `Leicht empfindlich oder gelegentlich juckend` / `Brennend, schmerzhaft oder deutlich entzündet`

Planned stable contract:

- screen ID: `scalp_irritation_detail`;
- durable answer: `scalpIrritationState?: "mild_sensitive_or_itchy" | "burning_painful_or_inflamed"`;
- flow: `scalp_oiliness` → `scalp_concerns` → conditional `scalp_irritation_detail` → the existing recurrence/conflict path;
- trigger: show the screen if and only if `scalpConcerns.includes("irritated")`;
- selection: required before continuing on that path;
- continuation: selecting either answer advances into the existing post-scalp routing; structured hair concerns go to `admission_recurrence`, otherwise an applicable conflict goes to `admission_conflict`, otherwise the user continues to `admission_practical_cost`;
- safety-route continuity: `burning_painful_or_inflamed` records the cosmetic-Scalp-Care pause but never strands or terminates onboarding;
- back-navigation: if `irritated` is deselected, clear `scalpIrritationState` and skip the conditional screen;
- draft/resume: persist and restore the answer because it changes safety and recommendation behavior; it is not ephemeral conversion/admission data;
- legacy or incomplete input: `irritated` without `scalpIrritationState` returns `clarification_required` and authorizes no exact cosmetic Scalp Care recommendation;
- invalid state: a stored `scalpIrritationState` without `irritated` must be cleared during draft editing and rejected or canonicalized away at final validation;
- versioning: implementation must update the lossless answer schema, browser/server draft versions, final submission envelope version as required by repository compatibility policy, downstream projections, and regression tests together.

Only `mild_sensitive_or_itchy` may unlock optional `scalp_comfort`; `burning_painful_or_inflamed` follows `scalp_care.safety.burning_pause`.

An owned Scalp Care product remains visible in product reconciliation even for a balanced scalp. `balanced_absent` suppresses only a proactive category recommendation; it does not hide a product the user already reports using.

The user-facing rationale may say that a compatible leave-on can provide additional targeted scalp support when Shampoo alone has not felt sufficient. It must not claim that longer contact or more ingredient exposure makes every Serum effective; benefit remains exact-product- and evidence-dependent.

| Scenario | Advisory route | Why |
|---|---|---|
| Mild intermittent dry/tight or itchy feeling; intact scalp; no burning, pain, pronounced redness, scale, or known reaction | Optional `scalp_comfort` | Some scalp-lotion and broader moisturizer evidence supports comfort, but not one universal serum or ingredient rule beyond appropriate gentle cleansing. |
| Persistent dry/scaly/itchy or recurrent red scalp | Shampoo-led care and assessment | Dandruff, seborrhoeic dermatitis, eczema, psoriasis, and contact dermatitis overlap; the quiz cannot diagnose “barrier disruption.” |
| Oily scalp without flakes, itch, scale, or confirmed residue | No automatic Serum need | No good evidence supports “rapid oiliness requires acid peeling or scrub.” |
| Oily flakes/dandruff | Shampoo primary; exact-product leave-on may be optional adjunct | Antidandruff Shampoo evidence is stronger. A named studied leave-on cannot prove the whole Serum category necessary. |
| Cosmetic scalp residue with intact, tolerant scalp | Optional `scalp_exfoliant` after ordinary cleansing is considered | Evidence for general cosmetic buildup is weak; exact product directions own protocol and cadence. |
| Thick adherent scale, active inflammation, wounds, pain, burning, weeping/crusting, or known reaction | Pause cosmetic optimization; professional/medicated route | Condition-specific keratolytics or anti-inflammatory products may be appropriate, but that is not a cosmetic Scalp Care Basis rule. |
| Stable low density without an explicit thinning/loss concern | No density-serum need | Density describes hair count, not hair-loss onset or diagnosis. |
| Explicit `hair_loss_or_thinning` concern on currently available input | Optional `density_claim_tonic` with unresolved safety context | The concern is a direct contextual trigger, but onset and pattern are not captured and evidence is weak, heterogeneous, and product-specific; use cautious cosmetic wording and do not infer a cosmetic-only case. |
| Sudden, patchy, unexplained, painful, burning-associated, or inflamed hair loss | Professional assessment | Cosmetic density optimization must not delay assessment. |
| Exact indicated medicated leave-on | Separate medication/context route | A medicine may be essential for a defined indication, but its label/diagnosis/dose cannot be generalized to cosmetic Scalp Care. |

The influencer/expert input is useful product context, but research does not support these as hard rules:

- scalp problems always need Serum/Scrub because Shampoo contact is insufficient;
- oiliness or hormonal change automatically requires acid peeling;
- acid is universally gentler than mechanical exfoliation on sensitive/red scalp;
- DIY Shampoo plus salt/sugar is a safe Scrub;
- niacinamide/ceramides prove a constant therapeutic scalp-serum need;
- high alcohol is beneficial for a compromised scalp;
- every peeling should be used once every two to three weeks;
- cosmetic growth outcomes should be expected after four to eight weeks.

Supported boundaries are narrower:

- Shampoo remains the V1 primary route for dandruff/seborrhoeic-dermatitis-like flakes;
- persistent or active inflammatory symptoms suppress cosmetic optimization;
- exact-product directions own dry/damp application, amount, cadence, rinse mode, contact time, and massage;
- cosmetic growth-serum evidence remains uncertain, while an indicated medicine follows its own explicit route;
- no DIY acid, salt, or sugar scalp treatment enters Hair Concierge guidance.

Key evidence includes a [scalp-lotion study for dry/scaly conditions](https://pubmed.ncbi.nlm.nih.gov/29670385/), [AAD dandruff guidance](https://www.aad.org/public/everyday-care/hair-scalp-care/scalp/treat-dandruff), a [formulated leave-on antidandruff study](https://pmc.ncbi.nlm.nih.gov/articles/PMC5415814/), the [2025 topical-caffeine systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC11855793/), [AAD scale-softener guidance](https://www.aad.org/public/diseases/psoriasis/treatment/genitals/scalp-shampoo), and an example [regulated minoxidil label](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=a05bc954-d369-4eb6-8a7d-d68955af874f&type=display).

A future cosmetic Basis exception requires a named finished product with controlled, sufficiently generalizable scalp evidence showing incremental benefit over the selected Shampoo/basic regimen for a safely observable profile. Shared ingredients or plausible mechanisms are insufficient.

### Cadence research and proposed category rule

The 2026-08-06 Drogerie label review does **not** establish one manufacturer cadence for the whole category. `Optional` answers whether the role belongs in the plan. Once an exact product is selected, its verified directions own the executable cadence when they state one. Nick confirmed one explicit product-policy fallback: if every critical application fact is complete but repeat cadence alone is missing, Hair Concierge uses `Bei Bedarf` for any of the four roles and marks it as a category fallback rather than a manufacturer instruction.

| Scalp Care role | Current label pattern | Proposed category-level wording | Exact-product consequence |
|---|---|---|---|
| `scalp_comfort` | Mixed: evening/overnight treatment, daily use, or daily with increased use as needed | `Optional · Bei Bedarf – nach Produktangabe` | Do not assume all comfort products are occasional. For example, [Balea Sensitive](https://www.dm.de/p/d/1459196/balea-professional-kopfhautpflege-serum-sensitive) is an evening treatment washed out the next morning, while [Eucerin 5% Urea Tonikum](https://www.dm.de/p/d/3086968/eucerin-eucerin-dermo-capillaire-5-prozent-urea-kopfhautberuhigendes-intensiv-tonikum) says daily and up to twice daily as needed. |
| `scalp_flake_oil_adjunct` | Regular/daily leave-on use is common where the label states a frequency | `Optional · Regelmäßig nach Produktangabe` | [GLISS Scalp Balance](https://www.dm.de/p/d/3119228/schwarzkopf-gliss-haarserum-scalp-balance-klaerend) explicitly says daily on wet or dry scalp and no rinsing. Another product never inherits GLISS's cadence; when its own repeat cadence is missing, use the attributed `Bei Bedarf` fallback. |
| `density_claim_tonic` | Consistent daily or near-daily use is the clear market pattern; reviewed labels range from five to seven times weekly to twice daily | `Optional · Regelmäßig nach Produktangabe` | This is not a Mask-like occasional step. [L'Oréal Elvital Fiber Booster](https://www.dm.de/p/d/2976343/l-oreal-paris-elvital-haarserum-fiber-booster-anti-haarverlust) says five to seven times weekly; [Guhl Kraft + Fülle](https://www.rossmann.de/de/pflege-und-duft-guhl-kraft--fuelle-kopfhaut-tonikum/p/4072600703601) says twice daily. Label consistency requirements do not prove the marketed growth or anti-loss effect. |
| `scalp_exfoliant` | Timed pre-Shampoo rinse-off protocol; no repeat interval is stated for the two core Drogerie examples | `Optional · Gelegentlich nach Produktangabe` | [Balea 4% AHA](https://www.dm.de/p/d/1700670/balea-professional-kopfhautpflege-peeling-tiefenreinigung) and [ISANA AHA/PHA](https://www.rossmann.de/de/pflege-und-duft-isana-professional-kopfhautpeeling-tiefenreinigung/p/4068134100023) both specify a 15–20 minute contact time followed by Shampoo. Use the attributed `Bei Bedarf` fallback rather than inventing the influencer's once-every-two-to-three-weeks interval. |

This produces a two-layer contract:

1. Stage 1 may describe the optional role with the role-level wording above.
2. Stage 3 replaces that summary with the exact product's verified directions. If only repeat cadence is absent, it uses `Bei Bedarf` with `cadenceSource = category_fallback`.

Missing protocol facts do not make an owned product disappear. Missing repeat cadence alone also does not block recommendation or execution: it becomes the clearly attributed Hair Concierge `Bei Bedarf` fallback for all four roles. Missing rinse behavior, required contact time, placement, or another critical application fact still keeps the product visible but non-executable until verified. Hair Concierge never borrows a cadence or another application detail from a sibling product.

The Stage-1 terms `Bei Bedarf`, `Regelmäßig`, and `Gelegentlich` communicate the role pattern. Every recommended exact product still requires its own verified safety-critical application instructions. The only permitted category-level substitution is repeat cadence `Bei Bedarf`; it never substitutes for application state, contact time, placement, or rinse behavior.

### Confirmed lean Product Intake contract

Scalp Care reuses the existing cross-category product identity, identifiers, sources, field rationales, commercial fields, image, review, and lifecycle machinery. The user's reported usage frequency also remains the shared `frequency_range` fact and is not replaced by label directions. The shared reporting contract must accept `as_needed` as a non-comparable sibling value so a user can report that behavior consistently across categories; numeric frequency thresholds must never order or compare it.

Only four Scalp-Care-specific product facts are added:

| Field | Requirement | Why it remains separate |
|---|---|---|
| `primary_role` | Required; one of the four confirmed Scalp Care roles | This drives inclusion, job coverage, and candidate selection. Product naming and ingredient presence cannot determine it safely. |
| `presentation_format` | Required; `serum`, `tonic`, `lotion_or_fluid`, `oil`, `scrub`, `other`, or `unknown` | Records what the product is without confusing form with job. `unknown` is allowed for pending review but blocks recommendation readiness; a verified active product must use a known value or reviewed `other`. |
| `rinse_mode` | Required; `leave_on` or `rinse_off` | Both types exist and they occupy different routine positions. This must remain structured rather than hidden in prose. |
| `application_instructions` | Required, verified product-specific guidance | One concise instruction preserves label cadence plus wet/dry state, wash timing, amount, contact time, rinse action, and course duration when the exact label states them. If cadence alone is absent, the runtime adds the separate attributed `Bei Bedarf` fallback. These do not need separate Scalp Care database fields. |

The following proposed fields are deliberately omitted from V1:

- no `secondary_roles`; one primary role is sufficient for selection, while verified supporting claims may stay in ordinary sourced product notes;
- no stored `regulatory_status`; Scalp Care intake accepts cosmetics only, and a medicine is rejected from this category rather than represented as a cosmetic candidate;
- no separate wash timing, application state, amount, contact-time, course-duration, or label-warning columns; exact applicable details live in `application_instructions`;
- no per-product `evidence_state`; the confirmed category/role-level evidence limitation remains visible, especially for density claims;
- no stored `protocol_status`; recommendation readiness is a validator result derived from the required facts, not another manually researched property.
- no `exfoliation_method` or exfoliant ingredient flag in V1; the current recommendation test set contains only acid exfoliants, whose acid type and exact use remain in sourced product facts and `application_instructions`. Add a conditional `acid | physical | hybrid | unknown` subtype only when a verified mechanical or hybrid product requires distinct behavior.

The lean schema does not weaken fail-closed behavior. A rinse-off exfoliant whose verified application instruction omits the necessary contact and rinse steps cannot become executable. Explicit manufacturer warnings remain part of the shared source record and must not be discarded, while the confirmed onboarding safety route continues to suppress cosmetic Scalp Care use for burning, pain, or active inflammation.

### Working Drogerie product test set

The first exact-product test set uses two products from each spreadsheet lane. It deliberately mixes straightforward directions, cadence-only gaps, and genuinely critical identity/protocol gaps so fixtures distinguish recommendation-ready products, the Hair Concierge `Bei Bedarf` fallback, and `noch in Prüfung` outcomes.

| Provisional primary role | Product | Presentation format | Rinse mode | Verified public application instruction | Expected fixture value |
|---|---|---|---|---|---|
| `scalp_comfort` | [Balea Professional Kopfhautpflege Serum Sensitive](https://www.dm.de/p/d/1459196/balea-professional-kopfhautpflege-serum-sensitive) | `serum` | `rinse_off` after overnight use | Apply to affected areas on dry scalp in the evening, massage, wash the next morning; recurrence is not stated | Low-price comfort example plus a cadence-only gap; use `Bei Bedarf` with `cadenceSource = category_fallback` when the remaining facts pass review. |
| `scalp_comfort` | [Eucerin DermoCapillaire 5% Urea Intensiv-Tonikum](https://www.dm.de/p/d/3086968/eucerin-eucerin-dermo-capillaire-5-prozent-urea-kopfhautberuhigendes-intensiv-tonikum) | `tonic` | `leave_on` | Daily on dry or damp scalp; up to twice daily as needed | Complete comfort protocol and a useful daily-versus-as-needed test. Its `Medizinische Pflege` retailer label also tests that marketing language does not make it a medicine. |
| `scalp_flake_oil_adjunct` | [GLISS Scalp Balance Klärendes Serum](https://www.dm.de/p/d/3119228/schwarzkopf-gliss-haarserum-scalp-balance-klaerend) | `serum` | `leave_on` | Daily on wet or dry scalp, massage, do not rinse; usable after or between washes | Clear oily-scalp adjunct with a complete daily leave-on protocol. |
| `scalp_flake_oil_adjunct` | [Head & Shoulders DermaXPro Kopfhaut-Feuchtigkeitspflege](https://www.dm.de/p/d/2482723/head-und-shoulders-leave-in-serum-derma-x-pro-kopfhaut-feuchtigkeitspflege) | `serum` | `leave_on` | Apply to scalp and do not rinse; the public retailer page refers elsewhere for detailed directions and states no cadence | Boundary case because the page emphasizes dry/tight scalp while also claiming reduced flakes; expected `noch in Prüfung` until primary role and the referenced critical directions are verified. Cadence alone would use the fallback. |
| `density_claim_tonic` | [L'Oréal Elvital Fiber Booster Anti-Haarverlust Serum](https://www.dm.de/p/d/2976343/l-oreal-paris-elvital-haarserum-fiber-booster-anti-haarverlust) | `serum` | `leave_on` | Apply directly to scalp five to seven times weekly after Shampoo and Conditioner, massage, do not rinse | Mainstream Drogerie density example with near-daily post-wash instructions and the confirmed limited-evidence copy requirement. |
| `density_claim_tonic` | [The Ordinary Multi-Peptide Serum for Hair Density](https://theordinary.com/de-de/multi-peptide-serum-for-hair-density-hair-scalp-treatment-100434.html) | `serum` | `leave_on` | Massage a few drops into clean, dry scalp once daily, ideally at bedtime; do not wash after application | Contrasting daily bedtime protocol and a test that market positioning establishes role, not proven hair-loss efficacy. |
| `scalp_exfoliant` | [Balea Professional 4% AHA Kopfhautpflege Peeling](https://www.dm.de/p/d/1700670/balea-professional-kopfhautpflege-peeling-tiefenreinigung) | `unknown` pending physical-format verification | `rinse_off` | Apply and massage into scalp, leave 15–20 minutes, then wash out with Shampoo; repeat interval is not stated | Low-price acid exfoliant and missing-repeat-cadence fixture. Format remains pending; once verified, cadence uses the attributed `Bei Bedarf` fallback rather than the influencer's two-to-three-week interval. |
| `scalp_exfoliant` | [ISANA Professional 2% PHA + 2% AHA Kopfhautpeeling](https://www.rossmann.de/de/pflege-und-duft-isana-professional-kopfhautpeeling-tiefenreinigung/p/4068134100023) | `unknown` pending physical-format verification | `rinse_off` | Apply and massage into scalp, leave 15–20 minutes, then wash out with Shampoo; repeat interval is not stated | Cross-retailer identity fixture. Format remains pending; once verified, cadence uses the same category fallback without borrowing another product's label direction. |

The test set is for deterministic rule and intake validation, not eight launch recommendations. Current availability and exact identity must still pass the normal Product Intake review. Public retailer/manufacturer directions establish intended use, not efficacy.

## 8. Repository and data implications to validate later

Current repository behavior must be replaced by the confirmed canonical model:

- add `scalp_care` as the only supported canonical category for these four cosmetic roles;
- generic `serum` and `scrub` currently canonicalize to `peeling` in the legacy persistence adapter; remove that decision-making shortcut and treat legacy values as compatibility inputs requiring role reconciliation;
- retire Peeling as a canonical product category after compatibility migration; its existing `acid_serum` and `physical_scrub` model must not become the new authority;
- remove the `UNIQUE (user_id, category)` ownership invariant and support several owned products in one category; assign selected products to roles separately from owned inventory;
- prevent exact duplicate ownership at the product identity level rather than preventing two different products in the same category;
- current `main` includes the explicit concern `hair_loss_or_thinning`, so density-claim products now have a direct optional-category trigger separate from stable low density;
- current `scalpConcerns = irritated` still combines itching, redness, and burning and therefore cannot enforce the intended allow-versus-suppress boundary without a conditional clarification or a conservative fallback;
- this task worktree predates those quiz additions, so any later implementation must first rebase or recreate the task from fresh `main` and preserve the current answer schema and downstream assessment behavior;
- Product Intake has no reviewed Scalp Care category/spec path;
- a read-only 2026-08-06 production snapshot showed semantically mixed free-form `peeling` usage rows, 19 unlinked usage records, and no canonical active product/spec rows to preserve. Preserve those usage records through clarification or conservative unknown-format/role migration rather than guessing.

Any later legacy cleanup must use an explicit, reversible expand → backfill → contract migration with regression proof that active plans do not silently change.

## 9. Deliverables and stop gate

This planning stream now provides:

- [`docs/personal-plan/categories/scalp-care/evidence.md`](../docs/personal-plan/categories/scalp-care/evidence.md) for external evidence and rejected overclaims;
- [`docs/personal-plan/categories/scalp-care/decision.md`](../docs/personal-plan/categories/scalp-care/decision.md) for confirmed deterministic Stage-1/2/3 behavior;
- forty-four named fixtures covering all four roles, inclusion boundaries, cross-category coverage, fit, weak/unknown evidence, reactions, red flags, ownership, lifecycle, and exact protocols;
- a reviewed Personal Plan journey showing owned-product recognition separately from proactive recommendations;
- explicit schema, Product Intake, migration, protocol, analytics, rollout, and rollback gates.

The category-policy stop gate is cleared: role taxonomy, identity boundaries, owned-product accounting, evidence treatment, safety behavior, fit, selection, lifecycle, and protocol semantics are explicit and confirmed. Implementation and launch remain blocked by the shared and catalog/data gates listed in `decision.md`. No exact product becomes recommendable merely because it appears in the market map.

## 10. Decision ledger

| Decision | Status | Implication |
|---|---|---|
| Account for all four user-observed purposes | confirmed by Nick | Market roles remain visible even when recommendation evidence is weak or negative. |
| Separate product accounting from proactive recommendation | confirmed by Nick | Evidence changes confidence, wording, and actions—not whether an owned product can exist. |
| Focus discovery on Drogerie products | confirmed by Nick | High-end products are excluded from the working catalog map. |
| Use one canonical `scalp_care` category | confirmed by Nick | Comfort, flake/oil support, density claims, and exfoliation share one product family. Do not create an intermediate `scalp_treatment` plus `peeling` architecture. |
| Separate primary role, presentation format, rinse mode, and instructions | confirmed by Nick | `serum`, `tonic`, `lotion_or_fluid`, `oil`, `scrub`, `other`, and `unknown` describe form only. Format never determines job, evidence, or rinse behavior. |
| Support multiple owned products per category | confirmed architectural consequence | Replace the current one-row-per-user/category assumption before launch. A user may own several Scalp Care products with different roles; plan assignment remains role-relative. |
| Analyse one selected product per relevant role | confirmed by Nick | Save every owned Scalp Care product. With several products in one role, ask the shared conditional main-product question and analyse only the user's selection; do not default to first-entered or auto-rank all siblings. Separate relevant roles may each have one analysed product. |
| Preserve four working roles | confirmed by Nick | Comfort, flake/oil adjunct, density claim, and exfoliation form the V1 market taxonomy. |
| Cosmetic Scalp Care roles remain optional-only in V1 | confirmed by Nick | Owned products stay recognized, but no cosmetic role becomes a compulsory ideal-plan purchase; missing persistence, prior-Shampoo, and response inputs cap any inferred role at optional. |
| Optional visibility is contextual, not universal | confirmed by Nick | Matching scalp issues, product-derived scalp/root buildup, or `hair_loss_or_thinning` may show the relevant optional role; a balanced scalp with no matching signal gets no proactive Kopfhautpflege card. |
| Mild itching/sensitivity may allow comfort support; burning suppresses it | confirmed by Nick | Add the durable conditional `scalp_irritation_detail` onboarding screen. Missing detail on a selected `irritated` concern returns `clarification_required`; the burning/pain/inflammation answer suppresses every cosmetic Scalp Care role. |
| Reuse product-derived buildup | confirmed by Nick | Derive optional `scalp_exfoliant` from shared product-usage reason facts for residue-prone scalp/root exposure. Exclude ordinary Shampoo, Deep Cleansing, rinse-off treatments, oily scalp alone, and length-only load. |
| Generic hair-loss/thinning input is sufficient for V1 routing | confirmed by Nick | `hair_loss_or_thinning` directly creates optional `density_claim_tonic`; do not add another onboarding question. Missing onset/pattern detail limits claims and requires a general escalation boundary rather than blocking the optional role. |
| Recommend against material uncovered jobs, not triggered-role count | confirmed by Nick | Shampoo/Deep Cleansing coverage suppresses duplicate comfort/flake/Reset purchases. Density support is Scalp-Care-unique in the current cosmetic portfolio, so an eligible density product gets recommendation priority. A second Scalp Care product needs a second uncovered job. |
| Adequate owned Scalp Care product suppresses a replacement purchase | confirmed by Nick | Keep and use a safe, verified owned product that materially covers the role. Recommend replacement only for a material role mismatch, safety issue, medicinal/cosmetic misclassification, or unresolved non-executable product record—not for a marginal upgrade or stronger marketing claim. |
| Limited evidence may still support an optional density recommendation | confirmed by Nick | Verified cosmetic density positioning plus safe role/protocol fit is enough for candidacy. Product fit and efficacy confidence remain separate: an exact match may say `passt sehr gut` while the adjacent `limited_evidence` statement remains visible. Never upgrade ingredients or marketing into proven efficacy. |
| Optional does not imply arbitrary cadence | confirmed by Nick | Use role-aware summaries: comfort `Bei Bedarf`, flake/oil and density `Regelmäßig`, exfoliation `Gelegentlich`, always qualified by `nach Produktangabe`. Exact verified product directions own the executable schedule. |
| Keep the Scalp Care Product Intake spec lean | confirmed by Nick | Add only `primary_role`, `presentation_format`, structured `rinse_mode`, and sourced `application_instructions`; reuse the shared identity/commercial/review machinery and user-reported frequency. Model `as_needed` as a non-comparable reported-frequency sibling rather than forcing it into numeric cadence arithmetic. Do not add secondary-role, regulatory-status, evidence-state, protocol-status, or separate application-detail columns in V1. |
| Defer exfoliation subtype | confirmed by Nick | Do not add an ingredient flag or `exfoliation_method` in V1. Current exact candidates are acid exfoliants; introduce a conditional method subtype only when a reviewed mechanical or hybrid product needs distinct behavior. |
| Exact products require individual application instructions | confirmed by Nick | The single sourced instruction contains every stated application detail. Missing repeat cadence alone falls back to clearly attributed Hair Concierge `Bei Bedarf` for all four roles; missing safety-critical non-cadence instructions still block execution. Never borrow instructions from another product. |
| Eight-product working test set | research-backed proposal | Use two products per confirmed role, including complete protocols, ambiguous-role products, cadence-only fallback cases, and critical missing-data cases so validation covers recommendation-ready, fallback, and `noch in Prüfung` outcomes. |
| Future Basis exception | research-supported proposal | Require a named finished product with controlled incremental scalp evidence and a safely observable low-risk predicate. |
| Keep medicines adjacent rather than forcing them into Scalp Care | research-supported proposal | Medicines remain account-able through appropriate health context without corrupting the cosmetic category. |
| Exact-product fit, selection, and efficacy treatment | confirmed by Nick and specified in `decision.md` | Use layered role-relative fit. Density candidates remain optional but may be `ideal` when product fit is exact; evidence uncertainty stays separate and adjacent. Several same-role owned products require user selection. Missing cadence uses the attributed `Bei Bedarf` fallback; other critical missing facts remain `unknown`. |

## 11. Review and handoff

- Worktree: `.worktrees/scalp-serum-category-plan` on `codex/scalp-serum-category-plan`.
- Explorer: read-only market-taxonomy research completed 2026-08-06; no repository or external-system writes.
- Counterpart review of the earlier exhaustive map found no technical blocker, but Nick's clarification supersedes its interview-shaped framing.
- Conditional-screen evidence: `plans/mockups/2026-08-06-scalp-irritation-conditional.html` and its rendered PNG; Nick approved the visual on 2026-08-06 with the requirement that both answer paths continue through onboarding. The mockup and flow contract now show that continuation.
- Artifact disposition: retain this corrected plan, the evidence authority, the confirmed decision authority, and the approved conditional-screen mockup; no commit or publication is authorized.
- Next action: integrate the confirmed Scalp Care authority into the shared Personal Plan implementation plan, then satisfy its named multi-product, role-assignment, quiz, catalog, protocol, migration, and `as_needed` gates before executable recommendation work.
