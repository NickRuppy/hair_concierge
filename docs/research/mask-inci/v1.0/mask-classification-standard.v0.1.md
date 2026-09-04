# Mask Research and Classification Standard v0.1

Status: **draft v0.1 — pre-calibration, not locked**
Version: 0.1 (Phase 3 draft)
Scope: rinse-out intensive masks/Haarkuren (Maske, Kur, Intensivkur, Express-Kur, Bond-Kur, Gloss-/Laminier-Kur), Germany/EU market, per `00_category_charter.md`
Normative source: this Markdown file
Drafted: 2026-09-04

**Binding upstream inputs.** `00_category_charter.md` (boundary rulings F1–F4, exclusions, evidence boundary, coverage target) and `01_property-set-v0.md` (nine-field shape, rulings D1–D6, moisture-focus guard, `bond_route` rule, watch-list) are **ruled by Nick and binding**. This standard operationalizes them; it may not widen, narrow, or reinterpret them. Where this standard adds an anchor, threshold, or operational test that the ruled inputs did not fix, that addition is marked **[judgment call — review]** and listed again in §16.

**What this draft is not.** It is not locked, not calibrated, and carries no repeatability claim. Its anchors are provisional under Nick's "first set, then adjust" caveat (`01_property-set-v0.md` status line). It approves no product, activates no catalog field, writes nothing to Supabase, and changes no recommendation, matcher, intake rule, or user-facing copy (charter stop condition).

---

## 1. Purpose

This standard converts one exact market mask — exact product, exact pack/formula version — into an auditable research record. It separates:

1. formula observations (what the INCI literally says);
2. plausible direct mask routes and direct properties (what might follow);
3. finished-product evidence (what was actually measured on this product);
4. profile-specific fit (which hair groups this product is a broad prior for).

It does not turn ingredient names into universal good/bad labels, does not diagnose a user's protein, moisture, or damage state, and does not replace a formulation test, consumer study, clinical evaluation, or catalog decision.

**Category-relative reading.** Every value in this standard is anchored *within the mask shelf*, not across all rinse-out products. Masks sit higher on the same lamellar-gel-network continuum as conditioners (evidence §1). A formula that would read `high` conditioning as a conditioner may read `moderate` as a mask. Reviewers must hold the mask reference distribution in mind; the `moderate` bucket is expected to hold the majority of the shelf, and that is an accepted outcome (evidence §8), not a failure of the scale.

**Architecture is not the category.** A blind INCI read cannot reliably tell a mask from a conditioner (evidence §1). The category is decided at G0 from product metadata and authoritative directions, never from the ingredient list. This engine is the conditioner architecture run with a shifted richness prior and a mask-specific route and focus layer.

---

## 2. Category and identity gates

### 2.1 G0 — charter boundary (binding, charter F1–F4 and exclusions)

Classification stops before formula analysis unless the product is **eligible** under the charter.

**Eligible** — the product's authoritative directions describe a rinse-out intensive treatment applied after cleansing to lengths and ends, with a product-stated contact time, then rinsed out. The research unit is the exact market product, pack/formula version, never a brand line or marketing name.

Explicitly in scope:

| Charter ruling | Included | Operational note |
|---|---|---|
| **F1** | Multi-use products (3in1/2in1) — **mode-scoped** | Eligible when authoritative directions state a distinct rinse-out mask mode with dwell. Only that mode is classified. |
| **F2** | Express Kuren at **every** stated dwell duration (7 sec, 30 sec, 1 min, …) | Marketed form and the `intensive_conditioning_mask` role decide. Dwell is protocol metadata under P5 and is **never** a boundary test. |
| **F3** | Bond-claim drugstore masks (Plex/Bond positioning) | The bond route is claim-gated (R7). `repair_support_level: high` requires named chemistry visible in the reviewed formula. |
| **F4** | Gloss/lamination rinse-out treatments | Treated as shine-focused masks. Lamination/acid-gloss claims stay claim-gated and conservative. There is **no** lamination property (§5, R6a; evidence §7). |

**Excluded** (charter; each maps to `excluded_product_form` and produces **no** profile):

- leave-on-only "masks" and overnight treatments (leave-in / bondbuilder territory);
- pre-shampoo-only treatments;
- products in the `bondbuilder` catalog category with specialist protocols (Olaplex-style);
- color-depositing masks, scalp/medicated treatments, salon back-bar chemistry;
- ampoule/shot formats **unless** the directions are post-shampoo rinse-out with dwell;
- a multi-use product whose only rinse-out mode is a short **conditioner** mode (e.g. Guhl Panthenol + Reparatur 2in1 Kur & Spülung) — Conditioner-engine territory.

**No product ever receives two engine profiles.** Excluded rows stay visible as boundary evidence and stress cases; they are never forced through the mask ontology.

### 2.2 G0 multi-use variant (charter F1) — eligibility is read from directions, not from the jar

For a product with several stated modes, the engine classifies **use, not jar**.

1. Locate the **authoritative directions** for the exact pack (source hierarchy §2.4). Marketing names ("3 in 1", "Kur & Spülung") never decide.
2. Test each stated mode against §2.1. A mode qualifies as a mask mode when the directions place it **after cleansing**, on **lengths and ends**, with a **stated contact time**, followed by a **rinse**.
3. If **exactly one** mode qualifies → classify only that mode. Record `multi_use: true` and name the uncovered modes.
4. If **no** mode qualifies → `excluded_product_form`, with the reason recorded (e.g. conditioner-mode-only, leave-on-only).
5. If the directions are ambiguous about which mode carries the dwell, or the modes cannot be separated → do **not** guess. Set identity state `insufficient_information`, fire the `multi_use_directions_ambiguity` review trigger (§14), and stop.

**`multi_use` flag semantics** (research envelope, trace level):

```text
multi_use: true | false
multi_use_covered_mode: "post_shampoo_rinse_out_mask"     # always this, when true
multi_use_uncovered_modes: ["leave_in", "conditioner", ...] # verbatim from the directions
multi_use_directions_source_id: <source id>
```

`multi_use: true` means: *this profile describes only the rinse-out mask mode of a product that also has other stated modes.* It is a scope declaration, never a quality signal, never a penalty, and never an input to any comparison field. Cross-category multi-row architecture (one 3in1 spawning sibling rows per category) is **parked out of scope** by Nick (charter). Mode-scoped classification is forward-compatible with it.

Live boundary cases already identified (charter, 2026-09-04): Garnier/Fructis Hair Food line, Balea 3 in 1 Intensivmaske, Isana 3in1, Balea Aqua Hyaluron 3 in 1 → eligible, mode-scoped. Pantene Pro-V Serum Shot → eligible **only** if directions show post-shampoo rinse-out with dwell. Bali Curls Bonding Repair Overnight Elixir → excluded.

### 2.3 Identity gates

Classification stops before formula analysis unless all of the following are known:

- exact catalog product UUID;
- exact brand and product name;
- Germany/EU market;
- pack size or an explicit unknown;
- one reliable identifier or a documented identity-research gap;
- dated exact-market formula source;
- raw INCI;
- product-form status (§2.1/§2.2 resolved);
- source/formula conflicts;
- **the authoritative directions text** carrying the mode, placement, contact time and rinse (mask-specific — §2.2 and P5 both depend on it).

Allowed identity states (inherited from Conditioner §2):

`verified` · `verified_with_minor_source_difference` · `provisional_formula_conflict` · `provisional_identity_conflict` · `insufficient_information` · `excluded_product_form`

A GTIN may survive reformulation. Formula identity and product identity are related but separate. A conflict that changes only one property makes that property `unknown`; it blocks the whole analysis only when the dominant architecture cannot be resolved.

### 2.4 Input authority hierarchy

1. exact pack/label for the exact product identifier;
2. current exact local-market (DE) manufacturer source;
3. preferred exact-product retailer source (exact GTIN);
4. reputable fallback/corroboration.

Never merge lists across product identifiers, sizes, markets, or versions. Retain divergent retailer transcriptions as provenance rather than averaging formulas.

### 2.5 Protocol boundary (owned by TPL-MASK / P5 — not by this engine)

This engine never produces protocol values, and protocol values never produce comparison properties. TPL-MASK owns:

- placement **Längen und Spitzen, Ansatz aussparen**;
- canonical conditioner relationship **`replaces_conditioner`** — on a mask day the mask takes the conditioner slot. `conditioner_after` requires an explicit sourced sequence;
- **contact time is a required per-product slot**, taken from the packaging **with a source**. It is **never** derived from INCI. A stamp without a sourced contact time is invalid and must not be published.

This standard records the sourced contact time as protocol metadata for traceability only. It carries **zero classification credit** (§7.2).

---

## 3. Evidence scale

Inherited from Conditioner §3 verbatim in substance.

| Level | Meaning | Permitted use |
|---|---|---|
| E0 | Product name, marketing claim, unsupported secondary statement, or no usable evidence | Record claim only; no direct property |
| E1 | Verified exact-formula observation: ingredient present/absent, literal rank, declared exposure | Formula fact only |
| E2 | Plausible architecture or mechanism inference from the complete formula and product form | Candidate route / direct-property **potential**, always provisional |
| E3 | Exact finished product tested instrumentally under a stated protocol | Endpoint-specific product property |
| E4 | Controlled human-use or blinded trained-sensory evidence for the exact product | Endpoint-specific product/user-perception evidence |
| E5 | Strong replicated or consensus finished-product evidence relevant to use | Strong endpoint-specific conclusion |

**INCI-only classification never exceeds E2.** Every mask profile produced by this standard in v0.1 is an E2-ceiling document. Reviewer agreement measures repeatability of the rules, not truth.

**EU Article 19 rank semantics.** Ingredients above 1% are listed in descending order; ingredients below 1% may appear in any order. **The 1% boundary is not visible.** Never infer exact percentages, ratios, pH, molecular weight, droplet size, deposition amount, viscosity, manufacturing process, or active dose from a consumer list. Rank is used **qualitatively** (structural position), never as a concentration claim.

### 3.1 The fragrance/preservative tail marker rule

Because Art. 19 hides the 1% boundary, this standard uses a conservative, reproducible proxy for "structurally material" versus "trace".

**Definition.** `tail_index` is the one-based position of the **earliest** ingredient belonging to any tail class:

- fragrance: `Parfum`, `Fragrance`, `Aroma`;
- declared fragrance allergens: `Limonene`, `Linalool`, `Citronellol`, `Geraniol`, `Citral`, `Coumarin`, `Hexyl Cinnamal`, `Benzyl Salicylate`, `Benzyl Benzoate`, `Alpha-Isomethyl Ionone`, `Butylphenyl Methylpropional`, `Eugenol`, `Amyl Cinnamal`, `Hydroxycitronellal`, `Isoeugenol`, `Farnesol` …;
- conventional preservatives: `Phenoxyethanol`, `Sodium Benzoate`, `Potassium Sorbate`, `Benzyl Alcohol`, `Chlorphenesin`, `Methylisothiazolinone`, `Methylchloroisothiazolinone`, `DMDM Hydantoin`, `Sodium Hydroxymethylglycinate`, `Iodopropynyl Butylcarbamate`, `Dehydroacetic Acid`;
- trace chelators: `Disodium EDTA`, `Tetrasodium EDTA`, `Trisodium Ethylenediamine Disuccinate`, `Etidronic Acid`, `Phytic Acid`;
- colorants: any `CI 1xxxx` / `CI 7xxxx`.

**Above the tail** = strictly before `tail_index`. **In the tail** = at or after `tail_index`.

**Rules.**

- Ingredients in the tail contribute **nothing** to `conditioning_level`, `weight_potential`, `care_direction`, `repair_support_level`, the moisture-focus cluster, or `bond_route` (D1 and evidence §2: the sub-1% hero tail — hydrolyzed keratin, panthenol, ceramides after fragrance — is a false signal).
- Tail ingredients may still be recorded as E1 formula facts and as claim context.
- `Citric Acid` is **never** used as a tail marker: it is a ubiquitous pH adjuster whose position varies (evidence §6).
- If **no** tail-class ingredient appears in the list, set `tail_marker: absent`, treat the whole list as above-tail, and cap every judgment field's confidence at `moderate` (an INCI with no fragrance and no preservative is more likely truncated than genuinely preservative-free). Fire the `tail_marker_anomaly` review trigger.
- If `tail_index` falls implausibly early — before any conditioning ingredient, or at rank ≤ 3 — this is a G5 source conflict. Set `tail_marker: unresolved`, cap affected fields at `moderate` confidence, and fire `tail_marker_anomaly`.

**[judgment call — review]** The tail-class enumeration, the "no tail marker → cap at moderate" rule, and the "rank ≤ 3 is implausible" threshold are operational additions. The ruled inputs fix only the principle ("above the fragrance/preservative tail"), not the list or the anomaly handling.

---

## 4. Evidence record

Every direct property carries (Conditioner §4 pattern):

- `value`
- `decision_type` — `deterministic` | `structured_judgment` | `claim_gated` | `not_inferable`
- `confidence` — `high` | `moderate` | `low` (§4.1)
- `evidence_level` — E0–E5
- `evidence_scope`
- `rationale` — potential wording, never performance wording
- `formula_observations[]` — what is literally present, with one-based rank
- `product_inferences[]` — what might follow
- `supporting_signals[]`
- `counter_signals[]`
- `derived_from[]`
- `profile_fact_ids[]`
- `source_ids[]`
- `shared_mechanism_ids[]`
- `review_status`

Mask-specific additions to every record:

- `tail_marker` — `{ ingredient, index }` | `absent` | `unresolved` (§3.1)
- `above_tail_segment` — the ordered ingredient slice used for structural signals
- `multi_use_scope` — §2.2 envelope, when `multi_use: true`
- `protocol_metadata_ref` — pointer to the sourced TPL-MASK/P5 contact time; **never** an input to any value

Formula observations state what is literally present. Product inferences state what might follow. **A derived fit without both `derived_from` and `profile_fact_ids` is invalid.**

Each profile also carries one concise `uncertain_fields` list and `assumption_notes`. These are reviewer aids, not a taxonomy Nick must adjudicate value by value.

### 4.1 Confidence meaning (category-wide)

- `high` — exact complete input, no material gap, converging independent signals, reasonable unknowns would not move the value;
- `moderate` — one value is best supported but realistic unknowns could move it to a **neighbouring** value;
- `low` — identity/formula conflict, incomplete evidence, or balanced interpretations prevent a dependable call.

Confidence measures classification robustness, not clinical accuracy. Never invent percentages. Low confidence is visible in the artifact, does not remove the product from the set, and does not block finalization — but it does fire a review trigger (§14).

---

## 5. Route dictionary

Routes are candidate architectures, not scores. Each route below restates the Conditioner rule and then adds an explicit **Mask delta**.

### R1 — Cationic / fatty-alcohol conditioning base

**Candidate evidence.** A verified long-chain cationic quat (`Behentrimonium Chloride`, `Cetrimonium Chloride`, `Behentrimonium Methosulfate`, `Distearyldimonium Chloride`, `Quaternium-87` …) or a protonatable amidoamine (`Stearamidopropyl Dimethylamine`, `Behenamidopropyl Dimethylamine`) plus a long-chain fatty alcohol (`Cetearyl Alcohol`, `Cetyl Alcohol`, `Stearyl Alcohol`, `Behenyl Alcohol`, `Myristyl Alcohol`) in a confirmed rinse-out product.

**Permitted E2 statement.** "Contains a conventional cationic conditioning-base pattern."

Do not infer actual lamellar phase, viscosity, deposited amount, combing force, sensory richness, rinseability, buildup, or user fit. An acid beside an amidoamine supports the candidate context but does not prove protonation or final pH.

> **Mask delta.** R1 is the **category baseline**, not a differentiator. Every eligible mask is expected to carry it. What is mask-diagnostic is the *breadth and position* of the base: masks typically run **multi-cationic stacks** (two or more distinct cationic species above the tail) and place a fatty alcohol at rank 2–3 (evidence §1, §2). R1 therefore feeds `conditioning_level` and `weight_potential` through structural-position signals S1/S2 (§9.1), and it **never** by itself sets `detangling`, `smoothing`, or `moisture` as a focus (§9.5 step 1). A mask being a mask is not evidence of anything.

### R2 — Silicone surface-film / lubrication route

**Candidate evidence.** Verified silicone ingredient(s) considered within the full deposition architecture (`Dimethicone`, `Amodimethicone`, `Dimethiconol`, `Bis-Aminopropyl Dimethicone`, `Cyclopentasiloxane`, `Behenoxy Dimethicone`, silicone quaterniums, and their emulsifier partners such as `Trideceth-12` / `Cetrimonium Chloride` pairs).

**Permitted E1/E2 statement.** "Contains a possible silicone surface-film/lubrication route."

Silicone presence does not prove heavy finish, buildup, fine-hair mismatch, superior shine, repair, persistence, or deposition. Silicone-free does not prove lightness or low residue.

> **Mask delta.** Silicone is **not** a weight driver in this category: fatty-alcohol and butter/triglyceride load is (evidence §8). R2 therefore contributes to `weight_potential` only via the occlusive-stack sub-signal (§9.2), never as "silicone present → heavier". R2 is, however, the principal carrier of the **shine/gloss emphasis architecture** (§9.5, F4): an alignment-oriented silicone/polymer route with a *low* lipid load is the formula shape behind gloss positioning. Nothing about a silicone route may be worded as sealing, cuticle closure, or lasting change.

### R3 — Cationic-polymer deposition / film route

**Candidate evidence.** Verified cationic polymer such as a `Polyquaternium-N`, `Guar Hydroxypropyltrimonium Chloride`, or `Hydroxypropyl Guar Hydroxypropyltrimonium Chloride`.

**Permitted E1/E2 statement.** "Contains a possible cationic-polymer deposition modifier."

Charge density, molecular weight, formula interactions, substrate, use frequency, and rinse determine behavior. Never map the family directly to buildup. R3 is a deposition modifier, **not** automatically a temporary repair-film result.

> **Mask delta.** Masks routinely carry a **broader secondary conditioning polymer set** than conditioners (evidence §1) — this breadth is category-typical and therefore *not* a differentiator on its own. Polymer count is explicitly **not** a `conditioning_level` signal (evidence §2 false-signal list: ingredient count). R3 contributes to the shine architecture (with R2) and to the high-slip architecture that feeds `texture_fit`.

### R4 — Lipid / butter / emollient relubrication route

**Candidate evidence.** Verified oil, butter, ester, hydrocarbon, ceramide, or related emollient in formula context.

**Permitted E1/E2 statement.** "Contains a possible emollient/relubrication route."

A hero oil in the uncertain tail is not a richness score. Fatty alcohols used in the base are **not** counted again as hero oils.

> **Mask delta.** This is where the mask/conditioner continuum is most visible: masks shift toward **more and heavier lipids** — plant butters (`Butyrospermum Parkii Butter`, `Theobroma Cacao Seed Butter`, `Mangifera Indica Seed Butter`), heavy triglycerides (`Cocos Nucifera Oil`, `Olea Europaea Fruit Oil`, `Argania Spinosa Kernel Oil`, `Hydrogenated Vegetable Oil`) and occlusive hydrocarbons (`Paraffinum Liquidum`, `Petrolatum`) — none of them mask-exclusive (evidence §1). R4 is split into two graded sub-signals for this category:
> - **R4a light/mid lipid** — esters, light plant oils, ceramides, squalane;
> - **R4b heavy lipid** — butters, heavy triglycerides, hydrogenated oils, occlusive hydrocarbons.
>
> Only **R4b above the tail** contributes to the `weight_potential: high` anchor (evidence §8); R4a and R4b both count toward the lipid-breadth signal S3 for `conditioning_level` (§9.1). A butter listed in the tail is a hero-tail false signal and contributes nothing.

### R5 — Temporary protein / film-support route

**Candidate evidence.** Hydrolyzed protein (`Hydrolyzed Keratin`, `Hydrolyzed Wheat Protein`, `Hydrolyzed Soy Protein`, `Hydrolyzed Silk`, `Hydrolyzed Collagen`, `Hydrolyzed Oat Protein`, `Hydrolyzed Rice Protein`), peptide (`Oligopeptide-N`, named peptide systems), keratin (`Keratin`, `Keratin Amino Acids`), quaternized protein derivative (`Hydroxypropyltrimonium Hydrolyzed Wheat Protein`), or a non-cationic fibre-substantive film former, with plausible delivery context.

**Permitted E1/E2 statement.** "Contains a possible temporary protein/film-support route."

Ingredient presence does not prove penetration, structural repair, strength, breakage reduction, or a "protein need". Upgrade requires exact-product evidence and a defined endpoint. R5 requires a plausible **fibre-substantive** film route in formula context; a generic gum, starch, or viscosity signal that may primarily control bottle rheology is not sufficient by itself.

> **Mask delta — free amino acids do NOT qualify.** Single free amino acids and simple amino-acid blends (`Arginine`, `Glycine`, `Serine`, `Glutamic Acid`, `Alanine`, `Cysteine`, `Amino Acids`, `Sodium PCA` as an amino-acid derivative) are **not** an R5 protein-film route. They are small molecules without a substantive film mechanism; several of them (`Arginine`, `Sodium PCA`) belong to the humectant/pH-context families instead and are handled under R9/R6. Counting them as protein would inflate `care_direction: protein`, `repair_support_level: medium`, and the `damage_fit` specialist route in exactly the category where "Repair"/"Reparatur" naming is most common. `Keratin Amino Acids` is a borderline token: treat it as **non-qualifying** for R5 unless a second, unambiguous hydrolyzed-protein or peptide species also appears above the tail. **[judgment call — review]** The `Keratin Amino Acids` handling and the explicit free-amino-acid exclusion list are operational additions; the ruled inputs fix only the direction ("free amino acids do not qualify").
>
> Second mask delta: because masks carry heavier payloads generally, a protein species in the tail is *more* likely, not less, to be a marketing hero. The tail rule (§3.1) applies without exception.

### R6 — Acid / buffer / chelator context

**Candidate evidence.** Verified acid, buffer, or chelator (`Citric Acid`, `Lactic Acid`, `Sodium Hydroxide`, `Sodium Citrate`, `Disodium EDTA`, `Sodium Phytate`).

**Permitted E1 statement:** presence. **E2 statement:** possible pH-control or metal/hard-water robustness context.

Do not infer final pH, cuticle sealing, color retention, metal removal, detox, repair, or bleaching safety.

> **Mask delta.** `Citric Acid` is a ubiquitous pH adjuster and is **never** bond evidence (evidence §6, and the `bond_route` rule in `01_property-set-v0.md`). It is also never a tail marker (§3.1).

#### R6a — Acid gloss / "lamination" context (charter F4)

**Candidate evidence.** `Glycolic Acid` (or another alpha-hydroxy acid) declared above the tail in a product positioned as Gloss, Glaze, Laminierung, or Lamination.

**Permitted E1/E2 statement.** "Contains an acid-gloss context ingredient consistent with the product's gloss positioning."

**Hard rules:**

- **There is no gloss/lamination route property and no `lamination` focus value.** Gloss identity is carried entirely by the `shine` focus, through the ordinary shine threshold plus claim corroboration (D2; evidence §7).
- "Lamination" is positioning, not distinct chemistry (evidence §7).
- Glycolic acid **temporarily plasticizes** the fibre (a measured decrease in Young's modulus). It does **not** seal, coat, close the cuticle, laminate, or produce lasting change. Banned wording in every rationale and every downstream copy: *versiegelt*, *seals*, *closes the cuticle*, *laminates*, *lasting*, *permanent*, *bonds the surface*.
- The optical mechanism behind gloss (surface smoothing raising specular reflection) is **not separable** from ordinary smoothing-film shine (evidence §7). Therefore R6a alone can never set `shine`; the shine threshold in §9.5 must be met independently.
- A gloss/lamination mask classifies its `care_direction` by the **care base it actually carries**, not by its acid claim (D6).

### R7 — Bond-claim review route (charter F3)

**Candidate evidence.** An exact product claim **plus** a named or explicitly described chemistry visible in the reviewed formula **plus**, for anything above candidate status, product-level substantiation.

**Permitted E1/E2 statement.** "Contains a named bond-chemistry candidate." Formula-only evidence remains E1/E2 and does **not** prove new bonds, internal repair, or strength. Routine-level evidence is never attributed to the mask.

> **Mask delta — deterministic `bond_route` enum.** In this category the bond claim is common enough that the route is made **deterministic**, by named INCI above the tail only (`01_property-set-v0.md`, trace-level additions):
>
> ```text
> bond_route ∈ { maleate, gluconamide, peptide, none }
> ```
>
> | Value | Qualifying evidence | Anchor example |
> |---|---|---|
> | `maleate` | A named maleate-ester bonding ingredient declared above the tail | `Bis-Aminopropyl Diglycol Dimaleate` (Olaplex-style chemistry) |
> | `gluconamide` | A named gluconamide/gluconolactone-family bonding ingredient declared above the tail, identified as the bonding technology | Henkel system; present in Gliss 4-in-1 Repair Bond mask (evidence §6) |
> | `peptide` | A named bond-positioned peptide system declared above the tail | K18-style oligopeptide systems — **largely absent** from German drugstore rinse-out masks (evidence §6) |
> | `none` | Everything else | — |
>
> **The reviewer must record the exact INCI token carrying the chemistry.** If the token cannot be named — the pack says "Bond Repair Complex", "Plex Technology", "Bonding Komplex" with no identifiable INCI species — then `bond_route = none` and the `bond_claim_review` trigger fires (§14). Branded naming never substitutes for a token.
>
> **Explicit non-qualifiers** (binding, `01_property-set-v0.md`): `Citric Acid`; **any hydrolyzed protein alone**; the words "Bond", "Plex", "Bonding", "Bond Repair" anywhere in the product name or claim; ceramides; free amino acids; panthenol; an unspecified proprietary "complex"; a bonding ingredient found only **in the tail**.
>
> **Standing caveat (evidence §6, open risk).** None of the three routes has strong independent product-level substantiation at drugstore concentrations; gluconamide bonding in particular has **zero independent literature**, and the two secondary-source maleate tensile figures remain unverified at one remove. "Bond" front-of-pack is frequently an ordinary rich mask. `bond_route ≠ none` therefore gates a *comparative formula-potential* value (`repair_support_level: high`), never an efficacy statement. Every rationale must say so.

### R8 — Fragrance / scalp exposure route

`Parfum`, `Fragrance`, `Aroma`, declared fragrance allergens, and clearly aromatic essential oils are exposure signals.

Allowed values: `fragrance_declared` · `aromatic_or_allergen_exposure` · `no_listed_fragrance_signal` · `unknown`.

"No listed signal" is not allergy-safe, hypoallergenic, or guaranteed fragrance-free. Labelling thresholds and incomplete/conflicting formulas prevent those claims. Discomfort, rash, dermatitis, infection, hair loss, and disease require abstention and professional evaluation (G6).

> **Mask delta.** The canonical mask placement is **Längen und Spitzen, Ansatz aussparen** (P5). Scalp-exposure reasoning is therefore *not* part of the ordinary mask profile: a directions-compliant mask is not a scalp product. If a source explicitly directs whole-head or root application ("im ganzen Haar verteilen"), that contradicts P5, is a protocol deviation, and fires the root/scalp review trigger — it does not silently change R8 or create a scalp property. R8 doubles as the tail-marker source (§3.1).

### R9 — Humectant cluster route *(new in Mask; grounds the `moisture` focus)*

**Candidate evidence.** Two or more distinct humectant-class ingredients declared **above the tail**:

`Glycerin` · `Propanediol` · `Butylene Glycol` · `Pentylene Glycol` · `Dipropylene Glycol` · `Panthenol` / `Panthenyl Ethyl Ether` · `Sodium Hyaluronate` / `Hyaluronic Acid` / `Hydrolyzed Hyaluronic Acid` / `Sodium Acetylated Hyaluronate` · `Sodium PCA` · `Betaine` · `Urea` · `Aloe Barbadensis Leaf Juice` / `Leaf Extract` · `Sorbitol` · `Trehalose` · `Mel` (honey) · `Sodium Lactate` · `Inositol` · `Saccharide Isomerate`

**Permitted E1/E2 statement.** "Contains a humectant-forward comparative direction." **Never** "hydrates", "proven hydration", "adds moisture to the hair", or any moisture-delivery claim (D5 wording rule).

**Rules.**

- R9 is a **cluster** route, not a hero-token route. One humectant — including glycerin, which is near-universal in this category — establishes nothing (D5 guard).
- Hydrolyzed proteins are **not** counted as humectants (they are R5). Fatty alcohols, esters, and oils are **not** humectants (they are R1/R4). This separation is what prevents "rich mask" from silently reading as "moisture mask" (§6, G3).
- A polyol that appears solely as the carrier/solvent of a botanical extract chain (e.g. `Butylene Glycol` immediately preceding a run of `… Extract` entries and appearing nowhere else) is still counted per D5's explicit inclusion of glycols, but the reviewer must record it in `counter_signals[]` and cap the moisture-focus confidence at `moderate`. **[judgment call — review]**
- R9 grounds the **`moisture` primary/secondary focus** (§9.5) and contributes to `care_direction` (§9.3), but the two use **different thresholds** — see §9.3.1.

> **Mask delta.** R9 has no counterpart in the Conditioner standard, because Conditioner v1.6 has no `moisture` focus. It exists here solely because Nick ruled `moisture` into the mask focus vocabulary (D5), and it is deliberately built as an *anti-hero-token* route: the ruled guard was tested on four real formulas (Balea Aqua Hyaluron 3in1 and Guhl 30 sek Feuchtigkeit clear it; Gliss Bonding and Pantene Bond correctly fail), and this route is the operationalization of exactly that test.

### No route exists for

- **dwell time** — protocol only, zero classification credit (evidence §3);
- **heat assist** — optional protocol modifier only, never a formula property or ranking input (evidence §4);
- **gloss/lamination as chemistry** — see R6a (evidence §7);
- **"protein overload"** — not an established condition; see §13 (evidence §5);
- **the mask/conditioner category itself** — metadata and directions decide at G0 (evidence §1).

---

## 6. Shared mechanisms and double counting

Mechanism IDs (M1–M4 inherited from Conditioner §6; M5 added for R9):

- `M1_DEPOSITION_SURFACE_LUBRICATION` — cationic base (R1), cationic polymer (R3), silicone (R2), lipids (R4).
- `M2_TEMPORARY_FILM_SUPPORT` — proteins, peptides, film formers (R5).
- `M3_OPTICAL_ALIGNMENT_FILM` — shine caused through alignment or surface film (R2/R3, and the optical consequence of M1).
- `M4_CLAIM_ONLY_PROPRIETARY` — claim without product-specific substantiation (branded bond/gloss complexes).
- `M5_HUMECTANT_WATER_BINDING` — humectant cluster (R9). **New in Mask.**

Several ingredients may raise confidence in **one** mechanism. They do not create several independent technologies. One mechanism cannot independently score conditioning, smoothing, shine, repair, moisture, and body without endpoint-specific evidence.

**Mask-specific anti-double-count rules (G3):**

1. A rich R1+R4 base is **one** M1 observation, however many fatty alcohols, cationics, oils, and butters it contains. It may raise `conditioning_level` and `weight_potential` — it may not additionally create `smoothing`, `detangling`, `shine`, and `moisture` as four focus candidates.
2. `shine` that is merely the optical consequence of the smoothing/deposition film is **M3 sharing M1** and does not earn its own focus slot (D2: shine is never a free add-on of the smoothing film).
3. M5 is deliberately kept **disjoint** from M1: an emollient-rich "moisturizing"-positioned mask with one glycerin is an M1 product, not an M5 product. This is the core discrimination D5 was ruled to enforce.
4. `bond_route ≠ none` is a single M2-adjacent observation; it may set `repair_support_level: high` **or** corroborate `repair` focus, but the same token cannot also be counted as a protein-film route for `care_direction`.

---

## 7. Direct properties

Formula-only values describe **potential**, not measured performance. Every value below is capped at E2 unless the record carries exact-finished-product evidence.

### 7.1 Inferable direct properties

| Property | Values | Formula-only ceiling | Required false-signal rule | Abstain when |
|---|---|---|---|---|
| `treatment_concentration_potential` *(mask-specific)* | lower / moderate / higher / unknown | E2 | count **structural position**, not ingredient points; rheology-only ingredients (HEC, xanthan, carbomer) and post-tail heroes are excluded | tail marker unresolved, or formula/product form unresolved |
| `conditioning_deposition_potential` | lower / moderate / higher / unknown | E2 | count architecture, not ingredient points | formula or product form unresolved |
| `wet_slip_detangling_potential` | lower / moderate / higher / unknown | E2 | wet evidence is not dry evidence | architecture ambiguous or only claim evidence |
| `dry_combability_potential` | lower / moderate / higher / unknown | E2 | never upgrade from wet-combing data alone | no dry endpoint or coherent film/lubrication route |
| `surface_lubrication_softness_potential` | lower / moderate / higher / unknown | E2 | friction proxy is not perceived softness | only bottle rheology or claim evidence |
| `smoothing_frizz_control_potential` | lower / moderate / higher / unknown | E2 | deposition route is not weatherproof frizz control | humidity/use protocol absent for a hard claim |
| `shine_potential` | lower / moderate / higher / unknown | E2 | shine is not repair; alignment/film shares M3 with M1; an acid-gloss claim is E0 | only hero ingredient, only R6a, or only claim |
| `humectant_support_potential` *(mask-specific)* | lower / moderate / higher / unknown | E2 | one humectant — glycerin above all — is not a cluster; hydrolyzed proteins are not humectants | tail marker unresolved |
| `weight_deposition_potential` | lower / moderate / higher / unknown | E2 | silicone-free is not light; viscosity is not weight; **silicone presence is not the weight driver — fatty alcohol/butter load is** | full architecture unavailable |
| `body_lightness_potential` | likely_preserving / balanced / likely_depositing / unknown | E2 | name/volume claim is not body evidence | architecture conflicts or no corroboration |
| `repair_lubrication_protection` | none_visible / candidate / tested / unknown | E2 | manageability/breakage protection is not structural repair | endpoint undefined |
| `repair_surface_film` | none_visible / candidate / tested / unknown | E2 | temporary film is not cortex regeneration; free amino acids do not qualify | route depends only on a protein/keratin **name** |
| `bond_specific_support` | claim_only / chemistry_candidate / product_tested / unknown | E2 | "bond/plex/repair" naming is E0; citric acid and hydrolyzed protein are never bond evidence | named chemistry token or substantiation absent |
| `color_chemical_damage_protection` | general_conditioning / candidate / product_tested / unknown | E2 | acid/chelator is not anti-fade proof | no color endpoint |
| `fragrance_scalp_exposure` | R8 values | E1 | exposure is not diagnosis | incomplete/conflicting INCI |

A direct property may be `higher` at E2 only when **multiple independent, endpoint-relevant** formula observations support the route and no material counter-signal exists. One shared mechanism must not upgrade several endpoints as if it were several independent observations. The rationale must say "potential" and preserve the cap.

### 7.2 Explicitly NOT inferable — protocol-only, trace-only, or absent

These are ruled (`01_property-set-v0.md`) and evidence-backed. They must never appear as a comparison field, never influence any value in §9, and never be reconstructed by proxy.

| Item | Status | Why | Where it lives instead |
|---|---|---|---|
| **Dwell / contact time** | **Protocol-only — zero classification credit** | Cationic/silicone deposition is fast and largely equilibrium-driven; 1-min vs 5-min dwell of similar architectures is not reliably different, and no peer-reviewed head-to-head dwell trial exists (evidence §3) | TPL-MASK / P5, sourced from packaging with a source. Required for a valid stamp; irrelevant to classification |
| **The 7-second segment** | **`dwell_efficacy: unknown`, never extrapolated in either direction** | 7 seconds is outside all tested contact times (evidence §3). Charter F2: express Kuren are fully eligible; dwell is never a boundary test | Protocol metadata + `express_dwell_unknown` review trigger (§14) |
| **Heat assist** | **Optional protocol modifier only — never a formula property or ranking input** | Plausible for lipid/small-peptide uptake but evidence is thin and indirect; popular uptake percentages trace to blogs; oil penetration is more damage/porosity-dependent than warmth-dependent (evidence §4) | Protocol deviation note. **Banned wording:** "opens the cuticle", "activates", "boosts penetration" |
| **Cadence / frequency** | Not inferable | Reproduces directions wording, not product behaviour | Protocol metadata |
| **Amount / dosage** | Not inferable | Same | Protocol metadata |
| **Buildup / cumulative residue** | **Trace-only**, `lower / indeterminate / higher`, E0 from one use, E3 only from repeated apply/rinse/wash/removal cycles | One-use deposition is not buildup | Detailed research trace. **Never projected into the nine-field profile** |
| **Rinse behavior** | **Trace-only**, `quick / balanced / tenacious / unknown`, E0 from INCI, E3/E4 tested | Not inferable from ingredients | Detailed research trace. **Never projected into the nine-field profile**; `weight_potential` is the retained ingredient-informed deposition signal |
| **Penetration depth** | Not inferable | INCI discloses no molecular weight, delivery, or substrate state | — |
| **Mask-vs-conditioner category** | Not inferable from INCI | Both are lamellar-gel-network O/W systems on one continuum (evidence §1) | G0, from metadata/directions |

---

## 8. Finished-product methods (the E3/E4 upgrade path)

Recorded so the ceiling is honest, not because v0.1 expects to reach it.

- Wet slip: peak force and total work on controlled wet tresses.
- Dry combability: peak force and total work after controlled drying/humidity.
- Friction/lubrication: specified fibre/probe tribology with orientation, load, speed, humidity.
- Softness: blinded trained sensory, optionally paired with haptic/friction proxies.
- Shine: fixed-geometry goniophotometry/lustre plus blinded visual assessment.
- Rinse behavior: water volume/time to a predefined visual and clean-touch endpoint.
- Cumulative residue: repeated apply/rinse/wash cycles plus deposition and functional endpoint, **including a removal arm**.
- Body/lightness: tress volume/projected width or bundle compression plus blinded assessment.
- Breakage protection: repeated combing fragments/break counts under a defined comparator.
- **Dwell comparison (mask-specific):** identical formula, identical dose, two or more contact times, one pre-registered endpoint, blinded assessment. Until such a study exists for the exact product, dwell stays at zero credit (evidence §3).

Every E3/E4 record names exact formula/version, substrate, damage state, dose, **contact time**, rinse, drying, environment, sample size, comparator, endpoint, and result. Evidence for a shampoo, conditioner, leave-in, routine, or different formula cannot upgrade this product.

---

## 9. The nine-field comparison profile

The ruled shape (`01_property-set-v0.md`) is Conditioner v1.6's nine fields, re-anchored inside the mask category. Only reviewed direct properties may produce it. Authoritative directions remain required protocol metadata but **do not create comparison properties**. Current catalog labels never break a tie.

```text
1 conditioning_level      low / moderate / high              → product_mask_specs.concentration
2 weight_potential        low / moderate / high              → weight (light/medium/rich)
3 care_direction          protein / moisture / balanced      → balance_direction
4 repair_support_level    low / medium / high                → repair_support_level
5 primary_focus           1 of 9 values                      → via benefits mapping
6 secondary_focus         0–2 further values                 → via benefits mapping
7 hair_thickness_fit      subset of fine / normal / coarse   → suitable_thicknesses
8 damage_fit              subset of healthy / moderately_damaged / highly_damaged   (research-only)
9 texture_fit             subset of straight / wavy / curly / coily                 (research-only)
```

Trace level, beneath the profile: `bond_route`, the protein-payload counter-signal (§13), the `multi_use` envelope (§2.2), and `ingredient_flags` (silicones/polymers/oils/proteins/humectants — deterministic presence flags from the normalized complete INCI; **not** a judgment field and never a tie-breaker).

### 9.1 `conditioning_level` — the `concentration` twin (D1, binding)

**Meaning.** Overall conditioning/treatment intensity **relative to the mask category**, from structural INCI position only. Repair stays owned by `repair_support_level`; this field is not a repair proxy at research level.

> Production note, not a research rule: matching currently consumes `concentration` as a repair-need proxy (`mask_concentration_is_temporary_repair_level_proxy`). Whether production later matches repair need against `repair_support_level` instead is a production-policy question outside this project (D1).

**Signals — structural position only.** Compute on the above-tail segment (§3.1).

| ID | Signal | Test |
|---|---|---|
| **S1** | Cationic breadth | ≥ 2 **distinct** long-chain cationic / protonatable-amidoamine species above the tail |
| **S2** | Fatty-alcohol prominence | A long-chain fatty alcohol at rank **2 or 3** of the full list (i.e. immediately after the aqueous phase) |
| **S3** | Lipid breadth above the tail | ≥ 2 **distinct** non-fatty-alcohol lipids (R4a or R4b) above the tail |

**Thresholds.**

- `high` — **≥ 2 of {S1, S2, S3}** satisfied **and** no material counter-signal. (Extremes require multiple independent structural signals — D1.)
- `low` — **none** of {S1, S2, S3} satisfied, i.e. a single cationic species, no fatty alcohol in the top three, and at most one lipid above the tail.
- `moderate` — everything else, **including exactly one satisfied signal**, and including the unresolvable fallback.

**Fallback (D1, binding).** Unresolvable cases → `moderate` + the field listed in `uncertain_fields` (NEQI fallback pattern). Never encode unresolved uncertainty as an extreme.

**Counter-signals (never inputs, always recorded).** Rheology-only ingredients (`Hydroxyethylcellulose`, `Xanthan Gum`, `Carbomer`, `Acrylates/…Crosspolymer`) — these thicken the jar, not the fibre. Long ingredient lists. Sub-1% hero tails (hydrolyzed keratin, panthenol, ceramides listed after fragrance). None of these move the value in any direction (evidence §2 false-signal list).

**Confidence rule.** `high` requires a resolved tail marker, a complete exact-market INCI, and ≥ 2 signals pointing the same way with no counter-signal. `moderate` is the default, and is mandatory when the tail marker is `absent`/`unresolved`. `low` when the formula source is conflicted or the above-tail segment cannot be determined.

**Honest limitation, stated in every record.** A three-step concentration scale is at the **edge of INCI support** (confidence low-moderate at method level; evidence §2). No published dataset maps INCI patterns to validated low/medium/high thresholds. These anchors are provisional and are the first thing the calibration set should move.

**[judgment call — review]** S1/S2/S3 as the exact operational triple, the "≥2 signals → high / 0 signals → low" arithmetic, and the "fatty alcohol at rank 2–3" cut are this standard's additions. D1 fixes the *signal families* (cationic count and rank, fatty-alcohol rank, lipid-above-tail breadth) and the *extremes-need-multiple-signals* principle, not the counting rule.

### 9.2 `weight_potential`

**Meaning.** An ingredient-informed matching prior, not a prediction that the product will visibly flatten hair. Best-supported axis in the category — but inferred, never measured (evidence §8).

**Anchors (evidence §8, adopted provisionally):**

- `low` — a single cationic species **and** no cetearyl-class fatty alcohol in the top three **and** no R4b heavy lipid (butter / heavy triglyceride / occlusive hydrocarbon) above the tail.
- `high` — the rich-base condition (**≥ 2 distinct cationics** above the tail **and** a cetearyl-class fatty alcohol **in the top three**) **plus at least one** of: (a) an R4b heavy lipid above the tail, (b) an occlusive silicone stack above the tail (two or more silicone species, or a dimethicone/dimethiconol pair) — **and** no material unresolved counter-signal.
- `moderate` — everything else. **The expected majority, and accepted** (evidence §8).

**[judgment call — review]** Evidence §8 lists the four `high` markers as one conjunction ("≥2 cationics, cetearyl top-3, butter/heavy oil above tail, occlusive silicone stack"). Requiring all four would make `high` nearly unreachable on real drugstore formulas. This standard reads the first two as the **required base** and the last two as **alternatives**. This is the single most consequential unruled threshold in the document and should be the first item checked against the calibration set.

**Conflict fallback (Conditioner 10.1 pattern, retained).** When a formula-only `high` is already conflict-tagged, exact-product intended finish materially contradicts it (e.g. "leichte Pflege", "ohne zu beschweren", a volume-positioned Kur), and no finished-product evidence resolves the conflict → use `moderate` for lean matching and keep `weight_potential` in `uncertain_fields`. Do not encode unresolved uncertainty as a restrictive `high` that automatically removes fine hair from the broad prior.

**Counter-signals.** Silicone presence per se (**not** the weight driver — evidence §8). `silicone-free` positioning (proves nothing about lightness). Viscosity. A "reichhaltig"/"nourishing" claim without a matching lipid architecture.

**Confidence rule.** `high` requires the full anchor pattern with a resolved tail marker and no positioning conflict; otherwise `moderate`; `low` on formula conflict.

**Wording rule.** Weight drives a **soft preference with a stated reason**, never "fine hair must avoid masks". Fine-hair flattening is a **fit mismatch, not a hair-type law** — silicone-microemulsion evidence shows fine hair can benefit from conditioning products (evidence §8).

### 9.3 `care_direction` (D6, binding — always populated)

**Meaning.** The formula's comparative care emphasis. **Never** an assertion that a user has a protein or moisture deficiency (G6).

**Values — strict Conditioner v1.6 semantics, no redefinition, no empty value, no `none`** (a `none` value was considered and withdrawn — D6):

| Value | Requires |
|---|---|
| `protein` | A **material identifiable R5 protein/peptide/keratin film-support route** that is more than ordinary conditioning |
| `moisture` | A coherent conditioning / humectant / emollient architecture as the material direction, **without** a dominant protein-film route. This is the category's honest default |
| `balanced` | A **substantive mixed** protein-plus-moisture architecture. **Reserved** — never a "neither" middle bucket, never an uncertainty bucket |

**Operational test for "material R5 route":** a qualifying R5 species (§5, R5 — free amino acids excluded) above the tail, **plus either** (a) a second distinct qualifying R5 species above the tail, **or** (b) a single qualifying R5 species within the **first eight above-tail ranks**. **[judgment call — review]** — D6 fixes "material and more than ordinary conditioning"; the two-species / rank-8 disjunction is this standard's operationalization.

**Operational test for `balanced`:** the material R5 route above **and** a qualifying humectant cluster (§9.5 moisture guard: ≥ 3 distinct humectants above the tail, ≥ 2 of them non-glycerin) **or** a substantial R4 lipid/emollient stack (S3 satisfied). Anything that fails both stays `moisture` (or `protein` if only the protein leg qualifies). `balanced` **bridge-matches** in the production fit layer, so inflating it has real downstream cost.

**Gloss/lamination masks (D6, verbatim in substance).** They classify by the **care base they actually carry**. Evidence: L'Oréal Glycolic Gloss treatment and Balea Glow & Shine Laminier-Kur both run a conventional cetearyl / behentrimonium / amodimethicone conditioning base under the acid route, so they land in `moisture` — **or higher if a protein route is material**, e.g. Balea's keratin. The gloss identity is carried by the `shine` focus, not by `care_direction`.

**Counter-signals.** Heavy protein payload → confidence cap (§13). "Feuchtigkeit"/"Hydration" naming with no qualifying cluster → recorded, never decisive. Protein naming with the protein only in the tail → `moisture`, with the claim recorded.

**Confidence rule.** `high` requires a resolved tail marker and an unambiguous route separation. Capped at `moderate` whenever the D4 protein-payload counter-signal fires (§13, binding), whenever the tail marker is unresolved, or whenever `protein` and `moisture` legs are close enough that a reviewer could plausibly call `balanced`.

#### 9.3.1 `care_direction: moisture` ≠ `primary_focus: moisture`

These are **different tests at different bars** and must never be conflated:

| | `care_direction: moisture` (§9.3) | `moisture` as a focus (§9.5) |
|---|---|---|
| Bar | Coherent conditioning/humectant/emollient base without a dominant protein route | The **D5 cluster guard**: ≥ 3 distinct humectants above the tail, ≥ 2 non-glycerin, and no richer special-purpose route winning |
| Frequency | The category default; most masks | Deliberately rare |
| Meaning | "This formula's care emphasis is not protein" | "Humectant-forward is this product's most distinctive job" |

A mask can — and usually will — be `care_direction: moisture` with `primary_focus: smoothing` or `general`. That is correct, not a contradiction.

### 9.4 `repair_support_level`

**Meaning.** The formula's comparative **temporary damage-support route**, not measured repair efficacy and not structural restoration.

| Value | Requires |
|---|---|
| `low` | Ordinary conditioning / lubrication only |
| `medium` | A **distinct temporary protein/peptide/keratin fibre-film route** — the same qualifying test as §9.3's material R5 route |
| `high` | **`bond_route ≠ none`** — a named bond chemistry token visible above the tail in the reviewed formula (R7). Nothing else reaches `high` |

**Explicit non-upgraders** (any of these alone keeps the value where it was earned): generic silicone; oil; panthenol; ceramide; cationic polymer; free amino acids; generic repair naming; ordinary R1 conditioning; finished-product positioning without a corresponding formula route; citric acid; hydrolyzed protein alone (for `high`); a bond token found only in the tail.

> **Mask delta.** Three category-specific inflation risks are closed explicitly:
> 1. **Being a mask is not repair.** The category's higher baseline richness (evidence §1) must never raise `repair_support_level`. `conditioning_level: high` alone is `repair_support_level: low`.
> 2. **Dwell is not repair.** A long or "intensive" contact time carries zero credit (evidence §3).
> 3. **"Bond"/"Reparatur"/"Plex" on the pack is not repair.** "Bond" front-of-pack is frequently an ordinary rich mask (evidence §6). Naming is E0.

**Confidence rule.** `high` is `deterministic` on the token, so confidence tracks the *identity* evidence, not the judgment: `high` confidence only with a verified exact-market INCI and a resolved tail marker. `medium` follows §9.3's protein-route confidence. Every `high` rationale must carry the standing caveat from R7 (no strong independent product-level substantiation at drugstore concentrations; gluconamide bonding has zero independent literature).

**Wording.** Comparative formula potential, never efficacy. Banned: "repairs", "rebuilds bonds", "restores structure", "reverses damage".

### 9.5 `primary_focus` and `secondary_focus` (D2, D5)

**Vocabulary — nine values** (Conditioner v1.6's eight **plus `moisture`**, ruled by Nick 2026-09-04):

`moisture` · `lightness` · `detangling` · `smoothing` · `repair` · `shine` · `curl_support` · `color_care` · `general`

Exactly one `primary_focus` (a forced research-review headline) and zero to two distinct `secondary_focus` values, excluding `general`.

> **Provenance note (D5, corrected 2026-09-04).** `moisture` is not new to the program: **Shampoo Focus v1.5** already carries it as a primary/secondary focus in its research overlay, approved by Nick 2026-09-03. Production Light stays frozen on v1.4 and rejects `moisture` — a deliberate scope boundary, symmetric with Mask, where the moisture focus also does **not** project into `functional_benefits` and reaches production only via `balance_direction`. Conditioner v1.6 and the leave-in v0.3 draft have no moisture focus. No adapter change is needed for Mask.

#### 9.5.1 Formula-first decision rule (adapted from Shampoo Focus v1.5)

**Claims identify the candidate job. The complete formula must then support — or at minimum remain compatible with — that job, and meaningful counter-signals must be recorded. No single hero ingredient proves a focus.**

Every mask focus record carries one **`focus_care_verdict`** (named to avoid collision with the `care_direction` field of §9.3):

| Verdict | Meaning |
|---|---|
| `repair_supported` | A coherent substantive/deposition or damage-care cluster supports repair — **not merely one protein token** |
| `moisture_supported` | A coherent humectant cluster (R9) plus conditioning/emollient support meets the D5 guard |
| `dual_supported` | The formula genuinely supports both directions |
| `nonspecific` | Generic intensive conditioning is compatible with both but distinguishes neither |
| `not_applicable` | The chosen focus is not a repair/moisture decision |

**Claim role** ∈ `candidate` | `tie_breaker` | `corroborating` | `not_applicable`.

**The hard rule (binding, adapted from v1.5 and D5):** exact-product claims **may break a genuinely `dual_supported` tie**. Claims can **never** convert `nonspecific` formula evidence into a confident specialist focus. `nonspecific` resolves to `general` (or to `smoothing` when the dry-surface route genuinely clears §9.5.2 step 6), never to `moisture` and never to `repair`.

Ingredient order is used qualitatively, not as a concentration claim. Rinse-off limitation, shared conditioning routes, and counter-signals stay visible in the record.

#### 9.5.2 Deterministic hierarchy

Apply in order, after §7 direct properties are complete.

1. **Exclude the category baseline.** Intensive conditioning is what a mask *is*. A rich R1/R4 base supports conditioning, wet slip, surface smoothing, and softness — it does **not** automatically make `detangling`, `smoothing`, or `moisture` the product's distinctive main purpose. This step is stricter than the Conditioner equivalent because the mask baseline is higher (evidence §1).
2. **Group evidence by shared mechanism** (§6) before comparing endpoints. Several ingredients may strengthen M1 without creating several independent technologies.
3. **Test special-purpose routes first**, in this order:
   - **`repair`** — requires a distinct R5 protein/peptide film route or R7 named bond chemistry, or exact-product damage-endpoint evidence. R2 silicone alone, panthenol, oils, ceramides, cationic polymers, free amino acids, biotin, generic repair naming, and `bond_specific_support = claim_only` **cannot** set `repair`.
   - **`curl_support`** — requires high slip **plus** compatible weight/body architecture; curl/coily positioning is corroboration only, never creation.
   - **`color_care`** — requires at least a formula candidate **plus** compatible exact-product positioning or product-tested evidence. (Note: colour-*depositing* masks are excluded at G0; `color_care` here means colour-protection positioning on an eligible mask.)
   - **`lightness`** — requires `weight_potential: low` **plus** likely-preserving body. **Expected to go unused in this category** (watch-list item 2, acknowledged by Nick). If it is never selected across the first set, that is a finding to report, not a threshold to loosen.
4. **`moisture`** — apply the **D5 guard** (§9.5.3). It is tested *after* repair/curl/colour/lightness because D5 requires that "no richer special-purpose route wins".
5. **`shine`** — requires a **distinct optical emphasis architecture** *plus* claim corroboration (§9.5.4). Never added when it is merely the expected optical result of the smoothing film (D2).
6. **`smoothing`** — prefer when dry surface control is the clearest practical differentiator **and** the architecture extends materially beyond the ordinary mask base (a distinct silicone, substantive polymer, or substantial lipid/emollient route beyond baseline).
7. **`detangling`** — permitted as primary **only** when slip/combability is itself distinctive: clearly stronger than competing routes, or exact tangling/combability positioning corroborates it, and no richer special-purpose route wins. **Expected to be rarer than in Conditioner:** every mask is a slip product, so slip is baseline here. **[judgment call — review]** — the *expectation* is this standard's; the threshold text is inherited unchanged.
8. **`general`** — the honest fallback when the product is a capable conventional mask but no specific focus clears the differentiator threshold, when formula evidence is nonspecific, or when competing directions cannot be resolved conservatively.
9. **Official positioning may corroborate but never create a route.** Current catalog values never break a tie.
10. **Mark `primary_focus` uncertain** when two plausible purposes remain unresolved.

**Secondary focus.** A secondary may represent a distinct user endpoint even when it shares part of a mechanism, but it must add **useful matching information**. Do not spend a slot on moderate shine that only reuses the primary smoothing route (§6 rule 2).

**Required focus explanation** (inherited, non-negotiable). For every product, the focus record must list: the exact INCI ingredients or formula pattern carrying each candidate route, with ranks; the direct-property comparison that selected the winner; any exact-product positioning used **only** as corroboration; the `focus_care_verdict` and `claim_role`; and the evidence ceiling. It must also state **why a plausible competing focus lost** and **why each secondary adds a distinct endpoint** rather than double-counting the primary film route. "Smoothing fits this product" is not an acceptable rationale.

#### 9.5.3 The `moisture` focus guard (D5, binding — tested 2026-09-04)

**`moisture` qualifies only when ALL of the following hold:**

1. **Cluster size.** At least **three distinct humectant-class ingredients** (R9 list) declared **above the tail**, of which **at least two are not glycerin**.
   *This is the operationalization of the ruled guard "glycerin alone never qualifies — `moisture` requires at least two further distinct humectants above the fragrance/preservative tail."* It reproduces the ruled discrimination set exactly: Balea Aqua Hyaluron 3in1 (4 humectants above tail, no protein/bond/silicone routes) → clears; Guhl 30 sek Feuchtigkeit (3 humectants, no competing route) → clears; Gliss Bonding (glycerin at #3 but repair routes win) → fails at criterion 3; Pantene Bond (no cluster) → fails at criterion 1.
2. **Not the baseline.** Intensive conditioning alone never qualifies. A rich R1/R4 architecture is M1, not M5 (§6 rule 3).
3. **No richer special-purpose route wins.** `repair`, `curl_support`, `color_care`, and `lightness` are tested first (§9.5.2 step 3). If any clears, `moisture` may still take a **secondary** slot if it independently meets criteria 1–2 and adds distinct matching information.
4. **Hydrolyzed proteins are not counted** toward the cluster (they are R5).

**Confidence rule.** `high` requires ≥ 3 distinct qualifying humectants above the tail **with at least one within the first five ranks** of the full list, a resolved tail marker, and no competing route. Otherwise `moderate`. **[judgment call — review]** — the "one within the first five ranks" cut is this standard's addition. It is consistent with the v1.5 pilot's Elvital Hydra Hyaluronic call (`moisture`, moderate confidence, "humectant not early"), which D5 cites as consistent with the above-the-tail requirement.

**Wording (D5, binding).** E2 phrasing is **"humectant-forward comparative direction"**. **Never** "proven hydration", "hydrates the hair", "moisturizes", "restores moisture balance", or any moisture-delivery claim.

#### 9.5.4 The `shine` threshold, and gloss/lamination masks (charter F4, D2)

Gloss/lamination masks route through the **ordinary shine threshold with claim corroboration**. There is **no separate lamination property** (evidence §7).

**`shine` qualifies only when ALL of the following hold:**

1. **Distinct optical emphasis architecture** — an alignment-oriented R2 silicone and/or R3 cationic-polymer route above the tail, **with a comparatively low lipid load** (no R4b heavy lipid above the tail). This is the formula shape that distinguishes a gloss product from a rich nourishing mask.
2. **The optical route is not merely the smoothing film already counted.** If the same M1/M3 deposition is the sole basis, select `smoothing` and keep the gloss claim as claim context only (§6 rule 2).
3. **Claim corroboration** — exact-product Gloss / Glaze / Laminierung / Glanz positioning. Corroboration only: positioning can never create the route (step 9 of the hierarchy).

R6a acid-gloss context (`Glycolic Acid` above the tail in a gloss-positioned product) is **supporting context, never sufficient**.

**Banned wording, absolute** (evidence §7): *seals*, *versiegelt*, *closes the cuticle*, *laminates the hair*, *lasting*, *permanent*, *builds a protective layer that stays*. Permitted: temporary optical/surface emphasis, comparative shine **potential**. Glycolic acid **temporarily plasticizes** and does **not** seal.

Care direction for these products is decided by the base they carry (§9.3, D6) — typically `moisture`, or `protein` where a keratin route is material (Balea Glow & Shine).

### 9.6 `hair_thickness_fit` — derived policy

Deterministically derived from `weight_potential` (`01_property-set-v0.md` field 7):

| `weight_potential` | `hair_thickness_fit` |
|---|---|
| `low` | `fine`, `normal` |
| `moderate` | `fine`, `normal`, `coarse` |
| `high` | `normal`, `coarse` |

This is a **desired-finish / dosage prior**, not a universal exclusion (evidence §8). Never worded as "fine hair must avoid masks".

**Vocabulary delta:** this repo's canonical thickness vocabulary is `fine` / `normal` / `coarse` (project conventions). The Conditioner standard's §10.4 text says "medium"; `normal` is the same middle value under the repo's canonical name. No semantic change.

### 9.7 `damage_fit` — derived policy, specialist-route pattern (Conditioner v1.6 re-stated for masks)

| Condition | `damage_fit` |
|---|---|
| `conditioning_level: low` | exactly `healthy` |
| `conditioning_level: moderate` | exactly `healthy` + `moderately_damaged` |
| `conditioning_level: high` **without** a qualifying specialist route | exactly `healthy` + `moderately_damaged` |
| `conditioning_level: high` **with** a qualifying specialist route | exactly `moderately_damaged` + `highly_damaged` |

**Qualifying specialist route** — any one of: (a) a distinct protein/peptide/keratin fibre-film route (i.e. `repair_support_level ≥ medium`); (b) named bond chemistry (`bond_route ≠ none`); (c) exceptional corroborated protection; (d) a relevant exact-product test.

**The specialist result replaces the general-high set — never emit all three values.**

**Never qualifying:** generic silicone, oil, panthenol, ceramide, cationic polymer, free amino acids, repair naming, a generic lubrication candidate.

This is a **broad product prior**, not a repair-efficacy claim.

> **Mask delta.** Because the mask baseline is richer, `conditioning_level: low` is expected to be **rare**, so most of the shelf should land on `healthy` + `moderately_damaged`. If the first set produces a large `moderately_damaged` + `highly_damaged` bucket, that is evidence the specialist-route test is leaking, not evidence that drugstore masks repair hair.
>
> **Watch-list item 1** (`01_property-set-v0.md`): `damage_fit` may be fully derivable from conditioning level + repair route and could become a computed row. The table above is already deterministic given fields 1 and 4 — the first-set review should decide whether to keep it as a reviewed field or demote it to a computed projection.

### 9.8 `texture_fit` — derived policy (Conditioner 10.4 pattern)

| Architecture | `texture_fit` |
|---|---|
| Low-weight / lightness architecture (`weight_potential: low`) | `straight`, `wavy` |
| Balanced architecture (`weight_potential: moderate`) | `straight`, `wavy`, `curly` |
| High-slip, high-deposition architecture (`weight_potential: high` with a coherent high-slip R1/R3 route) | `wavy`, `curly`, `coily` |

**Curl branding alone never determines the result.**

Research-only: mask matching does not consume `texture_fit` today. Nick ruled 2026-09-04 that it stays, because it is needed for user-profile matching down the line. It is **off** the watch-list.

### 9.9 Conflict handling and completion

When evidence conflicts: follow the canonical source hierarchy (§2.4), choose **one** documented formula/directions basis, **complete the profile**, and list the affected field in `uncertain_fields`. Only G0 boundary exclusions omit the profile entirely.

Current live catalog values (`protein_moisture_balance`, `repair_level`, weight, ingredient flags) are comparison-only historical data. They cannot determine a new classification or break a tie.

**Projection stops here.** Any mapping of these nine fields into `product_mask_specs`, `balance_direction`, `functional_benefits`, or any other production column is a **separate, separately approved** adapter decision outside this standard (charter stop condition). D2 records the intended deterministic benefits derivation (smoothing → `smoothing_frizz_control`, detangling → `detangling_slip`, shine → `shine`); `moisture` has no `functional_benefits` counterpart and reaches production only via `balance_direction`, so **no adapter change is needed** — that is a note about the target, not an authorization to write to it.

---

## 10. Evidence lexicon

One versioned lexicon backs the route dictionary. Each entry records:

```text
normalized name / aliases
functional family            (cationic, fatty alcohol, silicone, cationic polymer,
                              lipid-light, lipid-heavy, protein/peptide, free amino acid,
                              humectant, acid/buffer/chelator, rheology-only,
                              preservative, fragrance/allergen, colorant, bond-named)
directly supported routes     (R1…R9)
mask-specific evidence role   (structural signal S1/S2/S3, weight anchor, humectant cluster
                              member, tail-class marker, explicit non-qualifier)
exclusions / common false positives
source and review date
```

The lexicon **extracts evidence**; it must not silently become a label algorithm. Only `bond_route` and `ingredient_flags` are deterministic lexicon lookups. Version the lexicon whenever a change would invalidate historical records; historical validation continues to use the evidence-method version stored in each artifact.

---

## 11. Formula-first sequence

1. Build a **blind packet**: normalized complete INCI, product form, and the directions facts needed for G0/§2.2 — with brand, product name, claims, prior catalog labels, and fit outcomes removed.
2. **Freeze its hash** before unblinding.
3. Classify §7 direct properties and §9 fields 1–4 and 6–9 from the blind packet.
4. **Unblind.** Claims may influence **only**: the `shine` focus corroboration leg (§9.5.4 criterion 3), a genuinely `dual_supported` focus tie (§9.5.1), the `bond_claim_review` trigger, the `weight_potential` conflict fallback (§9.2), and `color_care` corroboration. Claims may influence **nothing else** — in particular not `conditioning_level`, not `care_direction`, not `repair_support_level`, and not the moisture guard.
5. Record every blind-to-final change with its reason.
6. The same evidence packet and policy must be usable by an independent second researcher.

---

## 12. Gates

- **G0 — Boundary (charter, §2.1/§2.2).** Excluded forms do not classify. Multi-use products classify **mode-scoped** or not at all. Eligibility is read from authoritative directions, never from the jar, the marketing name, or the INCI. No product receives two engine profiles.
- **G1 — Identity/formula.** Follow the canonical source hierarchy, preserve the conflict, and complete a provisional research profile from the best available exact-market evidence.
- **G2 — Evidence firewall.** observation → direct property → profile fit. No shortcuts. Protocol metadata (dwell, heat, cadence, amount, placement, rinse) never crosses into a comparison property.
- **G3 — Anti-double-counting.** One shared mechanism counts once unless endpoint-specific evidence separates it (§6). M5 stays disjoint from M1.
- **G4 — Evidence cap.** Formula-only ≤ E2; claim-only E0. Every v0.1 profile is an E2 document.
- **G5 — Conflict.** Preserve source conflicts and lower the **smallest affected scope**; a conflict that changes one property makes that property `unknown`, not the whole profile.
- **G6 — Medical.** No diagnosis, treatment, hair-loss lifecycle, inflammation, infection, or structural-regeneration suitability. Healthy/cosmetic population only. Cosmetic guidance stays separate from medically adjacent scalp or hair-loss guidance. "Protein overload" is banned vocabulary (§13).
- **G7 — Review freshness.** Review fingerprints must match identity, formula, analysis, and standard. Each newly written profile field uses a deterministic **unsalted** SHA-256 fingerprint of its canonical field evidence/value payload; equality proves the field content is unchanged and preserves its approval, changed content reopens. The whole-profile fingerprint binds the canonical nine-field profile plus `standard_version`, and is **not** a substitute for the per-field fingerprints. Because v0.1 is a draft, **every** field is open; no approvals carry forward into a later version until that version explicitly says which fields it leaves closed.

---

## 13. Overload counter-signal rule (D4, binding)

**Verdict from the evidence (evidence §5).** "Protein overload" as a named condition is **not established** — it is a practitioner/consumer construct. Published protein work mostly shows *improved* mechanics (mid/high-MW keratin peptides raising Young's modulus, reducing breakage). Heaviness or stiffness is a real but **individual, reversible product-to-hair mismatch**.

**The rule.**

A **heavy protein payload** — multiple distinct R5 species above the tail, and/or a qualifying R5 species in the top five ranks — produces exactly three effects and nothing else:

1. a **trace-level counter-signal record** (`protein_payload_counter_signal`), listing the species and ranks;
2. a **confidence cap** on `care_direction` at `moderate`;
3. a **human review trigger** (`protein_payload_review`, §14).

**It is never:**

- a comparison field;
- a user-facing verdict;
- a value modifier on any of the nine fields (it caps confidence, it does not move a value);
- a diagnosis, a warning, or a suitability exclusion.

**Banned vocabulary** in every rationale and every downstream surface: *protein overload*, *Proteinüberschuss*, *too much protein*, *protein-sensitive hair*, *needs a protein break*.

**Parked out of scope (Nick, 2026-09-04):** a routine-level protein-stacking heads-up — a warning when protein-focused products combine across one routine — belongs to the production/fit layer as its own later decision. It is not part of this engine.

**[judgment call — review]** The operational trigger ("multiple distinct R5 species above the tail, and/or a qualifying R5 species in the top five ranks") is this standard's; D4 fixes only the *handling* of a heavy protein payload, not its detection threshold.

---

## 14. Human review triggers

Require targeted human review for:

**Inherited from Conditioner §12:**

- product-form ambiguity;
- formula-source conflict;
- absent exact-market formula or identifier;
- proprietary bond/repair claim;
- root/scalp application;
- fragrance-free / hypoallergenic implication;
- multi-product or routine-level efficacy evidence;
- a directional detailed-trace rinse-behavior or buildup value;
- a proposed hard user-fit rule;
- any attempt to replace current production fields.

**Mask-specific additions:**

| Trigger | Fires when |
|---|---|
| `bond_claim_review` | The product carries Bond/Plex/Bonding positioning **but no nameable bond-chemistry INCI token above the tail** (R7). This is expected to be the single most frequent mask trigger — "Bond" front-of-pack is frequently an ordinary rich mask (evidence §6) |
| `multi_use_directions_ambiguity` | Authoritative directions cannot be resolved into exactly one qualifying rinse-out mask mode (§2.2 step 5) |
| `express_dwell_unknown` | The product's stated dwell is in the **7-second segment**, which is outside all tested contact times. The record must carry `dwell_efficacy: unknown` and must not extrapolate in either direction (evidence §3) |
| `protein_payload_review` | D4 heavy protein payload (§13) |
| `gloss_lamination_claim` | Any Gloss / Glaze / Laminierung / Lamination positioning (charter F4) — verify the shine threshold was met independently and the banned wording is absent |
| `tail_marker_anomaly` | Tail marker `absent` or `unresolved` (§3.1) |
| `missing_sourced_contact_time` | TPL-MASK/P5 has no sourced contact time. The product is **not stampable** and goes to Nick. (The research profile may still complete; the protocol may not) |
| `weight_high_conflict` | `weight_potential` reached the `high` anchor while exact-product positioning materially claims lightness (§9.2 fallback applied) |
| `low_confidence_field` | Any of the nine fields lands at `low` confidence |
| `specialist_damage_fit` | `damage_fit` resolved to `moderately_damaged` + `highly_damaged` — verify the specialist route genuinely qualified |

---

## 15. Calibration rule

**Blind reviewers receive this standard and the locked formula/source packets — never the proposed key.**

Compare: exact agreement, adjacent agreement, mean absolute difference, maximum difference, systematic drift, completion, and coded causes. Every difference is explained as one of: source ambiguity, missing evidence, rule ambiguity, double counting, overconfidence, or legitimate uncertainty.

Report separately:

- raw exact agreement overall and **per field**;
- label prevalence per field (this matters here: `moderate` is expected to dominate fields 1 and 2, so raw agreement will flatter the scale — report **conditional agreement** for default-heavy fields);
- confidence distribution;
- **deterministic-property agreement separately** (`bond_route` and `ingredient_flags` should be at or near 100%; anything less is a lexicon defect, not a judgment disagreement);
- every disagreement and its adjudication.

**Systemic rule changes require a pilot rerun.** Product-specific uncertainty remains uncertainty. Passing shows research-process repeatability, not real-world outcome accuracy.

**v0.1 status.** This document is **pre-calibration**. No blind lane has run against it and **no repeatability claim exists**. The anchors most likely to move on first contact with real formulas, in priority order:

1. the `weight_potential: high` conjunction-vs-alternatives reading (§9.2) — the largest unruled judgment call;
2. the S1/S2/S3 counting rule for `conditioning_level` (§9.1) — a three-step scale is at the edge of INCI support;
3. the `care_direction: protein` rank-8 / two-species test (§9.3);
4. whether `lightness` and `detangling` are ever selected in this category (§9.5.2 steps 3 and 7);
5. whether `damage_fit` should become a computed row (watch-list item 1).

Calibration product selection, the frozen cohort, the envelope/adapter schema, and the runbook are **out of scope for this document** and are separate Phase-4 artifacts.

---

## 16. Conditioner deltas

### 16.1 Where this standard deviates from Conditioner v1.6 — and why

| # | Area | Conditioner v1.6 | Mask v0.1 | Why |
|---:|---|---|---|---|
| 1 | **Category boundary** | Masks/deep treatments are an **excluded form** (§2) | Masks are **the** category; conditioner-mode-only multi-use products are excluded here | Charter category definition; no product receives two engine profiles (F1) |
| 2 | **Multi-use products** | Excluded outright ("multi-use products permitting materially different rinse-out and leave-on behavior") | **Eligible, mode-scoped** — classified only in the rinse-out mask mode, with a `multi_use` envelope naming uncovered modes | Charter F1. Eight such products are live and `is_chaarlie_recommended`; excluding them would forfeit the coverage target |
| 3 | **Reference distribution** | Anchored across conventional rinse-out conditioners | Anchored **within the mask shelf** — the same formula may read one step lower here | Evidence §1: masks shift richer on one continuum; a shared scale would push the whole category to `high` |
| 4 | **Field 1 name/semantics** | `conditioning_level` from `conditioning_deposition_potential` | `conditioning_level` as the **`concentration` twin** — overall treatment intensity from structural position only | D1 (binding) |
| 5 | **Structural-signal formalism** | Prose ("count architecture, not ingredient points") | Explicit **S1/S2/S3** signals with a counting rule and a `moderate` fallback | D1 requires "extremes need multiple independent structural signals" + NEQI-pattern fallback; evidence §2 names the honest and false signals |
| 6 | **Tail marker** | The under-1% boundary is acknowledged as invisible; no operational marker | An explicit **`tail_index` rule** with a tail-class list and anomaly handling | D1: "ingredients after the fragrance/preservative block contribute nothing" needs a reproducible cut for a blind lane |
| 7 | **Focus vocabulary** | Eight values | **Nine** — plus `moisture` | D5 (binding), ruled by Nick 2026-09-04; provenance is Shampoo Focus v1.5 |
| 8 | **`moisture` guard** | n/a | Cluster guard: ≥ 3 distinct humectants above the tail, ≥ 2 non-glycerin, no richer route winning | D5, tested on four real formulas (Balea Aqua Hyaluron, Guhl 30 sek pass; Gliss Bonding, Pantene Bond fail) |
| 9 | **New route R9** | No humectant route | **R9 humectant cluster** + mechanism **M5**, kept disjoint from M1 | The `moisture` focus needs a route to hang on, and it must not be satisfiable by a rich emollient base |
| 10 | **Formula-first care verdict** | Not present | **`focus_care_verdict`** (repair/moisture/dual/nonspecific/not_applicable) + `claim_role`, with "claims may break a dual tie, never upgrade nonspecific" | Adapted from the approved Shampoo Focus v1.5 discipline, as D5 instructs for Phase 3 |
| 11 | **`bond_route`** | R7 is a review flag; `bond_specific_support` is a graded direct property | A **deterministic four-value enum** (`maleate`/`gluconamide`/`peptide`/`none`) that **gates** `repair_support_level: high`, requiring a nameable INCI token | `01_property-set-v0.md` trace-level ruling + charter F3. Bond positioning is far more common on masks than on conditioners |
| 12 | **Free amino acids** | Not called out | **Explicitly non-qualifying** for R5 | Mask "Repair"/"Reparatur" naming is dense; amino-acid tokens would inflate `care_direction: protein`, `repair_support_level: medium`, and specialist `damage_fit` |
| 13 | **Gloss / lamination** | Not addressed | **R6a context** + a three-criterion `shine` threshold + absolute banned-wording list; **no lamination property** | Charter F4 + D2 + evidence §7: lamination is positioning, glycolic acid plasticizes temporarily and does not seal |
| 14 | **Lipid route granularity** | Single R4 | **R4a light/mid vs R4b heavy**, with only R4b feeding the `weight_potential: high` anchor | Evidence §8: butter/heavy-triglyceride load is the weight driver; evidence §1: masks carry heavier lipids |
| 15 | **Silicone and weight** | `weight_deposition_potential` false-signal rule says "silicone-free is not light" | Same, **plus** the positive direction closed: "silicone presence is not the weight driver" | Evidence §8 states the driver explicitly. Masks carry more silicone, so the inflation risk is larger |
| 16 | **Dwell / heat** | Not applicable (conditioners have no meaningful dwell axis) | **Explicitly zero classification credit**, with the 7-second segment marked `unknown` and a dedicated trigger | Evidence §3 and §4 + `01_property-set-v0.md` "explicitly protocol-only". This is the category's biggest temptation to over-infer |
| 17 | **Overload handling** | Not addressed | **D4 rule**: trace counter-signal + `care_direction` confidence cap + review trigger; never a field, never diagnosis language | D4 (binding) + evidence §5: "protein overload" is not an established condition |
| 18 | **Thickness vocabulary** | fine / medium / coarse | fine / **normal** / coarse | Repo canonical vocabulary. Same middle value, no semantic change |
| 19 | **`usage_role` / `scalp_application_fit`** | Excluded, with the reasoning that a mask/intensive protocol "belongs to its applicable product-form boundary" | Excluded **and** the protocol explicitly owned by TPL-MASK/P5 (`replaces_conditioner`, Längen und Spitzen, required sourced contact time) | The boundary Conditioner v1.6 pointed at is this document's P5 boundary |
| 20 | **Scalp reasoning** | R8 carries a root/scalp suitability discussion | R8 notes that a directions-compliant mask is **not a scalp product**; whole-head directions are a P5 deviation | P5: Ansatz aussparen |
| 21 | **`detangling` expectation** | A live primary focus in the pilot | Same threshold, but **expected rarer** — slip is category baseline | Evidence §1: the mask baseline already delivers slip |
| 22 | **Lock status** | Locked v1.6, logic approved, calibrated (22/22 on the two new fields) | **Draft v0.1, pre-calibration, zero repeatability claim** | First-set-then-adjust caveat in `01_property-set-v0.md` |
| 23 | **Production adapter** | Conditioner Production Adapter v1 may derive compatibility rows after research | **No adapter, no projection, no writes** — D2 records the intended derivation as a note about the target only | Charter stop condition |

### 16.2 Where this standard deliberately matches Conditioner v1.6 — and why

| Area | Match |
|---|---|
| **Nine-field shape and vocabulary** | Identical fields, identical value sets (except the ninth focus value and the thickness vocabulary naming). Ruled: conditioner-parity profile (`01_property-set-v0.md`) |
| **Evidence scale E0–E5** | Inherited verbatim in substance, including the E2 formula-only ceiling and "reviewer agreement measures repeatability, not truth" |
| **EU Art. 19 semantics** | Inherited verbatim: descending above 1%, arbitrary below, boundary invisible, never infer percentages, pH, MW, droplet size, dose, or process |
| **Evidence record shape** | Conditioner §4 field list inherited whole; mask-specific fields appended, none removed |
| **Routes R1–R8** | Same route IDs, same permitted-statement discipline, same "presence proves a clue" boundary. Only the deltas above are added |
| **Shared mechanisms M1–M4** | Inherited unchanged; M5 appended |
| **Anti-double-counting (G3)** | Inherited unchanged, then tightened with three mask-specific applications |
| **Direct-property table shape** | Conditioner §7 pattern, including the "`higher` needs multiple independent endpoint-relevant observations" rule and the potential-not-performance wording rule |
| **`care_direction` semantics** | **Strict v1.6, no redefinition** — `protein` needs a material film route, `moisture` is the coherent non-protein direction, `balanced` is reserved for substantive mixed architecture and is never a "neither" bucket. D6 makes this explicit and binding |
| **`repair_support_level` semantics** | v1.6 low/medium/high meanings inherited; only the `high` gate is made deterministic |
| **Focus hierarchy discipline** | Baseline exclusion, mechanism grouping, special-purpose-routes-first, positioning corroborates but never creates, catalog values never break ties, required focus explanation, at most two secondaries that must add distinct endpoints |
| **`damage_fit` specialist-route pattern** | Inherited exactly, including "the specialist result **replaces** the general-high set; never emit all three values" |
| **`texture_fit` mapping** | Conditioner 10.4 pattern inherited unchanged |
| **`weight_potential` conflict fallback** | The NEQI rule inherited: never encode unresolved uncertainty as a restrictive `high` that removes fine hair from the broad prior |
| **Gates G0–G7** | Same seven gates, same meanings; G0 and G7 re-scoped to this category and this draft status |
| **Human review triggers** | Conditioner §12 list inherited whole, then extended |
| **Calibration method** | Conditioner §13 pattern: blind reviewers get standard + packets, never the key; the same seven comparison metrics; systemic changes force a rerun |
| **Research/production separation** | Inherited and reinforced by the charter stop condition |

---

## 17. Template coverage map

Mapping to `category-classification-engine-template.md` (the 12-section shell), for the acceptance check:

| Template section | Satisfied by |
|---|---|
| 1. Category boundary | §2.1, §2.2 (charter-derived) |
| 2. Input authority | §2.3, §2.4 |
| 3. Direct product properties | §7.1, §7.2, §9 (per-field: values, signals, thresholds, counter-signals, confidence, fit consumers) |
| 4. Evidence lexicon | §10 |
| 5. Deterministic vs judgment | §4 (`decision_type`), §9 per field; deterministic = `bond_route`, `ingredient_flags`, fields 7–9; claim-gated = `shine` corroboration, `color_care`, bond claim; not inferable = §7.2 |
| 6. Formula/input-first sequence | §11 |
| 7. Confidence | §4.1, plus a per-field confidence rule in every §9 subsection |
| 8. Product truth vs user fit | §9 (fields 1–6 = product truth; fields 7–9 = broad fit priors), §9.9 |
| 9. Calibration and holdout | §15 (cohort selection itself is out of scope for v0.1) |
| 10. Validation and artifacts | §4, §11 step 2 (frozen packet hash), G7 |
| 11. Activation gate | §9.9, charter stop condition — no activation is implied anywhere |
| 12. Acceptance checklist | §16 plus this table |

---

## 18. Open questions for the first-set review

1. **`weight_potential: high`** — is the base-plus-one-alternative reading (§9.2) the intended reading of evidence §8's four markers, or should all four be required? Highest-impact unruled call in this document.
2. **`conditioning_level` counting** — do S1/S2/S3 with the "≥2 → high, 0 → low" rule produce a usable spread on the real shelf, or does it collapse to `moderate`? If it collapses, is a two-step scale more honest than a three-step one (evidence §2: three steps are at the edge of INCI support)?
3. **`care_direction: protein`** — is the "second species OR within first eight above-tail ranks" test the right bar, and should `Keratin Amino Acids` really be non-qualifying alone?
4. **`lightness` and `detangling`** — if neither is ever selected across the first set, do they stay in the vocabulary for parity, or come out?
5. **`damage_fit`** — promote to a computed row (watch-list item 1), or keep as a reviewed field?
6. **Gloss cohort** — do L'Oréal Glycolic Gloss, Syoss Lamination Intense Glaze, and Neqi Gloss Glaze actually clear the three-criterion `shine` threshold on their real INCIs, or does the low-lipid-load criterion exclude products the charter explicitly wants classified as shine-focused?
7. **`bond_route: gluconamide`** — can the exact qualifying INCI token(s) be pinned from the Gliss 4-in-1 Repair Bond formula, so the enum value is as deterministic as `maleate`? Until then, `gluconamide` calls rest on reviewer identification and should be flagged.
8. **Tail-marker absence rate** — how often do exact-market drugstore mask INCIs lack any tail-class ingredient? If it is common, the "cap at moderate" rule will dominate the confidence distribution and needs revisiting.
