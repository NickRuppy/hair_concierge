# Mask formulation evidence pass — 2026-09-04

Provenance: hair-care-expert research lane (opus), dispatched during Phase 2 property-set
design; read-only external-evidence task. Findings informed `01_property-set-v0.md`. All
conclusions bounded by the E2 formula-only ceiling (EU 1223/2009 Art. 19: descending order
only above the invisible 1% boundary).

## 1. Architecture delta: mask vs conditioner

Verdict: predominantly dose and rheology on a continuum, not a distinct architecture. Both are
lamellar-gel-network O/W systems (cationic surfactant swelling fatty alcohols). A blind INCI
read cannot reliably classify mask vs conditioner; it can rank richness probabilistically.
Masks tend to shift: higher total fatty-alcohol/cationic load, more/heavier lipids (butters,
triglycerides), broader secondary conditioning polymer set — none mask-exclusive.
Rule adopted: category comes from product metadata/directions at G0, never from INCI; the
engine is the conditioner architecture with a shifted richness prior.

## 2. Treatment concentration axis

Verdict: real payload differences exist and are partly visible as architecture, but a
three-step scale is at the edge of INCI support (confidence low-moderate). Honest signals
(structural position only): cationic breadth (≥2 distinct cationics above the
fragrance/preservative line), fatty-alcohol position (rank 2–3 vs mid-list), lipid stack above
the tail. False signals: rheology-only ingredients (HEC, xanthan, carbomer), sub-1% hero tail
(hydrolyzed keratin/panthenol/ceramides after fragrance), ingredient count. No published
dataset maps INCI patterns to validated low/medium/high thresholds.
Rule adopted: structural position only; post-tail ingredients contribute nothing; extremes need
multiple independent signals; unresolvable → moderate + uncertain flag.

## 3. Dwell time

Verdict: cationic/silicone deposition is fast and largely equilibrium/concentration-driven;
1-minute vs 5-minute dwell of similar architectures is not reliably different. Longer dwell
matters more for slow-diffusing small molecules (peptides, oils) — evidence weak. No
peer-reviewed head-to-head dwell trial exists; the 7-second segment is outside all tested
contact times.
Rule adopted: dwell is protocol/UX metadata with zero classification credit; 7-second claims
marked unknown, never extrapolated in either direction.

## 4. Heat assist

Verdict: plausible for lipid/small-peptide uptake but evidence thin and indirect; popular
uptake percentages trace to blogs. Oil penetration is more damage/porosity-dependent than
warmth-dependent.
Rule adopted: heat assist is an optional protocol modifier, never a formula property or
ranking input; copy stays hedged; no "opens the cuticle" language.

## 5. Protein overload / over-conditioning

Verdict: "protein overload" as a named condition is not established (practitioner/consumer
construct); published protein work mostly shows improved mechanics (mid/high-MW keratin
peptides raising Young's modulus, reducing breakage). Heaviness/stiffness is a real but
individual, reversible product-to-hair mismatch.
Rule adopted: never diagnose; heavy protein payload is a soft internal counter-signal and
review trigger only; diagnosis vocabulary banned in copy.

## 6. Bond chemistry in German drugstore masks

Verdict: three identifiable named routes — maleate esters (Olaplex-style), gluconamides
(Henkel system; present in Gliss 4-in-1 Repair Bond mask), peptide systems (K18-style; largely
absent from drugstore rinse-out masks). None has strong independent product-level
substantiation at drugstore concentrations; "Bond" front-of-pack is frequently ordinary rich
masks. Citric acid is a ubiquitous pH adjuster — claim-only as "bonding".
Rule adopted: `bond_route` strictly by named-INCI presence above the sub-1% tail; citric acid
and hydrolyzed proteins are never bond evidence; repair language stays comparative, never
efficacy. Open risk: gluconamide bonding has zero independent literature; two secondary-source
figures (Olaplex tensile numbers) remain unverified at one remove.
*Correction (lexicon v0.1, 2026-09-04): independent peer-reviewed gluconamide literature does
exist (ACS Crystal Growth & Design 2022) but is a crystallography/interaction study that states
the hair mechanism is unknown — so the practical conclusion (no substantiated product-level
efficacy at drugstore concentration) is unchanged, now better sourced.*

## 7. Gloss / lamination

Verdict: real optical mechanism (surface smoothing raises specular reflection) but not
separable from ordinary smoothing-film shine; "lamination" is positioning, not distinct
chemistry; glycolic acid plasticizes temporarily (decreased Young's modulus), does not seal.
Rule adopted: no lamination/gloss route property. Gloss masks route through the shine focus
threshold (distinct optical emphasis architecture — silicones/cationic polymers with low lipid
load — plus claim corroboration); no sealing/penetration/lasting-change language.

## 8. Thickness / weight fit

Verdict: best-supported axis, inferred not measured. Fatty-alcohol/butter load, not silicone
presence, is the main weight driver; fine-hair flattening is a fit mismatch, not a hair-type
law (silicone-microemulsion evidence shows fine hair can benefit from conditioning products).
Anchors adopted (provisional): low = single cationic, cetearyl not top-3, no butter/heavy
triglyceride above tail; high = ≥2 cationics, cetearyl top-3, butter/heavy oil above tail,
occlusive silicone stack; moderate = everything else (expected majority — accepted).
Weight drives soft preference with stated reason, never "fine hair must avoid masks".

## Key sources

- EU Reg. 1223/2009 Art. 19 — https://www.legislation.gov.uk/eur/2009/1223/article/19
- Lamellar gel networks in hair conditioners review, Adv. Colloid Interface Sci. 2025 —
  https://www.sciencedirect.com/science/article/pii/S0001868625000302
- Tham et al., Int J Cosmet Sci 2026 — https://onlinelibrary.wiley.com/doi/10.1111/ics.70038
- Malinauskyte et al., hydrolysed keratin penetration —
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7820954/
- Rele & Mohile, J Cosmet Sci 2003 — https://library.scconline.org/v054n02/77
- Oil penetration vs damage, Cosmetics 2024;11(2):64 — https://www.mdpi.com/2079-9284/11/2/64
- Glycolic acid and hair, Cosmetics & Toiletries —
  https://www.cosmeticsandtoiletries.com/formulas-products/hair-care/article/21836160/
- Gliss 4-in-1 Repair Bond mask INCI —
  https://incidecoder.com/products/schwarzkopf-gliss-4-in-1-repair-bond-building-hair-mask
- Bond builders secondary review —
  https://marketingorscience.com/articles/haircare/2026/04/bond-builders-hair
- Lab Muffin conditioner myths (practitioner tier) —
  https://labmuffin.com/busting-hair-conditioner-myths-build-up-silicones-weighing-hair-down-etc/
