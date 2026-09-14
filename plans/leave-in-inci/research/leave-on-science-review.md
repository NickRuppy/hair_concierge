# Leave-On Science Review — evidence base for Leave-In Classification Standard v1.0

**Status:** research input, not a standard. Feeds the CANDIDATE ontology in
`handover/01_Leave_In_Category_Development_Handover_v1.0.txt` §7–§12.
**Scope:** Germany/EU leave-on hair conditioning products (spray, mist, milk, lotion, cream,
microemulsion, two-phase). **Date:** 2026-09-03.
**Author lane:** scientific research lane (independent of Tom's methodology).

**What this document is not:** it does not classify any product, does not propose the
calibration list, and does not write the standard. It supplies the evidence and the
KEEP/MERGE/DEMOTE verdicts the standard author needs.

**Reading the confidence labels used below**

| Label | Meaning here |
|---|---|
| Well supported | Multiple independent peer-reviewed / textbook sources agree; mechanism and measurement both established |
| Moderately supported | Mechanism established, but quantitative behaviour is formulation-dependent or measured mostly in rinse-out or model systems |
| Mixed / debated | Credible sources disagree, or effect direction flips with conditions (dose, humidity, substrate) |
| Weak / not established | Single-source, supplier-only, extrapolated from a different exposure regime, or mechanistically plausible but unmeasured |

---

## Block A — Formula architecture taxonomy for leave-ons

### A.1 The five architectures that actually differ

Leave-on conditioning products are not a viscosity continuum. They are four or five distinct
colloidal systems, and the distinction is INCI-visible with moderate-to-high reliability.

| Architecture | What holds it together | INCI-visible markers | Typical non-volatile load |
|---|---|---|---|
| **Aqueous / hydroalcoholic solution (spray, mist)** | Nothing — everything is dissolved | Water + glycol/alcohol early; cationic polymer and/or short-chain quat; **no long-chain fatty alcohol**; no or only solubiliser-type emulsifier (PEG-40 Hydrogenated Castor Oil, Polysorbate-20, PPG-x-Buteth-x) | Lowest, but not zero |
| **Emulsion — milk / lotion / cream** | O/W emulsion, usually a cationic-surfactant + fatty-alcohol **lamellar gel network (LGN)** | Behentrimonium/Cetrimonium/Distearyldimonium chloride or Stearamidopropyl Dimethylamine **plus** Cetearyl/Cetyl/Stearyl Alcohol; often Glyceryl Stearate, Carbomer, Xanthan | Moderate → high; rises with fatty-alcohol and oil count |
| **Microemulsion** | Thermodynamically stable, droplet <~100 nm, high surfactant/co-surfactant ratio | Clear product with a real oil/silicone load; several PEG-esters/solubilisers plus glycols high in the list; no LGN pair | Moderate, but visually "light" — a classic trap |
| **Two-phase / biphasic spray** | Deliberately *not* emulsified; user shakes | Water phase + an oil/silicone phase with **no emulsifier at all**; directions say "vor Gebrauch gut schütteln" | Low-to-moderate but highly dose-variable |
| **Anhydrous serum / oil** | No water | No Aqua, or Aqua absent from the top; Cyclopentasiloxane / Dimethicone / oils lead | High — **out of category** per the handover boundary |

The LGN literature is the strongest anchor for the emulsion class: the interconnected lamellar
gel network built from a cationic surfactant plus long-chain fatty alcohols is what produces
cream rheology and the reservoir of conditioning material, and its properties are governed by
the surfactant:fatty-alcohol ratio, chain length and processing rather than by any single
"hero" ingredient (*Advances in Colloid and Interface Science*, 2025 — review of lamellar gel
networks in hair conditioners,
<https://www.sciencedirect.com/science/article/pii/S0001868625000302>). Industry formulation
education describes the same leave-on format spread — serum, light lotion, cream, milk,
bi-phase, applied to wet or dry hair (*Cosmetics & Toiletries*, "Remediating Hair Damage
Through Hair Care Formulation Architectures",
<https://www.cosmeticsandtoiletries.com/formulas-products/hair-care/article/22871442/>).

**Confidence: high** that these five classes are real and INCI-separable. **Confidence: moderate**
on assigning a *specific* borderline product (a thin lotion vs a thick milk) — that boundary is
rheological, not compositional, and should not carry decision weight.

### A.2 Dose, and why "grams per use" cannot be read off an INCI list

The handover asks for "typical applied dose (grams per use) per form". The honest answer:
**published, market-representative consumer dose figures for leave-in products do not exist in the
peer-reviewed literature.** What exists is *protocol* dose, from test-method and patent literature:
leave-on treatments in tress studies are commonly applied at ~0.2 g product per g hair, roughly
double the ~0.1 g/g used for rinse-off conditioner protocols, and patent literature quotes
effective ranges of ~0.1–2 ml per 10 g hair. Those are laboratory conventions, not measured
consumer behaviour.

The product-relevant quantity is not dose alone. It is:

```
residue load  ≈  applied dose  ×  non-volatile fraction  ×  (1 − transfer/removal)
```

- A hydroalcoholic spray can be 90–97 % water/volatiles. Even a generous 2 g application leaves
  a small residue.
- A cream applied at 2–4 g with a substantial fatty-alcohol/oil/silicone load leaves an order of
  magnitude more.
- **But a spray can carry a heavy non-volatile package** (silicone microemulsion sprays, oil-loaded
  two-phase sprays), and a "milk" can be mostly water with one cationic polymer.

INCI order gives an *ordinal* read on non-volatile fraction (how early and how many non-volatiles
appear, and whether an LGN pair is present) but **no quantitative read**, and EU Article 19 makes
the sub-1 % tail unordered. So form → weight is a weak inference and must never be a hard rule.

**Product consequence:** FORM is a high-confidence *architecture* label. It is a **low**-confidence
proxy for weight. These must be separate fields. The handover's own false-signal list already says
"spray means lightweight" is false; the research supports making that a **hard gate**, not a note.

---

## Block B — Cationic conditioning without a rinse

### B.1 What changes when the rinse is removed

Rinse-out conditioning is a *deposition* problem: the lamellar gel is diluted and broken on
rinsing, and only a fraction of applied material lands and stays. Leave-on conditioning is a
*retention* problem: essentially the entire applied dose stays on the fibre until transfer,
mechanical loss, or the next wash. Two consequences follow, and both are well supported:

1. **Deposition efficiency stops being the bottleneck.** Ingredients whose rinse-out value comes
   from *targeted* deposition (amodimethicone's selective affinity for anionic damaged sites;
   coacervate-mediated silicone drop-off) lose most of that comparative advantage in a leave-on,
   because untargeted material is not washed away either. Formulation education reflects this:
   leave-in conditioners typically use **lower cationic active levels** and shift toward
   lightweight film-forming cationic polymers (Polyquaternium-10, Polyquaternium-11) rather than
   the high-load quat/fatty-alcohol systems of rinse-out conditioners
   (<https://www.globalformulation.com/hair-conditioner-cationic-surfactants-chemistry/>;
   <https://www.ulprospector.com/knowledge/21517/>).
2. **The margin for over-application collapses.** Rinsing is a forgiving normaliser. Without it,
   dose error is expressed directly as greasiness, limpness or tack. This is the mechanistic basis
   for treating dose sensitivity as a real category property (see DOSE in §K).

### B.2 Family-by-family, leave-on reading

| Family | Representative INCI | Leave-on behaviour | Support |
|---|---|---|---|
| Mono-alkyl quats | Cetrimonium Chloride, Cetrimonium Bromide | Water-soluble, strongly antistatic, good wet slip, comparatively light residue; substantive by charge to the anionic fibre | Well supported (Robbins, *Chemical and Physical Behavior of Human Hair*, 5th ed., Springer 2012, ch. on shampoo/conditioner ingredient interactions) |
| Di-/tri-alkyl and long-chain quats | Behentrimonium Chloride/Methosulfate, Distearyldimonium Chloride | More hydrophobic, more substantive, heavier feel; in leave-on the residue is not moderated by rinsing | Well supported mechanistically; **moderate** on the "heavier" magnitude |
| Amidoamines | Stearamidopropyl Dimethylamine (+ acid) | Requires protonation at product pH; conditioning is real but softness/feel-led. Its rinse-out advantage (protonation-dependent dilution deposition) is not a leave-on advantage | Moderate |
| Cationic polymers | Polyquaternium-10, -7, -11, -55; Guar Hydroxypropyltrimonium Chloride | In leave-on they simply **dry down into a continuous film** — no coacervate needed. PQ-10 is the workhorse: lightweight film, detangling, antistatic. Charge density is the main lever on substantivity *and* on buildup | Moderate-to-well supported; charge density → substantivity is consensus (<https://www.personalcaremagazine.com/story/5516/>) |
| Silicone quats | Silicone Quaternium-16, -22 | Permanently cationic; deposits a medium-weight film reported to concentrate at open cuticle edges in leave-on application; deliberately wash-resistant | Moderate; supplier/trade-literature dominated — label as such |

### B.3 Interaction with anionic styling polymers

Two distinct situations, with very different evidence quality:

- **Within one formula:** strong cationic + strong anionic polymer will complex. Formulators
  therefore pair cationic conditioning with **nonionic or amphoteric** film formers, or use an
  anionic fixative with no cationic partner. Seeing both a high-charge polyquaternium and a
  carboxylated acrylate fixative high in the same INCI is unusual and worth flagging as a
  read/identity check rather than as a performance conclusion. **Well supported as colloid
  chemistry; the coacervate literature is the closest formal evidence base** (P&G patent corpus on
  cationic-polymer/anionic-surfactant coacervates), but that literature is about *shampoo*, so it
  transfers as mechanism only.
- **Across layered products** (cationic leave-in under an anionic gel, or vice versa): this is the
  usual mechanistic story offered for pilling and white flaking. **Evidence is weak.** I found no
  peer-reviewed study measuring pilling/flaking as a function of cationic/anionic layering in
  consumer routines. It is plausible chemistry and widespread practitioner belief, and it should
  be treated as such — a caution, never a computed incompatibility score.

---

## Block C — Silicone systems in leave-on dose

### C.1 A regulatory fact that changes the German/EU picture right now

**Commission Regulation (EU) 2024/1328** (in force 6 June 2024) amends REACH Annex XVII entry 70
and extends the cyclosiloxane restriction. The 0.1 % w/w limit for D4/D5/D6 applies to
**rinse-off** cosmetic products from **6 June 2026**, and is extended to **leave-on** cosmetic
products from **6 June 2027**
(ECHA cyclosiloxanes topic page <https://echa.europa.eu/hot-topics/cyclosiloxanes>;
industry summaries: Biorius <https://biorius.com/cosmetic-news/d4-d5-d6-restrictions/>,
Intertek <https://www.intertek.com/products-retail/insight-bulletins/2024/commission-adopts-eu-wide-restriction-on-cyclosiloxanes/>).

Two direct consequences for a standard authored in September 2026:

1. German/EU leave-in INCI lists **still legally contain Cyclopentasiloxane / Cyclohexasiloxane
   today**, but a reformulation wave to linear volatiles (Disiloxane, Hexamethyldisiloxane,
   Trisiloxane) and volatile hydrocarbons (**Isododecane**, Isohexadecane) is underway and
   completes within the standard's first year of life.
2. Any rule, anchor or calibration entry keyed on "Cyclopentasiloxane present" is a **short-lived
   rule**. The standard should key on *function* ("a volatile carrier is present") with the INCI
   family enumerated, and the re-review trigger should explicitly name the 2027 date.

This is the single most decision-relevant regulatory finding in this review and I recommend it be
surfaced to the standard author and to Nick, not buried in an ingredient table.

### C.2 Volatile vs persistent — what dry-down actually means

- **Volatiles** (cyclosiloxanes today, linear siloxanes/isododecane increasingly) are **carriers**.
  They lower apparent viscosity, aid spreading, and evaporate. Their contribution to the final
  residue is essentially zero.
- **The residue is whatever the volatile was carrying.** This is why "contains a volatile silicone,
  therefore leaves no residue" is a false inference — the handover already lists it; the mechanism
  above is the reason, and it should be stated in the standard so an agent can reason rather than
  pattern-match.
- **Persistent silicones**: Dimethicone (viscosity grade invisible in INCI — a 5 cSt and a
  1,000,000 cSt dimethicone read identically), Dimethiconol (almost always delivered as a
  Dimethicone/Dimethiconol blend), Amodimethicone, Bis-Aminopropyl Dimethicone, silicone quats.

### C.3 Amino silicones and the leave-on selectivity trap

Amodimethicone deposition on keratin has been characterised directly: electrostatic interaction
with the negatively charged fibre controls the *initial* stage, but deposition continues after the
surface charge has been reversed, i.e. it does not self-limit at monolayer coverage
(Colloids and Surfaces A, 2013 — streaming-potential characterisation of silicone-copolymer
deposition on keratin fibres,
<https://www.sciencedirect.com/science/article/abs/pii/S0927775713004111>). Related work on
amino-silicone conditioning across treatment conditions: Lim, Park & Kim, *Fibers and Polymers*
2010;11:507–515.

The practical reading for leave-on:

- The popular claim that amodimethicone "only sticks where hair is damaged, so it can't build up"
  is **a rinse-off argument**, and it is already an over-reading of the deposition data. In a
  leave-on there is no rinse to remove the non-selectively deposited fraction. **Add this to the
  false-signal list — it is not in the handover's §8 list.**
- Amino silicones and silicone quats are *marketed on* wash resistance. Wash resistance and buildup
  are the same property viewed from opposite ends. A standard that scores "persistence" high and
  "buildup risk" low on the same amino-silicone evidence is double-counting in the wrong direction.

### C.4 Buildup in leave-on dose

Dimethicone is removed by surfactant emulsification; amino-functional and quaternised silicones
resist it by design. Repeated leave-on application without a cleanser of adequate strength is the
mechanistically obvious accumulation route. **But: I found no finished-product study quantifying
leave-in buildup over realistic use cycles.** Buildup evidence in the literature is
rinse-off-and-shampoo-centric. This is a genuine gap and WASH must be capped accordingly (see §K).

> **Caution on circulating buildup statistics.** Searches surface confident-sounding figures
> ("only 0.3–0.7 % of polymer remains after five applications", "89 % of dimethicone removed in one
> wash", "no silicone remains after 8 shampoos") on content-farm and brand-blog pages. I could not
> trace any of them to a retrievable primary source, and at least one attributes lab data to a body
> (CIR) that does not run comparative efficacy tests. **Do not let these numbers enter the standard.**

---

## Block D — Emollients and lipids at leave-on dose

### D.1 The organising variable is spreading, not "oil vs butter"

The cosmetic-science variable that predicts slip, greasiness and transfer is the **spreading value**
— the area a fixed quantity of oil covers in a fixed time — which is a joint function of viscosity,
polarity and molecular weight. Low-MW, low-viscosity esters spread fast and leave a "dry" feel;
high-viscosity triglycerides and butters spread slowly and read as rich and occlusive
(*Cosmetics & Toiletries*, "Evaluating the Physiochemical Properties of Emollient Esters for
Cosmetic Use", <https://www.cosmeticsandtoiletries.com/testing/sensory/article/21836556/>;
instrumental + sensory correlation: *Colloids and Surfaces B*, 2012, "Impact of emollients on the
spreading properties of cosmetic products",
<https://www.sciencedirect.com/science/article/abs/pii/S0927776512004237>).

Practical ordering, **moderately supported**:

| Band | Representative INCI | Leave-on read |
|---|---|---|
| Dry-feel / high spreading | Isododecane, Isohexadecane, C13-15 Alkane, Coco-Caprylate, Isoamyl Laurate, Dicaprylyl Carbonate, Isopropyl Myristate | Slip and spread with low perceived greasiness; low weight penalty; some (IPM) carry a known negative "grating/dry" sensory note |
| Medium | Caprylic/Capric Triglyceride, Squalane, Jojoba (wax ester), light silicones | Balanced; the workhorse band for leave-in milks |
| Rich / low spreading | Coconut, Olive, Castor, Avocado oil; Shea/Mango/Cocoa Butter; petrolatum, heavy mineral oil | Occlusion, weight, transfer to skin/pillow; the greasiness risk band |

### D.2 The one lipid with real fibre-level evidence, and its limits

Rele & Mohile (*J Cosmet Sci* 2003;54(2):175–192) found coconut oil — uniquely among mineral,
sunflower and coconut oil — markedly reduced wash-induced protein loss, attributed to lauric acid's
linear chain and affinity for hair protein allowing penetration rather than surface coating
(<https://library.scconline.org/v054n02/99>).

What this does **and does not** license in a leave-in standard:

- It supports *coconut oil specifically* having a protein-loss-reduction mechanism. It does not
  generalise to "botanical oils repair hair" — the study's own comparators failed.
- The protocol was an **oil pre-wash/post-wash treatment**, not a leave-in cream at consumer dose.
  Under the handover's own rule (rinse-out/other-exposure evidence does not transfer), this is
  E2-grade *mechanism* support for a leave-in containing coconut oil, never product evidence.
- It says nothing about weight, greasiness or fine-hair fit.

### D.3 Transfer

Transfer (to skin, collar, pillow, phone) is the leave-on-specific failure mode with the least
literature. It is predicted mechanistically by low-spreading, non-volatile, non-film-forming
lipid load. **No published instrumental transfer method for hair leave-ons surfaced.** Treat as a
qualitative caution attached to WT, not a scored dimension.

---

## Block E — Humectants: when they help, and when a frizz claim is unsupportable

### E.1 The mechanism is not in dispute; the direction of the effect is

Frizz under humidity is well characterised: re-adsorption of atmospheric moisture progressively
reverts a water-set, water uptake at hydrogen-bonding sites swells the fibre, and style expansion
plus fibre misalignment is what is measured as frizz (*Cosmetics & Toiletries*, "Defining and
Controlling Frizz", <https://www.cosmeticsandtoiletries.com/testing/efficacy/article/21835330/>;
"Frizz Factors Revealed: linking humidity, moisture and hair porosity",
<https://www.cosmeticsandtoiletries.com/testing/method-process/article/22949257/>). The standard
instrumented endpoint is dynamic vapour sorption (DVS) — weight gain of hair equilibrated at 0 % vs
90 % RH — paired with image analysis of tress shape.

The consequence is uncomfortable for humectant marketing: **the anti-frizz mechanism that is best
supported is reducing water uptake, and a humectant's function is to increase water association.**
Glycerin, propanediol, glycols, sodium PCA and betaine are therefore *not* an anti-frizz route.
They are a softness/plasticiser route.

### E.2 Where humectants are well supported

- **Softness and pliability** at ordinary indoor humidity: well supported as a mechanism class,
  with panthenol the best-evidenced individual member (see H.1).
- **Preventing a formula from drying to a brittle film**: glycerin/propanediol as polymer
  plasticisers is standard formulation practice — **well supported**, but it is a *film-quality*
  role, not a hair claim.

### E.3 Where the evidence collapses

The "humectants help below and hurt above a dew point of ~60 °F/15 °C" rule is extremely widespread
in curly-hair education and I could not find it in any peer-reviewed source. Every trace led back to
blog and community writing (e.g. curlynikki.com, themestizamuse.com). The *direction* of the effect
is mechanistically plausible; the **threshold is folklore**. A German-market app that encodes a dew-point
number would be presenting community heuristic as science.

**Verdict: for formula-only reasoning, a humectant's presence supports softness at low confidence and
supports nothing about frizz in either direction.** Humidity response cannot be scored from INCI.

---

## Block F — Film formers and styling polymers

### F.1 Hold and humidity resistance are polymer-chemistry properties, and they are real

The fixative literature is mature. Four performance axes are conventionally used: hold strength,
humidity resistance, flake/residue behaviour, and sensory feel. PVP is hygroscopic and loses film
stiffness as RH rises; copolymerising with vinyl acetate (VP/VA) raises the hydrophobic fraction and
improves humidity resistance at the cost of some flexibility; crosslinked polyurethane/acrylate
hybrids (Polyurethane-14 (and) AMP-Acrylates Copolymer) were developed specifically to combine firm
hold with restyleability, characterised via film toughness, tack, drying time and bond-strength
testing (*Cosmetics & Toiletries*, "Polyurethane-14 AMP-Acrylates Copolymer: A Hair Fixative
Technology with 'Memory'",
<https://www.cosmeticsandtoiletries.com/cosmetic-ingredients/sensory/article/21833540/>;
"Advances in Hair Styling", <https://www.cosmeticsandtoiletries.com/formulas-products/hair-care/article/21836009/>).

Humidity resistance is measured, not assumed, by **high-humidity curl retention (HHCR)** — a set
tress hung at ~26 °C / 90 % RH with curl length tracked over 24 h,
`% retention = (Le − Lt)/(Le − Li) × 100`; ~70 % retention held for meaningful duration is the
conventional "good" benchmark — and by its **dynamic** variant (DHCR) under rapid humidity change
(University of Manchester, "Dynamic humidity curl retention as a method for the evaluation of hair
fixative components"; "The Effects of Humidity on Hairstyles: analysis of the mechanical properties
of styling polymers", <https://research.manchester.ac.uk/en/publications/>).

**Confidence: high** that these polymer families differ in hold and humidity behaviour.
**Confidence: low** that a *particular leave-in* delivers a particular hold level from INCI, because
polymer level, plasticiser load, and the competing conditioning phase all move the result and none
are visible.

### F.2 The hold-vs-conditioning confusion the handover is right to worry about

Two mechanistically different things produce "defined, smooth, controlled" hair:

- **Conditioning route:** lubrication + surface film → fibres slide, align, and lie together.
- **Hold route:** a fixative film welds fibre-to-fibre contact points → the shape resists
  deformation.

They feel different (hold adds stiffness, resists restyling, can flake) and they suit different
users. A curl cream whose definition comes from VP/VA + a low conditioning load is a *styling*
product wearing a conditioning label. **The standard needs an explicit hold-attribution rule**, and
the INCI-visible cue is: a fixative-class polymer present with no or minimal cationic/emollient
conditioning architecture behind it.

**Boundary caution:** film-forming polymers also appear at low level purely as rheology modifiers or
carriers. As in the conditioner standard's R5 rule, a gum/starch/acrylate that plausibly serves
bottle viscosity is not a hold route by itself.

---

## Block G — Heat protection (the strict block)

### G.1 What is actually published

Two peer-reviewed anchors exist, and they are narrower than the category's marketing:

1. **Zhou et al., *J Cosmet Sci* 2011;62(2):265–282** — "The effect of various cosmetic pretreatments
   on protecting hair from thermal damage by hot flat ironing". Flat irons >200 °C; endpoints were
   FTIR imaging (α-helix → β-sheet conversion and protein degradation), DSC (keratin denaturation),
   dynamic vapour sorption (water regain/retention), AFM, SEM and thermal imaging. Breakage was
   significantly reduced by pretreatment with **VP/Acrylates/Lauryl Methacrylate Copolymer**,
   **Polyquaternium-55**, and a **polyelectrolyte complex of PVM/MA Copolymer with Polyquaternium-28**
   (<https://pubmed.ncbi.nlm.nih.gov/21635854/>).
2. **McMullen & Jachowicz, *J Cosmet Sci* 1998;49(4):245–256** — curling-iron thermal degradation;
   1 % solutions of **PVP/DMAPA Acrylates Copolymer**, **Quaternium-70** and **hydrolyzed wheat
   protein** each reduced damage on the order of 10–20 % versus control.

Supporting but weaker: Lim, Park & Kim, *Fibers and Polymers* 2010;11:507–515 (amino-silicone
conditioning across treatment conditions); Gomes & Aguiar (Dow Corning conference poster on silicones
as thermal protectants — **supplier conference material, not peer-reviewed**).

### G.2 What follows, stated strictly

- **The published protective agents are specific named polymers, not ingredient classes.** "Contains
  a silicone" and "contains a protein" are not on this list. Even the protein result is one specific
  hydrolysed wheat protein at a defined concentration in a model system.
- **The measured effect sizes are modest.** 10–20 % damage reduction (McMullen & Jachowicz); the
  widely repeated ceiling figure is roughly 50 % protection at best. A product that promises hair is
  "protected up to 230 °C" is making a claim no published method supports in that form — the number
  is a *use-condition* statement, not an efficacy statement.
- **The `heat_protection_max_c` field in Chaarlie's existing leave-in data (221–232 °C on ~8 SKUs,
  per the catalog extract) is a marketing parameter, not a measured protection level.** It should not
  be promoted into the new model as if it graded protection.
- **DSC is the sensitive method but gives a binary answer** — protection happened or it did not —
  and does not translate to consumer-perceptible damage; automated repeated grooming (e.g. 2,000
  brush strokes after ironing, counting fractures) supports "X % less breakage" claims but is less
  sensitive; tryptophan fluorescence loss (ex ~290 nm, em ~340–350 nm) is the third common endpoint
  (TRI Princeton, "Hair Heat Protection Claim Support 101",
  <https://www.triprinceton.org/post/hair-heat-protection-claim-support-101>). The same lab states
  plainly that further research on heat-protecting polymers is needed — i.e. **there is no settled
  formula-to-protection mapping.**

### G.3 The line

| Formula situation | Highest defensible state |
|---|---|
| No relevant polymer; product claims heat protection | `claim_only` |
| Generic silicone / generic protein / panthenol / oil only | `claim_only` — **not** `formula_plausible` |
| One of the specifically evidenced polymer families present (VP/Acrylates/Lauryl Methacrylate, PQ-55, PVM/MA + PQ-28, PVP/DMAPA Acrylates, Quaternium-70) in a plausible film-forming context | `formula_plausible`, E2, low confidence |
| Exact finished product tested (DSC / breakage-after-ironing / tryptophan loss) with stated protocol | `product_tested`, E3+ |

This is stricter than the handover implies and I recommend adopting it as written. The category's
single largest overreach risk is here.

---

## Block H — Protein, repair and bond claims in leave-on

### H.1 Three mechanistically distinct things, routinely merged

1. **Lubrication** (reduces grooming friction → fewer mechanical fractures). Real, measurable via
   combing force and repeated-grooming breakage counts. Delivered by quats, silicones, emollients,
   cationic polymers. **Well supported** as a mechanism; it is *damage prevention*, not repair.
2. **Surface film / substantive deposit** (hydrolysed proteins, cationised proteins, peptides,
   silane derivatives such as Hydrolyzed Wheat Protein PG-Propyl Silanetriol). Cationisation
   (e.g. Hydroxypropyltrimonium Hydrolyzed Wheat Protein, typically ~2,000–6,000 Da) raises
   substantivity by charge. **Moderately supported** for film/feel/body effects; **not supported**
   for structural repair. Note: supplier literature dominates this area and molecular-weight figures
   come from supplier datasheets, not independent measurement.
3. **Bond technology** (covalent chemistry claimed to restore or substitute for disulfide links).

**Panthenol is the exception worth flagging positively.** Marsh et al., *Int J Cosmet Sci* 2026,
"Strengthening benefits of panthenol for hair: mechanistic evidence from advanced spectroscopic
techniques" (<https://onlinelibrary.wiley.com/doi/10.1111/ics.70024>;
<https://pubmed.ncbi.nlm.nih.gov/40905518/>) reports imaging evidence of penetration into cortical
protein regions, NMR evidence of a shared proton between panthenol N–H and protein aromatic side
chains, and higher break stress and elastic modulus versus control. This is a genuine recent
upgrade in the panthenol evidence base. **Caveats: single research group, industry-affiliated,
model-system mechanics, and it is not a leave-in finished-product result.** It justifies moving
panthenol from "meaningless" to "low-confidence mechanistic support for fibre mechanics" — not to a
repair claim, and not to heat protection.

### H.2 Bond chemistry: chemically sound, independently thin

The dimaleate of Bis-Aminopropyl Diglycol Dimaleate is a Michael acceptor that can react with
thiol (–SH) groups; the proposed route is a covalent bridge between two sulfurs. Independent
spectroscopic work is not confirmatory: a structural investigation of damaged hair keratin treated
with α,β-unsaturated Michael acceptors used as repairing agents found **none of the investigated
treatments increased disulfide (S–S) content in the hair cortex**
(*Int J Biol Macromol*, 2020,
<https://www.sciencedirect.com/science/article/abs/pii/S0141813020351321>). Most supportive
published work is manufacturer-funded (cf. Malinauskyte et al., *Biopolymers*, 2020).

**Product consequence:** a named bond chemistry opens a *review flag*, exactly as the conditioner
standard's R7 does. It never sets a repair level from formula alone. Additionally, most bond
chemistries were developed for high-concentration, short-contact, often in-salon conditions; a
leave-in at consumer dose is a **different exposure regime** and inherits none of that evidence.
"K18" / "Plex" / "Bond" naming is E0.

---

## Block I — Persistence, wash-out, accumulation

**What is reasonably predictive (E2, mechanism-level):**

- **Substantivity mechanism**: permanent cationic charge (silicone quats, high-charge-density
  polyquaterniums, cationised proteins) > pH-dependent cationic (amodimethicone, amidoamines) >
  neutral non-volatiles (dimethicone, esters) > water-soluble humectants (leave with the next wash,
  or before).
- **Removal mechanism**: water-soluble and PEG-modified silicones (e.g. PEG-x Dimethicone) leave
  easily; unmodified dimethicone requires surfactant emulsification; amino-functional and quaternised
  silicones are engineered to resist it.
- **Film cohesion**: a crosslinked or high-MW fixative film resists both water and mild surfactant
  more than a discontinuous emollient deposit.
- **Volatiles contribute nothing to persistence.**

**What is not predictive:** everything quantitative. Number of applications to visible buildup,
whether a given user's shampoo clears it, whether "clarification" is needed and how often. These
depend on dose, frequency, cleanser strength, water hardness and hair porosity — none of which is
in the INCI list, and two of which (water hardness, cleanser) are outside the product entirely.

**Evidence status: weak.** No retrievable finished-product study measures leave-in accumulation over
realistic use cycles. PERS and WASH are the two dimensions where I would most strongly resist a
numeric score.

---

## Block J — Finished-product test methods (basis for E0–E5)

| Endpoint | Established method | Notes / limits |
|---|---|---|
| **Wet & dry combing** | Instrumented combing (Instron / Dia-Stron / Stable Micro Systems); Average Combing Load (ACL), peak load, and work = area under the force curve; % reduction vs SLS-washed baseline tresses | The industry workhorse. Caveat worth encoding: a 2018 study measuring actual consumer combing frequency and per-hair combing forces found instrumental protocols do not straightforwardly map onto real grooming (<https://pubmed.ncbi.nlm.nih.gov/30076777/>) |
| **Friction / lubrication** | Fibre-on-fibre or probe tribology, with declared orientation, load, speed, RH | Directional; must state root-to-tip vs tip-to-root |
| **Softness** | Blinded trained sensory panel, optionally paired with friction/haptic proxies | Friction is a proxy, not softness |
| **Shine / gloss** | Multi-angle goniophotometry; Reich–Robbins luster `L = S/D × Θ½`; image-analysis and polarisation-imaging luster formulas (Lefaudeux et al., *IJCS* 2010) | Gloss values depend on incident-light direction and polarisation as well as on the hair — cross-lab comparison is unsafe |
| **Frizz** | Tress imaging (photographic or 2D laser) + image analysis of projected area / jaggedness, after equilibration in a controlled humidity chamber | Must state RH, temperature and equilibration time or the number is meaningless |
| **Humidity / water uptake** | Dynamic vapour sorption, weight gain 0 % → 90 % RH | Good mechanistic endpoint for "reduces moisture uptake" claims |
| **Curl retention / style hold** | High-humidity curl retention (HHCR) at ~26 °C / 90 % RH over 24 h; dynamic variant (DHCR) under rapid RH change | ~70 % retention is the conventional "good" bar |
| **Thermal protection** | DSC keratin denaturation (sensitive, binary); automated repeated grooming breakage count after ironing (consumer-relevant, less sensitive); tryptophan fluorescence loss | No consensus single method; see Block G |
| **Breakage** | Repeated-grooming fragment counts vs a defined comparator | Comparator choice dominates the result |
| **Volume / body** | Tress projected width / bundle compression + blinded assessment | — |

**Regulatory frame for what the app may repeat.** Commission Regulation (EU) No 655/2013 sets six
common criteria for cosmetic claims — legal compliance, truthfulness, **evidential support**,
honesty, fairness, informed decision-making — with the 2017 Commission technical document giving
best-practice guidance on evidential support and on "free from" and "hypoallergenic" claims
(<https://eur-lex.europa.eu/eli/reg/2013/655/oj/eng>;
<https://ec.europa.eu/docsroom/documents/24847/attachments/1/translations/en/renditions/native>).
Practical read for Chaarlie: a brand's claim being legal in the EU means a dossier exists somewhere;
it does **not** mean an instrumental finished-product test exists, and it never converts an E0 claim
into E3 evidence.

**Proposed E-level mapping for leave-on** (aligning with the conditioner standard's scale):

- E0 — claim, product name, marketing copy, "protects up to 230 °C".
- E1 — verified INCI observation (present/absent, literal rank, declared directions/dose form).
- E2 — architecture/mechanism inference from the complete formula **for leave-on exposure**.
  Rinse-out, shampoo, pre-wash-oil or in-salon evidence enters only here, as mechanism.
- E3 — the exact product tested instrumentally, **applied as a leave-on at a stated dose**, protocol
  declared.
- E4 — controlled human-use or blinded trained-sensory on the exact product.
- E5 — replicated / consensus finished-product evidence.

**A leave-on-specific E3 requirement that the rinse-out standard does not need:** the record must
state dose (g product / g hair), whether hair was damp or dry at application, drying method, and the
ambient RH — because in leave-on use all four change the result.

---

## K. Verdict on the 20 candidate dimensions

Legend: **KEEP** = keep as a scored direct property · **MERGE** = fold into another dimension ·
**DEMOTE** = keep the information but as a flag/derived value, not a score ·
**CEILING** = my view on the handover's formula-only confidence ceiling.

| Code | Verdict | Ceiling verdict | Justification |
|---|---|---|---|
| **FORM** | **KEEP** | Handover says High — **correct** | The five architectures (solution, emulsion, microemulsion, two-phase, anhydrous) are genuinely INCI-separable via the LGN pair, emulsifier presence, and solubiliser pattern, and the boundary rule needs FORM to route serums out of category. The one hard constraint: FORM is an architecture label and a **low**-confidence proxy for weight, because residue load ≈ dose × non-volatile fraction and INCI gives only an ordinal read on the second term. Encode "spray ⇏ light" as a gate, not a note. |
| **COND** | **KEEP** | Moderately high — **correct, arguably conservative** | Removing the rinse removes the least predictable variable in rinse-out conditioning (deposition efficiency): in a leave-on, essentially the whole applied dose stays. Conditioning architecture (cationic surfactant/polymer + lubricant load) is therefore *more* formula-readable here than in the rinse-out standard, not less. It stays capped at E2 because concentration is invisible and product form modulates delivery. |
| **WET** | **MERGE** (with DRY) | Moderate — but as a *shared* property | Wet slip and dry combability in a leave-on are produced by one deposit through one mechanism (M1 lubrication). Scoring them as two independent 0–4 dimensions is precisely the anti-double-counting violation the playbook warns about. Recommend a single `slip_combability_potential` carrying a bias qualifier (`wet_biased` / `both` / `dry_biased`), where `wet_biased` needs a volatile/water-dominant architecture and `dry_biased` needs a persistent film. Keep the separate endpoints in the research trace for E3 evidence, where wet-combing data genuinely does not prove dry combing. |
| **DRY** | **MERGE** (into the above) | — | Same architecture, same mechanism. See WET. |
| **SFR** | **KEEP, but narrowed** | Moderate — correct **once narrowed** | "Smoothing/frizz control" bundles two things with very different evidence. Surface alignment/lubrication smoothing is formula-readable at moderate confidence. Humidity-driven frizz control is not readable at all and belongs entirely in HUM. Redefine SFR as *ambient-condition surface smoothing and alignment potential* and strip the word "frizz" from its definition, or the dimension will silently carry an unsupported humidity claim. |
| **SHN** | **DEMOTE-TO-FLAG** | Moderate — **too high** | From formula, shine is almost entirely the optical consequence of the same alignment/deposition mechanism that drives SFR (mechanism M3 in the conditioner standard); scoring it separately double-counts. Worse, measured gloss depends on hair colour, baseline condition, and even incident-light direction and polarisation — a large share of the outcome is a *user* variable, not a product variable. Keep it as a qualifier on the smoothing route, and allow an independent value only with a distinct gloss route or exact-product goniophotometry. |
| **WT** | **KEEP — highest priority** | Moderate — defensible, arguably **could be raised** to moderately-high when FORM and non-volatile architecture are both resolved | Weight/residue is the binding constraint in almost every user job in the handover's §6 table, and it is more formula-tractable in leave-on than rinse-out because deposition efficiency is not a hidden variable. The residual uncertainty is dose, not composition. I would treat WT as the anchor dimension of the whole category and resist any rule that lets FORM set it. |
| **PERS** | **KEEP (merged with WASH)** | Moderate — **too high; lower to low–moderate** | Mechanism *ordering* is solid at E2 (permanent cationic > pH-dependent cationic > neutral non-volatile > water-soluble; volatiles contribute nothing). Anything resembling a duration ("lasts 2 days", "survives 3 washes") is not supported. Restrict values to an ordinal mechanism class, never a time or wash count. |
| **WASH** | **MERGE into PERS** | Low–moderate — **correct, and the merge is the point** | Wash resistance and buildup are the same mechanism read from opposite ends. A standard that scores PERS high and WASH-risk low on the same amino-silicone or silicone-quat evidence is double-counting in the wrong direction. Recommend one `persistence_removal` axis plus a separate **buildup caution flag** that is explicitly non-quantitative. No retrievable finished-product study measures leave-in accumulation over realistic use cycles; the confident numbers in circulation are untraceable (see the caution box in C.4). |
| **HOLD** | **KEEP, but as a coarse state, not a graded score** | Moderate — correct for a coarse state, **too high for a 0–4 grade** | Fixative polymer families and their humidity behaviour are well characterised (PVP hygroscopic, VP/VA more resistant, crosslinked polyurethane/acrylate hybrids for flexible hold). What is INCI-visible is *presence of a fixative-class route with or without conditioning architecture behind it* — which is exactly what the category boundary needs, since a fixative route with thin conditioning means the product should route to styling. Hold *level* is not readable (polymer level and plasticiser load are invisible). Values: `none` / `incidental_film` / `meaningful_hold_route`. Also enforce the conditioner standard's R5-style rule: a gum or acrylate plausibly serving bottle rheology is not a hold route. |
| **CURL** | **DEMOTE-TO-DERIVED** | Moderate — **too high; low from formula alone** | Curl definition is a composite of hold route + conditioning load + weight balance, and a large part of the outcome is the user's curl pattern and application technique (scrunching, plopping, diffusing), which no formula encodes. There is no formula→definition mapping in the literature. Derive it as a *focus* from HOLD + COND + WT, or as a positioning-corroborated flag — do not give it an independent score that implies the formula determines definition. |
| **HEAT** | **KEEP — and tighten beyond the handover** | Low formula-only — **correct, and should be made stricter** | Only specific named polymers have published protection data (Zhou et al. 2011: VP/Acrylates/Lauryl Methacrylate Copolymer, Polyquaternium-55, PVM/MA + Polyquaternium-28; McMullen & Jachowicz 1998: PVP/DMAPA Acrylates Copolymer, Quaternium-70, hydrolyzed wheat protein, at ~10–20 % damage reduction). Generic silicone, generic protein, panthenol and oils must reach **`claim_only` only**, never `formula_plausible`. `formula_plausible` requires a member of a closed evidenced list. The existing DB `heat_protection_max_c` (221–232 °C on ~8 SKUs) is a use-condition parameter and must not be promoted into this field. |
| **HUM** | **KEEP as a 4-state flag, not a score** | Low formula-only — **correct** | Humidity response is measured (HHCR/DHCR, DVS, humidity-chamber frizz imaging), not inferred. Mirror HEAT's evidence states. `formula_plausible` is reachable only via a hydrophobic film-forming route with a plausible water-uptake-reduction mechanism — and **humectant presence is a counter-signal, not support**, because the best-supported anti-frizz mechanism is reducing water uptake while a humectant's function is to increase water association. HUM also absorbs the humidity half of SFR. |
| **R1** | **MERGE into COND** | Moderate — fine for the merged property | "Repair lubrication" is conditioning-by-lubrication. Friction reduction and grooming-breakage prevention are real and measurable, but they are the *same* M1 mechanism that sets COND and slip; a separate dimension manufactures a third independent-looking score from one observation. Keep "reduces grooming breakage" as an **explanation frame** derived from COND, and reserve the repair vocabulary for R2/R3. |
| **R2** | **KEEP, tightened** | Moderate — **slightly too high; low–moderate** | A substantive surface film from cationised proteins, peptides or silane derivatives is a real, if modest, mechanism, but the evidence base is supplier-dominated (molecular-weight and substantivity figures come from datasheets, not independent measurement). Require an identifiable substantive route (cationised protein, silane derivative, silicone quat, high-charge polymer) in a plausible film context; exclude generic gums, starches and rheology polymers, exactly as conditioner R5 does. Panthenol is a *fibre-mechanics* signal (Marsh et al. 2026), not a surface-film signal and not a heat signal. |
| **R3** | **DEMOTE-TO-FLAG** | Low–moderate — **too high; flag only** | Two independent problems. (1) Independent spectroscopy found no increase in cortical disulfide content after treatment with α,β-unsaturated Michael-acceptor repairing agents (*Int J Biol Macromol* 2020), and most supportive work is manufacturer-funded. (2) Even granting the chemistry, bond systems were characterised at salon concentrations and contact times; a leave-in at consumer dose is a different exposure regime and inherits none of that evidence. Values: `claim_only` / `chemistry_candidate` / `product_tested` / `unknown`, opening a review flag — never a repair level. |
| **DOSE** | **KEEP — genuinely category-defining** | Moderate — **correct** | This is the property that most distinguishes leave-on from rinse-out and it has a clean mechanistic basis: without a rinse to normalise application, finish moves directly with dose, and the sensitivity scales with non-volatile fraction and low-spreading lipid load. Caveat for the standard author: it may be fully **derivable** from WT + FORM + emollient spreading class rather than separately assessed — decide store-vs-derive explicitly rather than letting it become a fourth restatement of the same observation. |
| **LAYER** | **DEMOTE-TO-FLAG** | Low formula-only — **correct** | Cationic/anionic complexation across layered products is plausible colloid chemistry and near-universal formulator belief, but I found **no** peer-reviewed measurement of pilling or flaking as a function of layering in consumer routines. Emit a caution string ("kann mit stark anionischen Stylern flocken") at most. Never compute a compatibility matrix or a numeric layering-risk score — that would be exactly the "unsupported precision" failure. |
| **EXPO** | **KEEP as flags** | Moderate for flags — **correct** | Leave-on raises this above its rinse-out relevance: all-day fibre, skin, neck and sometimes scalp contact, plus ethanol content and the 26 EU-labelled fragrance allergens. But flags must remain *exposure statements* (`fragrance_declared` / `aromatic_or_allergen_exposure` / `no_listed_fragrance_signal` / `unknown`), never tolerance or safety predictions. Reuse the conditioner G6 medical gate verbatim. Note the EU technical document to Reg. 655/2013 covers "free from" and "hypoallergenic" specifically: **"no listed fragrance signal" is not fragrance-free and not hypoallergenic.** |
| **ROLE** | **KEEP — and note the deliberate divergence from conditioner** | Moderately high — **correct, but it is an E1 directions field, not a formula inference** | The conditioner standard v1.6 *dropped* `usage_role` because "regular vs frequent" mostly reproduced directions wording. That reasoning does not transfer: for leave-ons, post-wash vs refresh vs heat-styling vs curl-styling vs ends-only changes dose, frequency, dry-vs-damp application and therefore accumulation. It earns a high ceiling precisely because it is read from the product's own directions (E1), not inferred from INCI. The standard should say this explicitly so the divergence reads as a decision, not an oversight. |

**Net shape:** 20 candidate dimensions → roughly **13 retained** (FORM, COND, SLIP[=WET+DRY],
SFR-narrowed, WT, PERS[=PERS+WASH], HOLD, HEAT, HUM, R2, DOSE, EXPO, ROLE), with SHN, CURL, R3 and
LAYER demoted to flags/derived values and R1 folded into COND. That is closer to the handover's own
warning — *"Do not aim for a giant ontology on the first pass"* — than the 20-item candidate list is.

---

## L. False signals found beyond the handover's §8 list

The handover already lists eleven. These are additional, and each one is a mistake a competent
reader could plausibly make from the current evidence landscape.

1. **"Amodimethicone deposits selectively on damaged sites, so it cannot build up."** This is a
   rinse-off argument, and it over-reads the deposition data even there: streaming-potential work
   shows deposition continues *after* surface-charge reversal, i.e. it does not self-limit. In a
   leave-on there is no rinse to remove the non-selective fraction.
2. **Scoring persistence high and buildup risk low from the same wash-resistance evidence.**
   Wash resistance and accumulation are one property viewed from two ends.
3. **Reading `heat_protection_max_c` (e.g. "bis 230 °C") as a protection *strength*.** It is a
   use-condition statement. Published protection effect sizes are modest (10–20 % damage reduction
   in the classic study; ~50 % is the commonly cited ceiling) and are not expressed in °C.
4. **"Humectants control frizz."** Not merely climate-dependent — mechanistically the wrong
   direction. The best-supported anti-frizz route is *reducing* water uptake. Humectants are a
   softness/plasticiser route and, for a humidity-resistance claim, a counter-signal.
5. **Treating the ~60 °F / 15 °C dew-point humectant threshold as science.** Ubiquitous in curly-hair
   education, absent from the peer-reviewed literature. Do not encode the number.
6. **"Clear product = light product."** Microemulsions are transparent by droplet size, not by low
   oil load. A clear silicone microemulsion spray can out-deposit an opaque milk.
7. **"No emulsifier / no fatty alcohol = no meaningful lipid load."** Two-phase sprays carry an oil
   or silicone phase with zero emulsifier by design.
8. **"Coconut oil penetrates, therefore botanical oils repair."** Rele & Mohile's own comparators
   (mineral, sunflower) failed; the result is specific to coconut oil, and the protocol was a
   pre-/post-wash oil treatment, not a leave-in at consumer dose.
9. **"Silicone-free plus a cationic polymer = low buildup."** High-charge-density polyquaterniums
   are among the most substantive materials in the category.
10. **Treating "Cyclopentasiloxane present" as a durable classification rule.** Under Regulation
    (EU) 2024/1328 it is a decaying signal in EU leave-ons (0.1 % limit from 6 June 2027). Key rules
    on *function* ("volatile carrier present") with the INCI family enumerated.
11. **Quoting an instrumental combing improvement as a consumer-perceptible benefit.** A 2018 study
    of actual consumer combing frequency and per-hair combing forces indicates the lab protocol does
    not map cleanly onto real grooming.
12. **Cross-lab comparison of gloss numbers.** Goniophotometric luster depends on incident-light
    direction and polarisation as well as on the hair — two labs' "shine" figures are not comparable.
13. **"Panthenol strengthens hair, therefore it protects from heat."** The 2026 mechanistic work is
    about fibre mechanics and protein interaction, not thermal protection. Expect this conflation.
14. **Bottle rheology read as hair performance.** Carbomer, Xanthan Gum, Hydroxyethylcellulose,
    Acrylates/C10-30 Alkyl Acrylate Crosspolymer. (Restated from the conditioner standard because a
    thick leave-in cream tempts the inference far more than a rinse-out one.)
15. **A leave-in "plex/bond" product inheriting salon bond evidence.** Different concentration,
    contact time, and often professional application — an exposure-regime mismatch on the same
    footing as the rinse-out/leave-on mismatch the handover already forbids.
16. **Inferring pH, "pH-balanced", or acid-sealing behaviour from an INCI list.** Not readable at all;
    already covered by the conditioner standard's §3 prohibition and worth restating.

---

## M. Open questions where the evidence is genuinely thin

Stated plainly. None of these should be closed by inference for v1.0.

1. **Consumer dose per form.** No published, market-representative figures for grams-per-use of
   leave-in sprays, milks or creams. Only laboratory protocol conventions (~0.2 g/g for leave-on,
   ~0.1 g/g rinse-off) and patent ranges. This propagates into WT, DOSE, PERS and buildup — every
   one of them inherits an unmeasured term.
2. **Leave-in accumulation over realistic use cycles.** No retrievable finished-product study. The
   confident percentages circulating online are untraceable to primary sources. Buildup should stay
   a qualitative caution.
3. **Transfer** (to skin, collar, pillow). Named as a real user complaint in the handover; no
   published instrumental method surfaced.
4. **Layering/pilling.** No measurement of pilling or flaking as a function of product layering.
5. **Whether wet and dry slip separate meaningfully from formula in leave-on.** I have argued they
   share one mechanism; a targeted look at whether volatile-dominant sprays genuinely deliver wet
   slip without dry slip would settle it and would de-risk the WET/DRY merge.
6. **Curl definition from formula.** No formula→definition mapping exists; technique is a large
   uncontrolled term.
7. **Humidity response from formula.** No mapping. Only measured (HHCR/DHCR, DVS, chamber imaging).
8. **Whether any German-market leave-in actually holds E3+ heat evidence.** Determining this is a
   per-product exercise and is out of scope here, but the answer decides whether `product_tested`
   is a live state or a permanently empty one.
9. **Two-phase dose variability.** Shake quality changes the delivered oil:water ratio per
   actuation. Unmeasured, and it makes two-phase products the least dose-predictable form.
10. **What replaces D5/D6 in EU leave-ons after June 2027**, and whether the substitutes (linear
    volatile siloxanes, isododecane) change dry-down, weight or persistence enough to invalidate
    v1.0 anchors. Unknown today; set a re-review trigger rather than guessing.
11. **Fine-hair residue thresholds.** There is no evidence establishing a residue load at which fine
    hair reads as limp. Any threshold the standard sets is a product judgment call and should be
    labelled as one, not as a derived scientific constant.
12. **Sensitive-scalp tolerance from INCI.** Not derivable. EXPO flags describe exposure; they do not
    predict tolerance.

---

## N. What this changes versus the rinse-out conditioner standard

The conditioner standard (`docs/research/conditioner-inci/v1.0/`) is a good scaffold for identity,
evidence levels, the property-evidence object, gates G0–G7 and the anti-double-counting discipline.
These transfer essentially unchanged. What must **not** transfer:

1. **`rinse_behavior` disappears.** Its leave-on replacement is the merged persistence/removal axis,
   and unlike `rinse_behavior` (E0 from INCI, research-trace only) the mechanism *ordering* is
   E2-inferable — but nothing quantitative is.
2. **`care_direction` (protein / moisture / balanced) should not be reused.** It is a
   conditioner-specific comparison vocabulary bound to a production adapter. The discriminating axes
   in leave-on are weight, persistence and hold — not protein-vs-moisture. Reuse pressure here will
   be high; the standard should refuse it explicitly rather than silently.
3. **`usage_role` comes back.** Conditioner deliberately dropped it as non-discriminating. In
   leave-on it is load-bearing and is read from directions at E1.
4. **Deposition efficiency stops being a hidden variable**, which *raises* what COND and WT can
   support, while **dose becomes the new hidden variable**, which lowers what PERS and buildup can
   support. Net: the uncertainty moves, it does not shrink.
5. **New dimensions with no rinse-out counterpart:** HOLD (and with it the styling boundary rule),
   HEAT, HUM, DOSE, LAYER, and a far more consequential FORM.
6. **Anti-double-counting gets harder, not easier.** In rinse-out, M1 feeds conditioning, slip and
   weight. In leave-on it feeds conditioning, slip, smoothing, shine, weight **and** persistence.
   The merges recommended in §K (WET+DRY, PERS+WASH, R1→COND, SHN→flag) exist mainly to keep G3
   enforceable.
7. **The evidence firewall needs one new clause:** rinse-out, shampoo, pre-wash-oil and in-salon
   evidence may enter a leave-on record **only at E2, as mechanism**, never as product evidence —
   the same rule the handover applies to rinse-out data, extended to the pre-wash and salon regimes
   that dominate the oil and bond literature.
8. **E3 records need leave-on metadata** the rinse-out standard never required: dose (g/g),
   damp-vs-dry application, drying method, ambient RH.
9. **EXPO moves from a minor flag to a real field**, because contact is all-day rather than minutes.
10. **A regulatory re-review trigger is now mandatory:** Regulation (EU) 2024/1328, D4/D5/D6 in
    leave-on cosmetics, **6 June 2027**. Any anchor or calibration entry keyed on cyclosiloxane
    presence expires on that date.



---

## O. Source register

**Tier 1 — peer-reviewed / primary**

- Zhou, Y. et al. "The effect of various cosmetic pretreatments on protecting hair from thermal damage by hot flat ironing." *J Cosmet Sci* 2011;62(2):265–282. <https://pubmed.ncbi.nlm.nih.gov/21635854/>
- McMullen, R.; Jachowicz, J. "Thermal degradation of hair. I/II." *J Cosmet Sci* 1998;49(4):245–256.
- Rele, A. S.; Mohile, R. B. "Effect of mineral oil, sunflower oil, and coconut oil on prevention of hair damage." *J Cosmet Sci* 2003;54(2):175–192. <https://library.scconline.org/v054n02/99>
- Marsh, J. et al. "Strengthening benefits of panthenol for hair: mechanistic evidence from advanced spectroscopic techniques." *Int J Cosmet Sci* 2026. <https://onlinelibrary.wiley.com/doi/10.1111/ics.70024> · <https://pubmed.ncbi.nlm.nih.gov/40905518/>
- "Structural investigation on damaged hair keratin treated with α,β-unsaturated Michael acceptors used as repairing agents." *Int J Biol Macromol* 2020. <https://www.sciencedirect.com/science/article/abs/pii/S0141813020351321>
- Malinauskyte, E. et al. *Biopolymers* 2020 (bond-builder study; manufacturer-funded — noted as such).
- "Characterization of the deposition of silicone copolymers on keratin fibers by streaming potential measurements." *Colloids Surf A* 2013. <https://www.sciencedirect.com/science/article/abs/pii/S0927775713004111>
- Lim, Park & Kim. "Hair conditioning effect of amino silicone softeners in varied treatment conditions." *Fibers and Polymers* 2010;11:507–515.
- "Exploring formulation, manufacture and characterisation techniques of lamellar gel networks in hair conditioners: a review." *Adv Colloid Interface Sci* 2025. <https://www.sciencedirect.com/science/article/pii/S0001868625000302>
- "Impact of emollients on the spreading properties of cosmetic products: a combined sensory and instrumental characterization." *Colloids Surf B* 2012. <https://www.sciencedirect.com/science/article/abs/pii/S0927776512004237>
- Lefaudeux, N. et al. "New luster formula for the characterization of hair tresses using polarization imaging." *Int J Cosmet Sci* 2010. <https://onlinelibrary.wiley.com/doi/10.1111/j.1468-2494.2010.00534_7.x>
- "Measuring the frequency of consumer hair combing and magnitude of combing forces on individual hairs in a tress and the implications for product evaluation and claims substantiation." 2018. <https://pubmed.ncbi.nlm.nih.gov/30076777/>
- "On hair care physicochemistry: from structure and degradation to novel biobased conditioning agents." 2023 review. <https://pubmed.ncbi.nlm.nih.gov/36771909/>
- University of Manchester: "Dynamic humidity curl retention as a method for the evaluation of hair fixative components"; "The effects of humidity on hairstyles: analysis of the mechanical properties of styling polymers." <https://research.manchester.ac.uk/>
- Robbins, C. R. *Chemical and Physical Behavior of Human Hair*, 5th ed., Springer 2012 (textbook).

**Tier 2 — regulatory**

- Commission Regulation (EU) 2024/1328 (REACH Annex XVII entry 70; D4/D5/D6). ECHA topic page <https://echa.europa.eu/hot-topics/cyclosiloxanes>; industry summaries <https://biorius.com/cosmetic-news/d4-d5-d6-restrictions/>, <https://www.intertek.com/products-retail/insight-bulletins/2024/commission-adopts-eu-wide-restriction-on-cyclosiloxanes/>. **Leave-on cosmetics: 0.1 % w/w limit from 6 June 2027** (rinse-off from 6 June 2026).
- Commission Regulation (EU) No 655/2013, common criteria for cosmetic claims. <https://eur-lex.europa.eu/eli/reg/2013/655/oj/eng>
- European Commission, Technical document on cosmetic claims (2017). <https://ec.europa.eu/docsroom/documents/24847/attachments/1/translations/en/renditions/native>

**Tier 3 — professional / trade education (used for applied interpretation, labelled in-text)**

- *Cosmetics & Toiletries*: "Remediating Hair Damage Through Hair Care Formulation Architectures"; "Defining and Controlling Frizz"; "Frizz Factors Revealed"; "Quantifying Visual Aspects of Hair"; "Evaluating the Physiochemical Properties of Emollient Esters for Cosmetic Use"; "Polyurethane-14 AMP-Acrylates Copolymer: A Hair Fixative Technology with 'Memory'"; "Advances in Hair Styling"; "Evaluating Hair Conditioning with Instrumental Combing".
- TRI Princeton: "Hair Heat Protection Claim Support 101" <https://www.triprinceton.org/post/hair-heat-protection-claim-support-101>; frizz-control tress test.
- *Personal Care* / *Cosmetics Business* / UL Prospector articles on cationic conditioning polymers and polyquaternium substantivity.
- Gomes & Aguiar (Dow Corning), silicones as thermal protectants — **supplier conference poster, not peer-reviewed**.

**Explicitly rejected as evidence** (surfaced in search, not used for any claim): affiliate and
content-farm pages carrying untraceable buildup and silicone-removal percentages; curly-hair
community blogs asserting a dew-point humectant threshold; brand blogs on silicone removal;
supplier marketing figures for fixative stiffness loss at defined RH.
