# Slot 10 — Olaplex N°.6 Bond Smoother

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Bond-repair claim

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | Olaplex — N°.6 Bond Smoother |
| Pack / market | 100 ml · DE |
| GTIN | **unresolved** — 896364002602 vs 896364002619 ("new packaging"); neither merged nor guessed |
| Formula source | douglas.de (Art. 1111439) for the opening segment; T3 search-cached full list for positions 14–46 |
| Identity status | **`provisional_identity_conflict`** |
| Directions status | `captured` (English, non-German-market manufacturer page), rinse test PASS |
| Claims status | `present` (1 entry, **C3**, `creates_claim: false`) |
| Fingerprint | `297ac0d9541987b0d988781f61fbb05fc01e6e966fd150cca4c1bba96fb12aa3` |

**Claim and directions authority (§2.4.1 rule 3).** olaplex.com is a US/global English site with no German region;
the only "EU" storefront located is Spain-hosted and English-language. Both are **C5** — *a Swedish, Spanish or US
brand page is C5 whether or not it is in the EU*. douglas.de is **C3**. **No C1/C2 source exists for this product.**

**Frozen claims consumed (§2.4 rule 3).** One entry, C3 (douglas.de): „bis zu einer Hitze von 232 °C vor
Stylingschäden geschützt" — `creates_claim: false`. The freeze records that a C1/C2 German-market Olaplex source was
explicitly searched for and **none exists**. The identical „450ºF/232ºC heat protection" line on olaplex.com is C5 and
is likewise recorded, not entered.

**Preserved conflicts (G5).** GTIN unresolved (two US-prefix codes, neither DE-specific). Ingredient count varies 46
vs 47 between the lane report and this capture; the first 13 positions match the T2 source exactly. Positions 14–46
rest on a T3 source only. All preserved; the bond-claim active and the LGN-cream architecture are confirmed either way.

## G0 — product-form gate

`in_category`. Water leads (rank 1); the manufacturer's own FAQ names it *"an out-of-shower leave-in treatment and
styling product"* and the directions are "Apply one pump to clean, damp hair. Comb through & style as desired." — no
rinse instruction anywhere (rinse test PASS). HOLD = `none`, so the §2.3.2 architecture half is not established and
`excluded_styling_first` does not arise despite the "styling product" self-description.

## Reading conventions

**Tail marker (§3.1.1):** first capped ingredient = **PHENOXYETHANOL, rank 14 of 46**. Above the tail = ranks 1–13.

Above-tail architecture: Water (1) · **Cetearyl Alcohol (2)** · **Dimethicone (3)** ·
Isohexadecane (4, **volatile**) · Coco-Caprylate (5, dry-feel) · Neopentyl Glycol Diheptanoate (6, dry-feel) ·
**Behentrimonium Chloride (7)** · Isododecane (8, **volatile**) · **Phenyl Trimethicone (9)** · Propanediol (10) ·
**Bis-Aminopropyl Diglycol Dimaleate (11)** · Parfum (12) · Cetrimonium Chloride (13).
Below-tail, decision-relevant: Glyceryl Stearate (15) · Isopropyl Alcohol (16) · Hydroxyethylcellulose (17) ·
Hydroxypropyl Guar (18) · **Hydrolyzed Vegetable Protein PG-Propyl Silanetriol (24)** ·
Helianthus Annuus Seed Oil (34) · **Cocos Nucifera Oil (46)**.

## Dimensions (§7)

### FORM — `emulsion` (`emulsion_subtype: lgn`, trace-only)
- `confidence` **moderately_high** · **E1/E2** · formula
- Decision order: `anhydrous` no → `two_phase` no → **`emulsion` matched**, sub-type (a): the LGN pair
  **Behentrimonium Chloride (7) + Cetearyl Alcohol (2)**, with Glyceryl Stearate as co-structure, carrying a silicone
  and ester phase.

### COND — `high`
- `confidence` **moderately_high** (ceiling) · **E2** · formula
- (i) LGN pair above the tail — Cetearyl Alcohol (2) + Behentrimonium Chloride (7); (ii) a further **independent**
  lubrication route — the persistent silicone package, Dimethicone (3) and Phenyl Trimethicone (9). The dry-feel esters
  (5, 6) are a third available route.
- Isohexadecane (4) and Isododecane (8) are **volatile hydrocarbons**: they aid spreading and evaporate, contributing
  **nothing** to residue or persistence (M6, FS-4). The residue is whatever the volatile was carrying.

### SLIP — `high`, bias `dry_biased`
- `confidence` **moderate** (ceiling) · **E2** · formula
- Three independent M1 contributors present as architecture: the cationic LGN route (2/7/13), the persistent silicone
  film (3/9), and the dry-feel ester package (5/6).
- Bias `dry_biased`: a persistent film is present and the water-phase slip agents are thin — Propanediol (10) is the
  only one above the marker; the volatiles carry the spread and then leave.

### SFR — `high` (`smoothing_shine_qualifier: present`)
- `confidence` **moderate** (ceiling) · **E2** · formula
- **§7.4 clause 1 satisfied on two distinct observations:** (i) continuous film route = the persistent silicone system
  (Dimethicone 3, Phenyl Trimethicone 9); (ii) lubrication route resting on ingredient observations **not** among those
  establishing the film — Coco-Caprylate (5) and Neopentyl Glycol Diheptanoate (6).
- Clause 2's failure mode is avoided (the silicones are counted once); clause 3 does not bite (the esters are above
  the marker).

### WT — `high`
- `confidence` **moderately_high** · **E2** · formula
- `formula_observations[]`: **LGN pair present as architecture** — Cetearyl Alcohol (2) + Behentrimonium Chloride (7).
  The `high` anchor's first prong fires on its own.
- `threshold_reasoning[]`: the second prong (≥2 families **with** an enumerated rich-band member) does **not** fire:
  Cocos Nucifera Oil (46) and Helianthus Annuus Seed Oil (34) are the only rich/medium candidates and both sit far
  below the marker at rank 14, so they are not architecture (§3.1.1 clause 1). Ceiling rises to `moderately_high`:
  FORM resolves to a definite architecture and the non-volatile architecture is readable above the tail.
- **§10.1.2 weight conflict tag — declined, condition named.** Condition 1 is satisfied (WT `high` from formula alone).
  **Condition 2 fails: no C1/C2 intended-finish or positioning statement exists** — the only frozen claim is a C3 heat
  statement, and no German-market Olaplex source exists at all. **A retailer, marketplace or secondary statement
  (C3–C5) never triggers the tag**, and a tag applied without a recorded C1/C2 statement is invalid. `weight_potential`
  projects `high`.
- Transfer caution: **not** attached — the rich lipids are below the marker; the above-tail load is a lamellar cationic
  deposit plus dry-feel esters.
- `limitations[]`: fine-hair residue threshold is a product judgment call (§17.11). Positions 14–46 rest on a T3 source
  only, so the below-marker reads carry that additional limitation.

### PERS — `neutral_non_volatile` (projects `moderate`)
- `confidence` **moderate** (ceiling cap) · **E2** · formula
- `threshold_reasoning[]`: `permanent_cationic` requires a polymeric or silicone-functional quat enumerated by name.
  **None is present. Hydroxypropyl Guar (18) is the non-ionic guar, not Guar Hydroxypropyl*trimonium* Chloride** — the
  quaternised species — and it is below the marker in any case. No `Polyquaternium-x`, no `Silicone Quaternium-x`, no
  Quaternium-80, no cationised protein. `ph_dependent_cationic` requires an amino silicone or amidoamine; none.
  The highest class present as architecture is the neutral non-volatile deposit (Dimethicone 3, Phenyl Trimethicone 9,
  Cetearyl Alcohol 2, the esters 5/6).
- **Mandatory monomeric-quat note (§7.6):** Behentrimonium Chloride (7) and Cetrimonium Chloride (13) are the dominant
  persistent **cationic** species — permanently charged, so more substantive than a neutral deposit, but small-molecule
  and surfactant-removable, so below the polymeric/silicone-quat class. The ordinal class is a mechanism ordering, not
  a duration (G11). The note is mandatory and this record would be invalid without it.
- **G11:** no duration, wash count, applications-to-buildup or clarification schedule; the banned circulating removal
  percentages are not used.

### HOLD — `none`
- `confidence` **moderately_high** · **E1** · formula
- No fixative-class L5 polymer is declared. **Hydroxyethylcellulose (17) and Hydroxypropyl Guar (18) are explicit L5
  rheology exclusions** — gums and celluloses that plausibly serve bottle viscosity are not a hold route by themselves
  (§5, FS-25). Sodium Stearoyl Lactylate (19) is an emulsifier.

### HEAT — trace `not_claimed` · binary **`provides_heat_protection: false`** · **`claim_authority_gap`**
- `confidence` **high** · **E0/E1**
- **This is the R12 paradigm case named in the standard itself.** The heat statement („bis zu einer Hitze von 232 °C
  vor Stylingschäden geschützt") exists **only at C3** (douglas.de) and C5 (olaplex.com, English/US). **Retailer copy
  never creates a claim, and a non-German manufacturer page is C5, not C2** (§2.4.1, G13). ⇒ no claim exists for
  classification purposes ⇒ trace state `not_claimed`, **binary `false`** (§13.3 rule 1).
- `counter_signals[]`: the C3 and C5 texts recorded verbatim with their tiers.
- **Routes to review under `claim_authority_gap`** so a human decides whether a manufacturer source was simply not
  found — here the freeze establishes that no German-market Olaplex source exists, which the review should record.
- No L9 member is present at any rank, so the sanity-check adds nothing and no upgrade is possible in either direction.
- **FS-14 observed:** the 232 °C figure is never read as a protection strength; it is a use-condition statement and
  `heat_protection_max_c` does not exist in this model.

### HUM — `not_claimed`
- `confidence` **high** · **E0**
- §7.9 clause 1: no C1/C2 humidity or anti-frizz claim ⇒ `not_claimed`.
- **§7.9 clause 3 applies:** a qualifying route *is* present — a persistent hydrophobic silicone film (Dimethicone 3,
  Phenyl Trimethicone 9) present as architecture, with no dominant humectant architecture (Propanediol 10 is the only
  humectant above the marker). Recorded in `supporting_signals[]` with the required sentence: *"a hydrophobic film
  route is present; the manufacturer makes no humidity claim; humidity response is measured, not inferred."* State
  stays `not_claimed`; nothing user-facing is emitted.

### R2 — `none_visible` + **`candidate_below_tail`**
- `confidence` **moderate** · **E1** · formula
- **`candidate_below_tail` note (§7.10, v0.3 — mandatory `counter_signals[]` entry):** a §7.10-**qualifying** route is
  present — **Hydrolyzed Vegetable Protein PG-Propyl Silanetriol, a silane derivative, at rank 24** — sitting **below
  the tail marker, Phenoxyethanol, at rank 14**. The dimension takes its **rank-supported value, `none_visible`**, and
  the record **routes to human review**. The note creates no fourth state and never appears in the lean profile (G14).
- Panthenol (41) is a fibre-mechanics signal, not an R2 route (FS-24). No plain hydrolysate is declared, so the
  hydrolysate note does not arise.
- **Bis-Aminopropyl Diglycol Dimaleate is not an R2 route.** It is L7 bond chemistry and is handled by the R3 flag; it
  never sets a repair level and never converts into structural repair (§7.10 gates, §8.3).

### DOSE — `high` (derived)
- `derived_from`: `[WT, FORM, L3 spreading class]` · **E2** · `confidence` **moderate**
- WT `high` ⇒ DOSE `high`. FORM contributes no value (`emulsion`, and v0.3 change 18 removes FORM from the value rows
  in any case).

### EXPO — `aromatic_or_allergen_exposure`
- `confidence` **high** · **E1** · formula
- Parfum (12) plus a large declared allergen block: Hexyl Cinnamal (21), Limonene (22), Citral (23), Linalool (26),
  Citronellol (27), Hydroxycitronellal (29), Geraniol (32).
- **No alcohol note.** Isopropyl Alcohol (16) is materially present but sits **outside** the `Alcohol Denat.` /
  `Alcohol` enumeration (§17.21). Recorded; the enumeration is not silently widened.
- Iodopropynyl Butylcarbamate (28) is recorded as an observation only — an exposure flag is not a tolerance prediction
  (§7.12, SR §M.12), and no sensitisation statement is made (G6).

### ROLE — `unknown` (`usage_role: []`)
- `confidence` **low** · directions held below authority
- The only directions are on a **non-German-market manufacturer page**, which is **C5** under §2.4.1 rule 3. §7.13
  rule 1 permits role values only from C1/C2 directions. → `usage_role: []`, in `uncertain_fields`.
- `supporting_signals[]` (recorded with tier): "Apply one pump to clean, damp hair. Comb through & style as desired.";
  FAQ: "You can use Nº.6 Bond Smoother on either damp or dry hair"; "…great when used before air drying or blow
  drying. It can also be used on dry hair to refresh or touch up a style." At C1/C2 this would have established
  `post_wash`, `refresh` and — under the v0.3 `pre_heat` widening — plausibly `heat_styling`. Withheld on authority
  (§17.23).

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | `present` | Qualifier on SFR only |
| CURL | not derived | §17.20; `curl_definition` also fails HOLD and the negative gate |
| **R3** | **`chemistry_candidate`** | **Bis-Aminopropyl Diglycol Dimaleate at rank 11**, above the marker — a recognised bond chemistry explicitly named in L7. `none` requires **no** C1/C2 bond claim **and** no recognised bond chemistry; the chemistry is present, so `none` is refused. `unknown` is reserved for the genuinely unresearched or unresolvable, which this is not. Opens the **`bond_claim_review` flag** and **never sets a repair level** from formula alone (SR §H.2). Independent spectroscopy found **no** increase in cortical disulfide content after treatment with α,β-unsaturated Michael-acceptor repairing agents, and most supportive work is manufacturer-funded; and even granting the chemistry, bond systems were characterised at **salon concentrations and contact times**, so a leave-in at consumer dose inherits none of it (G8, FS-26) |
| LAYER | not emitted | |
| Buildup caution | not emitted | `persistence` projects `moderate` |

## `care_direction` — `moisture`
- `confidence` **moderate** · **E2** · formula
- R2 `none_visible` ⇒ `protein` and `balanced` unreachable. The §9 silicone-led `unknown` rule does not fire: material
  emollient (Coco-Caprylate 5, Neopentyl Glycol Diheptanoate 6) and humectant (Propanediol 10) legs are present above
  the marker. L1 (LGN pair) + L3 + L4 ⇒ `moisture` at up to `moderate` confidence.
- `counter_signals[]` (§9 constraint 3): the product is positioned entirely on bond repair. **Marketing direction never
  sets the value**, and an R3 flag is not a protein route.

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** COND `high` was established by the LGN pair (2/7) **plus a further independent
lubrication route** — the anchor is **over-satisfied**, since either the persistent silicone (3/9) or the dry-feel
esters (5/6) can serve. This lane applies its stated convention: a route is beyond baseline only if it is beyond
baseline under **every** admissible COND-establishing set.

*Step 1 — collect qualifying routes.*

| Route | Verdict |
|---|---|
| `repair` | **Not available.** Prong 1: R2 = `none_visible` (the qualifying silane is below the marker). Prong 2: **no C1/C2 marketing position exists at all** for this product, so no protein or silane active can be named in one. **`R3 = chemistry_candidate` alone may never set `repair` as primary** (§10.2, R14) — the salon evidence is barred by G8 and the chemistry was not confirmed by independent spectroscopy. As a **secondary** focus R3 would additionally require an independent moderate+ observation and a review route; the only candidate independent observation is the below-marker silane, which the rank prong does not place. Not taken |
| `smoothing` | **Not available** under the over-satisfaction convention: the persistent silicone film is inside the COND set under at least one admissible reading (§10.2.1 second bullet). Recorded as the most consequential open reading on this slot — under the alternative COND set {LGN pair, dry-feel esters} this product would project `focus.primary: smoothing`, which its own name asserts |
| `curl_definition` | Not available. HOLD = `none`; the negative gate also fails |
| `heat_styling` | Not available. HEAT = `not_claimed` (C3/C5 only); ROLE is empty |
| `detangling` | Not available. No C1/C2 positioning; prong 2 requires WT `low` |
| `volume_lightness` | Not available. Requires WT `low` and no persistent film route |
| `shine` | Not available. Would restate the film (§8.1, G3) |

⇒ **`focus.primary: general`**, `secondary: []`. `focus` is listed in `uncertain_fields`.

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "high",
  "weight_potential": "high",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": [],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "caution", "medium": "conditional", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "conditional", "wavy": "recommended", "curly": "recommended", "coily": "recommended" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": ["usage_role", "focus"]
}
```

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: high` (row 3); fine `caution` carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 2**. Row 3a needs COND `high` **plus** a qualifying specialist route — a distinct L6 substantive
  film route or an exact-product test; the silane is below the marker and generic silicone, oil, panthenol and repair
  naming do not qualify. Row 3b needs R2 ∈ {candidate, tested}. **R14 is explicit that an R3 bond flag never qualifies
  a product for the highly-damaged tier on its own** — it opens a review flag, is recorded, and is **invisible to this
  table**. A product with an R3 flag and no R2 route sits in row 1 or 2 on its conditioning level like any other.
- `texture_fit` ← **row 3**: WT `high` **and** SLIP `high`.
- `scalp_application_fit` ← **`unknown`** (the default): `avoid`'s architecture trigger needs WT `high` **with a
  rich/low-spreading band member present as architecture**, and coconut and sunflower oil are both far below the
  marker; the narrowed v0.3 irritant-load trigger needs an exposure flag **plus** a material `Alcohol Denat.`/`Alcohol`
  note, and Isopropyl Alcohol is outside that enumeration; positive and `conditional` values both require C1/C2
  directions, which are absent.

## German cautions (§18)

| Emitted by | String |
|---|---|
| WT = `high` | „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren." |
| DOSE = `high` | „Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig." |
| R3 = `chemistry_candidate` **[v0.3]** | „Enthält einen Baustein aus der Bond-Kategorie. Unabhängige Belege dafür, dass sich damit die Haarstruktur verändert, fehlen – wir prüfen das." |
| `usage_role` unknown | „Dazu haben wir keine belastbare Information." |
| `scalp_application_fit = unknown` | „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe." |

**No heat string is emitted.** „… ist ausgelobt" requires C1/C2 authority and the heat statement is C3/C5 — so the
user is told nothing about heat protection for a product whose retail copy leads on 232 °C. That is the R12 mechanism
working exactly as designed, and it is the single largest user-visible consequence of the claim-authority rule in this
gold set.

The **`R3 = chemistry_candidate` string is new in v0.3** and this is the record that needed it: under v0.2 the bond
claim would have reached the user with no honesty qualifier at all, inverting §8.3's entire reasoning.

## Review routing (§14)

| Trigger | Basis |
|---|---|
| **Proprietary bond/repair claim** | `R3 = chemistry_candidate` — standing trigger (L7, §8.3) |
| **`claim_authority_gap`** | Heat claim at C3/C5 only; no German-market Olaplex source exists (§13.3 rule 1) |
| **`candidate_below_tail`** | Hydrolyzed Vegetable Protein PG-Propyl Silanetriol (silane) at rank 24 vs marker at rank 14 |
| Identity conflict | GTIN unresolved; ingredient-count variance; positions 14–46 T3-only (G5) |
| Directions below C1/C2 authority | `usage_role` empty (§17.23) |
| `focus.primary` decided by a reading, not evidence | §10.2.1 COND over-satisfaction |

`review_status`: `provisional` → routed. `out_of_category`: false.
